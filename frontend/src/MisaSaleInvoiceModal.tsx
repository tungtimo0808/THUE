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
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

export type SaleInvoiceFormType =
  | "Hóa đơn bán hàng hóa, dịch vụ trong nước"
  | "Hóa đơn bán hàng xuất khẩu"
  | "Hóa đơn bán hàng đại lý bán đúng giá"
  | "Hóa đơn bán hàng ủy thác xuất khẩu";

export interface SaleInvoiceItem {
  id: string;
  itemCode: string;
  itemName: string;
  isTradeDiscount: boolean;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
  vatAmount: number;
}

export interface SaleInvoiceModalProps {
  initialType?: SaleInvoiceFormType;
  initialIsReplacement?: boolean;
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleInvoiceModal({
  initialType = "Hóa đơn bán hàng hóa, dịch vụ trong nước",
  initialIsReplacement = false,
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleInvoiceModalProps) {
  // 1. Invoice Form Type (Dropdown in top header)
  const [invoiceType, setInvoiceType] = useState<SaleInvoiceFormType>(
    initialData?.invoiceFormType || initialType
  );

  // 2. Search document
  const [searchDoc, setSearchDoc] = useState("");

  // 3. Master Party & Customer Info
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || initialData?.customerName || "");
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [budgetUnitCode, setBudgetUnitCode] = useState(initialData?.budgetUnitCode || "");
  const [idCardNumber, setIdCardNumber] = useState(initialData?.idCardNumber || "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [buyerName, setBuyerName] = useState(initialData?.buyerName || initialData?.contact || "");
  const [birthDate, setBirthDate] = useState(initialData?.birthDate || "");
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || "TM/CK");
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || "");
  const [salesEmployee, setSalesEmployee] = useState(initialData?.salesEmployee || "");
  const [province, setProvince] = useState(initialData?.province || "");
  const [ward, setWard] = useState(initialData?.ward || "");
  const [isAccounted, setIsAccounted] = useState(initialData?.isAccounted || false);

