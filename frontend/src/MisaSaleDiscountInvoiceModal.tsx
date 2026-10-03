import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  Calendar,
  Plus,
  Trash2,
  FileText,
  Search,
  Settings,
  Info,
  Globe,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Paperclip,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

export interface DiscountInvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
  vatAmount: number;
}

export interface SaleInvoiceDiscountModalProps {
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleInvoiceDiscountModal({
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleInvoiceDiscountModalProps) {
  // Master fields Left
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || initialData?.customerName || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [budgetUnitCode, setBudgetUnitCode] = useState(initialData?.budgetUnitCode || "");
  const [idCardNumber, setIdCardNumber] = useState(initialData?.idCardNumber || "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber || "");
  const [buyerName, setBuyerName] = useState(initialData?.buyerName || initialData?.contact || "");
  const [payMethod, setPayMethod] = useState(initialData?.paymentMethod || "TM/CK");
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || "");
  const [salesEmployee, setSalesEmployee] = useState(initialData?.salesEmployee || "");
  const [registryNo, setRegistryNo] = useState(initialData?.registryNo || "BK00001");
  const [registryDate, setRegistryDate] = useState(initialData?.registryDate || "02/10/2026");
  const [description, setDescription] = useState(initialData?.description || "");
  const [province, setProvince] = useState(initialData?.province || "");
  const [ward, setWard] = useState(initialData?.ward || "");

  // Master fields Right (Invoice Metadata)
  const [invoiceTemplate, setInvoiceTemplate] = useState(initialData?.invoiceTemplate || "");
  const [invoiceSeries, setInvoiceSeries] = useState(initialData?.invoiceSeries || "");
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoiceNo || "");
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoiceDate || "02/10/2026");

  // Tab & options
  const [activeTab, setActiveTab] = useState<"items" | "related">("items");
  const [autoCalculate, setAutoCalculate] = useState<boolean>(false);

  // Extra fields below table
  const [storeCode, setStoreCode] = useState(initialData?.storeCode || "");
  const [storeName, setStoreName] = useState(initialData?.storeName || "");
  const [lookupCode, setLookupCode] = useState(initialData?.lookupCode || "");
  const [lookupUrl, setLookupUrl] = useState(initialData?.lookupUrl || "");

