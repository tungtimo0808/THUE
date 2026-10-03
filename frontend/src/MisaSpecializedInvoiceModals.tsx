import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  Calendar,
  Plus,
  Trash2,
  Search,
  Pin,
  Keyboard,
  Settings,
  Info,
  Globe,
  RotateCcw,
  Paperclip,
  FileText,
  Sparkles,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

// Common customer list fallback
const DEFAULT_CUSTOMERS = SAMPLE_SALE_CUSTOMERS || [
  { code: "KH001", name: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", taxCode: "0102345678" },
  { code: "KH002", name: "Công ty TNHH Thiết bị Điện Hoàng Gia", taxCode: "0103456789" },
  { code: "KH003", name: "Tập đoàn Điện lực Việt Nam EVN", taxCode: "0100100079" },
];

export interface SpecializedInvoiceModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
}

// 1. MODAL: HÓA ĐƠN CHIẾT KHẤU (REDESIGNED MATCHING USER SCREENSHOT 1)
// ============================================================================
export {
  SaleInvoiceDiscountModal,
  type DiscountInvoiceItem,
  type SaleInvoiceDiscountModalProps,
} from "./MisaSaleDiscountInvoiceModal";

// ============================================================================
// 2. MODAL: HÓA ĐƠN THƯƠNG MẠI (REDESIGNED MATCHING USER SCREENSHOT 2)
// ============================================================================
export {
  SaleCommercialInvoiceModal,
  type CommercialInvoiceItem,
  type SaleCommercialInvoiceModalProps,
} from "./MisaSaleCommercialInvoiceModal";

// ============================================================================
// 3. MODAL: HÓA ĐƠN ĐIỀU CHỈNH (MATCHING SCREENSHOT 3)
// ============================================================================
export interface AdjustmentInvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  isTradeDiscount: boolean;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discountRate: number;
  discountAmount: number;
}

