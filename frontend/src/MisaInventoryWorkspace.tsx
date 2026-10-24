import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MisaDropdownSelect from "./MisaDropdownSelect";
import { apiDate, apiNumber, apiUnitName, useMisaApiLists, useMisaApiSave } from "./misa-api-lists";
import { errorText, nextVoucherNumber, receiveTransfer, saveAssemblyOrder, saveInventoryTransaction, saveOtherInventoryReceipt, saveOtherInventoryIssue, saveItem, saveProductionOrder, saveTransferVoucher, toApiDate, toViDate, TRANSFER_KIND_CODES } from "./misa-api-writes";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import MisaApiDocumentStatus from "./MisaApiDocumentStatus";
import MisaInventorySummaryReport from "./MisaInventorySummaryReport";
import MisaInventoryMultiWarehouseReport from "./MisaInventoryMultiWarehouseReport";
import MisaInventoryDetailLedgerReport from "./MisaInventoryDetailLedgerReport";
import MisaInventoryCostingModal from "./MisaInventoryCostingModal";
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
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_PATTERN, escapeHtml, openPrintFrame, VoucherAttachments } from "./VoucherAttachments";
import { convertNumberToVietnameseWords } from "./MisaCashWorkspace";
import { MisaInventoryItemModal, type InventoryItemData } from "./MisaInventoryItemModal";
import { MisaItemNatureDrawer } from "./MisaItemNatureDrawer";

/** A line of the "Phiếu xuất kho" form; sale fields are filled when it comes from a sale document (UC-INV-03). */
type IssueRow = {
  id: string; itemCode: string; itemName: string; warehouse: string; debitAcc: string; creditAcc: string; unit: string;
  qty: number; price: number; amount: number; prodOrder: string; product: string;
  saleLineId?: string; soldQty?: number; issuedQty?: number; remaining?: number;
};

type SalePickerState = {
  number: string; customer: string; from: string; to: string; rows: any[];
  searched: boolean; loading: boolean; saleId: string; lineIds: string[];
};

const ISSUE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Chưa ghi sổ", REJECTED: "Bị từ chối", PENDING_APPROVAL: "Chờ duyệt", APPROVED: "Đã duyệt · chưa ghi sổ",
  POSTED: "Đã ghi sổ", CANCELLED: "Đã hủy", REVERSED: "Đã đảo",
};

const ISSUE_PRINT_TEMPLATES = [
  { id: "FULL", label: "Phiếu xuất kho (Mẫu số 02 - VT)" },
  { id: "NO_PRICE", label: "Phiếu xuất kho không đơn giá (dùng cho thủ kho)" },
] as const;
const TRANSFER_PRINT_TEMPLATES = [
  { id: "FULL", label: "Mẫu theo loại chứng từ (có đơn giá)" },
  { id: "NO_PRICE", label: "Mẫu theo loại chứng từ, không đơn giá (dùng cho thủ kho)" },
] as const;
const TRANSFER_PRINT_TITLES: Record<string, { title: string; form: string }> = {
  INTERNAL: { title: "PHIẾU CHUYỂN KHO", form: "" },
  TRANSPORT: { title: "PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ", form: "Mẫu số 03XKNB" },
  CONSIGNMENT: { title: "PHIẾU XUẤT KHO HÀNG GỬI BÁN ĐẠI LÝ", form: "Mẫu số 04HGDL" },
};
const TRANSFER_RECEIPT_LABELS: Record<string, string> = { IN_TRANSIT: "Đang vận chuyển", RECEIVED: "Đã nhận" };

export type MisaInventoryWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

type StockAlertRow = { item_id: string; item_code: string; item_name: string; warehouse_id: string; warehouse_name: string;
  quantity: string; minimum_quantity: string; negative_stock: boolean };
type StockAlerts = { company_id: string; low_count: number; out_count: number; low_rows: StockAlertRow[];
  out_rows: StockAlertRow[]; updated_at: string };