  // Items
  const [items, setItems] = useState<DiscountInvoiceItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) return initialData.items;
    return [
      {
        id: "disc-item-1",
        itemCode: "",
        itemName: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
      },
    ];
  });

  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode || "");
      setAddress(found.address || "");
      setBuyerName(found.contact || "");
      setPhone(found.phone || "");
    }
  };

  const handleItemChange = (idx: number, field: keyof DiscountInvoiceItem, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: val };

      if (field === "itemCode") {
        const found = SAMPLE_SALE_ITEMS.find((it) => it.code === val);
        if (found) {
          item.itemName = found.name;
          item.unit = found.unit;
          item.unitPrice = found.price;
          item.vatRate = found.vat;
          item.amount = Math.round(item.quantity * found.price);
          const v = Number(found.vat) || 0;
          item.vatAmount = Math.round((item.amount * v) / 100);
        }
      }

      if (field === "quantity" || field === "unitPrice") {
        const q = field === "quantity" ? Number(val) || 0 : item.quantity;
        const p = field === "unitPrice" ? Number(val) || 0 : item.unitPrice;
        item.amount = Math.round(q * p);
        const v = Number(item.vatRate) || 0;
        item.vatAmount = Math.round((item.amount * v) / 100);
      }

      if (field === "vatRate") {
        const v = Number(val) || 0;
        item.vatAmount = Math.round((item.amount * v) / 100);
      }

      next[idx] = item;
      return next;
    });
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `disc-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
      },
    ]);
  };

  const handleClearAllRows = () => {
    setItems([
      {
        id: `disc-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
      },
    ]);
    notify("Đã xóa hết các dòng dữ liệu");
  };

  const handleDeleteRow = (idx: number) => {
    if (items.length <= 1) {
      handleClearAllRows();
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVat = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const grandTotal = totalAmount + totalVat;

  const handleSave = (publish = false) => {
    const payload = {
      invoiceType: "Hóa đơn chiết khấu",
      customerCode,
      customerName,
      address,
      phone,
      taxCode,
      budgetUnitCode,
      idCardNumber,
      passportNumber,
      buyerName,
      paymentMethod: payMethod,
      bankAccount,
      salesEmployee,
      registryNo,
      registryDate,
      description,
      province,
      ward,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      storeCode,
      storeName,
      lookupCode,
      lookupUrl,
      items,
      amount: totalAmount,
      vatAmount: totalVat,
      totalPayment: grandTotal,
      publish,
    };

    onSubmit(payload);
    notify(
      publish
        ? `Đã lưu và chuẩn bị phát hành Hóa đơn chiết khấu ${invoiceNo || ""}!`
        : `Đã lưu Hóa đơn chiết khấu ${invoiceNo || ""} thành công!`
    );
    onClose();
  };

  return (
    <div
      className="misa-purchase-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "98.5vw",
          height: "97vh",
          background: "#ffffff",
          borderRadius: 6,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ================================================================= */}
        {/* 1. TOP HEADER (MATCHING SCREENSHOT 1)                             */}
        {/* ================================================================= */}
        <header
          style={{
            height: 42,
            padding: "0 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Reload icon */}
            <button
              type="button"
              onClick={() => notify("Làm mới thông tin hóa đơn chiết khấu")}
              title="Lịch sử hóa đơn"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              <RotateCcw size={16} />
            </button>

            {/* Title */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Hóa đơn chiết khấu
            </h2>

            {/* Link hướng dẫn màu xanh dương như Screenshot 1 */}
            <a
              href="#guide"
              onClick={(e) => {
                e.preventDefault();
                notify("Mở tài liệu: Hướng dẫn lập hóa đơn chiết khấu thương mại");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12.5,
                color: "#0284c7",
                textDecoration: "none",
                marginLeft: 10,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <HelpCircle size={14} />
              <span>Hướng dẫn lập hóa đơn chiết khấu</span>
            </a>
          </div>

          {/* Right Header Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              title="Phím tắt"
              onClick={() => notify("Phím tắt: F3 (Tìm kiếm), F9 (Thêm dòng), Ctrl+S (Cất)")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M6 12h.001M10 12h.001M14 12h.001M18 12h.001M7 16h10" />
              </svg>
            </button>

            <button
              type="button"
              title="Tùy chọn giao diện"
              onClick={() => notify("Cài đặt mẫu hóa đơn chiết khấu")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Settings size={16} />
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. MASTER FORM SECTION (MATCHING SCREENSHOT 1)                    */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "12px 18px 8px 18px",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20 }}>
            {/* Left Column (6 Rows) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: Đối tượng | Địa chỉ | Điện thoại */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Đối tượng
                  </label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        height: 28,
                        padding: "0 2px 0 6px",
                        background: "#ffffff",
                        flex: 1,
                        boxSizing: "border-box",
                      }}
                    >
                      <input
                        type="text"
                        value={customerCode}
                        onChange={(e) => setCustomerCode(e.target.value)}
                        style={{ border: "none", outline: "none", width: "100%", height: "100%", padding: 0, fontSize: 12.5 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenCustomerModal) onOpenCustomerModal();
                          else notify("Thêm nhanh đối tượng mới");
                        }}
                        style={{ background: "none", border: "none", color: "#00b06b", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = SAMPLE_SALE_CUSTOMERS[0];
                          handleSelectCustomer(next.code);
                        }}
                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => notify(`Số dư công nợ của ${customerName || "đối tượng"}: 0 đ`)}
                      title="Xem số dư công nợ"
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        width: 28,
                        height: 28,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475569",
                        cursor: "pointer",
                        flexShrink: 0,
                        boxSizing: "border-box",
                      }}
                    >
                      $
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Điện thoại
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Mã số thuế/CCCD chủ hộ | Mã số ĐVQHNS | Số CCCD | Số hộ chiếu */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 140px 140px 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Mã số thuế/CCCD chủ hộ
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Globe size={13} style={{ color: "#94a3b8", cursor: "pointer" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Mã số ĐVQHNS
                  </label>
                  <input
                    type="text"
                    value={budgetUnitCode}
                    onChange={(e) => setBudgetUnitCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Số CCCD
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Search size={13} style={{ color: "#94a3b8", cursor: "pointer" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Số hộ chiếu
                  </label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Người mua hàng ⓘ | Hình thức thanh toán | Tài khoản ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 140px 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontWeight: 500 }}>
                    <span>Người mua hàng</span>
                    <Info size={12} style={{ color: "#0284c7" }} />
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Hình thức thanh toán
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 4px 0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", cursor: "pointer" }}
                    >
                      <option value="TM/CK">TM/CK</option>
                      <option value="Tiền mặt">Tiền mặt</option>
                      <option value="Chuyển khoản">Chuyển khoản</option>
                    </select>
                    <ChevronDown size={13} style={{ color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Tài khoản ngân hàng
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 4px 0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <select
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", cursor: "pointer" }}
                    >
                      <option value=""></option>
                      <option value="19034567890123">19034567890123 - Techcombank</option>
                      <option value="0011004567890">0011004567890 - Vietcombank</option>
                    </select>
                    <ChevronDown size={13} style={{ color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>
              </div>

              {/* Row 4: Nhân viên bán hàng | Số bảng kê | Ngày bảng kê */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 180px 180px", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Nhân viên bán hàng
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 4px 0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={salesEmployee}
                      onChange={(e) => setSalesEmployee(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                    />
                    <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                    <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Số bảng kê
                  </label>
                  <input
                    type="text"
                    value={registryNo}
                    onChange={(e) => setRegistryNo(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Ngày bảng kê
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={registryDate}
                      onChange={(e) => setRegistryDate(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                    />
                    <Calendar size={12} style={{ color: "#94a3b8" }} />
                  </div>
                </div>
              </div>

              {/* Row 5: Diễn giải (with AI Sparkles) */}
              <div>
                <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                  Diễn giải
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    height: 28,
                    padding: "0 6px 0 8px",
                    background: "#ffffff",
                  }}
                >
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDescription("Chiết khấu thương mại theo bảng kê số " + registryNo);
                      notify("AVA Kế toán: Đã tự động tạo diễn giải nghiệp vụ chiết khấu!");
                    }}
                    title="Gợi ý diễn giải thông minh"
                    style={{ background: "none", border: "none", color: "#8b5cf6", cursor: "pointer", padding: "2px" }}
                  >
                    <Sparkles size={14} />
                  </button>
                </div>
              </div>

              {/* Row 6: Tỉnh/Thành phố | Xã/Phường | Tham chiếu ... */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 180px auto", gap: 10, alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Tỉnh/Thành phố
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 4px 0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <select
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", cursor: "pointer" }}
                    >
                      <option value=""></option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                    </select>
                    <ChevronDown size={13} style={{ color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Xã/Phường
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 4px 0 6px",
                      background: "#ffffff",
                    }}
                  >
                    <select
                      value={ward}
                      onChange={(e) => setWard(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", cursor: "pointer" }}
                    >
                      <option value=""></option>
                      <option value="Láng Hạ">Phường Láng Hạ</option>
                      <option value="Cát Linh">Phường Cát Linh</option>
                      <option value="Thành Công">Phường Thành Công</option>
                    </select>
                    <ChevronDown size={13} style={{ color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>

                <div style={{ paddingTop: 16 }}>
                  <a
                    href="#ref"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Mở danh sách chứng từ tham chiếu...");
                    }}
                    style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                  >
                    Tham chiếu ...
                  </a>
                </div>
              </div>
            </div>

            {/* Right Column: Invoice Metadata & Status */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Badge & Grand Total */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span
                  style={{
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "3px 10px",
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                  }}
                >
                  CHƯA PHÁT HÀNH
                </span>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Tổng tiền thanh toán</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", lineHeight: 1.1 }}>
                  {grandTotal === 0 ? "0" : formatVND(grandTotal)}
                </div>
              </div>

              {/* Mẫu số HĐ */}
              <div>
                <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                  Mẫu số HĐ
                </label>
                <input
                  type="text"
                  value={invoiceTemplate}
                  onChange={(e) => setInvoiceTemplate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Ký hiệu HĐ */}
              <div>
                <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                  Ký hiệu HĐ
                </label>
                <input
                  type="text"
                  value={invoiceSeries}
                  onChange={(e) => setInvoiceSeries(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Số hóa đơn */}
              <div>
                <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                  Số hóa đơn
                </label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 8px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Ngày HĐ ⓘ */}
              <div>
                <label style={{ fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 4, marginBottom: 3, fontWeight: 500 }}>
                  <span>Ngày HĐ</span>
                  <Info size={12} style={{ color: "#0284c7" }} />
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    height: 28,
                    padding: "0 6px",
                    background: "#ffffff",
                  }}
                >
                  <input
                    type="text"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                  />
                  <Calendar size={12} style={{ color: "#94a3b8" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. TAB BAR: HÀNG TIỀN / BẢNG KÊ CÁC HÓA ĐƠN LIÊN QUAN            */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "0 18px",
            borderBottom: "1px solid #cbd5e1",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", gap: 20 }}>
            <div
              onClick={() => setActiveTab("items")}
              style={{
                padding: "8px 4px",
                borderBottom: activeTab === "items" ? "2px solid #00b06b" : "2px solid transparent",
                color: activeTab === "items" ? "#00b06b" : "#64748b",
                fontWeight: activeTab === "items" ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Hàng tiền
            </div>
            <div
              onClick={() => setActiveTab("related")}
              style={{
                padding: "8px 4px",
                borderBottom: activeTab === "related" ? "2px solid #00b06b" : "2px solid transparent",
                color: activeTab === "related" ? "#00b06b" : "#64748b",
                fontWeight: activeTab === "related" ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Bảng kê các hóa đơn liên quan
            </div>
          </div>

          {/* Right tools on tab bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12.5, color: "#334155" }}>
              <input
                type="checkbox"
                checked={autoCalculate}
                onChange={(e) => setAutoCalculate(e.target.checked)}
                style={{ accentColor: "#00b06b", width: 14, height: 14, cursor: "pointer" }}
              />
              <span>Tự động tính toán số liệu</span>
            </label>

            <button
              type="button"
              onClick={() => notify("Mở danh sách chọn các hóa đơn liên quan để lập chiết khấu...")}
              style={{
                height: 26,
                padding: "0 12px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                color: "#1e293b",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Chọn hóa đơn liên quan
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. ITEMS TABLE (SOLID BORDERS, NO DASHED!)                        */}
        {/* ================================================================= */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 18px 0 18px", background: "#f8fafc" }}>
          {activeTab === "items" ? (
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto", background: "#ffffff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                <thead>
                  <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                    <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                    <th style={{ width: 130, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      📌 Mã hàng
                    </th>
                    <th style={{ minWidth: 200, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      Tên hàng
                    </th>
                    <th style={{ width: 70, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      ĐVT
                    </th>
                    <th style={{ width: 85, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      Số lượng
                    </th>
                    <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      Đơn giá
                    </th>
                    <th style={{ width: 120, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      Thành tiền
                    </th>
                    <th style={{ width: 95, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      % thuế GTGT
                    </th>
                    <th style={{ width: 120, textAlign: "right", padding: "4px 8px" }}>
                      Tiền thuế GTGT
                    </th>
                    <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #cbd5e1", height: 32 }}>
                      <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>
                        {idx + 1}
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                        <input
                          type="text"
                          value={row.itemCode}
                          onChange={(e) => handleItemChange(idx, "itemCode", e.target.value)}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                        />
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                        <input
                          type="text"
                          value={row.itemName}
                          onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                        />
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "center" }}>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, textAlign: "center" }}
                        />
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, textAlign: "right" }}
                        />
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                        <input
                          type="text"
                          value={row.unitPrice === 0 ? "0,00" : formatVND(row.unitPrice)}
                          onChange={(e) => {
                            const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                            handleItemChange(idx, "unitPrice", v);
                          }}
                          style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, textAlign: "right" }}
                        />
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                        {row.amount === 0 ? "0" : formatVND(row.amount)}
                      </td>

                      <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "center" }}>
                        <select
                          value={row.vatRate}
                          onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                          style={{ border: "none", background: "transparent", fontSize: 12.5, outline: "none", width: "100%", textAlign: "center" }}
                        >
                          <option value="">0%</option>
                          <option value="5">5%</option>
                          <option value="8">8%</option>
                          <option value="10">10%</option>
                          <option value="KCT">KCT</option>
                        </select>
                      </td>

                      <td style={{ padding: "2px 8px", textAlign: "right" }}>
                        {row.vatAmount === 0 ? "0" : formatVND(row.vatAmount)}
                      </td>

                      <td style={{ textAlign: "center", padding: "2px" }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(idx)}
                          title="Xóa dòng"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "2px",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* SUMMARY ROW MATCHING SCREENSHOT 1 */}
                  <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                      {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                      {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                    </td>
                    <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ textAlign: "right", padding: "2px 8px" }}>
                      {totalVat === 0 ? "0" : formatVND(totalVat)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: 30, background: "#ffffff", textAlign: "center", color: "#64748b" }}>
              <FileText size={32} style={{ color: "#00b06b", marginBottom: 8 }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Bảng kê các hóa đơn liên quan</div>
              <div style={{ fontSize: 12 }}>Chưa có hóa đơn liên quan nào được chọn. Nhấn nút "Chọn hóa đơn liên quan" để thêm hóa đơn.</div>
            </div>
          )}

          {/* =============================================================== */}
          {/* 5. CONTROLS BELOW TABLE (SOLID BORDERS, NO DASHED!)             */}
          {/* =============================================================== */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 20,
              marginTop: 8,
              alignItems: "start",
            }}
          >
            {/* Left Column: Action Buttons & Extra Sub-form */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  onClick={handleAddRow}
                  style={{
                    height: 28,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    color: "#1e293b",
                  }}
                >
                  <Plus size={14} style={{ color: "#00b06b" }} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllRows}
                  style={{
                    height: 28,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    color: "#ef4444",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddRow}
                  style={{
                    height: 28,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    color: "#1e293b",
                  }}
                >
                  <FileText size={13} style={{ color: "#64748b" }} />
                  <span>Thêm ghi chú</span>
                </button>
              </div>

              {/* Sub-form below buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
                {/* Row 1: Mã cửa hàng | Tên cửa hàng */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Mã cửa hàng
                    </label>
                    <input
                      type="text"
                      value={storeCode}
                      onChange={(e) => setStoreCode(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Tên cửa hàng
                    </label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Mã tra cứu HĐĐT
                    </label>
                    <input
                      type="text"
                      value={lookupCode}
                      onChange={(e) => setLookupCode(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Đường dẫn tra cứu HĐĐT
                    </label>
                    <input
                      type="text"
                      value={lookupUrl}
                      onChange={(e) => setLookupUrl(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Row 3: Drag & Drop Attachment Box (SOLID BORDER, NO DASHED!) */}
                <div style={{ marginTop: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#334155", marginBottom: 4, fontWeight: 500 }}>
                    <Paperclip size={13} style={{ color: "#64748b" }} />
                    <span>Đính kèm</span>
                    <span style={{ color: "#64748b", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                  </div>

                  <div
                    onClick={() => notify("Chọn tệp tài liệu đính kèm...")}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      background: "#f8fafc",
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      gap: 6,
                    }}
                  >
                    <UploadCloud size={20} style={{ color: "#00a862" }} />
                    <span style={{ fontSize: 12, color: "#0284c7" }}>
                      Chọn tệp hoặc kéo và thả tệp vào đây
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Pagination & Totals Summary Box */}
            <div>
              {/* Pagination */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                  fontSize: 12,
                  color: "#64748b",
                  marginBottom: 10,
                }}
              >
                <span>Tổng số: <strong>{items.length}</strong></span>
                <span>Số dòng/trang</span>
                <select
                  defaultValue="20"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    height: 24,
                    padding: "0 4px",
                    fontSize: 12,
                    background: "#ffffff",
                    outline: "none",
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <span style={{ marginLeft: 6 }}>|&lt; &lt; <strong>1</strong> &gt; &gt;|</span>
              </div>

              {/* Totals summary matching Screenshot 1 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "12px 14px",
                  background: "#ffffff",
                  borderRadius: 4,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                  <span>Tổng tiền hàng</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalAmount === 0 ? "0" : formatVND(totalAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                  <span>Thuế GTGT</span>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalVat === 0 ? "0" : formatVND(totalVat)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  <span>Tổng tiền thanh toán</span>
                  <span style={{ fontWeight: 700, color: "#1e293b" }}>{grandTotal === 0 ? "0" : formatVND(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 6. MODAL FOOTER (MATCHING SCREENSHOT 1)                           */}
        {/* ================================================================= */}
        <div
          style={{
            height: 46,
            padding: "0 18px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            background: "#ffffff",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 30,
              padding: "0 18px",
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
            onClick={() => handleSave(false)}
            style={{
              height: 30,
              padding: "0 18px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
          >
            Cất
          </button>

          {/* Button: Cất và Phát hành hóa đơn */}
          <button
            type="button"
            onClick={() => handleSave(true)}
            style={{
              height: 30,
              padding: "0 18px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            Cất và Phát hành hóa đơn
          </button>
        </div>
      </div>
    </div>
  );
}