export function SaleInvoiceAdjustmentModal({
  onClose,
  onSubmit,
  onOpenCustomerModal,
}: SpecializedInvoiceModalProps) {
  // Top Filter
  const [targetInvoiceSearch, setTargetInvoiceSearch] = useState<string>("");
  const [isCommercialInvoice, setIsCommercialInvoice] = useState<boolean>(false);

  // Master fields Left
  const [customerCode, setCustomerCode] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [taxCode, setTaxCode] = useState<string>("");
  const [budgetUnitCode, setBudgetUnitCode] = useState<string>("");
  const [idCardNumber, setIdCardNumber] = useState<string>("");
  const [passportNumber, setPassportNumber] = useState<string>("");
  const [buyerName, setBuyerName] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("TM/CK");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("Điều chỉnh tăng");
  const [adjustContent, setAdjustContent] = useState<string>("");
  const [salesEmployee, setSalesEmployee] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [ward, setWard] = useState<string>("");

  // Master fields Right
  const [invoiceTemplate, setInvoiceTemplate] = useState<string>("");
  const [invoiceSeries, setInvoiceSeries] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>("30/09/2026");

  // Options
  const [autoCalculate, setAutoCalculate] = useState<boolean>(false);
  const [storeCode, setStoreCode] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [lookupCode, setLookupCode] = useState<string>("");
  const [lookupUrl, setLookupUrl] = useState<string>("");

  // Items
  const [items, setItems] = useState<AdjustmentInvoiceItem[]>([
    {
      id: "adj-it-1",
      itemCode: "",
      itemName: "",
      isTradeDiscount: false,
      unit: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      discountRate: 0,
      discountAmount: 0,
    },
  ]);

  const handleCustomerChange = (code: string) => {
    setCustomerCode(code);
    const found = DEFAULT_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode || "");
    }
  };

  const handleItemSelect = (idx: number, code: string) => {
    const it = SAMPLE_SALE_ITEMS?.find((p: any) => p.code === code);
    const newItems = [...items];
    newItems[idx].itemCode = code;
    if (it) {
      newItems[idx].itemName = it.name;
      newItems[idx].unit = it.unit;
      newItems[idx].unitPrice = it.price || 0;
      newItems[idx].amount = newItems[idx].quantity * (it.price || 0);
      newItems[idx].discountAmount = (newItems[idx].amount * Number(newItems[idx].discountRate || 0)) / 100;
    }
    setItems(newItems);
  };

  const handleItemChange = (idx: number, field: keyof AdjustmentInvoiceItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      updated[idx].amount = (Number(updated[idx].quantity) || 0) * (Number(updated[idx].unitPrice) || 0);
      updated[idx].discountAmount = (updated[idx].amount * Number(updated[idx].discountRate || 0)) / 100;
    }
    if (field === "discountRate") {
      updated[idx].discountAmount = (updated[idx].amount * (Number(value) || 0)) / 100;
    }
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `adj-it-${Date.now()}`,
        itemCode: "",
        itemName: "",
        isTradeDiscount: false,
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        discountRate: 0,
        discountAmount: 0,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `adj-it-${Date.now()}`,
          itemCode: "",
          itemName: "",
          isTradeDiscount: false,
          unit: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          discountRate: 0,
          discountAmount: 0,
        },
      ]);
      return;
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalGoods = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalDiscount = items.reduce((s, it) => s + (Number(it.discountAmount) || 0), 0);
  const totalVat = 0;
  const grandTotal = totalGoods - totalDiscount + totalVat;

  const handleSave = (publish = false) => {
    onSubmit({
      invoiceType: "Hóa đơn điều chỉnh",
      targetInvoiceSearch,
      isCommercialInvoice,
      customerCode,
      customerName,
      taxCode,
      address,
      phone,
      buyerName,
      payMethod,
      bankAccount,
      adjustReason,
      adjustContent,
      salesEmployee,
      province,
      ward,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      totalGoods,
      totalDiscount,
      totalVat,
      grandTotal,
      items,
      publish,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1050,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "98vw",
          height: "96vh",
          background: "#ffffff",
          borderRadius: 6,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header (Screenshot 3) */}
        <header
          style={{
            height: 42,
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RotateCcw size={16} style={{ color: "#64748b" }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
              Hóa đơn điều chỉnh
            </h2>
            <a
              href="#guide"
              onClick={(e) => e.preventDefault()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12.5,
                color: "#0284c7",
                textDecoration: "none",
                marginLeft: 14,
                cursor: "pointer",
              }}
            >
              <HelpCircle size={14} />
              <span>Cách ghi thông tin trên hóa đơn điều chỉnh và lập chứng từ hạch toán</span>
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}>
              <Keyboard size={16} />
            </button>
            <button type="button" style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}>
              <Settings size={16} />
            </button>
            <button type="button" style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}>
              <HelpCircle size={16} />
            </button>
            <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2 }}>
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Top Filter Bar (Screenshot 3) */}
        <div style={{ padding: "6px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Chọn hóa đơn cần điều chỉnh</span>
            <div style={{ position: "relative", width: 260 }}>
              <input
                type="text"
                placeholder="Nhập số hóa đơn cần điều chỉnh"
                value={targetInvoiceSearch}
                onChange={(e) => setTargetInvoiceSearch(e.target.value)}
                style={{ width: "100%", height: 26, padding: "0 24px 0 8px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
              />
              <Search size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isCommercialInvoice}
              onChange={(e) => setIsCommercialInvoice(e.target.checked)}
              style={{ width: 14, height: 14, cursor: "pointer" }}
            />
            <span>Là hóa đơn thương mại</span>
          </label>
        </div>

        {/* Master Section (Screenshot 3) */}
        <div style={{ padding: "8px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20 }}>
            {/* Left 6 Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Row 1: Đối tượng | Địa chỉ | Điện thoại */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 140px", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Đối tượng</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <select
                        value={customerCode}
                        onChange={(e) => handleCustomerChange(e.target.value)}
                        style={{
                          width: "100%",
                          height: 26,
                          padding: "0 18px 0 6px",
                          borderRadius: 3,
                          border: "1.5px solid #00b06b",
                          fontSize: 12,
                          background: "#ffffff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value="">-- Chọn khách hàng --</option>
                        {DEFAULT_CUSTOMERS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b" }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCustomerModal && onOpenCustomerModal()}
                      style={{ height: 26, width: 26, minWidth: 26, padding: 0, borderRadius: 3, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#00b06b", cursor: "pointer", display: "grid", placeItems: "center", boxSizing: "border-box" }}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      style={{ height: 26, width: 26, minWidth: 26, padding: 0, borderRadius: 3, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, boxSizing: "border-box" }}
                    >
                      $
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Địa chỉ</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Điện thoại</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Row 2: MST/CCCD chủ hộ | Mã số ĐVQHNS | Số CCCD | Số hộ chiếu */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 140px 140px 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Mã số thuế/CCCD chủ hộ</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 24px 0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <Globe size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Mã số ĐVQHNS</label>
                  <input
                    type="text"
                    value={budgetUnitCode}
                    onChange={(e) => setBudgetUnitCode(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Số CCCD</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 24px 0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <Search size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Số hộ chiếu</label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Row 3: Người mua hàng | Hình thức thanh toán | Tài khoản ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 140px 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span>Người mua hàng</span>
                    <Info size={12} style={{ color: "#0284c7" }} />
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Hình thức thanh toán</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="TM/CK">TM/CK</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Chuyển khoản">Chuyển khoản</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Tài khoản ngân hàng</label>
                  <select
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    <option value="19036789012 - Techcombank">19036789012 - Techcombank</option>
                    <option value="001100456789 - Vietcombank">001100456789 - Vietcombank</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Lý do điều chỉnh | Nội dung điều chỉnh */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Lý do điều chỉnh</label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="Điều chỉnh tăng">Điều chỉnh tăng</option>
                    <option value="Điều chỉnh giảm">Điều chỉnh giảm</option>
                    <option value="Điều chỉnh thông tin">Điều chỉnh thông tin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Nội dung điều chỉnh</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={adjustContent}
                      onChange={(e) => setAdjustContent(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 28px 0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <Sparkles size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#8b5cf6" }} />
                  </div>
                </div>
              </div>

              {/* Row 5: Nhân viên bán hàng | Tỉnh/Thành phố | Xã/Phường */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 140px 140px", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Nhân viên bán hàng</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <select
                      value={salesEmployee}
                      onChange={(e) => setSalesEmployee(e.target.value)}
                      style={{ flex: 1, height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                    >
                      <option value="">-- Chọn nhân viên --</option>
                      <option value="Nguyễn Văn A">Nguyễn Văn A</option>
                      <option value="Trần Thị B">Trần Thị B</option>
                    </select>
                    <button type="button" style={{ height: 26, width: 26, minWidth: 26, padding: 0, borderRadius: 3, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#00b06b", cursor: "pointer", display: "grid", placeItems: "center", boxSizing: "border-box" }}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Tỉnh/Thành phố</label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="">-- Chọn Tỉnh/TP --</option>
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Xã/Phường</label>
                  <select
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="">-- Chọn Xã/Phường --</option>
                    <option value="Láng Hạ">Láng Hạ</option>
                  </select>
                </div>
              </div>

              {/* Row 6: Tham chiếu */}
              <div>
                <a href="#ref" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "#00a862", textDecoration: "none" }}>
                  Tham chiếu ...
                </a>
              </div>
            </div>

            {/* Right Column: Status Badge, Total and Invoice numbers */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderLeft: "1px solid #f1f5f9", paddingLeft: 16 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 3,
                    letterSpacing: 0.5,
                  }}
                >
                  CHƯA PHÁT HÀNH
                </span>
              </div>

              <div style={{ textAlign: "right", marginTop: 4 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <span style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
                  {formatVND(grandTotal)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Mẫu số HĐ</label>
                  <input
                    type="text"
                    value={invoiceTemplate}
                    onChange={(e) => setInvoiceTemplate(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Ký hiệu HĐ</label>
                  <input
                    type="text"
                    value={invoiceSeries}
                    onChange={(e) => setInvoiceSeries(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>Số hóa đơn</label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <span>Ngày HĐ</span>
                    <Info size={12} style={{ color: "#0284c7" }} />
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 24px 0 6px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                    />
                    <Calendar size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-tab: Hàng tiền (Screenshot 3) */}
        <div
          style={{
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={{
              padding: "8px 0",
              fontSize: 13,
              fontWeight: 600,
              color: "#00a862",
              border: "none",
              background: "transparent",
              borderBottom: "2.5px solid #00a862",
              cursor: "pointer",
            }}
          >
            Hàng tiền
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoCalculate}
              onChange={(e) => setAutoCalculate(e.target.checked)}
              style={{ width: 14, height: 14, cursor: "pointer" }}
            />
            <span>Tự động tính toán số liệu</span>
          </label>
        </div>

        {/* Table Area (Screenshot 3) */}
        <div style={{ flex: 1, overflow: "auto", background: "#ffffff" }}>
          <table className="misa-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1", height: 30 }}>
                <th style={{ width: 36, textAlign: "center" }}>#</th>
                <th style={{ width: 120, padding: "4px 8px", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Pin size={12} style={{ color: "#00a862" }} />
                    <span>Mã hàng</span>
                  </div>
                </th>
                <th style={{ minWidth: 200, padding: "4px 8px", textAlign: "left" }}>Tên hàng</th>
                <th style={{ width: 130, padding: "4px 8px", textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <input type="checkbox" style={{ width: 13, height: 13 }} />
                    <span>Chiết khấu TM</span>
                  </div>
                </th>
                <th style={{ width: 70, padding: "4px 8px", textAlign: "center" }}>ĐVT</th>
                <th style={{ width: 90, padding: "4px 8px", textAlign: "right" }}>Số lượng</th>
                <th style={{ width: 100, padding: "4px 8px", textAlign: "right" }}>Đơn giá</th>
                <th style={{ width: 110, padding: "4px 8px", textAlign: "right" }}>Thành tiền</th>
                <th style={{ width: 80, padding: "4px 8px", textAlign: "right" }}>Tỷ lệ CK(%)</th>
                <th style={{ width: 110, padding: "4px 8px", textAlign: "right" }}>Tiền chiết khấu</th>
                <th style={{ width: 36, textAlign: "center" }}></th>
              </tr>

              {/* Summary Row */}
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1", fontWeight: 600, height: 28, color: "#1e293b" }}>
                <td style={{ textAlign: "center" }}></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td style={{ textAlign: "right", padding: "0 8px" }}>{totalQuantity.toFixed(2).replace(".", ",")}</td>
                <td style={{ textAlign: "right", padding: "0 8px" }}>0,00</td>
                <td style={{ textAlign: "right", padding: "0 8px" }}>{formatVND(totalGoods)}</td>
                <td></td>
                <td style={{ textAlign: "right", padding: "0 8px" }}>{formatVND(totalDiscount)}</td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", height: 30 }}>
                  <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                  <td style={{ padding: "2px 6px" }}>
                    <select
                      value={row.itemCode}
                      onChange={(e) => handleItemSelect(idx, e.target.value)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, background: "transparent" }}
                    >
                      <option value="">-- Chọn --</option>
                      {SAMPLE_SALE_ITEMS?.map((it: any) => (
                        <option key={it.code} value={it.code}>
                          {it.code} - {it.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "2px 6px" }}>
                    <input
                      type="text"
                      value={row.itemName}
                      onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12 }}
                    />
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 4px" }}>
                    <input
                      type="checkbox"
                      checked={row.isTradeDiscount}
                      onChange={(e) => handleItemChange(idx, "isTradeDiscount", e.target.checked)}
                      style={{ width: 14, height: 14 }}
                    />
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 4px" }}>
                    <input
                      type="text"
                      value={row.unit}
                      onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, textAlign: "center" }}
                    />
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>
                    <input
                      type="number"
                      value={row.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 6px", fontWeight: 600 }}>
                    {formatVND(row.amount)}
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>
                    <input
                      type="number"
                      value={row.discountRate}
                      onChange={(e) => handleItemChange(idx, "discountRate", Number(e.target.value) || 0)}
                      style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ textAlign: "right", padding: "2px 6px" }}>
                    {formatVND(row.discountAmount)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(idx)}
                      style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 2 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions & Extra Fields (Screenshot 3) */}
        <div style={{ padding: "8px 16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
            {/* Left Area */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <Plus size={13} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                  <button
                    type="button"
                    style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                  >
                    <FileText size={13} />
                    <span>Thêm ghi chú</span>
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                  <span>Số dòng/trang</span>
                  <select defaultValue="20" style={{ height: 24, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12 }}>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                  <span>|&lt; &lt; <strong>1</strong> &gt; &gt;|</span>
                </div>
              </div>

              {/* Extra inputs Row 1: Mã cửa hàng | Tên cửa hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 240px", gap: 10, marginBottom: 6 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block" }}>Mã cửa hàng</label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block" }}>Tên cửa hàng</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Extra inputs Row 2: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 240px", gap: 10, marginBottom: 6 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block" }}>Mã tra cứu HĐĐT</label>
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block" }}>Đường dẫn tra cứu HĐĐT</label>
                  <input
                    type="text"
                    value={lookupUrl}
                    onChange={(e) => setLookupUrl(e.target.value)}
                    style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Upload box */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#64748b",
                  background: "#f8fafc",
                  cursor: "pointer",
                  width: "fit-content",
                }}
              >
                <Paperclip size={13} />
                <span>Đính kèm Dung lượng tối đa 5MB. Chọn tệp hoặc kéo và thả tệp vào đây</span>
              </div>

              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                F3 - Tìm nhanh
              </div>
            </div>

            {/* Right Area: Totals Card matching Screenshot 3 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 14px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
                <span>Tổng tiền hàng</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatVND(totalGoods)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
                <span>Chiết khấu</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatVND(totalDiscount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569" }}>
                <span>Thuế GTGT</span>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatVND(totalVat)}</span>
              </div>
              <div style={{ borderTop: "1px solid #cbd5e1", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#00a862" }}>{formatVND(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Screenshot 3) */}
        <footer
          style={{
            height: 44,
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
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
            onClick={onClose}
            style={{
              height: 30,
              padding: "0 16px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              fontSize: 13,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            style={{
              height: 30,
              padding: "0 16px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              fontSize: 13,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            Cất
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            style={{
              height: 30,
              padding: "0 18px",
              border: "none",
              borderRadius: 4,
              background: "#00a862",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "#ffffff",
            }}
          >
            Cất và Phát hành hóa đơn
          </button>
        </footer>
      </div>
    </div>
  );
}
