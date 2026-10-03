import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  Settings,
  DollarSign,
  Pin,
  FileText,
  Search,
  RotateCcw,
  Keyboard,
  Minus,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";

// Sample catalog items for sales
export const SAMPLE_SALE_ITEMS = [
  { code: "VT001", name: "Cáp ngầm trung thế 24kV Cu/XLPE/PVC/DSTA", unit: "Mét", price: 285000, vat: 10 },
  { code: "VT002", name: "Tủ điện phân phối tổng MSB 630A Schneider", unit: "Bộ", price: 45000000, vat: 10 },
  { code: "VT003", name: "Aptomat khối MCCB 3P 250A 36kA Mitsubishi", unit: "Cái", price: 3250000, vat: 10 },
  { code: "VT004", name: "Khởi động từ Contactor 3P 65A LC1D65AM7", unit: "Cái", price: 1850000, vat: 8 },
  { code: "VT005", name: "Biến dòng đo lường hạ thế TI 400/5A Emic", unit: "Quả", price: 420000, vat: 8 },
  { code: "DV001", name: "Dịch vụ lắp đặt, đấu nối và thí nghiệm điện", unit: "Gói", price: 15000000, vat: 8 },
];

export const SAMPLE_SALE_CUSTOMERS = [
  {
    code: "KH001",
    name: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô",
    taxCode: "0102345678",
    address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội",
    contact: "Nguyễn Văn Hùng",
    phone: "0243.856.7890",
  },
  {
    code: "KH002",
    name: "Công ty TNHH Cơ điện & Tự động hóa Thiên An",
    taxCode: "0108765432",
    address: "Số 45 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
    contact: "Trần Thị Lan",
    phone: "0243.987.6543",
  },
  {
    code: "KH003",
    name: "Công ty TNHH Phát triển Công nghệ Việt Hưng",
    taxCode: "0309876543",
    address: "245 Điện Biên Phủ, P.15, Q. Bình Thạnh, TP.HCM",
    contact: "Lê Minh Tuấn",
    phone: "0903.123.456",
  },
];

// ============================================================================
// 1. MODAL: BÁO GIÁ (MATCHING SCREENSHOT 1 BG00001)
// ============================================================================
export interface SaleQuoteItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
  vatAmount: number;
}

