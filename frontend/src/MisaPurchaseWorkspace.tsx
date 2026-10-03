import { useState, useRef } from "react";
import {
  Search,
  RefreshCw,
  Sparkles,
  Plus,
  Building2,
  Package,
  FileCheck,
  CreditCard,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Filter,
  Printer,
  FileSpreadsheet,
  Columns3,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  PurchaseOrderModal,
  PurchaseContractModal,
  PurchaseVoucherModal,
  PurchaseReturnModal,
  PurchaseDiscountModal,
  ReconciliationPeriodModal,
  SupplierModal,
  ReceiveInvoiceSelectModal,
  PurchaseServiceModal,
  PurchaseMultiInvoiceModal,
  type UninvoicedVoucher,
  SAMPLE_SUPPLIERS,
  formatVND,
} from "./MisaPurchaseModals";
import { AIAssistantModal, SupplierPaymentModal } from "./MisaCashWorkspace";
import "./misa-cash.css";

export default function MisaPurchaseWorkspace({
  company: _company = { id: "minh-an", name: "Công ty Cổ phần Minh An" },
  period: _period = "2026-09",
  tab = "process",
  href,
  notify,
}: {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
}) {
  // Modal states
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showSupplierPaymentModal, setShowSupplierPaymentModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showReceiveInvoiceModal, setShowReceiveInvoiceModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showMultiInvoiceModal, setShowMultiInvoiceModal] = useState(false);
  const [showAddPurchaseMenu, setShowAddPurchaseMenu] = useState(false);
  const [receiveInvoiceViewMode, setReceiveInvoiceViewMode] = useState<"empty_guide" | "list">("empty_guide");
  const [receivedInvoices, setReceivedInvoices] = useState([
    {
      id: "inv-01",
      receivedDate: "29/09/2026",
      invoiceNo: "0002810",
      invoiceSeries: "1C26TAA",
      invoiceDate: "29/09/2026",
      supplierName: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      supplierTaxCode: "0102345678",
      voucherCode: "NK00001",
      subtotal: 21500000,
      vatAmount: 2150000,
      totalAmount: 23650000,
      status: "Đã nhận HĐ",
    },
    {
      id: "inv-02",
      receivedDate: "22/09/2026",
      invoiceNo: "0001452",
      invoiceSeries: "1C26TBB",
      invoiceDate: "22/09/2026",
      supplierName: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      supplierTaxCode: "0900123456",
      voucherCode: "NK00002",
      subtotal: 80454545,
      vatAmount: 8045455,
      totalAmount: 88500000,
      status: "Đã nhận HĐ",
    },
  ]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [invoiceSearchText, setInvoiceSearchText] = useState("");

  // Biểu đồ (Chart Dashboard) states
  const [currencyUnit, setCurrencyUnit] = useState("Đồng");
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [chartRefreshTime, setChartRefreshTime] = useState("11:32");
  const [chartPeriods, setChartPeriods] = useState<Record<string, string>>({
    orders: "Tháng này",
    contracts: "Tháng này",
    purchases: "Tháng này",
    debt: "Tháng này",
    buyValue: "Tháng này",
  });
  const [openPeriodMenu, setOpenPeriodMenu] = useState<string | null>(null);

  const handleRefreshChart = () => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setChartRefreshTime(timeStr);
    notify(`Đã cập nhật số liệu biểu đồ mua hàng tính đến ${timeStr}.`);
  };

  // Flowchart dropdown menu and hover timer
  const [activeFlowchartMenu, setActiveFlowchartMenu] = useState<string | null>(null);
  const flowchartMenuTimer = useRef<number | null>(null);
  const [_voucherKindOption, setVoucherKindOption] = useState<"goods" | "service" | "multi">("goods");

  const handleFlowchartMouseEnter = (menu: string) => {
    if (flowchartMenuTimer.current) {
      clearTimeout(flowchartMenuTimer.current);
      flowchartMenuTimer.current = null;
    }
    setActiveFlowchartMenu(menu);
  };

  const handleFlowchartMouseLeave = () => {
    flowchartMenuTimer.current = window.setTimeout(() => {
      setActiveFlowchartMenu(null);
    }, 220);
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowId, setSelectedRowId] = useState<string | null>("po-01");

  // Sample data: Đơn mua hàng (Image 2)
  const [orders, setOrders] = useState([
    {
      id: "po-01",
      code: "ĐMH00001",
      date: "29/09/2026",
      deliveryDate: "05/10/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      amount: 38750000,
      status: "Chưa thực hiện",
      description: "Mua vật tư phục vụ dự án tháng 9/2026",
    },
    {
      id: "po-02",
      code: "ĐMH00002",
      date: "25/09/2026",
      deliveryDate: "30/09/2026",
      supplier: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      amount: 145000000,
      status: "Đang thực hiện",
      description: "Đơn đặt hàng thép xây dựng lô 2",
    },
  ]);

  // Sample data: Hợp đồng mua (Image 3)
  const [contracts, setContracts] = useState([
    {
      id: "hd-01",
      code: "HĐM00001",
      date: "29/09/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      amount: 38750000,
      status: "Chưa thực hiện",
      deliveryStatus: "Chưa giao",
    },
    {
      id: "hd-02",
      code: "HĐM00002",
      date: "15/08/2026",
      supplier: "Công ty TNHH Nhập khẩu & Thương mại Sao Nam",
      amount: 92000000,
      status: "Đang thực hiện",
      deliveryStatus: "Đang giao",
    },
  ]);

  // Sample data: Chứng từ mua hàng (Image 4)
  const [vouchers, setVouchers] = useState([
    {
      id: "nk-01",
      code: "NK00001",
      date: "29/09/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      amount: 23650000,
      kind: "Mua hàng trong nước nhập kho",
      status: "Chưa thanh toán",
      description: "Mua hàng nhập kho vật tư thép Ø6",
    },
    {
      id: "nk-02",
      code: "NK00002",
      date: "22/09/2026",
      supplier: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      amount: 88500000,
      kind: "Mua hàng trong nước nhập kho",
      status: "Đã thanh toán",
      description: "Nhập kho ống thép đúc",
    },
  ]);

  // Sample data: Trả lại hàng mua (Image 5)
  const [returns, setReturns] = useState([
    {
      id: "xk-01",
      code: "XK00001",
      date: "29/09/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      amount: 2365000,
      reason: "Trả lại hàng mua do sai quy cách Ø6",
      status: "Giảm trừ công nợ",
    },
  ]);

  // Sample data: Giảm giá hàng mua (Screenshot 1)
  const [discounts, setDiscounts] = useState([
    {
      id: "mgg-01",
      code: "MGG00001",
      date: "29/09/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      amount: 165000,
      reason: "Giảm giá hàng mua vật tư thép do giao trễ",
      status: "Giảm trừ công nợ",
    },
  ]);

  // Sample data: Hàng hóa, dịch vụ (Screenshot 2)
  const [inventoryItems, _setInventoryItems] = useState([
    {
      id: "cpmh",
      name: "Chi phí mua hàng",
      code: "CPMH",
      vatPolicy: "Chưa xác định",
      nature: "Dịch vụ",
      stockQty: 0,
      stockValue: 0,
    },
    {
      id: "vt01",
      name: "Thép cuộn mạ kẽm Ø6",
      code: "VT001",
      vatPolicy: "10%",
      nature: "Vật tư hàng hóa",
      stockQty: 4500,
      stockValue: 96750000,
    },
    {
      id: "vt02",
      name: "Ống thép đúc phi 90 dày 3.5mm",
      code: "VT002",
      vatPolicy: "10%",
      nature: "Vật tư hàng hóa",
      stockQty: 120,
      stockValue: 41400000,
    },
    {
      id: "vt03",
      name: "Bulong nở inox M12x100",
      code: "VT003",
      vatPolicy: "8%",
      nature: "Vật tư hàng hóa",
      stockQty: 2500,
      stockValue: 31250000,
    },
  ]);

  // Sample data: Đối chiếu công nợ (Screenshot 3)
  const [reconciliations, setReconciliations] = useState([
    {
      id: "dc-01",
      period: "Tháng 09/2026",
      supplier: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      account: "331",
      supplierDebt: 38750000,
      bookDebt: 38750000,
      difference: 0,
      status: "Khớp đúng 100%",
    },
  ]);

  // Handlers for saves
  const handleSaveOrder = (data: any) => {
    setOrders([
      {
        id: `po-${Date.now()}`,
        code: data.orderCode,
        date: data.orderDate,
        deliveryDate: data.deliveryDate,
        supplier: data.supplierName,
        amount: data.totalGrand,
        status: data.status,
        description: data.description,
      },
      ...orders,
    ]);
    notify(`Đã lưu Đơn mua hàng ${data.orderCode}!`);
  };

  const handleSaveContract = (data: any) => {
    setContracts([
      {
        id: `hd-${Date.now()}`,
        code: data.contractCode,
        date: data.signDate,
        supplier: data.supplierName,
        amount: data.grandTotal,
        status: data.contractStatus,
        deliveryStatus: data.deliveryStatus,
      },
      ...contracts,
    ]);
    notify(`Đã lưu Hợp đồng mua ${data.contractCode}!`);
  };

  const handleSaveVoucher = (data: any) => {
    setVouchers([
      {
        id: `nk-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        supplier: data.supplierName,
        amount: data.grandTotal,
        kind: data.purchaseType,
        status: data.paymentOption === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
        description: data.description,
      },
      ...vouchers,
    ]);
    notify(`Đã lập Chứng từ mua hàng ${data.voucherCode}!`);
  };

  const handleSaveReturn = (data: any) => {
    setReturns([
      {
        id: `xk-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        supplier: data.supplierName,
        amount: data.grandTotal,
        reason: data.reason,
        status: data.returnOption === "cash" ? "Thu tiền mặt" : "Giảm trừ công nợ",
      },
      ...returns,
    ]);
    notify(`Đã lưu Chứng từ trả lại hàng mua ${data.voucherCode}!`);
  };

  const handleSaveDiscount = (data: any) => {
    setDiscounts([
      {
        id: `mgg-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        supplier: data.supplierName,
        amount: data.grandTotal,
        reason: data.description,
        status: data.discountOption === "cash" ? "Thu tiền mặt" : "Giảm trừ công nợ",
      },
      ...discounts,
    ]);
    notify(`Đã lưu Chứng từ giảm giá hàng mua ${data.voucherCode}!`);
  };

  const handleSaveReconciliation = (data: any) => {
    setReconciliations([
      {
        id: `dc-${Date.now()}`,
        period: "Kỳ đối chiếu mới",
        supplier: data.supplier,
        account: data.debtAccount.split(" ")[0],
        supplierDebt: 23650000,
        bookDebt: 23650000,
        difference: 0,
        status: "AVA AI đã đối chiếu xong",
      },
      ...reconciliations,
    ]);
    notify(`AVA Kế toán đã đối chiếu thành công kỳ công nợ với ${data.supplier}!`);
  };

  const handleSaveSupplier = (data: any) => {
    notify(`Đã thêm nhà cung cấp ${data.name || data.code}!`);
  };

  const handleSaveReceivedInvoice = (selectedVouchers: UninvoicedVoucher[]) => {
    const newItems = selectedVouchers.map((v, idx) => {
      const num = (2811 + receivedInvoices.length + idx).toString().padStart(7, "0");
      const subtotal = Math.round(v.amount / 1.1);
      const vat = v.amount - subtotal;
      return {
        id: `inv-${Date.now()}-${idx}`,
        receivedDate: "30/09/2026",
        invoiceNo: num,
        invoiceSeries: "1C26TAA",
        invoiceDate: v.docDate || "30/09/2026",
        supplierName: v.supplierName,
        supplierTaxCode: v.supplierCode === "NCC001" ? "0102345678" : v.supplierCode === "NCC002" ? "0900123456" : "0309876543",
        voucherCode: v.voucherCode,
        subtotal,
        vatAmount: vat,
        totalAmount: v.amount,
        status: "Đã nhận HĐ",
      };
    });
    setReceivedInvoices((prev) => [...newItems, ...prev]);
    setShowReceiveInvoiceModal(false);
    setReceiveInvoiceViewMode("list");
    notify(`Đã nhận hóa đơn cho ${selectedVouchers.length} chứng từ mua hàng thành công!`);
  };

  const handleSaveService = (data: any) => {
    setVouchers([
      {
        id: `mdv-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        supplier: data.supplierName,
        amount: data.grandTotal,
        kind: "Mua dịch vụ",
        status: data.paymentOption === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
        description: data.description,
      },
      ...vouchers,
    ]);
    notify(`Đã lập Chứng từ mua dịch vụ ${data.voucherCode}!`);
  };

  const handleSaveMultiInvoice = (data: any) => {
    setVouchers([
      {
        id: `mhd-${Date.now()}`,
        code: data.voucherCode,
        date: data.docDate,
        supplier: data.deliverer || "Nhiều nhà cung cấp",
        amount: data.grandTotal,
        kind: data.purchaseKind || "Mua hàng nhiều hóa đơn",
        status: data.paymentOption === "paid" ? "Đã thanh toán" : "Chưa thanh toán",
        description: data.description,
      },
      ...vouchers,
    ]);
    notify(`Đã lập Chứng từ mua hàng nhiều hóa đơn ${data.voucherCode}!`);
  };

  // Render all modals
  const renderModals = () => (
    <>
      {showOrderModal && (
        <PurchaseOrderModal
          onClose={() => setShowOrderModal(false)}
          onSubmit={handleSaveOrder}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showContractModal && (
        <PurchaseContractModal
          onClose={() => setShowContractModal(false)}
          onSubmit={handleSaveContract}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showVoucherModal && (
        <PurchaseVoucherModal
          onClose={() => setShowVoucherModal(false)}
          onSubmit={handleSaveVoucher}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showReturnModal && (
        <PurchaseReturnModal
          onClose={() => setShowReturnModal(false)}
          onSubmit={handleSaveReturn}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showDiscountModal && (
        <PurchaseDiscountModal
          onClose={() => setShowDiscountModal(false)}
          onSubmit={handleSaveDiscount}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showReconciliationModal && (
        <ReconciliationPeriodModal
          onClose={() => setShowReconciliationModal(false)}
          onSubmit={handleSaveReconciliation}
        />
      )}

      {showSupplierModal && (
        <SupplierModal
          onClose={() => setShowSupplierModal(false)}
          onSubmit={handleSaveSupplier}
        />
      )}

      {showSupplierPaymentModal && (
        <SupplierPaymentModal
          onClose={() => setShowSupplierPaymentModal(false)}
          onSubmit={(_payload) => {
            setShowSupplierPaymentModal(false);
            notify("Đã lập chứng từ trả tiền nhà cung cấp theo hóa đơn thành công!");
          }}
        />
      )}

      {showReceiveInvoiceModal && (
        <ReceiveInvoiceSelectModal
          onClose={() => setShowReceiveInvoiceModal(false)}
          onSubmit={handleSaveReceivedInvoice}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showAIModal && (
        <AIAssistantModal
          onClose={() => setShowAIModal(false)}
          onApply={(doc) => {
            setShowAIModal(false);
            notify(`AVA Kế toán đã phân tích hóa đơn mua hàng ${doc.code}.`);
          }}
        />
      )}

      {showServiceModal && (
        <PurchaseServiceModal
          onClose={() => setShowServiceModal(false)}
          onSubmit={handleSaveService}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}

      {showMultiInvoiceModal && (
        <PurchaseMultiInvoiceModal
          onClose={() => setShowMultiInvoiceModal(false)}
          onSubmit={handleSaveMultiInvoice}
          onOpenSupplierModal={() => setShowSupplierModal(true)}
        />
      )}
    </>
  );

  // -------------------------------------------------------------------------
  // 0. TAB: BIỂU ĐỒ (EXACT MATCHING SCREENSHOT)
  // -------------------------------------------------------------------------
  if (tab === "chart") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100%",
          background: "#f4f5f8",
          padding: "12px 18px 24px 18px",
          boxSizing: "border-box",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Backdrop for closing popups */}
        {(showCurrencyMenu || openPeriodMenu !== null) && (
          <div
            onClick={() => {
              setShowCurrencyMenu(false);
              setOpenPeriodMenu(null);
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
              background: "transparent",
            }}
          />
        )}

        {/* Subheader: Đơn vị tính tiền Đồng ▾ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
            <span>Đơn vị tính tiền</span>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setOpenPeriodMenu(null);
                  setShowCurrencyMenu(!showCurrencyMenu);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 4px",
                  fontSize: 13,
                }}
              >
                <span>{currencyUnit}</span>
                <ChevronDown size={14} />
              </button>

              {showCurrencyMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    zIndex: 50,
                    minWidth: 130,
                    overflow: "hidden",
                  }}
                >
                  {["Đồng", "Nghìn đồng", "Triệu đồng", "Tỷ đồng"].map((unit) => (
                    <div
                      key={unit}
                      onClick={() => {
                        setCurrencyUnit(unit);
                        setShowCurrencyMenu(false);
                        notify(`Đã chuyển đơn vị tính tiền sang: ${unit}`);
                      }}
                      style={{
                        padding: "7px 12px",
                        fontSize: 13,
                        color: currencyUnit === unit ? "#0284c7" : "#1e293b",
                        fontWeight: currencyUnit === unit ? 600 : 400,
                        background: currencyUnit === unit ? "#eff6ff" : "#ffffff",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        if (currencyUnit !== unit) e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (currencyUnit !== unit) e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      {unit}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TOP ROW: 3 SUMMARY KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 14,
            marginBottom: 14,
          }}
        >
          {/* CARD 1: Đơn mua hàng (Purple Header #8b5cf6) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#8b5cf6",
                color: "#ffffff",
                padding: "8px 14px",
                borderTopLeftRadius: 5,
                borderTopRightRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Đơn mua hàng</span>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCurrencyMenu(false);
                    setOpenPeriodMenu(openPeriodMenu === "orders" ? null : "orders");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  <span>{chartPeriods.orders}</span>
                  <ChevronDown size={13} />
                </button>
                {openPeriodMenu === "orders" && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 50,
                      minWidth: 120,
                      overflow: "hidden",
                    }}
                  >
                    {["Hôm nay", "Tuần này", "Tháng này", "Tháng trước", "Quý này", "Năm nay"].map((p) => (
                      <div
                        key={p}
                        onClick={() => {
                          setChartPeriods((prev) => ({ ...prev, orders: p }));
                          setOpenPeriodMenu(null);
                          notify(`Đã lọc Đơn mua hàng theo: ${p}`);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12.5,
                          color: chartPeriods.orders === p ? "#0284c7" : "#1e293b",
                          background: chartPeriods.orders === p ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body Rows */}
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {[
                { label: "Giá trị đơn hàng", isDebt: false, tabTarget: "orders", modal: () => setShowOrderModal(true) },
                { label: "Đã thực hiện", isDebt: false, tabTarget: "orders", modal: () => setShowOrderModal(true) },
                { label: "Đã thanh toán", isDebt: false, tabTarget: "transactions", modal: () => setShowVoucherModal(true) },
                { label: "Còn phải trả", isDebt: true, tabTarget: "reconciliation", modal: () => setShowReconciliationModal(true) },
              ].map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (href) {
                      window.location.href = href(`/purchases/${row.tabTarget}`);
                    } else {
                      row.modal();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 4px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                    borderRadius: 4,
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>{row.label}</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: row.isDebt ? "#ea580c" : "#0284c7",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <span>0</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#64748b",
              }}
            >
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span
                onClick={handleRefreshChart}
                style={{
                  color: "#0284c7",
                  cursor: "pointer",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tải lại
              </span>
            </div>
          </div>

          {/* CARD 2: Hợp đồng mua (Ocean Blue Header #0284c7) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#0284c7",
                color: "#ffffff",
                padding: "8px 14px",
                borderTopLeftRadius: 5,
                borderTopRightRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Hợp đồng mua</span>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCurrencyMenu(false);
                    setOpenPeriodMenu(openPeriodMenu === "contracts" ? null : "contracts");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  <span>{chartPeriods.contracts}</span>
                  <ChevronDown size={13} />
                </button>
                {openPeriodMenu === "contracts" && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 50,
                      minWidth: 120,
                      overflow: "hidden",
                    }}
                  >
                    {["Hôm nay", "Tuần này", "Tháng này", "Tháng trước", "Quý này", "Năm nay"].map((p) => (
                      <div
                        key={p}
                        onClick={() => {
                          setChartPeriods((prev) => ({ ...prev, contracts: p }));
                          setOpenPeriodMenu(null);
                          notify(`Đã lọc Hợp đồng mua theo: ${p}`);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12.5,
                          color: chartPeriods.contracts === p ? "#0284c7" : "#1e293b",
                          background: chartPeriods.contracts === p ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body Rows */}
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {[
                { label: "Giá trị hợp đồng", isDebt: false, tabTarget: "contracts", modal: () => setShowContractModal(true) },
                { label: "Đã thực hiện", isDebt: false, tabTarget: "contracts", modal: () => setShowContractModal(true) },
                { label: "Đã thanh toán", isDebt: false, tabTarget: "transactions", modal: () => setShowVoucherModal(true) },
                { label: "Còn phải trả", isDebt: true, tabTarget: "reconciliation", modal: () => setShowReconciliationModal(true) },
              ].map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (href) {
                      window.location.href = href(`/purchases/${row.tabTarget}`);
                    } else {
                      row.modal();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 4px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                    borderRadius: 4,
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>{row.label}</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: row.isDebt ? "#ea580c" : "#0284c7",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <span>0</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#64748b",
              }}
            >
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span
                onClick={handleRefreshChart}
                style={{
                  color: "#0284c7",
                  cursor: "pointer",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tải lại
              </span>
            </div>
          </div>

          {/* CARD 3: Mua hàng (Teal Green Header #009688) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "#009688",
                color: "#ffffff",
                padding: "8px 14px",
                borderTopLeftRadius: 5,
                borderTopRightRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Mua hàng</span>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCurrencyMenu(false);
                    setOpenPeriodMenu(openPeriodMenu === "purchases" ? null : "purchases");
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#ffffff",
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    padding: "2px 4px",
                  }}
                >
                  <span>{chartPeriods.purchases}</span>
                  <ChevronDown size={13} />
                </button>
                {openPeriodMenu === "purchases" && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 50,
                      minWidth: 120,
                      overflow: "hidden",
                    }}
                  >
                    {["Hôm nay", "Tuần này", "Tháng này", "Tháng trước", "Quý này", "Năm nay"].map((p) => (
                      <div
                        key={p}
                        onClick={() => {
                          setChartPeriods((prev) => ({ ...prev, purchases: p }));
                          setOpenPeriodMenu(null);
                          notify(`Đã lọc Mua hàng theo: ${p}`);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: 12.5,
                          color: chartPeriods.purchases === p ? "#0284c7" : "#1e293b",
                          background: chartPeriods.purchases === p ? "#eff6ff" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body Rows (3 rows in screenshot) */}
            <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "space-around" }}>
              {[
                { label: "Tổng tiền mua hàng", isDebt: false, tabTarget: "transactions", modal: () => setShowVoucherModal(true) },
                { label: "Đã thanh toán", isDebt: false, tabTarget: "transactions", modal: () => setShowVoucherModal(true) },
                { label: "Còn phải trả", isDebt: true, tabTarget: "reconciliation", modal: () => setShowReconciliationModal(true) },
              ].map((row, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (href) {
                      window.location.href = href(`/purchases/${row.tabTarget}`);
                    } else {
                      row.modal();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "5px 4px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
                    borderRadius: 4,
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span>{row.label}</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: row.isDebt ? "#ea580c" : "#0284c7",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    <span>0</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#64748b",
              }}
            >
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span
                onClick={handleRefreshChart}
                style={{
                  color: "#0284c7",
                  cursor: "pointer",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tải lại
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: 2 RANKING PANELS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          {/* PANEL 1 (LEFT): Nhà cung cấp có công nợ lớn */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: "16px 18px 12px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 290,
              position: "relative",
            }}
          >
            {/* Top Header */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <strong style={{ fontSize: 14.5, color: "#1e293b", fontWeight: 700 }}>
                  Nhà cung cấp có công nợ lớn
                </strong>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCurrencyMenu(false);
                      setOpenPeriodMenu(openPeriodMenu === "debt" ? null : "debt");
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "3px 8px",
                      fontSize: 12,
                      color: "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span>{chartPeriods.debt}</span>
                    <ChevronDown size={13} />
                  </button>
                  {openPeriodMenu === "debt" && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: 4,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        zIndex: 50,
                        minWidth: 120,
                        overflow: "hidden",
                      }}
                    >
                      {["Hôm nay", "Tuần này", "Tháng này", "Tháng trước", "Quý này", "Năm nay"].map((p) => (
                        <div
                          key={p}
                          onClick={() => {
                            setChartPeriods((prev) => ({ ...prev, debt: p }));
                            setOpenPeriodMenu(null);
                            notify(`Đã lọc công nợ nhà cung cấp theo: ${p}`);
                          }}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12.5,
                            color: chartPeriods.debt === p ? "#0284c7" : "#1e293b",
                            background: chartPeriods.debt === p ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>0</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginLeft: 2 }}>đ</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginTop: 4 }}>
                    TỔNG
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Đvt: {currencyUnit.toLowerCase()}
                </div>
              </div>

              {/* 5 Rows with 5 Colored square bullets and rounded skeleton bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                {["#8b5cf6", "#6366f1", "#06b6d4", "#10b981", "#f59e0b"].map((color, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 2, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                    <div style={{ flex: 1.2, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                    <div style={{ flex: 1, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid #f1f5f9",
                paddingTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#64748b",
              }}
            >
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span
                onClick={handleRefreshChart}
                style={{
                  color: "#0284c7",
                  cursor: "pointer",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tải lại
              </span>
            </div>
          </div>

          {/* PANEL 2 (RIGHT): Nhà cung cấp có giá trị mua lớn */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              padding: "16px 18px 12px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 290,
              position: "relative",
            }}
          >
            {/* Top Header */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <strong style={{ fontSize: 14.5, color: "#1e293b", fontWeight: 700 }}>
                  Nhà cung cấp có giá trị mua lớn
                </strong>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCurrencyMenu(false);
                      setOpenPeriodMenu(openPeriodMenu === "buyValue" ? null : "buyValue");
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      padding: "3px 8px",
                      fontSize: 12,
                      color: "#475569",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <span>{chartPeriods.buyValue}</span>
                    <ChevronDown size={13} />
                  </button>
                  {openPeriodMenu === "buyValue" && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: 4,
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                        zIndex: 50,
                        minWidth: 120,
                        overflow: "hidden",
                      }}
                    >
                      {["Hôm nay", "Tuần này", "Tháng này", "Tháng trước", "Quý này", "Năm nay"].map((p) => (
                        <div
                          key={p}
                          onClick={() => {
                            setChartPeriods((prev) => ({ ...prev, buyValue: p }));
                            setOpenPeriodMenu(null);
                            notify(`Đã lọc giá trị mua nhà cung cấp theo: ${p}`);
                          }}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12.5,
                            color: chartPeriods.buyValue === p ? "#0284c7" : "#1e293b",
                            background: chartPeriods.buyValue === p ? "#eff6ff" : "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>0</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginLeft: 2 }}>đ</span>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, marginTop: 4 }}>
                    TỔNG
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Đvt: {currencyUnit.toLowerCase()}
                </div>
              </div>

              {/* 5 Rows with 5 Colored square bullets and rounded skeleton bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                {["#8b5cf6", "#6366f1", "#06b6d4", "#10b981", "#f59e0b"].map((color, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 2, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                    <div style={{ flex: 1.2, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                    <div style={{ flex: 1, height: 9, background: "#f1f5f9", borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                borderTop: "1px solid #f1f5f9",
                paddingTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                color: "#64748b",
              }}
            >
              <Clock size={12.5} style={{ color: "#94a3b8" }} />
              <span>Số liệu tính đến: {chartRefreshTime}</span>
              <span
                onClick={handleRefreshChart}
                style={{
                  color: "#0284c7",
                  cursor: "pointer",
                  fontWeight: 500,
                  marginLeft: 4,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tải lại
              </span>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 1. TAB: HÀNG HÓA, DỊCH VỤ (EXACT MATCHING SCREENSHOT 2)
  // -------------------------------------------------------------------------
  if (tab === "inventory-items") {
    const totalQty = inventoryItems.reduce((s, it) => s + it.stockQty, 0);
    const totalVal = inventoryItems.reduce((s, it) => s + it.stockValue, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Subheader: < Lấy lại danh mục */}
        <div style={{ padding: "8px 16px 4px 16px" }}>
          <span
            style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
            onClick={() => notify("Đã lấy lại toàn bộ danh mục hàng hóa, dịch vụ.")}
          >
            {"< Lấy lại danh mục"}
          </span>
        </div>

        {/* KPI Cards: Hàng hóa sắp hết hàng & Hàng hóa hết hàng (Screenshot 2) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "4px 16px 10px 16px" }}>
          {/* Card 1: Sắp hết hàng */}
          <div
            style={{
              border: "1px solid #fed7aa",
              borderRadius: 6,
              background: "#fffaf5",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#ffedd5", display: "grid", placeItems: "center", color: "#f97316" }}>
                <Package size={18} />
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#475569", display: "block" }}>Hàng hóa sắp hết hàng</span>
                <strong style={{ fontSize: 18, color: "#ea580c", fontWeight: 700 }}>0</strong>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: "#334155", color: "#ffffff", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                Bấm vào để lọc
              </span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>11:35</span>
            </div>
          </div>

          {/* Card 2: Hết hàng */}
          <div
            style={{
              border: "1px solid #fecaca",
              borderRadius: 6,
              background: "#fff5f5",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 6, background: "#fee2e2", display: "grid", placeItems: "center", color: "#ef4444" }}>
                <AlertCircle size={18} />
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#475569", display: "block" }}>Hàng hóa hết hàng</span>
                <strong style={{ fontSize: 18, color: "#dc2626", fontWeight: 700 }}>0</strong>
              </div>
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>11:35</span>
          </div>
        </div>

        {/* Table Toolbar (Screenshot 2) */}
        <div style={{ padding: "6px 16px 10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Search box */}
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, padding: "0 10px", height: 30, width: 240, background: "#ffffff" }}>
            <Search size={14} style={{ color: "#94a3b8", marginRight: 6 }} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: 12.5, width: "100%" }}
            />
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => notify("Làm mới danh sách")} style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }} title="Làm mới">
              <RefreshCw size={14} />
            </button>
            <button type="button" style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }} title="Tùy chỉnh cột">
              <Columns3 size={14} />
            </button>
            <button type="button" style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }} title="Xuất khẩu">
              <FileSpreadsheet size={14} />
            </button>
            <button type="button" style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }} title="In">
              <Printer size={14} />
            </button>
            <button type="button" style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }} title="Bộ lọc">
              <Filter size={14} />
            </button>

            {/* Green Thêm button with caret */}
            <div style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => notify("Mở form thêm mới Hàng hóa, dịch vụ...")}
                style={{ height: 30, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
              <button
                type="button"
                style={{ height: 30, padding: "0 8px", background: "#009a5d", color: "#ffffff", border: "none", borderLeft: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}
              >
                <ChevronDown size={13} />
              </button>
            </div>

            <button type="button" style={{ width: 30, height: 30, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b" }}>
              •••
            </button>
          </div>
        </div>

        {/* Data Table (Screenshot 2) */}
        <div style={{ flex: 1, overflow: "auto", borderTop: "1px solid #e2e8f0" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center", padding: "8px 4px" }}>
                  <input type="checkbox" style={{ accentColor: "#00b06b" }} />
                </th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "left" }}>Mã</th>
                <th style={{ width: 180, padding: "8px 10px", textAlign: "left" }}>Giảm thuế theo quy định</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "left" }}>Tính chất</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Số lượng tồn</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Giá trị tồn</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {inventoryItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px" }}>
                    <input type="checkbox" />
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 500, color: "#1e293b" }}>{item.name}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{item.code}</td>
                  <td style={{ padding: "8px 10px", color: "#64748b" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{item.vatPolicy}</span>
                      <FileText size={13} style={{ color: "#00b06b" }} />
                    </div>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{item.nature}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>
                    {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(item.stockQty)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                    {formatVND(item.stockValue)}
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <span>Sửa</span>
                      <ChevronDown size={12} />
                    </span>
                  </td>
                </tr>
              ))}

              {/* Total row */}
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                <td></td>
                <td style={{ padding: "8px 10px", color: "#1e293b" }}>Tổng</td>
                <td colSpan={3}></td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669" }}>
                  {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(totalQty)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", color: "#059669" }}>
                  {formatVND(totalVal)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Tổng số: <strong>{inventoryItems.length}</strong></span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#64748b" }}>
            <span>Số dòng/trang</span>
            <select style={{ height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1" }}>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronLeft size={14} style={{ cursor: "pointer" }} />
              <span style={{ fontWeight: 600, color: "#111827" }}>1</span>
              <ChevronRight size={14} style={{ cursor: "pointer" }} />
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. TAB: ĐỐI CHIẾU CÔNG NỢ (EXACT MATCHING SCREENSHOT 3)
  // -------------------------------------------------------------------------
  if (tab === "reconciliation") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setShowReconciliationModal(true)}
              style={{
                height: 32,
                padding: "0 16px",
                background: "#00b06b",
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
              <span>Thêm kỳ đối chiếu</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              style={{
                height: 32,
                padding: "0 12px",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sparkles size={14} />
              <span>AVA Kế toán đối chiếu</span>
            </button>
          </div>

          <div style={{ fontSize: 13, color: "#64748b" }}>
            Tự động đối chiếu file Excel sao kê công nợ từ Nhà cung cấp
          </div>
        </div>

        {/* Table / List View */}
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Kỳ đối chiếu</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Nhà cung cấp</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>TK Nợ</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Nợ NCC báo</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Nợ trên sổ sách</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "right" }}>Chênh lệch</th>
                <th style={{ width: 150, padding: "8px 10px", textAlign: "center" }}>Kết quả đối chiếu</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{r.period}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.supplier}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{r.account}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(r.supplierDebt)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(r.bookDebt)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: r.difference === 0 ? "#16a34a" : "#dc2626" }}>
                    {formatVND(r.difference)} đ
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 600 }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Button: Xem danh sách chứng từ (Screenshot 3) */}
        <div style={{ padding: "16px 0", textAlign: "center", borderTop: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => notify("Xem danh sách toàn bộ chứng từ công nợ...")}
            style={{
              height: 32,
              padding: "0 18px",
              background: "#ffffff",
              color: "#059669",
              border: "1px solid #10b981",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 600,
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

  // -------------------------------------------------------------------------
  // 3. TAB: GIẢM GIÁ HÀNG MUA (EXACT MATCHING SCREENSHOT 1)
  // -------------------------------------------------------------------------
  if (tab === "discounts") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => setShowDiscountModal(true)}
            style={{
              height: 32,
              padding: "0 14px",
              background: "#00b06b",
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
            <span>Thêm chứng từ giảm giá hàng mua</span>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center", padding: "8px 4px" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Nhà cung cấp</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Lý do giảm giá</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền giảm</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Phương thức</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px" }}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }} onClick={() => setShowDiscountModal(true)}>
                      {d.code}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{d.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{d.supplier}</td>
                  <td style={{ padding: "8px 10px" }}>{d.reason}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{formatVND(d.amount)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      {d.status}
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

  // -------------------------------------------------------------------------
  // 4. TAB: ĐƠN MUA HÀNG (ORDERS)
  // -------------------------------------------------------------------------
  if (tab === "orders") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowOrderModal(true)}
              style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={15} />
              <span>Thêm đơn mua hàng</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              style={{ height: 32, padding: "0 12px", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles size={14} />
              <span>Thêm bằng AI</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center", padding: "8px 4px" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Số đơn hàng</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày đơn</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Hạn giao</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Nhà cung cấp</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Diễn giải</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} onClick={() => setSelectedRowId(po.id)} style={{ borderBottom: "1px solid #f1f5f9", background: selectedRowId === po.id ? "rgba(0, 176, 107, 0.08)" : "#ffffff", cursor: "pointer" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px" }}><input type="checkbox" checked={selectedRowId === po.id} onChange={() => {}} /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }} onClick={() => setShowOrderModal(true)}>
                      {po.code}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{po.date}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{po.deliveryDate}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{po.supplier}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{po.description}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatVND(po.amount)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{po.status}</span>
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

  // -------------------------------------------------------------------------
  // 5. TAB: HỢP ĐỒNG MUA (CONTRACTS)
  // -------------------------------------------------------------------------
  if (tab === "contracts") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" onClick={() => setShowContractModal(true)} style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            <span>Thêm hợp đồng mua</span>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 120, padding: "8px 10px" }}>Số hợp đồng</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Ngày ký</th>
                <th style={{ padding: "8px 10px" }}>Nhà cung cấp</th>
                <th style={{ width: 140, padding: "8px 10px", textAlign: "right" }}>Giá trị HĐ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Tình trạng HĐ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Tình trạng giao</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center" }}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }} onClick={() => setShowContractModal(true)}>
                      {c.code}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{c.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{c.supplier}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatVND(c.amount)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{c.deliveryStatus}</span>
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

  // -------------------------------------------------------------------------
  // 6. TAB: MUA HÀNG (TRANSACTIONS)
  // -------------------------------------------------------------------------
  if (tab === "transactions") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
            {/* Button 1: Thêm bằng AI */}
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              style={{
                height: 32,
                padding: "0 14px 0 8px",
                background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 2px 4px rgba(139, 92, 246, 0.25)",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,0.6)",
                }}
              >
                <Sparkles size={13} style={{ color: "#8b5cf6" }} />
              </div>
              <span>Thêm bằng AI</span>
            </button>

            {/* Button 2: Split Button "Thêm ▾" */}
            <div style={{ position: "relative", display: "inline-flex" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "stretch",
                  borderRadius: 4,
                  overflow: "hidden",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseMenu(!showAddPurchaseMenu)}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    borderRight: "1px solid rgba(255, 255, 255, 0.25)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#00965b")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#00b06b")}
                >
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPurchaseMenu(!showAddPurchaseMenu)}
                  style={{
                    height: 32,
                    padding: "0 8px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#00965b")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#00b06b")}
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Dropdown Menu (Matching Screenshot 2) */}
              {showAddPurchaseMenu && (
                <>
                  <div
                    onClick={() => setShowAddPurchaseMenu(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 99 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "calc(100% + 4px)",
                      background: "#ffffff",
                      borderRadius: 6,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      zIndex: 100,
                      minWidth: 260,
                      padding: "6px 0",
                    }}
                  >
                    {[
                      {
                        label: "Chứng từ mua hàng",
                        onClick: () => {
                          setShowAddPurchaseMenu(false);
                          setShowVoucherModal(true);
                        },
                      },
                      {
                        label: "Chứng từ mua dịch vụ",
                        onClick: () => {
                          setShowAddPurchaseMenu(false);
                          setShowServiceModal(true);
                        },
                      },
                      {
                        label: "Chứng từ mua hàng nhiều hóa đơn",
                        onClick: () => {
                          setShowAddPurchaseMenu(false);
                          setShowMultiInvoiceModal(true);
                        },
                      },
                      {
                        label: "Trả tiền theo hóa đơn",
                        onClick: () => {
                          setShowAddPurchaseMenu(false);
                          setShowSupplierPaymentModal(true);
                        },
                      },
                      {
                        label: "Lập từ hóa đơn đầu vào meInvoice",
                        onClick: () => {
                          setShowAddPurchaseMenu(false);
                          notify("Đang kết nối dịch vụ Hóa đơn điện tử meInvoice để tải hóa đơn đầu vào...");
                        },
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        onClick={item.onClick}
                        style={{
                          padding: "9px 18px",
                          fontSize: 13,
                          color: "#1e293b",
                          cursor: "pointer",
                          transition: "background 0.12s, color 0.12s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f1f5f9";
                          e.currentTarget.style.color = "#00b06b";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#1e293b";
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Button 3: Nhập từ Excel */}
            <button
              type="button"
              onClick={() => notify("Tính năng Nhập từ Excel đang được tải...")}
              style={{
                height: 32,
                padding: "0 14px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                transition: "background 0.15s, border-color 0.15s",
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

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ padding: "8px 10px" }}>Loại mua hàng</th>
                <th style={{ padding: "8px 10px" }}>Nhà cung cấp</th>
                <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center" }}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }} onClick={() => setShowVoucherModal(true)}>
                      {v.code}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{v.date}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{v.kind}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{v.supplier}</td>
                  <td style={{ padding: "8px 10px" }}>{v.description}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatVND(v.amount)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: v.status === "Đã thanh toán" ? "#dcfce7" : "#fee2e2", color: v.status === "Đã thanh toán" ? "#15803d" : "#b91c1c", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{v.status}</span>
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

  // -------------------------------------------------------------------------
  // 7. TAB: TRẢ LẠI HÀNG MUA (RETURNS)
  // -------------------------------------------------------------------------
  if (tab === "returns") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button type="button" onClick={() => setShowReturnModal(true)} style={{ height: 32, padding: "0 14px", background: "#00b06b", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} />
            <span>Thêm chứng từ trả lại hàng</span>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px" }}>Số chứng từ</th>
                <th style={{ width: 100, padding: "8px 10px", textAlign: "center" }}>Ngày hạch toán</th>
                <th style={{ padding: "8px 10px" }}>Nhà cung cấp</th>
                <th style={{ padding: "8px 10px" }}>Lý do trả lại</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Phương thức</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center" }}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }} onClick={() => setShowReturnModal(true)}>
                      {r.code}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{r.date}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.supplier}</td>
                  <td style={{ padding: "8px 10px" }}>{r.reason}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{formatVND(r.amount)} đ</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{r.status}</span>
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

  // -------------------------------------------------------------------------
  // 7.1. TAB: NHẬN HÓA ĐƠN (EXACT MATCHING SCREENSHOT 1 & 2)
  // -------------------------------------------------------------------------
  if (tab === "invoices") {
    // Mode 1: Empty guide view matching Screenshot 2
    if (receiveInvoiceViewMode === "empty_guide") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "#f1f5f9",
            padding: "14px 18px",
            boxSizing: "border-box",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Center Area with exact Illustration from Screenshot 2 */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "30px 20px",
                textAlign: "center",
              }}
            >
              {/* SVG Vector Graphic Matching Image 2 */}
              <div
                style={{
                  width: 360,
                  maxWidth: "100%",
                  height: 180,
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  viewBox="0 0 360 180"
                  width="100%"
                  height="100%"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <filter
                      id="card-shadow"
                      x="-10%"
                      y="-10%"
                      width="125%"
                      height="125%"
                      filterUnits="userSpaceOnUse"
                    >
                      <feDropShadow
                        dx="0"
                        dy="3"
                        stdDeviation="5"
                        floodColor="#000000"
                        floodOpacity="0.06"
                      />
                    </filter>
                  </defs>

                  {/* Left Floating Card: Bill with $ */}
                  <g filter="url(#card-shadow)">
                    <rect
                      x="32"
                      y="32"
                      width="66"
                      height="84"
                      rx="7"
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1.2"
                    />
                    {/* Bold green $ sign */}
                    <text
                      x="65"
                      y="74"
                      fill="#00b06b"
                      fontSize="28"
                      fontWeight="800"
                      textAnchor="middle"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      $
                    </text>
                    {/* Bill text lines */}
                    <rect x="46" y="86" width="38" height="4" rx="2" fill="#00b06b" />
                    <rect x="46" y="94" width="26" height="4" rx="2" fill="#00b06b" />
                  </g>

                  {/* Right Floating Card: Analytics with chart and $ badge */}
                  <g filter="url(#card-shadow)">
                    <rect
                      x="262"
                      y="32"
                      width="66"
                      height="84"
                      rx="7"
                      fill="#ffffff"
                      stroke="#e2e8f0"
                      strokeWidth="1.2"
                    />
                    {/* Circular Green $ Badge */}
                    <circle cx="295" cy="54" r="12" fill="#00b06b" />
                    <text
                      x="295"
                      y="59"
                      fill="#ffffff"
                      fontSize="12.5"
                      fontWeight="800"
                      textAnchor="middle"
                      fontFamily="Inter, system-ui, sans-serif"
                    >
                      $
                    </text>
                    {/* 3 Bar Chart Columns */}
                    <rect x="279" y="82" width="7" height="20" rx="2" fill="#00b06b" />
                    <rect x="291" y="74" width="7" height="28" rx="2" fill="#00b06b" />
                    <rect x="303" y="78" width="7" height="24" rx="2" fill="#00b06b" />
                  </g>

                  {/* Curved Connecting Dashed Lines */}
                  <path
                    d="M 65 116 C 65 146, 120 152, 146 138"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    fill="none"
                  />
                  <path
                    d="M 295 116 C 295 146, 240 152, 214 138"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    fill="none"
                  />

                  {/* Floating dots & sparkles */}
                  <circle cx="118" cy="148" r="2" fill="#94a3b8" />
                  <circle cx="242" cy="148" r="2" fill="#94a3b8" />
                  <polygon points="98,140 101,143 98,146 95,143" fill="#00b06b" />
                  <polygon points="262,140 265,143 262,146 259,143" fill="#00b06b" />
                  <polygon points="144,72 146,74 144,76 142,74" fill="#94a3b8" />
                  <polygon points="216,68 218,70 216,72 214,70" fill="#94a3b8" />
                  <polygon points="65,22 67,24 65,26 63,24" fill="#00b06b" />
                  <polygon points="295,20 297,22 295,24 293,22" fill="#00b06b" />

                  {/* Female Accountant Character in Green working at Laptop */}
                  <g id="accountant-character">
                    {/* Dark flowing hair */}
                    <path
                      d="M 166 78 C 166 60, 194 60, 194 78 C 196 86, 204 102, 198 116 C 193 112, 190 100, 190 94 L 170 94 C 170 100, 167 112, 162 116 C 156 102, 164 86, 166 78 Z"
                      fill="#1e293b"
                    />

                    {/* Face & Neck */}
                    <ellipse cx="180" cy="76" rx="9.5" ry="11.5" fill="#fed7aa" />
                    <rect x="177" y="86" width="6" height="7" fill="#fed7aa" />

                    {/* Hair fringe / bangs */}
                    <path
                      d="M 170.5 73 Q 180 69 187 75 Q 181 79 174 77 Z"
                      fill="#1e293b"
                    />

                    {/* Emerald Green Blouse */}
                    <path
                      d="M 164 93 Q 180 89 196 93 L 203 128 L 157 128 Z"
                      fill="#00b06b"
                    />
                    {/* White V-neck collar */}
                    <path d="M 176 91 L 180 98 L 184 91 Z" fill="#ffffff" />

                    {/* Sleeves and Arms */}
                    <path
                      d="M 162 101 L 151 118 L 164 122"
                      stroke="#00b06b"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <path
                      d="M 198 101 L 209 118 L 196 122"
                      stroke="#00b06b"
                      strokeWidth="5.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />

                    {/* Hands */}
                    <circle cx="166" cy="122" r="3.5" fill="#fed7aa" />
                    <circle cx="194" cy="122" r="3.5" fill="#fed7aa" />

                    {/* Laptop Screen (angled back) */}
                    <polygon
                      points="154,120 206,120 201,102 159,102"
                      fill="#cbd5e1"
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                    <polygon
                      points="156.5,118 203.5,118 199.5,104 160.5,104"
                      fill="#f8fafc"
                    />

                    {/* Laptop Keyboard Base */}
                    <polygon
                      points="146,130 214,130 206,120 154,120"
                      fill="#e2e8f0"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                    <rect x="175" y="125" width="10" height="3" rx="1" fill="#cbd5e1" />
                  </g>
                </svg>
              </div>

              {/* Title from Screenshot 2 */}
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#1e293b",
                  marginTop: 22,
                  marginBottom: 16,
                  lineHeight: 1.4,
                  maxWidth: 620,
                }}
              >
                Nhận và quản lý các hóa đơn từ các giao dịch mua hàng với nhà cung cấp
              </h2>

              {/* Action Button: Thêm (solid green) */}
              <button
                type="button"
                onClick={() => setShowReceiveInvoiceModal(true)}
                style={{
                  height: 34,
                  padding: "0 34px",
                  background: "#00b06b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(0, 176, 107, 0.25)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#00965b")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#00b06b")}
              >
                Thêm
              </button>
            </div>

            {/* Bottom Button: Xem danh sách chứng từ (Screenshot 2) */}
            <div
              style={{
                padding: "16px 0 20px 0",
                textAlign: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setReceiveInvoiceViewMode("list")}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#ffffff",
                  color: "#00b06b",
                  border: "1px solid #00b06b",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
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

          {renderModals()}
        </div>
      );
    }

    // Mode 2: List / Table view of received invoices
    const filteredInvoices = receivedInvoices.filter((inv) => {
      if (!invoiceSearchText.trim()) return true;
      const q = invoiceSearchText.toLowerCase();
      return (
        inv.invoiceNo.toLowerCase().includes(q) ||
        inv.supplierName.toLowerCase().includes(q) ||
        inv.voucherCode.toLowerCase().includes(q) ||
        inv.invoiceSeries.toLowerCase().includes(q)
      );
    });

    const isAllInvSelected =
      filteredInvoices.length > 0 &&
      filteredInvoices.every((inv) => selectedInvoiceIds.includes(inv.id));

    const totalSub = filteredInvoices.reduce((s, it) => s + it.subtotal, 0);
    const totalVat = filteredInvoices.reduce((s, it) => s + it.vatAmount, 0);
    const totalGrand = filteredInvoices.reduce((s, it) => s + it.totalAmount, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        {/* Toolbar */}
        <div
          style={{
            padding: "10px 18px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowReceiveInvoiceModal(true)}
              style={{
                height: 32,
                padding: "0 16px",
                background: "#00b06b",
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
              <span>Nhận hóa đơn</span>
            </button>

            <button
              type="button"
              onClick={() => setReceiveInvoiceViewMode("empty_guide")}
              style={{
                height: 32,
                padding: "0 12px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                color: "#475569",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Màn hình hướng dẫn</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 260 }}>
              <input
                type="text"
                placeholder="Tìm số hóa đơn, nhà cung cấp..."
                value={invoiceSearchText}
                onChange={(e) => setInvoiceSearchText(e.target.value)}
                style={{
                  width: "100%",
                  height: 30,
                  padding: "0 28px 0 10px",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  fontSize: 12.5,
                  boxSizing: "border-box",
                }}
              />
              <Search
                size={14}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => notify("Đã xuất danh sách hóa đơn mua hàng ra Excel")}
              style={{
                height: 30,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                color: "#334155",
                fontSize: 12.5,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <FileSpreadsheet size={14} style={{ color: "#16a34a" }} />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Invoices Data Table */}
        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center", padding: "8px 6px" }}>
                  <input
                    type="checkbox"
                    checked={isAllInvSelected}
                    onChange={() => {
                      if (isAllInvSelected) {
                        setSelectedInvoiceIds([]);
                      } else {
                        setSelectedInvoiceIds(filteredInvoices.map((i) => i.id));
                      }
                    }}
                  />
                </th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Ngày nhận HĐ</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Số hóa đơn</th>
                <th style={{ width: 90, padding: "8px 10px", textAlign: "center" }}>Ký hiệu</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Ngày hóa đơn</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Nhà cung cấp</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Mã số thuế</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "left" }}>Chứng từ mua</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tiền chưa thuế</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "right" }}>Thuế GTGT</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "right" }}>Tổng tiền</th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const isSelected = selectedInvoiceIds.includes(inv.id);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoiceIds((prev) =>
                        prev.includes(inv.id) ? prev.filter((x) => x !== inv.id) : [...prev, inv.id]
                      );
                    }}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: isSelected ? "rgba(0, 176, 107, 0.08)" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <td
                      style={{ textAlign: "center", padding: "8px 6px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedInvoiceIds((prev) =>
                            prev.includes(inv.id) ? prev.filter((x) => x !== inv.id) : [...prev, inv.id]
                          );
                        }}
                      />
                    </td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{inv.receivedDate}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          notify(`Xem chi tiết hóa đơn số ${inv.invoiceNo}`);
                        }}
                      >
                        {inv.invoiceNo}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>
                      {inv.invoiceSeries}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#475569" }}>
                      {inv.invoiceDate}
                    </td>
                    <td style={{ padding: "8px 10px", fontWeight: 500, color: "#1e293b" }}>
                      {inv.supplierName}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>
                      {inv.supplierTaxCode}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{ color: "#0284c7", fontWeight: 500, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowVoucherModal(true);
                        }}
                      >
                        {inv.voucherCode}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#334155" }}>
                      {formatVND(inv.subtotal)} đ
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", color: "#334155" }}>
                      {formatVND(inv.vatAmount)} đ
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                      {formatVND(inv.totalAmount)} đ
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#15803d",
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                <td colSpan={8} style={{ padding: "10px", textAlign: "right", color: "#1e293b" }}>
                  Tổng cộng:
                </td>
                <td style={{ padding: "10px", textAlign: "right", color: "#334155" }}>
                  {formatVND(totalSub)} đ
                </td>
                <td style={{ padding: "10px", textAlign: "right", color: "#334155" }}>
                  {formatVND(totalVat)} đ
                </td>
                <td style={{ padding: "10px", textAlign: "right", color: "#059669" }}>
                  {formatVND(totalGrand)} đ
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer info bar */}
        <div
          style={{
            height: 38,
            padding: "0 18px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#64748b",
          }}
        >
          <div>
            Số dòng: <strong>{filteredInvoices.length}</strong> | Tổng tiền:{" "}
            <strong>{formatVND(totalGrand)} đ</strong>
          </div>
          <div>Trang 1 / 1</div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 7.2. TAB: NHÀ CUNG CẤP (SUPPLIERS)
  // -------------------------------------------------------------------------
  if (tab === "suppliers") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        <div style={{ padding: "10px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={() => setShowSupplierModal(true)}
            style={{
              height: 32,
              padding: "0 14px",
              background: "#00b06b",
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
            <span>Thêm nhà cung cấp</span>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" /></th>
                <th style={{ width: 110, padding: "8px 10px", textAlign: "left" }}>Mã nhà cung cấp</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Tên nhà cung cấp</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "center" }}>Mã số thuế</th>
                <th style={{ padding: "8px 10px", textAlign: "left" }}>Địa chỉ</th>
                <th style={{ width: 130, padding: "8px 10px", textAlign: "left" }}>Người liên hệ</th>
                <th style={{ width: 120, padding: "8px 10px", textAlign: "center" }}>Điện thoại</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_SUPPLIERS.map((s) => (
                <tr key={s.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ textAlign: "center" }}><input type="checkbox" /></td>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0284c7" }}>{s.code}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500 }}>{s.name}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{s.taxCode}</td>
                  <td style={{ padding: "8px 10px", color: "#475569" }}>{s.address}</td>
                  <td style={{ padding: "8px 10px" }}>{s.contact}</td>
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>{s.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {renderModals()}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 8. DEFAULT TAB: QUY TRÌNH (FLOWCHART WORKSPACE FOR PURCHASES)
  // -------------------------------------------------------------------------
  return (
    <div
      className="ref-process-wrapper"
      style={{
        background: "#f1f5f9",
        minHeight: "100%",
        padding: "24px 28px",
        overflowY: "auto",
      }}
    >
      <div
        className="ref-process-layout"
        style={{
          maxWidth: 1080,
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.3fr) minmax(250px, 1fr)",
          gap: 14,
          margin: "0 auto",
        }}
      >
        {/* Panel 1: NGHIỆP VỤ MUA HÀNG (Flowchart matching screenshot) */}
        <section
          className="ref-process-panel"
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            overflow: "visible",
            position: "relative",
            zIndex: 20,
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              margin: 0,
              padding: "16px 10px 12px 10px",
              borderBottom: "1px solid #f1f5f9",
              color: "#1e293b",
              letterSpacing: "0.5px",
            }}
          >
            NGHIỆP VỤ MUA HÀNG
          </h2>

          <div
            className="ref-process-canvas"
            style={{
              position: "relative",
              height: 330,
              margin: "0 10px",
              overflow: "visible",
            }}
          >
            {/* SVG Connecting Flow Lines matching user screenshot */}
            <svg
              viewBox="0 0 660 300"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <defs>
                <marker id="misa-arrow-pur" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>

              {/* 1. Left vertical link with 2 circle ends */}
              <circle cx="75" cy="115" r="3.2" fill="#94a3b8" />
              <circle cx="75" cy="175" r="3.2" fill="#94a3b8" />
              <path d="M 75 115 L 75 175" stroke="#94a3b8" strokeWidth="1.8" fill="none" />

              {/* 2. Main horizontal axis line */}
              <path d="M 75 145 L 610 145" stroke="#94a3b8" strokeWidth="1.5" fill="none" markerEnd="url(#misa-arrow-pur)" />

              {/* 3. Col 2: Nhận hàng hóa, dịch vụ <-> Nhận hóa đơn */}
              <path d="M 238 145 L 238 115" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              <path d="M 238 145 L 238 175" stroke="#94a3b8" strokeWidth="1.5" fill="none" />

              {/* 4. Col 3: Xử lý hóa đơn đầu vào <-> Trả lại hàng mua */}
              <circle cx="408" cy="125" r="3" fill="#94a3b8" />
              <path d="M 408 145 L 408 125" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              <circle cx="408" cy="175" r="3" fill="#94a3b8" />
              <path d="M 408 145 L 408 175" stroke="#94a3b8" strokeWidth="1.5" fill="none" />

              {/* 5. Col 4: Trả tiền theo hóa đơn <-> Giảm giá hàng mua */}
              <circle cx="578" cy="125" r="3" fill="#94a3b8" />
              <path d="M 578 145 L 578 125" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
              <circle cx="578" cy="175" r="3" fill="#94a3b8" />
              <path d="M 578 145 L 578 175" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
            </svg>

            {/* Col 1 Top: Đơn mua hàng */}
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 20,
                width: 110,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => setShowOrderModal(true)}
              title="Lập Đơn mua hàng"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="5" width="22" height="27" rx="3.5" fill="#059669" />
                  <path d="M 23 5 L 29 11 L 23 11 Z" fill="#047857" />
                  <path d="M 11 11 L 20 11 M 11 15 L 25 15 M 11 19 L 19 19" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                  <rect x="18" y="18" width="14" height="13" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                  <rect x="23" y="18" width="4" height="13" fill="#ffffff" opacity="0.85" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Đơn mua hàng
              </span>
            </div>

            {/* Col 1 Bottom: Hợp đồng mua hàng */}
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 185,
                width: 110,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => setShowContractModal(true)}
              title="Quản lý Hợp đồng mua hàng"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="5" width="22" height="27" rx="3.5" fill="#059669" />
                  <path d="M 23 5 L 29 11 L 23 11 Z" fill="#047857" />
                  <path d="M 11 11 L 20 11 M 11 15 L 25 15 M 11 19 L 25 19" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="23" cy="22" r="5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                  <path d="M 20 25 L 18 31 L 21 29 L 23 31 L 23 25" fill="#f59e0b" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Hợp đồng<br />mua hàng
              </span>
            </div>

            {/* Col 2 Top: Nhận hàng hóa, dịch vụ (With Dropdown Menu matching screenshot) */}
            <div
              style={{
                position: "absolute",
                left: 175,
                top: 20,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                zIndex: activeFlowchartMenu === "receive-goods" ? 60 : 10,
              }}
              onMouseEnter={() => handleFlowchartMouseEnter("receive-goods")}
              onMouseLeave={handleFlowchartMouseLeave}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
                onClick={() =>
                  setActiveFlowchartMenu((prev) => (prev === "receive-goods" ? null : "receive-goods"))
                }
                title="Nhận hàng hóa, dịch vụ"
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: "#e8f7f0",
                    border: "1px solid #a7f3d0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect x="5" y="7" width="27" height="23" rx="4" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <rect x="16" y="7" width="6" height="23" fill="#b45309" />
                    <path d="M 5 13 L 32 13" stroke="#d97706" strokeWidth="0.8" />
                    {/* Green doc badge with checkmark on bottom-right */}
                    <rect x="18" y="15" width="15" height="17" rx="2.5" fill="#059669" stroke="#ffffff" strokeWidth="1" />
                    <path d="M 29 15 L 33 19 L 29 19 Z" fill="#047857" />
                    <path d="M 21 23 L 24 26 L 30 20" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "#00b06b",
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  Nhận hàng<br />hóa, dịch vụ
                </span>
              </div>

              {/* Action Dropdown matching screenshot */}
              {activeFlowchartMenu === "receive-goods" && (
                <div
                  className="ref-action-options"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 200,
                    zIndex: 100,
                    background: "#ffffff",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                  }}
                  onMouseEnter={() => handleFlowchartMouseEnter("receive-goods")}
                  onMouseLeave={handleFlowchartMouseLeave}
                >
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "9px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      transition: "background 0.15s, color 0.15s",
                      display: "block",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFlowchartMenu(null);
                      setVoucherKindOption("goods");
                      setShowVoucherModal(true);
                    }}
                  >
                    Chứng từ mua hàng
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "9px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      transition: "background 0.15s, color 0.15s",
                      display: "block",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFlowchartMenu(null);
                      setVoucherKindOption("service");
                      setShowServiceModal(true);
                    }}
                  >
                    Chứng từ mua dịch vụ
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "9px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      transition: "background 0.15s, color 0.15s",
                      display: "block",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFlowchartMenu(null);
                      setVoucherKindOption("multi");
                      setShowMultiInvoiceModal(true);
                    }}
                  >
                    Mua hàng nhiều hóa đơn
                  </button>
                </div>
              )}
            </div>

            {/* Col 2 Bottom: Nhận hóa đơn */}
            <div
              style={{
                position: "absolute",
                left: 175,
                top: 185,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => {
                if (href) {
                  window.location.href = href("/purchases/invoices");
                } else {
                  setShowReceiveInvoiceModal(true);
                }
              }}
              title="Nhận hóa đơn mua hàng"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="5" width="22" height="27" rx="3.5" fill="#059669" />
                  <path d="M 23 5 L 29 11 L 23 11 Z" fill="#047857" />
                  <path d="M 11 11 L 20 11 M 11 15 L 25 15 M 11 19 L 25 19 M 11 23 L 20 23" stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="23" cy="23" r="4.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
                  <path d="M 21 23 L 25 23 M 23 21 L 23 25" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Nhận hóa đơn
              </span>
            </div>

            {/* Col 3 Top: Xử lý hóa đơn đầu vào */}
            <div
              style={{
                position: "absolute",
                left: 345,
                top: 20,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => notify("Đang mở chức năng Xử lý hóa đơn đầu vào MISA meInvoice...")}
              title="Xử lý hóa đơn đầu vào"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <circle cx="19" cy="19" r="14" fill="#2563eb" />
                  <path d="M 12 15 C 15 12, 19 12, 26 15" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M 12 19 C 15 16, 19 16, 26 19" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <path d="M 12 23 C 15 20, 19 20, 26 23" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Xử lý hóa<br />đơn đầu vào
              </span>
            </div>

            {/* Col 3 Bottom: Trả lại hàng mua */}
            <div
              style={{
                position: "absolute",
                left: 345,
                top: 185,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => setShowReturnModal(true)}
              title="Lập chứng từ trả lại hàng mua"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="5" width="22" height="27" rx="3.5" fill="#059669" />
                  <path d="M 23 5 L 29 11 L 23 11 Z" fill="#047857" />
                  <path d="M 19 12 A 4.5 4.5 0 1 1 14.5 16.5" stroke="#ffffff" strokeWidth="1.8" fill="none" />
                  <path d="M 19 9.5 L 19 13.5 L 22.5 13.5" fill="#ffffff" />
                  <rect x="18" y="18" width="13" height="13" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                  <rect x="22.5" y="18" width="4" height="13" fill="#ffffff" opacity="0.85" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Trả lại<br />hàng mua
              </span>
            </div>

            {/* Col 4 Top: Trả tiền theo hóa đơn */}
            <div
              style={{
                position: "absolute",
                left: 515,
                top: 20,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => setShowSupplierPaymentModal(true)}
              title="Trả tiền nhà cung cấp theo hóa đơn"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="6" y="9" width="22" height="18" rx="3" fill="#059669" stroke="#047857" strokeWidth="0.8" />
                  <rect x="9" y="13" width="7" height="5" rx="1" fill="#f59e0b" />
                  <path d="M 9 22 L 18 22" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 23 18 L 32 18 M 28 14 L 32 18 L 28 22" stroke="#059669" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Trả tiền theo<br />hóa đơn
              </span>
            </div>

            {/* Col 4 Bottom: Giảm giá hàng mua */}
            <div
              style={{
                position: "absolute",
                left: 515,
                top: 185,
                width: 125,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => setShowDiscountModal(true)}
              title="Lập chứng từ Giảm giá hàng mua"
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#e8f7f0",
                  border: "1px solid #a7f3d0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="7" y="5" width="22" height="27" rx="3.5" fill="#059669" />
                  <path d="M 23 5 L 29 11 L 23 11 Z" fill="#047857" />
                  <circle cx="15.5" cy="13.5" r="1.5" fill="#ffffff" />
                  <circle cx="20.5" cy="18.5" r="1.5" fill="#ffffff" />
                  <path d="M 21 12 L 15 20" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                  <rect x="18" y="18" width="13" height="13" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                  <rect x="22.5" y="18" width="4" height="13" fill="#ffffff" opacity="0.85" />
                </svg>
              </div>
              <span style={{ fontSize: 12.5, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Giảm giá<br />hàng mua
              </span>
            </div>
          </div>
        </section>

        {/* Panel 2: BÁO CÁO (Right Column) */}
        <aside
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: 0,
              padding: "14px 16px",
              borderBottom: "1px solid #f1f5f9",
              color: "#1e293b",
            }}
          >
            BÁO CÁO MUA HÀNG
          </h2>

          <ul style={{ listStyle: "none", margin: 0, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <li>
              <span style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }} onClick={() => notify("Mở Sổ chi tiết mua hàng...")}>
                • Sổ chi tiết mua hàng
              </span>
            </li>
            <li>
              <span style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }} onClick={() => notify("Mở Bảng kê hóa đơn mua vào...")}>
                • Bảng kê hóa đơn dịch vụ mua vào
              </span>
            </li>
            <li>
              <span style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }} onClick={() => notify("Mở Báo cáo công nợ nhà cung cấp...")}>
                • Báo cáo công nợ phải trả NCC
              </span>
            </li>
            <li>
              <span style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }} onClick={() => notify("Mở Báo cáo tình hình thực hiện đơn mua hàng...")}>
                • Tình hình thực hiện đơn mua hàng
              </span>
            </li>
            <li>
              <span style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", fontWeight: 500 }} onClick={() => notify("Mở Báo cáo theo dõi hợp đồng mua...")}>
                • Theo dõi tiến độ hợp đồng mua
              </span>
            </li>
          </ul>

          <div style={{ marginTop: "auto", padding: "12px 14px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
            <span style={{ fontSize: 12, color: "#059669", cursor: "pointer", fontWeight: 600 }} onClick={() => notify("Mở tất cả báo cáo mua hàng...")}>
              Tất cả báo cáo mua hàng →
            </span>
          </div>
        </aside>

        {/* Panel 3: Quick Action Buttons (Bottom Bar spanning full width) */}
        <div
          style={{
            gridColumn: "1 / -1",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            overflow: "hidden",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            type="button"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", background: "#ffffff", border: "none", borderRight: "1px solid #f1f5f9", cursor: "pointer", fontSize: 12, color: "#334155" }}
            onClick={() => setShowSupplierModal(true)}
          >
            <Building2 size={20} style={{ color: "#00b06b" }} />
            <span>Nhà cung cấp</span>
          </button>

          <button
            type="button"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", background: "#ffffff", border: "none", borderRight: "1px solid #f1f5f9", cursor: "pointer", fontSize: 12, color: "#334155" }}
            onClick={() => notify("Xem danh mục Hàng hóa, dịch vụ")}
          >
            <Package size={20} style={{ color: "#f59e0b" }} />
            <span>Hàng hóa, dịch vụ</span>
          </button>

          <button
            type="button"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", background: "#ffffff", border: "none", borderRight: "1px solid #f1f5f9", cursor: "pointer", fontSize: 12, color: "#334155" }}
            onClick={() => setShowReconciliationModal(true)}
          >
            <FileCheck size={20} style={{ color: "#0284c7" }} />
            <span>Đối trừ chứng từ</span>
          </button>

          <button
            type="button"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", background: "#ffffff", border: "none", borderRight: "1px solid #f1f5f9", cursor: "pointer", fontSize: 12, color: "#334155" }}
            onClick={() => notify("Mở Bù trừ công nợ...")}
          >
            <CreditCard size={20} style={{ color: "#8b5cf6" }} />
            <span>Bù trừ công nợ</span>
          </button>

          <button
            type="button"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "14px 8px", background: "#ffffff", border: "none", cursor: "pointer", fontSize: 12, color: "#334155" }}
            onClick={() => notify("Tùy chọn thiết lập phân hệ Mua hàng...")}
          >
            <SlidersHorizontal size={20} style={{ color: "#64748b" }} />
            <span>Tùy chọn</span>
          </button>
        </div>
      </div>

      {renderModals()}
    </div>
  );
}
