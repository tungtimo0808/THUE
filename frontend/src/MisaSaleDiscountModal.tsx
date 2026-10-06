import { useState } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  Calendar,
  Plus,
  Trash2,
  Search,
  Settings,
  Info,
  RotateCcw,
  Sparkles,
  UploadCloud,
  Paperclip,
  Pin,
  Keyboard,
  Bot,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

export interface SaleDiscountItem {
  id: string;
  itemCode: string;
  itemName: string;
  discountAccount: string; // TK Giảm giá hoặc TK nợ (5213 hoặc 331)
  creditAccount: string; // TK công nợ / TK Công nợ / TK có (131) hoặc TK Tiền (111)
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | string;
  vatAmount: number;
  vatAccount: string; // TK Thuế GTGT (33311)
  saleVoucherRef: string; // Số CT bán hàng
  isNote?: boolean;
}

export interface SaleDiscountModalProps {
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

const DEFAULT_CUSTOMERS = SAMPLE_SALE_CUSTOMERS || [
  { code: "KH001", name: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", taxCode: "0102345678", address: "Tòa nhà PVN, 18 Láng Hạ, Ba Đình, Hà Nội" },
  { code: "KH002", name: "Công ty TNHH Thiết bị Điện Hoàng Gia", taxCode: "0103456789", address: "Số 45, Đường 3/2, Quận 10, TP. Hồ Chí Minh" },
  { code: "KH003", name: "Tập đoàn Điện lực Việt Nam EVN", taxCode: "0100100079", address: "11 Cửa Bắc, Ba Đình, Hà Nội" },
];

const DEFAULT_AGENCIES = [
  { code: "ĐV001", name: "Công ty Cổ phần Thiết bị Điện Hoàng Gia" },
  { code: "ĐV002", name: "Tổng Công ty Thiết bị Điện Đông Anh" },
  { code: "ĐV003", name: "Tập đoàn Điện lực Việt Nam EVN" },
];

export function SaleDiscountModal({
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleDiscountModalProps) {
  // Mode selection: "Giảm trừ công nợ" (debt) vs "Trả lại tiền mặt" (cash)
  const [returnType, setReturnType] = useState<"debt" | "cash">(
    initialData?.returnType || "debt"
  );

  // Form type in Header:
  // "1. Bán hàng hóa, dịch vụ"
  // "2. Bán hàng đại lý bán đúng giá"
  // "3. Bán hàng ủy thác xuất khẩu"
  const [formType, setFormType] = useState<string>(
    initialData?.formType || "1. Bán hàng hóa, dịch vụ"
  );

  const isAgency = formType === "2. Bán hàng đại lý bán đúng giá";
  const isExportTrust = formType === "3. Bán hàng ủy thác xuất khẩu";

  // Partner label in Master Form Row 4
  const partnerUnitLabel = isAgency
    ? "Đơn vị giao đại lý"
    : isExportTrust
    ? "Đơn vị ủy thác"
    : null;

  // Voucher Numbers & Dates
  const [voucherCodeDebt, setVoucherCodeDebt] = useState<string>(
    initialData?.voucherCodeDebt || "BGG00001"
  );
  const [voucherCodeCash, setVoucherCodeCash] = useState<string>(
    initialData?.voucherCodeCash || "PC00001"
  );
  const currentVoucherNo = returnType === "debt" ? voucherCodeDebt : voucherCodeCash;

  const [postingDate, setPostingDate] = useState<string>(
    initialData?.postingDate || "02/10/2026"
  );
  const [docDate, setDocDate] = useState<string>(
    initialData?.docDate || "02/10/2026"
  );

  // Upper Sub-tabs: "Giảm trừ công nợ" (or "Phiếu chi") | "Hóa đơn"
  const [upperTab, setUpperTab] = useState<"main" | "invoice">("main");

  // Master Fields: Customer & Partner
  const [customerCode, setCustomerCode] = useState<string>(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState<string>(
    initialData?.customer || initialData?.customerName || ""
  );
  const [address, setAddress] = useState<string>(initialData?.address || "");
  const [contactPerson, setContactPerson] = useState<string>(
    initialData?.contactPerson || ""
  ); // Người nhận (Phiếu chi) / Người mua hàng (Hóa đơn)
  const [salesEmployee, setSalesEmployee] = useState<string>(
    initialData?.salesEmployee || ""
  );
  const [agencyUnit, setAgencyUnit] = useState<string>(
    initialData?.agencyUnit || ""
  );
  const [reasonDebt, setReasonDebt] = useState<string>(
    initialData?.reasonDebt || ""
  );
  const [reasonCash, setReasonCash] = useState<string>(
    initialData?.reasonCash || "Chi tiền giảm giá hàng bán"
  );

  // Additional fields for Phiếu chi
  const [attachQuantity, setAttachQuantity] = useState<string>(
    initialData?.attachQuantity || ""
  );

  // Invoice Metadata (Tab Hóa đơn)
  const [taxCode, setTaxCode] = useState<string>(initialData?.taxCode || "");
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialData?.paymentMethod || (returnType === "cash" ? "Tiền mặt" : "TM/CK")
  );
  const [bankAccount, setBankAccount] = useState<string>(initialData?.bankAccount || "");
  const [invoiceTemplate, setInvoiceTemplate] = useState<string>(
    initialData?.invoiceTemplate || ""
  );
  const [invoiceSeries, setInvoiceSeries] = useState<string>(
    initialData?.invoiceSeries || ""
  );
  const [invoiceNo, setInvoiceNo] = useState<string>(initialData?.invoiceNo || "");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    initialData?.invoiceDate || "02/10/2026"
  );

  // Discount Policy
  const [discountPolicy, setDiscountPolicy] = useState<string>("Không chiết khấu");

  // Toggle switch: Hiển thị tài khoản (Default: true)
  const [showAccounts, setShowAccounts] = useState<boolean>(true);

  // Extra Below Table fields
  const [isReplacementInvoice, setIsReplacementInvoice] = useState<boolean>(false);
  const [noVatReport, setNoVatReport] = useState<boolean>(false);
  const [lookupCode, setLookupCode] = useState<string>("");
  const [lookupUrl, setLookupUrl] = useState<string>("");

  // Default accounts helper
  const getDefaultAccounts = (fType: string, rType: "debt" | "cash") => {
    if (fType === "3. Bán hàng ủy thác xuất khẩu" || fType === "2. Bán hàng đại lý bán đúng giá") {
      return {
        discountAccount: rType === "debt" ? "331" : "5213",
        creditAccount: rType === "debt" ? "131" : "111",
      };
    }
    return {
      discountAccount: "5213",
      creditAccount: rType === "debt" ? "131" : "111",
    };
  };

  // Items State
  const initialAccs = getDefaultAccounts(formType, returnType);
  const [items, setItems] = useState<SaleDiscountItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: "disc-item-1",
            itemCode: "",
            itemName: "",
            discountAccount: initialAccs.discountAccount,
            creditAccount: initialAccs.creditAccount,
            unit: "",
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            vatRate: "",
            vatAmount: 0,
            vatAccount: "33311",
            saleVoucherRef: "",
          },
        ]
  );

  const handleCustomerChange = (code: string) => {
    setCustomerCode(code);
    const found = DEFAULT_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      if (found.address) setAddress(found.address);
      if (found.taxCode) setTaxCode(found.taxCode);
    }
  };

  const handleFormTypeChange = (newType: string) => {
    setFormType(newType);
    const accs = getDefaultAccounts(newType, returnType);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        discountAccount: accs.discountAccount,
        creditAccount: accs.creditAccount,
      }))
    );
  };

  const handleModeChange = (mode: "debt" | "cash") => {
    setReturnType(mode);
    setUpperTab("main");
    const accs = getDefaultAccounts(formType, mode);
    if (mode === "cash") {
      setPaymentMethod("Tiền mặt");
    } else {
      setPaymentMethod("TM/CK");
    }
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        discountAccount: accs.discountAccount,
        creditAccount: accs.creditAccount,
      }))
    );
  };

  const handleItemSelect = (idx: number, code: string) => {
    const it = SAMPLE_SALE_ITEMS?.find((p: any) => p.code === code);
    const updated = [...items];
    updated[idx].itemCode = code;
    if (it) {
      updated[idx].itemName = it.name;
      updated[idx].unit = it.unit;
      updated[idx].unitPrice = it.price || 0;
      const q = Number(updated[idx].quantity) || 1;
      const p = it.price || 0;
      updated[idx].amount = q * p;
      const vRate = Number(updated[idx].vatRate) || 0;
      updated[idx].vatAmount = Math.round((updated[idx].amount * vRate) / 100);
    }
    setItems(updated);
  };

  const handleItemChange = (idx: number, field: keyof SaleDiscountItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice" || field === "vatRate") {
      const q = Number(updated[idx].quantity) || 0;
      const p = Number(updated[idx].unitPrice) || 0;
      updated[idx].amount = q * p;
      const vRate = Number(updated[idx].vatRate) || 0;
      updated[idx].vatAmount = Math.round((updated[idx].amount * vRate) / 100);
    }
    setItems(updated);
  };

  const handleAddRow = () => {
    const accs = getDefaultAccounts(formType, returnType);
    setItems((prev) => [
      ...prev,
      {
        id: `disc-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        discountAccount: accs.discountAccount,
        creditAccount: accs.creditAccount,
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
        vatAccount: "33311",
        saleVoucherRef: "",
      },
    ]);
  };

  const handleAddNoteRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `disc-item-${Date.now()}`,
        itemCode: "",
        itemName: "Ghi chú bổ sung...",
        discountAccount: "",
        creditAccount: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
        vatAccount: "",
        saleVoucherRef: "",
        isNote: true,
      },
    ]);
  };

  const handleClearAllRows = () => {
    const accs = getDefaultAccounts(formType, returnType);
    setItems([
      {
        id: `disc-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        discountAccount: accs.discountAccount,
        creditAccount: accs.creditAccount,
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
        vatAccount: "33311",
        saleVoucherRef: "",
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
  const totalPayment = isExportTrust ? totalAmount : totalAmount + totalVat;

  const handleSave = (andPrint = false) => {
    const payload = {
      returnType,
      formType,
      voucherCode: currentVoucherNo,
      postingDate,
      docDate,
      customerCode,
      customerName,
      address,
      contactPerson,
      salesEmployee,
      agencyUnit,
      reason: returnType === "cash" ? reasonCash : reasonDebt,
      paymentMethod,
      bankAccount,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      items,
      totalAmount,
      totalVat,
      totalPayment,
      isReplacementInvoice,
      noVatReport,
      andPrint,
    };

    onSubmit(payload);
    notify(`Đã lưu chứng từ giảm giá hàng bán ${currentVoucherNo} thành công!`);

    if (andPrint) {
      notify(`Đang chuẩn bị in chứng từ giảm giá hàng bán ${currentVoucherNo}...`);
    }
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
        zIndex: 1100,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "98.5vw",
          height: "97vh",
          maxWidth: "1620px",
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
        {/* 1. HEADER (Title, Form type select, Search, Right icons)         */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              title="Tải lại"
              onClick={() => notify("Đang tải lại dữ liệu chứng từ...")}
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
              Chứng từ giảm giá hàng bán {currentVoucherNo}
            </h2>

            {/* Form Type Dropdown */}
            <div style={{ position: "relative", marginLeft: 8 }}>
              <select
                value={formType}
                onChange={(e) => handleFormTypeChange(e.target.value)}
                style={{
                  height: 26,
                  padding: "0 24px 0 8px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  background: "#ffffff",
                  outline: "none",
                  cursor: "pointer",
                  color: "#1e293b",
                  fontWeight: 500,
                }}
              >
                <option value="1. Bán hàng hóa, dịch vụ">1. Bán hàng hóa, dịch vụ</option>
                <option value="2. Bán hàng đại lý bán đúng giá">2. Bán hàng đại lý bán đúng giá</option>
                <option value="3. Bán hàng ủy thác xuất khẩu">3. Bán hàng ủy thác xuất khẩu</option>
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

            {/* Settings button */}
            <button
              type="button"
              style={{
                height: 26,
                width: 26,
                border: "1px solid #cbd5e1",
                borderRadius: 3,
                background: "#ffffff",
                color: "#64748b",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Settings size={13} />
            </button>

            {/* Search Voucher Box */}
            <div style={{ position: "relative", width: 230 }}>
              <input
                type="text"
                placeholder="Nhập số HĐ/Số CT bán hàng"
                style={{
                  width: "100%",
                  height: 26,
                  padding: "0 38px 0 8px",
                  borderRadius: 3,
                  border: "1px solid #cbd5e1",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  color: "#94a3b8",
                }}
              >
                <Search size={13} />
                <ChevronDown size={11} />
              </div>
            </div>
          </div>

          {/* Right Header Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12.5,
                color: "#00a862",
                cursor: "pointer",
                padding: "2px 6px",
                marginRight: 6,
              }}
              onClick={() => notify("Mở hướng dẫn sử dụng chứng từ giảm giá hàng bán")}
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
        {/* 2. MODE OPTIONS BAR (Radios: Giảm trừ công nợ vs Trả lại tiền mặt) */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "8px 16px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Radio: Giảm trừ công nợ */}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "#1e293b",
                cursor: "pointer",
                fontWeight: returnType === "debt" ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="discountTreatmentType"
                checked={returnType === "debt"}
                onChange={() => handleModeChange("debt")}
                style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
              />
              <span>Giảm trừ công nợ</span>
            </label>

            {/* Radio: Trả lại tiền mặt */}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "#1e293b",
                cursor: "pointer",
                fontWeight: returnType === "cash" ? 600 : 400,
              }}
            >
              <input
                type="radio"
                name="discountTreatmentType"
                checked={returnType === "cash"}
                onChange={() => handleModeChange("cash")}
                style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
              />
              <span>Trả lại tiền mặt</span>
            </label>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. UPPER TABS BAR: [Giảm trừ công nợ / Phiếu chi] | [Hóa đơn]     */}
        {/* ================================================================= */}
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
          <div style={{ display: "flex", gap: 18 }}>
            {/* Tab 1: Giảm trừ công nợ OR Phiếu chi */}
            <button
              type="button"
              onClick={() => setUpperTab("main")}
              style={{
                padding: "8px 2px",
                fontSize: 12.5,
                fontWeight: 600,
                color: upperTab === "main" ? "#00a862" : "#64748b",
                border: "none",
                background: "transparent",
                borderBottom: upperTab === "main" ? "2.5px solid #00a862" : "2.5px solid transparent",
                cursor: "pointer",
              }}
            >
              {returnType === "debt" ? "Giảm trừ công nợ" : "Phiếu chi"}
            </button>

            {/* Tab 2: Hóa đơn */}
            <button
              type="button"
              onClick={() => setUpperTab("invoice")}
              style={{
                padding: "8px 2px",
                fontSize: 12.5,
                fontWeight: 600,
                color: upperTab === "invoice" ? "#00a862" : "#64748b",
                border: "none",
                background: "transparent",
                borderBottom: upperTab === "invoice" ? "2.5px solid #00a862" : "2.5px solid transparent",
                cursor: "pointer",
              }}
            >
              Hóa đơn
            </button>
          </div>

          {/* Right large Total */}
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: 11, color: "#64748b", marginRight: 8 }}>
              Tổng tiền thanh toán
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#1e293b" }}>
              {formatVND(totalPayment)}
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 4. MASTER FORM PANEL (Depending on Upper Tab)                    */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "8px 16px 12px 16px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            flexShrink: 0,
          }}
        >
          {/* TAB 1: Giảm trừ công nợ */}
          {upperTab === "main" && returnType === "debt" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
              {/* Left Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {/* Row 1: Mã khách hàng | Tên khách hàng */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Mã khách hàng
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
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
                        title="Xem số dư"
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                {/* Row 2: Địa chỉ */}
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                {/* Row 3: Nhân viên bán hàng | Diễn giải */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Diễn giải
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={reasonDebt}
                        onChange={(e) => setReasonDebt(e.target.value)}
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
                      <Sparkles
                        size={13}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#8b5cf6",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setReasonDebt("Giảm giá hàng bán");
                          notify("AI: Đã điền diễn giải 'Giảm giá hàng bán'");
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Partner Unit (Đơn vị giao đại lý / Đơn vị ủy thác) + Tham chiếu */}
                {partnerUnitLabel ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                    <div style={{ width: 220 }}>
                      <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                        {partnerUnitLabel}
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <select
                            value={agencyUnit}
                            onChange={(e) => setAgencyUnit(e.target.value)}
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
                            }}
                          >
                            <option value="">-- Chọn đơn vị --</option>
                            {DEFAULT_AGENCIES.map((ag) => (
                              <option key={ag.code} value={ag.name}>
                                {ag.code} - {ag.name}
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
                    <div style={{ paddingBottom: 4 }}>
                      <a
                        href="#ref"
                        onClick={(e) => {
                          e.preventDefault();
                          notify("Mở tham chiếu chứng từ");
                        }}
                        style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                      >
                        Tham chiếu ...
                      </a>
                    </div>
                  </div>
                ) : (
                  <div>
                    <a
                      href="#ref"
                      onClick={(e) => {
                        e.preventDefault();
                        notify("Mở tham chiếu chứng từ");
                      }}
                      style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </a>
                  </div>
                )}
              </div>

              {/* Right Column: Ngày hạch toán, Ngày chứng từ, Số chứng từ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, borderLeft: "1px solid #f1f5f9", paddingLeft: 18 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Ngày hạch toán
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={postingDate}
                      onChange={(e) => setPostingDate(e.target.value)}
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

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Ngày chứng từ
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
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

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Số chứng từ
                  </label>
                  <input
                    type="text"
                    value={voucherCodeDebt}
                    onChange={(e) => setVoucherCodeDebt(e.target.value)}
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
            </div>
          )}

          {/* TAB 1: Phiếu chi */}
          {upperTab === "main" && returnType === "cash" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
              {/* Left Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {/* Row 1: Mã khách hàng | Tên khách hàng */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Mã khách hàng
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                {/* Row 2: Người nhận | Địa chỉ */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Người nhận
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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
                </div>

                {/* Row 3: Nhân viên bán hàng | Lý do chi | Kèm theo */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 140px", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Lý do chi
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={reasonCash}
                        onChange={(e) => setReasonCash(e.target.value)}
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
                      <Sparkles
                        size={13}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#8b5cf6",
                          cursor: "pointer",
                        }}
                        onClick={() => notify("AI: Diễn giải đề xuất 'Chi tiền giảm giá hàng bán'")}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Kèm theo
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="text"
                        placeholder="Số lượng"
                        value={attachQuantity}
                        onChange={(e) => setAttachQuantity(e.target.value)}
                        style={{
                          width: "55px",
                          height: 26,
                          padding: "0 4px",
                          borderRadius: 3,
                          border: "1px solid #cbd5e1",
                          fontSize: 11.5,
                          outline: "none",
                          textAlign: "center",
                        }}
                      />
                      <span style={{ fontSize: 11.5, color: "#64748b", whiteSpace: "nowrap" }}>
                        chứng từ gốc
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: Partner Unit (Đơn vị giao đại lý / Đơn vị ủy thác) + Tham chiếu */}
                {partnerUnitLabel ? (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
                    <div style={{ width: 220 }}>
                      <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                        {partnerUnitLabel}
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <select
                            value={agencyUnit}
                            onChange={(e) => setAgencyUnit(e.target.value)}
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
                            }}
                          >
                            <option value="">-- Chọn đơn vị --</option>
                            {DEFAULT_AGENCIES.map((ag) => (
                              <option key={ag.code} value={ag.name}>
                                {ag.code} - {ag.name}
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
                    <div style={{ paddingBottom: 4 }}>
                      <a
                        href="#ref"
                        onClick={(e) => {
                          e.preventDefault();
                          notify("Mở tham chiếu chứng từ");
                        }}
                        style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                      >
                        Tham chiếu ...
                      </a>
                    </div>
                  </div>
                ) : (
                  <div>
                    <a
                      href="#ref"
                      onClick={(e) => {
                        e.preventDefault();
                        notify("Mở tham chiếu chứng từ");
                      }}
                      style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                    >
                      Tham chiếu ...
                    </a>
                  </div>
                )}
              </div>

              {/* Right Column: Ngày hạch toán, Ngày phiếu chi, Số phiếu chi */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, borderLeft: "1px solid #f1f5f9", paddingLeft: 18 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Ngày hạch toán
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={postingDate}
                      onChange={(e) => setPostingDate(e.target.value)}
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

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Ngày phiếu chi
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={docDate}
                      onChange={(e) => setDocDate(e.target.value)}
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

                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Số phiếu chi
                  </label>
                  <input
                    type="text"
                    value={voucherCodeCash}
                    onChange={(e) => setVoucherCodeCash(e.target.value)}
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
            </div>
          )}

          {/* TAB 2: Hóa đơn */}
          {upperTab === "invoice" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
              {/* Left Column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {/* Row 1: Mã khách hàng | Tên khách hàng */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Mã khách hàng
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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

                {/* Row 2: Mã số thuế/CCCD chủ hộ | Địa chỉ */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Mã số thuế/CCCD chủ hộ
                    </label>
                    <input
                      type="text"
                      value={taxCode}
                      onChange={(e) => setTaxCode(e.target.value)}
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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
                </div>

                {/* Row 3: Người mua hàng | Hình thức thanh toán | Tài khoản ngân hàng */}
                <div style={{ display: "grid", gridTemplateColumns: "180px 180px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Người mua hàng
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Hình thức thanh toán
                    </label>
                    <div style={{ position: "relative" }}>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
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
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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
                        <option value="0011001234567">0011001234567 - Vietcombank</option>
                        <option value="1200101009876">1200101009876 - BIDV</option>
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

                {/* Row 4: Tham chiếu */}
                <div>
                  <a
                    href="#ref"
                    onClick={(e) => {
                      e.preventDefault();
                      notify("Mở tham chiếu chứng từ");
                    }}
                    style={{ fontSize: 12, color: "#00a862", textDecoration: "none", fontWeight: 500 }}
                  >
                    Tham chiếu ...
                  </a>
                </div>
              </div>

              {/* Right Column: Mẫu số HĐ, Ký hiệu HĐ, Số HĐ, Ngày HĐ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 7, borderLeft: "1px solid #f1f5f9", paddingLeft: 18 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Mẫu số HĐ
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={invoiceTemplate}
                      onChange={(e) => setInvoiceTemplate(e.target.value)}
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
                      <option value="">-- Chọn mẫu số --</option>
                      <option value="1/001">1/001 - Hóa đơn GTGT</option>
                      <option value="2/001">2/001 - Hóa đơn bán hàng</option>
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
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
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
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Số HĐ
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
                  <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                    Ngày HĐ
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
          )}
        </div>

        {/* ================================================================= */}
        {/* 5. SUB-TABS (Hàng tiền only) + Quick Assistant & Discount         */}
        {/* ================================================================= */}
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
          <div style={{ display: "flex", gap: 18 }}>
            <button
              type="button"
              style={{
                padding: "8px 2px",
                fontSize: 12.5,
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

          {/* Right Toolbar: Gợi ý hồ sơ + Chiết khấu */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => notify("AI gợi ý hồ sơ chứng từ giảm giá...")}
              style={{
                height: 24,
                padding: "0 10px",
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 4,
                fontSize: 11.5,
                color: "#15803d",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <Bot size={13} style={{ color: "#16a34a" }} />
              <span>Gợi ý hồ sơ</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Chiết khấu</span>
              <div style={{ position: "relative" }}>
                <select
                  value={discountPolicy}
                  onChange={(e) => setDiscountPolicy(e.target.value)}
                  style={{
                    height: 24,
                    padding: "0 20px 0 6px",
                    borderRadius: 3,
                    border: "1px solid #cbd5e1",
                    fontSize: 12,
                    background: "#ffffff",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Không chiết khấu">Không chiết khấu</option>
                  <option value="Chiết khấu theo dòng">Chiết khấu theo dòng</option>
                  <option value="Chiết khấu theo hóa đơn">Chiết khấu theo hóa đơn</option>
                </select>
                <ChevronDown
                  size={12}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 6. TABLE (SOLID BORDERS, NO DASHED!)                              */}
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
              className="misa-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
                whiteSpace: "nowrap",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "linear-gradient(180deg, #eaf6ee 0%, #dcf0e5 100%)",
                    borderBottom: "2px solid #00a862",
                    height: 34,
                    color: "#065f46",
                    fontWeight: 600,
                  }}
                >
                  <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                  <th style={{ width: 130, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Pin size={12} style={{ color: "#00a862" }} />
                      <span>Mã hàng</span>
                    </div>
                  </th>
                  <th style={{ minWidth: 220, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                    Tên hàng
                  </th>

                  {showAccounts && (
                    <th style={{ width: 95, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      {isExportTrust ? "TK nợ" : "TK Giảm giá"}
                    </th>
                  )}

                  {showAccounts && returnType === "debt" && (
                    <th style={{ width: 90, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      {isExportTrust ? "TK có" : isAgency ? "TK Công nợ" : "TK công nợ"}
                    </th>
                  )}

                  {showAccounts && returnType === "cash" && (
                    <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      {isExportTrust ? "TK có" : "TK Tiền"}
                    </th>
                  )}

                  <th style={{ width: 75, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    ĐVT
                  </th>
                  <th style={{ width: 90, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Số lượng
                  </th>
                  <th style={{ width: 105, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Đơn giá
                  </th>
                  <th style={{ width: 120, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                    Thành tiền
                  </th>
                  <th style={{ width: 90, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                    {isExportTrust ? "% Thuế GTGT" : "% thuế GTGT"}
                  </th>
                  {!isExportTrust && (
                    <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      Tiền thuế GTGT
                    </th>
                  )}
                  {showAccounts && !isAgency && !isExportTrust && (
                    <th style={{ width: 95, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      TK Thuế GTGT
                    </th>
                  )}
                  <th style={{ width: 120, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                    {isAgency || isExportTrust ? "Số CT bán hàng" : "Số CT bán h..."}
                  </th>

                  <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                </tr>

                {/* Subtotal row directly under header */}
                <tr
                  style={{
                    background: "linear-gradient(180deg, #f0fdf4 0%, #e6f7ee 100%)",
                    borderTop: "2px solid #a7f3d0",
                    borderBottom: "1px solid #cbd5e1",
                    fontWeight: 600,
                    height: 32,
                    color: "#065f46",
                  }}
                >
                  <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                  {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                  {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
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
                  {!isExportTrust && (
                    <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                      {totalVat === 0 ? "0" : formatVND(totalVat)}
                    </td>
                  )}
                  {showAccounts && !isAgency && !isExportTrust && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
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

                    {/* TK Giảm giá hoặc TK nợ (5213 hoặc 331) */}
                    {showAccounts && (
                      <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="text"
                          value={row.discountAccount}
                          onChange={(e) => handleItemChange(idx, "discountAccount", e.target.value)}
                          style={{
                            width: "100%",
                            height: 24,
                            border: "none",
                            outline: "none",
                            fontSize: 12,
                            textAlign: "center",
                            background: "transparent",
                          }}
                        />
                      </td>
                    )}

                    {/* TK Công nợ / TK có / TK Tiền (131 hoặc 111) */}
                    {showAccounts && (
                      <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="text"
                          value={row.creditAccount}
                          onChange={(e) => handleItemChange(idx, "creditAccount", e.target.value)}
                          style={{
                            width: "100%",
                            height: 24,
                            border: "none",
                            outline: "none",
                            fontSize: 12,
                            textAlign: "center",
                            background: "transparent",
                          }}
                        />
                      </td>
                    )}

                    {/* ĐVT */}
                    <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        style={{
                          width: "100%",
                          height: 24,
                          border: "none",
                          outline: "none",
                          fontSize: 12,
                          textAlign: "center",
                          background: "transparent",
                        }}
                      />
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

                    {/* % Thuế GTGT */}
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

                    {/* Tiền thuế GTGT (Ẩn khi là Bán hàng ủy thác xuất khẩu) */}
                    {!isExportTrust && (
                      <td
                        style={{
                          padding: "1px 8px",
                          textAlign: "right",
                          borderRight: "1px solid #cbd5e1",
                        }}
                      >
                        {formatVND(row.vatAmount)}
                      </td>
                    )}

                    {/* TK Thuế GTGT (33311) - ONLY IF NOT AGENCY AND NOT EXPORT TRUST */}
                    {showAccounts && !isAgency && !isExportTrust && (
                      <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                        <input
                          type="text"
                          value={row.vatAccount}
                          onChange={(e) => handleItemChange(idx, "vatAccount", e.target.value)}
                          style={{
                            width: "100%",
                            height: 24,
                            border: "none",
                            outline: "none",
                            fontSize: 12,
                            textAlign: "center",
                            background: "transparent",
                          }}
                        />
                      </td>
                    )}

                    {/* Số CT bán hàng */}
                    <td style={{ padding: "1px 4px", borderRight: "1px solid #cbd5e1" }}>
                      <input
                        type="text"
                        value={row.saleVoucherRef}
                        onChange={(e) => handleItemChange(idx, "saleVoucherRef", e.target.value)}
                        placeholder="..."
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
        {/* 7. CONTROLS BELOW TABLE (SOLID BORDERS, NO DASHED!)               */}
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
                Thêm dòng
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
                Thêm ghi chú
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
                Xóa hết dòng
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

          {/* Bottom Area: Extra Fields + Right Totals */}
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
              {/* Checkbox: [ ] Là hóa đơn thay thế */}
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "inline-flex",
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
                    style={{ accentColor: "#00b06b", cursor: "pointer", width: 14, height: 14 }}
                  />
                  <span>Là hóa đơn thay thế</span>
                </label>
              </div>

              {/* Checkbox: [ ] Không lên bảng kê thuế GTGT */}
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={noVatReport}
                    onChange={(e) => setNoVatReport(e.target.checked)}
                    style={{ accentColor: "#00b06b", cursor: "pointer", width: 14, height: 14 }}
                  />
                  <span>Không lên bảng kê thuế GTGT</span>
                  <Info size={12} style={{ color: "#0284c7" }} />
                </label>
              </div>

              {/* Row: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 240px",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>
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
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>
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
              <div>
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
                    maxWidth: "400px",
                  }}
                >
                  <UploadCloud size={20} style={{ color: "#00a862" }} />
                  <span style={{ fontSize: 12, color: "#0284c7" }}>
                    Chọn tệp hoặc kéo và thả tệp vào đây
                  </span>
                </div>
              </div>
            </div>

            {/* Right Totals Summary */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: "8px 12px",
                background: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Tổng tiền hàng</span>
                <span style={{ fontWeight: 600 }}>{formatVND(totalAmount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                <span>Thuế GTGT</span>
                <span style={{ fontWeight: 600 }}>{formatVND(totalVat)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1e293b",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: 6,
                }}
              >
                <span>Tổng tiền thanh toán</span>
                <span style={{ color: "#00a862" }}>{formatVND(totalPayment)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Short info shortcut line */}
        <div style={{ padding: "0 16px 4px 16px", fontSize: 11, color: "#94a3b8" }}>
          F9 - Thêm nhanh
        </div>

        {/* ================================================================= */}
        {/* 8. FOOTER: Toggle Hiển thị tài khoản + Hủy | Cất | Cất và In      */}
        {/* ================================================================= */}
        <footer
          style={{
            height: 44,
            background: "#ffffff",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            flexShrink: 0,
          }}
        >
          {/* Left: Toggle Switch Hiển thị tài khoản */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 12,
                color: "#1e293b",
              }}
            >
              <div
                onClick={() => setShowAccounts(!showAccounts)}
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 9,
                  background: showAccounts ? "#00a862" : "#cbd5e1",
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
              <span style={{ fontWeight: 500 }}>Hiển thị tài khoản</span>
            </label>
          </div>

          {/* Right Action Buttons: Hủy | Cất | Cất và In */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

            <button
              type="button"
              onClick={() => handleSave(true)}
              style={{
                height: 30,
                padding: "0 18px",
                border: "none",
                borderRadius: 4,
                background: "#00a862",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                color: "#ffffff",
              }}
            >
              Cất và In
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