export interface SaleQuoteModalProps {
  initialCode?: string;
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleQuoteModal({
  initialCode = "BG00001",
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleQuoteModalProps) {
  // Master fields
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || "");
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [contactPerson, setContactPerson] = useState(initialData?.contact || "");
  const [note, setNote] = useState(initialData?.description || "");
  const [salesEmployee, setSalesEmployee] = useState("");

  // Date and Quote details
  const [quoteCode, setQuoteCode] = useState(initialData?.code || initialCode);
  const [quoteDate, setQuoteDate] = useState(initialData?.date || "02/10/2026");
  const [expiryDate, setExpiryDate] = useState(initialData?.expiryDate || "");
  const [discountPolicy, setDiscountPolicy] = useState("Không chiết khấu");

  // Balance popup state
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // Table rows
  const [items, setItems] = useState<SaleQuoteItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: "item-1",
            code: "",
            name: "",
            unit: "",
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            vatRate: "",
            vatAmount: 0,
          },
        ]
  );

  // Handle select customer
  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode);
      setAddress(found.address);
      setContactPerson(found.contact);
    }
  };

  // Row operations
  const handleAddItem = () => {
    const newItem: SaleQuoteItem = {
      id: `item-${Date.now()}`,
      code: "",
      name: "",
      unit: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      vatRate: "",
      vatAmount: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          vatRate: "",
          vatAmount: 0,
        },
      ]);
      return;
    }
    const updated = items.filter((_, idx) => idx !== index);
    setItems(updated);
  };

  const handleClearAllItems = () => {
    setItems([
      {
        id: `item-${Date.now()}`,
        code: "",
        name: "",
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

  const handleItemChange = (
    index: number,
    field: keyof SaleQuoteItem,
    value: any
  ) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "code") {
      const catalogItem = SAMPLE_SALE_ITEMS.find((s) => s.code === value);
      if (catalogItem) {
        item.name = catalogItem.name;
        item.unit = catalogItem.unit;
        item.unitPrice = catalogItem.price;
        item.vatRate = catalogItem.vat;
        item.amount = item.quantity * catalogItem.price;
        item.vatAmount = Math.round((item.amount * catalogItem.vat) / 100);
      }
    }

    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) || 0 : item.quantity;
      const p = field === "unitPrice" ? Number(value) || 0 : item.unitPrice;
      item.amount = Math.round(q * p);
      const vatR = typeof item.vatRate === "number" ? item.vatRate : Number(item.vatRate) || 0;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
    }

    if (field === "vatRate") {
      const vatR = Number(value) || 0;
      item.vatRate = value;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
    }

    updated[index] = item;
    setItems(updated);
  };

  // Calculations
  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVatAmount = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const finalTotal = totalAmount + totalVatAmount;

  // AI helper for note
  const handleAIAssistNote = () => {
    const suggested = `Báo giá có hiệu lực 15 ngày kể từ ngày lập. Giá đã bao gồm thuế GTGT và chi phí vận chuyển trong phạm vi 30km. Thanh toán 30% khi ký kết, 70% sau khi bàn giao nghiệm thu.`;
    setNote(suggested);
    notify("AVA Kế toán đã tạo tự động ghi chú điều khoản báo giá!");
  };

  const handleSave = (andNew = false) => {
    const payload = {
      code: quoteCode,
      date: quoteDate,
      expiryDate: expiryDate || "15/10/2026",
      customer: customerName || "Khách hàng vãng lai",
      customerCode,
      taxCode,
      address,
      contact: contactPerson,
      note,
      salesEmployee,
      items,
      amount: finalTotal || totalAmount,
      totalAmount,
      totalVatAmount,
      status: "Chưa gửi",
      description: note || `Báo giá cho ${customerName || "khách hàng"}`,
    };

    onSubmit(payload);
    notify(`Đã lưu Báo giá ${quoteCode} thành công!`);

    if (andNew) {
      const nextNum = parseInt(quoteCode.replace(/\D/g, "") || "1", 10) + 1;
      const nextCode = `BG${nextNum.toString().padStart(5, "0")}`;
      setQuoteCode(nextCode);
      setCustomerCode("");
      setCustomerName("");
      setTaxCode("");
      setAddress("");
      setContactPerson("");
      setNote("");
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          quantity: 1,
          unitPrice: 0,
          amount: 0,
          vatRate: "",
          vatAmount: 0,
        },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "min(1440px, 98vw)",
          height: "min(920px, 96vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 6,
          background: "#ffffff",
          boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER (Screenshot 1)                                       */}
        {/* ================================================================= */}
        <header className="misa-purchase-modal-header" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              title="Lịch sử chứng từ"
              style={{
                border: "none",
                background: "transparent",
                padding: "2px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
              }}
            >
              <RotateCcw size={16} />
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Báo giá {quoteCode}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-purchase-link-btn"
              title="Hướng dẫn sử dụng"
              onClick={() => notify("Mở tài liệu Hướng dẫn lập Báo giá bán hàng")}
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Phím tắt">
              <Keyboard size={16} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Thiết lập"
              onClick={() => notify("Cấu hình trường thông tin mẫu Báo giá")}
            >
              <Settings size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* MODAL BODY (SCROLLABLE)                                           */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#ffffff",
          }}
        >
          {/* MASTER FIELDS SECTION: LEFT 2 COLS + RIGHT DATES/NUMBER + TOTAL */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 240px 170px",
              gap: "8px 16px",
              alignItems: "start",
            }}
          >
            {/* ROW 1: Mã khách hàng | Tên khách hàng | Số báo giá | Tổng tiền thanh toán */}
            <div>
              <label className="misa-purchase-label">Mã khách hàng</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #00b06b",
                    borderRadius: 4,
                    height: 28,
                    background: "#ffffff",
                    padding: "0 4px 0 6px",
                  }}
                >
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: 12.5,
                      color: "#1e293b",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCustomerModal) onOpenCustomerModal();
                      else notify("Thêm nhanh khách hàng mới");
                    }}
                    title="Thêm nhanh khách hàng"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#00b06b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = SAMPLE_SALE_CUSTOMERS[0];
                      handleSelectCustomer(next.code);
                    }}
                    title="Chọn từ danh sách"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* 28px Square $ button */}
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(true)}
                  title="Tra cứu công nợ & số dư khách hàng"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    display: "grid",
                    placeItems: "center",
                    color: "#475569",
                    cursor: "pointer",
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <DollarSign size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div>
              <label className="misa-purchase-label">Tên khách hàng</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
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
              <label className="misa-purchase-label">Số báo giá</label>
              <input
                type="text"
                value={quoteCode}
                onChange={(e) => setQuoteCode(e.target.value)}
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

            {/* Total display on the right */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 2 }}>
                Tổng tiền thanh toán
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                {finalTotal === 0 ? "0" : formatVND(finalTotal)}
              </div>
            </div>

            {/* ROW 2: Mã số thuế | Địa chỉ | Ngày báo giá | (empty cell) */}
            <div>
              <label className="misa-purchase-label">Mã số thuế</label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
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
              <label className="misa-purchase-label">Địa chỉ</label>
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
              <label className="misa-purchase-label">Ngày báo giá</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <Calendar size={13} style={{ color: "#94a3b8" }} />
              </div>
            </div>

            <div />

            {/* ROW 3: Người liên hệ | Ghi chú (with AI sparkles) | Hiệu lực đến | (empty cell) */}
            <div>
              <label className="misa-purchase-label">Người liên hệ</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
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
              <label className="misa-purchase-label">Ghi chú</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder=""
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAIAssistNote}
                  title="AVA AI gợi ý điều khoản ghi chú"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8b5cf6",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={15} />
                </button>
              </div>
            </div>

            <div>
              <label className="misa-purchase-label">Hiệu lực đến</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <Calendar size={13} style={{ color: "#94a3b8" }} />
              </div>
            </div>

            <div />

            {/* ROW 4: Nhân viên bán hàng */}
            <div>
              <label className="misa-purchase-label">Nhân viên bán hàng</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 4px 0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={salesEmployee}
                  onChange={(e) => setSalesEmployee(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <button
                  type="button"
                  onClick={() => notify("Thêm nhân viên kinh doanh")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#00b06b",
                    cursor: "pointer",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>

            <div />
            <div />
            <div />
          </div>

          {/* Tham chiếu link */}
          <div style={{ marginTop: 0, marginBottom: 2 }}>
            <span
              onClick={() => notify("Chọn chứng từ tham chiếu")}
              style={{
                color: "#0284c7",
                fontSize: 12.5,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Tham chiếu ...
            </span>
          </div>

          {/* DETAIL TABS: Hàng tiền & Chiết khấu */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #cbd5e1",
              paddingBottom: 0,
              marginTop: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#0f172a",
                  paddingBottom: 6,
                  borderBottom: "2px solid #00b06b",
                  cursor: "pointer",
                }}
              >
                Hàng tiền
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ color: "#475569" }}>Chiết khấu</span>
              <select
                value={discountPolicy}
                onChange={(e) => setDiscountPolicy(e.target.value)}
                style={{
                  height: 26,
                  padding: "0 8px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  background: "#ffffff",
                  color: "#1e293b",
                }}
              >
                <option value="Không chiết khấu">Không chiết khấu</option>
                <option value="Chiết khấu theo dòng">Chiết khấu theo dòng</option>
                <option value="Chiết khấu % tổng">Chiết khấu % tổng</option>
              </select>
            </div>
          </div>

          {/* TABLE: GRID ITEMS */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              overflowX: "auto",
              background: "#ffffff",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                whiteSpace: "nowrap",
              }}
            >
              <thead>
                <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                  <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>
                    #
                  </th>
                  <th style={{ width: 140, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Pin size={12} style={{ color: "#64748b" }} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th style={{ width: 260, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Tên hàng
                  </th>
                  <th style={{ width: 80, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    ĐVT
                  </th>
                  <th style={{ width: 95, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Số lượng
                  </th>
                  <th style={{ width: 115, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Đơn giá
                  </th>
                  <th style={{ width: 125, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Thành tiền
                  </th>
                  <th style={{ width: 95, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    % thuế GTGT
                  </th>
                  <th style={{ width: 120, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Tiền thuế GTGT
                  </th>
                  <th style={{ width: 40, textAlign: "center", padding: "4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                      height: 32,
                    }}
                  >
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>
                      {idx + 1}
                    </td>

                    {/* Mã hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px" }}>
                      <input
                        type="text"
                        value={it.code}
                        onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                        placeholder=""
                        list={`quote-catalog-${idx}`}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                      <datalist id={`quote-catalog-${idx}`}>
                        {SAMPLE_SALE_ITEMS.map((si) => (
                          <option key={si.code} value={si.code}>
                            {si.name}
                          </option>
                        ))}
                      </datalist>
                    </td>

                    {/* Tên hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* ĐVT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Số lượng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Đơn giá */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Thành tiền */}
                    <td
                      style={{
                        borderRight: "1px solid #cbd5e1",
                        padding: "2px 8px",
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {it.amount === 0 ? "0" : formatVND(it.amount)}
                    </td>

                    {/* % thuế GTGT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "right" }}>
                      <select
                        value={it.vatRate}
                        onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontSize: 12.5,
                          outline: "none",
                          width: "100%",
                          textAlign: "right",
                        }}
                      >
                        <option value="">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8%</option>
                        <option value="10">10%</option>
                        <option value="KCT">KCT</option>
                      </select>
                    </td>

                    {/* Tiền thuế GTGT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                      {it.vatAmount === 0 ? "0" : formatVND(it.vatAmount)}
                    </td>

                    {/* Delete action */}
                    <td style={{ textAlign: "center", padding: "2px" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
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
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* SUMMARY ROW (Immediately below data rows) */}
                <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalQuantity.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalVatAmount === 0 ? "0" : formatVND(totalVatAmount)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TOOLBAR BELOW TABLE */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Tổng số: <strong>{items.length}</strong>
            </span>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#334155",
                  }}
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleAIAssistNote}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#334155",
                  }}
                >
                  <FileText size={13} />
                  <span>Thêm ghi chú</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllItems}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #fee2e2",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#dc2626",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Pagination info */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>Số dòng/trang</span>
                <select
                  defaultValue="20"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    height: 24,
                    padding: "0 4px",
                    fontSize: 12,
                    background: "#ffffff",
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                <strong style={{ color: "#00b06b", padding: "0 4px" }}>1</strong>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROLS: ATTACHMENT BOX & FINANCIAL SUMMARY (SOLID BORDER, NO DASHED) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 20,
              alignItems: "start",
              marginTop: 4,
            }}
          >
            {/* LEFT SIDE: ATTACHMENT */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ fontWeight: 500, color: "#334155" }}>📎 Đính kèm</span>
                <span style={{ color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
              </div>
              {/* Solid clean border per user instruction: "đừng để nét đứt như cũ" */}
              <div
                onClick={() => notify("Chọn tài liệu đính kèm")}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "18px 16px",
                  textAlign: "center",
                  background: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  maxWidth: 380,
                }}
              >
                <Upload size={18} style={{ color: "#64748b", marginBottom: 2 }} />
                <span style={{ fontSize: 12, color: "#0284c7" }}>
                  <strong>Chọn tệp</strong> hoặc kéo và thả tệp vào đây
                </span>
              </div>
            </div>

            {/* RIGHT SIDE: SUMMARY */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12.5,
                color: "#334155",
                paddingLeft: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Tổng tiền hàng</span>
                <span style={{ fontWeight: 500 }}>{totalAmount === 0 ? "0" : formatVND(totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Thuế GTGT</span>
                <span style={{ fontWeight: 500 }}>{totalVatAmount === 0 ? "0" : formatVND(totalVatAmount)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 8,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ color: "#0f172a" }}>Tổng tiền thanh toán</strong>
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  {finalTotal === 0 ? "0" : formatVND(finalTotal)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER (Screenshot 1)                                       */}
        {/* ================================================================= */}
        <footer
          style={{
            height: 46,
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <span>F3 - Tìm nhanh, F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
              style={{
                height: 30,
                padding: "0 16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                fontSize: 12.5,
                cursor: "pointer",
                color: "#334155",
              }}
            >
              Hủy
            </button>

            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
              style={{
                height: 30,
                padding: "0 18px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                fontSize: 12.5,
                cursor: "pointer",
                color: "#1e293b",
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
                background: "#00a862",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              Cất và Thêm
            </button>
          </div>
        </footer>
      </div>

      {/* Tra cứu công nợ & số dư modal */}
      {showBalanceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              width: 500,
              maxWidth: "95vw",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
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
              <strong style={{ fontSize: 13.5 }}>Thông tin công nợ khách hàng</strong>
              <button
                type="button"
                onClick={() => setShowBalanceModal(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Mã khách hàng:</span>
                <strong>{customerCode || "Chưa chọn"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Tên khách hàng:</span>
                <strong>{customerName || "Khách hàng mới"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Công nợ hiện tại:</span>
                <span style={{ color: "#ea580c", fontWeight: 700 }}>64.000.000 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Hạn mức nợ cho phép:</span>
                <span style={{ color: "#00b06b", fontWeight: 600 }}>150.000.000 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Số ngày nợ cho phép:</span>
                <span>30 ngày</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 3,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. MODAL: ĐƠN ĐẶT HÀNG (MATCHING SCREENSHOT 2 ĐH00001)
// ============================================================================
export interface SaleOrderItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  soldQty: number;
  exportedQty: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
  vatAmount: number;
  variant?: string;
}

export interface SaleOrderModalProps {
  initialCode?: string;
  initialData?: any;
  quotesList?: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleOrderModal({
  initialCode = "ĐH00001",
  initialData,
  quotesList = [],
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleOrderModalProps) {
  // Master fields
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || "");
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [receiver, setReceiver] = useState(initialData?.receiver || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [salesEmployee, setSalesEmployee] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [debtDays, setDebtDays] = useState(0);
  const [orderStatus, setOrderStatus] = useState(initialData?.status || "Chưa thực hiện");
  const [deliveryStatus, setDeliveryStatus] = useState("Chưa giao");
  const [isPreExistingOrder, setIsPreExistingOrder] = useState(false);
  const [isCostAccounting, setIsCostAccounting] = useState(true);

  // Quote search / reference in header
  const [searchQuoteCode, setSearchQuoteCode] = useState("");
  const [showQuoteDropdown, setShowQuoteDropdown] = useState(false);

  // Dates & Order details
  const [orderCode, setOrderCode] = useState(initialData?.code || initialCode);
  const [orderDate, setOrderDate] = useState(initialData?.date || "02/10/2026");
  const [deliveryDate, setDeliveryDate] = useState(initialData?.deliveryDate || "");
  const [discountPolicy, setDiscountPolicy] = useState("Không chiết khấu");

  // E-commerce & Delivery fields (4 rows below table)
  const [externalOrderCode, setExternalOrderCode] = useState("");
  const [ecommercePlatform, setEcommercePlatform] = useState("");
  const [shopName, setShopName] = useState("");
  const [successDeliveryDate, setSuccessDeliveryDate] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [shippingStatus, setShippingStatus] = useState("");

  // Customer balance modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  // Stock unreserved modal
  const [showStockModal, setShowStockModal] = useState(false);

  // Table items
  const [items, setItems] = useState<SaleOrderItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: "item-1",
            code: "",
            name: "",
            unit: "",
            quantity: 1,
            soldQty: 0,
            exportedQty: 0,
            unitPrice: 0,
            amount: 0,
            vatRate: "",
            vatAmount: 0,
            variant: "",
          },
        ]
  );

  // Customer select helper
  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode);
      setAddress(found.address);
      setReceiver(found.contact);
    }
  };

  // Populate from Quote
  const handleSelectQuote = (quote: any) => {
    setCustomerName(quote.customer || "");
    setDescription(`Đơn đặt hàng theo báo giá ${quote.code}`);
    setOrderCode(`ĐH${quote.code.replace(/\D/g, "") || "00001"}`);
    if (quote.items && quote.items.length > 0) {
      setItems(
        quote.items.map((it: any, idx: number) => ({
          id: `item-${idx + 1}`,
          code: it.code || "",
          name: it.name || "",
          unit: it.unit || "",
          quantity: it.quantity || 1,
          soldQty: 0,
          exportedQty: 0,
          unitPrice: it.unitPrice || 0,
          amount: it.amount || 0,
          vatRate: it.vatRate || "",
          vatAmount: it.vatAmount || 0,
          variant: "",
        }))
      );
    }
    setSearchQuoteCode(quote.code);
    setShowQuoteDropdown(false);
    notify(`Đã lấy thông tin báo giá ${quote.code} sang Đơn đặt hàng!`);
  };

  // Row operations
  const handleAddItem = () => {
    const newItem: SaleOrderItem = {
      id: `item-${Date.now()}`,
      code: "",
      name: "",
      unit: "",
      quantity: 1,
      soldQty: 0,
      exportedQty: 0,
      unitPrice: 0,
      amount: 0,
      vatRate: "",
      vatAmount: 0,
      variant: "",
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          quantity: 1,
          soldQty: 0,
          exportedQty: 0,
          unitPrice: 0,
          amount: 0,
          vatRate: "",
          vatAmount: 0,
          variant: "",
        },
      ]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleClearAllItems = () => {
    setItems([
      {
        id: `item-${Date.now()}`,
        code: "",
        name: "",
        unit: "",
        quantity: 1,
        soldQty: 0,
        exportedQty: 0,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
        variant: "",
      },
    ]);
    notify("Đã xóa hết các dòng dữ liệu");
  };

  const handleItemChange = (
    index: number,
    field: keyof SaleOrderItem,
    value: any
  ) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "code") {
      const catalogItem = SAMPLE_SALE_ITEMS.find((s) => s.code === value);
      if (catalogItem) {
        item.name = catalogItem.name;
        item.unit = catalogItem.unit;
        item.unitPrice = catalogItem.price;
        item.vatRate = catalogItem.vat;
        item.amount = item.quantity * catalogItem.price;
        item.vatAmount = Math.round((item.amount * catalogItem.vat) / 100);
      }
    }

    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) || 0 : item.quantity;
      const p = field === "unitPrice" ? Number(value) || 0 : item.unitPrice;
      item.amount = Math.round(q * p);
      const vatR = typeof item.vatRate === "number" ? item.vatRate : Number(item.vatRate) || 0;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
    }

    if (field === "vatRate") {
      const vatR = Number(value) || 0;
      item.vatRate = value;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
    }

    updated[index] = item;
    setItems(updated);
  };

  // Calculations
  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalSoldQty = items.reduce((s, it) => s + (Number(it.soldQty) || 0), 0);
  const totalExportedQty = items.reduce((s, it) => s + (Number(it.exportedQty) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVatAmount = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const finalTotal = totalAmount + totalVatAmount;

  // AI helper for description
  const handleAIAssistDesc = () => {
    const suggested = `Đơn đặt hàng cung cấp thiết bị và phụ kiện điện công trình. Giao hàng theo từng đợt tại chân công trình. Thanh toán theo hợp đồng kinh tế đã ký.`;
    setDescription(suggested);
    notify("AVA Kế toán đã tạo tự động diễn giải đơn đặt hàng!");
  };

  const handleSave = (andNew = false) => {
    const payload = {
      code: orderCode,
      date: orderDate,
      deliveryDate: deliveryDate || "15/10/2026",
      customer: customerName || "Khách hàng mua hàng",
      customerCode,
      taxCode,
      address,
      receiver,
      description,
      salesEmployee,
      paymentTerms,
      debtDays,
      status: orderStatus,
      deliveryStatus,
      isPreExistingOrder,
      isCostAccounting,
      externalOrderCode,
      ecommercePlatform,
      shopName,
      successDeliveryDate,
      deliveryAddress,
      shippingStatus,
      items,
      amount: finalTotal || totalAmount,
      totalAmount,
      totalVatAmount,
    };

    onSubmit(payload);
    notify(`Đã lưu Đơn đặt hàng ${orderCode} thành công!`);

    if (andNew) {
      const nextNum = parseInt(orderCode.replace(/\D/g, "") || "1", 10) + 1;
      const nextCode = `ĐH${nextNum.toString().padStart(5, "0")}`;
      setOrderCode(nextCode);
      setCustomerCode("");
      setCustomerName("");
      setTaxCode("");
      setAddress("");
      setReceiver("");
      setDescription("");
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          quantity: 1,
          soldQty: 0,
          exportedQty: 0,
          unitPrice: 0,
          amount: 0,
          vatRate: "",
          vatAmount: 0,
          variant: "",
        },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "min(1440px, 98vw)",
          height: "min(920px, 96vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 6,
          background: "#ffffff",
          boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER (Screenshot 2)                                       */}
        {/* ================================================================= */}
        <header className="misa-purchase-modal-header" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              title="Lịch sử chứng từ"
              style={{
                border: "none",
                background: "transparent",
                padding: "2px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
              }}
            >
              <RotateCcw size={16} />
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Đơn đặt hàng {orderCode}
            </h2>

            {/* Quick Quote Lookup Search Box with gear */}
            <div style={{ position: "relative", marginLeft: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 26,
                  padding: "0 6px",
                  background: "#ffffff",
                  gap: 6,
                }}
              >
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#64748b", padding: 0, cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Cấu hình tìm kiếm"
                >
                  <Settings size={13} />
                </button>
                <input
                  type="text"
                  placeholder="Nhập số báo giá"
                  value={searchQuoteCode}
                  onChange={(e) => {
                    setSearchQuoteCode(e.target.value);
                    setShowQuoteDropdown(true);
                  }}
                  onFocus={() => setShowQuoteDropdown(true)}
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 12,
                    width: 130,
                    color: "#1e293b",
                    background: "transparent",
                  }}
                />
                <Search size={13} style={{ color: "#94a3b8" }} />
                <button
                  type="button"
                  onClick={() => setShowQuoteDropdown(!showQuoteDropdown)}
                  style={{ background: "none", border: "none", color: "#64748b", padding: 0, cursor: "pointer", display: "grid", placeItems: "center" }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Quote dropdown selection */}
              {showQuoteDropdown && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    zIndex: 60,
                    minWidth: 260,
                  }}
                >
                  <div style={{ padding: "6px 10px", fontSize: 11.5, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                    Chọn Báo giá để lập Đơn hàng:
                  </div>
                  {(quotesList.length > 0
                    ? quotesList
                    : [
                        { code: "BG00001", customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", amount: 45000000 },
                        { code: "BG00002", customer: "Công ty TNHH Cơ điện & Tự động hóa Thiên An", amount: 128000000 },
                      ]
                  ).map((q: any) => (
                    <div
                      key={q.code}
                      onClick={() => handleSelectQuote(q)}
                      style={{
                        padding: "8px 10px",
                        fontSize: 12.5,
                        borderBottom: "1px solid #f1f5f9",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#eff6ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      <strong style={{ color: "#0284c7" }}>{q.code}</strong> - {q.customer}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-purchase-link-btn"
              title="Hướng dẫn sử dụng"
              onClick={() => notify("Mở tài liệu Hướng dẫn lập Đơn đặt hàng bán hàng")}
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Phím tắt">
              <Keyboard size={16} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Thiết lập"
              onClick={() => notify("Cấu hình trường thông tin mẫu Đơn đặt hàng")}
            >
              <Settings size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* MODAL BODY (SCROLLABLE)                                           */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "#ffffff",
          }}
        >
          {/* MASTER FIELDS SECTION */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 240px 170px",
              gap: "8px 16px",
              alignItems: "start",
            }}
          >
            {/* ROW 1: Mã khách hàng | Tên khách hàng | Ngày đơn hàng | Tổng tiền thanh toán */}
            <div>
              <label className="misa-purchase-label">Mã khách hàng</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #00b06b",
                    borderRadius: 4,
                    height: 28,
                    background: "#ffffff",
                    padding: "0 4px 0 6px",
                  }}
                >
                  <input
                    type="text"
                    value={customerCode}
                    onChange={(e) => setCustomerCode(e.target.value)}
                    style={{
                      border: "none",
                      outline: "none",
                      width: "100%",
                      fontSize: 12.5,
                      color: "#1e293b",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCustomerModal) onOpenCustomerModal();
                      else notify("Thêm nhanh khách hàng mới");
                    }}
                    title="Thêm nhanh khách hàng"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#00b06b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = SAMPLE_SALE_CUSTOMERS[0];
                      handleSelectCustomer(next.code);
                    }}
                    title="Chọn từ danh sách"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBalanceModal(true)}
                  title="Tra cứu công nợ & số dư khách hàng"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    display: "grid",
                    placeItems: "center",
                    color: "#475569",
                    cursor: "pointer",
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <DollarSign size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div>
              <label className="misa-purchase-label">Tên khách hàng</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
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
              <label className="misa-purchase-label">Ngày đơn hàng</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <Calendar size={13} style={{ color: "#94a3b8" }} />
              </div>
            </div>

            {/* Total display on the right */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11.5, color: "#64748b", marginBottom: 2 }}>
                Tổng tiền thanh toán
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: "#111827",
                  lineHeight: 1.2,
                }}
              >
                {finalTotal === 0 ? "0" : formatVND(finalTotal)}
              </div>
            </div>

            {/* ROW 2: Mã số thuế | Địa chỉ | Số đơn hàng | (empty cell) */}
            <div>
              <label className="misa-purchase-label">Mã số thuế</label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
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
              <label className="misa-purchase-label">Địa chỉ</label>
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
              <label className="misa-purchase-label">Số đơn hàng</label>
              <input
                type="text"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
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

            <div />

            {/* ROW 3: Người nhận hàng | Diễn giải | Hạn giao hàng | (empty cell) */}
            <div>
              <label className="misa-purchase-label">Người nhận hàng</label>
              <input
                type="text"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
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
              <label className="misa-purchase-label">Diễn giải</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder=""
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAIAssistDesc}
                  title="AVA AI gợi ý diễn giải đơn hàng"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#8b5cf6",
                    padding: "2px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Sparkles size={15} />
                </button>
              </div>
            </div>

            <div>
              <label className="misa-purchase-label">Hạn giao hàng</label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  height: 28,
                  padding: "0 8px",
                  background: "#ffffff",
                }}
              >
                <input
                  type="text"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  placeholder="DD/MM/YYYY"
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 12.5,
                  }}
                />
                <Calendar size={13} style={{ color: "#94a3b8" }} />
              </div>
            </div>

            <div />

            {/* ROW 4: 4 sub-columns on left (Nhân viên bán hàng, Điều khoản TT, Số ngày được nợ, Tình trạng đơn hàng) | Tình trạng giao hàng */}
            <div style={{ gridColumn: "1 / span 2" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 100px 1.1fr", gap: 10 }}>
                {/* Nhân viên bán hàng with blue minus circle badge */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <label className="misa-purchase-label" style={{ marginBottom: 0 }}>
                      Nhân viên bán hàng
                    </label>
                    <span
                      style={{
                        background: "#3b82f6",
                        color: "#ffffff",
                        borderRadius: "50%",
                        width: 13,
                        height: 13,
                        display: "inline-grid",
                        placeItems: "center",
                        fontSize: 8.5,
                        fontWeight: 700,
                      }}
                      title="Nhân viên phụ trách"
                    >
                      <Minus size={9} strokeWidth={3} />
                    </span>
                  </div>
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
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <button
                      type="button"
                      onClick={() => notify("Thêm nhân viên bán hàng")}
                      style={{ background: "none", border: "none", color: "#00b06b", cursor: "pointer", padding: "2px" }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>

                {/* Điều khoản TT */}
                <div>
                  <label className="misa-purchase-label">Điều khoản TT</label>
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
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      placeholder=""
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <button
                      type="button"
                      onClick={() => notify("Thêm điều khoản thanh toán")}
                      style={{ background: "none", border: "none", color: "#00b06b", cursor: "pointer", padding: "2px" }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>

                {/* Số ngày được nợ */}
                <div>
                  <label className="misa-purchase-label">Số ngày được nợ</label>
                  <input
                    type="number"
                    value={debtDays}
                    onChange={(e) => setDebtDays(Number(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      textAlign: "right",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Tình trạng đơn hàng */}
                <div>
                  <label className="misa-purchase-label">Tình trạng đơn hàng</label>
                  <select
                    value={orderStatus}
                    onChange={(e) => setOrderStatus(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                    }}
                  >
                    <option value="Chưa thực hiện">Chưa thực hiện</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Hoàn thành">Hoàn thành</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tình trạng giao hàng (Column 3) */}
            <div>
              <label className="misa-purchase-label">Tình trạng giao hàng</label>
              <select
                value={deliveryStatus}
                onChange={(e) => setDeliveryStatus(e.target.value)}
                style={{
                  width: "100%",
                  height: 28,
                  padding: "0 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12,
                  background: "#ffffff",
                }}
              >
                <option value="Chưa giao">Chưa giao</option>
                <option value="Giao một phần">Giao một phần</option>
                <option value="Đã giao hết">Đã giao hết</option>
              </select>
            </div>

            <div />

            {/* ROW 5: Checkboxes: Là đơn đặt hàng... & Tính giá thành */}
            <div style={{ gridColumn: "1 / span 2", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <input
                type="checkbox"
                id="preExistingOrder"
                checked={isPreExistingOrder}
                onChange={(e) => setIsPreExistingOrder(e.target.checked)}
                style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
              />
              <label htmlFor="preExistingOrder" style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                Là đơn đặt hàng phát sinh trước khi sử dụng phần mềm
              </label>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <input
                type="checkbox"
                id="costAccounting"
                checked={isCostAccounting}
                onChange={(e) => setIsCostAccounting(e.target.checked)}
                style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
              />
              <label htmlFor="costAccounting" style={{ fontSize: 12.5, color: "#00b06b", fontWeight: 600, cursor: "pointer" }}>
                Tính giá thành
              </label>
            </div>

            <div />
          </div>

          {/* Tham chiếu link */}
          <div style={{ marginTop: 0, marginBottom: 2 }}>
            <span
              onClick={() => notify("Chọn chứng từ tham chiếu")}
              style={{
                color: "#0284c7",
                fontSize: 12.5,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Tham chiếu ...
            </span>
          </div>

          {/* DETAIL TABS: Hàng tiền & Chiết khấu */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #cbd5e1",
              paddingBottom: 0,
              marginTop: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#0f172a",
                  paddingBottom: 6,
                  borderBottom: "2px solid #00b06b",
                  cursor: "pointer",
                }}
              >
                Hàng tiền
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ color: "#475569" }}>Chiết khấu</span>
              <select
                value={discountPolicy}
                onChange={(e) => setDiscountPolicy(e.target.value)}
                style={{
                  height: 26,
                  padding: "0 8px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  background: "#ffffff",
                  color: "#1e293b",
                }}
              >
                <option value="Không chiết khấu">Không chiết khấu</option>
                <option value="Chiết khấu theo dòng">Chiết khấu theo dòng</option>
                <option value="Chiết khấu % tổng">Chiết khấu % tổng</option>
              </select>
            </div>
          </div>

          {/* TABLE: GRID ITEMS */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              overflowX: "auto",
              background: "#ffffff",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                whiteSpace: "nowrap",
              }}
            >
              <thead>
                <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                  <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>
                    #
                  </th>
                  <th style={{ width: 130, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Pin size={12} style={{ color: "#64748b" }} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th style={{ width: 220, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Tên hàng
                  </th>
                  <th style={{ width: 70, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    ĐVT
                  </th>
                  <th style={{ width: 85, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Số lượng
                  </th>
                  <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Số lượng đã bán
                  </th>
                  <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Số lượng đã xuất
                  </th>
                  <th style={{ width: 105, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Đơn giá
                  </th>
                  <th style={{ width: 115, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Thành tiền
                  </th>
                  <th style={{ width: 90, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    % thuế GTGT
                  </th>
                  <th style={{ width: 105, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Tiền thuế GTGT
                  </th>
                  <th style={{ width: 90, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Biến ki...
                  </th>
                  <th style={{ width: 40, textAlign: "center", padding: "4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={it.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe",
                      height: 32,
                    }}
                  >
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>
                      {idx + 1}
                    </td>

                    {/* Mã hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px" }}>
                      <input
                        type="text"
                        value={it.code}
                        onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                        placeholder=""
                        list={`order-catalog-items-${idx}`}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                      <datalist id={`order-catalog-items-${idx}`}>
                        {SAMPLE_SALE_ITEMS.map((si) => (
                          <option key={si.code} value={si.code}>
                            {si.name}
                          </option>
                        ))}
                      </datalist>
                    </td>

                    {/* Tên hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={it.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* ĐVT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={it.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Số lượng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Số lượng đã bán */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={it.soldQty}
                        onChange={(e) => handleItemChange(idx, "soldQty", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Số lượng đã xuất */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        step="0.01"
                        value={it.exportedQty}
                        onChange={(e) => handleItemChange(idx, "exportedQty", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Đơn giá */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={it.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          textAlign: "right",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Thành tiền */}
                    <td
                      style={{
                        borderRight: "1px solid #cbd5e1",
                        padding: "2px 8px",
                        textAlign: "right",
                        fontWeight: 500,
                      }}
                    >
                      {it.amount === 0 ? "0" : formatVND(it.amount)}
                    </td>

                    {/* % thuế GTGT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "right" }}>
                      <select
                        value={it.vatRate}
                        onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                        style={{
                          border: "none",
                          background: "transparent",
                          fontSize: 12.5,
                          outline: "none",
                          width: "100%",
                          textAlign: "right",
                        }}
                      >
                        <option value="">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8%</option>
                        <option value="10">10%</option>
                        <option value="KCT">KCT</option>
                      </select>
                    </td>

                    {/* Tiền thuế GTGT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                      {it.vatAmount === 0 ? "0" : formatVND(it.vatAmount)}
                    </td>

                    {/* Biến ki... */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={it.variant || ""}
                        onChange={(e) => handleItemChange(idx, "variant" as any, e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 12.5,
                        }}
                      />
                    </td>

                    {/* Delete action */}
                    <td style={{ textAlign: "center", padding: "2px" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
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
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* SUMMARY ROW */}
                <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalQuantity.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalSoldQty.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalExportedQty.toFixed(2).replace(".", ",")}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalVatAmount === 0 ? "0" : formatVND(totalVatAmount)}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TOOLBAR BELOW TABLE */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Tổng số: <strong>{items.length}</strong>
            </span>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#334155",
                  }}
                >
                  <Plus size={13} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllItems}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #fee2e2",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#dc2626",
                  }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>

                <button
                  type="button"
                  onClick={handleAIAssistDesc}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: "#334155",
                  }}
                >
                  <FileText size={13} />
                  <span>Thêm ghi chú</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStockModal(true)}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    color: "#0f172a",
                  }}
                >
                  Xem số lượng tồn kho chưa đặt hàng
                </button>
              </div>

              {/* Pagination */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>Số dòng/trang</span>
                <select
                  defaultValue="20"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 3,
                    height: 24,
                    padding: "0 4px",
                    fontSize: 12,
                    background: "#ffffff",
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                <strong style={{ color: "#00b06b", padding: "0 4px" }}>1</strong>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROLS: E-COMMERCE / SHIPPING DETAILS & TOTALS (SOLID BORDERS, NO DASHED) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 340px",
              gap: 20,
              alignItems: "start",
              marginTop: 4,
            }}
          >
            {/* LEFT SIDE: 4 ROWS SHIPPING/E-COMMERCE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 580 }}>
              {/* Row 1: Số đơn hàng từ hệ thống khác | Sàn thương mại điện tử */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="misa-purchase-label">Số đơn hàng từ hệ thống khác</label>
                  <input
                    type="text"
                    value={externalOrderCode}
                    onChange={(e) => setExternalOrderCode(e.target.value)}
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
                  <label className="misa-purchase-label">Sàn thương mại điện tử</label>
                  <select
                    value={ecommercePlatform}
                    onChange={(e) => setEcommercePlatform(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- Chọn sàn TMĐT --</option>
                    <option value="Shopee">Shopee</option>
                    <option value="Lazada">Lazada</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                    <option value="Tiki">Tiki</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Tên shop | Ngày giao hàng thành công */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="misa-purchase-label">Tên shop</label>
                  <select
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- Chọn shop --</option>
                    <option value="Shop Điện Máy Minh An Official">Shop Điện Máy Minh An Official</option>
                    <option value="Thiết Bị Điện Công Nghiệp HN">Thiết Bị Điện Công Nghiệp HN</option>
                  </select>
                </div>
                <div>
                  <label className="misa-purchase-label">Ngày giao hàng thành công</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      height: 28,
                      padding: "0 8px",
                      background: "#ffffff",
                    }}
                  >
                    <input
                      type="text"
                      value={successDeliveryDate}
                      onChange={(e) => setSuccessDeliveryDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Calendar size={13} style={{ color: "#94a3b8" }} />
                  </div>
                </div>
              </div>

              {/* Row 3: Địa điểm giao hàng */}
              <div>
                <label className="misa-purchase-label">Địa điểm giao hàng</label>
                <select
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 6px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">-- Chọn địa điểm giao hàng --</option>
                  <option value="Kho tổng Hà Nội - KCN Đài Tư, Long Biên">Kho tổng Hà Nội - KCN Đài Tư, Long Biên</option>
                  <option value="Kho TP.HCM - KCN Tân Bình, Tân Phú">Kho TP.HCM - KCN Tân Bình, Tân Phú</option>
                  <option value="Giao tại địa chỉ khách hàng">Giao tại địa chỉ khách hàng</option>
                </select>
              </div>

              {/* Row 4: Tình trạng vận chuyển */}
              <div>
                <label className="misa-purchase-label">Tình trạng vận chuyển</label>
                <input
                  type="text"
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value)}
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

            {/* RIGHT SIDE: SUMMARY */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12.5,
                color: "#334155",
                paddingLeft: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Tổng tiền hàng</span>
                <span style={{ fontWeight: 500 }}>{totalAmount === 0 ? "0" : formatVND(totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Thuế GTGT</span>
                <span style={{ fontWeight: 500 }}>{totalVatAmount === 0 ? "0" : formatVND(totalVatAmount)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 8,
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ color: "#0f172a" }}>Tổng tiền thanh toán</strong>
                <strong style={{ fontSize: 15, color: "#0f172a" }}>
                  {finalTotal === 0 ? "0" : formatVND(finalTotal)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER (Screenshot 2)                                       */}
        {/* ================================================================= */}
        <footer
          style={{
            height: 46,
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <span>F3 - Tìm nhanh, F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
              style={{
                height: 30,
                padding: "0 16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                fontSize: 12.5,
                cursor: "pointer",
                color: "#334155",
              }}
            >
              Hủy
            </button>

            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
              style={{
                height: 30,
                padding: "0 18px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                fontSize: 12.5,
                cursor: "pointer",
                color: "#1e293b",
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
                background: "#00a862",
                borderRadius: 4,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              Cất và Thêm
            </button>
          </div>
        </footer>
      </div>

      {/* Stock lookup modal */}
      {showStockModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              width: 580,
              maxWidth: "95vw",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
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
              <strong style={{ fontSize: 13.5 }}>Tồn kho khả dụng (chưa đặt hàng)</strong>
              <button
                type="button"
                onClick={() => setShowStockModal(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>Mã hàng</th>
                    <th style={{ padding: "6px 8px", textAlign: "left" }}>Tên hàng</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Tồn thực tế</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Đã cam kết</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Khả dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_SALE_ITEMS.map((item) => (
                    <tr key={item.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#0284c7" }}>{item.code}</td>
                      <td style={{ padding: "6px 8px" }}>{item.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>150</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#ea580c" }}>30</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#00b06b" }}>120</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 3,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tra cứu công nợ modal */}
      {showBalanceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 100000,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              width: 500,
              maxWidth: "95vw",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
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
              <strong style={{ fontSize: 13.5 }}>Thông tin công nợ khách hàng</strong>
              <button
                type="button"
                onClick={() => setShowBalanceModal(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Mã khách hàng:</span>
                <strong>{customerCode || "Chưa chọn"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Tên khách hàng:</span>
                <strong>{customerName || "Khách hàng mới"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Công nợ hiện tại:</span>
                <span style={{ color: "#ea580c", fontWeight: 700 }}>64.000.000 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 6 }}>
                <span style={{ color: "#64748b" }}>Hạn mức nợ cho phép:</span>
                <span style={{ color: "#00b06b", fontWeight: 600 }}>150.000.000 đ</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#64748b" }}>Số ngày nợ cho phép:</span>
                <span>30 ngày</span>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowBalanceModal(false)}
                  style={{
                    height: 28,
                    padding: "0 14px",
                    background: "#00b06b",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 3,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. MODAL: HỢP ĐỒNG BÁN HÀNG (MATCHING SCREENSHOT 3 HĐB00001)
// ============================================================================
export interface SaleContractItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  reqQty: number;
  deliveredQty: number;
  unitPrice: number;
  amount: number;
  discountRate: number;
  discountAmount: number;
  vatRate: number | string;
  vatAmount: number;
}

export interface SaleContractModalProps {
  initialCode?: string;
  initialData?: any;
  ordersList?: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleContractModal({
  initialCode = "HĐB00001",
  initialData,
  ordersList = [],
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleContractModalProps) {
  // Master fields
  const [contractType, setContractType] = useState<"contract" | "project">("contract");
  const [contractCode, setContractCode] = useState(initialData?.code || initialCode);
  const [signDate, setSignDate] = useState(initialData?.date || "02/10/2026");
  const [project, setProject] = useState(initialData?.project || "");
  const [contractAmount, setContractAmount] = useState<number>(initialData?.amount || 0);
  const [contractAmountConverted, setContractAmountConverted] = useState<number>(initialData?.amount || 0);
  const [contractStatus, setContractStatus] = useState(initialData?.status || "Chưa thực hiện");
  const [deliveryStatus, setDeliveryStatus] = useState(initialData?.deliveryStatus || "Chưa giao");

  // Customer fields
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [contactPerson, setContactPerson] = useState(initialData?.contact || "");
  const [deliveryDate, setDeliveryDate] = useState(initialData?.deliveryDate || "");
  const [paymentDueDate, setPaymentDueDate] = useState(initialData?.paymentDueDate || "");
  const [autoLiquidate, setAutoLiquidate] = useState(true);

  // Search by Sales Order
  const [searchOrderCode, setSearchOrderCode] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);

  // Collapsible: Thông tin mở rộng
  const [expandExtendedInfo, setExpandExtendedInfo] = useState(true);
  const [summary, setSummary] = useState(initialData?.description || "");
  const [executingDepartment, setExecutingDepartment] = useState("");
  const [executingPerson, setExecutingPerson] = useState("");
  const [isPreExistingContract, setIsPreExistingContract] = useState(false);
  const [liquidationAmount, setLiquidationAmount] = useState(0);
  const [liquidationAmountConverted, setLiquidationAmountConverted] = useState(0);
  const [liquidationDate, setLiquidationDate] = useState("");
  const [liquidationReason, setLiquidationReason] = useState("");
  const [isCostAccounting, setIsCostAccounting] = useState(true);
  const [hasInvoiced, setHasInvoiced] = useState(false);
  const [otherTerms, setOtherTerms] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Collapsible: Điều khoản thanh toán
  const [expandPaymentTerms, setExpandPaymentTerms] = useState(false);

  // Table items
  const [items, setItems] = useState<SaleContractItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: "item-1",
            code: "",
            name: "",
            unit: "",
            reqQty: 1,
            deliveredQty: 0,
            unitPrice: 0,
            amount: 0,
            discountRate: 0,
            discountAmount: 0,
            vatRate: "",
            vatAmount: 0,
          },
        ]
  );

  // Customer select helper
  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setAddress(found.address);
      setContactPerson(found.contact);
    }
  };

  // Populate from Sales Order
  const handleSelectOrder = (order: any) => {
    setCustomerName(order.customer || "");
    setSummary(`Hợp đồng thực hiện đơn đặt hàng ${order.code}`);
    setContractCode(`HĐB${order.code.replace(/\D/g, "") || "00001"}`);
    if (order.amount) {
      setContractAmount(order.amount);
      setContractAmountConverted(order.amount);
    }
    if (order.items && order.items.length > 0) {
      setItems(
        order.items.map((it: any, idx: number) => ({
          id: `item-${idx + 1}`,
          code: it.code || "",
          name: it.name || "",
          unit: it.unit || "",
          reqQty: it.quantity || 1,
          deliveredQty: 0,
          unitPrice: it.unitPrice || 0,
          amount: it.amount || 0,
          discountRate: 0,
          discountAmount: 0,
          vatRate: it.vatRate || "",
          vatAmount: it.vatAmount || 0,
        }))
      );
    }
    setSearchOrderCode(order.code);
    setShowOrderDropdown(false);
    notify(`Đã lấy thông tin đơn hàng ${order.code} sang Hợp đồng bán!`);
  };

  // Row operations
  const handleAddItem = () => {
    const newItem: SaleContractItem = {
      id: `item-${Date.now()}`,
      code: "",
      name: "",
      unit: "",
      reqQty: 1,
      deliveredQty: 0,
      unitPrice: 0,
      amount: 0,
      discountRate: 0,
      discountAmount: 0,
      vatRate: "",
      vatAmount: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          reqQty: 1,
          deliveredQty: 0,
          unitPrice: 0,
          amount: 0,
          discountRate: 0,
          discountAmount: 0,
          vatRate: "",
          vatAmount: 0,
        },
      ]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleClearAllItems = () => {
    setItems([
      {
        id: `item-${Date.now()}`,
        code: "",
        name: "",
        unit: "",
        reqQty: 1,
        deliveredQty: 0,
        unitPrice: 0,
        amount: 0,
        discountRate: 0,
        discountAmount: 0,
        vatRate: "",
        vatAmount: 0,
      },
    ]);
    notify("Đã xóa hết các dòng dữ liệu");
  };

  const handleItemChange = (
    index: number,
    field: keyof SaleContractItem,
    value: any
  ) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "code") {
      const catalogItem = SAMPLE_SALE_ITEMS.find((s) => s.code === value);
      if (catalogItem) {
        item.name = catalogItem.name;
        item.unit = catalogItem.unit;
        item.unitPrice = catalogItem.price;
        item.vatRate = catalogItem.vat;
        item.amount = item.reqQty * catalogItem.price;
        item.discountAmount = Math.round((item.amount * item.discountRate) / 100);
        item.vatAmount = Math.round(((item.amount - item.discountAmount) * catalogItem.vat) / 100);
      }
    }

    if (field === "reqQty" || field === "unitPrice") {
      const q = field === "reqQty" ? Number(value) || 0 : item.reqQty;
      const p = field === "unitPrice" ? Number(value) || 0 : item.unitPrice;
      item.amount = Math.round(q * p);
      item.discountAmount = Math.round((item.amount * item.discountRate) / 100);
      const vatR = typeof item.vatRate === "number" ? item.vatRate : Number(item.vatRate) || 0;
      item.vatAmount = Math.round(((item.amount - item.discountAmount) * vatR) / 100);
    }

    if (field === "discountRate") {
      const rate = Number(value) || 0;
      item.discountRate = rate;
      item.discountAmount = Math.round((item.amount * rate) / 100);
      const vatR = typeof item.vatRate === "number" ? item.vatRate : Number(item.vatRate) || 0;
      item.vatAmount = Math.round(((item.amount - item.discountAmount) * vatR) / 100);
    }

    if (field === "vatRate") {
      const vatR = Number(value) || 0;
      item.vatRate = value;
      item.vatAmount = Math.round(((item.amount - item.discountAmount) * vatR) / 100);
    }

    updated[index] = item;
    setItems(updated);

    // Update master contract amount
    const newTotalAmount = updated.reduce((s, it) => s + (Number(it.amount) || 0) - (Number(it.discountAmount) || 0) + (Number(it.vatAmount) || 0), 0);
    if (newTotalAmount > 0) {
      setContractAmount(newTotalAmount);
      setContractAmountConverted(newTotalAmount);
    }
  };

  // Totals
  const totalReqQty = items.reduce((s, it) => s + (Number(it.reqQty) || 0), 0);
  const totalDeliveredQty = items.reduce((s, it) => s + (Number(it.deliveredQty) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalDiscount = items.reduce((s, it) => s + (Number(it.discountAmount) || 0), 0);
  const totalVat = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const finalContractValue = contractAmount || (totalAmount - totalDiscount + totalVat);

  // AI assistant for summary
  const handleAIAssistSummary = () => {
    const suggested = `Hợp đồng kinh tế cung cấp, lắp đặt và chuyển giao thiết bị điện hạ thế. Thời gian thi công 30 ngày kể từ ngày khởi công. Bảo hành 24 tháng theo tiêu chuẩn nhà sản xuất.`;
    setSummary(suggested);
    notify("AVA Kế toán đã tạo tự động trích yếu hợp đồng bán!");
  };

  const handleSave = (andNew = false) => {
    const payload = {
      code: contractCode,
      date: signDate,
      customer: customerName || "Khách hàng hợp đồng",
      customerCode,
      address,
      contact: contactPerson,
      amount: finalContractValue,
      project,
      status: contractStatus,
      deliveryStatus,
      deliveryDate,
      paymentDueDate,
      summary,
      executingDepartment,
      executingPerson,
      isPreExistingContract,
      liquidationAmount,
      liquidationAmountConverted,
      liquidationDate,
      liquidationReason,
      isCostAccounting,
      hasInvoiced,
      otherTerms,
      deliveryAddress,
      items,
    };

    onSubmit(payload);
    notify(`Đã lưu Hợp đồng bán ${contractCode} thành công!`);

    if (andNew) {
      const nextNum = parseInt(contractCode.replace(/\D/g, "") || "1", 10) + 1;
      const nextCode = `HĐB${nextNum.toString().padStart(5, "0")}`;
      setContractCode(nextCode);
      setCustomerCode("");
      setCustomerName("");
      setAddress("");
      setContactPerson("");
      setSummary("");
      setContractAmount(0);
      setContractAmountConverted(0);
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          reqQty: 1,
          deliveredQty: 0,
          unitPrice: 0,
          amount: 0,
          discountRate: 0,
          discountAmount: 0,
          vatRate: "",
          vatAmount: 0,
        },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "min(1440px, 98vw)",
          height: "min(920px, 96vh)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 6,
          background: "#ffffff",
          boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
      >
        {/* ================================================================= */}
        {/* MODAL HEADER (Screenshot 3)                                       */}
        {/* ================================================================= */}
        <header className="misa-purchase-modal-header" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              type="button"
              title="Lịch sử chứng từ"
              style={{
                border: "none",
                background: "transparent",
                padding: "2px",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
              }}
            >
              <RotateCcw size={16} />
            </button>

            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              {contractType === "project" ? `Dự án ${contractCode}` : `Hợp đồng bán ${contractCode}`}
            </h2>

            {/* Radio options: Hợp đồng / Dự án */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: 6, fontSize: 12.5 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b", fontWeight: contractType === "contract" ? 600 : 400 }}>
                <input
                  type="radio"
                  name="contractType"
                  value="contract"
                  checked={contractType === "contract"}
                  onChange={() => setContractType("contract")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Hợp đồng</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#1e293b", fontWeight: contractType === "project" ? 600 : 400 }}>
                <input
                  type="radio"
                  name="contractType"
                  value="project"
                  checked={contractType === "project"}
                  onChange={() => setContractType("project")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Dự án</span>
              </label>
            </div>

            {/* Quick Order Lookup Search Box (Only for Hợp đồng mode) */}
            {contractType === "contract" && (
              <div style={{ position: "relative", marginLeft: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    height: 26,
                    padding: "0 6px",
                    background: "#ffffff",
                    gap: 6,
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nhập số đơn đặt hàng"
                    value={searchOrderCode}
                    onChange={(e) => {
                      setSearchOrderCode(e.target.value);
                      setShowOrderDropdown(true);
                    }}
                    onFocus={() => setShowOrderDropdown(true)}
                    style={{
                      border: "none",
                      outline: "none",
                      fontSize: 12,
                      width: 175,
                      color: "#1e293b",
                      background: "transparent",
                    }}
                  />
                  <Search size={13} style={{ color: "#94a3b8" }} />
                  <button
                    type="button"
                    onClick={() => setShowOrderDropdown(!showOrderDropdown)}
                    style={{ background: "none", border: "none", color: "#64748b", padding: 0, cursor: "pointer", display: "grid", placeItems: "center" }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* Order dropdown selection */}
                {showOrderDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 60,
                      minWidth: 280,
                    }}
                  >
                    <div style={{ padding: "6px 10px", fontSize: 11.5, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                      Chọn Đơn đặt hàng để lập Hợp đồng:
                    </div>
                    {(ordersList.length > 0
                      ? ordersList
                      : [
                          { code: "ĐH00001", customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", amount: 128000000 },
                          { code: "ĐH00002", customer: "Công ty TNHH Phát triển Công nghệ Việt Hưng", amount: 32500000 },
                        ]
                    ).map((o: any) => (
                      <div
                        key={o.code}
                        onClick={() => handleSelectOrder(o)}
                        style={{
                          padding: "8px 10px",
                          fontSize: 12.5,
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#eff6ff";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "#ffffff";
                        }}
                      >
                        <strong style={{ color: "#0284c7" }}>{o.code}</strong> - {o.customer} ({formatVND(o.amount)} đ)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-purchase-link-btn"
              title="Hướng dẫn sử dụng"
              onClick={() => notify("Mở tài liệu Hướng dẫn quản lý Hợp đồng bán hàng")}
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Phím tắt">
              <Keyboard size={16} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Thiết lập"
              onClick={() => notify("Cấu hình trường thông tin mẫu Hợp đồng bán")}
            >
              <Settings size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* MODAL BODY (SCROLLABLE)                                           */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            background: "#ffffff",
          }}
        >
          {/* TOP MASTER SECTION: 3 COLUMNS (LEFT / MIDDLE / RIGHT SUMMARY) */}
          <div style={{ display: "grid", gridTemplateColumns: "360px 1fr 140px", gap: "16px 20px", alignItems: "start" }}>
            {/* LEFT COLUMN: Số hợp đồng / Mã dự án, Ngày ký, Thuộc dự án, Giá trị, Tình trạng */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: Số hợp đồng / Mã dự án + Ngày ký */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">{contractType === "project" ? "Mã dự án" : "Số hợp đồng"}</label>
                  <input
                    type="text"
                    value={contractCode}
                    onChange={(e) => setContractCode(e.target.value)}
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
                  <label className="misa-purchase-label">Ngày ký</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 28, padding: "0 6px", background: "#ffffff" }}>
                    <input
                      type="text"
                      value={signDate}
                      onChange={(e) => setSignDate(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Calendar size={13} style={{ color: "#94a3b8" }} />
                  </div>
                </div>
              </div>

              {/* Row 2: Thuộc dự án (ONLY in Contract mode) */}
              {contractType === "contract" && (
                <div>
                  <label className="misa-purchase-label">Thuộc dự án</label>
                  <select
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">-- Không thuộc dự án --</option>
                    <option value="Dự án Khu đô thị Nam An Khánh">Dự án Khu đô thị Nam An Khánh</option>
                    <option value="Dự án Tòa nhà EVN Hapro">Dự án Tòa nhà EVN Hapro</option>
                    <option value="Dự án Trạm biến áp 110kV Phố Nối">Dự án Trạm biến áp 110kV Phố Nối</option>
                  </select>
                </div>
              )}

              {/* Row 3: Giá trị hợp đồng / dự án + Giá trị quy đổi */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">{contractType === "project" ? "Giá trị dự án" : "Giá trị hợp đồng"}</label>
                  <input
                    type="text"
                    value={contractAmount === 0 ? "0,00" : formatVND(contractAmount)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const v = Number(raw) || 0;
                      setContractAmount(v);
                      setContractAmountConverted(v);
                    }}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      textAlign: "right",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label className="misa-purchase-label">{contractType === "project" ? "Giá trị dự án quy đổi" : "Giá trị hợp đồng quy đổi"}</label>
                  <input
                    type="text"
                    value={contractAmountConverted === 0 ? "0" : formatVND(contractAmountConverted)}
                    readOnly
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      textAlign: "right",
                      background: "#f8fafc",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Tình trạng hợp đồng / dự án + Tình trạng giao hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">{contractType === "project" ? "Tình trạng dự án" : "Tình trạng hợp đồng"}</label>
                  <select
                    value={contractStatus}
                    onChange={(e) => setContractStatus(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Chưa thực hiện">Chưa thực hiện</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Đã thanh lý">Đã thanh lý</option>
                    <option value="Đã hủy">Đã hủy</option>
                  </select>
                </div>
                <div>
                  <label className="misa-purchase-label">Tình trạng giao hàng</label>
                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="Chưa giao">Chưa giao</option>
                    <option value="Giao một phần">Giao một phần</option>
                    <option value="Đã giao hết">Đã giao hết</option>
                  </select>
                </div>
              </div>
            </div>

            {/* MIDDLE COLUMN: Customer info, Dates, Auto-liquidate */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: Mã KH + Tên KH */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 140 }}>
                  <label className="misa-purchase-label">Mã khách hàng</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 28, padding: "0 4px 0 6px", background: "#ffffff" }}>
                    <input
                      type="text"
                      value={customerCode}
                      onChange={(e) => setCustomerCode(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenCustomerModal) onOpenCustomerModal();
                        else notify("Thêm nhanh khách hàng mới");
                      }}
                      style={{ background: "none", border: "none", color: "#00b06b", cursor: "pointer", padding: "2px" }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = SAMPLE_SALE_CUSTOMERS[0];
                        handleSelectCustomer(next.code);
                      }}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <label className="misa-purchase-label">Tên khách hàng</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Row 2: Địa chỉ */}
              <div>
                <label className="misa-purchase-label">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                />
              </div>

              {/* Row 3: Người liên hệ */}
              <div>
                <label className="misa-purchase-label">Người liên hệ</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                />
              </div>

              {/* Row 4: Hạn giao hàng | Hạn thanh toán | Tham chiếu ... */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                <div style={{ width: 130 }}>
                  <label className="misa-purchase-label">Hạn giao hàng</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 28, padding: "0 6px", background: "#ffffff" }}>
                    <input
                      type="text"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Calendar size={13} style={{ color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ width: 130 }}>
                  <label className="misa-purchase-label">Hạn thanh toán</label>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 28, padding: "0 6px", background: "#ffffff" }}>
                    <input
                      type="text"
                      value={paymentDueDate}
                      onChange={(e) => setPaymentDueDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                    />
                    <Calendar size={13} style={{ color: "#94a3b8" }} />
                  </div>
                </div>

                <div style={{ paddingBottom: 6 }}>
                  <span
                    onClick={() => notify("Chọn chứng từ tham chiếu")}
                    style={{ color: "#0284c7", fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}
                  >
                    Tham chiếu ...
                  </span>
                </div>
              </div>

              {/* Row 5: Checkbox Auto-Liquidate (ONLY in Contract mode) */}
              {contractType === "contract" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <input
                    type="checkbox"
                    id="autoLiquidate"
                    checked={autoLiquidate}
                    onChange={(e) => setAutoLiquidate(e.target.checked)}
                    style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
                  />
                  <label htmlFor="autoLiquidate" style={{ fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                    Tự động chuyển Đã thanh lý khi hợp đồng đã giao đủ hàng, đã xuất hóa đơn và đã thu đủ tiền
                  </label>
                </div>
              )}
            </div>

            {/* RIGHT SUMMARY COLUMN: Giá trị hợp đồng / Giá trị dự án */}
            <div style={{ textAlign: "right", paddingRight: 4 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                {contractType === "project" ? "Giá trị dự án" : "Giá trị hợp đồng"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>
                {finalContractValue === 0 ? "0" : formatVND(finalContractValue)}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* COLLAPSIBLE 1: THÔNG TIN MỞ RỘNG (SOLID BORDERS, NO DASHED)       */}
          {/* ================================================================= */}
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setExpandExtendedInfo(!expandExtendedInfo)}
              style={{
                background: "none",
                border: "none",
                padding: "2px 0",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontWeight: 600,
                color: "#1e293b",
                cursor: "pointer",
                fontSize: 12.5,
                marginBottom: 6,
              }}
            >
              {expandExtendedInfo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>Thông tin mở rộng</span>
            </button>

            {expandExtendedInfo && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "360px 1fr 1fr",
                  gap: "10px 20px",
                  background: "#f8fafc",
                  padding: "12px 16px",
                  borderRadius: 4,
                  border: "1px solid #e2e8f0",
                }}
              >
                {/* Col 1 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Trích yếu</label>
                    <div style={{ position: "relative" }}>
                      <textarea
                        rows={2}
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        style={{
                          width: "100%",
                          height: 52,
                          padding: "4px 28px 4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12,
                          resize: "none",
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAIAssistSummary}
                        title="AVA AI gợi ý trích yếu"
                        style={{
                          position: "absolute",
                          right: 6,
                          bottom: 8,
                          background: "none",
                          border: "none",
                          color: "#8b5cf6",
                          cursor: "pointer",
                          padding: 0,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Sparkles size={14} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="misa-purchase-label">Đơn vị thực hiện</label>
                    <select
                      value={executingDepartment}
                      onChange={(e) => setExecutingDepartment(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                    >
                      <option value="">-- Chọn đơn vị thực hiện --</option>
                      <option value="Phòng Dự án & Bán hàng">Phòng Dự án & Bán hàng</option>
                      <option value="Phòng Kinh doanh Tổng hợp">Phòng Kinh doanh Tổng hợp</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <label className="misa-purchase-label" style={{ marginBottom: 0 }}>Người thực hiện</label>
                      <span
                        style={{
                          background: "#3b82f6",
                          color: "#ffffff",
                          borderRadius: "50%",
                          width: 13,
                          height: 13,
                          display: "inline-grid",
                          placeItems: "center",
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        <Minus size={9} strokeWidth={3} />
                      </span>
                    </div>
                    <select
                      value={executingPerson}
                      onChange={(e) => setExecutingPerson(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", boxSizing: "border-box" }}
                    >
                      <option value="">-- Chọn người thực hiện --</option>
                      <option value="Nguyễn Văn A - Trưởng phòng">Nguyễn Văn A - Trưởng phòng</option>
                      <option value="Trần Thị B - Chuyên viên">Trần Thị B - Chuyên viên</option>
                    </select>
                  </div>
                </div>

                {/* Col 2 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="misa-purchase-label">Giá trị thanh lý</label>
                      <input
                        type="text"
                        value={liquidationAmount === 0 ? "0,00" : formatVND(liquidationAmount)}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          setLiquidationAmount(Number(raw) || 0);
                        }}
                        style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#ffffff", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Giá trị thanh lý quy đổi</label>
                      <input
                        type="text"
                        value={liquidationAmountConverted === 0 ? "0" : formatVND(liquidationAmountConverted)}
                        readOnly
                        style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f8fafc", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="misa-purchase-label">Ngày thanh lý/hủy bỏ</label>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #cbd5e1", borderRadius: 4, height: 28, padding: "0 6px", background: "#ffffff" }}>
                      <input
                        type="text"
                        value={liquidationDate}
                        onChange={(e) => setLiquidationDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                      />
                      <Calendar size={13} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>

                  <div>
                    <label className="misa-purchase-label">Lý do thanh lý/hủy bỏ</label>
                    <input
                      type="text"
                      value={liquidationReason}
                      onChange={(e) => setLiquidationReason(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        id="contractCosting"
                        checked={isCostAccounting}
                        onChange={(e) => setIsCostAccounting(e.target.checked)}
                        style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
                      />
                      <label htmlFor="contractCosting" style={{ fontSize: 12, color: "#00b06b", fontWeight: 600, cursor: "pointer" }}>
                        Tính giá thành
                      </label>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        id="contractInvoiced"
                        checked={hasInvoiced}
                        onChange={(e) => setHasInvoiced(e.target.checked)}
                        style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
                      />
                      <label htmlFor="contractInvoiced" style={{ fontSize: 12, color: "#475569", cursor: "pointer" }}>
                        Đã xuất hóa đơn
                      </label>
                    </div>
                  </div>
                </div>

                {/* Col 3 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Điều khoản khác</label>
                    <textarea
                      rows={2}
                      value={otherTerms}
                      onChange={(e) => setOtherTerms(e.target.value)}
                      style={{ width: "100%", height: 52, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, resize: "none", background: "#ffffff", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label className="misa-purchase-label">Địa chỉ giao hàng</label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      style={{ width: "100%", height: 52, padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, resize: "none", background: "#ffffff", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Checkbox Outside below Thông tin mở rộng */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <input
                type="checkbox"
                id="contractPreExisting"
                checked={isPreExistingContract}
                onChange={(e) => setIsPreExistingContract(e.target.checked)}
                style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
              />
              <label htmlFor="contractPreExisting" style={{ fontSize: 12, color: "#475569", cursor: "pointer" }}>
                Là hợp đồng/dự án phát sinh trước khi sử dụng phần mềm
              </label>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTIONS ONLY FOR HỢP ĐỒNG (HIDDEN IN DỰ ÁN MODE)                */}
          {/* ================================================================= */}
          {contractType === "contract" && (
            <>
              {/* COLLAPSIBLE 2: ĐIỀU KHOẢN THANH TOÁN */}
              <div style={{ marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => setExpandPaymentTerms(!expandPaymentTerms)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 0",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer",
                    fontSize: 12.5,
                  }}
                >
                  {expandPaymentTerms ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Điều khoản thanh toán</span>
                </button>

                {expandPaymentTerms && (
                  <div style={{ padding: "6px 0" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #cbd5e1" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9" }}>
                          <th style={{ padding: "5px 8px", textAlign: "left" }}>Đợt thanh toán</th>
                          <th style={{ padding: "5px 8px", textAlign: "right" }}>Tỷ lệ (%)</th>
                          <th style={{ padding: "5px 8px", textAlign: "right" }}>Số tiền</th>
                          <th style={{ padding: "5px 8px", textAlign: "left" }}>Hạn thanh toán</th>
                          <th style={{ padding: "5px 8px", textAlign: "left" }}>Điều kiện thanh toán</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "5px 8px" }}>Đợt 1 (Tạm ứng)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>30%</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{formatVND(Math.round(finalContractValue * 0.3))} đ</td>
                          <td style={{ padding: "5px 8px" }}>05/10/2026</td>
                          <td style={{ padding: "5px 8px", color: "#64748b" }}>Ngay sau khi ký kết hợp đồng</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px 8px" }}>Đợt 2 (Nghiệm thu)</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>70%</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{formatVND(Math.round(finalContractValue * 0.7))} đ</td>
                          <td style={{ padding: "5px 8px" }}>30/10/2026</td>
                          <td style={{ padding: "5px 8px", color: "#64748b" }}>Sau khi bàn giao và ký biên bản nghiệm thu</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* TAB & DETAIL TABLE: DANH SÁCH HÀNG HÓA DỊCH VỤ */}
              <div style={{ marginTop: 4 }}>
                <div style={{ paddingBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", display: "inline-block" }}>
                    Danh sách hàng hóa dịch vụ
                  </span>
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto", background: "#ffffff" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    <thead>
                      <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                        <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                        <th style={{ width: 130, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Pin size={12} style={{ color: "#64748b" }} />
                            <span>Mã hàng</span>
                          </div>
                        </th>
                        <th style={{ width: 220, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Tên hàng</th>
                        <th style={{ width: 70, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>ĐVT</th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Số lượng yêu cầu</th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Số lượng đã giao</th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Đơn giá</th>
                        <th style={{ width: 120, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Thành tiền</th>
                        <th style={{ width: 90, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Tỷ lệ CK (%)</th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Tiền chiết khấu</th>
                        <th style={{ width: 90, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>% thuế GTGT</th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Tiền thuế GTGT</th>
                        <th style={{ width: 40, textAlign: "center", padding: "4px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fbfcfe", height: 32 }}>
                          <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>{idx + 1}</td>

                          {/* Mã hàng */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px" }}>
                            <input
                              type="text"
                              value={it.code}
                              onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                              placeholder=""
                              list={`contract-catalog-items-${idx}`}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                            <datalist id={`contract-catalog-items-${idx}`}>
                              {SAMPLE_SALE_ITEMS.map((si) => (
                                <option key={si.code} value={si.code}>{si.name}</option>
                              ))}
                            </datalist>
                          </td>

                          {/* Tên hàng */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                          </td>

                          {/* ĐVT */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Số lượng yêu cầu */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="number"
                              step="0.01"
                              value={it.reqQty}
                              onChange={(e) => handleItemChange(idx, "reqQty", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Số lượng đã giao */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="number"
                              step="0.01"
                              value={it.deliveredQty}
                              onChange={(e) => handleItemChange(idx, "deliveredQty", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Đơn giá */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="number"
                              value={it.unitPrice}
                              onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Thành tiền */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right", fontWeight: 500 }}>
                            {it.amount === 0 ? "0" : formatVND(it.amount)}
                          </td>

                          {/* Tỷ lệ CK (%) */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="number"
                              step="0.01"
                              value={it.discountRate}
                              onChange={(e) => handleItemChange(idx, "discountRate", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Tiền chiết khấu */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                            {it.discountAmount === 0 ? "0" : formatVND(it.discountAmount)}
                          </td>

                          {/* % thuế GTGT */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "right" }}>
                            <select
                              value={it.vatRate}
                              onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                              style={{ border: "none", background: "transparent", fontSize: 12.5, outline: "none", width: "100%", textAlign: "right" }}
                            >
                              <option value="">0%</option>
                              <option value="5">5%</option>
                              <option value="8">8%</option>
                              <option value="10">10%</option>
                              <option value="KCT">KCT</option>
                            </select>
                          </td>

                          {/* Tiền thuế GTGT */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                            {it.vatAmount === 0 ? "0" : formatVND(it.vatAmount)}
                          </td>

                          {/* Delete action */}
                          <td style={{ textAlign: "center", padding: "2px" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              title="Xóa dòng"
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* SUMMARY ROW */}
                      <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                          {totalReqQty.toFixed(2).replace(".", ",")}
                        </td>
                        <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                          {totalDeliveredQty.toFixed(2).replace(".", ",")}
                        </td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                          {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                        </td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                          {totalDiscount === 0 ? "0" : formatVND(totalDiscount)}
                        </td>
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                          {totalVat === 0 ? "0" : formatVND(totalVat)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bottom line: Total count + action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Tổng số: <strong>{items.length}</strong>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        style={{
                          height: 26,
                          padding: "0 10px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#334155",
                        }}
                      >
                        <Plus size={13} />
                        <span>Thêm dòng</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleAIAssistSummary}
                        style={{
                          height: 26,
                          padding: "0 10px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#334155",
                        }}
                      >
                        <FileText size={13} />
                        <span>Thêm ghi chú</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearAllItems}
                        style={{
                          height: 26,
                          padding: "0 10px",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          fontSize: 12,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#dc2626",
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Xóa hết dòng</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
                      <span>Số dòng/trang</span>
                      <select
                        defaultValue="20"
                        style={{ border: "1px solid #cbd5e1", borderRadius: 3, height: 24, padding: "0 4px", fontSize: 12, background: "#ffffff" }}
                      >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                      </select>
                      <span style={{ cursor: "pointer", color: "#94a3b8" }}>|&lt;</span>
                      <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
                      <strong style={{ color: "#00b06b", padding: "0 4px" }}>1</strong>
                      <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
                      <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;|</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ================================================================= */}
        {/* MODAL FOOTER (Matching Screenshot 1 & 2)                          */}
        {/* ================================================================= */}
        <footer
          style={{
            height: 46,
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "0 18px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
            style={{
              height: 30,
              padding: "0 16px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
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
            className="misa-invoice-btn-cancel"
            onClick={() => handleSave(false)}
            style={{
              height: 30,
              padding: "0 18px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#1e293b",
              cursor: "pointer",
            }}
          >
            Cất
          </button>

          <div style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                height: 30,
                padding: "0 14px",
                border: "none",
                background: "#00a862",
                color: "#ffffff",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              <span>Cất và Thêm</span>
              <ChevronDown size={13} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
