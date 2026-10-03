import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Upload,
  Keyboard,
  Settings,
  Minus,
  Search,
  Pin,
  Clock,
  FileText,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  RotateCcw,
  Paperclip,
} from "lucide-react";

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// Common supplier sample data
export const SAMPLE_SUPPLIERS = [
  {
    code: "NCC001",
    name: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
    taxCode: "0102345678",
    address: "Số 18 Hoàng Cầu, Đống Đa, Hà Nội",
    contact: "Nguyễn Văn Hùng",
    phone: "0912345678",
    debtDays: 30,
  },
  {
    code: "NCC002",
    name: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
    taxCode: "0900123456",
    address: "KCN Phố Nối A, Hưng Yên",
    contact: "Trần Thị Lan",
    phone: "0987654321",
    debtDays: 45,
  },
  {
    code: "NCC003",
    name: "Công ty TNHH Nhập khẩu & Thương mại Sao Nam",
    taxCode: "0309876543",
    address: "245 Điện Biên Phủ, P.15, Q. Bình Thạnh, TP.HCM",
    contact: "Lê Minh Tuấn",
    phone: "0903123456",
    debtDays: 15,
  },
];

// Common items sample data
export const SAMPLE_ITEMS = [
  { code: "VT001", name: "Thép cuộn mạ kẽm Ø6", unit: "Kg", price: 21500, vat: 10, stock: "1561", stockName: "1561 - Hàng hóa" },
  { code: "VT002", name: "Ống thép đúc phi 90 dày 3.5mm", unit: "Cây", price: 345000, vat: 10, stock: "1561", stockName: "1561 - Hàng hóa" },
  { code: "VT003", name: "Bulong nở inox M12x100", unit: "Bộ", price: 12500, vat: 8, stock: "1561", stockName: "1561 - Hàng hóa" },
  { code: "VT004", name: "Sơn chống rỉ Alkyd xám 20L", unit: "Thùng", price: 850000, vat: 8, stock: "152", stockName: "152 - Nguyên vật liệu" },
  { code: "DV001", name: "Dịch vụ vận chuyển bốc dỡ hàng hóa", unit: "Chuyến", price: 1500000, vat: 8, stock: "1562", stockName: "1562 - Chi phí thu mua" },
];

// ============================================================================
// 1. MODAL: ĐƠN MUA HÀNG (MATCHING IMAGE 2)
// ============================================================================
export interface PurchaseOrderItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  amount: number;
  vatRate: number;
  vatAmount: number;
}

export interface PurchaseOrderModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseOrderModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseOrderModalProps) {
  // Master fields
  const [supplierCode, setSupplierCode] = useState("NCC001");
  const [supplierName, setSupplierName] = useState("Công ty TNHH Thiết bị Công nghiệp Tân Phát");
  const [taxCode, setTaxCode] = useState("0102345678");
  const [address, setAddress] = useState("Số 18 Hoàng Cầu, Đống Đa, Hà Nội");
  const [contactPerson, setContactPerson] = useState("Nguyễn Văn Hùng");
  const [description, setDescription] = useState("Mua vật tư phục vụ dự án tháng 9/2026");
  const [buyerEmployee, setBuyerEmployee] = useState("Nguyễn Văn A - Phòng Mua hàng");
  const [paymentTerms, setPaymentTerms] = useState("Gối đầu 30 ngày");
  const [debtDays, setDebtDays] = useState(30);

  // Right column fields
  const [orderDate, setOrderDate] = useState("29/09/2026");
  const [orderCode, setOrderCode] = useState("ĐMH00001");
  const [status, setStatus] = useState("Chưa thực hiện");
  const [deliveryDate, setDeliveryDate] = useState("05/10/2026");