// ============================================================================
// SAMPLE DATA
// ============================================================================
export const SAMPLE_WAREHOUSES = [
  { code: "156", name: "Kho hàng hóa", address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội" },
  { code: "152", name: "Kho nguyên liệu", address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội" },
  { code: "153", name: "Kho dụng cụ", address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội" },
  { code: "155", name: "Kho thành phẩm", address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội" },
  { code: "157", name: "Kho hàng gửi đại lý", address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội" },
];

export const SAMPLE_INVENTORY_ITEMS = [
  { code: "DT_IP15", name: "Điện thoại iPhone 15 Pro Max 256GB", unit: "Cái", group: "Hàng hóa", stock: 120, minStock: 20, price: 16200000 },
  { code: "DT_SS24", name: "Điện thoại Samsung Galaxy S24 Ultra 256GB", unit: "Cái", group: "Hàng hóa", stock: 85, minStock: 15, price: 14700000 },
  { code: "LT_MBAIR", name: "Máy tính xách tay Macbook Air 13-inch M2", unit: "Cái", group: "Hàng hóa", stock: 45, minStock: 10, price: 12900000 },
  { code: "LT_HPPAV", name: "Máy tính xách tay HP Pavilion 14 i5", unit: "Cái", group: "Hàng hóa", stock: 60, minStock: 10, price: 7800000 },
  { code: "LT_DELL", name: "Laptop Dell Ins 15", unit: "Cái", group: "Hàng hóa", stock: 50, minStock: 10, price: 12000000 },
  { code: "MTB_IPAD10", name: "Máy tính bảng iPad Gen 10 64GB", unit: "Cái", group: "Hàng hóa", stock: 75, minStock: 15, price: 5100000 },
  { code: "DH_AWSE", name: "Đồng hồ thông minh Apple Watch SE", unit: "Cái", group: "Hàng hóa", stock: 40, minStock: 10, price: 3600000 },
  { code: "VL_DCD", name: "Dây cáp điện", unit: "Cuộn", group: "Nguyên vật liệu", stock: 200, minStock: 50, price: 1500000 },
  { code: "GXV-001", name: "Ghế xoay văn phòng", unit: "Cái", group: "Công cụ dụng cụ", stock: 30, minStock: 5, price: 800000 },
];

export default function MisaInventoryWorkspace({
  company: _company = { id: "abc", name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC" },
  period: _period = "2026-12",
  tab = "process",
  href,
  notify,
}: MisaInventoryWorkspaceProps) {
  const navigate = useNavigate();
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(_company.id, {
    items: "/api/v1/master-data/items/",
    warehouses: "/api/v1/master-data/warehouses/",
    units: "/api/v1/master-data/units-of-measure/",
    balances: "/api/v1/inventory/balances/",
    transactions: "/api/v1/inventory/transactions/",
    counts: "/api/v1/inventory/counts/",
    countResolutions: "/api/v1/inventory/count-resolutions/",
    assemblies: "/api/v1/inventory/assemblies/",
    productionOrders: "/api/v1/inventory/production-orders/",
    accounts: "/api/v1/general-ledger/accounts/",
    parties: "/api/v1/master-data/parties/",
    goodsSales: "/api/v1/sales/goods-sales/",
    partyAddresses: "/api/v1/master-data/party-addresses/",
  }, notify);
  const apiSave = useMisaApiSave(_company.id, notify, reloadApi);
  const apiStatus = (key: string, id: string, fallback: string) => {
    const record = apiConnected ? apiRows[key]?.find((row) => row.id === id) : undefined;
    return record ? <MisaApiDocumentStatus path="/api/v1/inventory/transactions/" record={record} companyId={_company.id}
      notify={notify} onChanged={reloadApi} /> : fallback;
  };
  // Navigation helper
  const navigateTo = (targetTab: string) => {
    if (href) {
      navigate(href(`/inventory/${targetTab}`));
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
  const [editingOtherReceiptId, setEditingOtherReceiptId] = useState("");
  const [otherReceiptDirty, setOtherReceiptDirty] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!showReceiptModal || !otherReceiptDirty || window.confirm("Bỏ các thay đổi chưa lưu?")) setShowReceiptModal(false);
        setShowIssueModal(false);
        setShowTransferModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReceiptModal, otherReceiptDirty]);
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
  const [issueSaleId, setIssueSaleId] = useState("");
  const [editingIssueId, setEditingIssueId] = useState("");
  const [editingIssueStatus, setEditingIssueStatus] = useState("");
  const [issueDeliveryLocation, setIssueDeliveryLocation] = useState("");
  const { token: apiToken } = useApiSession();
  const [loadedStockAlerts, setStockAlerts] = useState<StockAlerts | null>(null);
  const stockAlerts = loadedStockAlerts?.company_id === _company.id ? loadedStockAlerts : null;
  const [stockAlertsError, setStockAlertsError] = useState("");
  const [stockAlertsLoading, setStockAlertsLoading] = useState(false);
  const [stockAlertsRevision, setStockAlertsRevision] = useState(0);
  const [itemAlertFilter, setItemAlertFilter] = useState<"LOW" | "OUT" | null>(null);
  const reloadStockAlerts = () => setStockAlertsRevision((value) => value + 1);
  const alertUpdatedAt = stockAlerts ? new Date(stockAlerts.updated_at).toLocaleString("vi-VN") : "Chưa tải";

  useEffect(() => {
    if (!apiConnected || !apiToken || !["chart", "items"].includes(tab)) return;
    let active = true;
    setStockAlertsLoading(true);
    request<StockAlerts>(`/api/v1/inventory/balances/alerts/?company_id=${encodeURIComponent(_company.id)}`, apiToken)
      .then((result) => { if (active) { setStockAlerts(result); setStockAlertsError(""); } })
      .catch((error) => { if (active) setStockAlertsError(`Không thể cập nhật cảnh báo tồn kho: ${errorText(error)}`); })
      .finally(() => { if (active) setStockAlertsLoading(false); });
    return () => { active = false; };
  }, [apiConnected, apiToken, _company.id, tab, stockAlertsRevision]);
  const [salePicker, setSalePicker] = useState<SalePickerState | null>(null);
  const [issueSnapshot, setIssueSnapshot] = useState("");
  const [issueFiles, setIssueFiles] = useState<File[]>([]);
  const [issueAttachments, setIssueAttachments] = useState<any[]>([]);
  const [issuePrintTemplate, setIssuePrintTemplate] = useState<string>("FULL");
  const [showIssuePrintMenu, setShowIssuePrintMenu] = useState(false);
  const [partyQuickAdd, setPartyQuickAdd] = useState<null | { code: string; name: string; type: string; address: string; saving: boolean }>(null);
  const [refPicker, setRefPicker] = useState<null | { search: string; target: "issue" | "transfer" }>(null);
  const [issueRows, setIssueRows] = useState<IssueRow[]>([
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
      saleLineId: "",
    },
  ]);
  // AF-10: compare the editable fields with what the form held when it opened.
  const issueFormState = JSON.stringify([issueType, issueVoucherCode, issueVoucherDate, issuePostingDate, issueReason,
    issueCustomerCode, issueCustomerName, issueReceiverName, issueAddress, issueSaleId, issueRefSearch,
    issueRows.map((row) => [row.itemCode, row.warehouse, row.debitAcc, row.creditAcc, row.unit, row.qty, row.price]),
    issueFiles.map((file) => file.name), issueAttachedDocs]);
  useEffect(() => {
    if (showIssueModal) setIssueSnapshot(issueFormState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showIssueModal]);
  const closeIssueModal = () => {
    if (issueFormState !== issueSnapshot && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    setSalePicker(null); setPartyQuickAdd(null); setRefPicker(null); setShowIssuePrintMenu(false); setIssueFiles([]);
    setShowIssueModal(false);
  };
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
      debitAcc: "",
      creditAcc: "",
      unit: "",
      qty: 1,
      price: 0,
      amount: 0,
    },
  ]);
  // UC-INV-05: voucher being edited, attachments, printing, receipt of goods in transit and the dirty check (AF15).
  const [editingTransferId, setEditingTransferId] = useState("");
  const [editingTransferStatus, setEditingTransferStatus] = useState("");
  const [transferRecord, setTransferRecord] = useState<any>(null);
  const [transferInTransit, setTransferInTransit] = useState(false);
  const [transferNote, setTransferNote] = useState("");
  const [showTransferNote, setShowTransferNote] = useState(false);
  const [transferFiles, setTransferFiles] = useState<File[]>([]);
  const [transferAttachments, setTransferAttachments] = useState<any[]>([]);
  const [transferPrintTemplate, setTransferPrintTemplate] = useState<string>("FULL");
  const [showTransferPrintMenu, setShowTransferPrintMenu] = useState(false);
  const [transferSnapshot, setTransferSnapshot] = useState("");
  const [receiveDialog, setReceiveDialog] = useState<null | {
    rows: { line: string; itemCode: string; itemName: string; unit: string; shipped: number; received: number }[];
    accept: boolean; reason: string;
  }>(null);
  const transferFormState = JSON.stringify([transferType, transferVoucherCode, transferVoucherDate, transferPostingDate,
    transferOrderNo, transferOrderDate, transferOrderOwner, transferPurpose, transferReceiverUnitCode, transferReceiverUnitName,
    transferTransporterCode, transferTransporterName, transferTransportContract, transferVehicle, transferSenderName, transferReceiverName,
    transferContractNo, transferAgentCode, transferAgentName, transferExplanation, transferRefSearch, transferInTransit, transferNote,
    transferRows.map((row) => [row.itemCode, row.sourceWarehouse, row.destWarehouse, row.debitAcc, row.creditAcc, row.unit, row.qty, row.price]),
    transferFiles.map((file) => file.name)]);
  useEffect(() => {
    if (showTransferModal) setTransferSnapshot(transferFormState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTransferModal]);
  const [showCalculateCostModal, setShowCalculateCostModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [selectedCountId, setSelectedCountId] = useState("");
  const [showCountResolution, setShowCountResolution] = useState(false);
  const [selectedCountLineId, setSelectedCountLineId] = useState("");
  const [resolutionCause, setResolutionCause] = useState("SURPLUS");
  const [resolutionExplanation, setResolutionExplanation] = useState("");
  const [resolutionQuantity, setResolutionQuantity] = useState(0);
  const [resolutionPrice, setResolutionPrice] = useState(0);
  const [resolutionBasis, setResolutionBasis] = useState("");
  const [resolutionDebit, setResolutionDebit] = useState("");
  const [resolutionCredit, setResolutionCredit] = useState("");
  const [resolutionVoucherDate, setResolutionVoucherDate] = useState("");
  const [selectedResolutionId, setSelectedResolutionId] = useState("");
  const [editingResolutionId, setEditingResolutionId] = useState("");
  const selectedCount = (apiRows.counts || []).find((row: any) => row.id === selectedCountId);
  const selectedCountLine = (selectedCount?.lines || []).find((row: any) => row.id === selectedCountLineId);
  const countResolutions = (apiRows.countResolutions || []).filter((row: any) => row.count === selectedCountId);
  const countLineResolved = (lineId: string) => countResolutions.filter((row: any) => row.count_line === lineId &&
    ["PENDING", "APPROVED", "COMPLETED"].includes(row.status)).reduce((total: number, row: any) => total + apiNumber(row.quantity), 0);
  const openStocktake = (id = "") => {
    setSelectedCountId(id);
    setStocktakeActuals({});
    setShowStocktakeModal(true);
  };
  const openCountResolution = (lineId = "") => {
    setSelectedCountLineId(lineId);
    setSelectedResolutionId("");
    setEditingResolutionId("");
    setResolutionExplanation(""); setResolutionQuantity(0); setResolutionPrice(0); setResolutionBasis("");
    setResolutionCause("SURPLUS"); setResolutionDebit(""); setResolutionCredit("");
    setResolutionVoucherDate(new Date().toISOString().slice(0, 10));
    setShowCountResolution(true);
  };
  const saveResolution = async () => {
    if (!selectedCountLine) { notify("Chọn dòng chênh lệch cần xử lý."); return; }
    const saved = await apiSave(async (writer) => {
      const payload = {
        company: _company.id, count_line: selectedCountLine.id, reason_code: resolutionCause,
        explanation: resolutionExplanation, method: apiNumber(selectedCountLine.variance_quantity) > 0 ? "INCREASE" : "DECREASE",
        quantity: String(resolutionQuantity), proposed_unit_cost: String(resolutionPrice), valuation_basis: resolutionBasis,
      };
      const record = editingResolutionId
        ? await writer.patch(`/api/v1/inventory/count-resolutions/${editingResolutionId}/`, payload)
        : await writer.post("/api/v1/inventory/count-resolutions/", payload);
      return { message: `Đã lưu phương án xử lý ${record.item_code} dưới dạng nháp.` };
    });
    if (saved) { setSelectedCountLineId(""); setEditingResolutionId(""); }
  };
  const runResolutionAction = async (id: string, action: string, body: Record<string, unknown> = {}) => {
    await apiSave(async (writer) => {
      await writer.post(`/api/v1/inventory/count-resolutions/${id}/${action}/`, body);
      return { message: action === "post-voucher" ? "Đã ghi sổ chứng từ và cập nhật kết quả xử lý kiểm kê." : "Đã cập nhật phương án xử lý kiểm kê." };
    });
  };
  const createResolutionVoucher = async (id: string) => {
    await apiSave(async (writer) => {
      const debit = (apiRows.accounts || []).find((row: any) => row.code === resolutionDebit);
      const credit = (apiRows.accounts || []).find((row: any) => row.code === resolutionCredit);
      if (!debit || !credit) throw new Error("Chọn TK Nợ và TK Có từ danh mục tài khoản.");
      const record = await writer.post(`/api/v1/inventory/count-resolutions/${id}/create-voucher/`, {
        number: await nextVoucherNumber(writer, "/api/v1/inventory/transactions/", "DC"),
        transaction_date: resolutionVoucherDate, debit_account: debit.id, credit_account: credit.id,
      });
      return { message: `Đã lập chứng từ ${record.number} (chưa ghi sổ).` };
    });
  };
  const [stocktakeWarehouse, setStocktakeWarehouse] = useState("");
  const [stocktakeDate, setStocktakeDate] = useState(toViDate(toApiDate("")));
  const [stocktakePurpose, setStocktakePurpose] = useState("Kiểm kê định kỳ");
  const [stocktakeActuals, setStocktakeActuals] = useState<Record<string, number>>({});
  const selectedStocktakeWarehouse = stocktakeWarehouse || apiRows.warehouses?.find((row) => row.status === "ACTIVE")?.id || "";
  const stocktakeItems = (apiRows.items || []).filter((item) => item.track_inventory && item.status === "ACTIVE");
  const assemblyCatalog = apiConnected ? (apiRows.items || []).map((item) => ({
    code: item.code, name: item.name, unit: apiUnitName(apiRows.units, item.base_uom),
    price: apiNumber(item.purchase_price),
  })) : SAMPLE_INVENTORY_ITEMS;
  const stocktakeBookQuantity = (itemId: string) => (apiRows.balances || [])
    .filter((balance) => balance.warehouse === selectedStocktakeWarehouse && balance.item === itemId)
    .reduce((sum, balance) => sum + apiNumber(balance.quantity), 0);
  const stocktakeWarehouseOptions = apiConnected ? (apiRows.warehouses || []).map((row) => ({ id: row.id, code: row.code, name: row.name }))
    : SAMPLE_WAREHOUSES.map((row) => ({ id: row.name, code: row.code, name: row.name }));
  const stocktakeDisplayItems = apiConnected ? stocktakeItems.map((row) => ({
    id: row.id, code: row.code, name: row.name, unit: apiUnitName(apiRows.units, row.base_uom), stock: stocktakeBookQuantity(row.id),
  })) : SAMPLE_INVENTORY_ITEMS.slice(0, 4).map((row) => ({ id: row.code, code: row.code, name: row.name, unit: row.unit, stock: row.stock }));
  const handleSaveStocktake = async () => {
    if (!apiConnected) { notify("Cần đăng nhập để lưu biên bản kiểm kê."); return; }
    const saved = await apiSave(async (writer) => {
      if (!selectedStocktakeWarehouse) throw new Error("Chọn kho kiểm kê đang hoạt động.");
      if (!stocktakeItems.length) throw new Error("Chưa có hàng hóa theo dõi tồn kho trong danh mục.");
      const date = toApiDate(stocktakeDate);
      const record = await writer.post("/api/v1/inventory/counts/", {
        number: await nextVoucherNumber(writer, "/api/v1/inventory/counts/", "KK"),
        warehouse: selectedStocktakeWarehouse, count_date: date,
        snapshot_at: `${date}T23:59:59`, notes: stocktakePurpose,
        lines: stocktakeItems.map((item) => ({ item: item.id,
          actual_quantity: String(stocktakeActuals[item.id] ?? stocktakeBookQuantity(item.id)) })),
      });
      return { message: `Đã lưu biên bản kiểm kê ${record.number} dưới dạng dự thảo.` };
    });
    if (saved) { setShowStocktakeModal(false); setStocktakeViewMode("list"); }
  };
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
    { id: "lk-1", itemCode: "", description: "", warehouse: "", qty: 1 },
    { id: "lk-2", itemCode: "", description: "", warehouse: "", qty: 1 },
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
    { id: "tp-1", itemCode: "", itemName: "", unit: "", qty: 1 },
    { id: "tp-2", itemCode: "", itemName: "", unit: "", qty: 1 },
  ]);
  const handleSaveAssembly = async (operation: "ASSEMBLE" | "DISASSEMBLE", andPrint = false) => {
    if (apiConnected) {
      const saved = await apiSave((writer) => saveAssemblyOrder(writer, {
        operation, number: operation === "ASSEMBLE" ? assemblyCode : disassemblyCode,
        date: operation === "ASSEMBLE" ? assemblyDate : disassemblyDate,
        inputRows: operation === "ASSEMBLE" ? assemblyComponentRows : disassemblyGoodRows,
        outputRows: operation === "ASSEMBLE" ? assemblyProductRows : disassemblyOutputRows,
      }));
      if (!saved) return;
      if (operation === "ASSEMBLE") setShowAssemblyModal(false);
      else setShowDisassemblyModal(false);
      if (andPrint) window.print();
      return;
    }
    const isAssemble = operation === "ASSEMBLE";
    const pName = isAssemble ? (assemblyProductRows[0]?.itemName || "Thành phẩm lắp ráp") : (disassemblyOutputRows[0]?.itemName || "Thành phẩm tháo dỡ");
    const pQty = isAssemble ? assemblyProductRows.reduce((sum, r) => sum + (r.qty || 0), 0) : disassemblyOutputRows.reduce((sum, r) => sum + (r.qty || 0), 0);
    const pUnit = isAssemble ? (assemblyProductRows[0]?.unit || "Bộ") : (disassemblyOutputRows[0]?.unit || "Bộ");
    const pAmount = isAssemble ? assemblyProductRows.reduce((sum, r) => sum + (r.amount || 0), 0) : disassemblyGoodRows.reduce((sum, r) => sum + (r.amount || 0), 0);
    const vCode = isAssemble ? (assemblyCode || "LR00001") : (disassemblyCode || "TD00001");
    setAssemblyOrders((prev) => [
      {
        id: `${isAssemble ? "lr" : "td"}-${Date.now()}`,
        code: vCode,
        date: isAssemble ? assemblyDate : disassemblyDate,
        type: isAssemble ? "Lắp ráp" : "Tháo dỡ",
        productName: pName,
        qty: pQty,
        unit: pUnit,
        amount: pAmount,
        status: "Đã ghi sổ",
      },
      ...prev,
    ]);
    if (isAssemble) setShowAssemblyModal(false);
    else setShowDisassemblyModal(false);
    notify(`Đã lưu thành công Lệnh ${isAssemble ? "lắp ráp" : "tháo dỡ"} ${vCode}`);
    if (andPrint) window.print();
  };
  const [showNatureDrawer, setShowNatureDrawer] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedNature, setSelectedNature] = useState<string>("Hàng hóa");
  const [editingItem, setEditingItem] = useState<InventoryItemData | null>(null);

  const handleSelectNature = (_natureId: string, natureName: string) => {
    setShowNatureDrawer(false);
    setSelectedNature(natureName);
    setEditingItem(null);
    setShowItemModal(true);
    notify(`Đã chọn tính chất: ${natureName}. Mở form thêm mới Hàng hóa, dịch vụ.`);
  };

  const handleSaveInventoryItem = async (itemData: InventoryItemData, keepOpen?: boolean) => {
    if (apiConnected) {
      const original = editingItem && apiRows.items?.find((row) => row.id === editingItem.id);
      if (editingItem && !original) { notify("Không tìm thấy hàng hóa trong danh mục hiện hành. Vui lòng tải lại."); return false; }
      const saved = await apiSave((writer) => saveItem(writer, {
        ...itemData, recordId: original?.id, version: original?.version,
      }));
      if (saved) reloadStockAlerts();
      if (saved && !keepOpen) setShowItemModal(false);
      return saved;
    }
    if (editingItem) {
      setCatalogItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? { ...it, ...itemData } : it))
      );
      notify(`Đã cập nhật hàng hóa, dịch vụ [${itemData.code}] ${itemData.name}!`);
    } else {
      setCatalogItems((prev) => [
        {
          id: `item-${Date.now()}`,
          ...itemData,
        },
        ...prev,
      ]);
      notify(`Đã thêm mới [${itemData.code}] ${itemData.name} (${itemData.nature}) thành công!`);
    }
    if (!keepOpen) {
      setShowItemModal(false);
      setEditingItem(null);
    }
  };
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

  // Catalog items data (exact match to screenshot)
  const [catalogItems, setCatalogItems] = useState<InventoryItemData[]>([
    {
      id: "cpmh",
      name: "Chi phí mua hàng",
      code: "CPMH",
      vatPolicy: "Chưa xác định",
      nature: "Dịch vụ",
      stockQty: 0.0,
      stockValue: 0,
      unit: "Lần",
    },
    {
      id: "hh0002",
      name: "Hàng hóa mới",
      code: "HH0002",
      vatPolicy: "Chưa xác định",
      nature: "Hàng hóa",
      stockQty: 0.0,
      stockValue: 0,
      unit: "Cái",
    },
    {
      id: "hh0003",
      name: "Hàng hóa mới",
      code: "HH0003",
      vatPolicy: "Chưa xác định",
      nature: "Hàng hóa",
      stockQty: 0.0,
      stockValue: 0,
      unit: "Cái",
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
  const [stocktakes, setStocktakes] = useState([
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

  useEffect(() => {
    if (!apiConnected) return;
    const warehouseName = (id: string) => apiRows.warehouses?.find((warehouse) => warehouse.id === id)?.name || "";
    const outputLine = (row: any) => row.lines?.find((line: any) => line.role === "OUTPUT");
    const itemName = (id: string) => apiRows.items?.find((item) => item.id === id)?.name || "";
    if (apiRows.items) setCatalogItems(apiRows.items.map((row) => ({
      id: row.id, code: row.code || "", name: row.name || "",
      vatPolicy: "", nature: row.item_type || "Hàng hóa",
      stockQty: apiRows.balances?.filter((balance) => balance.item === row.id)
        .reduce((total, balance) => total + apiNumber(balance.quantity), 0) || 0,
      stockValue: apiRows.balances?.filter((balance) => balance.item === row.id)
        .reduce((total, balance) => total + apiNumber(balance.inventory_value), 0) || 0,
      unit: apiUnitName(apiRows.units, row.base_uom),
      minStockQty: row.min_stock ?? 0,
    })));
    if (apiRows.transactions) {
      const transactionRows = apiRows.transactions;
      const common = (row: any) => ({
        id: row.id, code: row.number || "", date: apiDate(row.transaction_date),
        description: row.reason || "", amount: apiNumber(row.total_value), status: row.status || "",
      });
      setReceipts(transactionRows.filter((row) => row.transaction_type === "RECEIPT").map((row) => ({
        ...common(row), amount: row.source_module === "INV_OTHER" && row.status !== "POSTED"
          ? (row.lines || []).reduce((sum: number, line: any) => sum + apiNumber(line.line_value), 0) : apiNumber(row.total_value),
        type: row.source_module === "INV_OTHER" ? "Nhập kho khác" : row.business_type || "Nhập kho",
        warehouse: row.destination_warehouse_name || "", partner: row.supplier_name || "",
      })));
      setIssues(transactionRows.filter((row) => row.transaction_type === "ISSUE").map((row) => ({
        ...common(row), type: row.source_module === "INV_OTHER_ISSUE" ? "Xuất kho khác" : row.source_module === "INV_SALE_ISSUE" ? "Xuất kho bán hàng" : row.business_type || "Xuất kho",
        warehouse: row.source_warehouse_name || "", partner: row.supplier_name || "",
      })));
      setTransfers(transactionRows.filter((row) => row.transaction_type === "TRANSFER").map((row) => ({
        ...common(row), sourceWarehouse: row.source_warehouse_name || "",
        destWarehouse: row.destination_warehouse_name || "",
      })));
    }
    if (apiRows.counts) setStocktakes(apiRows.counts.map((row) => ({
      id: row.id, code: row.number || "", date: apiDate(row.count_date),
      warehouse: warehouseName(row.warehouse), purpose: row.notes || "",
      difference: (row.lines || []).reduce((total: number, line: any) => total + apiNumber(line.variance_quantity), 0),
      status: row.status || "",
    })));
    if (apiRows.productionOrders) setProductionOrders(apiRows.productionOrders.map((row) => {
      const product = (row.lines || []).find((line: any) => line.role === "PRODUCT");
      const labels: Record<string, string> = { PLANNED: "Chưa thực hiện", IN_PROGRESS: "Đang thực hiện", COMPLETED: "Hoàn thành", CANCELLED: "Đã hủy" };
      return { id: row.id, code: row.number, date: apiDate(row.document_date), productName: product?.item_name || "",
        qty: apiNumber(product?.quantity), unit: "", dept: row.description || "", status: labels[row.status] || row.status, dueDate: apiDate(row.due_date) };
    }));
    if (apiRows.assemblies) setAssemblyOrders(apiRows.assemblies.map((row) => ({
      id: row.id, code: row.number || "", date: apiDate(row.assembly_date),
      type: row.operation === "DISASSEMBLE" ? "Tháo dỡ" : "Lắp ráp",
      productName: itemName(outputLine(row)?.item), qty: apiNumber(outputLine(row)?.quantity), unit: "",
      amount: 0, status: row.status || "",
    })));
  }, [apiRows, apiConnected]);

  const openOtherReceipt = (id?: string) => {
    setOtherReceiptDirty(false);
    const record = id ? apiRows.transactions?.find((row: any) => row.id === id) : null;
    setEditingOtherReceiptId(record?.source_module === "INV_OTHER" ? record.id : "");
    if (record?.source_module === "INV_OTHER") {
      setReceiptType("3. Khác (NVL thừa, HH thuê gia công, ...)");
      setReceiptVoucherCode(record.number || "");
      setReceiptVoucherDate(toViDate(record.document_date || record.transaction_date));
      setReceiptPostingDate(toViDate(record.transaction_date));
      setReceiptReason(record.reason || "");
      setReceiptDeliveryPersonName(record.delivery_person || "");
      const party = apiRows.parties?.find((row: any) => row.id === record.supplier);
      setReceiptCustomerCode(party?.code || "");
      setReceiptCustomerName(party?.name || "");
      setReceiptRows((record.lines || []).map((line: any) => {
        const item = apiRows.items?.find((row: any) => row.id === line.item);
        const uom = apiRows.units?.find((row: any) => row.id === line.uom);
        const warehouse = apiRows.warehouses?.find((row: any) => row.id === record.destination_warehouse);
        return { id: line.id, itemCode: item?.code || "", itemName: item?.name || "", warehouse: warehouse?.name || "",
          debitAcc: apiRows.accounts?.find((row: any) => row.id === line.debit_account)?.code || "",
          creditAcc: apiRows.accounts?.find((row: any) => row.id === line.credit_account)?.code || "",
          unit: uom?.name || "", qty: Number(line.quantity), price: Number(line.unit_cost) * Number(line.conversion_factor || 1), amount: Number(line.line_value), prodOrder: "", costObject: "" };
      }));
    } else if (!id) {
      const today = toViDate(toApiDate(new Date().toISOString()));
      const used = (apiRows.transactions || []).map((row: any) => String(row.number || ""));
      const next = Math.max(0, ...used.map((code: string) => /^NK\d+$/.test(code) ? Number(code.slice(2)) : 0)) + 1;
      setReceiptType("3. Khác (NVL thừa, HH thuê gia công, ...)");
      setReceiptVoucherCode(`NK${String(next).padStart(5, "0")}`);
      setReceiptVoucherDate(today);
      setReceiptPostingDate(today);
      setReceiptReason("Nhập kho khác");
      setReceiptDeliveryPersonName("");
      setReceiptCustomerCode("");
      setReceiptCustomerName("");
      setReceiptRows([{ id: `row-${Date.now()}`, itemCode: "", itemName: "", warehouse: "", debitAcc: "", creditAcc: "", unit: "", qty: 1, price: 0, amount: 0, prodOrder: "", costObject: "" }]);
    }
    setShowReceiptModal(true);
  };

  // Handle Save Receipt
  const handleSaveReceipt = async (data: any) => {
    if (apiConnected) {
      if (editingOtherReceiptId && apiRows.transactions?.find((row: any) => row.id === editingOtherReceiptId)?.status !== "DRAFT") {
        notify("Chỉ phiếu nháp mới được sửa.");
        return false;
      }
      const saved = await apiSave((writer) => (receiptType.startsWith("3.") || !!editingOtherReceiptId)
        ? saveOtherInventoryReceipt(writer, { ...data, id: editingOtherReceiptId })
        : saveInventoryTransaction(writer, "receipt", data));
      if (saved) setShowReceiptModal(false);
      return saved;
    }
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
  const openNewIssue = () => {
    setEditingIssueId(""); setEditingIssueStatus(""); setIssueSaleId(""); setIssueRefSearch(""); setSalePicker(null);
    setIssueType("1. Bán hàng"); setIssueReason("Xuất kho bán hàng");
    setIssueCustomerCode(""); setIssueCustomerName(""); setIssueAddress(""); setIssueReceiverName(""); setIssueAttachedDocs("");
    setIssueFiles([]); setIssueAttachments([]); setShowIssuePrintMenu(false);
    // Step 13: suggest the next number of the XK series; the backend still rejects a duplicate (EF-06).
    const highest = [...(apiRows.transactions || []).map((row: any) => String(row.number || "")), ...issues.map((row) => String(row.code || ""))]
      .filter((number) => /^XK\d+$/.test(number)).reduce((max, number) => Math.max(max, Number(number.slice(2))), 0);
    setIssueVoucherCode(`XK${String(highest + 1).padStart(5, "0")}`);
    const today = toViDate(new Date().toISOString().slice(0, 10));
    setIssueVoucherDate(today); setIssuePostingDate(`${today} 12:00:00`);
    setIssueRows([{ id: "row-1", saleLineId: "", itemCode: "", itemName: "", warehouse: "", debitAcc: "632", creditAcc: "",
      unit: "", qty: 1, price: 0, amount: 0, prodOrder: "", product: "" }]);
    setShowIssueModal(true);
  };
  /** UC-INV-03 steps 5-8: posted sale documents still waiting for stock to be issued, with issued / remaining quantities. */
  const fetchSaleSources = (filters: { number?: string; customer?: string; from?: string; to?: string; includeCompleted?: boolean }) => {
    const params = new URLSearchParams({ company_id: _company.id });
    if (filters.number?.trim()) params.set("search", filters.number.trim());
    if (filters.customer?.trim()) params.set("customer", filters.customer.trim());
    if (filters.from) params.set("date_from", filters.from);
    if (filters.to) params.set("date_to", filters.to);
    if (filters.includeCompleted) params.set("include_completed", "true");
    return request<any[]>(`/api/v1/inventory/transactions/sale-sources/?${params}`, apiToken);
  };
  const searchSaleSources = async (state: SalePickerState) => {
    setSalePicker({ ...state, loading: true });
    try {
      const rows = await fetchSaleSources(state);
      const first = rows[0];
      setSalePicker({ ...state, rows, searched: true, loading: false, saleId: first?.id || "",
        lineIds: first ? first.lines.filter((line: any) => Number(line.remaining_quantity) > 0).map((line: any) => line.id) : [] });
    } catch (error) {
      notify(`Không tải được chứng từ bán hàng: ${errorText(error)}`);
      setSalePicker({ ...state, loading: false });
    }
  };
  const openSalePicker = () => {
    if (!apiConnected) { notify("Cần đăng nhập và chọn doanh nghiệp để tìm chứng từ bán hàng."); return; }
    if (editingIssueStatus && !["DRAFT", "REJECTED"].includes(editingIssueStatus)) return;
    if (editingIssueId && issueSaleId) { notify("Không thể đổi chứng từ bán hàng tham chiếu của phiếu đã lưu."); return; }
    searchSaleSources({ number: issueRefSearch, customer: "", from: "", to: "", rows: [], searched: false, loading: false, saleId: "", lineIds: [] });
  };
  const warehouseByName = (name: string) => (apiRows.warehouses || []).find((row: any) => row.name === name || row.code === name);
  const itemByCode = (code: string) => (apiRows.items || []).find((row: any) => String(row.code).toLowerCase() === String(code).toLowerCase());
  const availableStock = (itemId?: string, warehouseId?: string) => (apiRows.balances || [])
    .filter((row: any) => row.item === itemId && row.warehouse === warehouseId)
    .reduce((sum: number, row: any) => sum + Number(row.available_quantity ?? row.quantity ?? 0), 0);
  const averageCost = (itemId?: string, warehouseId?: string) =>
    Number((apiRows.balances || []).find((row: any) => row.item === itemId && row.warehouse === warehouseId)?.average_cost || 0);
  /** Step 9: copy the customer, the reference and the chosen sale lines into the voucher. */
  const applySaleSelection = (sale: any, lineIds: string[]) => {
    const rows: IssueRow[] = (sale.lines || []).filter((line: any) => lineIds.includes(line.id) && Number(line.remaining_quantity) > 0)
      .map((line: any) => {
        const remaining = Number(line.remaining_quantity);
        const warehouseId = line.warehouse || (apiRows.balances || []).find((row: any) => row.item === line.item
          && Number(row.available_quantity ?? row.quantity) >= remaining)?.warehouse || "";
        const price = averageCost(line.item, warehouseId);
        return { id: `sale-${line.id}`, saleLineId: line.id, itemCode: line.item_code, itemName: line.item_name,
          warehouse: (apiRows.warehouses || []).find((row: any) => row.id === warehouseId)?.name || "",
          debitAcc: line.cogs_account_code || "632", creditAcc: line.inventory_account_code || "", unit: line.uom_name || "",
          qty: remaining, price, amount: remaining * price, prodOrder: "", product: "",
          soldQty: Number(line.quantity), issuedQty: Number(line.issued_quantity), remaining };
      });
    if (!rows.length) { notify("Vui lòng chọn ít nhất một vật tư/hàng hóa để xuất kho"); return false; }
    setIssueSaleId(sale.id); setIssueRefSearch(sale.number);
    setIssueCustomerCode(sale.customer_code || ""); setIssueCustomerName(sale.customer_name || ""); setIssueAddress(sale.customer_address || "");
    setIssueReason(`Xuất kho hàng hóa bán cho ${sale.customer_name} theo chứng từ ${sale.number}`);
    setIssueRows(rows);
    return true;
  };
  const openIssueRecord = (id: string) => {
    const record = (apiRows.transactions || []).find((entry: any) => entry.id === id);
    if (!record) { setShowIssueModal(true); return; }
    setSalePicker(null);
    setEditingIssueId(record.id); setEditingIssueStatus(record.status);
    setIssueType(record.source_module === "INV_OTHER_ISSUE" ? "3. Khác (Xuất sử dụng, góp vốn, ...)" : "1. Bán hàng");
    setIssueVoucherCode(record.number || "");
    setIssueVoucherDate(toViDate(record.document_date || record.transaction_date));
    setIssuePostingDate(`${toViDate(record.transaction_date)} 12:00:00`);
    setIssueReason(record.reason || ""); setIssueReceiverName(record.delivery_person || "");
    setIssueRefSearch(record.source_module === "INV_SALE_ISSUE"
      ? (apiRows.goodsSales || []).find((sale: any) => sale.id === record.source_reference)?.number || ""
      : record.source_reference || "");
    setIssueSaleId(record.source_module === "INV_SALE_ISSUE" ? record.source_reference : "");
    const party = (apiRows.parties || []).find((entry: any) => entry.id === record.supplier);
    setIssueCustomerCode(party?.code || ""); setIssueCustomerName(record.document_metadata?.partner_name || party?.name || "");
    setIssueAddress(record.document_metadata?.partner_address || "");
    setIssueAttachedDocs(record.document_metadata?.attached_documents || "");
    setIssueAttachments(record.document_metadata?.attachments || []); setIssueFiles([]); setShowIssuePrintMenu(false);
    setIssueRows((record.lines || []).map((entry: any, index: number) => {
      const item = (apiRows.items || []).find((row: any) => row.id === entry.item);
      const warehouse = (apiRows.warehouses || []).find((row: any) => row.id === (entry.source_warehouse || record.source_warehouse));
      const debit = (apiRows.accounts || []).find((row: any) => row.id === entry.debit_account);
      const credit = (apiRows.accounts || []).find((row: any) => row.id === entry.credit_account);
      return { id: entry.id || `row-${index}`, saleLineId: entry.sale_line || "", itemCode: item?.code || "", itemName: item?.name || "",
        warehouse: warehouse?.name || "", debitAcc: debit?.code || "", creditAcc: credit?.code || "",
        unit: apiUnitName(apiRows.units, entry.uom), qty: Number(entry.quantity || 0), price: Number(entry.unit_cost || 0),
        amount: Number(entry.line_value || 0), prodOrder: "", product: "" };
    }));
    if (record.source_module === "INV_SALE_ISSUE") {
      // Show sold / issued / remaining of the referenced sale next to each line.
      fetchSaleSources({ includeCompleted: true }).then((sales) => {
        const sale = sales.find((entry: any) => entry.id === record.source_reference);
        if (!sale) return;
        setIssueRefSearch(sale.number);
        setIssueRows((rows) => rows.map((row) => {
          const line = sale.lines.find((entry: any) => entry.id === row.saleLineId);
          return line ? { ...row, soldQty: Number(line.quantity), issuedQty: Number(line.issued_quantity), remaining: Number(line.remaining_quantity) } : row;
        }));
      }).catch(() => undefined);
    }
    setShowIssueModal(true);
  };
  // UC-INV-04 helpers: form data, object lookup, attachments and printing of the issue voucher.
  const otherIssueMode = apiConnected && issueType.startsWith("3.");
  const issueReadOnly = Boolean(editingIssueStatus && !["DRAFT", "REJECTED"].includes(editingIssueStatus));
  const issueLocked = ["POSTED", "PENDING_APPROVAL", "CANCELLED", "REVERSED"].includes(editingIssueStatus);
  const issueFormData = () => ({
    id: editingIssueId, code: issueVoucherCode, lines: issueRows, date: issueVoucherDate, postingDate: issuePostingDate,
    partnerCode: issueCustomerCode, partnerName: issueCustomerName, partnerAddress: issueAddress,
    attachedDocuments: issueAttachedDocs, saleId: issueSaleId, saleMode: issueType.startsWith("1."),
    deliveryPerson: issueReceiverName, reference: issueRefSearch,
    warehouse: issueRows[0]?.warehouse || "Kho tổng Minh An",
    partner: issueReceiverName || issueCustomerName || "Khách hàng mua hàng",
    // EF05: the other-issue reason is required, so it is never filled in behind the user's back.
    description: otherIssueMode ? issueReason : issueReason || `Xuất kho theo chứng từ ${issueVoucherCode}`,
    amount: issueRows.reduce((sum, row) => sum + (row.amount || 0), 0),
  });
  /** Step 4: an object picked from the catalogue fills its name and default address. */
  const selectIssueParty = (code: string) => {
    setIssueCustomerCode(code);
    const party = (apiRows.parties || []).find((row: any) => String(row.code).toLowerCase() === code.trim().toLowerCase());
    if (!party) return;
    setIssueCustomerName(party.name || "");
    const addresses = (apiRows.partyAddresses || []).filter((row: any) => row.party === party.id && row.status !== "INACTIVE");
    const address = addresses.find((row: any) => row.is_default) || addresses[0];
    if (address) setIssueAddress(address.address_line || "");
  };
  /** AF01: create the object from the voucher and use it right away. */
  const saveQuickParty = async () => {
    if (!partyQuickAdd) return;
    const code = partyQuickAdd.code.trim(); const name = partyQuickAdd.name.trim();
    if (!code) { notify("Vui lòng nhập Mã đối tượng."); return; }
    if (!name) { notify("Vui lòng nhập Tên đối tượng."); return; }
    setPartyQuickAdd({ ...partyQuickAdd, saving: true });
    const saved = await apiSave(async (writer) => {
      const party = await writer.post("/api/v1/master-data/parties/", { code, name, party_type: partyQuickAdd.type, status: "ACTIVE" });
      if (partyQuickAdd.address.trim()) {
        await writer.post("/api/v1/master-data/party-addresses/", { party: party.id, address_type: "MAIN", address_line: partyQuickAdd.address.trim(), is_default: true });
      }
      return { message: `Đã thêm đối tượng ${code} - ${name}.` };
    });
    if (!saved) { setPartyQuickAdd((state) => state && { ...state, saving: false }); return; }
    setIssueCustomerCode(code); setIssueCustomerName(name); setIssueAddress(partyQuickAdd.address.trim());
    setPartyQuickAdd(null);
  };
  const addVoucherFiles = (list: FileList | null, setFiles: (update: (files: File[]) => File[]) => void) => {
    const files = Array.from(list || []);
    const tooBig = files.filter((file) => file.size > ATTACHMENT_MAX_SIZE);
    const unsupported = files.filter((file) => file.size <= ATTACHMENT_MAX_SIZE && !ATTACHMENT_PATTERN.test(file.name));
    if (tooBig.length) notify(`Dung lượng tệp đính kèm vượt quá 5 MB. (${tooBig.map((file) => file.name).join(", ")})`);
    if (unsupported.length) notify(`Định dạng tệp đính kèm không được hỗ trợ: ${unsupported.map((file) => file.name).join(", ")}`);
    const accepted = files.filter((file) => file.size <= ATTACHMENT_MAX_SIZE && ATTACHMENT_PATTERN.test(file.name));
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
  };
  const downloadAttachment = async (transactionId: string, entry: any) => {
    try {
      const response = await fetch(`/api/v1/inventory/transactions/${transactionId}/attachments/${entry.id}/?company_id=${encodeURIComponent(_company.id)}`,
        { headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = entry.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify(`Không tải được tệp ${entry.name}: ${errorText(error)}`);
    }
  };
  const removeAttachment = async (transactionId: string, entry: any, setAttachments: (rows: any[]) => void) => {
    if (!window.confirm(`Xóa tệp đính kèm ${entry.name}?`)) return;
    await apiSave(async (writer) => {
      const record = await writer.action("/api/v1/inventory/transactions/", transactionId, `attachments/${entry.id}/remove`);
      setAttachments(record.document_metadata?.attachments || []);
      return { message: `Đã xóa tệp đính kèm ${entry.name}.` };
    });
  };
  /** AF12/AF13: print the saved voucher with the official values returned by the backend. */
  const printIssueVoucher = (record: any, template: string) => {
    const withPrice = template !== "NO_PRICE";
    const accountCode = (id: string) => (apiRows.accounts || []).find((row: any) => row.id === id)?.code || "";
    const lines = (record.lines || []).map((line: any, index: number) => {
      const item = (apiRows.items || []).find((row: any) => row.id === line.item);
      const quantity = Number(line.quantity || 0);
      return { no: index + 1, name: item?.name || "", code: item?.code || "", unit: apiUnitName(apiRows.units, line.uom), quantity,
        price: Number(line.unit_cost || 0) * Number(line.conversion_factor || 1), amount: Number(line.line_value || 0) };
    });
    const total = lines.reduce((sum: number, line: any) => sum + line.amount, 0);
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].join(", ");
    const warehouses = unique((record.lines || []).map((line: any) =>
      (apiRows.warehouses || []).find((row: any) => row.id === (line.source_warehouse || record.source_warehouse))?.name || ""));
    const [year, month, day] = String(record.document_date || record.transaction_date || "").split("-");
    const metadata = record.document_metadata || {};
    const party = (apiRows.parties || []).find((row: any) => row.id === record.supplier);
    const cell = "border:1px solid #000;padding:4px 6px";
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu xuất kho ${escapeHtml(record.number)}</title>
<style>body{font-family:"Times New Roman",serif;font-size:13px;color:#000;margin:24px}table{border-collapse:collapse;width:100%}
.num{text-align:right}.center{text-align:center}h1{font-size:18px;margin:4px 0}.muted{font-style:italic}</style></head><body>
<table><tr><td><strong>${escapeHtml(_company.name)}</strong></td><td class="center" style="width:260px"><strong>Mẫu số 02 - VT</strong></td></tr></table>
<div class="center"><h1>PHIẾU XUẤT KHO</h1><div class="muted">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
<div>Số: <strong>${escapeHtml(record.number)}</strong></div>
<div>Nợ: ${escapeHtml(unique((record.lines || []).map((line: any) => accountCode(line.debit_account))))} &nbsp; Có: ${escapeHtml(unique((record.lines || []).map((line: any) => accountCode(line.credit_account))))}</div></div>
<p>- Họ và tên người nhận hàng: ${escapeHtml(record.delivery_person)}<br>
- Đối tượng: ${escapeHtml(metadata.partner_name || party?.name || "")} &nbsp; Địa chỉ (bộ phận): ${escapeHtml(metadata.partner_address)}<br>
- Lý do xuất kho: ${escapeHtml(record.reason)}<br>
- Xuất tại kho (ngăn lô): ${escapeHtml(warehouses)}</p>
<table><thead><tr><th style="${cell}">STT</th><th style="${cell}">Tên, nhãn hiệu, quy cách vật tư, hàng hóa</th><th style="${cell}">Mã số</th><th style="${cell}">ĐVT</th>
<th style="${cell}">Số lượng yêu cầu</th><th style="${cell}">Số lượng thực xuất</th>${withPrice ? `<th style="${cell}">Đơn giá</th><th style="${cell}">Thành tiền</th>` : ""}</tr></thead><tbody>
${lines.map((line: any) => `<tr><td style="${cell}" class="center">${line.no}</td><td style="${cell}">${escapeHtml(line.name)}</td><td style="${cell}">${escapeHtml(line.code)}</td>
<td style="${cell}" class="center">${escapeHtml(line.unit)}</td><td style="${cell}" class="num">${line.quantity}</td><td style="${cell}" class="num">${line.quantity}</td>
${withPrice ? `<td style="${cell}" class="num">${formatVND(line.price)}</td><td style="${cell}" class="num">${formatVND(line.amount)}</td>` : ""}</tr>`).join("")}
${withPrice ? `<tr><td style="${cell}" colspan="7"><strong>Cộng</strong></td><td style="${cell}" class="num"><strong>${formatVND(total)}</strong></td></tr>` : ""}
</tbody></table>
${withPrice ? `<p>- Tổng số tiền (viết bằng chữ): <em>${escapeHtml(convertNumberToVietnameseWords(Math.round(total)))}</em></p>` : ""}
<p>- Số chứng từ gốc kèm theo: ${escapeHtml(metadata.attached_documents)}</p>
<table style="margin-top:24px"><tr class="center">${["Người lập phiếu", "Người nhận hàng", "Thủ kho", "Kế toán trưởng", "Giám đốc"]
      .map((title) => `<td class="center"><strong>${title}</strong><br><span class="muted">(Ký, họ tên)</span></td>`).join("")}</tr></table>
</body></html>`;
    openPrintFrame(html, `In phiếu xuất kho ${record.number}`, () => notify("Trình duyệt chặn lệnh in. Vui lòng thử lại."));
  };
  const handleSaveIssue = async (data: any, post = false, printTemplate?: string) => {
    setShowIssuePrintMenu(false);
    if (apiConnected) {
      let outcome: { record?: any; posted?: boolean; uploaded?: number } | null = null;
      const saved = await apiSave(async (writer) => {
        if (!(issueType.startsWith("3.") || issueType.startsWith("1."))) return saveInventoryTransaction(writer, "issue", data);
        const result = await saveOtherInventoryIssue(writer, { ...data, status: editingIssueStatus, files: issueFiles }, post);
        outcome = result;
        return result;
      });
      const result = outcome as { record?: any; posted?: boolean; uploaded?: number } | null;
      const uploaded = result?.uploaded || 0;
      if (result?.record) setIssueAttachments(result.record.document_metadata?.attachments || issueAttachments);
      if (uploaded) setIssueFiles((files) => files.slice(uploaded));
      const uploadFailed = uploaded < issueFiles.length;
      if (saved && result?.record && (uploadFailed || post && !result.posted && result.record.status !== "PENDING_APPROVAL")) {
        // Saved but not posted (or a file was refused): keep the voucher open so the user can correct it and retry.
        setEditingIssueId(result.record.id); setEditingIssueStatus(result.record.status); setIssueSnapshot(issueFormState);
        return saved;
      }
      if (saved && printTemplate && result?.record) printIssueVoucher(result.record, printTemplate);
      if (saved) { setShowIssueModal(false); setSalePicker(null); setEditingIssueId(""); setEditingIssueStatus(""); setIssueFiles([]); }
      return saved;
    }
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
  // UC-INV-05 helpers: new/open voucher, party lookups, save + post, printing and receipt of goods in transit.
  const transferKind = TRANSFER_KIND_CODES[transferType] || "INTERNAL";
  const transferReadOnly = Boolean(editingTransferStatus && !["DRAFT", "REJECTED"].includes(editingTransferStatus));
  const transferLocked = ["POSTED", "PENDING_APPROVAL", "CANCELLED", "REVERSED"].includes(editingTransferStatus);
  const transferReceipt: string = transferRecord?.document_metadata?.receipt_status || "";
  const emptyTransferRow = (kind = transferKind) => ({
    id: `row-${Date.now()}-${Math.round(Math.random() * 1e6)}`, itemCode: "", itemName: "", sourceWarehouse: "", sourceWarehouseAddress: "",
    destWarehouse: "", destWarehouseAddress: "", debitAcc: kind === "CONSIGNMENT" ? "157" : "", creditAcc: "", unit: "", qty: 1, price: 0, amount: 0,
  });
  /** BR05/BR21: internal transfers stay between physical warehouses; goods for an agent go to a consignment store. */
  const transferWarehouses = (role: "source" | "destination") => (apiRows.warehouses || []).filter((row: any) =>
    row.status === "ACTIVE" && row.allow_transfer !== false && row.warehouse_type !== "TRANSIT"
    && (role === "source" ? row.warehouse_type !== "CONSIGNMENT" : (row.warehouse_type === "CONSIGNMENT") === (transferKind === "CONSIGNMENT")));
  const warehouseAddress = (name: string) => {
    const warehouse = warehouseByName(name);
    return warehouse ? String(warehouse.address || warehouse.address_line || "") : "";
  };
  /** Step 4: a code from the catalogue fills the name (and tax code) beside it. */
  const lookupTransferParty = (code: string, setCode: (value: string) => void, setName: (value: string) => void, setTax?: (value: string) => void) => {
    setCode(code);
    const party = (apiRows.parties || []).find((row: any) => String(row.code).toLowerCase() === code.trim().toLowerCase());
    if (!party) return;
    setName(party.name || "");
    setTax?.(party.tax_code || "");
  };
  const resetTransferForm = () => {
    setTransferOrderNo(""); setTransferOrderDate(""); setTransferOrderOwner(""); setTransferPurpose("");
    setTransferReceiverUnitCode(""); setTransferReceiverUnitName(""); setTransferReceiverUnitTax("");
    setTransferTransporterCode(""); setTransferTransporterName(""); setTransferTransportContract(""); setTransferVehicle("");
    setTransferSenderName(""); setTransferReceiverName(""); setTransferRefSearch(""); setTransferInvoiceForm(""); setTransferInvoiceSymbol("");
    setTransferIsReplacementInvoice(false); setTransferContractNo(""); setTransferContractDate(""); setTransferContractOwner("");
    setTransferAgentCode(""); setTransferAgentName(""); setTransferAgentTax(""); setTransferExplanation("");
    setTransferInTransit(false); setTransferNote(""); setShowTransferNote(false); setTransferFiles([]); setTransferAttachments([]);
    setShowTransferPrintMenu(false); setReceiveDialog(null);
  };
  const openNewTransfer = () => {
    resetTransferForm();
    setEditingTransferId(""); setEditingTransferStatus(""); setTransferRecord(null);
    setTransferType("Xuất kho kiêm vận chuyển nội bộ");
    // Step 7: suggest the next number of the CK series; the backend still rejects a duplicate (EF02).
    const highest = [...(apiRows.transactions || []).map((row: any) => String(row.number || "")), ...transfers.map((row) => String(row.code || ""))]
      .filter((number) => /^CK\d+$/.test(number)).reduce((max, number) => Math.max(max, Number(number.slice(2))), 0);
    setTransferVoucherCode(`CK${String(highest + 1).padStart(5, "0")}`);
    const today = toViDate(new Date().toISOString().slice(0, 10));
    setTransferVoucherDate(today); setTransferPostingDate(`${today} 12:00:00`);
    setTransferRows([emptyTransferRow("TRANSPORT")]);
    setShowTransferModal(true);
  };
  const openTransferRecord = (id: string) => {
    const record = (apiRows.transactions || []).find((entry: any) => entry.id === id);
    if (!record) { setShowTransferModal(true); return; }
    resetTransferForm();
    const metadata = record.document_metadata || {};
    const kind = metadata.transfer_kind || "INTERNAL";
    setEditingTransferId(record.id); setEditingTransferStatus(record.status); setTransferRecord(record);
    setTransferType((Object.entries(TRANSFER_KIND_CODES).find(([, code]) => code === kind)?.[0] || "Xuất chuyển kho nội bộ") as typeof transferType);
    setTransferVoucherCode(record.number || "");
    setTransferVoucherDate(toViDate(record.document_date || record.transaction_date));
    setTransferPostingDate(`${toViDate(record.transaction_date)} 12:00:00`);
    setTransferOrderNo(metadata.order_no || ""); setTransferOrderDate(metadata.order_date || ""); setTransferOrderOwner(metadata.order_owner || "");
    setTransferPurpose(kind === "TRANSPORT" ? record.reason || "" : metadata.purpose || "");
    setTransferExplanation(kind === "TRANSPORT" ? metadata.explanation || "" : record.reason || "");
    setTransferReceiverUnitCode(metadata.receiver_unit_code || ""); setTransferReceiverUnitName(metadata.receiver_unit_name || "");
    setTransferReceiverUnitTax(metadata.receiver_unit_tax || ""); setTransferTransporterCode(metadata.transporter_code || "");
    setTransferTransporterName(record.delivery_person || metadata.transporter_name || ""); setTransferTransportContract(metadata.transport_contract || "");
    setTransferVehicle(metadata.vehicle || ""); setTransferSenderName(metadata.sender_name || ""); setTransferReceiverName(metadata.receiver_name || "");
    setTransferContractNo(metadata.contract_no || ""); setTransferContractDate(metadata.contract_date || ""); setTransferContractOwner(metadata.contract_owner || "");
    setTransferAgentCode(metadata.agent_code || ""); setTransferAgentName(metadata.agent_name || ""); setTransferAgentTax(metadata.agent_tax || "");
    setTransferInvoiceForm(metadata.invoice_form || ""); setTransferInvoiceSymbol(metadata.invoice_symbol || "");
    setTransferRefSearch(record.source_reference || ""); setTransferInTransit(Boolean(metadata.in_transit));
    setTransferNote(metadata.notes || ""); setShowTransferNote(Boolean(metadata.notes)); setTransferAttachments(metadata.attachments || []);
    setTransferRows((record.lines || []).map((line: any, index: number) => {
      const item = (apiRows.items || []).find((row: any) => row.id === line.item);
      const source = (apiRows.warehouses || []).find((row: any) => row.id === (line.source_warehouse || record.source_warehouse));
      const destination = (apiRows.warehouses || []).find((row: any) => row.id === (line.destination_warehouse || record.destination_warehouse));
      const account = (accountId: string) => (apiRows.accounts || []).find((row: any) => row.id === accountId)?.code || "";
      const price = Number(line.unit_cost || 0) * Number(line.conversion_factor || 1);
      return { id: line.id || `row-${index}`, itemCode: item?.code || "", itemName: item?.name || "",
        sourceWarehouse: source?.name || "", sourceWarehouseAddress: String(source?.address || ""),
        destWarehouse: destination?.name || "", destWarehouseAddress: String(destination?.address || ""),
        debitAcc: account(line.debit_account), creditAcc: account(line.credit_account), unit: apiUnitName(apiRows.units, line.uom),
        qty: Number(line.quantity || 0), price, amount: Number(line.line_value || 0) || Number(line.quantity || 0) * price };
    }));
    setShowTransferModal(true);
  };
  const closeTransferModal = () => {
    if (transferFormState !== transferSnapshot && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    setShowTransferModal(false); setShowTransferPrintMenu(false); setReceiveDialog(null); setTransferFiles([]);
    setRefPicker((picker) => picker?.target === "transfer" ? null : picker);
  };
  const transferFormData = () => ({
    id: editingTransferId, status: editingTransferStatus, transferType, code: transferVoucherCode, date: transferVoucherDate,
    postingDate: transferPostingDate, lines: transferRows, reference: transferRefSearch, inTransit: transferInTransit,
    transporterName: transferTransporterName, agentCode: transferAgentCode, receiverUnitCode: transferReceiverUnitCode,
    description: transferKind === "TRANSPORT" ? transferPurpose || transferExplanation : transferExplanation,
    sourceWarehouse: transferRows[0]?.sourceWarehouse || "Kho tổng Minh An",
    destWarehouse: transferRows[0]?.destWarehouse || "Kho Nguyên vật liệu",
    amount: transferRows.reduce((sum, row) => sum + (row.amount || 0), 0),
    metadata: {
      order_no: transferOrderNo, order_date: transferOrderDate, order_owner: transferOrderOwner,
      purpose: transferKind === "TRANSPORT" ? "" : transferPurpose, explanation: transferKind === "TRANSPORT" ? transferExplanation : "",
      receiver_unit_code: transferReceiverUnitCode, receiver_unit_name: transferReceiverUnitName, receiver_unit_tax: transferReceiverUnitTax,
      transporter_code: transferTransporterCode, transporter_name: transferTransporterName, transport_contract: transferTransportContract,
      vehicle: transferVehicle, sender_name: transferSenderName, receiver_name: transferReceiverName,
      contract_no: transferContractNo, contract_date: transferContractDate, contract_owner: transferContractOwner,
      agent_code: transferAgentCode, agent_name: transferAgentName, agent_tax: transferAgentTax,
      invoice_form: transferInvoiceForm, invoice_symbol: transferInvoiceSymbol, replacement_invoice: transferIsReplacementInvoice ? "1" : "",
      notes: transferNote,
    },
  });
  /** AF12/AF13/AF18: print with the posted values; printing again creates no stock movement. */
  const printTransferVoucher = (record: any, template: string) => {
    const withPrice = template !== "NO_PRICE";
    const metadata = record.document_metadata || {};
    const heading = TRANSFER_PRINT_TITLES[metadata.transfer_kind || "INTERNAL"] || TRANSFER_PRINT_TITLES.INTERNAL;
    const warehouseName = (id: string) => (apiRows.warehouses || []).find((row: any) => row.id === id)?.name || "";
    const accountCode = (id: string) => (apiRows.accounts || []).find((row: any) => row.id === id)?.code || "";
    const lines = (record.lines || []).map((line: any, index: number) => {
      const item = (apiRows.items || []).find((row: any) => row.id === line.item);
      return { no: index + 1, name: item?.name || "", code: item?.code || "", unit: apiUnitName(apiRows.units, line.uom),
        from: warehouseName(line.source_warehouse || record.source_warehouse), to: warehouseName(line.destination_warehouse || record.destination_warehouse),
        quantity: Number(line.quantity || 0), received: metadata.received_lines?.[line.id],
        price: Number(line.unit_cost || 0) * Number(line.conversion_factor || 1), amount: Number(line.line_value || 0) };
    });
    const total = lines.reduce((sum: number, line: any) => sum + line.amount, 0);
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].join(", ");
    const [year, month, day] = String(record.document_date || record.transaction_date || "").split("-");
    const cell = "border:1px solid #000;padding:4px 6px";
    const info = metadata.transfer_kind === "TRANSPORT"
      ? `- Căn cứ lệnh điều động số: ${escapeHtml(metadata.order_no)} ngày ${escapeHtml(metadata.order_date)} của ${escapeHtml(metadata.order_owner)} về việc ${escapeHtml(record.reason)}<br>
- Đơn vị nhận: ${escapeHtml(metadata.receiver_unit_name)} &nbsp; MST: ${escapeHtml(metadata.receiver_unit_tax)}<br>
- Họ tên người vận chuyển: ${escapeHtml(record.delivery_person)} &nbsp; Hợp đồng số: ${escapeHtml(metadata.transport_contract)}<br>
- Phương tiện vận chuyển: ${escapeHtml(metadata.vehicle)}`
      : metadata.transfer_kind === "CONSIGNMENT"
      ? `- Căn cứ hợp đồng kinh tế số: ${escapeHtml(metadata.contract_no)} ngày ${escapeHtml(metadata.contract_date)} của ${escapeHtml(metadata.contract_owner)}<br>
- Với đại lý: ${escapeHtml(metadata.agent_name)} &nbsp; Mã số thuế: ${escapeHtml(metadata.agent_tax)}<br>
- Họ tên người vận chuyển: ${escapeHtml(record.delivery_person)}<br>- Diễn giải: ${escapeHtml(record.reason)}`
      : `- Họ tên người vận chuyển: ${escapeHtml(record.delivery_person)}<br>- Diễn giải: ${escapeHtml(record.reason)}`;
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(heading.title)} ${escapeHtml(record.number)}</title>
<style>body{font-family:"Times New Roman",serif;font-size:13px;color:#000;margin:24px}table{border-collapse:collapse;width:100%}
.num{text-align:right}.center{text-align:center}h1{font-size:18px;margin:4px 0}.muted{font-style:italic}</style></head><body>
<table><tr><td><strong>${escapeHtml(_company.name)}</strong></td><td class="center" style="width:260px"><strong>${escapeHtml(heading.form)}</strong></td></tr></table>
<div class="center"><h1>${escapeHtml(heading.title)}</h1><div class="muted">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
<div>Số: <strong>${escapeHtml(record.number)}</strong></div>
<div>Nợ: ${escapeHtml(unique((record.lines || []).map((line: any) => accountCode(line.debit_account))))} &nbsp; Có: ${escapeHtml(unique((record.lines || []).map((line: any) => accountCode(line.credit_account))))}</div></div>
<p>${info}<br>- Xuất tại kho: ${escapeHtml(unique(lines.map((line: any) => line.from)))} &nbsp; Nhập tại kho: ${escapeHtml(unique(lines.map((line: any) => line.to)))}</p>
<table><thead><tr><th style="${cell}">STT</th><th style="${cell}">Tên, nhãn hiệu, quy cách vật tư, hàng hóa</th><th style="${cell}">Mã số</th><th style="${cell}">ĐVT</th>
<th style="${cell}">Xuất tại kho</th><th style="${cell}">Nhập tại kho</th><th style="${cell}">Thực xuất</th><th style="${cell}">Thực nhập</th>
${withPrice ? `<th style="${cell}">Đơn giá</th><th style="${cell}">Thành tiền</th>` : ""}</tr></thead><tbody>
${lines.map((line: any) => `<tr><td style="${cell}" class="center">${line.no}</td><td style="${cell}">${escapeHtml(line.name)}</td><td style="${cell}">${escapeHtml(line.code)}</td>
<td style="${cell}" class="center">${escapeHtml(line.unit)}</td><td style="${cell}">${escapeHtml(line.from)}</td><td style="${cell}">${escapeHtml(line.to)}</td>
<td style="${cell}" class="num">${line.quantity}</td><td style="${cell}" class="num">${escapeHtml(line.received ?? (metadata.receipt_status === "RECEIVED" ? line.quantity : ""))}</td>
${withPrice ? `<td style="${cell}" class="num">${formatVND(line.price)}</td><td style="${cell}" class="num">${formatVND(line.amount)}</td>` : ""}</tr>`).join("")}
${withPrice ? `<tr><td style="${cell}" colspan="9"><strong>Cộng</strong></td><td style="${cell}" class="num"><strong>${formatVND(total)}</strong></td></tr>` : ""}
</tbody></table>
${withPrice ? `<p>- Tổng giá trị điều chuyển (viết bằng chữ): <em>${escapeHtml(convertNumberToVietnameseWords(Math.round(total)))}</em></p>` : ""}
<table style="margin-top:24px"><tr class="center">${["Người lập phiếu", "Thủ kho xuất", "Người vận chuyển", "Thủ kho nhập"]
      .map((title) => `<td class="center"><strong>${title}</strong><br><span class="muted">(Ký, họ tên)</span></td>`).join("")}</tr></table>
</body></html>`;
    openPrintFrame(html, `In ${heading.title.toLowerCase()} ${record.number}`, () => notify("Trình duyệt chặn lệnh in. Vui lòng thử lại."));
  };
  const openReceiveDialog = () => {
    if (!transferRecord) return;
    setReceiveDialog({ accept: false, reason: "", rows: (transferRecord.lines || []).map((line: any) => {
      const item = (apiRows.items || []).find((row: any) => row.id === line.item);
      return { line: line.id, itemCode: item?.code || "", itemName: item?.name || "", unit: apiUnitName(apiRows.units, line.uom),
        shipped: Number(line.quantity || 0), received: Number(line.quantity || 0) };
    }) });
  };
  /** EF20: a difference must be acknowledged with a reason before the receipt is confirmed. */
  const confirmReceive = async () => {
    if (!receiveDialog || !transferRecord) return;
    const differences = receiveDialog.rows.filter((row) => row.received !== row.shipped);
    if (differences.length && !receiveDialog.accept) {
      notify(`Số lượng thực nhận khác số lượng đã xuất chuyển: ${differences.map((row) =>
        `${row.itemCode} đã xuất ${row.shipped}, thực nhận ${row.received}, chênh lệch ${row.shipped - row.received}`).join("; ")}. Vui lòng kiểm tra và xử lý chênh lệch.`);
      return;
    }
    if (differences.length && !receiveDialog.reason.trim()) { notify("Vui lòng nhập lý do xử lý chênh lệch điều chuyển."); return; }
    let updated: any = null;
    const saved = await apiSave(async (writer) => {
      const result = await receiveTransfer(writer, transferRecord.id, receiveDialog.rows.map((row) => ({ line: row.line, received: row.received })),
        receiveDialog.accept, receiveDialog.reason.trim());
      updated = result.record;
      return result;
    });
    if (saved && updated) { setTransferRecord(updated); setReceiveDialog(null); }
  };
  const handleSaveTransfer = async (data: any, post = true, printTemplate?: string) => {
    setShowTransferPrintMenu(false);
    if (apiConnected) {
      let outcome: { record?: any; posted?: boolean; uploaded?: number } | null = null;
      const saved = await apiSave(async (writer) => {
        const result = await saveTransferVoucher(writer, { ...data, files: transferFiles }, post);
        outcome = result;
        return result;
      });
      const result = outcome as { record?: any; posted?: boolean; uploaded?: number } | null;
      const uploaded = result?.uploaded || 0;
      if (result?.record) {
        setTransferAttachments(result.record.document_metadata?.attachments || transferAttachments);
        if (result.record.lines) setTransferRecord(result.record);
      }
      if (uploaded) setTransferFiles((files) => files.slice(uploaded));
      if (saved && result?.record && (uploaded < transferFiles.length || !result.posted && result.record.status !== "PENDING_APPROVAL")) {
        // Saved but not posted (or a file was refused): keep the voucher open so the user can correct it and retry.
        setEditingTransferId(result.record.id); setEditingTransferStatus(result.record.status); setTransferSnapshot(transferFormState);
        return saved;
      }
      if (saved && printTemplate && result?.posted) printTransferVoucher(result.record, printTemplate);
      if (saved) { setShowTransferModal(false); setEditingTransferId(""); setEditingTransferStatus(""); setTransferFiles([]); }
      return saved;
    }
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
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                  margin: 0,
                  padding: "4px 10px 14px 10px",
                  borderBottom: "1px solid #f1f5f9",
                  color: "#1e293b",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                NGHIỆP VỤ KHO
              </h2>
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
                  <span className="ref-business-icon prod" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>LSX</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Package size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Lệnh sản xuất
                  </span>
                  {/* Vertical connecting line down to main horizontal line */}
                  <div style={{ position: "absolute", top: 48, width: 1.5, height: 48, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* 2. Xuất kho */}
                <div
                  onClick={() => navigateTo("issues")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 110 }}
                >
                  <span className="ref-business-icon export" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>XK</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#ea580c", borderColor: "#f97316" }}
                    >
                      <Building2 size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Xuất kho
                  </span>
                  <div style={{ position: "absolute", top: 48, width: 1.5, height: 48, background: "#cbd5e1", zIndex: -1 }} />
                </div>

                {/* 3. Chuyển kho */}
                <div
                  onClick={() => navigateTo("transfers")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 110 }}
                >
                  <span className="ref-business-icon transfer" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>CK</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <ArrowRightLeft size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Chuyển kho
                  </span>
                  <div style={{ position: "absolute", top: 48, width: 1.5, height: 48, background: "#cbd5e1", zIndex: -1 }} />
                </div>
              </div>

              {/* BOTTOM ROW: Lắp ráp, tháo dỡ | Nhập kho | Tính giá xuất kho | Kiểm kê */}
              <div style={{ display: "flex", justifyContent: "space-between", position: "relative", zIndex: 2 }}>
                {/* 4. Lắp ráp, tháo dỡ */}
                <div
                  onClick={() => navigateTo("assembly")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <span className="ref-business-icon assemble" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>LR</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Wrench size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Lắp ráp, tháo dỡ
                  </span>
                </div>

                {/* 5. Nhập kho */}
                <div
                  onClick={() => navigateTo("receipts")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <span className="ref-business-icon import" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>NK</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Boxes size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Nhập kho
                  </span>
                </div>

                {/* 6. Tính giá xuất kho */}
                <div
                  onClick={() => setShowCalculateCostModal(true)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <span className="ref-business-icon calc" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>TG</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Calculator size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
                    Tính giá xuất kho
                  </span>
                </div>

                {/* 7. Kiểm kê */}
                <div
                  onClick={() => navigateTo("stocktake")}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", width: 105 }}
                >
                  <span className="ref-business-icon audit" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>KK</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <ClipboardCheck size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>
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
        {stockAlertsError && <div role="alert" style={{ background: "#fef2f2", color: "#b91c1c", padding: "8px 12px", borderRadius: 4 }}>{stockAlertsError} {stockAlerts && "Số liệu hiển thị có thể đã cũ."}</div>}
        {/* Top 4 KPI Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {/* Card 1: Hàng hóa sắp hết hàng */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 110 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#ffedd5", display: "grid", placeItems: "center" }}>
                <Package size={22} style={{ color: "#ea580c" }} />
              </div>
              <div>
                <span style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", display: "block", lineHeight: 1.1 }}>{stockAlerts?.low_count ?? "—"}</span>
                <span style={{ fontSize: 13, color: "#475569", marginTop: 4, display: "block" }}>Hàng hóa sắp hết hàng</span>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span>Số liệu tính đến: {alertUpdatedAt}</span>
              <button type="button" disabled={stockAlertsLoading} onClick={reloadStockAlerts} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
            </div>
          </div>

          {/* Card 2: Hàng hóa hết hàng */}
          <div style={{ background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "16px", display: "flex", alignItems: "center", gap: 16, minHeight: 110 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#fee2e2", display: "grid", placeItems: "center" }}>
              <Package size={22} style={{ color: "#dc2626" }} />
            </div>
            <div>
                <span style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", display: "block", lineHeight: 1.1 }}>{stockAlerts?.out_count ?? "—"}</span>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14, fontSize: 12.5, color: "#334155" }}>
                {stockAlerts?.low_rows.map((row) => (
                  <div key={`${row.warehouse_id}-${row.item_id}`} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr 1fr", gap: 4 }}>
                    <span title={row.item_code}>{row.item_name}</span><span>{row.warehouse_name}</span>
                    <span style={{ textAlign: "right" }}>{apiNumber(row.quantity).toLocaleString("vi-VN")}</span>
                    <span style={{ textAlign: "right" }}>{apiNumber(row.minimum_quantity).toLocaleString("vi-VN")}</span>
                  </div>
                ))}
                {stockAlerts && stockAlerts.low_rows.length === 0 && <span>Không có hàng hóa sắp hết.</span>}
                {!stockAlerts && !stockAlertsError && <span>{stockAlertsLoading ? "Đang tải cảnh báo tồn kho..." : "Chưa có dữ liệu cảnh báo."}</span>}
              </div>
            </div>

            <div style={{ fontSize: 11.5, color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: 10, marginTop: 20 }}>
              Số liệu tính đến: {alertUpdatedAt} <button type="button" disabled={stockAlertsLoading} onClick={reloadStockAlerts} style={{ border: "none", background: "transparent", color: "#0284c7", cursor: "pointer", padding: 0 }}>Tải lại</button>
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
                notify("Sổ Việt AI đã sẵn sàng hỗ trợ khởi tạo phiếu nhập kho!");
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
              onClick={() => openOtherReceipt()}
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
              onClick={() => openOtherReceipt()}
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
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => openOtherReceipt(row.id)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                    <td style={{ padding: "8px 10px" }}>{row.partner}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }} onClick={(event) => event.stopPropagation()}>{apiStatus("transactions", row.id, row.status)}</span>
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
                openNewIssue();
                notify("Sổ Việt AI đã phân tích số lượng tồn kho khả dụng để xuất hàng!");
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
              onClick={openNewIssue}
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
              onClick={openNewIssue}
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
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => openIssueRecord(row.id)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.type}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                    <td style={{ padding: "8px 10px" }}>{row.partner}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{apiStatus("issues", row.id, row.status)}</span>
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
                openNewTransfer();
                notify("Sổ Việt AI đã phân tích tuyến điều chuyển kho tối ưu!");
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
              onClick={openNewTransfer}
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
              onClick={openNewTransfer}
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
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => openTransferRecord(row.id)}>
                    <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.sourceWarehouse}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.destWarehouse}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{row.description}</td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(row.amount)} đ</td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{apiStatus("transfers", row.id, row.status)}</span>
                      {(() => {
                        // Section 6: delivery status is shown apart from the posting status.
                        const receipt = (apiRows.transactions || []).find((entry: any) => entry.id === row.id)?.document_metadata?.receipt_status;
                        return receipt ? <div style={{ marginTop: 3, fontSize: 11, color: receipt === "IN_TRANSIT" ? "#b45309" : "#0369a1" }}>{TRANSFER_RECEIPT_LABELS[receipt]}</div> : null;
                      })()}
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
                notify("Sổ Việt AI đã phân tích kế hoạch và định mức nguyên vật liệu sản xuất!");
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
                notify("Sổ Việt AI đã phân tích cấu trúc linh kiện thành phẩm!");
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
                openStocktake();
                notify("Sổ Việt AI đã đồng bộ số liệu sổ sách sẵn sàng đối chiếu kiểm kê!");
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
              onClick={() => openStocktake()}
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
              onClick={() => openStocktake()}
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
            onClick={() => reloadApi()}
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
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer" }} onClick={() => openStocktake(row.id)}>
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{row.code}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{row.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{row.warehouse}</td>
                  <td style={{ padding: "8px 10px" }}>{row.purpose}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{row.difference}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{({ DRAFT: "Nháp", COUNTED: "Chờ xử lý chênh lệch", ADJUSTED: "Đã hoàn thành", CANCELLED: "Đã hủy" } as Record<string, string>)[row.status] || row.status}</span>
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
              onClick={() => notify("Sổ Việt AI: Bạn có thể gõ 'Tồn kho theo kho', 'Hàng sắp hết', 'Thẻ kho 152' để tìm tức thì!")}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7c3aed", fontWeight: 600, cursor: "pointer" }}
            >
              <span>Tìm kiếm nhanh báo cáo với Sổ Việt AI</span>
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
    const displayedItems = showFullDemoCatalog && !apiConnected
      ? [
          ...catalogItems,
          ...SAMPLE_INVENTORY_ITEMS.map((s) => ({
            id: s.code,
            name: s.name,
            code: s.code,
            vatPolicy: "10%",
            nature: s.group === "Tủ điện" ? "Thành phẩm" : "Nguyên vật liệu",
            stockQty: s.stock,
            stockValue: s.stock * s.price,
          })),
        ]
      : catalogItems;

    const filteredItems = displayedItems.filter((it) => {
      if (searchQuery && !it.name.toLowerCase().includes(searchQuery.toLowerCase()) && !it.code.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (itemAlertFilter && stockAlerts && !(
        itemAlertFilter === "LOW" ? stockAlerts.low_rows : stockAlerts.out_rows
      ).some((row) => row.item_id === it.id)) return false;
      return true;
    });

    const totalQty = filteredItems.reduce((acc, it) => acc + it.stockQty, 0);
    const totalVal = filteredItems.reduce((acc, it) => acc + it.stockValue, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", overflow: "hidden" }}>
        {stockAlertsError && <div role="alert" style={{ background: "#fef2f2", color: "#b91c1c", padding: "8px 16px" }}>{stockAlertsError} {stockAlerts && "Số liệu cảnh báo có thể đã cũ."}</div>}
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
                role="button"
                tabIndex={0}
                aria-pressed={itemAlertFilter === "LOW"}
                onClick={() => { if (stockAlerts) setItemAlertFilter((current) => current === "LOW" ? null : "LOW"); }}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (stockAlerts) setItemAlertFilter((current) => current === "LOW" ? null : "LOW"); } }}
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
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#ea580c", lineHeight: 1.2 }}>{stockAlerts?.low_count ?? "—"}</span>
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
                  <span>{alertUpdatedAt}</span>
                </div>
              </div>

              {/* Card 2: Hàng hóa hết hàng */}
              <div
                role="button"
                tabIndex={0}
                aria-pressed={itemAlertFilter === "OUT"}
                onClick={() => { if (stockAlerts) setItemAlertFilter((current) => current === "OUT" ? null : "OUT"); }}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (stockAlerts) setItemAlertFilter((current) => current === "OUT" ? null : "OUT"); } }}
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
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#dc2626", lineHeight: 1.2 }}>{stockAlerts?.out_count ?? "—"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#94a3b8" }}>
                  <Clock size={13} />
                  <span>{alertUpdatedAt}</span>
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
              onClick={() => { reloadApi(); reloadStockAlerts(); }}
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
                onClick={() => setShowNatureDrawer(true)}
                title="Chọn tính chất hàng hóa dịch vụ"
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
                onClick={() => setShowNatureDrawer(true)}
                title="Chọn tính chất hàng hóa dịch vụ"
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
                        filteredItems.forEach((it) => { all[it.id || it.code] = true; });
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
                <tr key={item.id || item.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center", padding: "8px 6px" }}>
                    <input
                      type="checkbox"
                      checked={!!selectedItems[item.id || item.code]}
                      onChange={(e) => {
                        setSelectedItems({ ...selectedItems, [item.id || item.code]: e.target.checked });
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
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{item.nature || (item as any).type || "Hàng hóa"}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                    {item.stockQty.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", color: "#1e293b" }}>
                    {item.stockValue.toLocaleString("vi-VN")}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item);
                        setSelectedNature(item.nature || (item as any).type || "Hàng hóa");
                        setShowItemModal(true);
                      }}
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
            <div className="misa-purchase-modal-window" onChangeCapture={() => setOtherReceiptDirty(true)} style={{ background: "#ffffff", borderRadius: 6, width: "99vw", maxWidth: 1480, height: "96vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)", overflow: "hidden", border: "1px solid #cbd5e1" }}>

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
                  <MisaDropdownSelect
                    value={receiptType}
                    disabled={!!editingOtherReceiptId}
                    onChange={(val) => {
                      const newType = val as typeof receiptType;
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
                    title="LOẠI NHẬP KHO"
                    options={[
                      { value: "1. Thành phẩm sản xuất", label: "1. Thành phẩm sản xuất" },
                      { value: "2. Hàng bán bị trả lại", label: "2. Hàng bán bị trả lại" },
                      { value: "3. Khác (NVL thừa, HH thuê gia công, ...)", label: "3. Khác (NVL thừa, HH thuê gia công, ...)" },
                    ]}
                    buttonStyle={{
                      height: 28,
                      padding: "0 10px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                    minWidth={290}
                    ariaLabel="Loại nhập kho"
                  />

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
                            <span title="Sổ Việt AI gợi ý diễn giải kế toán thông minh" style={{ display: "inline-flex" }}>
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
                                list="other-receipt-parties"
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              <datalist id="other-receipt-parties">{(apiRows.parties || []).filter((party: any) => party.status === "ACTIVE").map((party: any) => <option key={party.id} value={party.code}>{party.name}</option>)}</datalist>
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
                    onClick={() => notify("Sổ Việt AI đang phân tích hồ sơ chứng từ để gợi ý...")}
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
                            list={receiptType.startsWith("3.") && apiConnected ? "other-receipt-items" : undefined}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = receiptType.startsWith("3.") && apiConnected
                                ? apiRows.items?.find((it: any) => it.code.toLowerCase() === val.toLowerCase() && it.status === "ACTIVE" && it.track_inventory)
                                : SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              setReceiptRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        itemName: matched ? matched.name : r.itemName,
                                        unit: matched ? (receiptType.startsWith("3.") && apiConnected ? apiUnitName(apiRows.units, (matched as any).base_uom) : (matched as any).unit) : r.unit,
                                        warehouse: receiptType.startsWith("3.") && apiConnected ? r.warehouse : matched ? "Kho Thành phẩm" : r.warehouse,
                                        price: receiptType.startsWith("3.") && apiConnected ? r.price : matched ? matched.price : r.price,
                                        amount: receiptType.startsWith("3.") && apiConnected ? r.amount : matched ? r.qty * matched.price : r.amount,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                          {idx === 0 && receiptType.startsWith("3.") && apiConnected && <datalist id="other-receipt-items">
                            {(apiRows.items || []).filter((item: any) => item.status === "ACTIVE" && item.track_inventory).map((item: any) => <option key={item.id} value={item.code}>{item.name}</option>)}
                          </datalist>}
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
                              setReceiptRows((prev) => prev.map((r, i) => receiptType.startsWith("3.") ? { ...r, warehouse: val } : i === idx ? { ...r, warehouse: val } : r));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho --</option>
                            {(receiptType.startsWith("3.") && apiConnected ? (apiRows.warehouses || []).filter((w: any) => w.status === "ACTIVE" && w.allow_receipt) : SAMPLE_WAREHOUSES).map((w: any) => (
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
                                list="other-receipt-accounts"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setReceiptRows((prev) => prev.map((r, i) => (i === idx ? { ...r, debitAcc: val } : r)));
                                }}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "center", borderRadius: 3, padding: "0 2px", fontSize: 12, outline: "none" }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                              />
                              {idx === 0 && <datalist id="other-receipt-accounts">{(apiRows.accounts || []).filter((account: any) => account.status === "ACTIVE" && account.is_postable).map((account: any) => <option key={account.id} value={account.code}>{account.name}</option>)}</datalist>}
                            </td>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.creditAcc}
                                list="other-receipt-accounts"
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
                      const defaultDebit = receiptType.startsWith("3.") ? "" : "155";
                      const defaultCredit = receiptType === "1. Thành phẩm sản xuất" ? "154" : receiptType === "2. Hàng bán bị trả lại" ? "632" : "";
                      setReceiptRows((prev) => [
                        ...prev,
                        { id: newId, itemCode: "", itemName: "", warehouse: receiptType.startsWith("3.") ? prev[0]?.warehouse || "" : "", debitAcc: defaultDebit, creditAcc: defaultCredit, unit: "", qty: 1, price: 0, amount: 0, prodOrder: "", costObject: "" },
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
                          debitAcc: receiptType.startsWith("3.") ? "" : "155",
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

                {/* Right: Actions Hủy, Cất, Lưu và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {editingIssueStatus && !["DRAFT", "REJECTED"].includes(editingIssueStatus) && <span style={{ color: "#64748b", fontSize: 12 }}>Chứng từ đã gửi duyệt hoặc ghi sổ · chỉ xem</span>}
                  <button
                    type="button"
                    onClick={() => { if (!otherReceiptDirty || window.confirm("Bỏ các thay đổi chưa lưu?")) setShowReceiptModal(false); }}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  <button
                    type="button"
                    disabled={!!editingOtherReceiptId && apiRows.transactions?.find((row: any) => row.id === editingOtherReceiptId)?.status !== "DRAFT"}
                    onClick={() => {
                      const totalAmt = receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                      const partnerName = receiptDeliveryPersonName || receiptCustomerName || "Đối tác giao hàng";
                      handleSaveReceipt({
                        code: receiptVoucherCode,
                        lines: receiptRows,
                        partnerCode: receiptCustomerCode,
                        date: receiptVoucherDate,
                        postingDate: receiptPostingDate,
                        deliveryPerson: receiptDeliveryPersonName,
                        warehouse: receiptRows[0]?.warehouse || "Kho Thành phẩm",
                        partner: partnerName,
                        description: receiptReason || `Nhập kho theo chứng từ ${receiptVoucherCode}`,
                        amount: totalAmt,
                      });
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >Lưu</button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      disabled={!!editingOtherReceiptId && apiRows.transactions?.find((row: any) => row.id === editingOtherReceiptId)?.status !== "DRAFT"}
                      onClick={() => {
                        const totalAmt = receiptRows.reduce((sum, r) => sum + (r.amount || 0), 0);
                        const partnerName = receiptDeliveryPersonName || receiptCustomerName || "Đối tác giao hàng";
                        handleSaveReceipt({
                          code: receiptVoucherCode,
                          lines: receiptRows,
                          partnerCode: receiptCustomerCode,
                          date: receiptVoucherDate,
                          postingDate: receiptPostingDate,
                          deliveryPerson: receiptDeliveryPersonName,
                          warehouse: receiptRows[0]?.warehouse || "Kho Thành phẩm",
                          partner: partnerName,
                          description: receiptReason || `Nhập kho theo chứng từ ${receiptVoucherCode}`,
                          amount: totalAmt,
                        });
                        if (!apiConnected) notify(`Đã lưu và chuyển sang chế độ in chứng từ ${receiptVoucherCode}`);
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
                      Lưu và In
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
                    aria-label="Loại xuất kho"
                    value={issueType}
                    onChange={(e) => {
                      const newType = e.target.value as typeof issueType;
                      setIssueType(newType);
                      setIssueSaleId("");
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
                      onKeyDown={(e) => { if (e.key === "Enter" && issueType.startsWith("1.")) openSalePicker(); }}
                      aria-label="Số chứng từ tham chiếu"
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
                  {issueType.startsWith("1.") && apiConnected && <button type="button" onClick={openSalePicker}
                    disabled={Boolean(editingIssueId && issueSaleId)}
                    style={{ height: 28, padding: "0 12px", border: "1px solid #00a862", borderRadius: 4, background: "#f0fdf4", color: "#047857", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Chọn chứng từ bán hàng
                  </button>}
                  {apiConnected && (issueType.startsWith("1.") || issueType.startsWith("3.")) && <span data-testid="issue-status"
                    style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                      background: editingIssueStatus === "POSTED" ? "#dcfce7" : "#f1f5f9", color: editingIssueStatus === "POSTED" ? "#15803d" : "#475569" }}>
                    {editingIssueStatus ? ISSUE_STATUS_LABELS[editingIssueStatus] || editingIssueStatus : "Phiếu mới"}
                  </span>}
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
                  <button type="button" title="Đóng" onClick={closeIssueModal} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
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
                              <span title="Sổ Việt AI gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
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
                              <span title="Sổ Việt AI gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
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
                                aria-label="Mã đối tượng"
                                list={apiConnected ? "issue-parties" : undefined}
                                onChange={(e) => selectIssueParty(e.target.value)}
                                style={{ flex: 1, border: "none", padding: "0 6px", fontSize: 12.5, outline: "none" }}
                              />
                              {apiConnected && <datalist id="issue-parties">
                                {(apiRows.parties || []).filter((party: any) => party.status === "ACTIVE").map((party: any) => <option key={party.id} value={party.code}>{party.name}</option>)}
                              </datalist>}
                              <button type="button" title="Thêm đối tượng"
                                onClick={() => apiConnected
                                  ? setPartyQuickAdd({ code: issueCustomerCode, name: "", type: "ORGANIZATION", address: "", saving: false })
                                  : notify("Thêm đối tượng")} style={{ width: 24, border: "none", borderLeft: "1px solid #e2e8f0", background: "#f8fafc", color: "#16a34a", cursor: "pointer", display: "grid", placeItems: "center" }}>
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
                              aria-label="Tên đối tượng"
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
                            aria-label="Địa chỉ"
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
                              aria-label="Người nhận"
                              onChange={(e) => setIssueReceiverName(e.target.value)}
                              style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 3 }}>Lý do xuất</label>
                            <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", background: "#ffffff", height: 28 }}>
                              <input
                                type="text"
                                value={issueReason}
                                aria-label="Lý do xuất"
                                onChange={(e) => setIssueReason(e.target.value)}
                                style={{ flex: 1, border: "none", fontSize: 12.5, outline: "none" }}
                              />
                              <span title="Sổ Việt AI gợi ý lý do xuất kho" style={{ display: "inline-flex" }}>
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
                              aria-label="Kèm theo"
                              onChange={(e) => setIssueAttachedDocs(e.target.value)}
                              placeholder="Số lượng"
                              style={{ width: 70, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                            />
                            <span>chứng từ gốc</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                            <span>Tham chiếu</span>
                            <button type="button" aria-label="Chọn chứng từ tham chiếu" disabled={issueReadOnly}
                              onClick={() => setRefPicker({ search: "", target: "issue" })}
                              style={{ border: "none", background: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</button>
                            {issueRefSearch && <span style={{ color: "#0f172a", fontWeight: 600 }}>{issueRefSearch}</span>}
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
                    onClick={() => notify("Sổ Việt AI đang phân tích gợi ý hồ sơ xuất kho...")}
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
                            list={issueType !== "2. Sản xuất" && apiConnected ? "other-issue-items" : undefined}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = issueType !== "2. Sản xuất" && apiConnected
                                ? (apiRows.items || []).find((it: any) => String(it.code).toLowerCase() === val.toLowerCase())
                                : SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              setIssueRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        itemName: matched ? matched.name : r.itemName,
                                        unit: matched ? (issueType !== "2. Sản xuất" && apiConnected ? apiUnitName(apiRows.units, (matched as any).base_uom) : (matched as any).unit) : r.unit,
                                        warehouse: issueType !== "2. Sản xuất" && apiConnected ? r.warehouse : matched ? "Kho tổng Minh An" : r.warehouse,
                                        // Step 13: suggested cost from the item's stock in the line's warehouse.
                                        price: issueType !== "2. Sản xuất" && apiConnected
                                          ? (matched ? averageCost((matched as any).id, warehouseByName(r.warehouse)?.id) : r.price)
                                          : matched ? (matched as any).price : r.price,
                                        amount: issueType !== "2. Sản xuất" && apiConnected
                                          ? r.qty * (matched ? averageCost((matched as any).id, warehouseByName(r.warehouse)?.id) : r.price)
                                          : matched ? r.qty * (matched as any).price : r.amount,
                                      }
                                    : r
                                )
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                          {idx === 0 && issueType !== "2. Sản xuất" && apiConnected && <datalist id="other-issue-items">
                            {(apiRows.items || []).filter((item: any) => item.status === "ACTIVE" && item.track_inventory).map((item: any) => <option key={item.id} value={item.code}>{item.name}</option>)}
                          </datalist>}
                          {idx === 0 && issueType !== "2. Sản xuất" && apiConnected && <datalist id="other-issue-accounts">
                            {(apiRows.accounts || []).filter((account: any) => account.status === "ACTIVE" && account.is_postable).map((account: any) => <option key={account.id} value={account.code}>{account.name}</option>)}
                          </datalist>}
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
                            aria-label={`Kho xuất dòng ${idx + 1}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              // AF-04: each line has its own warehouse; the shown cost follows that warehouse's stock.
                              const saleCost = !issueType.startsWith("2.") && apiConnected
                                ? averageCost(itemByCode(row.itemCode)?.id, warehouseByName(val)?.id) : null;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx
                                ? { ...r, warehouse: val, ...(saleCost === null ? {} : { price: saleCost, amount: r.qty * saleCost }) } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho --</option>
                            {(issueType !== "2. Sản xuất" && apiConnected ? (apiRows.warehouses || []).filter((w: any) => w.status === "ACTIVE" && w.allow_issue && w.warehouse_type !== "TRANSIT") : SAMPLE_WAREHOUSES).map((w: any) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                          {!issueType.startsWith("2.") && apiConnected && row.warehouse && row.itemCode && (() => {
                            const stock = availableStock(itemByCode(row.itemCode)?.id, warehouseByName(row.warehouse)?.id);
                            return <div style={{ fontSize: 11, color: stock < row.qty ? "#dc2626" : "#64748b", paddingLeft: 4 }}>Tồn khả dụng: {stock}</div>;
                          })()}
                        </td>
                        {issueShowAccounts && (
                          <>
                            <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={row.debitAcc}
                                list={issueType !== "2. Sản xuất" && apiConnected ? "other-issue-accounts" : undefined}
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
                                list={issueType !== "2. Sản xuất" && apiConnected ? "other-issue-accounts" : undefined}
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
                            aria-label={`Số lượng xuất dòng ${idx + 1}`}
                            onChange={(e) => {
                              const qty = Number(e.target.value) || 0;
                              setIssueRows((prev) => prev.map((r, i) => (i === idx ? { ...r, qty, amount: qty * r.price } : r)));
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12, outline: "none" }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = "#00a862"; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                          />
                          {row.saleLineId && row.remaining !== undefined && (
                            <div title={`Số lượng bán ${row.soldQty} · đã xuất ${row.issuedQty}`}
                              style={{ fontSize: 11, textAlign: "right", paddingRight: 4, color: row.qty > row.remaining || row.qty <= 0 ? "#dc2626" : "#64748b" }}>
                              Còn được xuất: {row.remaining}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="number"
                            step="any"
                            value={row.price}
                            aria-label={`Đơn giá dòng ${idx + 1}`}
                            readOnly={Boolean(row.saleLineId) || (otherIssueMode && Boolean(itemByCode(row.itemCode)) && itemByCode(row.itemCode)?.valuation_method !== "SPECIFIC")}
                            title={row.saleLineId || otherIssueMode ? "Đơn giá xuất kho đề xuất theo giá bình quân tồn kho; giá chính thức được xác định theo phương pháp tính giá khi ghi sổ" : undefined}
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

              {/* ATTACHMENT SECTION (AF11 / EF19): files are uploaded with the voucher when it is saved. */}
              <VoucherAttachments inputId="issue-attachment-input" files={issueFiles} attachments={issueAttachments} readOnly={issueReadOnly}
                onAdd={(list) => addVoucherFiles(list, setIssueFiles)} onRemoveFile={(index) => setIssueFiles((files) => files.filter((_, i) => i !== index))}
                onDownload={(entry) => downloadAttachment(editingIssueId, entry)} onRemove={(entry) => removeAttachment(editingIssueId, entry, setIssueAttachments)} />

              {/* BOTTOM FOOTER BAR */}
              <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Left: Hiển thị tài khoản toggle */}
                <label
                  role="switch"
                  aria-checked={issueShowAccounts}
                  onClick={() => setIssueShowAccounts(!issueShowAccounts)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}
                >
                  <div
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

                {/* Right: Actions Hủy, Cất, Lưu và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeIssueModal}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  {/* UC-INV-04: "Cất" saves and posts the other-issue voucher in one step; type 1 keeps Lưu + Ghi sổ. */}
                  <button
                    type="button"
                    disabled={otherIssueMode ? issueLocked : issueReadOnly}
                    onClick={() => handleSaveIssue(issueFormData(), otherIssueMode)}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >{otherIssueMode ? "Cất" : "Lưu"}</button>

                  {apiConnected && issueType.startsWith("1.") && <button
                    type="button"
                    disabled={issueLocked}
                    onClick={() => handleSaveIssue(issueFormData(), true)}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #00a862", borderRadius: 4, background: "#ffffff", color: "#047857", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >Ghi sổ</button>}

                  <div style={{ display: "flex", position: "relative" }}>
                    <button
                      type="button"
                      disabled={otherIssueMode ? issueLocked : issueReadOnly}
                      onClick={() => {
                        handleSaveIssue(issueFormData(), otherIssueMode, apiConnected ? issuePrintTemplate : undefined);
                        if (!apiConnected) notify(`Đã lưu và chuyển sang chế độ in chứng từ ${issueVoucherCode}`);
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
                      {otherIssueMode ? "Cất và In" : "Lưu và In"}
                    </button>
                    <button
                      type="button"
                      aria-label="Chọn mẫu in"
                      aria-expanded={showIssuePrintMenu}
                      disabled={otherIssueMode ? issueLocked : issueReadOnly}
                      onClick={() => setShowIssuePrintMenu((open) => !open)}
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
                    {showIssuePrintMenu && (
                      <div role="menu" aria-label="Mẫu in phiếu xuất kho" style={{ position: "absolute", right: 0, bottom: 38, minWidth: 300, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, boxShadow: "0 10px 25px rgba(15,23,42,0.18)", padding: 4, zIndex: 5 }}>
                        {ISSUE_PRINT_TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              // AF13: choosing a template runs Cất và In with it.
                              setIssuePrintTemplate(template.id);
                              setShowIssuePrintMenu(false);
                              handleSaveIssue(issueFormData(), otherIssueMode, apiConnected ? template.id : undefined);
                            }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderRadius: 3, background: template.id === issuePrintTemplate ? "#ecfdf5" : "transparent", color: "#0f172a", fontSize: 12.5, cursor: "pointer" }}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UC-INV-05 AF16 / EF20: XÁC NHẬN NHẬN HÀNG CHUYỂN KHO */}
        {showTransferModal && receiveDialog && (() => {
          const cell = { padding: "6px 8px", borderRight: "1px solid #e2e8f0" } as const;
          const differences = receiveDialog.rows.filter((row) => row.received !== row.shipped);
          return (
            <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div role="dialog" aria-label="Xác nhận nhận hàng" style={{ background: "#ffffff", borderRadius: 6, width: "min(760px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)", border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #cbd5e1", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Xác nhận nhận hàng {transferRecord?.number}</h3>
                  <button type="button" title="Đóng" onClick={() => setReceiveDialog(null)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6" }}>
                        {["Mã hàng", "Tên hàng", "ĐVT", "Đã xuất", "Thực nhận", "Chênh lệch"].map((title) => <th key={title} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{title}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {receiveDialog.rows.map((row, index) => (
                        <tr key={row.line} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={cell}>{row.itemCode}</td>
                          <td style={cell}>{row.itemName}</td>
                          <td style={cell}>{row.unit}</td>
                          <td style={{ ...cell, textAlign: "right" }}>{row.shipped}</td>
                          <td style={cell}>
                            <input type="number" step="any" min={0} aria-label={`Thực nhận dòng ${index + 1}`} value={row.received}
                              onChange={(e) => setReceiveDialog({ ...receiveDialog, rows: receiveDialog.rows.map((entry, i) => i === index ? { ...entry, received: Number(e.target.value) } : entry) })}
                              style={{ width: 90, height: 26, border: "1px solid #cbd5e1", borderRadius: 3, textAlign: "right", padding: "0 4px" }} />
                          </td>
                          <td style={{ ...cell, textAlign: "right", color: row.received !== row.shipped ? "#dc2626" : "#64748b", fontWeight: row.received !== row.shipped ? 700 : 400 }}>
                            {row.shipped - row.received}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {differences.length > 0 && (
                    <div style={{ padding: "10px 14px", display: "grid", gap: 6, fontSize: 12.5, color: "#7c2d12", background: "#fff7ed", borderTop: "1px solid #fed7aa" }}>
                      <span>Số lượng thực nhận khác số lượng đã xuất. Phần chênh lệch được giữ ở kho trung chuyển để xử lý (xuất kho khác hoặc kiểm kê).</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={receiveDialog.accept} onChange={(e) => setReceiveDialog({ ...receiveDialog, accept: e.target.checked })} />
                        Ghi nhận chênh lệch điều chuyển
                      </label>
                      <input aria-label="Lý do chênh lệch" placeholder="Lý do chênh lệch (bắt buộc)" value={receiveDialog.reason}
                        onChange={(e) => setReceiveDialog({ ...receiveDialog, reason: e.target.value })}
                        style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5 }} />
                    </div>
                  )}
                </div>
                <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 14px", borderTop: "1px solid #cbd5e1", background: "#f8fafc", flexShrink: 0 }}>
                  <button type="button" onClick={() => setReceiveDialog(null)} style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}>Hủy</button>
                  <button type="button" onClick={confirmReceive} style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Xác nhận đã nhận</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* UC-INV-04 AF01: THÊM NHANH ĐỐI TƯỢNG */}
        {showIssueModal && partyQuickAdd && (
          <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <form
              role="dialog"
              aria-label="Thêm đối tượng"
              onSubmit={(event) => { event.preventDefault(); saveQuickParty(); }}
              style={{ background: "#ffffff", borderRadius: 6, width: "min(480px, 100%)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)", border: "1px solid #cbd5e1", overflow: "hidden" }}
            >
              <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #cbd5e1" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Thêm đối tượng</h3>
                <button type="button" title="Đóng" onClick={() => setPartyQuickAdd(null)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
                {([
                  ["code", "Mã đối tượng *"], ["name", "Tên đối tượng *"],
                ] as const).map(([field, label]) => (
                  <label key={field} style={{ display: "grid", gap: 3, fontSize: 12, color: "#475569", gridColumn: field === "name" ? "1 / -1" : undefined }}>{label}
                    <input aria-label={label.replace(" *", "")} value={partyQuickAdd[field]} onChange={(e) => setPartyQuickAdd({ ...partyQuickAdd, [field]: e.target.value })}
                      style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none" }} />
                  </label>
                ))}
                <label style={{ display: "grid", gap: 3, fontSize: 12, color: "#475569", gridRow: 1, gridColumn: 2 }}>Loại đối tượng
                  <select aria-label="Loại đối tượng" value={partyQuickAdd.type} onChange={(e) => setPartyQuickAdd({ ...partyQuickAdd, type: e.target.value })}
                    style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12.5, background: "#ffffff" }}>
                    <option value="ORGANIZATION">Tổ chức</option>
                    <option value="INDIVIDUAL">Cá nhân</option>
                    <option value="HOUSEHOLD_BUSINESS">Hộ kinh doanh</option>
                  </select>
                </label>
                <label style={{ display: "grid", gap: 3, fontSize: 12, color: "#475569", gridColumn: "1 / -1" }}>Địa chỉ
                  <input aria-label="Địa chỉ đối tượng" value={partyQuickAdd.address} onChange={(e) => setPartyQuickAdd({ ...partyQuickAdd, address: e.target.value })}
                    style={{ height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none" }} />
                </label>
              </div>
              <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 14px", borderTop: "1px solid #cbd5e1", background: "#f8fafc" }}>
                <button type="button" onClick={() => setPartyQuickAdd(null)} style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={partyQuickAdd.saving} style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {partyQuickAdd.saving ? "Đang lưu..." : "Lưu đối tượng"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* UC-INV-04 AF05: CHỌN CHỨNG TỪ THAM CHIẾU */}
        {refPicker && (() => {
          const search = refPicker.search.trim().toLowerCase();
          const documents = [
            ...(apiRows.transactions || []).filter((row: any) => ![editingIssueId, editingTransferId].includes(row.id)).map((row: any) => ({
              id: row.id, number: row.number, date: row.transaction_date,
              kind: row.transaction_type === "RECEIPT" ? "Phiếu nhập kho" : row.transaction_type === "ISSUE" ? "Phiếu xuất kho" : row.transaction_type === "TRANSFER" ? "Chuyển kho" : "Chứng từ kho",
              description: row.reason || "",
            })),
            ...(apiRows.goodsSales || []).map((row: any) => ({ id: row.id, number: row.number, date: row.posting_date, kind: "Chứng từ bán hàng", description: row.customer_name || "" })),
          ].filter((row) => !search || `${row.number} ${row.description}`.toLowerCase().includes(search))
            .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 100);
          const cell = { padding: "6px 8px", borderRight: "1px solid #e2e8f0" } as const;
          return (
            <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div role="dialog" aria-label="Chọn chứng từ tham chiếu" style={{ background: "#ffffff", borderRadius: 6, width: "min(820px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)", border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #cbd5e1", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Chọn chứng từ tham chiếu</h3>
                  <button type="button" title="Đóng" onClick={() => setRefPicker(null)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>
                </div>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                  <input aria-label="Tìm chứng từ tham chiếu" autoFocus placeholder="Tìm theo số chứng từ hoặc diễn giải" value={refPicker.search}
                    onChange={(e) => setRefPicker({ ...refPicker, search: e.target.value })}
                    style={{ width: "100%", height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6" }}>
                        {["Số chứng từ", "Ngày", "Loại chứng từ", "Diễn giải"].map((title) => <th key={title} style={{ ...cell, textAlign: "left", fontWeight: 600 }}>{title}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((row) => (
                        <tr key={row.id} onClick={() => { (refPicker.target === "transfer" ? setTransferRefSearch : setIssueRefSearch)(String(row.number || "")); setRefPicker(null); }} style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer" }}>
                          <td style={{ ...cell, fontWeight: 600, color: "#0284c7" }}>{row.number}</td>
                          <td style={cell}>{toViDate(row.date)}</td>
                          <td style={cell}>{row.kind}</td>
                          <td style={cell}>{row.description}</td>
                        </tr>
                      ))}
                      {!documents.length && <tr><td colSpan={4} style={{ padding: 18, textAlign: "center", color: "#b45309" }}>Không tìm thấy chứng từ phù hợp</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* UC-INV-03: CHỌN CHỨNG TỪ BÁN HÀNG CẦN XUẤT KHO */}
        {showIssueModal && salePicker && (() => {
          const picked = salePicker.rows.find((sale: any) => sale.id === salePicker.saleId);
          const cell = { padding: "6px 8px", borderRight: "1px solid #e2e8f0" } as const;
          const head = { padding: "7px 8px", borderRight: "1px solid #cbd5e1", textAlign: "left" as const, fontWeight: 600 };
          const input = { height: 28, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 8px", fontSize: 12.5, outline: "none", boxSizing: "border-box" as const };
          const setFilter = (patch: Partial<SalePickerState>) => setSalePicker({ ...salePicker, ...patch });
          return (
            <div className="misa-modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
              <div role="dialog" aria-label="Chọn chứng từ bán hàng" style={{ background: "#ffffff", borderRadius: 6, width: "min(1100px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)", border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid #cbd5e1", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Chọn chứng từ bán hàng cần xuất kho</h3>
                  <button type="button" title="Đóng" onClick={() => setSalePicker(null)} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={18} /></button>
                </div>
                <form
                  onSubmit={(event) => { event.preventDefault(); searchSaleSources(salePicker); }}
                  style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, padding: "12px 14px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}
                >
                  <label style={{ fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>Số chứng từ
                    <input aria-label="Lọc số chứng từ" value={salePicker.number} onChange={(e) => setFilter({ number: e.target.value })} style={{ ...input, width: 150 }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>Khách hàng
                    <input aria-label="Lọc khách hàng" value={salePicker.customer} placeholder="Mã hoặc tên" onChange={(e) => setFilter({ customer: e.target.value })} style={{ ...input, width: 200 }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>Từ ngày
                    <input aria-label="Từ ngày" type="date" value={salePicker.from} onChange={(e) => setFilter({ from: e.target.value })} style={{ ...input, width: 140 }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#475569", display: "grid", gap: 3 }}>Đến ngày
                    <input aria-label="Đến ngày" type="date" value={salePicker.to} onChange={(e) => setFilter({ to: e.target.value })} style={{ ...input, width: 140 }} />
                  </label>
                  <button type="submit" disabled={salePicker.loading} style={{ height: 28, padding: "0 16px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                    <Search size={13} /> {salePicker.loading ? "Đang tìm..." : "Tìm kiếm"}
                  </button>
                </form>
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", color: "#1e293b" }}>
                        <th style={{ ...head, width: 36 }}></th>
                        <th style={head}>Số chứng từ</th>
                        <th style={head}>Ngày hạch toán</th>
                        <th style={head}>Khách hàng</th>
                        <th style={head}>Diễn giải</th>
                        <th style={{ ...head, borderRight: "none" }}>Tình trạng xuất kho</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salePicker.rows.map((sale: any) => (
                        <tr key={sale.id} onClick={() => setFilter({ saleId: sale.id, lineIds: sale.lines.filter((line: any) => Number(line.remaining_quantity) > 0).map((line: any) => line.id) })}
                          style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer", background: sale.id === salePicker.saleId ? "#ecfdf5" : "#ffffff" }}>
                          <td style={{ ...cell, textAlign: "center" }}><input type="radio" aria-label={`Chọn ${sale.number}`} readOnly checked={sale.id === salePicker.saleId} /></td>
                          <td style={{ ...cell, fontWeight: 600, color: "#0284c7" }}>{sale.number}</td>
                          <td style={cell}>{toViDate(sale.posting_date)}</td>
                          <td style={cell}>{sale.customer_code} · {sale.customer_name}</td>
                          <td style={cell}>{sale.description}</td>
                          <td style={{ ...cell, borderRight: "none" }}>{sale.issue_status_label}</td>
                        </tr>
                      ))}
                      {salePicker.searched && !salePicker.rows.length && (
                        <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#b45309" }}>Không tìm thấy chứng từ bán hàng phù hợp</td></tr>
                      )}
                    </tbody>
                  </table>
                  {picked && (
                    <>
                      <div style={{ padding: "10px 14px 6px", fontSize: 12.5, fontWeight: 700, color: "#1e293b", borderTop: "1px solid #cbd5e1" }}>
                        Hàng hóa của chứng từ {picked.number}
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#f1f5f9", color: "#1e293b" }}>
                            <th style={{ ...head, width: 36 }}>
                              <input type="checkbox" aria-label="Chọn tất cả hàng hóa"
                                checked={picked.lines.filter((line: any) => Number(line.remaining_quantity) > 0).every((line: any) => salePicker.lineIds.includes(line.id))}
                                onChange={(e) => setFilter({ lineIds: e.target.checked ? picked.lines.filter((line: any) => Number(line.remaining_quantity) > 0).map((line: any) => line.id) : [] })} />
                            </th>
                            <th style={head}>Mã hàng</th>
                            <th style={head}>Tên hàng</th>
                            <th style={head}>ĐVT</th>
                            <th style={{ ...head, textAlign: "right" }}>SL bán</th>
                            <th style={{ ...head, textAlign: "right" }}>SL đã xuất</th>
                            <th style={{ ...head, textAlign: "right", borderRight: "none" }}>SL còn được xuất</th>
                          </tr>
                        </thead>
                        <tbody>
                          {picked.lines.map((line: any) => {
                            const open = Number(line.remaining_quantity) > 0;
                            return (
                              <tr key={line.id} style={{ borderBottom: "1px solid #e2e8f0", color: open ? "#0f172a" : "#94a3b8" }}>
                                <td style={{ ...cell, textAlign: "center" }}>
                                  <input type="checkbox" aria-label={`Chọn hàng ${line.item_code}`} disabled={!open} title={open ? undefined : "Hàng hóa đã được xuất kho đầy đủ"}
                                    checked={salePicker.lineIds.includes(line.id)}
                                    onChange={(e) => setFilter({ lineIds: e.target.checked ? [...salePicker.lineIds, line.id] : salePicker.lineIds.filter((id) => id !== line.id) })} />
                                </td>
                                <td style={cell}>{line.item_code}</td>
                                <td style={cell}>{line.item_name}</td>
                                <td style={cell}>{line.uom_name}</td>
                                <td style={{ ...cell, textAlign: "right" }}>{Number(line.quantity)}</td>
                                <td style={{ ...cell, textAlign: "right" }}>{Number(line.issued_quantity)}</td>
                                <td style={{ ...cell, textAlign: "right", borderRight: "none", fontWeight: 600 }}>{open ? Number(line.remaining_quantity) : "Đã xuất đủ"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
                <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "0 14px", borderTop: "1px solid #cbd5e1", background: "#f8fafc", flexShrink: 0 }}>
                  <button type="button" onClick={() => setSalePicker(null)} style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}>Hủy</button>
                  <button type="button" disabled={!picked}
                    onClick={() => { if (picked && applySaleSelection(picked, salePicker.lineIds)) setSalePicker(null); }}
                    style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: picked ? "#00a862" : "#94a3b8", color: "#ffffff", fontWeight: 600, fontSize: 13, cursor: picked ? "pointer" : "default" }}>
                    Đồng ý
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
                  {apiConnected && <span data-testid="transfer-status"
                    style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                      background: editingTransferStatus === "POSTED" ? "#dcfce7" : "#f1f5f9", color: editingTransferStatus === "POSTED" ? "#15803d" : "#475569" }}>
                    {editingTransferStatus ? ISSUE_STATUS_LABELS[editingTransferStatus] || editingTransferStatus : "Chứng từ mới"}
                    {transferReceipt && ` · ${TRANSFER_RECEIPT_LABELS[transferReceipt]}`}
                  </span>}
                  {apiConnected && <>
                    <datalist id="transfer-parties">
                      {(apiRows.parties || []).filter((party: any) => party.status === "ACTIVE").map((party: any) => <option key={party.id} value={party.code}>{party.name}</option>)}
                    </datalist>
                    <datalist id="transfer-items">
                      {(apiRows.items || []).filter((item: any) => item.status === "ACTIVE" && item.track_inventory).map((item: any) => <option key={item.id} value={item.code}>{item.name}</option>)}
                    </datalist>
                    <datalist id="transfer-accounts">
                      {(apiRows.accounts || []).filter((account: any) => account.status === "ACTIVE" && account.is_postable && String(account.code).startsWith("15")).map((account: any) => <option key={account.id} value={account.code}>{account.name}</option>)}
                    </datalist>
                  </>}

                  {/* Search box for order reference */}
                  <div style={{ position: "relative", width: 260, display: "flex", alignItems: "center", marginLeft: 8 }}>
                    <div style={{ position: "absolute", left: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
                      <Settings size={13} style={{ cursor: "pointer" }} />
                    </div>
                    <input
                      type="text"
                      value={transferRefSearch}
                      aria-label="Tham chiếu chuyển kho"
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
                  <button type="button" title="Đóng" onClick={closeTransferModal} style={{ width: 28, height: 28, border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}>
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
                        const nextKind = TRANSFER_KIND_CODES[type];
                        const crossesConsignment = (nextKind === "CONSIGNMENT") !== (transferKind === "CONSIGNMENT");
                        setTransferType(type);
                        if (nextKind === "CONSIGNMENT") setTransferInTransit(false);
                        // BR16/BR21: TK 157 only for goods sent to an agent, whose destination is a consignment store.
                        setTransferRows((prev) => prev.map((row) => ({ ...row,
                          debitAcc: nextKind === "CONSIGNMENT" ? row.debitAcc || "157" : row.debitAcc === "157" ? "" : row.debitAcc,
                          destWarehouse: crossesConsignment ? "" : row.destWarehouse,
                          destWarehouseAddress: crossesConsignment ? "" : row.destWarehouseAddress })));
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
                              aria-label="Về việc"
                              onChange={(e) => setTransferPurpose(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
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
                                aria-label="Mã đơn vị nhận"
                                list={apiConnected ? "transfer-parties" : undefined}
                                onChange={(e) => lookupTransferParty(e.target.value, setTransferReceiverUnitCode, setTransferReceiverUnitName, setTransferReceiverUnitTax)}
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
                                aria-label="Mã người vận chuyển"
                                list={apiConnected ? "transfer-parties" : undefined}
                                onChange={(e) => lookupTransferParty(e.target.value, setTransferTransporterCode, setTransferTransporterName)}
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
                              aria-label="Tên người vận chuyển"
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
                          <button type="button" aria-label="Chọn chứng từ tham chiếu chuyển kho" disabled={transferReadOnly}
                            onClick={() => setRefPicker({ search: "", target: "transfer" })}
                            style={{ border: "none", background: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</button>
                          {transferRefSearch && <span style={{ color: "#0f172a", fontWeight: 600 }}>{transferRefSearch}</span>}
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
                                aria-label="Mã đại lý"
                                list={apiConnected ? "transfer-parties" : undefined}
                                onChange={(e) => lookupTransferParty(e.target.value, setTransferAgentCode, setTransferAgentName, setTransferAgentTax)}
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
                                aria-label="Mã người vận chuyển"
                                list={apiConnected ? "transfer-parties" : undefined}
                                onChange={(e) => lookupTransferParty(e.target.value, setTransferTransporterCode, setTransferTransporterName)}
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
                              aria-label="Tên người vận chuyển"
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
                              aria-label="Diễn giải"
                              onChange={(e) => setTransferExplanation(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
                              <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        {/* Row 6: Tham chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <span>Tham chiếu</span>
                          <button type="button" aria-label="Chọn chứng từ tham chiếu chuyển kho" disabled={transferReadOnly}
                            onClick={() => setRefPicker({ search: "", target: "transfer" })}
                            style={{ border: "none", background: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</button>
                          {transferRefSearch && <span style={{ color: "#0f172a", fontWeight: 600 }}>{transferRefSearch}</span>}
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
                                aria-label="Mã người vận chuyển"
                                list={apiConnected ? "transfer-parties" : undefined}
                                onChange={(e) => lookupTransferParty(e.target.value, setTransferTransporterCode, setTransferTransporterName)}
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
                              aria-label="Tên người vận chuyển"
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
                              aria-label="Diễn giải"
                              onChange={(e) => setTransferExplanation(e.target.value)}
                              style={{ flex: 1, border: "none", fontSize: 12, outline: "none" }}
                            />
                            <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
                              <Sparkles size={13} style={{ color: "#a855f7", cursor: "pointer" }} />
                            </span>
                          </div>
                        </div>

                        {/* Row 3: Tham chiếu */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 2 }}>
                          <span>Tham chiếu</span>
                          <button type="button" aria-label="Chọn chứng từ tham chiếu chuyển kho" disabled={transferReadOnly}
                            onClick={() => setRefPicker({ search: "", target: "transfer" })}
                            style={{ border: "none", background: "none", padding: 0, color: "#0284c7", cursor: "pointer", fontWeight: 700 }}>...</button>
                          {transferRefSearch && <span style={{ color: "#0f172a", fontWeight: 600 }}>{transferRefSearch}</span>}
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
                        <strong data-testid="transfer-total" style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{formatVND(transferRows.reduce((sum, row) => sum + (row.amount || 0), 0))}</strong>
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
                        <strong data-testid="transfer-total" style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{formatVND(transferRows.reduce((sum, row) => sum + (row.amount || 0), 0))}</strong>
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
                    onClick={() => notify("Sổ Việt AI đang kiểm tra hồ sơ chuyển kho...")}
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
                          "Đơn giá"
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
                            aria-label={`Mã hàng dòng ${idx + 1}`}
                            list={apiConnected ? "transfer-items" : undefined}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = SAMPLE_INVENTORY_ITEMS.find((it) => it.code.toLowerCase() === val.toLowerCase());
                              const apiItem = apiConnected ? itemByCode(val) : null;
                              setTransferRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        itemCode: val,
                                        ...(apiConnected
                                          ? (() => {
                                              // Step 14 / BR09: suggested book value of the item in the source warehouse.
                                              const price = apiItem ? averageCost(apiItem.id, warehouseByName(r.sourceWarehouse)?.id) : r.price;
                                              return { itemName: apiItem ? apiItem.name : r.itemName, unit: apiItem ? apiUnitName(apiRows.units, apiItem.base_uom) : r.unit,
                                                price, amount: price * r.qty };
                                            })()
                                          : {
                                              itemName: matched ? matched.name : r.itemName,
                                              unit: matched ? matched.unit : r.unit,
                                              sourceWarehouse: matched ? "Kho tổng Minh An" : r.sourceWarehouse,
                                              destWarehouse: matched ? "Kho Nguyên vật liệu" : r.destWarehouse,
                                              price: matched ? matched.price || 0 : r.price,
                                              amount: matched ? (matched.price || 0) * r.qty : r.amount,
                                            }),
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
                            aria-label={`Xuất tại kho dòng ${idx + 1}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matchedWh = SAMPLE_WAREHOUSES.find((w) => w.name === val);
                              const price = apiConnected ? averageCost(itemByCode(row.itemCode)?.id, warehouseByName(val)?.id) : null;
                              setTransferRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, sourceWarehouse: val,
                                  sourceWarehouseAddress: apiConnected ? warehouseAddress(val) : matchedWh?.address || "",
                                  ...(price === null ? {} : { price, amount: price * r.qty }) } : r))
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho xuất --</option>
                            {(apiConnected ? transferWarehouses("source") : SAMPLE_WAREHOUSES).map((w: any) => (
                              <option key={w.code} value={w.name}>{w.name}</option>
                            ))}
                          </select>
                          {apiConnected && row.sourceWarehouse && row.itemCode && (() => {
                            const stock = availableStock(itemByCode(row.itemCode)?.id, warehouseByName(row.sourceWarehouse)?.id);
                            return <div style={{ fontSize: 11, color: stock < row.qty ? "#dc2626" : "#64748b", paddingLeft: 4 }}>Tồn khả dụng: {stock}</div>;
                          })()}
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
                            aria-label={`Nhập tại kho dòng ${idx + 1}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matchedWh = SAMPLE_WAREHOUSES.find((w) => w.name === val);
                              setTransferRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, destWarehouse: val, destWarehouseAddress: apiConnected ? warehouseAddress(val) : matchedWh?.address || "" } : r))
                              );
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, padding: "0 2px", fontSize: 12, background: "transparent", outline: "none" }}
                          >
                            <option value="">-- Kho nhập --</option>
                            {(apiConnected ? transferWarehouses("destination") : SAMPLE_WAREHOUSES).map((w: any) => (
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
                                aria-label={`TK Nợ dòng ${idx + 1}`}
                                list={apiConnected ? "transfer-accounts" : undefined}
                                placeholder={transferKind === "CONSIGNMENT" ? "157" : ""}
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
                                aria-label={`TK Có dòng ${idx + 1}`}
                                list={apiConnected ? "transfer-accounts" : undefined}
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
                            aria-label={`Số lượng chuyển dòng ${idx + 1}`}
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
                            aria-label={`Đơn giá chuyển dòng ${idx + 1}`}
                            readOnly={apiConnected && Boolean(itemByCode(row.itemCode)) && itemByCode(row.itemCode)?.valuation_method !== "SPECIFIC"}
                            title={apiConnected ? "Đơn giá điều chuyển theo giá trị ghi sổ (phương pháp tính giá xuất kho); giá chính thức được xác định khi ghi sổ" : undefined}
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
                            debitAcc: transferKind === "CONSIGNMENT" ? "157" : "",
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
                            debitAcc: transferKind === "CONSIGNMENT" ? "157" : "",
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
                      onClick={() => apiConnected ? setShowTransferNote(true) : notify("Đã thêm dòng ghi chú kế toán")}
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

                {/* AF16: goods that are not received at once wait in the transit warehouse until the receiving store confirms. */}
                {apiConnected && transferKind !== "CONSIGNMENT" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer", marginTop: 2 }}>
                    <input type="checkbox" checked={transferInTransit} disabled={transferReadOnly} onChange={(e) => setTransferInTransit(e.target.checked)} />
                    <span>Có thời gian vận chuyển (theo dõi hàng đang vận chuyển, kho nhận xác nhận khi nhận hàng)</span>
                  </label>
                )}
                {/* AF10: a note on the voucher; it is not counted in quantities or values. */}
                {showTransferNote && (
                  <label style={{ display: "grid", gap: 3, fontSize: 12, color: "#475569", marginTop: 2 }}>Ghi chú
                    <textarea aria-label="Ghi chú chuyển kho" value={transferNote} disabled={transferReadOnly} onChange={(e) => setTransferNote(e.target.value)} rows={2}
                      style={{ border: "1px solid #cbd5e1", borderRadius: 3, padding: "4px 8px", fontSize: 12.5, fontFamily: "inherit", resize: "vertical" }} />
                  </label>
                )}
              </div>

              {/* ATTACHMENT SECTION (AF11 / EF19) */}
              <VoucherAttachments inputId="transfer-attachment-input" files={transferFiles} attachments={transferAttachments} readOnly={apiConnected && transferReadOnly}
                onAdd={(list) => addVoucherFiles(list, setTransferFiles)} onRemoveFile={(index) => setTransferFiles((files) => files.filter((_, i) => i !== index))}
                onDownload={(entry) => downloadAttachment(editingTransferId, entry)} onRemove={(entry) => removeAttachment(editingTransferId, entry, setTransferAttachments)} />

              {/* BOTTOM FOOTER BAR */}
              <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", flexShrink: 0 }}>
                {/* Left: Hiển thị tài khoản toggle */}
                <label
                  role="switch"
                  aria-checked={transferShowAccounts}
                  onClick={() => setTransferShowAccounts(!transferShowAccounts)}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#334155", cursor: "pointer" }}
                >
                  <div
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

                {/* Right: Actions Hủy, In lại, Xác nhận nhận hàng, Cất, Cất và In */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeTransferModal}
                    style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#334155", fontSize: 13, cursor: "pointer" }}
                  >
                    Hủy
                  </button>

                  {apiConnected && transferRecord?.status === "POSTED" && (
                    <button type="button" onClick={() => printTransferVoucher(transferRecord, transferPrintTemplate)}
                      style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontSize: 13, cursor: "pointer" }}>
                      In lại
                    </button>
                  )}
                  {apiConnected && transferReceipt === "IN_TRANSIT" && (
                    <button type="button" onClick={openReceiveDialog}
                      style={{ height: 32, padding: "0 16px", border: "1px solid #0284c7", borderRadius: 4, background: "#eff6ff", color: "#0369a1", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                      Xác nhận nhận hàng
                    </button>
                  )}

                  {/* Step 17: "Cất" saves and posts the transfer in one step. */}
                  <button
                    type="button"
                    disabled={apiConnected && transferLocked}
                    onClick={() => handleSaveTransfer(transferFormData())}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >{apiConnected ? "Cất" : "Lưu"}</button>

                  <div style={{ display: "flex", position: "relative" }}>
                    <button
                      type="button"
                      disabled={apiConnected && transferLocked}
                      onClick={() => {
                        handleSaveTransfer(transferFormData(), true, apiConnected ? transferPrintTemplate : undefined);
                        if (!apiConnected) notify(`Đã lưu và chuyển sang chế độ in chứng từ chuyển kho ${transferVoucherCode}`);
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
                      {apiConnected ? "Cất và In" : "Lưu và In"}
                    </button>
                    <button
                      type="button"
                      aria-label="Chọn mẫu in chuyển kho"
                      aria-expanded={showTransferPrintMenu}
                      onClick={() => setShowTransferPrintMenu((open) => !open)}
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
                    {showTransferPrintMenu && (
                      <div role="menu" aria-label="Mẫu in chứng từ chuyển kho" style={{ position: "absolute", right: 0, bottom: 38, minWidth: 320, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, boxShadow: "0 10px 25px rgba(15,23,42,0.18)", padding: 4, zIndex: 5 }}>
                        {TRANSFER_PRINT_TEMPLATES.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              // AF13: choosing a template prints with it (Cất và In, or a reprint of a posted voucher).
                              setTransferPrintTemplate(template.id);
                              setShowTransferPrintMenu(false);
                              if (transferRecord?.status === "POSTED") printTransferVoucher(transferRecord, template.id);
                              else handleSaveTransfer(transferFormData(), true, apiConnected ? template.id : undefined);
                            }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderRadius: 3, background: template.id === transferPrintTemplate ? "#ecfdf5" : "transparent", color: "#0f172a", fontSize: 12.5, cursor: "pointer" }}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 4: TÍNH GIÁ XUẤT KHO */}
        {showCalculateCostModal && <MisaInventoryCostingModal period={_period} notify={notify}
          onClose={() => setShowCalculateCostModal(false)} />}

        {/* MODAL 5: BIÊN BẢN KIỂM KÊ KHO */}
        {showStocktakeModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", zIndex: 9999, display: "grid", placeItems: "center" }}>
            <div style={{ background: "#ffffff", borderRadius: 6, width: 860, maxWidth: "96vw", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ClipboardCheck size={18} style={{ color: "#00a862" }} />
                  <strong style={{ fontSize: 15, color: "#1e293b" }}>Biên bản kiểm kê kho {selectedCount?.number || "mới"}</strong>
                </div>
                <button type="button" onClick={() => setShowStocktakeModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
              </div>

              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Kho kiểm kê</label>
                    <select disabled={!!selectedCount} value={selectedCount?.warehouse || selectedStocktakeWarehouse} onChange={(event) => { setStocktakeWarehouse(event.target.value); setStocktakeActuals({}); }} style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box", background: "#ffffff" }}>
                      <option value="">Chọn kho</option>
                      {stocktakeWarehouseOptions.map((w) => (
                        <option key={w.code} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Ngày kiểm kê</label>
                    <input readOnly={!!selectedCount} value={selectedCount ? apiDate(selectedCount.count_date) : stocktakeDate} onChange={(event) => setStocktakeDate(event.target.value)} style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Mục đích</label>
                    <input readOnly={!!selectedCount} value={selectedCount ? selectedCount.notes || "" : stocktakePurpose} onChange={(event) => setStocktakePurpose(event.target.value)} style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, boxSizing: "border-box" }} />
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
                      {(selectedCount ? (selectedCount.lines || []).map((line: any) => ({
                        id: line.id, code: (apiRows.items || []).find((item: any) => item.id === line.item)?.code || "",
                        name: (apiRows.items || []).find((item: any) => item.id === line.item)?.name || "",
                        unit: apiUnitName(apiRows.units, (apiRows.items || []).find((item: any) => item.id === line.item)?.base_uom),
                        stock: apiNumber(line.system_quantity), actual: apiNumber(line.actual_quantity),
                      })) : stocktakeDisplayItems).map((it: any) => (
                        <tr key={it.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{it.code}</td>
                          <td style={{ padding: "6px 8px" }}>{it.name}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>{it.unit}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{it.stock}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}><input type="number" min="0" readOnly={!!selectedCount} value={selectedCount ? (it as any).actual : stocktakeActuals[it.id] ?? it.stock} onChange={(event) => setStocktakeActuals((previous) => ({ ...previous, [it.id]: Number(event.target.value) }))} style={{ width: 75, textAlign: "right", border: "1px solid #cbd5e1", borderRadius: 4 }} /></td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#16a34a" }}>{(selectedCount ? (it as any).actual : stocktakeActuals[it.id] ?? it.stock) - it.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                  <button type="button" onClick={() => setShowStocktakeModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: "pointer" }}>Đóng</button>
                  {selectedCount?.status === "DRAFT" && <button type="button" onClick={() => { void apiSave(async (writer) => {
                    await writer.post(`/api/v1/inventory/counts/${selectedCountId}/confirm/`, {});
                    return { message: "Đã xác nhận biên bản kiểm kê." };
                  }); }} style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>Xác nhận biên bản</button>}
                  {selectedCount && ["COUNTED", "ADJUSTED"].includes(selectedCount.status) && <button type="button" onClick={() => { setShowStocktakeModal(false); openCountResolution(); }} style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>Xử lý chênh lệch</button>}
                  {!selectedCount && <button type="button" onClick={() => { void handleSaveStocktake(); }} style={{ height: 32, padding: "0 20px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontWeight: 600, cursor: "pointer" }}>Lưu biên bản</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {showCountResolution && selectedCount && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", zIndex: 10000, display: "grid", placeItems: "center" }}>
            <div style={{ width: 980, maxWidth: "96vw", maxHeight: "92vh", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 6, boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "#1e293b" }}>Xử lý chênh lệch kiểm kê · {selectedCount.number}</strong>
                <button type="button" onClick={() => setShowCountResolution(false)} style={{ border: 0, background: "transparent", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 18, overflow: "auto", fontSize: 12.5 }}>
                <div style={{ marginBottom: 12, color: "#475569" }}>Kho: {(apiRows.warehouses || []).find((row: any) => row.id === selectedCount.warehouse)?.name || ""} · Ngày kiểm kê: {apiDate(selectedCount.count_date)}. Số liệu kiểm kê đã xác nhận chỉ đọc.</div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                  <thead style={{ background: "#e6f4ea" }}><tr>{["Mã hàng", "Tên hàng", "SL sổ sách", "SL thực tế", "Chênh lệch", "Đã phân bổ", "Còn lại", ""].map((heading) => <th key={heading} style={{ padding: 8, textAlign: "left" }}>{heading}</th>)}</tr></thead>
                  <tbody>{(selectedCount.lines || []).filter((line: any) => apiNumber(line.variance_quantity) !== 0).map((line: any) => {
                    const item = (apiRows.items || []).find((row: any) => row.id === line.item);
                    const remaining = Math.abs(apiNumber(line.variance_quantity)) - countLineResolved(line.id);
                    return <tr key={line.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: 8 }}>{item?.code}</td><td>{item?.name}</td>
                      <td>{apiNumber(line.system_quantity)}</td><td>{apiNumber(line.actual_quantity)}</td>
                      <td>{apiNumber(line.variance_quantity)}</td><td>{countLineResolved(line.id)}</td><td>{remaining}</td>
                      <td>{remaining > 0 && selectedCount.status === "COUNTED" && <button type="button" onClick={() => { setEditingResolutionId(""); setSelectedCountLineId(line.id); setResolutionQuantity(remaining); setResolutionCause(apiNumber(line.variance_quantity) > 0 ? "SURPLUS" : "OTHER"); }} style={{ border: "1px solid #00a862", color: "#008c52", background: "white", borderRadius: 4, cursor: "pointer" }}>Lập phương án</button>}</td>
                    </tr>;
                  })}</tbody>
                </table>
                {selectedCountLine && selectedCount.status === "COUNTED" && <div style={{ background: "#f8fafc", padding: 12, border: "1px solid #e2e8f0", borderRadius: 4, marginBottom: 18 }}>
                  <strong>{editingResolutionId ? "Sửa phương án" : "Phương án mới"} · {(apiRows.items || []).find((row: any) => row.id === selectedCountLine.item)?.code} · {apiNumber(selectedCountLine.variance_quantity) > 0 ? "Điều chỉnh tăng" : "Điều chỉnh giảm"}</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
                    <label>Nguyên nhân<select value={resolutionCause} onChange={(e) => setResolutionCause(e.target.value)} style={{ display: "block", width: "100%", height: 30 }}>
                      {(apiNumber(selectedCountLine.variance_quantity) > 0 ? [["SURPLUS", "Hàng thừa chưa ghi nhận"], ["OTHER", "Nguyên nhân khác"]] : [["OTHER", "Nguyên nhân khác"]]).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select></label>
                    <label>Số lượng xử lý<input type="number" min="0.0001" value={resolutionQuantity} onChange={(e) => setResolutionQuantity(Number(e.target.value))} style={{ display: "block", width: "100%", height: 30 }} /></label>
                    <label>Đơn giá đề xuất<input type="number" min="0" value={resolutionPrice} onChange={(e) => setResolutionPrice(Number(e.target.value))} style={{ display: "block", width: "100%", height: 30 }} /></label>
                    <label style={{ gridColumn: "span 2" }}>Diễn giải nguyên nhân<input value={resolutionExplanation} onChange={(e) => setResolutionExplanation(e.target.value)} style={{ display: "block", width: "100%", height: 30 }} /></label>
                    <label>Căn cứ xác định giá trị<input value={resolutionBasis} onChange={(e) => setResolutionBasis(e.target.value)} style={{ display: "block", width: "100%", height: 30 }} /></label>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>Giá trị dự kiến: {(resolutionQuantity * resolutionPrice).toLocaleString("vi-VN")} đ</span><button type="button" onClick={() => { void saveResolution(); }} style={{ background: "#00a862", color: "#fff", border: 0, borderRadius: 4, padding: "7px 14px", cursor: "pointer" }}>Lưu phương án</button></div>
                </div>}
                <strong>Các phương án đã lập</strong>
                {countResolutions.length === 0 && <p style={{ color: "#64748b" }}>Chưa có phương án xử lý.</p>}
                {countResolutions.map((row: any) => {
                  const item = (apiRows.items || []).find((entry: any) => entry.id === (selectedCount.lines || []).find((line: any) => line.id === row.count_line)?.item);
                  const voucher = (apiRows.transactions || []).find((entry: any) => entry.id === row.adjustment_transaction);
                  return <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 4, padding: 10, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span><b>{item?.code}</b> · {row.method === "INCREASE" ? "Tăng" : "Giảm"} {apiNumber(row.quantity)} · {row.explanation}</span><b style={{ color: "#008c52" }}>{({ DRAFT: "Nháp", PENDING: "Chờ phê duyệt", NEEDS_INFO: "Cần bổ sung", APPROVED: "Đã phê duyệt", REJECTED: "Từ chối", COMPLETED: "Đã xử lý" } as Record<string, string>)[row.status] || row.status}</b></div>
                    {row.decision_note && <div style={{ color: "#b45309", marginTop: 5 }}>Ý kiến duyệt: {row.decision_note}</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {["DRAFT", "NEEDS_INFO"].includes(row.status) && <><button type="button" onClick={() => {
                        setEditingResolutionId(row.id); setSelectedCountLineId(row.count_line); setResolutionCause(row.reason_code);
                        setResolutionExplanation(row.explanation); setResolutionQuantity(apiNumber(row.quantity));
                        setResolutionPrice(apiNumber(row.proposed_unit_cost)); setResolutionBasis(row.valuation_basis || "");
                      }}>Sửa phương án</button><button type="button" onClick={() => { void runResolutionAction(row.id, "submit"); }}>Gửi phê duyệt</button></>}
                      {row.status === "PENDING" && <><button type="button" onClick={() => { void runResolutionAction(row.id, "approve"); }}>Phê duyệt</button><button type="button" onClick={() => { const note = window.prompt("Lý do từ chối"); if (note) void runResolutionAction(row.id, "reject", { note }); }}>Từ chối</button><button type="button" onClick={() => { const note = window.prompt("Nội dung cần bổ sung"); if (note) void runResolutionAction(row.id, "request-info", { note }); }}>Yêu cầu bổ sung</button></>}
                      {row.status === "APPROVED" && !row.adjustment_transaction && <button type="button" onClick={() => setSelectedResolutionId(row.id)}>Lập chứng từ điều chỉnh</button>}
                      {row.status === "APPROVED" && voucher?.status === "DRAFT" && <button type="button" onClick={() => { void runResolutionAction(row.id, "post-voucher"); }}>Ghi sổ {voucher.number}</button>}
                      {voucher && <span style={{ color: "#64748b" }}>Chứng từ {voucher.number}: {voucher.status}</span>}
                    </div>
                    {selectedResolutionId === row.id && !row.adjustment_transaction && <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "end" }}>
                      <label>Ngày hạch toán<input type="date" value={resolutionVoucherDate} onChange={(e) => setResolutionVoucherDate(e.target.value)} style={{ display: "block" }} /></label>
                      <label>TK Nợ<input list="count-resolution-accounts" value={resolutionDebit} onChange={(e) => setResolutionDebit(e.target.value)} style={{ display: "block", width: 100 }} /></label>
                      <label>TK Có<input list="count-resolution-accounts" value={resolutionCredit} onChange={(e) => setResolutionCredit(e.target.value)} style={{ display: "block", width: 100 }} /></label>
                      <datalist id="count-resolution-accounts">{(apiRows.accounts || []).filter((account: any) => account.status === "ACTIVE" && account.is_postable).map((account: any) => <option key={account.id} value={account.code}>{account.name}</option>)}</datalist>
                      <button type="button" onClick={() => { void createResolutionVoucher(row.id); }}>Cất chứng từ</button>
                    </div>}
                  </div>;
                })}
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
                onClick={() => notify("Sổ Việt AI: Trợ lý lệnh sản xuất")}
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
                          <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
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

                {/* Right: Actions Hủy, Cất, Lưu và In */}
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
                      if (apiConnected) {
                        void apiSave((writer) => saveProductionOrder(writer, { code: prodOrderCode, date: prodOrderDate, status: prodOrderStatus, description: prodOrderDescription, products: prodOrderProductRows, materials: prodOrderMaterialRows }))
                          .then((saved) => { if (saved) setShowProductionOrderModal(false); });
                        return;
                      }
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
                      notify(`Đã lưu thành công Lệnh sản xuất ${vCode}`);
                    }}
                    style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                  >Lưu</button>

                  <div style={{ display: "flex" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (apiConnected) {
                          void apiSave((writer) => saveProductionOrder(writer, { code: prodOrderCode, date: prodOrderDate, status: prodOrderStatus, description: prodOrderDescription, products: prodOrderProductRows, materials: prodOrderMaterialRows }))
                            .then((saved) => { if (saved) setShowProductionOrderModal(false); });
                          return;
                        }
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
                        notify(`Đã lưu và chuyển sang chế độ in Lệnh sản xuất ${vCode}`);
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
                      Lưu và In
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
                onClick={() => notify("Sổ Việt AI: Trợ lý lắp ráp")}
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
                          <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
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
                                  const matched = assemblyCatalog.find((it) => it.code.toLowerCase() === val.toLowerCase());
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
                                  if (!apiConnected && matched && (!assemblyComponentRows[0].itemCode || !assemblyComponentRows[1].itemCode)) {
                                    setAssemblyComponentRows([
                                      { id: "lk-1", itemCode: "VO-CS-NT", description: "Vỏ tủ composite ngoài trời 600x400x250", warehouse: "Kho Nguyên vật liệu", qty: 1 },
                                      { id: "lk-2", itemCode: "MCCB-100A", description: "Aptomat khối MCCB 3P 100A Mitsubishi", warehouse: "Kho Nguyên vật liệu", qty: 1 },
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
                          <th style={{ width: 80, padding: "8px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
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
                                  const matched = assemblyCatalog.find((it) => it.code.toLowerCase() === val.toLowerCase());
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
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input type="number" min="0.001" step="any" value={row.qty}
                                onChange={(e) => setAssemblyComponentRows((prev) => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 0 } : r))}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12 }} />
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
                          { id: `lk-${Date.now()}`, itemCode: "", description: "", warehouse: "Kho Nguyên vật liệu", qty: 1 },
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
                          { id: `lk-${Date.now()}`, itemCode: "", description: "", warehouse: "Kho Nguyên vật liệu", qty: 1 },
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
                  onClick={() => { void handleSaveAssembly("ASSEMBLE"); }}
                  style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >Lưu</button>

                <div style={{ display: "flex" }}>
                  <button
                    type="button"
                    onClick={() => { void handleSaveAssembly("ASSEMBLE", true); }}
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
                    Lưu và In
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
                onClick={() => notify("Sổ Việt AI: Trợ lý tháo dỡ")}
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
                          <span title="Sổ Việt AI gợi ý diễn giải" style={{ display: "inline-flex" }}>
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
                                  const matched = assemblyCatalog.find((it) => it.code.toLowerCase() === val.toLowerCase());
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
                                  if (!apiConnected && matched && (!disassemblyOutputRows[0].itemCode || !disassemblyOutputRows[1].itemCode)) {
                                    setDisassemblyOutputRows([
                                      { id: "tp-1", itemCode: "DYNAMO-150KVA", itemName: "Đầu phát điện Stamford 150kVA cũ còn tốt", unit: "Cái", qty: 1 },
                                      { id: "tp-2", itemCode: "PANNEL-DSE", itemName: "Bảng điều khiển DeepSea DSE7320", unit: "Bộ", qty: 1 },
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
                          <th style={{ width: 80, padding: "8px 4px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số lượng</th>
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
                                  const matched = assemblyCatalog.find((it) => it.code.toLowerCase() === val.toLowerCase());
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
                            <td style={{ padding: "4px 4px", borderRight: "1px solid #e2e8f0" }}>
                              <input type="number" min="0.001" step="any" value={row.qty}
                                onChange={(e) => setDisassemblyOutputRows((prev) => prev.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) || 0 } : r))}
                                style={{ width: "100%", height: 26, border: "1px solid transparent", textAlign: "right", borderRadius: 3, padding: "0 4px", fontSize: 12 }} />
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
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1 },
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
                          { id: `tp-${Date.now()}`, itemCode: "", itemName: "", unit: "", qty: 1 },
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
                  onClick={() => { void handleSaveAssembly("DISASSEMBLE"); }}
                  style={{ height: 32, padding: "0 20px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", color: "#0f172a", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                >Lưu</button>

                <div style={{ display: "flex" }}>
                  <button
                    type="button"
                    onClick={() => { void handleSaveAssembly("DISASSEMBLE", true); }}
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
                    Lưu và In
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

        {/* DRAWER & MODAL: Hàng hóa, dịch vụ chuẩn MISA */}
        {showNatureDrawer && (
          <MisaItemNatureDrawer
            isOpen={showNatureDrawer}
            onClose={() => setShowNatureDrawer(false)}
            onSelectNature={handleSelectNature}
            notify={notify}
          />
        )}

        {showItemModal && (
          <MisaInventoryItemModal
            isOpen={showItemModal}
            onClose={() => {
              setShowItemModal(false);
              setEditingItem(null);
            }}
            initialNature={selectedNature}
            editingItem={editingItem}
            onSubmit={handleSaveInventoryItem}
            onChangeNature={() => {
              setShowItemModal(false);
              setShowNatureDrawer(true);
            }}
            notify={notify}
          />
        )}

        {/* MODAL: Xem báo cáo */}
        {previewReportTitle === "Tổng hợp tồn kho" && <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}>
          <div style={{ width: "min(1200px, 96vw)", height: "min(780px, 92vh)", background: "white", borderRadius: 6, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
            <MisaInventorySummaryReport embedded onBack={() => setPreviewReportTitle(null)} notify={notify} />
          </div>
        </div>}
        {previewReportTitle === "Tổng hợp nhập xuất tồn trên nhiều kho" && <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}>
          <div style={{ width: "min(1200px, 96vw)", height: "min(780px, 92vh)", background: "white", borderRadius: 6, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
            <MisaInventoryMultiWarehouseReport embedded initialPeriod={_period} onBack={() => setPreviewReportTitle(null)} />
          </div>
        </div>}
        {previewReportTitle === "Sổ chi tiết vật tư hàng hóa" && <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}>
          <div style={{ width: "min(1400px, 98vw)", height: "min(850px, 94vh)", background: "white", borderRadius: 6, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
            <MisaInventoryDetailLedgerReport embedded initialPeriod={_period} onBack={() => setPreviewReportTitle(null)} />
          </div>
        </div>}
        {previewReportTitle && previewReportTitle !== "Sổ chi tiết vật tư hàng hóa" && previewReportTitle !== "Tổng hợp tồn kho" && previewReportTitle !== "Tổng hợp nhập xuất tồn trên nhiều kho" && (
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
                <span style={{ fontSize: 12, color: "#64748b" }}>Trích xuất theo chuẩn kế toán & TT 99/2025/TT-BTC</span>
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
