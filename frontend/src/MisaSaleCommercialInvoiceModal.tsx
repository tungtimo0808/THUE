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
  UploadCloud,
  Paperclip,
  Pin,
  Keyboard,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

export interface CommercialInvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
}

export interface SaleCommercialInvoiceModalProps {
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

const DEFAULT_CUSTOMERS = SAMPLE_SALE_CUSTOMERS || [
  { code: "KH001", name: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", taxCode: "0102345678", address: "Hà Nội" },
  { code: "KH002", name: "Công ty TNHH Thiết bị Điện Hoàng Gia", taxCode: "0103456789", address: "TP. Hồ Chí Minh" },
  { code: "KH003", name: "Tập đoàn Điện lực Việt Nam EVN", taxCode: "0100100079", address: "Đà Nẵng" },
];

export function SaleCommercialInvoiceModal({
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleCommercialInvoiceModalProps) {
  // Master fields Left (Row 1)
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || initialData?.customerName || "");

  // Row 2
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [budgetUnitCode, setBudgetUnitCode] = useState(initialData?.budgetUnitCode || "");
  const [idCardNumber, setIdCardNumber] = useState(initialData?.idCardNumber || "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber || "");

  // Row 3
  const [address, setAddress] = useState(initialData?.address || "");
  const [phone, setPhone] = useState(initialData?.phone || "");

  // Row 4
  const [buyerName, setBuyerName] = useState(initialData?.buyerName || initialData?.contact || "");
  const [payMethod, setPayMethod] = useState(initialData?.paymentMethod || "TM/CK");
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || "");

  // Row 5
  const [salesEmployee, setSalesEmployee] = useState(initialData?.salesEmployee || "");

  // Master fields Right (Metadata)
  const [invoiceTemplate, setInvoiceTemplate] = useState(initialData?.invoiceTemplate || "");
  const [invoiceSeries, setInvoiceSeries] = useState(initialData?.invoiceSeries || "");
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoiceNo || "");
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoiceDate || "02/10/2026");

  // Options & Extra fields below table
  const [isReplacementInvoice, setIsReplacementInvoice] = useState(initialData?.isReplacementInvoice || false);
  const [lookupCode, setLookupCode] = useState(initialData?.lookupCode || "");
  const [lookupUrl, setLookupUrl] = useState(initialData?.lookupUrl || "");