  // 4. Master Invoice Metadata (Top Right)
  const [invoiceTemplate, setInvoiceTemplate] = useState(initialData?.invoiceTemplate || "");
  const [invoiceSeries, setInvoiceSeries] = useState(initialData?.invoiceSeries || "");
  const [invoiceNo, setInvoiceNo] = useState(initialData?.invoiceNo || "");
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoiceDate || "02/10/2026");

  // 5. Discount Policy
  const [discountPolicy, setDiscountPolicy] = useState("Không chiết khấu");

  // 6. Items Grid
  const [items, setItems] = useState<SaleInvoiceItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) return initialData.items;
    return [
      {
        id: "inv-item-1",
        itemCode: "",
        itemName: "",
        isTradeDiscount: false,
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
      },
    ];
  });

  // 7. E-Commerce / Store / Contract Fields (Below Table)
  const [externalOrderNo, setExternalOrderNo] = useState(initialData?.externalOrderNo || "");
  const [ecommercePlatform, setEcommercePlatform] = useState(initialData?.ecommercePlatform || "");
  const [shopName, setShopName] = useState(initialData?.shopName || "");
  const [deliveredDate, setDeliveredDate] = useState(initialData?.deliveredDate || "");
  const [storeCode, setStoreCode] = useState(initialData?.storeCode || "");
  const [storeName, setStoreName] = useState(initialData?.storeName || "");
  const [contractNo, setContractNo] = useState(initialData?.contractNo || "");
  const [contractDate, setContractDate] = useState(initialData?.contractDate || "");
  const [isReplacementInvoice, setIsReplacementInvoice] = useState(
    initialData?.isReplacementInvoice !== undefined ? initialData.isReplacementInvoice : initialIsReplacement
  );

  // Customer selection helper
  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode);
      setAddress(found.address);
      setBuyerName(found.contact);
      setPhone(found.phone);
    }
  };

  // Table calculations
  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVat = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const grandTotal = totalAmount + (invoiceType === "Hóa đơn bán hàng xuất khẩu" ? 0 : totalVat);

  const handleItemChange = (idx: number, field: keyof SaleInvoiceItem, val: any) => {
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
        id: `inv-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        isTradeDiscount: false,
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
        id: `inv-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        isTradeDiscount: false,
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

  const handleSave = (andPrint = false) => {
    const payload = {
      invoiceFormType: invoiceType,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      customerCode,
      customerName,
      taxCode,
      budgetUnitCode,
      idCardNumber,
      passportNumber,
      address,
      phone,
      email,
      buyerName,
      birthDate,
      paymentMethod,
      bankAccount,
      salesEmployee,
      province,
      ward,
      isAccounted,
      discountPolicy,
      externalOrderNo,
      ecommercePlatform,
      shopName,
      deliveredDate,
      storeCode,
      storeName,
      contractNo,
      contractDate,
      isReplacementInvoice,
      items,
      amount: totalAmount,
      vatAmount: totalVat,
      totalPayment: grandTotal,
      andPrint,
    };

    onSubmit(payload);
    notify(
      andPrint
        ? `Đã lưu và chuẩn bị phát hành Hóa đơn ${invoiceNo || "mới"}!`
        : `Đã lưu Hóa đơn ${invoiceNo || "mới"} thành công!`
    );
    onClose();
  };

  // Conditions based on Invoice Type
  const isDomestic = invoiceType === "Hóa đơn bán hàng hóa, dịch vụ trong nước";
  const isExport = invoiceType === "Hóa đơn bán hàng xuất khẩu";
  const isAgency = invoiceType === "Hóa đơn bán hàng đại lý bán đúng giá";
  const isTrusteeExport = invoiceType === "Hóa đơn bán hàng ủy thác xuất khẩu";

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
        {/* 1. TOP HEADER (MATCHING ALL 4 SCREENSHOTS)                        */}
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
              onClick={() => notify("Làm mới thông tin hóa đơn")}
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
              {invoiceType}
            </h2>

            {/* Invoice Form Type Dropdown */}
            <div style={{ position: "relative" }}>
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value as SaleInvoiceFormType)}
                style={{
                  height: 28,
                  padding: "0 26px 0 10px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#1e293b",
                  outline: "none",
                  cursor: "pointer",
                  maxWidth: 260,
                }}
              >
                <option value="Hóa đơn bán hàng hóa, dịch vụ trong nước">
                  Hóa đơn bán hàng hóa, dịch vụ trong nước
                </option>
                <option value="Hóa đơn bán hàng xuất khẩu">
                  Hóa đơn bán hàng xuất khẩu
                </option>
                <option value="Hóa đơn bán hàng đại lý bán đúng giá">
                  Hóa đơn bán hàng đại lý bán đúng giá
                </option>
                <option value="Hóa đơn bán hàng ủy thác xuất khẩu">
                  Hóa đơn bán hàng ủy thác xuất khẩu
                </option>
              </select>
            </div>

            {/* Gear config icon */}
            <button
              type="button"
              title="Cấu hình tìm kiếm"
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
              <Settings size={15} />
            </button>

            {/* Search input: Nhập chứng từ bán hàng, dịch vụ... */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                height: 28,
                padding: "0 6px",
                background: "#ffffff",
                gap: 6,
              }}
            >
              <input
                type="text"
                placeholder={isDomestic ? "Nhập chứng từ bán hàng, dị..." : "Nhập chứng từ bán hàng"}
                value={searchDoc}
                onChange={(e) => setSearchDoc(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 12,
                  width: 170,
                  color: "#1e293b",
                }}
              />
              <Search size={13} style={{ color: "#94a3b8" }} />
              <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
            </div>
          </div>

          {/* Right Header Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => notify("Hướng dẫn lập và phát hành hóa đơn điện tử")}
              style={{
                background: "none",
                border: "none",
                color: "#00b06b",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 6px",
              }}
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={13} />
            </button>

            {/* Keyboard shortcut */}
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

            {/* Settings gear */}
            <button
              type="button"
              title="Tùy chọn mẫu hóa đơn"
              onClick={() => notify("Cài đặt mẫu hóa đơn")}
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

            {/* Close button */}
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
        {/* 2. MASTER FORM SECTION (MATCHING SCREENSHOTS 1, 2, 3, 4)           */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "12px 18px 8px 18px",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 20 }}>
            {/* Left Column (Customer & General Info) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Row 1: Mã khách hàng | Tên khách hàng */}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 170, flexShrink: 0 }}>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Mã khách hàng
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
                          else notify("Thêm nhanh khách hàng mới");
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
                      onClick={() => notify(`Số dư công nợ của ${customerName || "khách hàng"}: 0 đ`)}
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

                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Tên khách hàng
                  </label>
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
              </div>

              {/* Row 2: Mã số thuế/CCCD chủ hộ | Mã số ĐVQHNS | Số CCCD | Số hộ chiếu */}
              <div style={{ display: "grid", gridTemplateColumns: "170px 110px 150px 1fr", gap: 10 }}>
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

              {/* Row 3: Địa chỉ | Điện thoại | Email */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 160px", gap: 10 }}>
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

                <div>
                  <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

              {/* Row 4: Người mua hàng ⓘ | Ngày sinh | Hình thức thanh toán | Tài khoản ngân hàng */}
              <div style={{ display: "grid", gridTemplateColumns: "170px 110px 150px 1fr", gap: 10 }}>
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
                    Ngày sinh
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
                      placeholder="DD/MM/YYYY"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      style={{ border: "none", outline: "none", width: "100%", fontSize: 11.5 }}
                    />
                    <Calendar size={12} style={{ color: "#94a3b8" }} />
                  </div>
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
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
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

              {/* Row 5: Nhân viên bán hàng | Tỉnh/Thành phố | Xã/Phường */}
              <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 1fr", gap: 10 }}>
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
                      <option value="Hải Phòng">Hải Phòng</option>
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
              </div>

              {/* Row 6: Tham chiếu & Đã hạch toán */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 2 }}>
                <div style={{ fontSize: 12, color: "#00a862", cursor: "pointer", fontWeight: 500 }}>
                  <span>Tham chiếu </span>
                  <span>...</span>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontSize: 12.5,
                    color: "#334155",
                    marginRight: 60,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAccounted}
                    onChange={(e) => setIsAccounted(e.target.checked)}
                    style={{ accentColor: "#00b06b", width: 14, height: 14, cursor: "pointer" }}
                  />
                  <span>Đã hạch toán</span>
                </label>
              </div>
            </div>

            {/* Right Column (Invoice Metadata & Status) */}
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
        {/* 3. TAB BAR: HÀNG TIỀN + CHIẾT KHẤU DROPDOWN                       */}
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
          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                padding: "8px 4px",
                borderBottom: "2px solid #00b06b",
                color: "#00b06b",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Hàng tiền
            </div>
          </div>

          {/* Chiết khấu select */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <span style={{ color: "#334155" }}>Chiết khấu</span>
            <select
              value={discountPolicy}
              onChange={(e) => setDiscountPolicy(e.target.value)}
              style={{
                height: 28,
                padding: "0 22px 0 8px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                fontSize: 12,
                background: "#ffffff",
                outline: "none",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <option value="Không chiết khấu">Không chiết khấu</option>
              <option value="Chiết khấu dòng">Chiết khấu theo dòng</option>
              <option value="Chiết khấu tổng">Chiết khấu tổng hóa đơn</option>
            </select>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. ITEMS TABLE (MATCHING ALL 4 SCREENSHOTS DYNAMICALLY)          */}
        {/* ================================================================= */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 18px 0 18px", background: "#f8fafc" }}>
          <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto", background: "#ffffff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "linear-gradient(180deg, #eaf6ee 0%, #dcf0e5 100%)", borderBottom: "2px solid #00a862", color: "#065f46", height: 34, fontWeight: 600 }}>
                  <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                  <th style={{ width: 130, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    📌 Mã hàng
                  </th>
                  <th style={{ minWidth: 200, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    Tên hàng
                  </th>

                  {/* Chiết khấu thương mại (Chỉ có ở Type 1: Domestic) */}
                  {isDomestic && (
                    <th style={{ width: 140, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                      Chiết khấu thương mại
                    </th>
                  )}

                  <th style={{ width: 70, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                    ĐVT <FileText size={12} style={{ verticalAlign: "middle", color: "#00b06b", marginLeft: 2 }} />
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

                  {/* % thuế GTGT */}
                  <th style={{ width: 95, textAlign: "center", borderRight: (isDomestic || isAgency) ? "1px solid #cbd5e1" : "none", padding: "4px 8px" }}>
                    % thuế GTGT
                  </th>

                  {/* Tiền thuế GTGT (Chỉ có ở Type 1: Domestic và Type 3: Agency) */}
                  {(isDomestic || isAgency) && (
                    <th style={{ width: 120, textAlign: "right", padding: "4px 8px" }}>
                      Tiền thuế GTGT
                    </th>
                  )}

                  <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #cbd5e1", height: 32 }}>
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>
                      {idx + 1}
                    </td>

                    {/* Mã hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={row.itemCode}
                        onChange={(e) => handleItemChange(idx, "itemCode", e.target.value)}
                        placeholder=""
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                      />
                    </td>

                    {/* Tên hàng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleItemChange(idx, "itemName", e.target.value)}
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                      />
                    </td>

                    {/* Chiết khấu thương mại (Type 1) */}
                    {isDomestic && (
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "center", padding: "2px" }}>
                        <input
                          type="checkbox"
                          checked={row.isTradeDiscount}
                          onChange={(e) => handleItemChange(idx, "isTradeDiscount", e.target.checked)}
                          style={{ accentColor: "#00b06b", width: 14, height: 14, cursor: "pointer" }}
                        />
                      </td>
                    )}

                    {/* ĐVT */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "center" }}>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, textAlign: "center" }}
                      />
                    </td>

                    {/* Số lượng */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                      <input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5, textAlign: "right" }}
                      />
                    </td>

                    {/* Đơn giá */}
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

                    {/* Thành tiền */}
                    <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                      {row.amount === 0 ? "0" : formatVND(row.amount)}
                    </td>

                    {/* % thuế GTGT */}
                    <td style={{ borderRight: (isDomestic || isAgency) ? "1px solid #cbd5e1" : "none", padding: "2px 4px", textAlign: "center" }}>
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

                    {/* Tiền thuế GTGT (Type 1 & 3) */}
                    {(isDomestic || isAgency) && (
                      <td style={{ padding: "2px 8px", textAlign: "right" }}>
                        {row.vatAmount === 0 ? "0" : formatVND(row.vatAmount)}
                      </td>
                    )}

                    {/* Delete action */}
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

                {/* SUMMARY ROW MATCHING SCREENSHOTS */}
                <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  {isDomestic && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                    {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                  </td>
                  <td style={{ borderRight: (isDomestic || isAgency) ? "1px solid #cbd5e1" : "none", textAlign: "center", padding: "2px 8px" }}>
                    {totalAmount === 0 ? "" : "0"}
                  </td>
                  {(isDomestic || isAgency) && (
                    <td style={{ textAlign: "right", padding: "2px 8px" }}>
                      {totalVat === 0 ? "0" : formatVND(totalVat)}
                    </td>
                  )}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

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
            {/* Left Column: Action Buttons & Shipping / E-commerce Form */}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
                {/* Row 1: Số đơn hàng từ hệ thống khác | Sàn thương mại điện tử */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Số đơn hàng từ hệ thống khác
                    </label>
                    <input
                      type="text"
                      value={externalOrderNo}
                      onChange={(e) => setExternalOrderNo(e.target.value)}
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
                      Sàn thương mại điện tử
                    </label>
                    <select
                      value={ecommercePlatform}
                      onChange={(e) => setEcommercePlatform(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 22px 0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                        background: "#ffffff",
                        outline: "none",
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Tên shop
                    </label>
                    <select
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 22px 0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        boxSizing: "border-box",
                        background: "#ffffff",
                        outline: "none",
                      }}
                    >
                      <option value="">-- Chọn shop --</option>
                      <option value="Minh An Official Store">Minh An Official Store</option>
                      <option value="Minh An Electrical Shop">Minh An Electrical Shop</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Ngày giao hàng thành công
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
                        placeholder="DD/MM/YYYY"
                        value={deliveredDate}
                        onChange={(e) => setDeliveredDate(e.target.value)}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                      />
                      <Calendar size={12} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Mã cửa hàng | Tên cửa hàng */}
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

                {/* Extra Row for Export types (Screenshots 2 & 4): Số hợp đồng | Ngày hợp đồng */}
                {(isExport || isTrusteeExport) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Số hợp đồng
                      </label>
                      <input
                        type="text"
                        value={contractNo}
                        onChange={(e) => setContractNo(e.target.value)}
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
                        Ngày hợp đồng
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
                          placeholder="DD/MM/YYYY"
                          value={contractDate}
                          onChange={(e) => setContractDate(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                        />
                        <Calendar size={12} style={{ color: "#94a3b8" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Checkbox: Là hóa đơn thay thế (Screenshots 1 & 3) */}
                {(isDomestic || isAgency) && (
                  <div style={{ marginTop: 2 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={isReplacementInvoice}
                        onChange={(e) => setIsReplacementInvoice(e.target.checked)}
                        style={{ accentColor: "#00b06b", width: 14, height: 14, cursor: "pointer" }}
                      />
                      <span>Là hóa đơn thay thế</span>
                    </label>
                  </div>
                )}
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

              {/* Totals summary matching Screenshots 1, 2, 3, 4 */}
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

                {/* If Type 2 (Xuất khẩu - Screenshot 2): Only Tổng tiền hàng and Tổng tiền thanh toán */}
                {isExport ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    <span>Tổng tiền thanh toán</span>
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{grandTotal === 0 ? "0" : formatVND(grandTotal)}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                      <span>Thuế GTGT</span>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalVat === 0 ? "0" : formatVND(totalVat)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      <span>Tổng tiền thanh toán</span>
                      <span style={{ fontWeight: 700, color: "#1e293b" }}>{grandTotal === 0 ? "0" : formatVND(grandTotal)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 6. MODAL FOOTER                                                   */}
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

          {/* Split button: Cất và In ▾ */}
          <div style={{ display: "inline-flex" }}>
            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                height: 30,
                padding: "0 14px",
                background: "#00b06b",
                border: "none",
                borderTopLeftRadius: 4,
                borderBottomLeftRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              Cất và In
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                height: 30,
                padding: "0 6px",
                background: "#00b06b",
                border: "none",
                borderLeft: "1px solid rgba(255,255,255,0.3)",
                borderTopRightRadius: 4,
                borderBottomRightRadius: 4,
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
  );
}