  // Grid & items
  const [discountPolicy, setDiscountPolicy] = useState("Không chiết khấu");
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    {
      id: "row-1",
      code: "VT001",
      name: "Thép cuộn mạ kẽm Ø6",
      unit: "Kg",
      quantity: 1000,
      receivedQty: 0,
      unitPrice: 21500,
      amount: 21500000,
      vatRate: 10,
      vatAmount: 2150000,
    },
    {
      id: "row-2",
      code: "VT002",
      name: "Ống thép đúc phi 90 dày 3.5mm",
      unit: "Cây",
      quantity: 50,
      receivedQty: 0,
      unitPrice: 345000,
      amount: 17250000,
      vatRate: 10,
      vatAmount: 1725000,
    },
  ]);

  // Bottom fields
  const [deliveryLocation, setDeliveryLocation] = useState("Kho Tổng Hà Nội - Km12 QL1A");
  const [otherTerms, setOtherTerms] = useState("Bên bán chịu chi phí bốc xếp và vận chuyển đến kho bên mua.");
  const [discountAmount] = useState(0);

  // Search in header
  const [searchOrderNumber, setSearchOrderNumber] = useState("");

  // Suppliers selection helper
  const handleSelectSupplier = (code: string) => {
    setSupplierCode(code);
    const found = SAMPLE_SUPPLIERS.find((s) => s.code === code);
    if (found) {
      setSupplierName(found.name);
      setTaxCode(found.taxCode);
      setAddress(found.address);
      setContactPerson(found.contact);
      setDebtDays(found.debtDays);
    }
  };

  // Item modifications
  const handleItemChange = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "code") {
      const found = SAMPLE_ITEMS.find((it) => it.code === value);
      if (found) {
        item.name = found.name;
        item.unit = found.unit;
        item.unitPrice = found.price;
        item.vatRate = found.vat;
      }
    }

    if (field === "quantity" || field === "unitPrice" || field === "code") {
      item.amount = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      item.vatAmount = Math.round((item.amount * (Number(item.vatRate) || 0)) / 100);
    }

    if (field === "vatRate") {
      item.vatAmount = Math.round((item.amount * (Number(value) || 0)) / 100);
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleAddRow = () => {
    const newItem: PurchaseOrderItem = {
      id: `row-${Date.now()}`,
      code: "",
      name: "",
      unit: "Cái",
      quantity: 1,
      receivedQty: 0,
      unitPrice: 0,
      amount: 0,
      vatRate: 10,
      vatAmount: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      setItems([{
        id: `row-${Date.now()}`,
        code: "",
        name: "",
        unit: "Cái",
        quantity: 0,
        receivedQty: 0,
        unitPrice: 0,
        amount: 0,
        vatRate: 0,
        vatAmount: 0,
      }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleClearAllRows = () => {
    setItems([{
      id: `row-${Date.now()}`,
      code: "",
      name: "",
      unit: "",
      quantity: 0,
      receivedQty: 0,
      unitPrice: 0,
      amount: 0,
      vatRate: 0,
      vatAmount: 0,
    }]);
  };

  // Calculations
  const totalSubtotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalVAT = items.reduce((sum, it) => sum + (Number(it.vatAmount) || 0), 0);
  const totalGrand = totalSubtotal - discountAmount + totalVAT;
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalReceivedQty = items.reduce((sum, it) => sum + (Number(it.receivedQty) || 0), 0);

  const handleSave = (andPrint = false) => {
    onSubmit({
      kind: "purchase_order",
      orderCode,
      orderDate,
      supplierCode,
      supplierName,
      taxCode,
      address,
      contactPerson,
      description,
      buyerEmployee,
      paymentTerms,
      debtDays,
      status,
      deliveryDate,
      deliveryLocation,
      otherTerms,
      items,
      totalSubtotal,
      discountAmount,
      totalVAT,
      totalGrand,
      andPrint,
    });
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Top Header (Image 2) */}
        <header className="misa-purchase-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} style={{ color: "#64748b" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
                Đơn mua hàng {orderCode}
              </h2>
            </div>

            {/* Search Box: Nhập số đơn đặt hàng */}
            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Nhập số đơn đặt hàng"
                value={searchOrderNumber}
                onChange={(e) => setSearchOrderNumber(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 170, background: "transparent" }}
              />
              <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#64748b" }}>
                <Search size={14} />
              </button>
              <button type="button" style={{ border: "none", background: "transparent", cursor: "pointer", padding: "0 2px", color: "#64748b" }}>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Phím tắt">
              <Keyboard size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Tùy chọn">
              <Settings size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Thu nhỏ">
              <Minus size={16} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Form Area */}
        <div className="misa-po-master-grid">
          {/* Left Column: Supplier & Terms Info */}
          <div className="misa-po-left-form">
            {/* Row 1: Mã NCC & Tên NCC */}
            <div className="misa-po-row">
              <div className="misa-po-field">
                <label className="misa-po-label">Mã nhà cung cấp</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      value={supplierCode}
                      onChange={(e) => handleSelectSupplier(e.target.value)}
                      className="misa-po-input"
                      style={{ paddingRight: 26 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const idx = SAMPLE_SUPPLIERS.findIndex((s) => s.code === supplierCode);
                        const next = SAMPLE_SUPPLIERS[(idx + 1) % SAMPLE_SUPPLIERS.length];
                        handleSelectSupplier(next.code);
                      }}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "#64748b",
                        padding: 0,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenSupplierModal}
                    title="Thêm nhà cung cấp mới"
                    className="misa-po-btn-icon"
                  >
                    <Plus size={15} />
                  </button>
                  <button
                    type="button"
                    title="Xem số dư / thanh toán NCC"
                    className="misa-po-btn-icon secondary"
                  >
                    <DollarSign size={15} />
                  </button>
                </div>
              </div>

              <div className="misa-po-field">
                <label className="misa-po-label">Tên nhà cung cấp</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="misa-po-input"
                />
              </div>
            </div>

            {/* Row 2: MST & Địa chỉ */}
            <div className="misa-po-row">
              <div className="misa-po-field">
                <label className="misa-po-label">
                  Mã số thuế <small>(Ctrl+R)</small>
                </label>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  className="misa-po-input"
                />
              </div>
              <div className="misa-po-field">
                <label className="misa-po-label">Địa chỉ</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="misa-po-input"
                />
              </div>
            </div>

            {/* Row 3: Người liên hệ & Diễn giải */}
            <div className="misa-po-row">
              <div className="misa-po-field">
                <label className="misa-po-label">Người liên hệ</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="misa-po-input"
                />
              </div>
              <div className="misa-po-field">
                <label className="misa-po-label">Diễn giải</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="misa-po-input"
                    style={{ paddingRight: 30 }}
                  />
                  <span
                    title="AVA AI gợi ý diễn giải"
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#8b5cf6",
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Sparkles size={15} />
                  </span>
                </div>
              </div>
            </div>

            {/* Row 4: Nhân viên mua hàng, Điều khoản TT, Số ngày nợ */}
            <div className="misa-po-row">
              <div className="misa-po-field">
                <label className="misa-po-label">Nhân viên mua hàng</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <select
                    value={buyerEmployee}
                    onChange={(e) => setBuyerEmployee(e.target.value)}
                    className="misa-po-select"
                    style={{ flex: 1 }}
                  >
                    <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                    <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                    <option value="Lê Văn C - Chuyên viên Mua hàng">Lê Văn C - Chuyên viên Mua hàng</option>
                  </select>
                  <button
                    type="button"
                    title="Thêm nhân viên mua hàng"
                    className="misa-po-btn-icon"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 12 }}>
                <div className="misa-po-field">
                  <label className="misa-po-label">Điều khoản thanh toán</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="misa-po-select"
                      style={{ flex: 1 }}
                    >
                      <option value="Gối đầu 30 ngày">Gối đầu 30 ngày</option>
                      <option value="Thanh toán ngay khi giao hàng">Thanh toán ngay khi giao hàng</option>
                      <option value="Tạm ứng 30%, thanh toán 70% sau khi nhận">Tạm ứng 30%, thanh toán 70% sau khi nhận</option>
                      <option value="Công nợ 45 ngày">Công nợ 45 ngày</option>
                    </select>
                    <button
                      type="button"
                      title="Thêm điều khoản thanh toán"
                      className="misa-po-btn-icon"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                <div className="misa-po-field">
                  <label className="misa-po-label">Số ngày được nợ</label>
                  <input
                    type="number"
                    value={debtDays}
                    onChange={(e) => setDebtDays(Number(e.target.value) || 0)}
                    className="misa-po-input"
                    style={{ textAlign: "right", fontWeight: 600 }}
                  />
                </div>
              </div>
            </div>

            {/* Row 5: Tham chiếu */}
            <div style={{ marginTop: 2 }}>
              <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 600 }}>
                Tham chiếu ...
              </span>
            </div>
          </div>

          {/* Right Column: Totals & Dates (Image 2) */}
          <div className="misa-po-right-panel">
            <div className="misa-po-summary-card">
              <span className="misa-po-summary-title">Tổng tiền thanh toán</span>
              <strong className="misa-po-summary-amount">
                {formatVND(totalGrand)}
              </strong>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="misa-po-field">
                <label className="misa-po-label">Ngày đơn hàng</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="misa-po-input"
                    style={{ paddingRight: 30 }}
                  />
                  <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                </div>
              </div>

              <div className="misa-po-field">
                <label className="misa-po-label">Số đơn hàng</label>
                <input
                  type="text"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  className="misa-po-input"
                  style={{ fontWeight: 700, color: "#0f172a" }}
                />
              </div>

              <div className="misa-po-field">
                <label className="misa-po-label">
                  Tình trạng <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="misa-po-select"
                >
                  <option value="Chưa thực hiện">Chưa thực hiện</option>
                  <option value="Đang thực hiện">Đang thực hiện</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                  <option value="Đã hủy">Đã hủy</option>
                </select>
              </div>

              <div className="misa-po-field">
                <label className="misa-po-label">Ngày giao hàng</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="misa-po-input"
                    style={{ paddingRight: 30 }}
                  />
                  <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab & Table Section */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          {/* Subtab Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: 18 }}>
              <button
                type="button"
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: "2px solid #00b06b",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#00b06b",
                  cursor: "pointer",
                }}
              >
                Hàng tiền
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>Chiết khấu:</span>
              <select
                value={discountPolicy}
                onChange={(e) => setDiscountPolicy(e.target.value)}
                className="misa-po-select"
                style={{ height: 28, width: 180, fontSize: 12 }}
              >
                <option value="Không chiết khấu">Không chiết khấu</option>
                <option value="Chiết khấu theo dòng hàng">Chiết khấu theo từng dòng</option>
                <option value="Chiết khấu theo tổng hóa đơn">Chiết khấu theo tổng đơn</option>
              </select>
            </div>
          </div>

          {/* Grid Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 110 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Pin size={11} style={{ transform: "rotate(45deg)" }} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th>Tên hàng</th>
                  <th style={{ width: 80 }}>ĐVT</th>
                  <th style={{ width: 90, textAlign: "right" }}>Số lượng</th>
                  <th style={{ width: 100, textAlign: "right" }}>Số lượng nhận</th>
                  <th style={{ width: 110, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 120, textAlign: "right" }}>Thành tiền</th>
                  <th style={{ width: 90, textAlign: "right" }}>% Thuế GTGT</th>
                  <th style={{ width: 110, textAlign: "right" }}>Tiền thuế GTGT</th>
                  <th style={{ width: 40, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                          placeholder="Mã hàng..."
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        placeholder="Tên hàng hóa, dịch vụ..."
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.receivedQty}
                        onChange={(e) => handleItemChange(idx, "receivedQty", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                      {formatVND(row.amount)}
                    </td>
                    <td>
                      <select
                        value={row.vatRate}
                        onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 24, border: "none", outline: "none", fontSize: 12, textAlign: "right", background: "transparent" }}
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={8}>8%</option>
                        <option value={10}>10%</option>
                      </select>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                      {formatVND(row.vatAmount)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}
                        title="Xóa dòng"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Summary Row */}
                <tr style={{ background: "#f8fafc", fontWeight: 700, borderTop: "1px solid #cbd5e1" }}>
                  <td colSpan={4} style={{ textAlign: "right", padding: "6px 10px", color: "#475569" }}>
                    Tổng cộng:
                  </td>
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>
                    {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(totalQuantity)}
                  </td>
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>
                    {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2 }).format(totalReceivedQty)}
                  </td>
                  <td></td>
                  <td style={{ textAlign: "right", padding: "6px 8px", color: "#059669" }}>
                    {formatVND(totalSubtotal)}
                  </td>
                  <td></td>
                  <td style={{ textAlign: "right", padding: "6px 8px", color: "#059669" }}>
                    {formatVND(totalVAT)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table Actions Toolbar (Image 2) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Tổng số: <strong>{items.length}</strong></span>
              <button
                type="button"
                onClick={handleAddRow}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
              >
                <Plus size={13} /> Thêm dòng
              </button>
              <button
                type="button"
                onClick={handleClearAllRows}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}
              >
                <Trash2 size={13} /> Xóa hết dòng
              </button>
              <button
                type="button"
                onClick={() => handleAddRow()}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
              >
                <FileText size={13} /> Thêm ghi chú
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
              <span>Số dòng/trang</span>
              <select style={{ height: 24, padding: "0 4px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 11.5 }}>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>{"< 1 >"}</span>
            </div>
          </div>

          {/* Bottom Extra Inputs & Summary (Image 2) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            {/* Left extra block */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label className="misa-purchase-label">Địa điểm giao hàng</label>
                <input
                  type="text"
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                />
              </div>

              <div>
                <label className="misa-purchase-label">Điều khoản khác</label>
                <textarea
                  value={otherTerms}
                  onChange={(e) => setOtherTerms(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5, fontFamily: "inherit" }}
                />
              </div>

              {/* Attachment Dropzone */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "10px 14px", background: "#f8fafc", display: "flex", alignItems: "center", gap: 12 }}>
                <Upload size={18} style={{ color: "#00b06b" }} />
                <div>
                  <div style={{ fontSize: 12, color: "#374151" }}>
                    <span style={{ color: "#0284c7", cursor: "pointer", fontWeight: 600 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8" }}>Đính kèm: Dung lượng tối đa 5MB</div>
                </div>
              </div>
            </div>

            {/* Right Summary Totals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 12px", background: "#f8fafc", borderRadius: 6, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Tổng tiền hàng</span>
                <strong>{formatVND(totalSubtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Tiền chiết khấu</span>
                <span>{formatVND(discountAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Thuế GTGT</span>
                <span>{formatVND(totalVAT)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#0f172a", fontWeight: 800, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#059669" }}>{formatVND(totalGrand)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Image 2) */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            <span>F3 - Tìm nhanh, F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
            >
              Cất
            </button>
            <button
              type="button"
              className="misa-invoice-btn-submit"
              onClick={() => handleSave(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Cất và In</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODAL: HỢP ĐỒNG MUA (MATCHING IMAGE 3)
// ============================================================================
export interface PurchaseContractModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseContractModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseContractModalProps) {
  // Master fields
  const [contractCode, setContractCode] = useState("HĐM00001");
  const [signDate, setSignDate] = useState("29/09/2026");
  const [supplierCode, setSupplierCode] = useState("NCC001");
  const [supplierName, setSupplierName] = useState("Công ty TNHH Thiết bị Công nghiệp Tân Phát");
  const [address, setAddress] = useState("Số 18 Hoàng Cầu, Đống Đa, Hà Nội");
  const [contractValue, setContractValue] = useState(38750000);
  const [contractStatus, setContractStatus] = useState("Chưa thực hiện");
  const [deliveryStatus, setDeliveryStatus] = useState("Chưa giao");
  const [taxCode, setTaxCode] = useState("0102345678");
  const [contactPerson, setContactPerson] = useState("Nguyễn Văn Hùng");
  const [deliveryDeadline, setDeliveryDeadline] = useState("15/10/2026");
  const [paymentDeadline, setPaymentDeadline] = useState("30/10/2026");

  // Expanded sections
  const [showExtendedInfo, setShowExtendedInfo] = useState(false);
  const [showPaymentTerms, setShowPaymentTerms] = useState(false);

  // Table items
  const [items, setItems] = useState([
    {
      id: "hdm-1",
      code: "VT001",
      name: "Thép cuộn mạ kẽm Ø6",
      unit: "Kg",
      reqQty: 1000,
      deliveredQty: 0,
      unitPrice: 21500,
      amount: 21500000,
      discountRate: 0,
      discountAmount: 0,
      vatRate: 10,
      vatAmount: 2150000,
      stock: 4500,
    },
    {
      id: "hdm-2",
      code: "VT002",
      name: "Ống thép đúc phi 90 dày 3.5mm",
      unit: "Cây",
      reqQty: 50,
      deliveredQty: 0,
      unitPrice: 345000,
      amount: 17250000,
      discountRate: 0,
      discountAmount: 0,
      vatRate: 10,
      vatAmount: 1725000,
      stock: 120,
    },
  ]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const row: any = { ...updated[index], [field]: value };

    if (field === "reqQty" || field === "unitPrice") {
      row.amount = (Number(row.reqQty) || 0) * (Number(row.unitPrice) || 0);
      row.discountAmount = Math.round((row.amount * (Number(row.discountRate) || 0)) / 100);
      row.vatAmount = Math.round(((row.amount - row.discountAmount) * (Number(row.vatRate) || 0)) / 100);
    }
    if (field === "discountRate") {
      row.discountAmount = Math.round((row.amount * (Number(value) || 0)) / 100);
      row.vatAmount = Math.round(((row.amount - row.discountAmount) * (Number(row.vatRate) || 0)) / 100);
    }

    updated[index] = row;
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `hdm-${Date.now()}`,
        code: "",
        name: "",
        unit: "Cái",
        reqQty: 1,
        deliveredQty: 0,
        unitPrice: 0,
        amount: 0,
        discountRate: 0,
        discountAmount: 0,
        vatRate: 10,
        vatAmount: 0,
        stock: 0,
      },
    ]);
  };

  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalDiscount = items.reduce((s, it) => s + (Number(it.discountAmount) || 0), 0);
  const totalVAT = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const grandTotal = totalAmount - totalDiscount + totalVAT;

  const handleSave = (andClose = true) => {
    onSubmit({
      kind: "purchase_contract",
      contractCode,
      signDate,
      supplierCode,
      supplierName,
      contractValue: contractValue || grandTotal,
      contractStatus,
      deliveryStatus,
      taxCode,
      contactPerson,
      deliveryDeadline,
      paymentDeadline,
      items,
      grandTotal,
    });
    if (andClose) onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Header (Image 3) */}
        <header className="misa-purchase-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileCheck size={18} style={{ color: "#64748b" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
                Hợp đồng mua {contractCode}
              </h2>
            </div>

            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Nhập số đơn mua hàng"
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 170, background: "transparent" }}
              />
              <Search size={14} style={{ color: "#64748b" }} />
              <ChevronDown size={14} style={{ color: "#64748b" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Minus size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {/* Master Form Area (Image 3) */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Left 2 columns */}
            <div>
              {/* Row 1: Số hợp đồng, Ngày ký, Mã NCC, Tên NCC */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 130px 180px 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Số hợp đồng</label>
                  <input
                    type="text"
                    value={contractCode}
                    onChange={(e) => setContractCode(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #00b06b", fontSize: 12.5, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="misa-purchase-label">Ngày ký</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={signDate}
                      onChange={(e) => setSignDate(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                    />
                    <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
                <div>
                  <label className="misa-purchase-label">Mã nhà cung cấp</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="text"
                      value={supplierCode}
                      onChange={(e) => setSupplierCode(e.target.value)}
                      style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                    <button type="button" onClick={onOpenSupplierModal} style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}>
                      <Plus size={14} />
                    </button>
                    <button type="button" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}>
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="misa-purchase-label">Tên nhà cung cấp</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Row 2: Giá trị hợp đồng & Địa chỉ */}
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Giá trị hợp đồng</label>
                  <input
                    type="number"
                    value={contractValue}
                    onChange={(e) => setContractValue(Number(e.target.value) || 0)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5, textAlign: "right" }}
                  />
                </div>
                <div>
                  <label className="misa-purchase-label">Địa chỉ</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Row 3: Tình trạng HĐ, Tình trạng GH, MST, Người liên hệ */}
              <div style={{ display: "grid", gridTemplateColumns: "160px 160px 160px 1fr", gap: 10, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Tình trạng hợp đồng</label>
                  <select
                    value={contractStatus}
                    onChange={(e) => setContractStatus(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  >
                    <option value="Chưa thực hiện">Chưa thực hiện</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Đã hoàn thành">Đã hoàn thành</option>
                  </select>
                </div>
                <div>
                  <label className="misa-purchase-label">Tình trạng giao hàng</label>
                  <select
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  >
                    <option value="Chưa giao">Chưa giao</option>
                    <option value="Đang giao">Đang giao</option>
                    <option value="Đã giao đủ">Đã giao đủ</option>
                  </select>
                </div>
                <div>
                  <label className="misa-purchase-label">Mã số thuế</label>
                  <input
                    type="text"
                    value={taxCode}
                    onChange={(e) => setTaxCode(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  />
                </div>
                <div>
                  <label className="misa-purchase-label">Người liên hệ</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  />
                </div>
              </div>

              {/* Row 4: Tham chiếu, Hạn giao hàng, Hạn thanh toán */}
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}>
                  Tham chiếu ...
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="misa-purchase-label" style={{ marginBottom: 0 }}>Hạn giao hàng</label>
                  <div style={{ position: "relative", width: 130 }}>
                    <input
                      type="text"
                      value={deliveryDeadline}
                      onChange={(e) => setDeliveryDeadline(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 24px 0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12 }}
                    />
                    <Calendar size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label className="misa-purchase-label" style={{ marginBottom: 0 }}>Hạn thanh toán</label>
                  <div style={{ position: "relative", width: 130 }}>
                    <input
                      type="text"
                      value={paymentDeadline}
                      onChange={(e) => setPaymentDeadline(e.target.value)}
                      style={{ width: "100%", height: 26, padding: "0 24px 0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12 }}
                    />
                    <Calendar size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
              </div>

              {/* Collapsibles: Thông tin mở rộng & Điều khoản thanh toán */}
              <div style={{ marginTop: 8, display: "flex", gap: 16 }}>
                <button
                  type="button"
                  onClick={() => setShowExtendedInfo(!showExtendedInfo)}
                  style={{ background: "transparent", border: "none", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <ChevronDown size={14} style={{ transform: showExtendedInfo ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                  <span>Thông tin mở rộng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentTerms(!showPaymentTerms)}
                  style={{ background: "transparent", border: "none", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <ChevronDown size={14} style={{ transform: showPaymentTerms ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} />
                  <span>Điều khoản thanh toán</span>
                </button>
              </div>
            </div>

            {/* Right block: Giá trị hợp đồng lớn */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18, textAlign: "right" }}>
              <span style={{ fontSize: 12, color: "#64748b", display: "block" }}>Giá trị hợp đồng</span>
              <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>
                {formatVND(contractValue || grandTotal)}
              </strong>
            </div>
          </div>
        </div>

        {/* Table Area (Image 3) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          <div style={{ padding: "8px 18px", borderBottom: "1px solid #e2e8f0" }}>
            <strong style={{ fontSize: 13, color: "#1e293b" }}>Danh sách hàng hóa dịch vụ</strong>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 105 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Pin size={11} /><span>Mã hàng</span></div></th>
                  <th>Tên hàng</th>
                  <th style={{ width: 75 }}>ĐVT</th>
                  <th style={{ width: 90, textAlign: "right" }}>Số lượng yêu cầu</th>
                  <th style={{ width: 95, textAlign: "right" }}>Số lượng đã giao</th>
                  <th style={{ width: 105, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                  <th style={{ width: 85, textAlign: "right" }}>Tỷ lệ CK (%)</th>
                  <th style={{ width: 100, textAlign: "right" }}>Tiền chiết khấu</th>
                  <th style={{ width: 85, textAlign: "right" }}>% Thuế GTGT</th>
                  <th style={{ width: 105, textAlign: "right" }}>Tiền thuế GTGT</th>
                  <th style={{ width: 75, textAlign: "right" }}>Tồn</th>
                  <th style={{ width: 36, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td><input type="text" value={row.code} onChange={(e) => handleItemChange(idx, "code", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.name} onChange={(e) => handleItemChange(idx, "name", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="number" value={row.reqQty} onChange={(e) => handleItemChange(idx, "reqQty", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td><input type="number" value={row.deliveredQty} onChange={(e) => handleItemChange(idx, "deliveredQty", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                    <td><input type="number" value={row.discountRate} onChange={(e) => handleItemChange(idx, "discountRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right" }}>{formatVND(row.discountAmount)}</td>
                    <td><input type="number" value={row.vatRate} onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right" }}>{formatVND(row.vatAmount)}</td>
                    <td style={{ textAlign: "right", color: "#64748b" }}>{row.stock}</td>
                    <td style={{ textAlign: "center" }}>
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Plus size={13} /> Thêm dòng
              </button>
              <button type="button" onClick={() => setItems([])} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}>
                <Trash2 size={13} /> Xóa hết dòng
              </button>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <FileText size={13} /> Thêm ghi chú
              </button>
            </div>

            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "4px 10px", background: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                <Upload size={14} style={{ color: "#00b06b" }} />
                <span style={{ fontSize: 11.5, color: "#475569" }}><span style={{ color: "#0284c7", fontWeight: 600 }}>Chọn tệp</span> đính kèm</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
                Tổng thanh toán: {formatVND(grandTotal)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Image 3) */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px", gap: 8 }}>
          <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>Hủy</button>
          <button type="button" className="misa-invoice-btn-cancel" onClick={() => handleSave(false)}>Cất</button>
          <button type="button" className="misa-invoice-btn-submit" onClick={() => handleSave(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>Cất và Đóng</span>
            <ChevronDown size={14} />
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MODAL: CHỨNG TỪ MUA HÀNG (MATCHING IMAGE 4)
// ============================================================================
export interface PurchaseVoucherModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export const PURCHASE_VOUCHER_TEMPLATES = [
  "Mua hàng trong nước nhập kho",
  "Mua hàng trong nước không qua kho",
  "Mua hàng nhập khẩu nhập kho",
  "Mua hàng nhập khẩu không qua kho",
] as const;

export type PurchaseVoucherTemplate = (typeof PURCHASE_VOUCHER_TEMPLATES)[number];

export function PurchaseVoucherModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseVoucherModalProps) {
  // 4 Templates dropdown state
  const [purchaseType, setPurchaseType] = useState<PurchaseVoucherTemplate>(
    "Mua hàng trong nước nhập kho"
  );
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Mode helpers
  const isWarehouse =
    purchaseType === "Mua hàng trong nước nhập kho" ||
    purchaseType === "Mua hàng nhập khẩu nhập kho";
  const isImport =
    purchaseType === "Mua hàng nhập khẩu nhập kho" ||
    purchaseType === "Mua hàng nhập khẩu không qua kho";

  // Option bar states
  const [paymentOption, setPaymentOption] = useState<"unpaid" | "paid">("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("Tiền mặt");
  const [withInvoice, setWithInvoice] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"receipt" | "payment" | "invoice">("receipt");
  const [activeGridTab, setActiveGridTab] = useState<string>("goods");
  const [showAccounts, setShowAccounts] = useState(true);

  // Master fields - General & Phiếu nhập
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [deliverer, setDeliverer] = useState("");
  const [address, setAddress] = useState("");
  const [employee, setEmployee] = useState("Nguyễn Văn A - Phòng Mua hàng");
  const [description, setDescription] = useState("Mua hàng");
  const [attachedCount, setAttachedCount] = useState<string | number>("");
  const [debtDays, setDebtDays] = useState<string | number>("");
  const [paymentDueDate, setPaymentDueDate] = useState("");

  // Fields for Phiếu chi tab
  const [recipient, setRecipient] = useState("");
  const [paymentReason, setPaymentReason] = useState("Chi tiền mua hàng");
  const [paymentVoucherCode, setPaymentVoucherCode] = useState("PC00001");
  const [paymentPostingDate, setPaymentPostingDate] = useState("02/10/2026");
  const [paymentDocDate, setPaymentDocDate] = useState("02/10/2026");

  // Fields for Hóa đơn tab
  const [taxCode, setTaxCode] = useState("");
  const [invoiceForm, setInvoiceForm] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("02/10/2026");

  // Right dates & voucher number (NK00001 for warehouse, MH00001 for non-warehouse)
  const [postingDate, setPostingDate] = useState("02/10/2026 09:08:40");
  const [docDate, setDocDate] = useState("02/10/2026");
  const [voucherCode, setVoucherCode] = useState("NK00001");

  const [einvoiceLookupCode, setEinvoiceLookupCode] = useState("");
  const [einvoiceLookupUrl, setEinvoiceLookupUrl] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showDebtLookup, setShowDebtLookup] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  const handleSelectSupplier = (s: (typeof SAMPLE_SUPPLIERS)[0]) => {
    setSupplierCode(s.code);
    setSupplierName(s.name);
    setAddress(s.address);
    setDeliverer(s.contact);
    setRecipient(s.contact);
    setTaxCode(s.taxCode);
    setDebtDays(s.debtDays || 30);
    setShowSupplierDropdown(false);
  };

  const handlePaymentOptionChange = (opt: "unpaid" | "paid") => {
    setPaymentOption(opt);
    if (opt === "unpaid") {
      if (activeSubTab === "payment") {
        setActiveSubTab("receipt");
      }
    } else {
      if (!isWarehouse && activeSubTab === "receipt") {
        setActiveSubTab("payment");
      }
      setItems((prev) =>
        prev.map((row) => ({
          ...row,
          cashAccount: paymentMethod === "Ủy nhiệm chi" ? "1121" : "111",
        }))
      );
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    if (method === "Ủy nhiệm chi") {
      setPaymentVoucherCode("UNC00001");
      setItems((prev) => prev.map((row) => ({ ...row, cashAccount: "1121" })));
    } else {
      setPaymentVoucherCode("PC00001");
      setItems((prev) => prev.map((row) => ({ ...row, cashAccount: "111" })));
    }
  };

  // Items for Hàng tiền
  const [items, setItems] = useState([
    {
      id: "pv-1",
      code: "",
      name: "",
      specification: "",
      stock: "",
      stockAccount: "",
      expenseAccount: "",
      debtAccount: "331",
      cashAccount: "111",
      unit: "",
      quantity: 1.0,
      unitPrice: 0.0,
      amount: 0,
      fobPrice: 0,
      customsFee: 0,
      purchaseCost: 0,
      inwardFee: 0,
      vatRate: 0,
      vatAmount: 0,
      vatAccount: "1331",
      taxGroup: "1",
      // Import taxes
      importTaxRate: 5,
      importTaxAmount: 0,
      importTaxAccount: "3333",
      exciseTaxRate: 0,
      exciseTaxAmount: 0,
      exciseTaxAccount: "3332",
    },
  ]);

  // Phí trước hải quan sample items
  const [customsFees] = useState([
    {
      id: "cf-1",
      postingDate: "30/09/2026",
      docDate: "30/09/2026",
      docNo: "HQ001",
      desc: "Lệ phí hải quan mở tờ khai nhập khẩu",
      amount: 200000,
      expenseAccount: "1562",
    },
  ]);

  // Phí hàng về kho / Chi phí mua hàng sample items
  const [inwardFees] = useState([
    {
      id: "inf-1",
      docDate: "30/09/2026",
      docNo: "VC001",
      supplier: "Công ty Vận tải Hải An",
      desc: "Chi phí vận chuyển bốc dỡ hàng về kho",
      amount: 1500000,
      expenseAccount: "1562",
      allocationType: "Theo số lượng",
    },
  ]);

  // Handle template switch
  const handleSelectTemplate = (tpl: PurchaseVoucherTemplate) => {
    setPurchaseType(tpl);
    setShowTypeDropdown(false);
    setActiveGridTab("goods");
    if (tpl === "Mua hàng trong nước không qua kho" || tpl === "Mua hàng nhập khẩu không qua kho") {
      setVoucherCode("MH00001");
      setPostingDate("02/10/2026");
      if (paymentOption === "paid") {
        setActiveSubTab("payment");
      } else {
        setActiveSubTab("receipt");
      }
    } else {
      setVoucherCode("NK00001");
      setPostingDate("02/10/2026 09:08:40");
      if (activeSubTab === "payment" && paymentOption === "unpaid") {
        setActiveSubTab("receipt");
      }
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const row: any = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      row.amount = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
      row.vatAmount = Math.round((row.amount * (Number(row.vatRate) || 0)) / 100);
      row.importTaxAmount = Math.round((row.amount * (Number(row.importTaxRate) || 0)) / 100);
      row.exciseTaxAmount = Math.round(
        ((row.amount + row.importTaxAmount) * (Number(row.exciseTaxRate) || 0)) / 100
      );
    }
    if (field === "vatRate") {
      row.vatAmount = Math.round((row.amount * (Number(value) || 0)) / 100);
    }
    if (field === "importTaxRate") {
      row.importTaxAmount = Math.round((row.amount * (Number(value) || 0)) / 100);
    }
    if (field === "exciseTaxRate") {
      row.exciseTaxAmount = Math.round(
        ((row.amount + (row.importTaxAmount || 0)) * (Number(value) || 0)) / 100
      );
    }
    updated[index] = row;
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `pv-${Date.now()}`,
        code: "",
        name: "",
        specification: "",
        stock: "1561",
        stockAccount: "1561",
        expenseAccount: "",
        debtAccount: "331",
        cashAccount: paymentMethod === "Ủy nhiệm chi" ? "1121" : "111",
        unit: "Cái",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        fobPrice: 0,
        customsFee: 0,
        purchaseCost: 0,
        inwardFee: 0,
        vatRate: 0,
        vatAmount: 0,
        vatAccount: "1331",
        taxGroup: "1",
        importTaxRate: 5,
        importTaxAmount: 0,
        importTaxAccount: "3333",
        exciseTaxRate: 0,
        exciseTaxAmount: 0,
        exciseTaxAccount: "3332",
      },
    ]);
  };

  // Calculations
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const vatTotal = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const importTaxTotal = items.reduce((s, it) => s + (Number(it.importTaxAmount) || 0), 0);
  const exciseTaxTotal = items.reduce((s, it) => s + (Number(it.exciseTaxAmount) || 0), 0);
  const purchaseCost = 0;
  const grandTotal = subtotal + vatTotal + (isImport ? importTaxTotal + exciseTaxTotal : 0);
  const inventoryValue = subtotal + purchaseCost;

  const handleSave = (andClose = true) => {
    onSubmit({
      kind: "purchase_voucher",
      voucherCode,
      purchaseType,
      paymentOption,
      paymentMethod,
      withInvoice,
      supplierCode,
      supplierName,
      deliverer,
      address,
      description,
      postingDate,
      docDate,
      items,
      subtotal,
      vatTotal,
      importTaxTotal,
      exciseTaxTotal,
      grandTotal,
      inventoryValue,
      einvoiceLookupCode,
      einvoiceLookupUrl,
    });
    if (andClose) onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Header with Title & Template Selector matching User Screenshot 1 */}
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
              Chứng từ mua hàng {!isWarehouse && paymentOption === "paid" ? paymentVoucherCode : voucherCode}
            </h2>

            {/* Custom Template Dropdown Selector (Matching Image 1) */}
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1.5px solid #00b06b",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  minWidth: 240,
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.15)",
                }}
              >
                <span>{purchaseType}</span>
                <ChevronDown size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
              </div>

              {/* Dropdown Menu (Exact match Image 1) */}
              {showTypeDropdown && (
                <>
                  <div
                    onClick={() => setShowTypeDropdown(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 110 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#ffffff",
                      border: "1px solid #00b06b",
                      borderRadius: 4,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      zIndex: 120,
                      width: 290,
                      overflow: "hidden",
                    }}
                  >
                    {PURCHASE_VOUCHER_TEMPLATES.map((tpl) => {
                      const isSelected = purchaseType === tpl;
                      return (
                        <div
                          key={tpl}
                          onClick={() => handleSelectTemplate(tpl)}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#ffffff" : "#1e293b",
                            background: isSelected ? "#00b06b" : "#ffffff",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00b06b";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#ffffff";
                              e.currentTarget.style.color = "#1e293b";
                            }
                          }}
                        >
                          {tpl}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Settings & Search box: Nhập số hợp đồng mua hàng */}
            <button
              type="button"
              className="misa-invoice-circle-btn"
              style={{ marginLeft: 2 }}
              title="Thiết lập mẫu"
            >
              <Settings size={14} />
            </button>
            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Nhập số hợp đồng mua hàng"
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 175, background: "transparent" }}
              />
              <Search size={14} style={{ color: "#64748b" }} />
              <ChevronDown size={14} style={{ color: "#64748b" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {/* Radio Option Bar (Chưa thanh toán / Thanh toán ngay + Nhận kèm HĐ) */}
        <div
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="purchasePayment"
                  checked={paymentOption === "unpaid"}
                  onChange={() => handlePaymentOptionChange("unpaid")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Chưa thanh toán</span>
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="purchasePayment"
                  checked={paymentOption === "paid"}
                  onChange={() => handlePaymentOptionChange("paid")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Thanh toán ngay</span>
              </label>

              <select
                value={paymentMethod}
                disabled={paymentOption === "unpaid"}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                style={{
                  height: 26,
                  padding: "0 8px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  background: paymentOption === "unpaid" ? "#f8fafc" : "#ffffff",
                  color: paymentOption === "unpaid" ? "#94a3b8" : "#0f172a",
                }}
              >
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Ủy nhiệm chi">Ủy nhiệm chi</option>
                <option value="Séc chuyển khoản">Séc chuyển khoản</option>
                <option value="Séc tiền mặt">Séc tiền mặt</option>
              </select>
            </div>

            {/* Checkbox / Dropdown: Nhận kèm hóa đơn (Only for domestic purchase) */}
            {!isImport && (
              <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 16 }}>
                <select
                  value={withInvoice ? "kèm" : "không"}
                  onChange={(e) => setWithInvoice(e.target.value === "kèm")}
                  style={{
                    height: 26,
                    padding: "0 8px",
                    borderRadius: 3,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#1e293b",
                    background: "#ffffff",
                  }}
                >
                  <option value="kèm">Nhận kèm hóa đơn</option>
                  <option value="không">Không kèm hóa đơn</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Sub-tabs bar: Phiếu nhập | (Phiếu chi) | (Hóa đơn) */}
        <div
          style={{
            display: "flex",
            gap: 20,
            padding: "0 18px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {(isWarehouse || paymentOption === "unpaid") && (
            <button
              type="button"
              onClick={() => setActiveSubTab("receipt")}
              style={{
                padding: "7px 4px",
                background: "transparent",
                border: "none",
                borderBottom: activeSubTab === "receipt" ? "2px solid #00b06b" : "2px solid transparent",
                color: activeSubTab === "receipt" ? "#00b06b" : "#475569",
                fontSize: 12.5,
                fontWeight: activeSubTab === "receipt" ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {isWarehouse ? "Phiếu nhập" : "Chứng từ ghi nợ"}
            </button>
          )}

          {paymentOption === "paid" && (
            <button
              type="button"
              onClick={() => setActiveSubTab("payment")}
              style={{
                padding: "7px 4px",
                background: "transparent",
                border: "none",
                borderBottom: activeSubTab === "payment" ? "2px solid #00b06b" : "2px solid transparent",
                color: activeSubTab === "payment" ? "#00b06b" : "#475569",
                fontSize: 12.5,
                fontWeight: activeSubTab === "payment" ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {paymentMethod === "Ủy nhiệm chi" ? "Ủy nhiệm chi" : "Phiếu chi"}
            </button>
          )}

          {(withInvoice || isImport) && (
            <button
              type="button"
              onClick={() => setActiveSubTab("invoice")}
              style={{
                padding: "7px 4px",
                background: "transparent",
                border: "none",
                borderBottom: activeSubTab === "invoice" ? "2px solid #00b06b" : "2px solid transparent",
                color: activeSubTab === "invoice" ? "#00b06b" : "#475569",
                fontSize: 12.5,
                fontWeight: activeSubTab === "invoice" ? 700 : 500,
                cursor: "pointer",
              }}
            >
              Hóa đơn
            </button>
          )}
        </div>

        {/* Master Form Area */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Left form fields */}
            <div>
              {/* TAB 1: PHIẾU NHẬP */}
              {activeSubTab === "receipt" && (
                <>
                  {/* Row 1: Mã NCC & Tên NCC */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div style={{ position: "relative" }}>
                      <label className="misa-purchase-label">Mã nhà cung cấp</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                        <button
                          type="button"
                          onClick={onOpenSupplierModal}
                          title="Thêm nhà cung cấp"
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} style={{ strokeWidth: 2.5 }} />
                        </button>
                        <button
                          type="button"
                          title="Chọn nhà cung cấp từ danh mục"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          title="Tra cứu công nợ nhà cung cấp"
                          onClick={() => setShowDebtLookup(true)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <DollarSign size={13} />
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 100,
                            width: 380,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                            border: "1px solid #cbd5e1",
                            padding: "4px 0",
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {SAMPLE_SUPPLIERS.map((s) => (
                            <div
                              key={s.code}
                              onClick={() => handleSelectSupplier(s)}
                              style={{
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontSize: 12.5,
                                borderBottom: "1px solid #f1f5f9",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <strong style={{ color: "#00b06b" }}>{s.code}</strong> - {s.name}
                              <div style={{ fontSize: 11, color: "#64748b" }}>{s.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="misa-purchase-label">Tên nhà cung cấp</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Người giao hàng & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: isWarehouse ? "260px 1fr" : "1fr", gap: 12, marginBottom: 8 }}>
                    {isWarehouse && (
                      <div>
                        <label className="misa-purchase-label">Người giao hàng</label>
                        <input
                          type="text"
                          value={deliverer}
                          onChange={(e) => setDeliverer(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                      </div>
                    )}
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Nhân viên mua hàng & Diễn giải */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={employee}
                          onChange={(e) => setEmployee(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, background: "#ffffff", boxSizing: "border-box" }}
                        >
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          title="Thêm nhân viên"
                          onClick={() => {
                            const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                            if (newEmp) setEmployee(newEmp);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="misa-purchase-label">Diễn giải</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                        <div
                          title="AVA AI Gợi ý diễn giải tự động"
                          onClick={() => setDescription(supplierName ? `Mua hàng của ${supplierName}` : "Mua hàng")}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                        >
                          <Sparkles size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Kèm theo (unpaid) & Tham chiếu */}
                  {paymentOption === "unpaid" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
                      {isWarehouse && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                          <input
                            type="text"
                            placeholder="Số lượng"
                            value={attachedCount}
                            onChange={(e) => setAttachedCount(e.target.value)}
                            style={{ width: 68, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                          />
                          <span style={{ fontSize: 12, color: "#374151" }}>Chứng từ gốc</span>
                        </div>
                      )}
                      <span
                        onClick={() => setShowRefModal(true)}
                        style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                      >
                        Tham chiếu {purchaseType === "Mua hàng nhập khẩu nhập kho" ? "..." : "--"}
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
                      <span
                        onClick={() => setShowRefModal(true)}
                        style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                      >
                        Tham chiếu {purchaseType === "Mua hàng nhập khẩu nhập kho" ? "..." : "--"}
                      </span>
                    </div>
                  )}

                  {/* Row 5: Điều khoản thanh toán (ONLY if unpaid) */}
                  {paymentOption === "unpaid" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>▾ Điều khoản thanh toán</span>
                        <button
                          type="button"
                          title="Thêm điều khoản thanh toán"
                          onClick={() => {
                            const d = prompt("Nhập số ngày được nợ mới:", String(debtDays));
                            if (d) setDebtDays(d);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Số ngày được nợ</span>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
                          style={{ width: 55, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Hạn thanh toán</span>
                        <div style={{ position: "relative", width: 130 }}>
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={paymentDueDate}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                            style={{ width: "100%", height: 28, padding: "0 24px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                          />
                          <Calendar size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: PHIẾU CHI (Only if paid) */}
              {activeSubTab === "payment" && (
                <>
                  {/* Row 1: Mã NCC & Tên NCC */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div style={{ position: "relative" }}>
                      <label className="misa-purchase-label">Mã nhà cung cấp</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                        <button
                          type="button"
                          onClick={onOpenSupplierModal}
                          title="Thêm nhà cung cấp"
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} style={{ strokeWidth: 2.5 }} />
                        </button>
                        <button
                          type="button"
                          title="Chọn nhà cung cấp từ danh mục"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          title="Tra cứu công nợ nhà cung cấp"
                          onClick={() => setShowDebtLookup(true)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <DollarSign size={13} />
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 100,
                            width: 380,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                            border: "1px solid #cbd5e1",
                            padding: "4px 0",
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {SAMPLE_SUPPLIERS.map((s) => (
                            <div
                              key={s.code}
                              onClick={() => handleSelectSupplier(s)}
                              style={{
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontSize: 12.5,
                                borderBottom: "1px solid #f1f5f9",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <strong style={{ color: "#00b06b" }}>{s.code}</strong> - {s.name}
                              <div style={{ fontSize: 11, color: "#64748b" }}>{s.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="misa-purchase-label">Tên nhà cung cấp</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Người nhận & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Người nhận</label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 3 & 4: Lý do chi, Nhân viên mua hàng, Kèm theo chứng từ gốc */}
                  {isWarehouse ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 12, marginBottom: 8, alignItems: "center" }}>
                      <div>
                        <label className="misa-purchase-label">Lý do chi</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={paymentReason}
                            onChange={(e) => setPaymentReason(e.target.value)}
                            style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                          />
                          <div
                            title="AVA AI Gợi ý lý do chi"
                            onClick={() => setPaymentReason(supplierName ? `Chi tiền mua hàng của ${supplierName}` : "Chi tiền mua hàng")}
                            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                          >
                            <Sparkles size={14} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
                        <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                        <input
                          type="text"
                          placeholder="Số lượng"
                          value={attachedCount}
                          onChange={(e) => setAttachedCount(e.target.value)}
                          style={{ width: 68, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                        <span style={{ fontSize: 12, color: "#374151" }}>Chứng từ gốc</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <label className="misa-purchase-label">Lý do chi</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={paymentReason}
                            onChange={(e) => setPaymentReason(e.target.value)}
                            style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                          />
                          <div
                            title="AVA AI Gợi ý lý do chi"
                            onClick={() => setPaymentReason(supplierName ? `Chi tiền mua hàng của ${supplierName}` : "Chi tiền mua hàng")}
                            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                          >
                            <Sparkles size={14} />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8, alignItems: "center" }}>
                        <div>
                          <label className="misa-purchase-label">Nhân viên mua hàng</label>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <select
                              value={employee}
                              onChange={(e) => setEmployee(e.target.value)}
                              style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, background: "#ffffff", boxSizing: "border-box" }}
                            >
                              <option value=""></option>
                              <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                              <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                            </select>
                            <button
                              type="button"
                              title="Thêm nhân viên"
                              onClick={() => {
                                const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                                if (newEmp) setEmployee(newEmp);
                              }}
                              style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 18 }}>
                          <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                          <input
                            type="text"
                            placeholder="Số lượng"
                            value={attachedCount}
                            onChange={(e) => setAttachedCount(e.target.value)}
                            style={{ width: 68, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                          />
                          <span style={{ fontSize: 12, color: "#374151" }}>Chứng từ gốc</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </>
              )}

              {/* TAB 3: HÓA ĐƠN */}
              {activeSubTab === "invoice" && (
                <>
                  {/* Row 1: Mã NCC & Tên NCC */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div style={{ position: "relative" }}>
                      <label className="misa-purchase-label">Mã nhà cung cấp</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                        <button
                          type="button"
                          onClick={onOpenSupplierModal}
                          title="Thêm nhà cung cấp"
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} style={{ strokeWidth: 2.5 }} />
                        </button>
                        <button
                          type="button"
                          title="Chọn nhà cung cấp từ danh mục"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          title="Tra cứu công nợ nhà cung cấp"
                          onClick={() => setShowDebtLookup(true)}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#64748b", boxSizing: "border-box" }}
                        >
                          <DollarSign size={13} />
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            zIndex: 100,
                            width: 380,
                            background: "#ffffff",
                            borderRadius: 6,
                            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                            border: "1px solid #cbd5e1",
                            padding: "4px 0",
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {SAMPLE_SUPPLIERS.map((s) => (
                            <div
                              key={s.code}
                              onClick={() => handleSelectSupplier(s)}
                              style={{
                                padding: "8px 12px",
                                cursor: "pointer",
                                fontSize: 12.5,
                                borderBottom: "1px solid #f1f5f9",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <strong style={{ color: "#00b06b" }}>{s.code}</strong> - {s.name}
                              <div style={{ fontSize: 11, color: "#64748b" }}>{s.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="misa-purchase-label">Tên nhà cung cấp</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Mã số thuế & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Mã số thuế</label>
                      <input
                        type="text"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: paymentOption === "unpaid" ? 8 : 0 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu {isImport ? "--" : (paymentOption === "unpaid" ? "--" : "...")}
                    </span>
                  </div>

                  {/* Row 4: Điều khoản thanh toán (ONLY if unpaid) */}
                  {paymentOption === "unpaid" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>▾ Điều khoản thanh toán</span>
                        <button
                          type="button"
                          title="Thêm điều khoản thanh toán"
                          onClick={() => {
                            const d = prompt("Nhập số ngày được nợ mới:", String(debtDays));
                            if (d) setDebtDays(d);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Số ngày được nợ</span>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
                          style={{ width: 55, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Hạn thanh toán</span>
                        <div style={{ position: "relative", width: 130 }}>
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={paymentDueDate}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                            style={{ width: "100%", height: 28, padding: "0 24px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                          />
                          <Calendar size={13} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right side: Tổng tiền thanh toán & Right inputs */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18 }}>
              <div style={{ textAlign: "right", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>{formatVND(grandTotal)}</strong>
              </div>

              {/* Case 1: Tab Phiếu nhập */}
              {activeSubTab === "receipt" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={postingDate}
                        onChange={(e) => setPostingDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">{isWarehouse ? "Số phiếu nhập" : "Số chứng từ"}</label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Case 2: Tab Phiếu chi */}
              {activeSubTab === "payment" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentPostingDate}
                        onChange={(e) => setPaymentPostingDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentDocDate}
                        onChange={(e) => setPaymentDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số chứng từ</label>
                    <input
                      type="text"
                      value={paymentVoucherCode}
                      onChange={(e) => setPaymentVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Case 3: Tab Hóa đơn */}
              {activeSubTab === "invoice" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Mẫu số hóa đơn</label>
                    <select
                      value={invoiceForm}
                      onChange={(e) => setInvoiceForm(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, background: "#ffffff", boxSizing: "border-box" }}
                    >
                      <option value="">Chọn mẫu số</option>
                      <option value="1/001">1/001</option>
                      <option value="01GTKT0/001">01GTKT0/001</option>
                      <option value="02GTTT0/001">02GTTT0/001</option>
                    </select>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ký hiệu hóa đơn</label>
                    <input
                      type="text"
                      value={invoiceSeries}
                      onChange={(e) => setInvoiceSeries(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số hóa đơn</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày hóa đơn</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table & Tabs Section */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          {/* Detail Tabs bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", gap: 16 }}>
              {/* Tab: Hàng tiền */}
              <button
                type="button"
                onClick={() => setActiveGridTab("goods")}
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: activeGridTab === "goods" ? "2px solid #00b06b" : "none",
                  color: activeGridTab === "goods" ? "#00b06b" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hàng tiền
              </button>

              {/* Tab: Thuế (Only for Import Templates 3 & 4) */}
              {isImport && (
                <button
                  type="button"
                  onClick={() => setActiveGridTab("tax")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeGridTab === "tax" ? "2px solid #00b06b" : "none",
                    color: activeGridTab === "tax" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Thuế
                </button>
              )}

              {/* Tab: Phí trước hải quan (Only for Import Templates 3 & 4) */}
              {isImport && (
                <button
                  type="button"
                  onClick={() => setActiveGridTab("customs_fee")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeGridTab === "customs_fee" ? "2px solid #00b06b" : "none",
                    color: activeGridTab === "customs_fee" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Phí trước hải quan
                </button>
              )}

              {/* Tab: Phí hàng về kho (Template 3) OR Chi phí mua hàng (Template 4) OR Chi phí (Template 1 & 2) */}
              {purchaseType === "Mua hàng nhập khẩu nhập kho" && (
                <button
                  type="button"
                  onClick={() => setActiveGridTab("inward_fee")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeGridTab === "inward_fee" ? "2px solid #00b06b" : "none",
                    color: activeGridTab === "inward_fee" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Phí hàng về kho
                </button>
              )}

              {purchaseType === "Mua hàng nhập khẩu không qua kho" && (
                <button
                  type="button"
                  onClick={() => setActiveGridTab("costs")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeGridTab === "costs" ? "2px solid #00b06b" : "none",
                    color: activeGridTab === "costs" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Chi phí mua hàng
                </button>
              )}

              {!isImport && (
                <button
                  type="button"
                  onClick={() => setActiveGridTab("costs")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeGridTab === "costs" ? "2px solid #00b06b" : "none",
                    color: activeGridTab === "costs" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Chi phí
                </button>
              )}
            </div>

            {/* Right Tools: AVA Kế toán & Chiết khấu */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
                  color: "#6d28d9",
                  border: "1px solid #ddd6fe",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={13} />
                <span>AVA Kế toán</span>
                <ChevronDown size={12} />
              </button>

              <span style={{ fontSize: 12, color: "#475569" }}>Chiết khấu</span>
              <select style={{ height: 26, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12 }}>
                <option>Không chiết khấu</option>
                <option>Chiết khấu theo dòng</option>
              </select>
            </div>
          </div>

          {/* Table Area Based on Active Detail Tab */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {/* 1. HÀNG TIỀN GRID */}
            {activeGridTab === "goods" && (
              <table className="misa-purchase-table">
                <thead>
                  <tr>
                    <th style={{ width: 34, textAlign: "center" }}>#</th>
                    <th style={{ width: 105 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Pin size={11} /><span>Mã hàng</span></div></th>
                    <th>Tên hàng</th>

                    {/* Columns vary per template */}
                    {purchaseType === "Mua hàng trong nước nhập kho" && (
                      <>
                        <th style={{ width: 85 }}>Kho</th>
                        {showAccounts && <th style={{ width: 75 }}>TK Kho</th>}
                        {showAccounts && (
                          <th style={{ width: 85 }}>
                            {paymentOption === "unpaid" ? "TK Công nợ" : "TK Tiền"}
                          </th>
                        )}
                        <th style={{ width: 65 }}>ĐVT</th>
                        <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                        <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                        <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                        <th style={{ width: 85, textAlign: "right" }}>% Thuế GTGT</th>
                        <th style={{ width: 105, textAlign: "right" }}>Tiền thuế GTGT</th>
                        {showAccounts && paymentOption === "paid" && (
                          <th style={{ width: 85 }}>TK thuế GTGT</th>
                        )}
                      </>
                    )}

                    {purchaseType === "Mua hàng trong nước không qua kho" && (
                      <>
                        {showAccounts && <th style={{ width: 85 }}>TK Chi phí</th>}
                        {showAccounts && (
                          <th style={{ width: 85 }}>
                            {paymentOption === "unpaid" ? "TK Công nợ" : "TK Tiền"}
                          </th>
                        )}
                        <th style={{ width: 65 }}>ĐVT</th>
                        <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                        <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                        <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                        <th style={{ width: 85, textAlign: "right" }}>% Thuế GTGT</th>
                        <th style={{ width: 105, textAlign: "right" }}>Tiền thuế GTGT</th>
                        {showAccounts && <th style={{ width: 85 }}>TK thuế GTGT</th>}
                        <th style={{ width: 95 }}>Nhóm HHDV m...</th>
                      </>
                    )}

                    {purchaseType === "Mua hàng nhập khẩu nhập kho" && (
                      <>
                        <th style={{ width: 85 }}>Kho</th>
                        {showAccounts && <th style={{ width: 75 }}>TK Kho</th>}
                        {showAccounts && (
                          <th style={{ width: 85 }}>
                            {paymentOption === "unpaid" ? "TK Công nợ" : "TK Tiền"}
                          </th>
                        )}
                        <th style={{ width: 65 }}>ĐVT</th>
                        <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                        <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                        <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                        {paymentOption === "unpaid" ? (
                          <>
                            <th style={{ width: 95, textAlign: "right" }}>Giá FOB</th>
                            <th style={{ width: 125, textAlign: "right" }}>Phí trước hải quan</th>
                          </>
                        ) : (
                          <>
                            <th style={{ width: 125, textAlign: "right" }}>Phí trước hải quan</th>
                            <th style={{ width: 110, textAlign: "right" }}>Phí hàng về kho</th>
                          </>
                        )}
                      </>
                    )}

                    {purchaseType === "Mua hàng nhập khẩu không qua kho" && (
                      <>
                        {showAccounts && <th style={{ width: 85 }}>TK chi phí</th>}
                        {showAccounts && (
                          <th style={{ width: 85 }}>
                            {paymentOption === "unpaid" ? "TK Công nợ" : "TK tiền"}
                          </th>
                        )}
                        <th style={{ width: 65 }}>ĐVT</th>
                        <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                        <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                        <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                        <th style={{ width: 125, textAlign: "right" }}>Phí trước hải quan</th>
                        <th style={{ width: 120, textAlign: "right" }}>Chi phí mua hàng</th>
                        <th style={{ width: 110, textAlign: "right" }}>Tổng giá trị</th>
                      </>
                    )}

                    <th style={{ width: 36, textAlign: "center" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td><input type="text" value={row.code} onChange={(e) => handleItemChange(idx, "code", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                      <td><input type="text" value={row.name} onChange={(e) => handleItemChange(idx, "name", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>

                      {purchaseType === "Mua hàng trong nước nhập kho" && (
                        <>
                          <td><input type="text" value={row.stock} onChange={(e) => handleItemChange(idx, "stock", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          {showAccounts && <td><input type="text" value={row.stockAccount} onChange={(e) => handleItemChange(idx, "stockAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={paymentOption === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                                onChange={(e) => {
                                  if (paymentOption === "unpaid") {
                                    handleItemChange(idx, "debtAccount", e.target.value);
                                  } else {
                                    handleItemChange(idx, "cashAccount", e.target.value);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          <td><input type="number" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                          <td><input type="number" value={row.vatRate} onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right" }}>{formatVND(row.vatAmount || 0)}</td>
                          {showAccounts && paymentOption === "paid" && (
                            <td><input type="text" value={row.vatAccount || "1331"} onChange={(e) => handleItemChange(idx, "vatAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          )}
                        </>
                      )}

                      {purchaseType === "Mua hàng trong nước không qua kho" && (
                        <>
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={row.expenseAccount || ""}
                                onChange={(e) => handleItemChange(idx, "expenseAccount", e.target.value)}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={paymentOption === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                                onChange={(e) => {
                                  if (paymentOption === "unpaid") {
                                    handleItemChange(idx, "debtAccount", e.target.value);
                                  } else {
                                    handleItemChange(idx, "cashAccount", e.target.value);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          <td><input type="number" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                          <td><input type="number" value={row.vatRate} onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right" }}>{formatVND(row.vatAmount || 0)}</td>
                          {showAccounts && (
                            <td><input type="text" value={row.vatAccount || "1331"} onChange={(e) => handleItemChange(idx, "vatAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          )}
                          <td>
                            <input
                              type="text"
                              value={row.taxGroup || "1"}
                              onChange={(e) => handleItemChange(idx, "taxGroup", e.target.value)}
                              style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "center" }}
                            />
                          </td>
                        </>
                      )}

                      {purchaseType === "Mua hàng nhập khẩu nhập kho" && (
                        <>
                          <td><input type="text" value={row.stock} onChange={(e) => handleItemChange(idx, "stock", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          {showAccounts && <td><input type="text" value={row.stockAccount} onChange={(e) => handleItemChange(idx, "stockAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={paymentOption === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                                onChange={(e) => {
                                  if (paymentOption === "unpaid") {
                                    handleItemChange(idx, "debtAccount", e.target.value);
                                  } else {
                                    handleItemChange(idx, "cashAccount", e.target.value);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          <td><input type="number" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                          {paymentOption === "unpaid" ? (
                            <>
                              <td><input type="number" value={row.fobPrice || 0} onChange={(e) => handleItemChange(idx, "fobPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                              <td><input type="number" value={row.customsFee || 0} onChange={(e) => handleItemChange(idx, "customsFee", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                            </>
                          ) : (
                            <>
                              <td><input type="number" value={row.customsFee || 0} onChange={(e) => handleItemChange(idx, "customsFee", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                              <td><input type="number" value={row.inwardFee || 0} onChange={(e) => handleItemChange(idx, "inwardFee", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                            </>
                          )}
                        </>
                      )}

                      {purchaseType === "Mua hàng nhập khẩu không qua kho" && (
                        <>
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={row.expenseAccount || ""}
                                onChange={(e) => handleItemChange(idx, "expenseAccount", e.target.value)}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          {showAccounts && (
                            <td>
                              <input
                                type="text"
                                value={paymentOption === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                                onChange={(e) => {
                                  if (paymentOption === "unpaid") {
                                    handleItemChange(idx, "debtAccount", e.target.value);
                                  } else {
                                    handleItemChange(idx, "cashAccount", e.target.value);
                                  }
                                }}
                                style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                          )}
                          <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                          <td><input type="number" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                          <td><input type="number" value={row.customsFee || 0} onChange={(e) => handleItemChange(idx, "customsFee", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td><input type="number" value={row.purchaseCost || 0} onChange={(e) => handleItemChange(idx, "purchaseCost", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND((row.amount || 0) + (row.customsFee || 0) + (row.purchaseCost || 0))}</td>
                        </>
                      )}

                      <td style={{ textAlign: "center" }}>
                        <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#f8fafc", fontWeight: 600, fontSize: 12.5, color: "#1e293b", borderTop: "1px solid #e2e8f0" }}>
                    <td colSpan={3} style={{ padding: "6px 10px" }}>
                      Tổng số: {items.length}
                    </td>
                    <td colSpan={!isWarehouse ? (showAccounts ? 3 : 1) : (showAccounts ? 4 : 2)}></td>
                    <td style={{ textAlign: "right", padding: "6px 10px" }}>
                      {items.reduce((s, it) => s + (Number(it.quantity) || 0), 0).toFixed(2).replace(".", ",")}
                    </td>
                    <td></td>
                    <td style={{ textAlign: "right", padding: "6px 10px" }}>
                      {formatVND(subtotal)}
                    </td>
                    {purchaseType === "Mua hàng nhập khẩu nhập kho" ? (
                      <>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>0</td>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>0</td>
                      </>
                    ) : purchaseType === "Mua hàng nhập khẩu không qua kho" ? (
                      <>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>0</td>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>0</td>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>{formatVND(subtotal)}</td>
                      </>
                    ) : (
                      <>
                        <td></td>
                        <td style={{ textAlign: "right", padding: "6px 10px" }}>
                          {formatVND(vatTotal)}
                        </td>
                        {purchaseType === "Mua hàng trong nước không qua kho" ? (
                          <>
                            {showAccounts && <td></td>}
                            <td></td>
                          </>
                        ) : (
                          <>
                            {showAccounts && paymentOption === "paid" && <td></td>}
                          </>
                        )}
                      </>
                    )}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* 2. THUẾ GRID (Templates 3 & 4) */}
            {activeGridTab === "tax" && isImport && (
              <table className="misa-purchase-table">
                <thead>
                  <tr>
                    <th style={{ width: 34, textAlign: "center" }}>#</th>
                    <th style={{ width: 105 }}>Mã hàng</th>
                    <th>Tên hàng</th>
                    {showAccounts && <th style={{ width: 85 }}>TK Thuế NK</th>}
                    <th style={{ width: 80, textAlign: "right" }}>% Thuế NK</th>
                    <th style={{ width: 110, textAlign: "right" }}>Tiền thuế NK</th>
                    {showAccounts && <th style={{ width: 85 }}>TK Thuế TTĐB</th>}
                    <th style={{ width: 85, textAlign: "right" }}>% Thuế TTĐB</th>
                    <th style={{ width: 110, textAlign: "right" }}>Tiền thuế TTĐB</th>
                    <th style={{ width: 80, textAlign: "right" }}>% Thuế GTGT</th>
                    <th style={{ width: 110, textAlign: "right" }}>Tiền thuế GTGT</th>
                    {showAccounts && <th style={{ width: 85 }}>TK Thuế GTGT</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{row.code}</td>
                      <td>{row.name}</td>
                      {showAccounts && <td><input type="text" value={row.importTaxAccount || "3333"} onChange={(e) => handleItemChange(idx, "importTaxAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                      <td><input type="number" value={row.importTaxRate || 0} onChange={(e) => handleItemChange(idx, "importTaxRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.importTaxAmount || 0)}</td>
                      {showAccounts && <td><input type="text" value={row.exciseTaxAccount || "3332"} onChange={(e) => handleItemChange(idx, "exciseTaxAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                      <td><input type="number" value={row.exciseTaxRate || 0} onChange={(e) => handleItemChange(idx, "exciseTaxRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right" }}>{formatVND(row.exciseTaxAmount || 0)}</td>
                      <td><input type="number" value={row.vatRate} onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                      <td style={{ textAlign: "right", color: "#00b06b", fontWeight: 600 }}>{formatVND(row.vatAmount)}</td>
                      {showAccounts && <td><input type="text" value={row.vatAccount} onChange={(e) => handleItemChange(idx, "vatAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. PHÍ TRƯỚC HẢI QUAN GRID */}
            {activeGridTab === "customs_fee" && isImport && (
              <table className="misa-purchase-table">
                <thead>
                  <tr>
                    <th style={{ width: 34, textAlign: "center" }}>#</th>
                    <th style={{ width: 110 }}>Ngày hạch toán</th>
                    <th style={{ width: 110 }}>Ngày chứng từ</th>
                    <th style={{ width: 120 }}>Số chứng từ</th>
                    <th>Diễn giải</th>
                    <th style={{ width: 140, textAlign: "right" }}>Số tiền</th>
                    {showAccounts && <th style={{ width: 100 }}>TK Chi phí</th>}
                  </tr>
                </thead>
                <tbody>
                  {customsFees.map((fee, idx) => (
                    <tr key={fee.id}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td>{fee.postingDate}</td>
                      <td>{fee.docDate}</td>
                      <td style={{ fontWeight: 600, color: "#0284c7" }}>{fee.docNo}</td>
                      <td>{fee.desc}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(fee.amount)}</td>
                      {showAccounts && <td>{fee.expenseAccount}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 4. PHÍ HÀNG VỀ KHO / CHI PHÍ MUA HÀNG GRID */}
            {(activeGridTab === "inward_fee" || activeGridTab === "costs") && (
              <table className="misa-purchase-table">
                <thead>
                  <tr>
                    <th style={{ width: 34, textAlign: "center" }}>#</th>
                    <th style={{ width: 110 }}>Ngày chứng từ</th>
                    <th style={{ width: 120 }}>Số chứng từ</th>
                    <th style={{ minWidth: 180 }}>Tên nhà cung cấp</th>
                    <th>Diễn giải</th>
                    <th style={{ width: 140, textAlign: "right" }}>Số tiền chi phí</th>
                    {showAccounts && <th style={{ width: 100 }}>TK Chi phí</th>}
                    <th style={{ width: 130 }}>Phân bổ theo</th>
                  </tr>
                </thead>
                <tbody>
                  {inwardFees.map((fee, idx) => (
                    <tr key={fee.id}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td>{fee.docDate}</td>
                      <td style={{ fontWeight: 600, color: "#0284c7" }}>{fee.docNo}</td>
                      <td>{fee.supplier}</td>
                      <td>{fee.desc}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(fee.amount)}</td>
                      {showAccounts && <td>{fee.expenseAccount}</td>}
                      <td>{fee.allocationType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Grid Toolbar: Thêm dòng / Thêm ghi chú / Xóa dòng */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Plus size={13} /> Thêm dòng
              </button>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <FileText size={13} /> Thêm ghi chú
              </button>
              <button type="button" onClick={() => setItems([])} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}>
                <Trash2 size={13} /> Xóa hết dòng
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
              <span>Số dòng/trang</span>
              <select style={{ height: 24, padding: "0 4px", fontSize: 12, borderRadius: 3, border: "1px solid #cbd5e1", background: "#fff" }}>
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

          {/* Bottom Area: E-invoice inputs, Attachment, Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">Mã tra cứu HĐĐT</label>
                  <input type="text" value={einvoiceLookupCode} onChange={(e) => setEinvoiceLookupCode(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
                </div>
                <div>
                  <label className="misa-purchase-label">Đường dẫn tra cứu HĐĐT</label>
                  <input type="text" value={einvoiceLookupUrl} onChange={(e) => setEinvoiceLookupUrl(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
                </div>
              </div>

              {/* Attachment */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                  <Paperclip size={13} style={{ color: "#64748b" }} />
                  <span style={{ fontWeight: 600 }}>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "18px 12px",
                    background: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={15} />
                    <span><strong>Chọn tệp</strong> hoặc kéo và thả tệp vào đây</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Totals Summary */}
            {isImport ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "4px 8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Tổng tiền hàng</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Tổng tiền thanh toán</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(grandTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Thuế nhập khẩu</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(importTaxTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Thuế CBPG</span>
                  <span style={{ fontWeight: 600 }}>0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Thuế TTĐB</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(exciseTaxTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Thuế BVMT</span>
                  <span style={{ fontWeight: 600 }}>0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Thuế GTGT</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(vatTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>Phí trước HQ</span>
                  <span style={{ fontWeight: 600 }}>0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>{isWarehouse ? "Phí hàng về kho" : "Chi phí mua hàng"}</span>
                  <span style={{ fontWeight: 600 }}>0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#1e293b" }}>
                  <span>{isWarehouse ? "Giá trị nhập kho" : "Tổng giá trị"}</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(inventoryValue)}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 14px", background: "#f8fafc", borderRadius: 6, border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                  <span>Tổng tiền hàng</span>
                  <strong>{formatVND(subtotal)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                  <span>Thuế GTGT</span>
                  <span>{formatVND(vatTotal)}</span>
                </div>
                <div style={{ borderTop: "1px solid #cbd5e1", margin: "2px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
                  <span>Tổng tiền thanh toán</span>
                  <span style={{ color: "#0f172a", fontWeight: 800 }}>{formatVND(grandTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>Chi phí mua hàng</span>
                  <span>0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b" }}>
                  <span>{isWarehouse ? "Giá trị nhập kho" : "Tổng giá trị"}</span>
                  <span>{formatVND(inventoryValue)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              onClick={() => setShowAccounts(!showAccounts)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <div
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 10,
                  background: showAccounts ? "#00b06b" : "#cbd5e1",
                  position: "relative",
                  transition: "background 0.2s",
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
                    left: showAccounts ? 16 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>Hiển thị tài khoản</span>
            </div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>|</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>F3 - Tìm nhanh, F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>Hủy</button>
            <button type="button" className="misa-invoice-btn-cancel" onClick={() => handleSave(false)}>Cất</button>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="misa-invoice-btn-submit"
                onClick={() => handleSave(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và Đóng</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSaveDropdown(!showSaveDropdown);
                  }}
                  style={{ display: "grid", placeItems: "center", paddingLeft: 4 }}
                >
                  <ChevronDown size={14} />
                </span>
              </button>

              {showSaveDropdown && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 4px)",
                    right: 0,
                    background: "#ffffff",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                    zIndex: 100,
                    width: 140,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveDropdown(false);
                      handleSave(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Cất và Thêm
                  </button>
                </div>
              )}
            </div>
          </div>
        </footer>

        {/* Reference Lookup Modal */}
        {showRefModal && (
          <div className="misa-modal-backdrop" style={{ zIndex: 12000 }}>
            <div style={{ width: 620, background: "#ffffff", borderRadius: 8, padding: "18px 24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Chọn chứng từ tham chiếu</h3>
                <button type="button" onClick={() => setShowRefModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={18} /></button>
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                Tìm kiếm và liên kết chứng từ tham chiếu (Đơn mua hàng, Hợp đồng, v.v.):
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "12px", background: "#f8fafc", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Loại chứng từ</label>
                    <select style={{ width: "100%", height: 30, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5 }}>
                      <option>Đơn mua hàng</option>
                      <option>Hợp đồng mua hàng</option>
                      <option>Báo giá</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#475569", display: "block", marginBottom: 4 }}>Thời gian</label>
                    <select style={{ width: "100%", height: 30, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5 }}>
                      <option>Năm nay</option>
                      <option>Tháng này</option>
                      <option>Quý này</option>
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                  Chưa có chứng từ tham chiếu nào được chọn.
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setShowRefModal(false)} style={{ padding: "6px 16px", borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: 13 }}>Đóng</button>
                <button type="button" onClick={() => setShowRefModal(false)} style={{ padding: "6px 16px", borderRadius: 4, border: "none", background: "#00b06b", color: "#ffffff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Đồng ý</button>
              </div>
            </div>
          </div>
        )}

        {/* Debt Lookup Modal */}
        {showDebtLookup && (
          <div className="misa-modal-backdrop" style={{ zIndex: 12000 }}>
            <div style={{ width: 460, background: "#ffffff", borderRadius: 8, padding: "18px 22px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Tra cứu công nợ nhà cung cấp</h3>
                <button type="button" onClick={() => setShowDebtLookup(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><X size={16} /></button>
              </div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.6 }}>
                <div><strong>Mã NCC:</strong> <span style={{ color: "#00b06b" }}>{supplierCode}</span></div>
                <div><strong>Tên NCC:</strong> {supplierName}</div>
                <div style={{ marginTop: 10, padding: 12, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Số dư nợ đầu kỳ:</span>
                    <strong>0 đ</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Số phát sinh nợ trong kỳ:</span>
                    <strong>0 đ</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span>Số đã thanh toán trong kỳ:</span>
                    <strong>0 đ</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #cbd5e1", paddingTop: 8, color: "#00b06b", fontWeight: 700 }}>
                    <span>Số dư nợ hiện tại:</span>
                    <strong>0 đ</strong>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <button type="button" onClick={() => setShowDebtLookup(false)} style={{ padding: "7px 20px", background: "#00b06b", color: "#fff", border: "none", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 4. MODAL: CHỨNG TỪ TRẢ LẠI HÀNG MUA (MATCHING IMAGE 5)
// ============================================================================
export interface PurchaseReturnModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseReturnModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseReturnModalProps) {
  // Option bar (Image 5)
  const [returnOption, setReturnOption] = useState<"debt_reduction" | "cash">("debt_reduction");
  const [returnFromStock, setReturnFromStock] = useState(true);
  const [invoiceHandlerType, setInvoiceHandlerType] = useState("Người bán xuất hóa đơn điều chỉnh");
  const [activeSubTab, setActiveSubTab] = useState<"export_note" | "invoice">("export_note");
  const [showAccounts, setShowAccounts] = useState(true);

  // Master fields
  const [voucherCode, setVoucherCode] = useState("XK00001");
  const [supplierCode, setSupplierCode] = useState("NCC001");
  const [supplierName, setSupplierName] = useState("Công ty TNHH Thiết bị Công nghiệp Tân Phát");
  const [recipient, setRecipient] = useState("Nguyễn Văn Hùng");
  const [address, setAddress] = useState("Số 18 Hoàng Cầu, Đống Đa, Hà Nội");
  const [reason, setReason] = useState("Trả lại hàng mua");
  const [employee, setEmployee] = useState("Nguyễn Văn A - Phòng Mua hàng");
  const [attachedCount, setAttachedCount] = useState(1);

  // Right dates
  const [postingDate, setPostingDate] = useState("29/09/2026 11:34:07");
  const [docDate, setDocDate] = useState("29/09/2026");

  // Items
  const [items, setItems] = useState([
    {
      id: "xk-1",
      code: "VT001",
      name: "Thép cuộn mạ kẽm Ø6",
      stock: "1561",
      debtAccount: "331",
      stockAccount: "1561",
      unit: "Kg",
      quantity: 100,
      unitPrice: 21500,
      amount: 2150000,
      vatRate: 10,
      vatAmount: 215000,
      vatAccount: "1331",
      group: "1",
    },
  ]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const row: any = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      row.amount = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
      row.vatAmount = Math.round((row.amount * (Number(row.vatRate) || 0)) / 100);
    }
    updated[index] = row;
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `xk-${Date.now()}`,
        code: "",
        name: "",
        stock: "1561",
        debtAccount: "331",
        stockAccount: "1561",
        unit: "Cái",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: 10,
        vatAmount: 0,
        vatAccount: "1331",
        group: "1",
      },
    ]);
  };

  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const vatTotal = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const grandTotal = subtotal + vatTotal;

  const handleSave = (andPrint = true) => {
    onSubmit({
      kind: "purchase_return",
      voucherCode,
      returnOption,
      returnFromStock,
      invoiceHandlerType,
      supplierCode,
      supplierName,
      recipient,
      address,
      reason,
      postingDate,
      docDate,
      items,
      subtotal,
      vatTotal,
      grandTotal,
      andPrint,
    });
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Header (Image 5) */}
        <header className="misa-purchase-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Clock size={18} style={{ color: "#64748b" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Chứng từ trả lại hàng mua {voucherCode}
            </h2>

            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Nhập số chứng từ mua hàng"
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 170, background: "transparent" }}
              />
              <Search size={14} style={{ color: "#64748b" }} />
              <ChevronDown size={14} style={{ color: "#64748b" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {/* Radio Option Bar (Image 5) */}
        <div style={{ padding: "8px 18px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="returnOption"
                  checked={returnOption === "debt_reduction"}
                  onChange={() => setReturnOption("debt_reduction")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Giảm trừ công nợ</span>
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="returnOption"
                  checked={returnOption === "cash"}
                  onChange={() => setReturnOption("cash")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Thu tiền mặt</span>
              </label>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500, borderLeft: "1px solid #e2e8f0", paddingLeft: 16 }}>
              <input
                type="checkbox"
                checked={returnFromStock}
                onChange={(e) => setReturnFromStock(e.target.checked)}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Trả lại hàng trong kho</span>
            </label>

            <select
              value={invoiceHandlerType}
              onChange={(e) => setInvoiceHandlerType(e.target.value)}
              style={{ height: 26, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12 }}
            >
              <option value="Người bán xuất hóa đơn điều chỉnh">Người bán xuất hóa đơn điều chỉnh</option>
              <option value="Tự xuất hóa đơn trả lại">Tự xuất hóa đơn trả lại</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setActiveSubTab("export_note")}
              style={{
                height: 28,
                padding: "0 12px",
                border: "none",
                borderRadius: 4,
                background: activeSubTab === "export_note" ? "#dcfce7" : "transparent",
                color: activeSubTab === "export_note" ? "#15803d" : "#475569",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Phiếu xuất
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("invoice")}
              style={{
                height: 28,
                padding: "0 12px",
                border: "none",
                borderRadius: 4,
                background: activeSubTab === "invoice" ? "#dcfce7" : "transparent",
                color: activeSubTab === "invoice" ? "#15803d" : "#475569",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hóa đơn
            </button>
          </div>
        </div>

        {/* Master Form Area (Image 5) */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            <div>
              {/* Row 1: Mã NCC & Tên NCC */}
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Mã nhà cung cấp</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="text" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                    <button type="button" onClick={onOpenSupplierModal} style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}><Plus size={14} /></button>
                    <button type="button" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#64748b", cursor: "pointer", boxSizing: "border-box" }}><ChevronDown size={13} /></button>
                    <button type="button" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#64748b", cursor: "pointer", boxSizing: "border-box" }}><DollarSign size={13} /></button>
                  </div>
                </div>
                <div>
                  <label className="misa-purchase-label">Tên nhà cung cấp</label>
                  <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Row 2: Người nhận & Địa chỉ */}
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Người nhận</label>
                  <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label className="misa-purchase-label">Địa chỉ</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                </div>
              </div>

              {/* Row 3: Lý do xuất */}
              <div style={{ marginBottom: 8 }}>
                <label className="misa-purchase-label">Lý do xuất</label>
                <div style={{ position: "relative" }}>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                  <Sparkles size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#8b5cf6" }} />
                </div>
              </div>

              {/* Row 4: Nhân viên & Kèm theo */}
              <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, alignItems: "center" }}>
                <div>
                  <label className="misa-purchase-label">Nhân viên mua hàng</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <select value={employee} onChange={(e) => setEmployee(e.target.value)} style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, background: "#ffffff", boxSizing: "border-box" }}>
                      <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                      <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                    </select>
                    <button type="button" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}><Plus size={14} /></button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 18, paddingTop: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                    <input type="number" value={attachedCount} onChange={(e) => setAttachedCount(Number(e.target.value) || 0)} style={{ width: 68, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }} />
                    <span style={{ fontSize: 12, color: "#374151" }}>chứng từ gốc</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}>Tham chiếu ...</span>
                </div>
              </div>
            </div>

            {/* Right: Tổng tiền */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18 }}>
              <div style={{ textAlign: "right", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>{formatVND(grandTotal)}</strong>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label className="misa-purchase-label">Ngày hạch toán</label>
                  <div style={{ position: "relative" }}>
                    <input type="text" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                    <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div>
                  <label className="misa-purchase-label">Ngày chứng từ</label>
                  <div style={{ position: "relative" }}>
                    <input type="text" value={docDate} onChange={(e) => setDocDate(e.target.value)} style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }} />
                    <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div>
                  <label className="misa-purchase-label">Số chứng từ</label>
                  <input type="text" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Section (Image 5) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid #e2e8f0" }}>
            <button
              type="button"
              style={{
                height: 36,
                background: "transparent",
                border: "none",
                borderBottom: "2px solid #00b06b",
                color: "#00b06b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hàng tiền
            </button>

            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FileCheck size={13} />
              <span>Gợi ý hồ sơ</span>
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 105 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Pin size={11} /><span>Mã hàng</span></div></th>
                  <th>Tên hàng</th>
                  <th style={{ width: 85 }}>Kho</th>
                  {showAccounts && <th style={{ width: 85 }}>TK công nợ</th>}
                  {showAccounts && <th style={{ width: 75 }}>TK kho</th>}
                  <th style={{ width: 65 }}>ĐVT</th>
                  <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                  <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                  <th style={{ width: 85, textAlign: "right" }}>% thuế GTGT</th>
                  <th style={{ width: 105, textAlign: "right" }}>Tiền thuế GTGT</th>
                  {showAccounts && <th style={{ width: 85 }}>TK Thuế GTGT</th>}
                  <th style={{ width: 75 }}>Nhóm H...</th>
                  <th style={{ width: 36, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td><input type="text" value={row.code} onChange={(e) => handleItemChange(idx, "code", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.name} onChange={(e) => handleItemChange(idx, "name", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.stock} onChange={(e) => handleItemChange(idx, "stock", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    {showAccounts && <td><input type="text" value={row.debtAccount} onChange={(e) => handleItemChange(idx, "debtAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    {showAccounts && <td><input type="text" value={row.stockAccount} onChange={(e) => handleItemChange(idx, "stockAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="number" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td><input type="number" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                    <td><input type="number" value={row.vatRate} onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right" }}>{formatVND(row.vatAmount)}</td>
                    {showAccounts && <td><input type="text" value={row.vatAccount} onChange={(e) => handleItemChange(idx, "vatAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    <td><input type="text" value={row.group} onChange={(e) => handleItemChange(idx, "group", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td style={{ textAlign: "center" }}>
                      <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Grid toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Plus size={13} /> Thêm dòng
              </button>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <FileText size={13} /> Thêm ghi chú
              </button>
              <button type="button" onClick={() => setItems([])} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}>
                <Trash2 size={13} /> Xóa hết dòng
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Số dòng/trang 20 ▾ {"< 1 >"}</div>
          </div>

          {/* Bottom Area */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">Mã tra cứu HĐĐT</label>
                  <input type="text" style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
                </div>
                <div>
                  <label className="misa-purchase-label">Đường dẫn tra cứu HĐĐT</label>
                  <input type="text" style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
                </div>
              </div>

              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "8px 12px", background: "#f8fafc", display: "flex", alignItems: "center", gap: 10 }}>
                <Upload size={16} style={{ color: "#00b06b" }} />
                <span style={{ fontSize: 12, color: "#475569" }}><span style={{ color: "#0284c7", fontWeight: 600, cursor: "pointer" }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây. Dung lượng tối đa 5MB</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 14px", background: "#f8fafc", borderRadius: 6, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Tổng tiền hàng</span>
                <strong>{formatVND(subtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Thuế GTGT</span>
                <span>{formatVND(vatTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#059669" }}>{formatVND(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Image 5) */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#334155", fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={showAccounts}
                onChange={(e) => setShowAccounts(e.target.checked)}
                style={{ accentColor: "#00b06b", width: 16, height: 16 }}
              />
              <span>Hiển thị tài khoản</span>
            </label>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>|</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>Hủy</button>
            <button type="button" className="misa-invoice-btn-cancel" onClick={() => handleSave(false)}>Cất</button>
            <button type="button" className="misa-invoice-btn-submit" onClick={() => handleSave(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span>Cất và In</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MODAL: CHỨNG TỪ GIẢM GIÁ HÀNG MUA (MATCHING SCREENSHOT 1)
// ============================================================================
export interface PurchaseDiscountModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseDiscountModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseDiscountModalProps) {
  // Option bar states (Matching Screenshots 1, 2, 3, 4)
  const [discountOption, setDiscountOption] = useState<"debt_reduction" | "cash">("debt_reduction");
  const [reduceStockValue, setReduceStockValue] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"main" | "invoice">("main");
  const [showAccounts, setShowAccounts] = useState(true);

  // Master fields
  const [voucherCode, setVoucherCode] = useState("MGG00001");
  const [supplierCode, setSupplierCode] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [address, setAddress] = useState("");
  const [employee, setEmployee] = useState("");
  const [description, setDescription] = useState("Giảm giá hàng mua");

  // Cash-specific fields (Screenshot 3)
  const [payer, setPayer] = useState("");
  const [attachedCount, setAttachedCount] = useState("");

  // Invoice-specific fields (Screenshots 2 & 4)
  const [taxCode, setTaxCode] = useState("");
  const [invoiceForm, setInvoiceForm] = useState("");
  const [invoiceSerial, setInvoiceSerial] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("03/10/2026");

  // Electronic invoice lookup
  const [eInvoiceLookupCode, setEInvoiceLookupCode] = useState("");
  const [eInvoiceLookupUrl, setEInvoiceLookupUrl] = useState("");

  // Right dates
  const [postingDate, setPostingDate] = useState("03/10/2026 20:43:37");
  const [docDate, setDocDate] = useState("03/10/2026");

  // Supplier dropdown picker
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Items table matching screenshots (initial 1 row with default values)
  const [items, setItems] = useState([
    {
      id: "mgg-1",
      code: "",
      name: "",
      stock: "",
      debtAccount: "331",
      stockAccount: "",
      unit: "",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      vatRate: 0,
      vatAmount: 0,
    },
  ]);

  const handleOptionChange = (option: "debt_reduction" | "cash") => {
    setDiscountOption(option);
    if (option === "cash") {
      if (voucherCode === "MGG00001" || voucherCode.startsWith("MGG")) {
        setVoucherCode("PT00001");
      }
      if (description === "Giảm giá hàng mua") {
        setDescription("Thu tiền giảm giá hàng mua");
      }
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          debtAccount: it.debtAccount === "331" ? "111" : it.debtAccount,
        }))
      );
    } else {
      if (voucherCode === "PT00001" || voucherCode.startsWith("PT")) {
        setVoucherCode("MGG00001");
      }
      if (description === "Thu tiền giảm giá hàng mua") {
        setDescription("Giảm giá hàng mua");
      }
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          debtAccount: it.debtAccount === "111" ? "331" : it.debtAccount,
        }))
      );
    }
  };

  const handleSelectSupplier = (s: (typeof SAMPLE_SUPPLIERS)[0]) => {
    setSupplierCode(s.code);
    setSupplierName(s.name);
    setAddress(s.address);
    setTaxCode(s.taxCode);
    setPayer(s.contact || s.name);
    setShowSupplierDropdown(false);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const row: any = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      row.amount = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
      row.vatAmount = Math.round((row.amount * (Number(row.vatRate) || 0)) / 100);
    } else if (field === "vatRate") {
      row.vatAmount = Math.round(((Number(row.amount) || 0) * (Number(value) || 0)) / 100);
    }
    updated[index] = row;
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `mgg-${Date.now()}`,
        code: "",
        name: "",
        stock: "",
        debtAccount: discountOption === "debt_reduction" ? "331" : "111",
        stockAccount: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: 0,
        vatAmount: 0,
      },
    ]);
  };

  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const vatTotal = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const grandTotal = subtotal + vatTotal;

  const handleSave = (andPrint = true) => {
    onSubmit({
      kind: "purchase_discount",
      voucherCode,
      discountOption,
      reduceStockValue,
      supplierCode,
      supplierName,
      address,
      employee,
      description,
      payer,
      attachedCount,
      taxCode,
      invoiceForm,
      invoiceSerial,
      invoiceNumber,
      invoiceDate,
      eInvoiceLookupCode,
      eInvoiceLookupUrl,
      postingDate,
      docDate,
      items,
      subtotal,
      vatTotal,
      grandTotal,
      andPrint,
    });
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window" style={{ maxWidth: 1240 }}>
        {/* Header (Screenshots 1 - 4) */}
        <header className="misa-purchase-modal-header" style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Clock size={18} style={{ color: "#64748b", cursor: "pointer" }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
              Chứng từ giảm giá hàng mua {voucherCode}
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
              <button
                type="button"
                title="Tùy chọn tra cứu"
                style={{
                  width: 28,
                  height: 28,
                  minWidth: 28,
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <Settings size={14} />
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 28,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "0 8px",
                  gap: 6,
                  boxSizing: "border-box",
                }}
              >
                <input
                  type="text"
                  placeholder="Nhập số chứng từ mua hàng"
                  style={{
                    border: "none",
                    outline: "none",
                    fontSize: 12,
                    width: 170,
                    background: "transparent",
                    color: "#334155",
                  }}
                />
                <Search size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-purchase-link-btn"
              title="Hướng dẫn sử dụng"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "transparent",
                border: "none",
                color: "#00b06b",
                fontSize: 12.5,
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              <HelpCircle size={15} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {/* Radio Option Bar (Screenshots 1 - 4) */}
        <div style={{ padding: "8px 18px", background: "#f8fafc", display: "flex", alignItems: "center", gap: 20 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1e293b" }}>
            <input
              type="radio"
              name="discountOption"
              checked={discountOption === "debt_reduction"}
              onChange={() => handleOptionChange("debt_reduction")}
              style={{ accentColor: "#00b06b", width: 16, height: 16 }}
            />
            <span>Giảm trừ công nợ</span>
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1e293b" }}>
            <input
              type="radio"
              name="discountOption"
              checked={discountOption === "cash"}
              onChange={() => handleOptionChange("cash")}
              style={{ accentColor: "#00b06b", width: 16, height: 16 }}
            />
            <span>Thu tiền mặt</span>
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500, color: "#1e293b" }}>
            <input
              type="checkbox"
              checked={reduceStockValue}
              onChange={(e) => setReduceStockValue(e.target.checked)}
              style={{ accentColor: "#00b06b", width: 16, height: 16 }}
            />
            <span>Giảm giá trị hàng nhập kho</span>
          </label>
        </div>

        {/* Subtabs Bar (Screenshots 1 - 4) */}
        <div style={{ display: "flex", gap: 16, padding: "0 18px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <button
            type="button"
            onClick={() => setActiveSubTab("main")}
            style={{
              height: 32,
              padding: "0 4px",
              background: "transparent",
              border: "none",
              borderBottom: activeSubTab === "main" ? "2px solid #00b06b" : "2px solid transparent",
              color: activeSubTab === "main" ? "#00b06b" : "#475569",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {discountOption === "debt_reduction" ? "Chứng từ giảm công nợ" : "Phiếu thu"}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("invoice")}
            style={{
              height: 32,
              padding: "0 4px",
              background: "transparent",
              border: "none",
              borderBottom: activeSubTab === "invoice" ? "2px solid #00b06b" : "2px solid transparent",
              color: activeSubTab === "invoice" ? "#00b06b" : "#475569",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Hóa đơn
          </button>
        </div>

        {/* Master Form Area (Screenshots 1 - 4) */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Left Form Content */}
            <div>
              {/* TAB 1: MAIN (Chứng từ giảm công nợ OR Phiếu thu) */}
              {activeSubTab === "main" && (
                <>
                  {/* Row 1: Mã NCC & Tên NCC */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div style={{ position: "relative" }}>
                      <label className="misa-purchase-label">Mã nhà cung cấp</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          style={{
                            flex: 1,
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 4,
                            border: "1px solid #00b06b",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                        <button
                          type="button"
                          onClick={onOpenSupplierModal}
                          title="Thêm nhà cung cấp"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#00b06b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          title="Chọn nhà cung cấp"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          title="Số dư công nợ"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <DollarSign size={13} />
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: 380,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                            zIndex: 50,
                            marginTop: 4,
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {SAMPLE_SUPPLIERS.map((s) => (
                            <div
                              key={s.code}
                              onClick={() => handleSelectSupplier(s)}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #f1f5f9",
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <div style={{ fontWeight: 600, color: "#00b06b" }}>{s.code} - {s.name}</div>
                              <div style={{ color: "#64748b", fontSize: 11 }}>MST: {s.taxCode} | {s.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="misa-purchase-label">Tên nhà cung cấp</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Either full width Địa chỉ (debt_reduction) OR Người nộp + Địa chỉ (cash) */}
                  {discountOption === "debt_reduction" ? (
                    <div style={{ marginBottom: 8 }}>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                      <div>
                        <label className="misa-purchase-label">Người nộp</label>
                        <input
                          type="text"
                          value={payer}
                          onChange={(e) => setPayer(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
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
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Row 3: Nhân viên mua hàng & Diễn giải / Lý do nộp */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={employee}
                          onChange={(e) => setEmployee(e.target.value)}
                          style={{
                            flex: 1,
                            height: 28,
                            padding: "0 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        >
                          <option value=""></option>
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#00b06b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="misa-purchase-label">
                        {discountOption === "debt_reduction" ? "Diễn giải" : "Lý do nộp"}
                      </label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          style={{
                            width: "100%",
                            height: 28,
                            padding: "0 28px 0 8px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                        <span
                          title="AVA AI gợi ý"
                          style={{
                            position: "absolute",
                            right: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#8b5cf6",
                            cursor: "pointer",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Sparkles size={14} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Kèm theo (cash mode) + Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {discountOption === "cash" && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#334155" }}>Kèm theo</span>
                        <input
                          type="text"
                          value={attachedCount}
                          onChange={(e) => setAttachedCount(e.target.value)}
                          placeholder="Số lượng"
                          style={{
                            width: 76,
                            height: 28,
                            padding: "0 6px",
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            fontSize: 12,
                            textAlign: "center",
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                        <span style={{ fontSize: 12, color: "#334155" }}>Chứng từ gốc</span>
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}>
                      Tham chiếu ...
                    </span>
                  </div>
                </>
              )}

              {/* TAB 2: INVOICE (Hóa đơn - Screenshots 2 & 4) */}
              {activeSubTab === "invoice" && (
                <>
                  {/* Row 1: Mã NCC & Tên NCC */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div style={{ position: "relative" }}>
                      <label className="misa-purchase-label">Mã nhà cung cấp</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={supplierCode}
                          onChange={(e) => setSupplierCode(e.target.value)}
                          style={{
                            flex: 1,
                            height: 28,
                            padding: "0 8px",
                            borderRadius: 4,
                            border: "1px solid #00b06b",
                            fontSize: 12.5,
                            boxSizing: "border-box",
                            background: "#ffffff",
                          }}
                        />
                        <button
                          type="button"
                          onClick={onOpenSupplierModal}
                          title="Thêm nhà cung cấp"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#00b06b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                          title="Chọn nhà cung cấp"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          type="button"
                          title="Số dư công nợ"
                          style={{
                            width: 28,
                            height: 28,
                            minWidth: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          <DollarSign size={13} />
                        </button>
                      </div>

                      {showSupplierDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: 380,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                            zIndex: 50,
                            marginTop: 4,
                            maxHeight: 220,
                            overflowY: "auto",
                          }}
                        >
                          {SAMPLE_SUPPLIERS.map((s) => (
                            <div
                              key={s.code}
                              onClick={() => handleSelectSupplier(s)}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid #f1f5f9",
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <div style={{ fontWeight: 600, color: "#00b06b" }}>{s.code} - {s.name}</div>
                              <div style={{ color: "#64748b", fontSize: 11 }}>MST: {s.taxCode} | {s.address}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="misa-purchase-label">Tên nhà cung cấp</label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Địa chỉ */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Địa chỉ</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  {/* Row 3: Mã số thuế */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
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
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                    </div>
                    <div />
                  </div>

                  {/* Row 4: Tham chiếu */}
                  <div>
                    <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}>
                      Tham chiếu ...
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right Form Content */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18 }}>
              <div style={{ textAlign: "right", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>{formatVND(grandTotal)}</strong>
              </div>

              {activeSubTab === "main" ? (
                /* TAB 1 Right Fields */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={postingDate}
                        onChange={(e) => setPostingDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 28px 0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                      <Calendar
                        size={13}
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
                    <label className="misa-purchase-label">
                      {discountOption === "debt_reduction" ? "Ngày chứng từ" : "Ngày phiếu thu"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 28px 0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                      <Calendar
                        size={13}
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
                    <label className="misa-purchase-label">
                      {discountOption === "debt_reduction" ? "Số chứng từ" : "Số phiếu thu"}
                    </label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        fontWeight: 600,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* TAB 2: INVOICE Right Fields (Screenshots 2 & 4) */
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Mẫu số hóa đơn</label>
                    <select
                      value={invoiceForm}
                      onChange={(e) => setInvoiceForm(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 6px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    >
                      <option value=""></option>
                      <option value="1/001">1/001</option>
                      <option value="01GTKT0/001">01GTKT0/001</option>
                      <option value="02GTTT0/001">02GTTT0/001</option>
                    </select>
                  </div>

                  <div>
                    <label className="misa-purchase-label">Ký hiệu hóa đơn</label>
                    <input
                      type="text"
                      value={invoiceSerial}
                      onChange={(e) => setInvoiceSerial(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label className="misa-purchase-label">Số hóa đơn</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label className="misa-purchase-label">Ngày hóa đơn</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 28px 0 8px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          boxSizing: "border-box",
                          background: "#ffffff",
                        }}
                      />
                      <Calendar
                        size={13}
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
              )}
            </div>
          </div>
        </div>

        {/* Table Section (Screenshots 1 - 4) */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", borderBottom: "1px solid #e2e8f0" }}>
            <button
              type="button"
              style={{
                height: 36,
                background: "transparent",
                border: "none",
                borderBottom: "2px solid #00b06b",
                color: "#00b06b",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hàng tiền
            </button>

            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
                borderRadius: 14,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FileCheck size={13} />
              <span>Gợi ý hồ sơ</span>
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 105 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Pin size={11} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th>Tên hàng</th>
                  <th style={{ width: 85 }}>Kho</th>
                  {showAccounts && (
                    <th style={{ width: 85 }}>
                      {discountOption === "debt_reduction" ? "TK Công nợ" : "TK Tiền"}
                    </th>
                  )}
                  {showAccounts && <th style={{ width: 75 }}>TK Kho</th>}
                  <th style={{ width: 65 }}>ĐVT</th>
                  <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                  <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                  <th style={{ width: 85, textAlign: "right" }}>% Thuế GTGT</th>
                  <th style={{ width: 105, textAlign: "right" }}>Tiền thuế</th>
                  <th style={{ width: 36, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.code}
                        onChange={(e) => handleItemChange(idx, "code", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.stock}
                        onChange={(e) => handleItemChange(idx, "stock", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                      />
                    </td>
                    {showAccounts && (
                      <td>
                        <input
                          type="text"
                          value={row.debtAccount}
                          onChange={(e) => handleItemChange(idx, "debtAccount", e.target.value)}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                        />
                      </td>
                    )}
                    {showAccounts && (
                      <td>
                        <input
                          type="text"
                          value={row.stockAccount}
                          onChange={(e) => handleItemChange(idx, "stockAccount", e.target.value)}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, background: "transparent" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right", background: "transparent" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right", background: "transparent" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatVND(row.amount)}</td>
                    <td>
                      <input
                        type="number"
                        value={row.vatRate}
                        onChange={(e) => handleItemChange(idx, "vatRate", Number(e.target.value) || 0)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right", background: "transparent" }}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>{formatVND(row.vatAmount)}</td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}
                        title="Xóa dòng"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 600 }}>
                  <td colSpan={showAccounts ? 7 : 5} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                  <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                    {new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalQuantity)}
                  </td>
                  <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                  <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                    {formatVND(subtotal)}
                  </td>
                  <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
                  <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #e2e8f0" }}>
                    {formatVND(vatTotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Grid Toolbar (Screenshots 1 - 4) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleAddRow}
                style={{
                  height: 28,
                  padding: "0 10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <Plus size={13} style={{ color: "#00b06b" }} /> Thêm dòng
              </button>
              <button
                type="button"
                onClick={() => setItems([])}
                style={{
                  height: 28,
                  padding: "0 10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: "#ef4444",
                  boxSizing: "border-box",
                }}
              >
                <Trash2 size={13} /> Xóa hết dòng
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
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <FileText size={13} /> Thêm ghi chú
              </button>
            </div>
          </div>

          {/* Bottom Area (Screenshots 1 - 4) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 10 }}>
                <div>
                  <label className="misa-purchase-label">Mã tra cứu HĐĐT</label>
                  <input
                    type="text"
                    value={eInvoiceLookupCode}
                    onChange={(e) => setEInvoiceLookupCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      background: "#ffffff",
                    }}
                  />
                </div>
                <div>
                  <label className="misa-purchase-label">Đường dẫn tra cứu HĐĐT</label>
                  <input
                    type="text"
                    value={eInvoiceLookupUrl}
                    onChange={(e) => setEInvoiceLookupUrl(e.target.value)}
                    style={{
                      width: "100%",
                      height: 28,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      boxSizing: "border-box",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Paperclip size={13} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Dung lượng tối đa 5MB</span>
                </div>
                <div
                  style={{
                    border: "1px dashed #cbd5e1",
                    borderRadius: 4,
                    padding: "16px 12px",
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <Upload size={18} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    <span style={{ color: "#00b06b", fontWeight: 600 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Tổng tiền hàng</span>
                <strong>{formatVND(subtotal)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Thuế GTGT</span>
                <span>{formatVND(vatTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#059669" }}>{formatVND(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Screenshots 1 - 4) */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "#334155", fontWeight: 500 }}>
              <div
                onClick={() => setShowAccounts(!showAccounts)}
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 10,
                  background: showAccounts ? "#00b06b" : "#cbd5e1",
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
                    left: showAccounts ? 16 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              <span>Hiển thị tài khoản</span>
            </label>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>|</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>F9 - Thêm nhanh</span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
              style={{
                height: 28,
                padding: "0 14px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
              style={{
                height: 28,
                padding: "0 14px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              Cất
            </button>
            <div style={{ display: "inline-flex", height: 28, borderRadius: 4, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => handleSave(true)}
                style={{
                  height: 28,
                  padding: "0 14px",
                  border: "none",
                  borderRight: "1px solid rgba(255,255,255,0.3)",
                  background: "#00b06b",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cất và In
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                style={{
                  height: 28,
                  width: 24,
                  border: "none",
                  background: "#00b06b",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 6. MODAL: THÊM KỲ ĐỐI CHIẾU CÔNG NỢ (MATCHING SCREENSHOT 3)
// ============================================================================
export interface ReconciliationPeriodModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function ReconciliationPeriodModal({
  onClose,
  onSubmit,
}: ReconciliationPeriodModalProps) {
  const [debtAccount, setDebtAccount] = useState("331 - Phải trả cho người bán");
  const [supplier, setSupplier] = useState("NCC001 - Công ty TNHH Thiết bị Công nghiệp Tân Phát");
  const [templateReport, setTemplateReport] = useState("Mẫu đối chiếu công nợ chi tiết");
  const [fileName, setFileName] = useState("");

  const handleAgree = () => {
    onSubmit({
      debtAccount,
      supplier,
      templateReport,
      fileName: fileName || "Bao_cao_cong_no_NCC.xlsx",
    });
    onClose();
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div style={{ width: 880, maxWidth: "95vw", background: "#ffffff", borderRadius: 6, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", border: "1px solid #cbd5e1" }}>
        {/* Header */}
        <header style={{ height: 44, background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
            Thêm kỳ đối chiếu
          </h3>
          <button type="button" className="misa-invoice-circle-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {/* Content (Screenshot 3) */}
        <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left Column */}
          <div>
            <label className="misa-purchase-label">
              📎 Tệp báo cáo công nợ từ nhà cung cấp (xls, xlsx) <span style={{ color: "#ef4444" }}>*</span>
              <span style={{ float: "right", fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
            </label>

            {/* Dropzone */}
            <div
              style={{
                border: "1.5px solid #00b06b",
                borderRadius: 6,
                background: "#f0fdf4",
                padding: "36px 16px",
                textAlign: "center",
                marginBottom: 16,
                cursor: "pointer",
              }}
              onClick={() => setFileName("Doi_chieu_cong_no_NCC001.xlsx")}
            >
              <Upload size={30} style={{ color: "#00b06b", margin: "0 auto 8px auto" }} />
              <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>
                {fileName ? fileName : (
                  <>
                    <span style={{ color: "#0284c7" }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                  </>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                Định dạng XLS, XLSX (tối đa 5MB)
              </div>
            </div>

            {/* Field: Tài khoản nợ */}
            <div style={{ marginBottom: 14 }}>
              <label className="misa-purchase-label">
                Tài khoản Nợ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={debtAccount}
                onChange={(e) => setDebtAccount(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5 }}
              >
                <option value="331 - Phải trả cho người bán">331 - Phải trả cho người bán</option>
                <option value="3388 - Phải trả, phải nộp khác">3388 - Phải trả, phải nộp khác</option>
              </select>
            </div>

            {/* Field: Nhà cung cấp */}
            <div>
              <label className="misa-purchase-label">
                Nhà cung cấp <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5 }}
              >
                <option value="NCC001 - Công ty TNHH Thiết bị Công nghiệp Tân Phát">NCC001 - Công ty TNHH Thiết bị Công nghiệp Tân Phát</option>
                <option value="NCC002 - Công ty Cổ phần Thép Hòa Phát Hưng Yên">NCC002 - Công ty Cổ phần Thép Hòa Phát Hưng Yên</option>
                <option value="NCC003 - Công ty TNHH Nhập khẩu & Thương mại Sao Nam">NCC003 - Công ty TNHH Nhập khẩu & Thương mại Sao Nam</option>
              </select>
            </div>
          </div>

          {/* Right Column */}
          <div>
            <label className="misa-purchase-label">
              Tệp tải lên giống với mẫu báo cáo nào trên phần mềm? <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              value={templateReport}
              onChange={(e) => setTemplateReport(e.target.value)}
              style={{ width: "100%", height: 32, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, marginBottom: 12 }}
            >
              <option value="Mẫu đối chiếu công nợ chi tiết">Mẫu đối chiếu công nợ chi tiết</option>
              <option value="Mẫu Sổ chi tiết công nợ phải trả NCC">Mẫu Sổ chi tiết công nợ phải trả NCC</option>
              <option value="Mẫu Bảng tổng hợp công nợ NCC theo hóa đơn">Mẫu Bảng tổng hợp công nợ NCC theo hóa đơn</option>
            </select>

            {/* Template image placeholder card */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "24px 16px", textAlign: "center", background: "#f8fafc", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "#e2e8f0", display: "grid", placeItems: "center", color: "#94a3b8", marginBottom: 8 }}>
                <FileSpreadsheet size={24} />
              </div>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Ảnh mẫu báo cáo sẽ hiển thị ở đây sau khi bạn chọn
              </span>
            </div>

            {/* Purple AVA AI banner box */}
            <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "1px solid #ddd6fe", borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", color: "#ffffff", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                <Sparkles size={13} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#5b21b6", lineHeight: 1.4 }}>
                Vui lòng <strong>lựa chọn mẫu giống nhất</strong> với tệp bạn tải lên để <strong>AVA Kế toán</strong> có thể thực hiện đối chiếu chính xác.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 20px" }}>
          <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="misa-invoice-btn-submit" onClick={handleAgree}>
            Đồng ý
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 7. MODAL: THÔNG TIN NHÀ CUNG CẤP (MATCHING SCREENSHOT 4)
// ============================================================================
export interface SupplierModalProps {
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

export function SupplierModal({
  onClose,
  onSubmit,
}: SupplierModalProps) {
  // Radio options
  const [partnerType, setPartnerType] = useState<"org" | "individual">("org");
  const [isCustomer, setIsCustomer] = useState(false);
  const [isInternal, setIsInternal] = useState(false);

  // Master fields
  const [taxCode, setTaxCode] = useState("");
  const [budgetCode, setBudgetCode] = useState("");
  const [supplierCode, setSupplierCode] = useState("NCC00001");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierGroup, setSupplierGroup] = useState("Nhà cung cấp vật tư chính");
  const [address, setAddress] = useState("");
  const [employee, setEmployee] = useState("");

  // Subtabs
  const [activeTab, setActiveTab] = useState<"contact" | "terms" | "bank" | "other_address" | "notes" | "extra">("contact");

  // Contact tab fields
  const [salutation, setSalutation] = useState("Ông");
  const [contactName, setContactName] = useState("");
  const [legalRepresentative, setLegalRepresentative] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleSave = (andNew = false) => {
    onSubmit?.({
      partnerType,
      isCustomer,
      isInternal,
      taxCode,
      budgetCode,
      code: supplierCode,
      phone,
      website,
      name: supplierName,
      supplierGroup,
      address,
      employee,
      salutation,
      contactName,
      legalRepresentative,
      contactEmail,
      contactPhone,
    });
    if (andNew) {
      setSupplierCode(`NCC0000${Math.floor(Math.random() * 90 + 10)}`);
      setSupplierName("");
      setTaxCode("");
      setAddress("");
      setContactName("");
    } else {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div style={{ width: 940, maxWidth: "96vw", background: "#ffffff", borderRadius: 6, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.35)", border: "1px solid #cbd5e1" }}>
        {/* Header (Screenshot 4) */}
        <header style={{ height: 48, background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Thông tin nhà cung cấp
            </h3>

            {/* Radio / Checkbox group */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="supplierPartnerType"
                  checked={partnerType === "org"}
                  onChange={() => setPartnerType("org")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Tổ chức</span>
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="radio"
                  name="supplierPartnerType"
                  checked={partnerType === "individual"}
                  onChange={() => setPartnerType("individual")}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Cá nhân</span>
              </label>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={isCustomer}
                  onChange={(e) => setIsCustomer(e.target.checked)}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Là khách hàng</span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-invoice-circle-btn" title="Trợ giúp"><HelpCircle size={17} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng"><X size={18} /></button>
          </div>
        </header>

        {/* Master Form Area (Screenshot 4) */}
        <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {/* Row 1: MST/CCCD, Mã ĐVQHNS, Mã NCC, Điện thoại, Website */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1.4fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label className="misa-purchase-label">Mã số thuế/CCCD chủ hộ</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 3, border: "1px solid #00b06b", fontSize: 12.5 }}
                />
                <Search size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              </div>
            </div>

            <div>
              <label className="misa-purchase-label">Mã số ĐVQHNS</label>
              <input
                type="text"
                value={budgetCode}
                onChange={(e) => setBudgetCode(e.target.value)}
                style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
              />
            </div>

            <div>
              <label className="misa-purchase-label">Mã nhà cung cấp <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="text"
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5, fontWeight: 600 }}
              />
            </div>

            <div>
              <label className="misa-purchase-label">Điện thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
              />
            </div>

            <div>
              <label className="misa-purchase-label">Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
              />
            </div>
          </div>

          {/* Row 2: Tên NCC & Nhóm NCC */}
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 14, marginBottom: 10 }}>
            <div>
              <label className="misa-purchase-label">Tên nhà cung cấp <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
              />
            </div>

            <div>
              <label className="misa-purchase-label">Nhóm nhà cung cấp</label>
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={supplierGroup}
                  onChange={(e) => setSupplierGroup(e.target.value)}
                  style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                >
                  <option value="Nhà cung cấp vật tư chính">Nhà cung cấp vật tư chính</option>
                  <option value="Nhà cung cấp dịch vụ">Nhà cung cấp dịch vụ</option>
                  <option value="Nhà cung cấp nước ngoài">Nhà cung cấp nước ngoài</option>
                </select>
                <button type="button" style={{ width: 28, height: 28, borderRadius: 3, border: "1px solid #d1d5db", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b" }}><Plus size={14} /></button>
              </div>
            </div>
          </div>

          {/* Row 3: Địa chỉ, Nhân viên mua hàng, Là đối tượng nội bộ */}
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 14 }}>
            <div>
              <label className="misa-purchase-label">Địa chỉ</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="VD: Số 82 Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội"
                style={{ width: "100%", padding: "6px 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5, fontFamily: "inherit" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <label className="misa-purchase-label">Nhân viên mua hàng</label>
                <div style={{ display: "flex", gap: 4 }}>
                  <select
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                    style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  >
                    <option value="">Chọn nhân viên...</option>
                    <option value="Nguyễn Văn A">Nguyễn Văn A</option>
                    <option value="Trần Thị B">Trần Thị B</option>
                  </select>
                  <button type="button" style={{ width: 28, height: 28, borderRadius: 3, border: "1px solid #d1d5db", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b" }}><Plus size={14} /></button>
                </div>
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", color: "#374151" }}>
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  style={{ accentColor: "#00b06b" }}
                />
                <span>Là Đối tượng nội bộ (?)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Subtabs Area (Screenshot 4) */}
        <div style={{ padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: 18, background: "#ffffff" }}>
          {[
            { id: "contact", label: "Thông tin liên hệ" },
            { id: "terms", label: "Điều khoản thanh toán" },
            { id: "bank", label: "Tài khoản ngân hàng" },
            { id: "other_address", label: "Địa chỉ khác" },
            { id: "notes", label: "Ghi chú" },
            { id: "extra", label: "Thông tin bổ sung" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                height: 38,
                background: "transparent",
                border: "none",
                borderBottom: activeTab === t.id ? "2px solid #00b06b" : "none",
                color: activeTab === t.id ? "#00b06b" : "#475569",
                fontSize: 12.5,
                fontWeight: activeTab === t.id ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Subtab Content: Thông tin liên hệ */}
        <div style={{ padding: "16px 20px", minHeight: 180, background: "#ffffff" }}>
          {activeTab === "contact" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 840 }}>
              <div>
                <label className="misa-purchase-label">Người liên hệ</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    value={salutation}
                    onChange={(e) => setSalutation(e.target.value)}
                    style={{ width: 80, height: 28, padding: "0 4px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  >
                    <option value="Ông">Ông</option>
                    <option value="Bà">Bà</option>
                    <option value="Anh">Anh</option>
                    <option value="Chị">Chị</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Họ và tên"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    style={{ flex: 1, height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                  />
                </div>
              </div>

              <div>
                <label className="misa-purchase-label">Đại diện theo PL</label>
                <input
                  type="text"
                  placeholder="Đại diện theo PL"
                  value={legalRepresentative}
                  onChange={(e) => setLegalRepresentative(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                />
              </div>

              <div>
                <label className="misa-purchase-label">Email</label>
                <input
                  type="email"
                  placeholder="contact@nhacungcap.vn"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                />
              </div>

              <div>
                <label className="misa-purchase-label">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="0912 345 678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}
                />
              </div>
            </div>
          )}

          {activeTab === "terms" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 600 }}>
              <div>
                <label className="misa-purchase-label">Điều khoản thanh toán ngầm định</label>
                <select style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }}>
                  <option>Gối đầu 30 ngày</option>
                  <option>Thanh toán ngay</option>
                  <option>Công nợ 45 ngày</option>
                </select>
              </div>
              <div>
                <label className="misa-purchase-label">Số ngày được nợ</label>
                <input type="number" defaultValue={30} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
              </div>
            </div>
          )}

          {activeTab === "bank" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 640 }}>
              <div>
                <label className="misa-purchase-label">Số tài khoản ngân hàng</label>
                <input type="text" placeholder="VD: 1903348199201" style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
              </div>
              <div>
                <label className="misa-purchase-label">Tên ngân hàng</label>
                <input type="text" placeholder="Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)" style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12.5 }} />
              </div>
            </div>
          )}

          {activeTab !== "contact" && activeTab !== "terms" && activeTab !== "bank" && (
            <div style={{ color: "#64748b", fontSize: 13, padding: "20px 0" }}>
              Các trường thông tin bổ sung sẽ được lưu kèm hồ sơ nhà cung cấp.
            </div>
          )}
        </div>

        {/* Footer (Screenshot 4) */}
        <footer style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "0 20px" }}>
          <button type="button" className="misa-invoice-btn-cancel" onClick={onClose}>Hủy</button>
          <button type="button" className="misa-invoice-btn-cancel" onClick={() => handleSave(false)}>Cất</button>
          <button type="button" className="misa-invoice-btn-submit" onClick={() => handleSave(true)}>Cất và Thêm</button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: CHỌN CHỨNG TỪ MUA HÀNG HÓA CẦN NHẬN HÓA ĐƠN (MATCHING IMAGE 1)
// ============================================================================
export interface UninvoicedVoucher {
  id: string;
  postDate: string;
  docDate: string;
  voucherCode: string;
  supplierCode: string;
  supplierName: string;
  description: string;
  amount: number;
}

export interface ReceiveInvoiceSelectModalProps {
  onClose: () => void;
  onSubmit: (selectedVouchers: UninvoicedVoucher[]) => void;
  onOpenSupplierModal?: () => void;
}

export function ReceiveInvoiceSelectModal({
  onClose,
  onSubmit,
}: ReceiveInvoiceSelectModalProps) {
  // Master Filters
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [reportPeriod, setReportPeriod] = useState<string>("Tháng này");
  const [fromDate, setFromDate] = useState<string>("01/09/2026");
  const [toDate, setToDate] = useState<string>("30/09/2026");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sample vouchers available for receiving invoice
  const [vouchers] = useState<UninvoicedVoucher[]>([
    {
      id: "nk-01",
      postDate: "29/09/2026",
      docDate: "29/09/2026",
      voucherCode: "NK00001",
      supplierCode: "NCC001",
      supplierName: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      description: "Mua thép cuộn mạ kẽm Ø6 và phụ kiện cơ khí",
      amount: 23650000,
    },
    {
      id: "nk-02",
      postDate: "22/09/2026",
      docDate: "22/09/2026",
      voucherCode: "NK00002",
      supplierCode: "NCC002",
      supplierName: "Công ty Cổ phần Thép Hòa Phát Hưng Yên",
      description: "Mua hàng nhập kho ống thép đúc phi 90",
      amount: 88500000,
    },
    {
      id: "nk-03",
      postDate: "15/09/2026",
      docDate: "15/09/2026",
      voucherCode: "NK00003",
      supplierCode: "NCC003",
      supplierName: "Công ty TNHH Nhập khẩu & Thương mại Sao Nam",
      description: "Mua linh kiện, bulong nở inox M12x100",
      amount: 14200000,
    },
    {
      id: "nk-04",
      postDate: "08/09/2026",
      docDate: "08/09/2026",
      voucherCode: "NK00004",
      supplierCode: "NCC001",
      supplierName: "Công ty TNHH Thiết bị Công nghiệp Tân Phát",
      description: "Mua sơn chống rỉ Alkyd xám 20L",
      amount: 7850000,
    },
  ]);

  // Selected voucher IDs
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter vouchers according to supplier & keyword
  const filteredVouchers = vouchers.filter((v) => {
    if (selectedSupplier && selectedSupplier !== "ALL" && v.supplierCode !== selectedSupplier) {
      return false;
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const matchCode = v.voucherCode.toLowerCase().includes(q);
      const matchDesc = v.description.toLowerCase().includes(q);
      const matchSupplier = v.supplierName.toLowerCase().includes(q);
      const matchDate = v.postDate.includes(q) || v.docDate.includes(q);
      if (!matchCode && !matchDesc && !matchSupplier && !matchDate) return false;
    }
    return true;
  });

  const isAllSelected =
    filteredVouchers.length > 0 &&
    filteredVouchers.every((v) => selectedIds.includes(v.id));

  const handleToggleAll = () => {
    if (isAllSelected) {
      const filteredIdSet = new Set(filteredVouchers.map((v) => v.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...filteredVouchers.map((v) => v.id)]);
      setSelectedIds(Array.from(newIds));
    }
    setValidationError(null);
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setValidationError(null);
  };

  const handleFetchData = () => {
    // Refresh / reload filtered data simulation
    setValidationError(null);
  };

  const handleConfirm = () => {
    const chosen = vouchers.filter((v) => selectedIds.includes(v.id));
    if (chosen.length === 0) {
      setValidationError("Vui lòng chọn ít nhất một chứng từ mua hàng cần nhận hóa đơn.");
      return;
    }
    onSubmit(chosen);
  };

  const selectedCount = selectedIds.length;
  const selectedTotal = vouchers
    .filter((v) => selectedIds.includes(v.id))
    .reduce((sum, v) => sum + v.amount, 0);

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
          width: 900,
          maxWidth: "96vw",
          height: "85vh",
          maxHeight: 650,
          background: "#ffffff",
          borderRadius: 8,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header (Screenshot 1) */}
        <header
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Chọn chứng từ mua hàng hóa cần nhận hóa đơn
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#00b06b",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
              title="Xem hướng dẫn nhận hóa đơn từ chứng từ mua hàng"
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn</span>
            </div>
            <button
              type="button"
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: 2,
              }}
              title="Trợ giúp"
            >
              <HelpCircle size={17} />
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: 2,
              }}
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Filters Section (Screenshot 1) */}
        <div style={{ padding: "14px 18px 10px 18px", background: "#ffffff" }}>
          {/* Row 1: Nhà cung cấp with green border */}
          <div style={{ marginBottom: 10 }}>
            <label
              style={{
                display: "block",
                fontSize: 12.5,
                color: "#334155",
                marginBottom: 4,
                fontWeight: 500,
              }}
            >
              Nhà cung cấp
            </label>
            <div style={{ position: "relative" }}>
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value);
                  setValidationError(null);
                }}
                style={{
                  width: "100%",
                  height: 30,
                  padding: "0 28px 0 10px",
                  borderRadius: 4,
                  border: "1.5px solid #00b06b",
                  outline: "none",
                  fontSize: 13,
                  color: selectedSupplier ? "#1e293b" : "#475569",
                  background: "#ffffff",
                  appearance: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">-- Tất cả nhà cung cấp --</option>
                <option value="ALL">Tất cả nhà cung cấp</option>
                {SAMPLE_SUPPLIERS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
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
          </div>

          {/* Row 2: Kỳ báo cáo | Từ ngày | Đến ngày | Lấy dữ liệu */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 4 }}>
                Kỳ báo cáo
              </label>
              <div style={{ position: "relative", width: 170 }}>
                <select
                  value={reportPeriod}
                  onChange={(e) => {
                    const p = e.target.value;
                    setReportPeriod(p);
                    if (p === "Tháng này") {
                      setFromDate("01/09/2026");
                      setToDate("30/09/2026");
                    } else if (p === "Tháng trước") {
                      setFromDate("01/08/2026");
                      setToDate("31/08/2026");
                    } else if (p === "Quý này") {
                      setFromDate("01/07/2026");
                      setToDate("30/09/2026");
                    } else if (p === "Năm nay") {
                      setFromDate("01/01/2026");
                      setToDate("31/12/2026");
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 24px 0 8px",
                    borderRadius: 3,
                    border: "1px solid #d1d5db",
                    fontSize: 12.5,
                    color: "#1e293b",
                    background: "#ffffff",
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Hôm nay">Hôm nay</option>
                  <option value="Tuần này">Tuần này</option>
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
                <ChevronDown
                  size={13}
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
              <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 4 }}>
                Từ ngày
              </label>
              <div style={{ position: "relative", width: 130 }}>
                <input
                  type="text"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 26px 0 8px",
                    borderRadius: 3,
                    border: "1px solid #d1d5db",
                    fontSize: 12.5,
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                />
                <Calendar
                  size={13}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#334155", marginBottom: 4 }}>
                Đến ngày
              </label>
              <div style={{ position: "relative", width: 130 }}>
                <input
                  type="text"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: 28,
                    padding: "0 26px 0 8px",
                    borderRadius: 3,
                    border: "1px solid #d1d5db",
                    fontSize: 12.5,
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                />
                <Calendar
                  size={13}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchData}
              style={{
                height: 28,
                padding: "0 14px",
                borderRadius: 3,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
            >
              Lấy dữ liệu
            </button>
          </div>

          {/* Row 3: Nhập từ khóa tìm kiếm */}
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 28,
                padding: "0 30px 0 10px",
                borderRadius: 3,
                border: "1px solid #d1d5db",
                fontSize: 12.5,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <Search
              size={14}
              style={{
                position: "absolute",
                right: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Validation warning if any */}
        {validationError && (
          <div
            style={{
              padding: "6px 18px",
              background: "#fee2e2",
              color: "#b91c1c",
              fontSize: 12,
              fontWeight: 500,
              borderTop: "1px solid #fecaca",
            }}
          >
            {validationError}
          </div>
        )}

        {/* Table Section (Header #e6f4ea matching Image 1) */}
        <div style={{ flex: 1, overflow: "auto", borderTop: "1px solid #e2e8f0" }}>
          <table
            className="misa-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              whiteSpace: "nowrap",
            }}
          >
            <thead>
              <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  style={{
                    width: 40,
                    textAlign: "center",
                    padding: "8px 6px",
                    borderRight: "1px solid #d1d5db",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleAll}
                    style={{ cursor: "pointer" }}
                  />
                </th>
                <th
                  style={{
                    width: 120,
                    padding: "8px 10px",
                    textAlign: "left",
                    borderRight: "1px solid #d1d5db",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Ngày hạch toán
                </th>
                <th
                  style={{
                    width: 120,
                    padding: "8px 10px",
                    textAlign: "left",
                    borderRight: "1px solid #d1d5db",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Ngày chứng từ
                </th>
                <th
                  style={{
                    width: 130,
                    padding: "8px 10px",
                    textAlign: "left",
                    borderRight: "1px solid #d1d5db",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Số chứng từ
                </th>
                <th
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    borderRight: "1px solid #d1d5db",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Diễn giải
                </th>
                <th
                  style={{
                    width: 140,
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Số tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "36px 20px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: 13,
                    }}
                  >
                    Không tìm thấy chứng từ mua hàng nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => {
                  const isChecked = selectedIds.includes(v.id);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => handleToggleRow(v.id)}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isChecked ? "rgba(0, 176, 107, 0.08)" : "#ffffff",
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isChecked) e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (!isChecked) e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      <td
                        style={{
                          textAlign: "center",
                          padding: "8px 6px",
                          borderRight: "1px solid #f1f5f9",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(v.id)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderRight: "1px solid #f1f5f9",
                          color: "#334155",
                        }}
                      >
                        {v.postDate}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderRight: "1px solid #f1f5f9",
                          color: "#334155",
                        }}
                      >
                        {v.docDate}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderRight: "1px solid #f1f5f9",
                          color: "#0284c7",
                          fontWeight: 600,
                        }}
                      >
                        {v.voucherCode}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderRight: "1px solid #f1f5f9",
                          color: "#334155",
                        }}
                      >
                        <div>{v.description}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                          {v.supplierName}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "#0f172a",
                        }}
                      >
                        {formatVND(v.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer (Screenshot 1: Hủy & Đồng ý) */}
        <footer
          style={{
            height: 48,
            padding: "0 18px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 12.5, color: "#64748b" }}>
            {selectedCount > 0 ? (
              <span>
                Đã chọn: <strong style={{ color: "#00b06b" }}>{selectedCount}</strong> chứng từ —
                Tổng tiền:{" "}
                <strong style={{ color: "#00b06b" }}>{formatVND(selectedTotal)} đ</strong>
              </span>
            ) : (
              <span>Chưa chọn chứng từ nào</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 30,
                padding: "0 18px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                height: 30,
                padding: "0 22px",
                borderRadius: 4,
                border: "none",
                background: "#00b06b",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#00965b")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#00b06b")}
            >
              Đồng ý
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 10. MODAL: CHỨNG TỪ MUA DỊCH VỤ (MATCHING SCREENSHOT 3)
// ============================================================================
// 10. MODAL: CHỨNG TỪ MUA DỊCH VỤ (SERVICE PURCHASE VOUCHER)
// Matching all 4 user screenshots: Unpaid (MDV00001), Paid (PC00001), Payment dropdown, Invoice dropdown
// ============================================================================
export interface PurchaseServiceItem {
  id: string;
  serviceCode: string;
  serviceName: string;
  expenseAccount: string;
  debtAccount: string;
  cashAccount?: string;
  partnerCode: string;
  partnerName: string;
  unit: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: number;
}

export interface PurchaseServiceModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseServiceModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseServiceModalProps) {
  // Top bar options
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<string>("Tiền mặt");
  const [invoiceOption, setInvoiceOption] = useState<string>("Nhận kèm hóa đơn");
  const [isPurchaseExpense, setIsPurchaseExpense] = useState<boolean>(false);

  // Dropdown menus visibility
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState<boolean>(false);
  const [showInvoiceOptionDropdown, setShowInvoiceOptionDropdown] = useState<boolean>(false);

  // Master fields - Unpaid & Shared
  const [supplierCode, setSupplierCode] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [purchaser, setPurchaser] = useState<string>("");
  const [description, setDescription] = useState<string>("Mua dịch vụ");
  const [contractSearch, setContractSearch] = useState<string>("");
  const [debtDays, setDebtDays] = useState<string | number>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [postDate, setPostDate] = useState<string>("02/10/2026");
  const [docDate, setDocDate] = useState<string>("02/10/2026");
  const [voucherCode, setVoucherCode] = useState<string>("MDV00001");

  // Master fields - Paid (Phiếu chi)
  const [recipient, setRecipient] = useState<string>("");
  const [paymentReason, setPaymentReason] = useState<string>("Chi tiền mua dịch vụ");
  const [attachedCount, setAttachedCount] = useState<string | number>("");
  const [paymentVoucherCode, setPaymentVoucherCode] = useState<string>("PC00001");
  const [paymentPostDate, setPaymentPostDate] = useState<string>("02/10/2026");
  const [paymentDocDate, setPaymentDocDate] = useState<string>("02/10/2026");

  // Detail tabs & options
  const [activeTab, setActiveTab] = useState<"accounting" | "tax">("accounting");
  const [discountPolicy, setDiscountPolicy] = useState<string>("Không chiết khấu");
  const [showAccount, setShowAccount] = useState<boolean>(true);
  const [showRefModal, setShowRefModal] = useState<boolean>(false);
  const [ecommercePlatform, setEcommercePlatform] = useState<string>("");
  const [shopName, setShopName] = useState<string>("");

  const parseVnNumber = (v: any): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  };

  // Grid rows
  const [items, setItems] = useState<PurchaseServiceItem[]>([
    {
      id: "srv-1",
      serviceCode: "",
      serviceName: "",
      expenseAccount: "",
      debtAccount: "331",
      cashAccount: "111",
      partnerCode: "",
      partnerName: "",
      unit: "",
      quantity: "1,00",
      unitPrice: "0,00",
      amount: 0,
    },
  ]);

  const handleSupplierChange = (code: string) => {
    setSupplierCode(code);
    const sup = SAMPLE_SUPPLIERS.find((s) => s.code === code);
    if (sup) {
      setSupplierName(sup.name);
      setAddress(sup.address);
      setDebtDays(sup.debtDays || 30);
    }
  };

  const handlePaymentStatusChange = (status: "unpaid" | "paid") => {
    setPaymentStatus(status);
    if (status === "unpaid") {
      setVoucherCode("MDV00001");
    } else {
      const code = (paymentMethod === "Ủy nhiệm chi" || paymentMethod === "Séc chuyển khoản") ? "UNC00001" : "PC00001";
      setPaymentVoucherCode(code);
    }
  };

  const handleSelectPaymentMethod = (method: string) => {
    setPaymentMethod(method);
    setShowPaymentMethodDropdown(false);
    const code = (method === "Ủy nhiệm chi" || method === "Séc chuyển khoản") ? "UNC00001" : "PC00001";
    setPaymentVoucherCode(code);
    const cashAcc = (method === "Ủy nhiệm chi" || method === "Séc chuyển khoản") ? "1121" : "111";
    setItems((prev) => prev.map((row) => ({ ...row, cashAccount: cashAcc })));
  };

  const handleSelectInvoiceOption = (opt: string) => {
    setInvoiceOption(opt);
    setShowInvoiceOptionDropdown(false);
  };

  const handleItemChange = (idx: number, field: keyof PurchaseServiceItem, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === "serviceCode") {
        const found = SAMPLE_ITEMS.find((it) => it.code === val);
        if (found) {
          next[idx].serviceName = found.name;
          next[idx].unit = found.unit;
          next[idx].unitPrice = found.price.toLocaleString("vi-VN", { minimumFractionDigits: 2 });
          next[idx].amount = parseVnNumber(next[idx].quantity) * found.price;
        }
      }
      if (field === "partnerCode") {
        const foundSup = SAMPLE_SUPPLIERS.find((s) => s.code === val);
        if (foundSup) {
          next[idx].partnerName = foundSup.name;
        }
      }
      if (field === "quantity" || field === "unitPrice") {
        const q = field === "quantity" ? parseVnNumber(val) : parseVnNumber(next[idx].quantity);
        const p = field === "unitPrice" ? parseVnNumber(val) : parseVnNumber(next[idx].unitPrice);
        next[idx].amount = q * p;
      }
      return next;
    });
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `srv-${Date.now()}`,
        serviceCode: "",
        serviceName: "",
        expenseAccount: "",
        debtAccount: "331",
        cashAccount: (paymentMethod === "Ủy nhiệm chi" || paymentMethod === "Séc chuyển khoản") ? "1121" : "111",
        partnerCode: "",
        partnerName: "",
        unit: "",
        quantity: "1,00",
        unitPrice: "0,00",
        amount: 0,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `srv-${Date.now()}`,
          serviceCode: "",
          serviceName: "",
          expenseAccount: "",
          debtAccount: "331",
          cashAccount: (paymentMethod === "Ủy nhiệm chi" || paymentMethod === "Séc chuyển khoản") ? "1121" : "111",
          partnerCode: "",
          partnerName: "",
          unit: "",
          quantity: "1,00",
          unitPrice: "0,00",
          amount: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAllRows = () => {
    setItems([
      {
        id: `srv-${Date.now()}`,
        serviceCode: "",
        serviceName: "",
        expenseAccount: "",
        debtAccount: "331",
        cashAccount: (paymentMethod === "Ủy nhiệm chi" || paymentMethod === "Séc chuyển khoản") ? "1121" : "111",
        partnerCode: "",
        partnerName: "",
        unit: "",
        quantity: "1,00",
        unitPrice: "0,00",
        amount: 0,
      },
    ]);
  };

  const totalService = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const taxAmount = invoiceOption === "Nhận kèm hóa đơn" ? Math.round(totalService * 0.1) : 0;
  const totalGrand = totalService + taxAmount;

  const currentHeaderCode = paymentStatus === "unpaid" ? voucherCode : paymentVoucherCode;

  const handleSave = (andClose = true) => {
    onSubmit({
      kind: "service_purchase",
      voucherCode: currentHeaderCode,
      postDate: paymentStatus === "unpaid" ? postDate : paymentPostDate,
      docDate: paymentStatus === "unpaid" ? docDate : paymentDocDate,
      supplierCode,
      supplierName,
      address,
      recipient,
      description: paymentStatus === "unpaid" ? description : paymentReason,
      paymentOption: paymentStatus,
      paymentMethod,
      invoiceOption,
      isPurchaseExpense,
      totalService,
      taxAmount,
      grandTotal: totalGrand,
      items,
    });
    if (andClose) {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Header (Screenshot 1 & 2) */}
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
              Chứng từ mua dịch vụ {currentHeaderCode}
            </h2>

            {/* Settings button */}
            <button
              type="button"
              className="misa-invoice-circle-btn"
              style={{ marginLeft: 2 }}
              title="Thiết lập mẫu"
            >
              <Settings size={14} />
            </button>

            {/* Lập từ hợp đồng mua */}
            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Lập từ hợp đồng mua"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 175, background: "transparent" }}
              />
              <Search size={14} style={{ color: "#64748b" }} />
              <ChevronDown size={14} style={{ color: "#64748b" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn" title="Phím tắt"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" title="Thiết lập"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose} title="Đóng"><X size={18} /></button>
          </div>
        </header>

        {/* Option Bar (Screenshot 1, 2, 3, 4) */}
        <div
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              <input
                type="radio"
                name="servicePurchasePayment"
                checked={paymentStatus === "unpaid"}
                onChange={() => handlePaymentStatusChange("unpaid")}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Chưa thanh toán</span>
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              <input
                type="radio"
                name="servicePurchasePayment"
                checked={paymentStatus === "paid"}
                onChange={() => handlePaymentStatusChange("paid")}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Thanh toán ngay</span>
            </label>

            {/* Custom Payment Method Dropdown (Matching Screenshot 3) */}
            <div style={{ position: "relative" }}>
              <div
                data-testid="service-payment-method-selector"
                onClick={() => {
                  if (paymentStatus === "paid") {
                    setShowPaymentMethodDropdown(!showPaymentMethodDropdown);
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  height: 28,
                  minWidth: 120,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: showPaymentMethodDropdown ? "1.5px solid #00b06b" : "1px solid #cbd5e1",
                  background: paymentStatus === "unpaid" ? "#f8fafc" : "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: paymentStatus === "unpaid" ? "#94a3b8" : "#0f172a",
                  cursor: paymentStatus === "unpaid" ? "not-allowed" : "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ color: paymentStatus === "paid" ? "#2563eb" : "inherit", fontWeight: paymentStatus === "paid" ? 600 : 500 }}>
                  {paymentMethod}
                </span>
                {showPaymentMethodDropdown ? (
                  <ChevronUp size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "#64748b" }} />
                )}
              </div>

              {/* Popup Menu */}
              {showPaymentMethodDropdown && (
                <>
                  <div
                    onClick={() => setShowPaymentMethodDropdown(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 110 }}
                  />
                  <div
                    data-testid="service-payment-dropdown-menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#ffffff",
                      border: "1px solid #00b06b",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      zIndex: 120,
                      minWidth: 150,
                      overflow: "hidden",
                    }}
                  >
                    {[
                      "Tiền mặt",
                      "Ủy nhiệm chi",
                      "Séc chuyển khoản",
                      "Séc tiền mặt",
                    ].map((m) => {
                      const isSelected = paymentMethod === m;
                      return (
                        <div
                          key={m}
                          onClick={() => handleSelectPaymentMethod(m)}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#ffffff" : "#1e293b",
                            background: isSelected ? "#00b06b" : "#ffffff",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00b06b";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#ffffff";
                              e.currentTarget.style.color = "#1e293b";
                            }
                          }}
                        >
                          {m}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Custom Invoice Option Dropdown (Matching Screenshot 4 / media_1790912466058) */}
            <div style={{ position: "relative" }}>
              <div
                data-testid="service-invoice-option-selector"
                onClick={() => setShowInvoiceOptionDropdown(!showInvoiceOptionDropdown)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  height: 28,
                  minWidth: 160,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: showInvoiceOptionDropdown ? "1.5px solid #00b06b" : "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#0f172a",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ color: "#2563eb", fontWeight: 600 }}>
                  {invoiceOption}
                </span>
                {showInvoiceOptionDropdown ? (
                  <ChevronUp size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "#64748b" }} />
                )}
              </div>

              {/* Popup Menu */}
              {showInvoiceOptionDropdown && (
                <>
                  <div
                    onClick={() => setShowInvoiceOptionDropdown(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 110 }}
                  />
                  <div
                    data-testid="service-invoice-dropdown-menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#ffffff",
                      border: "1px solid #00b06b",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      zIndex: 120,
                      minWidth: 160,
                      overflow: "hidden",
                    }}
                  >
                    {[
                      "Nhận kèm hóa đơn",
                      "Không kèm hóa đơn",
                      "Không có hóa đơn",
                    ].map((opt) => {
                      const isSelected = invoiceOption === opt;
                      return (
                        <div
                          key={opt}
                          onClick={() => handleSelectInvoiceOption(opt)}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#ffffff" : "#1e293b",
                            background: isSelected ? "#00b06b" : "#ffffff",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00b06b";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#ffffff";
                              e.currentTarget.style.color = "#1e293b";
                            }
                          }}
                        >
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "#374151" }}>
              <input
                type="checkbox"
                checked={isPurchaseExpense}
                onChange={(e) => setIsPurchaseExpense(e.target.checked)}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Là chi phí mua hàng</span>
            </label>
          </div>
        </div>

        {/* Master Form Area (Screenshot 1 & 2) */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Left form fields */}
            <div>
              {/* Common Row 1: Mã NCC & Tên NCC */}
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 8 }}>
                <div>
                  <label className="misa-purchase-label">Mã nhà cung cấp</label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <select
                        value={supplierCode}
                        onChange={(e) => handleSupplierChange(e.target.value)}
                        style={{
                          width: "100%",
                          height: 28,
                          padding: "0 22px 0 6px",
                          borderRadius: 4,
                          border: "1px solid #cbd5e1",
                          fontSize: 12.5,
                          background: "#ffffff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      >
                        <option value=""></option>
                        {SAMPLE_SUPPLIERS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#64748b" }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenSupplierModal && onOpenSupplierModal()}
                      style={{ width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", color: "#00b06b", cursor: "pointer", display: "grid", placeItems: "center", boxSizing: "border-box" }}
                      title="Thêm nhanh nhà cung cấp"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      style={{ width: 28, height: 28, minWidth: 28, padding: 0, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, boxSizing: "border-box" }}
                      title="Số dư công nợ"
                    >
                      <DollarSign size={13} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="misa-purchase-label">Tên nhà cung cấp</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* CASE A: CHƯA THANH TOÁN (Screenshot 1) */}
              {paymentStatus === "unpaid" && (
                <>
                  {/* Row 2: Địa chỉ (full width) */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Địa chỉ</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Row 3: Nhân viên mua hàng & Diễn giải */}
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={purchaser}
                          onChange={(e) => setPurchaser(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box", appearance: "none", WebkitAppearance: "none" }}
                        >
                          <option value=""></option>
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          title="Thêm nhân viên"
                          onClick={() => {
                            const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                            if (newEmp) setPurchaser(newEmp);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="misa-purchase-label">Diễn giải</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        />
                        <div
                          title="AVA AI Gợi ý diễn giải"
                          onClick={() => setDescription("Mua dịch vụ")}
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                        >
                          <Sparkles size={14} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>

                  {/* Row 5: Điều khoản thanh toán */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>▾ Điều khoản thanh toán</span>
                      <button
                        type="button"
                        title="Thêm điều khoản thanh toán"
                        onClick={() => {
                          const d = prompt("Nhập số ngày được nợ mới:", String(debtDays));
                          if (d) setDebtDays(d);
                        }}
                        style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>Số ngày được nợ</span>
                      <input
                        type="text"
                        value={debtDays}
                        onChange={(e) => setDebtDays(e.target.value)}
                        style={{ width: 55, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>Hạn thanh toán</span>
                      <div style={{ position: "relative", width: 130 }}>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 24px 0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                        <Calendar size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* CASE B: THANH TOÁN NGAY (Screenshot 2) */}
              {paymentStatus === "paid" && (
                <>
                  {/* Row 2: Người nhận & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Người nhận</label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Lý do chi (full width) */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Lý do chi</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentReason}
                        onChange={(e) => setPaymentReason(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <div
                        title="AVA AI Gợi ý lý do chi"
                        onClick={() => setPaymentReason("Chi tiền mua dịch vụ")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                      >
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Nhân viên mua hàng & Kèm theo chứng từ gốc */}
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={purchaser}
                          onChange={(e) => setPurchaser(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        >
                          <option value=""></option>
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          title="Thêm nhân viên"
                          onClick={() => {
                            const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                            if (newEmp) setPurchaser(newEmp);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28 }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                      <input
                        type="text"
                        placeholder="Số lượng"
                        value={attachedCount}
                        onChange={(e) => setAttachedCount(e.target.value)}
                        style={{ width: 90, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                      />
                      <span style={{ fontSize: 12, color: "#374151" }}>chứng từ gốc</span>
                    </div>
                  </div>

                  {/* Row 5: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right side: Tổng tiền thanh toán & Right inputs */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18 }}>
              <div style={{ textAlign: "right", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>
                  {totalGrand === 0 ? "0" : formatVND(totalGrand)}
                </strong>
              </div>

              {/* Case A: Chưa thanh toán */}
              {paymentStatus === "unpaid" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={postDate}
                        onChange={(e) => setPostDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số chứng từ</label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Case B: Thanh toán ngay */}
              {paymentStatus === "paid" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentPostDate}
                        onChange={(e) => setPaymentPostDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">
                      {paymentMethod === "Ủy nhiệm chi" ? "Ngày ủy nhiệm chi" : "Ngày phiếu chi"}
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentDocDate}
                        onChange={(e) => setPaymentDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">
                      {paymentMethod === "Ủy nhiệm chi" ? "Số ủy nhiệm chi" : "Số phiếu chi"}
                    </label>
                    <input
                      type="text"
                      value={paymentVoucherCode}
                      onChange={(e) => setPaymentVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail Tabs Bar & Table Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          {/* Detail Grid Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
              borderBottom: "1px solid #e2e8f0",
              background: "#ffffff",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: 18 }}>
              <button
                type="button"
                onClick={() => setActiveTab("accounting")}
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "accounting" ? "2px solid #00b06b" : "none",
                  color: activeTab === "accounting" ? "#00b06b" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hạch toán
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tax")}
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "tax" ? "2px solid #00b06b" : "none",
                  color: activeTab === "tax" ? "#00b06b" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Thuế
              </button>
            </div>

            {/* Right Tools: AVA Kế toán & Chiết khấu */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
                  color: "#6d28d9",
                  border: "1px solid #ddd6fe",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={13} />
                <span>AVA Kế toán</span>
                <ChevronDown size={12} />
              </button>

              <span style={{ fontSize: 12, color: "#475569" }}>Chiết khấu</span>
              <select
                value={discountPolicy}
                onChange={(e) => setDiscountPolicy(e.target.value)}
                style={{ height: 26, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12 }}
              >
                <option value="Không chiết khấu">Không chiết khấu</option>
                <option value="Chiết khấu dòng">Chiết khấu theo dòng</option>
              </select>
            </div>
          </div>

          {/* Table Area (Screenshot 1 & 2) */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 115 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Pin size={11} />
                      <span>{paymentStatus === "unpaid" ? "Mã dịch vụ" : "Mã hàng"}</span>
                    </div>
                  </th>
                  <th>Tên dịch vụ</th>
                  {showAccount && <th style={{ width: 125, textAlign: "center" }}>TK chi phí/TK kho</th>}
                  {showAccount && (
                    <th style={{ width: 95, textAlign: "center" }}>
                      {paymentStatus === "unpaid" ? "TK Công nợ" : "TK tiền"}
                    </th>
                  )}
                  <th style={{ width: 100 }}>Đối tượng</th>
                  <th style={{ width: 150 }}>Tên đối tượng</th>
                  <th style={{ width: 65, textAlign: "center" }}>ĐVT</th>
                  <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                  <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                  <th style={{ width: 36, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        value={row.serviceCode}
                        onChange={(e) => handleItemChange(idx, "serviceCode", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.serviceName}
                        onChange={(e) => handleItemChange(idx, "serviceName", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    {showAccount && (
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          value={row.expenseAccount}
                          onChange={(e) => handleItemChange(idx, "expenseAccount", e.target.value)}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "center" }}
                        />
                      </td>
                    )}
                    {showAccount && (
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          value={paymentStatus === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                          onChange={(e) => {
                            if (paymentStatus === "unpaid") {
                              handleItemChange(idx, "debtAccount", e.target.value);
                            } else {
                              handleItemChange(idx, "cashAccount", e.target.value);
                            }
                          }}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "center" }}
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="text"
                        value={row.partnerCode}
                        onChange={(e) => handleItemChange(idx, "partnerCode", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.partnerName}
                        onChange={(e) => handleItemChange(idx, "partnerName", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "center" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {row.amount === 0 ? "0" : formatVND(row.amount)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 600, fontSize: 12.5, color: "#1e293b", borderTop: "1px solid #e2e8f0" }}>
                  <td colSpan={3} style={{ padding: "6px 10px" }}>
                    Tổng số: {items.length}
                  </td>
                  <td colSpan={showAccount ? 5 : 3}></td>
                  <td style={{ textAlign: "right", padding: "6px 10px" }}>
                    {items.reduce((s, it) => s + parseVnNumber(it.quantity), 0).toFixed(2).replace(".", ",")}
                  </td>
                  <td></td>
                  <td style={{ textAlign: "right", padding: "6px 10px" }}>
                    {totalService === 0 ? "0" : formatVND(totalService)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Grid Toolbar: Thêm dòng / Thêm ghi chú / Xóa hết dòng */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleAddRow}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
              >
                <Plus size={13} /> Thêm dòng
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
              >
                <FileText size={13} /> Thêm ghi chú
              </button>
              <button
                type="button"
                onClick={handleClearAllRows}
                style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}
              >
                <Trash2 size={13} /> Xóa hết dòng
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
              <span>Số dòng/trang</span>
              <select style={{ height: 24, padding: "0 4px", fontSize: 12, borderRadius: 3, border: "1px solid #cbd5e1", background: "#fff" }}>
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

          {/* Bottom Area: E-commerce, Attachment & Summary (Screenshot 1 & 2) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, padding: "12px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* E-commerce inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "160px 180px", gap: 12 }}>
                <div>
                  <label className="misa-purchase-label" style={{ fontSize: 11.5 }}>Sàn thương mại điện tử</label>
                  <select
                    value={ecommercePlatform}
                    onChange={(e) => setEcommercePlatform(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12 }}
                  >
                    <option value=""></option>
                    <option value="Shopee">Shopee</option>
                    <option value="Lazada">Lazada</option>
                    <option value="Tiki">Tiki</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                  </select>
                </div>
                <div>
                  <label className="misa-purchase-label" style={{ fontSize: 11.5 }}>Tên shop</label>
                  <select
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    style={{ width: "100%", height: 26, padding: "0 6px", borderRadius: 3, border: "1px solid #d1d5db", fontSize: 12 }}
                  >
                    <option value=""></option>
                    <option value="Shop Chính Thức">Shop Chính Thức</option>
                    <option value="Minh An Mall">Minh An Mall</option>
                  </select>
                </div>
              </div>

              {/* Attachment */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                <Paperclip size={13} style={{ color: "#64748b" }} />
                <span style={{ fontWeight: 600 }}>Đính kèm</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
              </div>
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "20px 16px",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  maxWidth: 420,
                }}
              >
                <Upload size={18} style={{ color: "#0284c7", marginBottom: 4 }} />
                <div style={{ fontSize: 12, color: "#0284c7" }}>
                  <strong>Chọn tệp</strong> hoặc kéo và thả tệp vào đây
                </div>
              </div>
            </div>

            {/* Totals Summary (Screenshot 1 & 2) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155" }}>
                <span>Tổng tiền dịch vụ</span>
                <strong>{totalService === 0 ? "0" : formatVND(totalService)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155" }}>
                <span>Thuế GTGT</span>
                <span>{taxAmount === 0 ? "0" : formatVND(taxAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700, marginTop: 4 }}>
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#0f172a", fontWeight: 800 }}>{totalGrand === 0 ? "0" : formatVND(totalGrand)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (Screenshot 1 & 2) */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              onClick={() => setShowAccount(!showAccount)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <div
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 10,
                  background: showAccount ? "#00b06b" : "#cbd5e1",
                  position: "relative",
                  transition: "background 0.2s",
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
                    left: showAccount ? 16 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#334155" }}>Hiển thị tài khoản</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
            >
              Cất
            </button>
            <button
              type="button"
              className="misa-invoice-btn-submit"
              onClick={() => handleSave(true)}
            >
              Cất và Đóng
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 11. MODAL: CHỨNG TỪ MUA HÀNG NHIỀU HÓA ĐƠN (MATCHING SCREENSHOT 4)
// ============================================================================
export interface PurchaseMultiInvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  stockCode: string;
  stockAccount: string;
  expenseAccount: string;
  debtAccount: string;
  cashAccount: string;
  partnerCode: string;
  partnerName: string;
  unit: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: number;
  purchaseExpense?: number;
}

export interface PurchaseMultiInvoiceModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenSupplierModal?: () => void;
}

export function PurchaseMultiInvoiceModal({
  onClose,
  onSubmit,
  onOpenSupplierModal,
}: PurchaseMultiInvoiceModalProps) {
  // Top bar options
  const [purchaseKind, setPurchaseKind] = useState<PurchaseVoucherTemplate>(
    "Mua hàng trong nước nhập kho"
  );
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [contractSearch, setContractSearch] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<string>("Tiền mặt");
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);

  // Checks for kind of purchase
  const isWarehouse = purchaseKind.includes("nhập kho");
  const isImport = purchaseKind.includes("nhập khẩu");

  // Sub-tab selection: "receipt" (Phiếu nhập), "debit" (Chứng từ ghi nợ), or "payment" (Phiếu chi / UNC)
  const [activeSubTab, setActiveSubTab] = useState<"receipt" | "debit" | "payment">("receipt");

  // Master fields - General & Phiếu nhập / Ghi nợ
  const [deliverer, setDeliverer] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [description, setDescription] = useState<string>("Mua hàng");
  const [purchaser, setPurchaser] = useState<string>("");
  const [attachedCount, setAttachedCount] = useState<string | number>("");
  const [debtDays, setDebtDays] = useState<string | number>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [postDate, setPostDate] = useState<string>("02/10/2026 09:22:01");
  const [docDate, setDocDate] = useState<string>("02/10/2026");
  const [voucherCode, setVoucherCode] = useState<string>("NK00001");

  // Master fields - Phiếu chi
  const [recipient, setRecipient] = useState<string>("");
  const [paymentReason, setPaymentReason] = useState<string>("Chi tiền mua hàng");
  const [paymentVoucherCode, setPaymentVoucherCode] = useState<string>("PC00001");
  const [paymentPostDate, setPaymentPostDate] = useState<string>("02/10/2026");
  const [paymentDocDate, setPaymentDocDate] = useState<string>("02/10/2026");

  // Detail tabs & options
  const [activeTab, setActiveTab] = useState<"goods" | "tax" | "cost" | "customs_fee" | "warehouse_fee">("goods");
  const [discountPolicy, setDiscountPolicy] = useState<string>("Không chiết khấu");
  const [showAccount, setShowAccount] = useState<boolean>(true);
  const [showRefModal, setShowRefModal] = useState<boolean>(false);

  const parseVnNumber = (v: any): number => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  };

  // Grid rows
  const [items, setItems] = useState<PurchaseMultiInvoiceItem[]>([
    {
      id: "multi-1",
      itemCode: "",
      itemName: "",
      stockCode: "",
      stockAccount: "",
      expenseAccount: "",
      debtAccount: "331",
      cashAccount: "111",
      partnerCode: "",
      partnerName: "",
      unit: "",
      quantity: "1,00",
      unitPrice: "0,00",
      amount: 0,
      purchaseExpense: 0,
    },
  ]);

  const handleSelectTemplate = (tpl: PurchaseVoucherTemplate) => {
    setPurchaseKind(tpl);
    setShowTypeDropdown(false);
    const nextIsWarehouse = tpl.includes("nhập kho");
    if (nextIsWarehouse) {
      setActiveSubTab("receipt");
      setVoucherCode("NK00001");
    } else {
      if (paymentStatus === "unpaid") {
        setActiveSubTab("debit");
        setVoucherCode("MH00001");
      } else {
        setActiveSubTab("payment");
        setVoucherCode(paymentMethod === "Ủy nhiệm chi" ? "UNC00001" : "PC00001");
      }
    }
  };

  const handlePaymentStatusChange = (status: "unpaid" | "paid") => {
    setPaymentStatus(status);
    if (isWarehouse) {
      if (status === "unpaid") {
        setActiveSubTab("receipt");
      }
    } else {
      if (status === "unpaid") {
        setActiveSubTab("debit");
        setVoucherCode("MH00001");
      } else {
        setActiveSubTab("payment");
        setVoucherCode(paymentMethod === "Ủy nhiệm chi" ? "UNC00001" : "PC00001");
      }
    }
  };

  const handleSelectPaymentMethod = (method: string) => {
    setPaymentMethod(method);
    setShowPaymentMethodDropdown(false);
    const newCode = method === "Ủy nhiệm chi" ? "UNC00001" : "PC00001";
    setPaymentVoucherCode(newCode);
    if (!isWarehouse && paymentStatus === "paid") {
      setVoucherCode(newCode);
    }
    if (method === "Ủy nhiệm chi") {
      setItems((prev) => prev.map((row) => ({ ...row, cashAccount: "1121" })));
    } else {
      setItems((prev) => prev.map((row) => ({ ...row, cashAccount: "111" })));
    }
  };

  const handleItemChange = (idx: number, field: keyof PurchaseMultiInvoiceItem, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === "itemCode") {
        const found = SAMPLE_ITEMS.find((it) => it.code === val);
        if (found) {
          next[idx].itemName = found.name;
          next[idx].unit = found.unit;
          next[idx].unitPrice = found.price.toLocaleString("vi-VN", { minimumFractionDigits: 2 });
          next[idx].amount = parseVnNumber(next[idx].quantity) * found.price;
        }
      }
      if (field === "partnerCode") {
        const foundSup = SAMPLE_SUPPLIERS.find((s) => s.code === val);
        if (foundSup) {
          next[idx].partnerName = foundSup.name;
        }
      }
      if (field === "quantity" || field === "unitPrice") {
        const q = field === "quantity" ? parseVnNumber(val) : parseVnNumber(next[idx].quantity);
        const p = field === "unitPrice" ? parseVnNumber(val) : parseVnNumber(next[idx].unitPrice);
        next[idx].amount = q * p;
      }
      return next;
    });
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `multi-${Date.now()}`,
        itemCode: "",
        itemName: "",
        stockCode: "",
        stockAccount: "",
        expenseAccount: "",
        debtAccount: "331",
        cashAccount: paymentMethod === "Ủy nhiệm chi" ? "1121" : "111",
        partnerCode: "",
        partnerName: "",
        unit: "",
        quantity: "1,00",
        unitPrice: "0,00",
        amount: 0,
        purchaseExpense: 0,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `multi-${Date.now()}`,
          itemCode: "",
          itemName: "",
          stockCode: "",
          stockAccount: "",
          expenseAccount: "",
          debtAccount: "331",
          cashAccount: paymentMethod === "Ủy nhiệm chi" ? "1121" : "111",
          partnerCode: "",
          partnerName: "",
          unit: "",
          quantity: "1,00",
          unitPrice: "0,00",
          amount: 0,
          purchaseExpense: 0,
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearAllRows = () => {
    setItems([
      {
        id: `multi-${Date.now()}`,
        itemCode: "",
        itemName: "",
        stockCode: "",
        stockAccount: "",
        expenseAccount: "",
        debtAccount: "331",
        cashAccount: paymentMethod === "Ủy nhiệm chi" ? "1121" : "111",
        partnerCode: "",
        partnerName: "",
        unit: "",
        quantity: "1,00",
        unitPrice: "0,00",
        amount: 0,
        purchaseExpense: 0,
      },
    ]);
  };

  const totalGoods = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalTax = 0;
  const totalExpense = items.reduce((s, it) => s + (Number(it.purchaseExpense) || 0), 0);
  const totalGrand = totalGoods + totalTax;
  const stockValue = totalGoods + totalExpense;

  const currentHeaderCode = isWarehouse
    ? voucherCode
    : paymentStatus === "unpaid"
    ? "MH00001"
    : paymentMethod === "Ủy nhiệm chi"
    ? "UNC00001"
    : "PC00001";

  const handleSave = (andClose = true) => {
    onSubmit({
      kind: "multi_invoice_purchase",
      voucherCode: currentHeaderCode,
      postDate,
      docDate,
      purchaseKind,
      deliverer,
      recipient,
      address,
      description,
      paymentOption: paymentStatus,
      paymentMethod,
      totalGoods,
      totalTax,
      totalExpense,
      grandTotal: totalGrand,
      stockValue,
      items,
    });
    if (andClose) {
      onClose();
    }
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-purchase-modal-window">
        {/* Header (Screenshot 1, 2, 3, 4, 5) */}
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
              Chứng từ mua hàng nhiều hóa đơn {currentHeaderCode}
            </h2>

            {/* Custom Template Dropdown Selector */}
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  height: 30,
                  padding: "0 10px",
                  borderRadius: 4,
                  border: "1.5px solid #00b06b",
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  minWidth: 240,
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.15)",
                }}
              >
                <span>{purchaseKind}</span>
                <ChevronDown size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
              </div>

              {showTypeDropdown && (
                <>
                  <div
                    onClick={() => setShowTypeDropdown(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 110 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#ffffff",
                      border: "1px solid #00b06b",
                      borderRadius: 4,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      zIndex: 120,
                      width: 290,
                      overflow: "hidden",
                    }}
                  >
                    {PURCHASE_VOUCHER_TEMPLATES.map((tpl) => {
                      const isSelected = purchaseKind === tpl;
                      return (
                        <div
                          key={tpl}
                          onClick={() => handleSelectTemplate(tpl)}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#ffffff" : "#1e293b",
                            background: isSelected ? "#00b06b" : "#ffffff",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00b06b";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#ffffff";
                              e.currentTarget.style.color = "#1e293b";
                            }
                          }}
                        >
                          {tpl}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Settings & Search box */}
            <button
              type="button"
              className="misa-invoice-circle-btn"
              style={{ marginLeft: 2 }}
              title="Thiết lập mẫu"
            >
              <Settings size={14} />
            </button>
            <div className="misa-purchase-header-search">
              <input
                type="text"
                placeholder="Nhập số hợp đồng mua hàng"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                style={{ border: "none", outline: "none", fontSize: 12.5, width: 175, background: "transparent" }}
              />
              <Search size={14} style={{ color: "#64748b" }} />
              <ChevronDown size={14} style={{ color: "#64748b" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="misa-purchase-link-btn" title="Hướng dẫn sử dụng">
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </button>
            <button type="button" className="misa-invoice-circle-btn"><Keyboard size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn"><Settings size={16} /></button>
            <button type="button" className="misa-invoice-circle-btn" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {/* Option Bar (Screenshot 1, 2, 3, 4, 5) */}
        <div
          style={{
            padding: "8px 18px",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              <input
                type="radio"
                name="multiPurchasePayment"
                checked={paymentStatus === "unpaid"}
                onChange={() => handlePaymentStatusChange("unpaid")}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Chưa thanh toán</span>
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
              <input
                type="radio"
                name="multiPurchasePayment"
                checked={paymentStatus === "paid"}
                onChange={() => handlePaymentStatusChange("paid")}
                style={{ accentColor: "#00b06b" }}
              />
              <span>Thanh toán ngay</span>
            </label>

            {/* Custom Payment Method Dropdown (Matching Screenshot 3) */}
            <div style={{ position: "relative" }}>
              <div
                data-testid="multi-payment-method-selector"
                onClick={() => {
                  if (paymentStatus === "paid") {
                    setShowPaymentMethodDropdown(!showPaymentMethodDropdown);
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  height: 28,
                  minWidth: 120,
                  padding: "0 8px",
                  borderRadius: 4,
                  border: showPaymentMethodDropdown ? "1px solid #00b06b" : "1px solid #cbd5e1",
                  background: paymentStatus === "unpaid" ? "#f8fafc" : "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: paymentStatus === "unpaid" ? "#94a3b8" : "#0f172a",
                  cursor: paymentStatus === "unpaid" ? "not-allowed" : "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ color: paymentStatus === "paid" ? "#2563eb" : "inherit", fontWeight: paymentStatus === "paid" ? 600 : 500 }}>
                  {paymentMethod}
                </span>
                {showPaymentMethodDropdown ? (
                  <ChevronUp size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "#64748b" }} />
                )}
              </div>

              {/* Popup Menu */}
              {showPaymentMethodDropdown && (
                <>
                  <div
                    onClick={() => setShowPaymentMethodDropdown(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 110 }}
                  />
                  <div
                    data-testid="multi-payment-dropdown-menu"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      background: "#ffffff",
                      border: "1px solid #00b06b",
                      borderRadius: 6,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      zIndex: 120,
                      minWidth: 150,
                      overflow: "hidden",
                    }}
                  >
                    {[
                      "Tiền mặt",
                      "Ủy nhiệm chi",
                      "Séc chuyển khoản",
                      "Séc tiền mặt",
                    ].map((m) => {
                      const isSelected = paymentMethod === m;
                      return (
                        <div
                          key={m}
                          onClick={() => handleSelectPaymentMethod(m)}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? "#ffffff" : "#1e293b",
                            background: isSelected ? "#00b06b" : "#ffffff",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f0fdf4";
                              e.currentTarget.style.color = "#00b06b";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#ffffff";
                              e.currentTarget.style.color = "#1e293b";
                            }
                          }}
                        >
                          {m}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Sub-tabs bar */}
        <div
          style={{
            display: "flex",
            gap: 20,
            padding: "0 18px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {/* Warehouse mode */}
          {isWarehouse && (
            <>
              <button
                type="button"
                onClick={() => setActiveSubTab("receipt")}
                style={{
                  padding: "7px 4px",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeSubTab === "receipt" ? "2px solid #00b06b" : "2px solid transparent",
                  color: activeSubTab === "receipt" ? "#00b06b" : "#475569",
                  fontSize: 12.5,
                  fontWeight: activeSubTab === "receipt" ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                Phiếu nhập
              </button>

              {paymentStatus === "paid" && (
                <button
                  type="button"
                  onClick={() => setActiveSubTab("payment")}
                  style={{
                    padding: "7px 4px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeSubTab === "payment" ? "2px solid #00b06b" : "2px solid transparent",
                    color: activeSubTab === "payment" ? "#00b06b" : "#475569",
                    fontSize: 12.5,
                    fontWeight: activeSubTab === "payment" ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {paymentMethod === "Ủy nhiệm chi" ? "Ủy nhiệm chi" : "Phiếu chi"}
                </button>
              )}
            </>
          )}

          {/* Non-warehouse mode (Screenshots 1 & 2) */}
          {!isWarehouse && (
            <>
              {paymentStatus === "unpaid" ? (
                <button
                  type="button"
                  onClick={() => setActiveSubTab("debit")}
                  style={{
                    padding: "7px 4px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeSubTab === "debit" ? "2px solid #00b06b" : "2px solid transparent",
                    color: activeSubTab === "debit" ? "#00b06b" : "#475569",
                    fontSize: 12.5,
                    fontWeight: activeSubTab === "debit" ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  Chứng từ ghi nợ
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSubTab("payment")}
                  style={{
                    padding: "7px 4px",
                    background: "transparent",
                    border: "none",
                    borderBottom: activeSubTab === "payment" ? "2px solid #00b06b" : "2px solid transparent",
                    color: activeSubTab === "payment" ? "#00b06b" : "#475569",
                    fontSize: 12.5,
                    fontWeight: activeSubTab === "payment" ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {paymentMethod === "Ủy nhiệm chi" ? "Ủy nhiệm chi" : "Phiếu chi"}
                </button>
              )}
            </>
          )}
        </div>

        {/* Master Form Area (Screenshot 1, 2, 3, 4, 5) */}
        <div style={{ padding: "12px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
            {/* Left form fields */}
            <div>
              {/* SUBTAB: PHIẾU NHẬP (Warehouse) */}
              {activeSubTab === "receipt" && (
                <>
                  {/* Row 1: Người giao hàng & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Người giao hàng</label>
                      <input
                        type="text"
                        value={deliverer}
                        onChange={(e) => setDeliverer(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Diễn giải */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Diễn giải</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <div
                        title="AVA AI Gợi ý diễn giải"
                        onClick={() => setDescription("Mua hàng nhiều hóa đơn")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                      >
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Nhân viên mua hàng & Kèm theo chứng từ gốc */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={purchaser}
                          onChange={(e) => setPurchaser(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        >
                          <option value=""></option>
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          title="Thêm nhân viên"
                          onClick={() => {
                            const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                            if (newEmp) setPurchaser(newEmp);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28 }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                      <input
                        type="text"
                        placeholder="Số lượng"
                        value={attachedCount}
                        onChange={(e) => setAttachedCount(e.target.value)}
                        style={{ width: 90, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                      />
                      <span style={{ fontSize: 12, color: "#374151" }}>Chứng từ gốc</span>
                    </div>
                  </div>

                  {/* Row 4: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: paymentStatus === "unpaid" ? 8 : 0 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>

                  {/* Row 5: Điều khoản thanh toán (ONLY if unpaid) */}
                  {paymentStatus === "unpaid" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>▾ Điều khoản thanh toán</span>
                        <button
                          type="button"
                          title="Thêm điều khoản thanh toán"
                          onClick={() => {
                            const d = prompt("Nhập số ngày được nợ mới:", String(debtDays));
                            if (d) setDebtDays(d);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Số ngày được nợ</span>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
                          style={{ width: 55, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: "#475569" }}>Hạn thanh toán</span>
                        <div style={{ position: "relative", width: 130 }}>
                          <input
                            type="text"
                            placeholder="DD/MM/YYYY"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            style={{ width: "100%", height: 28, padding: "0 24px 0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                          />
                          <Calendar size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* SUBTAB: CHỨNG TỪ GHI NỢ (Non-warehouse unpaid, Screenshot 1) */}
              {activeSubTab === "debit" && (
                <>
                  {/* Row 1: Diễn giải (full width) */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Diễn giải</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <div
                        title="AVA AI Gợi ý diễn giải"
                        onClick={() => setDescription("Mua hàng nhiều hóa đơn")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                      >
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Nhân viên mua hàng */}
                  <div style={{ marginBottom: 8, maxWidth: 300 }}>
                    <label className="misa-purchase-label">Nhân viên mua hàng</label>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <select
                        value={purchaser}
                        onChange={(e) => setPurchaser(e.target.value)}
                        style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      >
                        <option value=""></option>
                        <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                        <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                      </select>
                      <button
                        type="button"
                        title="Thêm nhân viên"
                        onClick={() => {
                          const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                          if (newEmp) setPurchaser(newEmp);
                        }}
                        style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 8 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>

                  {/* Row 4: Điều khoản thanh toán */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>▾ Điều khoản thanh toán</span>
                      <button
                        type="button"
                        title="Thêm điều khoản thanh toán"
                        onClick={() => {
                          const d = prompt("Nhập số ngày được nợ mới:", String(debtDays));
                          if (d) setDebtDays(d);
                        }}
                        style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", color: "#00b06b", cursor: "pointer", boxSizing: "border-box" }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>Số ngày được nợ</span>
                      <input
                        type="text"
                        value={debtDays}
                        onChange={(e) => setDebtDays(e.target.value)}
                        style={{ width: 55, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>Hạn thanh toán</span>
                      <div style={{ position: "relative", width: 130 }}>
                        <input
                          type="text"
                          placeholder="DD/MM/YYYY"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 24px 0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                        />
                        <Calendar size={12} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* SUBTAB: PHIẾU CHI (Screenshots 2 & 5) */}
              {activeSubTab === "payment" && (
                <>
                  {/* Row 1: Người nhận & Địa chỉ */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Người nhận</label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label className="misa-purchase-label">Địa chỉ</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Lý do chi */}
                  <div style={{ marginBottom: 8 }}>
                    <label className="misa-purchase-label">Lý do chi</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentReason}
                        onChange={(e) => setPaymentReason(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 28px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <div
                        title="AVA AI Gợi ý lý do chi"
                        onClick={() => setPaymentReason("Chi tiền mua hàng nhiều hóa đơn")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8b5cf6", display: "grid", placeItems: "center" }}
                      >
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Nhân viên mua hàng & Kèm theo chứng từ gốc */}
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 12, marginBottom: 8 }}>
                    <div>
                      <label className="misa-purchase-label">Nhân viên mua hàng</label>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          value={purchaser}
                          onChange={(e) => setPurchaser(e.target.value)}
                          style={{ flex: 1, height: 28, padding: "0 6px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                        >
                          <option value=""></option>
                          <option value="Nguyễn Văn A - Phòng Mua hàng">Nguyễn Văn A - Phòng Mua hàng</option>
                          <option value="Trần Thị B - Trưởng phòng Thu mua">Trần Thị B - Trưởng phòng Thu mua</option>
                        </select>
                        <button
                          type="button"
                          title="Thêm nhân viên"
                          onClick={() => {
                            const newEmp = prompt("Nhập tên nhân viên mua hàng mới:");
                            if (newEmp) setPurchaser(newEmp);
                          }}
                          style={{ width: 28, height: 28, minWidth: 28, borderRadius: 4, border: "1px solid #cbd5e1", background: "#ffffff", display: "grid", placeItems: "center", cursor: "pointer", color: "#00b06b", boxSizing: "border-box" }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 28 }}>
                      <span style={{ fontSize: 12, color: "#374151" }}>Kèm theo</span>
                      <input
                        type="text"
                        placeholder="Số lượng"
                        value={attachedCount}
                        onChange={(e) => setAttachedCount(e.target.value)}
                        style={{ width: 90, height: 28, textAlign: "center", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12, boxSizing: "border-box" }}
                      />
                      <span style={{ fontSize: 12, color: "#374151" }}>Chứng từ gốc</span>
                    </div>
                  </div>

                  {/* Row 4: Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <span
                      onClick={() => setShowRefModal(true)}
                      style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right side: Tổng tiền thanh toán & Right inputs (Screenshot 1, 2, 3, 4, 5) */}
            <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: 18 }}>
              <div style={{ textAlign: "right", marginBottom: 12 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>Tổng tiền thanh toán</span>
                <strong style={{ fontSize: 24, color: "#111827", fontWeight: 800 }}>{formatVND(totalGrand)}</strong>
              </div>

              {/* Case 1: Tab Phiếu nhập */}
              {activeSubTab === "receipt" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={postDate}
                        onChange={(e) => setPostDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số phiếu nhập</label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Case 2: Tab Chứng từ ghi nợ (Screenshot 1) */}
              {activeSubTab === "debit" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={docDate}
                        onChange={(e) => setDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số chứng từ</label>
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}

              {/* Case 3: Tab Phiếu chi (Screenshots 2 & 5) */}
              {activeSubTab === "payment" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label className="misa-purchase-label">Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentPostDate}
                        onChange={(e) => setPaymentPostDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={paymentDocDate}
                        onChange={(e) => setPaymentDocDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label className="misa-purchase-label">Số chứng từ</label>
                    <input
                      type="text"
                      value={paymentVoucherCode}
                      onChange={(e) => setPaymentVoucherCode(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 600, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail Tabs Bar & Table Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#ffffff" }}>
          {/* Detail Grid Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
              borderBottom: "1px solid #e2e8f0",
              background: "#ffffff",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", gap: 18 }}>
              <button
                type="button"
                onClick={() => setActiveTab("goods")}
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "goods" ? "2px solid #00b06b" : "none",
                  color: activeTab === "goods" ? "#00b06b" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Hàng tiền
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tax")}
                style={{
                  height: 36,
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "tax" ? "2px solid #00b06b" : "none",
                  color: activeTab === "tax" ? "#00b06b" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Thuế
              </button>
              {!isImport && (
                <button
                  type="button"
                  onClick={() => setActiveTab("cost")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === "cost" ? "2px solid #00b06b" : "none",
                    color: activeTab === "cost" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Chi phí
                </button>
              )}
              {isImport && (
                <button
                  type="button"
                  onClick={() => setActiveTab("customs_fee")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === "customs_fee" ? "2px solid #00b06b" : "none",
                    color: activeTab === "customs_fee" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Phí trước hải quan
                </button>
              )}
              {isImport && isWarehouse && (
                <button
                  type="button"
                  onClick={() => setActiveTab("warehouse_fee")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === "warehouse_fee" ? "2px solid #00b06b" : "none",
                    color: activeTab === "warehouse_fee" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Phí hàng về kho
                </button>
              )}
              {isImport && !isWarehouse && (
                <button
                  type="button"
                  onClick={() => setActiveTab("cost")}
                  style={{
                    height: 36,
                    background: "transparent",
                    border: "none",
                    borderBottom: activeTab === "cost" ? "2px solid #00b06b" : "none",
                    color: activeTab === "cost" ? "#00b06b" : "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Chi phí mua hàng
                </button>
              )}
            </div>

            {/* Right Tools: AVA Kế toán & Chiết khấu */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
                  color: "#6d28d9",
                  border: "1px solid #ddd6fe",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={13} />
                <span>AVA Kế toán</span>
                <ChevronDown size={12} />
              </button>

              <span style={{ fontSize: 12, color: "#475569" }}>Chiết khấu</span>
              <select
                value={discountPolicy}
                onChange={(e) => setDiscountPolicy(e.target.value)}
                style={{ height: 26, padding: "0 8px", borderRadius: 3, border: "1px solid #cbd5e1", fontSize: 12 }}
              >
                <option value="Không chiết khấu">Không chiết khấu</option>
                <option value="Chiết khấu dòng">Chiết khấu theo dòng</option>
              </select>
            </div>
          </div>

          {/* Table Area */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="misa-purchase-table">
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: "center" }}>#</th>
                  <th style={{ width: 105 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Pin size={11} /><span>Mã hàng</span></div></th>
                  <th>Tên hàng</th>
                  {isWarehouse && <th style={{ width: 85 }}>Kho</th>}
                  {isWarehouse && showAccount && <th style={{ width: 75 }}>TK Kho</th>}
                  {!isWarehouse && showAccount && <th style={{ width: 80 }}>TK Chi phí</th>}
                  {showAccount && (
                    <th style={{ width: 85 }}>
                      {paymentStatus === "unpaid" ? "TK Công nợ" : "TK Tiền"}
                    </th>
                  )}
                  <th style={{ width: 100 }}>Đối tượng</th>
                  <th style={{ width: 150 }}>Tên đối tượng</th>
                  <th style={{ width: 65 }}>ĐVT</th>
                  <th style={{ width: 85, textAlign: "right" }}>Số lượng</th>
                  <th style={{ width: 100, textAlign: "right" }}>Đơn giá</th>
                  <th style={{ width: 110, textAlign: "right" }}>Thành tiền</th>
                  {!isWarehouse && (
                    <th style={{ width: 95, textAlign: "right" }}>
                      {isImport ? "Phí trước HQ" : "Chi phí mua hàng"}
                    </th>
                  )}
                  <th style={{ width: 36, textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                    <td><input type="text" value={row.itemCode} onChange={(e) => handleItemChange(idx, "itemCode", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.itemName} onChange={(e) => handleItemChange(idx, "itemName", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    {isWarehouse && <td><input type="text" value={row.stockCode} onChange={(e) => handleItemChange(idx, "stockCode", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    {isWarehouse && showAccount && <td><input type="text" value={row.stockAccount} onChange={(e) => handleItemChange(idx, "stockAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    {!isWarehouse && showAccount && <td><input type="text" value={row.expenseAccount} onChange={(e) => handleItemChange(idx, "expenseAccount", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>}
                    {showAccount && (
                      <td>
                        <input
                          type="text"
                          value={paymentStatus === "unpaid" ? (row.debtAccount || "331") : (row.cashAccount || (paymentMethod === "Ủy nhiệm chi" ? "1121" : "111"))}
                          onChange={(e) => {
                            if (paymentStatus === "unpaid") {
                              handleItemChange(idx, "debtAccount", e.target.value);
                            } else {
                              handleItemChange(idx, "cashAccount", e.target.value);
                            }
                          }}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }}
                        />
                      </td>
                    )}
                    <td><input type="text" value={row.partnerCode} onChange={(e) => handleItemChange(idx, "partnerCode", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.partnerName} onChange={(e) => handleItemChange(idx, "partnerName", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5 }} /></td>
                    <td><input type="text" value={row.quantity} onChange={(e) => handleItemChange(idx, "quantity", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td><input type="text" value={row.unitPrice} onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)} style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }} /></td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{row.amount === 0 ? "0" : formatVND(row.amount)}</td>
                    {!isWarehouse && (
                      <td>
                        <input
                          type="number"
                          value={row.purchaseExpense || 0}
                          onChange={(e) => handleItemChange(idx, "purchaseExpense", Number(e.target.value) || 0)}
                          style={{ width: "100%", height: 26, border: "none", outline: "none", fontSize: 12.5, textAlign: "right" }}
                        />
                      </td>
                    )}
                    <td style={{ textAlign: "center" }}>
                      <button type="button" onClick={() => handleDeleteRow(idx)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f8fafc", fontWeight: 600, fontSize: 12.5, color: "#1e293b", borderTop: "1px solid #e2e8f0" }}>
                  <td colSpan={3} style={{ padding: "6px 10px" }}>
                    Tổng số: {items.length}
                  </td>
                  <td colSpan={isWarehouse ? (showAccount ? 6 : 4) : (showAccount ? 5 : 3)}></td>
                  <td style={{ textAlign: "right", padding: "6px 10px" }}>
                    {items.reduce((s, it) => s + parseVnNumber(it.quantity), 0).toFixed(2).replace(".", ",")}
                  </td>
                  <td></td>
                  <td style={{ textAlign: "right", padding: "6px 10px" }}>
                    {totalGoods === 0 ? "0" : formatVND(totalGoods)}
                  </td>
                  {!isWarehouse && (
                    <td style={{ textAlign: "right", padding: "6px 10px" }}>
                      {totalExpense === 0 ? "0" : formatVND(totalExpense)}
                    </td>
                  )}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Grid Toolbar: Thêm dòng / Thêm ghi chú / Xóa dòng */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <Plus size={13} /> Thêm dòng
              </button>
              <button type="button" onClick={handleAddRow} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <FileText size={13} /> Thêm ghi chú
              </button>
              <button type="button" onClick={handleClearAllRows} style={{ height: 26, padding: "0 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", color: "#ef4444" }}>
                <Trash2 size={13} /> Xóa hết dòng
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#64748b" }}>
              <span>Số dòng/trang</span>
              <select style={{ height: 24, padding: "0 4px", fontSize: 12, borderRadius: 3, border: "1px solid #cbd5e1", background: "#fff" }}>
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

          {/* Bottom Area: Attachment & Summary (Screenshot 1, 2, 3, 4, 5) */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, padding: "14px 18px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Attachment */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                <Paperclip size={13} style={{ color: "#64748b" }} />
                <span style={{ fontWeight: 600 }}>Đính kèm</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
              </div>
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "26px 16px",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  textAlign: "center",
                  maxWidth: 460,
                }}
              >
                <Upload size={18} style={{ color: "#0284c7", marginBottom: 6 }} />
                <div style={{ fontSize: 12, color: "#0284c7" }}>
                  <strong>Chọn tệp</strong> hoặc kéo và thả tệp vào đây
                </div>
              </div>
            </div>

            {/* Totals Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 12px" }}>
              {!isImport ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155" }}>
                    <span>Tổng tiền hàng</span>
                    <strong>{totalGoods === 0 ? "0" : formatVND(totalGoods)}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155" }}>
                    <span>Thuế GTGT</span>
                    <span>{totalTax === 0 ? "0" : formatVND(totalTax)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700, marginTop: 4 }}>
                    <span>Tổng tiền thanh toán</span>
                    <span style={{ color: "#0f172a", fontWeight: 800 }}>{totalGrand === 0 ? "0" : formatVND(totalGrand)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Chi phí mua hàng</span>
                    <span>{totalExpense === 0 ? "0" : formatVND(totalExpense)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>{isWarehouse ? "Giá trị nhập kho" : "Tổng giá trị"}</span>
                    <span>{stockValue === 0 ? "0" : formatVND(stockValue)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#334155" }}>
                    <span>Tổng tiền hàng</span>
                    <strong>{totalGoods === 0 ? "0" : formatVND(totalGoods)}</strong>
                  </div>
                  <div style={{ borderBottom: "1px solid #cbd5e1", margin: "2px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
                    <span>Tổng tiền thanh toán</span>
                    <span style={{ color: "#0f172a", fontWeight: 800 }}>{totalGrand === 0 ? "0" : formatVND(totalGrand)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Thuế nhập khẩu</span>
                    <span>0</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Thuế CBBG</span>
                    <span>0</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Thuế TTĐB</span>
                    <span>0</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Thuế BVMT</span>
                    <span>0</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Thuế GTGT</span>
                    <span>0</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>Phí trước HQ</span>
                    <span>0</span>
                  </div>
                  {isWarehouse ? (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                      <span>Phí hàng về kho</span>
                      <span>0</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                      <span>Chi phí mua hàng</span>
                      <span>0</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#334155" }}>
                    <span>{isWarehouse ? "Giá trị nhập kho" : "Tổng giá trị"}</span>
                    <span>{stockValue === 0 ? "0" : formatVND(stockValue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              onClick={() => setShowAccount(!showAccount)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            >
              <div
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 10,
                  background: showAccount ? "#00b06b" : "#cbd5e1",
                  position: "relative",
                  transition: "background 0.2s",
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
                    left: showAccount ? 16 : 2,
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>Hiển thị tài khoản</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="button"
              className="misa-invoice-btn-cancel"
              onClick={() => handleSave(false)}
            >
              Cất
            </button>
            <button
              type="button"
              className="misa-invoice-btn-submit"
              onClick={() => handleSave(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span>Cất và Đóng</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}