  // Items table (Screenshot 2: #, Mã hàng, Tên hàng, ĐVT, Số lượng, Đơn giá, Thành tiền, % thuế GTGT, Thao tác)
  const [items, setItems] = useState<CommercialInvoiceItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((it: any, index: number) => ({
          id: it.id || `comm-item-${index + 1}`,
          itemCode: it.itemCode || "",
          itemName: it.itemName || "",
          unit: it.unit || "",
          quantity: it.quantity ?? 1,
          unitPrice: it.unitPrice ?? 0,
          amount: it.amount ?? ((it.quantity ?? 1) * (it.unitPrice ?? 0)),
          vatRate: it.vatRate !== undefined ? it.vatRate : "",
        }))
      : [
          {
            id: "comm-item-1",
            itemCode: "",
            itemName: "",
            unit: "",
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            vatRate: "",
          },
        ]
  );

  const handleCustomerChange = (code: string) => {
    setCustomerCode(code);
    const found = DEFAULT_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      if (found.taxCode) setTaxCode(found.taxCode);
      if (found.address) setAddress(found.address);
    }
  };

  const handleItemSelect = (idx: number, code: string) => {
    const it = SAMPLE_SALE_ITEMS?.find((p: any) => p.code === code);
    const updated = [...items];
    updated[idx].itemCode = code;
    if (it) {
      updated[idx].itemName = it.name;
      updated[idx].unit = it.unit;
      updated[idx].unitPrice = it.price || 0;
      updated[idx].amount = (Number(updated[idx].quantity) || 1) * (it.price || 0);
    }
    setItems(updated);
  };

  const handleItemChange = (idx: number, field: keyof CommercialInvoiceItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      const q = Number(updated[idx].quantity) || 0;
      const p = Number(updated[idx].unitPrice) || 0;
      updated[idx].amount = q * p;
    }
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `comm-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
      },
    ]);
  };

  const handleAddNoteRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `comm-item-${Date.now()}`,
        itemCode: "",
        itemName: "Ghi chú bổ sung...",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
      },
    ]);
  };

  const handleClearAllRows = () => {
    setItems([
      {
        id: `comm-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
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

  const handleSave = (close = true) => {
    const payload = {
      invoiceType: "Hóa đơn thương mại",
      customerCode,
      customerName,
      taxCode,
      budgetUnitCode,
      idCardNumber,
      passportNumber,
      address,
      phone,
      buyerName,
      paymentMethod: payMethod,
      bankAccount,
      salesEmployee,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      isReplacementInvoice,
      lookupCode,
      lookupUrl,
      items,
      totalPayment: totalAmount,
    };

    onSubmit(payload);
    notify(`Đã lưu Hóa đơn thương mại ${invoiceNo || ""} thành công!`);
    if (close) {
      onClose();
    }
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
        zIndex: 1100,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "98vw",
          height: "96vh",
          maxWidth: "1580px",
          background: "#ffffff",
          borderRadius: 6,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      >
        {/* ================================================================= */}
        {/* 1. HEADER (SCREENSHOT 2: Hóa đơn thương mại)                     */}
        {/* ================================================================= */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              title="Tải lại"
              onClick={() => notify("Đang tải lại dữ liệu...")}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
                borderRadius: 4,
              }}
            >
              <RotateCcw size={16} />
            </button>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: "#1e293b",
                letterSpacing: "-0.2px",
              }}
            >
              Hóa đơn thương mại
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Guide dropdown */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12.5,
                color: "#00a862",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: 4,
                marginRight: 6,
              }}
              onClick={() => notify("Mở hướng dẫn sử dụng hóa đơn thương mại")}
            >
              <HelpCircle size={14} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </div>

            <button
              type="button"
              title="Phím tắt"
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#64748b",
                cursor: "pointer",
                padding: "3px 6px",
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Keyboard size={14} />
            </button>
            <button
              type="button"
              title="Thiết lập"
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              title="Đóng (Esc)"
              onClick={onClose}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. MASTER FORM SECTION (SCREENSHOT 2: EXACT 5 ROWS)               */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "8px 16px 12px 16px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 24,
            }}
          >
            {/* ----------------- LEFT 5 ROWS ----------------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {/* Row 1: Mã khách hàng | Tên khách hàng */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Mã khách hàng
                  </label>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <select
                        value={customerCode}
                        onChange={(e) => handleCustomerChange(e.target.value)}
                        style={{
                          width: "100%",
                          height: 26,
                          padding: "0 22px 0 6px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          fontSize: 12,
                          background: "#ffffff",
                          outline: "none",
                          cursor: "pointer",
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
                      <ChevronDown
                        size={12}
                        style={{
                          position: "absolute",
                          right: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "#64748b",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      title="Thêm khách hàng"
                      onClick={() => onOpenCustomerModal && onOpenCustomerModal()}
                      style={{
                        height: 26,
                        width: 26,
                        minWidth: 26,
                        padding: 0,
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#00a862",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        boxSizing: "border-box",
                      }}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      title="Số dư công nợ"
                      onClick={() => notify("Xem số dư công nợ khách hàng")}
                      style={{
                        height: 26,
                        width: 26,
                        minWidth: 26,
                        padding: 0,
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#64748b",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    >
                      $
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: MST/CCCD | Mã ĐVQHNS | Số CCCD | Số hộ chiếu */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 140px 150px 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Mã số thuế/CCCD chủ hộ
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
                      style={{
                        width: "100%",
                        height: 26,
                        padding: "0 26px 0 8px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                    <Globe
                      size={13}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Mã số ĐVQHNS
                  </label>
                  <input
                    type="text"
                    value={budgetUnitCode}
                    onChange={(e) => setBudgetUnitCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Số CCCD
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={idCardNumber}
                      onChange={(e) => setIdCardNumber(e.target.value)}
                      style={{
                        width: "100%",
                        height: 26,
                        padding: "0 26px 0 8px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Số hộ chiếu
                  </label>
                  <input
                    type="text"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Địa chỉ | Điện thoại */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Điện thoại
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Row 4: Người mua hàng ⓘ | Hình thức thanh toán | Tài khoản ngân hàng */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 180px 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 2,
                    }}
                  >
                    <span>Người mua hàng</span>
                    <Info size={12} style={{ color: "#0284c7" }} />
                  </label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Hình thức thanh toán
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      style={{
                        width: "100%",
                        height: 26,
                        padding: "0 22px 0 8px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        background: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="TM/CK">TM/CK</option>
                      <option value="Tiền mặt">Tiền mặt</option>
                      <option value="Chuyển khoản">Chuyển khoản</option>
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Tài khoản ngân hàng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      style={{
                        width: "100%",
                        height: 26,
                        padding: "0 22px 0 8px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        background: "#ffffff",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Chọn tài khoản ngân hàng --</option>
                      <option value="19036789012 - Techcombank">
                        19036789012 - Techcombank (Chi nhánh Ba Đình)
                      </option>
                      <option value="001100456789 - Vietcombank">
                        001100456789 - Vietcombank (Sở giao dịch)
                      </option>
                      <option value="120010100987 - BIDV">
                        120010100987 - BIDV (Hà Nội)
                      </option>
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Nhân viên bán hàng | Tham chiếu ... */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
                <div style={{ width: 220 }}>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Nhân viên bán hàng
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <select
                        value={salesEmployee}
                        onChange={(e) => setSalesEmployee(e.target.value)}
                        style={{
                          width: "100%",
                          height: 26,
                          padding: "0 22px 0 8px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          fontSize: 12,
                          background: "#ffffff",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">-- Chọn nhân viên --</option>
                        <option value="Nguyễn Văn A">NV001 - Nguyễn Văn A</option>
                        <option value="Trần Thị B">NV002 - Trần Thị B</option>
                        <option value="Lê Văn C">NV003 - Lê Văn C</option>
                      </select>
                      <ChevronDown
                        size={12}
                        style={{
                          position: "absolute",
                          right: 6,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                          color: "#64748b",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      title="Thêm nhân viên"
                      style={{
                        height: 26,
                        width: 26,
                        minWidth: 26,
                        padding: 0,
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        color: "#00a862",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        boxSizing: "border-box",
                      }}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div style={{ paddingBottom: 3 }}>
                  <a
                    href="#tham-chieu"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Mở hộp thoại Tham chiếu chứng từ");
                    }}
                    style={{
                      fontSize: 12,
                      color: "#00a862",
                      textDecoration: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Tham chiếu ...
                  </a>
                </div>
              </div>
            </div>

            {/* ----------------- RIGHT COLUMN (Metadata & Large Total) ----------------- */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderLeft: "1px solid #f1f5f9",
                paddingLeft: 18,
              }}
            >
              {/* Status Badge */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    color: "#64748b",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 3,
                    letterSpacing: 0.5,
                  }}
                >
                  CHƯA PHÁT HÀNH
                </span>
              </div>

              {/* Large Total display (Screenshot 2: Tổng tiền thanh toán 0) */}
              <div style={{ textAlign: "right", marginTop: 4 }}>
                <span style={{ fontSize: 11.5, color: "#64748b", display: "block" }}>
                  Tổng tiền thanh toán
                </span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#1e293b",
                    lineHeight: 1.15,
                  }}
                >
                  {formatVND(totalAmount)}
                </span>
              </div>

              {/* 4 Invoice Metadata fields */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Mẫu số HĐ
                  </label>
                  <input
                    type="text"
                    value={invoiceTemplate}
                    onChange={(e) => setInvoiceTemplate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Ký hiệu HĐ
                  </label>
                  <input
                    type="text"
                    value={invoiceSeries}
                    onChange={(e) => setInvoiceSeries(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Số hóa đơn
                  </label>
                  <input
                    type="text"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    style={{
                      width: "100%",
                      height: 26,
                      padding: "0 8px",
                      borderRadius: 3,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11.5,
                      color: "#475569",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 2,
                    }}
                  >
                    <span>Ngày HĐ</span>
                    <Info size={12} style={{ color: "#0284c7" }} />
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 26,
                        padding: "0 28px 0 8px",
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        fontSize: 12,
                        boxSizing: "border-box",
                        outline: "none",
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
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. SUB-TAB BAR (SCREENSHOT 2: Hàng tiền)                          */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "0 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={{
              padding: "9px 4px",
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
        </div>

        {/* ================================================================= */}
        {/* 4. ITEMS TABLE (SOLID BORDERS, NO DASHED!)                       */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "8px 18px 0 18px",
            background: "#f8fafc",
          }}
        >
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
                {/* Header row */}
                <tr
                  style={{
                    background: "#e8f2ec",
                    borderBottom: "1px solid #cbd5e1",
                    height: 32,
                    color: "#1e293b",
                    fontWeight: 600,
                  }}
                >
                  <th style={{ width: 38, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                  <th style={{ width: 140, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Pin size={12} style={{ color: "#00a862" }} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th style={{ minWidth: 260, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                    Tên hàng
                  </th>
                  <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    ĐVT
                  </th>
                  <th style={{ width: 100, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Số lượng
                  </th>
                  <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Đơn giá
                  </th>
                  <th style={{ width: 130, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Thành tiền
                  </th>
                  <th style={{ width: 95, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    % thuế GTGT
                  </th>
                  <th style={{ width: 40, textAlign: "center", padding: "4px" }}></th>
                </tr>

                {/* Summary / Total row directly under header (Matching Screenshot 2) */}
                <tr
                  style={{
                    background: "#f8fafc",
                    borderBottom: "1px solid #cbd5e1",
                    fontWeight: 600,
                    height: 30,
                    color: "#1e293b",
                  }}
                >
                  <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                    {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                    0,00
                  </td>
                  <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                    {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td></td>
                </tr>
              </thead>

              <tbody>
                {items.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #cbd5e1",
                      height: 32,
                      background: "#ffffff",
                    }}
                  >
                    {/* # */}
                    <td
                      style={{
                        textAlign: "center",
                        color: "#64748b",
                        borderRight: "1px solid #cbd5e1",
                      }}
                    >
                      {idx + 1}
                    </td>

                    {/* Mã hàng */}
                    <td style={{ padding: "1px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ position: "relative" }}>
                        <select
                          value={row.itemCode}
                          onChange={(e) => handleItemSelect(idx, e.target.value)}
                          style={{
                            width: "100%",
                            height: 24,
                            border: "none",
                            outline: "none",
                            fontSize: 12,
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <option value="">-- Chọn --</option>
                          {SAMPLE_SALE_ITEMS?.map((it: any) => (
                            <option key={it.code} value={it.code}>
                              {it.code} - {it.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* Tên hàng */}
                    <td style={{ padding: "1px 6px", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                        placeholder="Nhập tên hàng hóa, dịch vụ..."
                        style={{
                          width: "100%",
                          height: 24,
                          border: "none",
                          outline: "none",
                          fontSize: 12,
                          background: "transparent",
                        }}
                      />
                    </td>

                    {/* ĐVT with icon */}
                    <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          style={{
                            width: "60px",
                            height: 24,
                            border: "none",
                            outline: "none",
                            fontSize: 12,
                            textAlign: "center",
                            background: "transparent",
                          }}
                        />
                        <FileText size={12} style={{ color: "#00a862" }} />
                      </div>
                    </td>

                    {/* Số lượng */}
                    <td style={{ padding: "1px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="number"
                        step="any"
                        value={row.quantity}
                        onChange={(e) =>
                          handleItemChange(idx, "quantity", Number(e.target.value) || 0)
                        }
                        style={{
                          width: "100%",
                          height: 24,
                          border: "none",
                          outline: "none",
                          fontSize: 12,
                          textAlign: "right",
                          background: "transparent",
                        }}
                      />
                    </td>

                    {/* Đơn giá */}
                    <td style={{ padding: "1px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="number"
                        step="any"
                        value={row.unitPrice}
                        onChange={(e) =>
                          handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)
                        }
                        style={{
                          width: "100%",
                          height: 24,
                          border: "none",
                          outline: "none",
                          fontSize: 12,
                          textAlign: "right",
                          background: "transparent",
                        }}
                      />
                    </td>

                    {/* Thành tiền */}
                    <td
                      style={{
                        padding: "1px 8px",
                        textAlign: "right",
                        fontWeight: 600,
                        borderRight: "1px solid #cbd5e1",
                        color: "#0f172a",
                      }}
                    >
                      {formatVND(row.amount)}
                    </td>

                    {/* % thuế GTGT */}
                    <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      <select
                        value={row.vatRate}
                        onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                        style={{
                          height: 24,
                          border: "none",
                          outline: "none",
                          fontSize: 12,
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">--</option>
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="8">8%</option>
                        <option value="10">10%</option>
                        <option value="KCT">KCT</option>
                        <option value="KKNT">KKNT</option>
                      </select>
                    </td>

                    {/* Delete row */}
                    <td style={{ textAlign: "center", padding: "1px 4px" }}>
                      <button
                        type="button"
                        title="Xóa dòng"
                        onClick={() => handleDeleteRow(idx)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#ef4444",
                          cursor: "pointer",
                          padding: 2,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 5. CONTROLS BELOW TABLE (SOLID BORDERS, NO DASHED!)               */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "8px 16px",
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          {/* Top Row: Buttons Left + Pagination Right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#475569", marginRight: 4 }}>
                Tổng số: <strong>{items.length}</strong>
              </span>

              <button
                type="button"
                onClick={handleAddRow}
                style={{
                  height: 26,
                  padding: "0 10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: "#1e293b",
                }}
              >
                <Plus size={13} /> Thêm dòng
              </button>

              <button
                type="button"
                onClick={handleAddNoteRow}
                style={{
                  height: 26,
                  padding: "0 10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  color: "#1e293b",
                }}
              >
                <FileText size={13} /> Thêm ghi chú
              </button>

              <button
                type="button"
                onClick={handleClearAllRows}
                style={{
                  height: 26,
                  padding: "0 10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  color: "#ef4444",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <Trash2 size={13} /> Xóa hết dòng
              </button>
            </div>

            {/* Pagination Right */}
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
                  height: 24,
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  padding: "0 4px",
                  background: "#ffffff",
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
              <span>|&lt; &lt; <strong>1</strong> &gt; &gt;|</span>
            </div>
          </div>

          {/* Bottom Area: Checkbox, Extra Fields, Attachment + Right Totals */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Left Sub-form */}
            <div>
              {/* Checkbox: Là hóa đơn thay thế */}
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isReplacementInvoice}
                    onChange={(e) => setIsReplacementInvoice(e.target.checked)}
                    style={{ cursor: "pointer", width: 14, height: 14 }}
                  />
                  <span>Là hóa đơn thay thế</span>
                </label>
              </div>

              {/* Row: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 260px",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Mã tra cứu HĐĐT
                  </label>
                  <input
                    type="text"
                    value={lookupCode}
                    onChange={(e) => setLookupCode(e.target.value)}
                    style={{
                      width: "100%",
                      height: 24,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 3,
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    Đường dẫn tra cứu HĐĐT
                  </label>
                  <input
                    type="text"
                    value={lookupUrl}
                    onChange={(e) => setLookupUrl(e.target.value)}
                    style={{
                      width: "100%",
                      height: 24,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 3,
                      fontSize: 12,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Attachment Dropzone (SOLID BORDER, NOT DASHED!) */}
              <div style={{ marginTop: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    color: "#334155",
                    marginBottom: 4,
                    fontWeight: 500,
                  }}
                >
                  <Paperclip size={13} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ color: "#64748b", fontWeight: 400 }}>
                    Dung lượng tối đa 5MB
                  </span>
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
                    maxWidth: "432px",
                  }}
                >
                  <UploadCloud size={20} style={{ color: "#00a862" }} />
                  <span style={{ fontSize: 12, color: "#0284c7" }}>
                    Chọn tệp hoặc kéo và thả tệp vào đây
                  </span>
                </div>
              </div>
            </div>

            {/* Right Totals Summary (Matching Screenshot 2: Only Tổng tiền thanh toán 0) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingTop: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1e293b",
                  padding: "4px 0",
                }}
              >
                <span>Tổng tiền thanh toán</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {formatVND(totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 6. FOOTER (SCREENSHOT 2: Hủy | Cất | Cất và Đóng ▾)              */}
        {/* ================================================================= */}
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
              padding: "0 18px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              fontSize: 12.5,
              fontWeight: 500,
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
              padding: "0 18px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              background: "#ffffff",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            Cất
          </button>

          {/* Solid Green Split Button: Cất và Đóng ▾ */}
          <div style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                height: 30,
                padding: "0 16px",
                border: "none",
                background: "#00a862",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Cất và Đóng
            </button>
            <button
              type="button"
              onClick={() => notify("Tùy chọn Cất khác: Cất và In, Cất và Thêm mới")}
              style={{
                height: 30,
                padding: "0 8px",
                border: "none",
                borderLeft: "1px solid rgba(255, 255, 255, 0.25)",
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
        </footer>
      </div>
    </div>
  );
}
