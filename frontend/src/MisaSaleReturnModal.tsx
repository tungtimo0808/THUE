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

export interface SaleReturnItem {
  id: string;
  itemCode: string;
  itemName: string;
  returnAccount: string; // TK trả lại (5212)
  debtAccount: string; // TK công nợ (131)
  cashAccount: string; // TK tiền (111)
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxDesc: string; // Diễn giải thuế
  vatRate: number | string;
  vatAmount: number;
  vatAccount: string; // TK thuế GTGT (33311)
  saleVoucherRef: string; // Số CT bán hàng
  revenueExpenditureItem?: string; // Mục thu/chi
  // For Giá vốn tab
  stockCode: string;
  costDebitAccount: string; // TK nợ (1561)
  costCreditAccount: string; // TK có (632)
  costPrice: number;
  costAmount: number;
}

export interface SaleReturnModalProps {
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

export function SaleReturnModal({
  initialData,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleReturnModalProps) {
  // Mode selection: "Giảm trừ công nợ" vs "Trả lại tiền mặt"
  const [returnType, setReturnType] = useState<"debt" | "cash">(
    initialData?.returnType || "debt"
  );

  // Checkbox Kiêm phiếu nhập kho
  const [isStockInward, setIsStockInward] = useState<boolean>(
    initialData?.isStockInward !== undefined ? initialData.isStockInward : true
  );

  // Invoice treatment dropdown
  const [invoiceTreatment, setInvoiceTreatment] = useState<string>(
    initialData?.invoiceTreatment || "Người bán xuất hóa đơn điều chỉnh"
  );

  // Form type in Header: 1. Bán hàng hóa, dịch vụ vs 2. Bán hàng đại lý bán đúng giá vs 3. Bán hàng ủy thác xuất khẩu
  const [formType, setFormType] = useState<string>(
    initialData?.formType || "1. Bán hàng hóa, dịch vụ"
  );
  const [agencyUnit, setAgencyUnit] = useState<string>(
    initialData?.agencyUnit || ""
  );
  const [exportTrustUnit, setExportTrustUnit] = useState<string>(
    initialData?.exportTrustUnit || ""
  );
  const isAgencySale = formType === "2. Bán hàng đại lý bán đúng giá";
  const isExportTrust = formType === "3. Bán hàng ủy thác xuất khẩu";

  const handleFormTypeChange = (newType: string) => {
    setFormType(newType);
    if (newType === "2. Bán hàng đại lý bán đúng giá" || newType === "3. Bán hàng ủy thác xuất khẩu") {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          returnAccount: it.returnAccount === "5212" ? "331" : it.returnAccount,
        }))
      );
    } else if (newType === "1. Bán hàng hóa, dịch vụ") {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          returnAccount: it.returnAccount === "331" ? "5212" : it.returnAccount,
        }))
      );
    }
  };

  // Voucher Numbers & Dates
  const [voucherCodeDebt, setVoucherCodeDebt] = useState<string>(
    initialData?.voucherCodeDebt || "BTL00001"
  );
  const [voucherCodeCash, setVoucherCodeCash] = useState<string>(
    initialData?.voucherCodeCash || "PC00001"
  );
  const currentVoucherNo = returnType === "debt" ? voucherCodeDebt : voucherCodeCash;

  const [stockVoucherNo, setStockVoucherNo] = useState<string>(
    initialData?.stockVoucherNo || "NK00001"
  );

  const [postingDate, setPostingDate] = useState<string>(
    initialData?.postingDate || "02/10/2026 11:29:29"
  );
  const [docDate, setDocDate] = useState<string>(
    initialData?.docDate || "02/10/2026"
  );

  // Upper Sub-tabs: "Giảm trừ công nợ" (or "Phiếu chi") | "Phiếu nhập" | "Hóa đơn"
  const [upperTab, setUpperTab] = useState<"main" | "stock" | "invoice">("main");

  // Master Fields: Customer & Partner
  const [customerCode, setCustomerCode] = useState<string>(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState<string>(
    initialData?.customer || initialData?.customerName || ""
  );
  const [address, setAddress] = useState<string>(initialData?.address || "");
  const [contactPerson, setContactPerson] = useState<string>(
    initialData?.contactPerson || ""
  ); // Người nhận (Phiếu chi) / Người giao hàng (Phiếu nhập)
  const [salesEmployee, setSalesEmployee] = useState<string>(
    initialData?.salesEmployee || ""
  );
  const [reasonDebt, setReasonDebt] = useState<string>(
    initialData?.reasonDebt || "Trả lại hàng bán"
  );
  const [reasonCash, setReasonCash] = useState<string>(
    initialData?.reasonCash || "Chi tiền trả lại hàng bán"
  );
  const [reasonStock, setReasonStock] = useState<string>(
    initialData?.reasonStock || "Nhập kho trả lại hàng bán"
  );

  // Additional fields for Phiếu chi / Phiếu nhập
  const [attachQuantity, setAttachQuantity] = useState<string>(
    initialData?.attachQuantity || ""
  );

  // Invoice Metadata (Tab Hóa đơn)
  const [taxCode, setTaxCode] = useState<string>(initialData?.taxCode || "");
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

  // Bottom / Table Sub-tab: "Hàng tiền" | "Giá vốn"
  const [tableTab, setTableTab] = useState<"items" | "cost">("items");
  const [discountPolicy, setDiscountPolicy] = useState<string>("Không chiết khấu");

  // Toggle switch: Hiển thị tài khoản (Default: true)
  const [showAccounts, setShowAccounts] = useState<boolean>(true);

  // Extra Below Table fields
  const [otherSystemOrderNo, setOtherSystemOrderNo] = useState<string>("");
  const [ecommercePlatform, setEcommercePlatform] = useState<string>("");
  const [shopName, setShopName] = useState<string>("");
  const [storeCode, setStoreCode] = useState<string>("");
  const [storeName, setStoreName] = useState<string>("");
  const [noVatReport, setNoVatReport] = useState<boolean>(true); // [✓] Không lên bảng kê thuế GTGT
  const [lookupCode, setLookupCode] = useState<string>("");
  const [lookupUrl, setLookupUrl] = useState<string>("");

  // Items State
  const [items, setItems] = useState<SaleReturnItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            id: "ret-item-1",
            itemCode: "",
            itemName: "",
            returnAccount: "5212",
            debtAccount: "131",
            cashAccount: "111",
            unit: "",
            quantity: 1,
            unitPrice: 0,
            amount: 0,
            taxDesc: "",
            vatRate: "",
            vatAmount: 0,
            vatAccount: "33311",
            saleVoucherRef: "",
            stockCode: "1561",
            costDebitAccount: "1561",
            costCreditAccount: "632",
            costPrice: 0,
            costAmount: 0,
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
      updated[idx].costPrice = Math.round(p * 0.7);
      updated[idx].costAmount = updated[idx].costPrice * q;
    }
    setItems(updated);
  };

  const handleItemChange = (idx: number, field: keyof SaleReturnItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice" || field === "vatRate") {
      const q = Number(updated[idx].quantity) || 0;
      const p = Number(updated[idx].unitPrice) || 0;
      updated[idx].amount = q * p;
      const vRate = Number(updated[idx].vatRate) || 0;
      updated[idx].vatAmount = Math.round((updated[idx].amount * vRate) / 100);
      updated[idx].costAmount = (Number(updated[idx].costPrice) || 0) * q;
    }
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `ret-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        returnAccount: isAgencySale || isExportTrust ? "331" : "5212",
        debtAccount: "131",
        cashAccount: "111",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        taxDesc: "",
        vatRate: "",
        vatAmount: 0,
        vatAccount: "33311",
        saleVoucherRef: "",
        revenueExpenditureItem: "",
        stockCode: "1561",
        costDebitAccount: "1561",
        costCreditAccount: "632",
        costPrice: 0,
        costAmount: 0,
      },
    ]);
  };

  const handleAddNoteRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `ret-item-${Date.now()}`,
        itemCode: "",
        itemName: "Ghi chú bổ sung...",
        returnAccount: "",
        debtAccount: "",
        cashAccount: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        taxDesc: "",
        vatRate: "",
        vatAmount: 0,
        vatAccount: "",
        saleVoucherRef: "",
        revenueExpenditureItem: "",
        stockCode: "",
        costDebitAccount: "",
        costCreditAccount: "",
        costPrice: 0,
        costAmount: 0,
      },
    ]);
  };

  const handleClearAllRows = () => {
    setItems([
      {
        id: `ret-item-${Date.now()}`,
        itemCode: "",
        itemName: "",
        returnAccount: isAgencySale || isExportTrust ? "331" : "5212",
        debtAccount: "131",
        cashAccount: "111",
        unit: "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        taxDesc: "",
        vatRate: "",
        vatAmount: 0,
        vatAccount: "33311",
        saleVoucherRef: "",
        revenueExpenditureItem: "",
        stockCode: "1561",
        costDebitAccount: "1561",
        costCreditAccount: "632",
        costPrice: 0,
        costAmount: 0,
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
  const totalPayment = totalAmount + totalVat;

  const handleSave = (andAdd = false) => {
    const payload = {
      returnType,
      isStockInward,
      invoiceTreatment,
      formType,
      voucherCode: currentVoucherNo,
      stockVoucherNo,
      postingDate,
      docDate,
      customerCode,
      customerName,
      address,
      contactPerson,
      salesEmployee,
      reason:
        upperTab === "stock"
          ? reasonStock
          : returnType === "cash"
          ? reasonCash
          : reasonDebt,
      invoiceTemplate,
      invoiceSeries,
      invoiceNo,
      invoiceDate,
      items,
      totalAmount,
      totalVat,
      totalPayment,
      andAdd,
    };

    onSubmit(payload);
    notify(`Đã lưu chứng từ bán hàng bị trả lại ${currentVoucherNo} thành công!`);

    if (andAdd) {
      // Reset or increment voucher number
      if (returnType === "debt") {
        setVoucherCodeDebt("BTL00002");
      } else {
        setVoucherCodeCash("PC00002");
      }
      setStockVoucherNo("NK00002");
      handleClearAllRows();
    } else {
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
              Chứng từ bán hàng bị trả lại {currentVoucherNo}
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
                placeholder="Nhập chứng từ bán hàng, dịch ..."
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
              onClick={() => notify("Mở hướng dẫn sử dụng chứng từ bán hàng bị trả lại")}
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
                name="returnTreatmentType"
                checked={returnType === "debt"}
                onChange={() => {
                  setReturnType("debt");
                  setUpperTab("main");
                }}
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
                name="returnTreatmentType"
                checked={returnType === "cash"}
                onChange={() => {
                  setReturnType("cash");
                  setUpperTab("main");
                }}
                style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
              />
              <span>Trả lại tiền mặt</span>
            </label>

            {/* Checkbox: Kiêm phiếu nhập kho */}
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: "#1e293b",
                cursor: "pointer",
                marginLeft: 10,
              }}
            >
              <input
                type="checkbox"
                checked={isStockInward}
                onChange={(e) => setIsStockInward(e.target.checked)}
                style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
              />
              <span>Kiêm phiếu nhập kho</span>
            </label>

            {/* Invoice Treatment Select */}
            <div style={{ position: "relative", marginLeft: 16 }}>
              <select
                value={invoiceTreatment}
                onChange={(e) => setInvoiceTreatment(e.target.value)}
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
                }}
              >
                <option value="Người bán xuất hóa đơn điều chỉnh">
                  Người bán xuất hóa đơn điều chỉnh
                </option>
                <option value="Người bán xuất hóa đơn thay thế">
                  Người bán xuất hóa đơn thay thế
                </option>
                <option value="Người mua xuất hóa đơn trả lại">
                  Người mua xuất hóa đơn trả lại
                </option>
                <option value="Không có hóa đơn">Không có hóa đơn</option>
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

        {/* ================================================================= */}
        {/* 3. UPPER TABS BAR: [Giảm trừ công nợ / Phiếu chi] | [Phiếu nhập] | [Hóa đơn] */}
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

            {/* Tab 2: Phiếu nhập (if isStockInward is true) */}
            {isStockInward && (
              <button
                type="button"
                onClick={() => setUpperTab("stock")}
                style={{
                  padding: "8px 2px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: upperTab === "stock" ? "#00a862" : "#64748b",
                  border: "none",
                  background: "transparent",
                  borderBottom: upperTab === "stock" ? "2.5px solid #00a862" : "2.5px solid transparent",
                  cursor: "pointer",
                }}
              >
                Phiếu nhập
              </button>
            )}

            {/* Tab 3: Hóa đơn */}
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
              {formatVND(isExportTrust ? totalAmount : totalPayment)}
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
          {/* TAB 1: Giảm trừ công nợ (Screenshot 1) */}
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
                        onClick={() => notify("AI: Diễn giải đề xuất 'Trả lại hàng bán - giảm trừ công nợ'")}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Đơn vị giao đại lý / Đơn vị ủy thác | Tham chiếu */}
                {isAgencySale || isExportTrust ? (
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                        {isExportTrust ? "Đơn vị ủy thác" : "Đơn vị giao đại lý"}
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <select
                            value={isExportTrust ? exportTrustUnit : agencyUnit}
                            onChange={(e) =>
                              isExportTrust
                                ? setExportTrustUnit(e.target.value)
                                : setAgencyUnit(e.target.value)
                            }
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
                            {isExportTrust ? (
                              <>
                                <option value="UT01">UT01 - Công ty CP Xuất Nhập Khẩu Thăng Long</option>
                                <option value="UT02">UT02 - Công ty TNHH Thương mại Quốc tế Á Châu</option>
                              </>
                            ) : (
                              <>
                                <option value="ĐV01">ĐV01 - Công ty TNHH Minh Phát</option>
                                <option value="ĐV02">ĐV02 - Công ty CP Thương Mại Hà Nội</option>
                              </>
                            )}
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
                          title={isExportTrust ? "Thêm đơn vị ủy thác" : "Thêm đơn vị giao đại lý"}
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
                    <div style={{ paddingTop: 16 }}>
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

          {/* TAB 1: Phiếu chi (Screenshot 4) */}
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
                        Chứng từ gốc
                      </span>
                    </div>
                  </div>
                </div>

                {/* Row 4: Đơn vị giao đại lý / Đơn vị ủy thác | Tham chiếu */}
                {isAgencySale || isExportTrust ? (
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                        {isExportTrust ? "Đơn vị ủy thác" : "Đơn vị giao đại lý"}
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <select
                            value={isExportTrust ? exportTrustUnit : agencyUnit}
                            onChange={(e) =>
                              isExportTrust
                                ? setExportTrustUnit(e.target.value)
                                : setAgencyUnit(e.target.value)
                            }
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
                            {isExportTrust ? (
                              <>
                                <option value="UT01">UT01 - Công ty CP Xuất Nhập Khẩu Thăng Long</option>
                                <option value="UT02">UT02 - Công ty TNHH Thương mại Quốc tế Á Châu</option>
                              </>
                            ) : (
                              <>
                                <option value="ĐV01">ĐV01 - Công ty TNHH Minh Phát</option>
                                <option value="ĐV02">ĐV02 - Công ty CP Thương Mại Hà Nội</option>
                              </>
                            )}
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
                          title={isExportTrust ? "Thêm đơn vị ủy thác" : "Thêm đơn vị giao đại lý"}
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
                    <div style={{ paddingTop: 16 }}>
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

              {/* Right Column: Ngày hạch toán, Ngày phiếu chi, Số chứng từ */}
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
                    Số chứng từ
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

          {/* TAB 2: Phiếu nhập (Screenshot 2 & Screenshot 5) */}
          {upperTab === "stock" && (
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

                {/* Row 2: Người giao hàng | Địa chỉ */}
                <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11.5, color: "#475569", display: "block", marginBottom: 2 }}>
                      Người giao hàng
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
                        value={reasonStock}
                        onChange={(e) => setReasonStock(e.target.value)}
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
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Kèm theo | Tham chiếu */}
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 11.5, color: "#475569", whiteSpace: "nowrap" }}>
                      Kèm theo
                    </label>
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
                    <span style={{ fontSize: 11.5, color: "#64748b" }}>Chứng từ gốc</span>
                  </div>

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
              </div>

              {/* Right Column: Ngày hạch toán, Ngày chứng từ, Số phiếu nhập */}
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
                    Số phiếu nhập
                  </label>
                  <input
                    type="text"
                    value={stockVoucherNo}
                    onChange={(e) => setStockVoucherNo(e.target.value)}
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

          {/* TAB 3: Hóa đơn (Screenshot 3) */}
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

                {/* Row 3: Tham chiếu */}
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
        {/* 5. SUB-TABS (Hàng tiền | Giá vốn) + Quick Assistant & Discount    */}
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
              onClick={() => setTableTab("items")}
              style={{
                padding: "8px 2px",
                fontSize: 12.5,
                fontWeight: 600,
                color: tableTab === "items" ? "#00a862" : "#64748b",
                border: "none",
                background: "transparent",
                borderBottom: tableTab === "items" ? "2.5px solid #00a862" : "2.5px solid transparent",
                cursor: "pointer",
              }}
            >
              Hàng tiền
            </button>

            {isStockInward && (
              <button
                type="button"
                onClick={() => setTableTab("cost")}
                style={{
                  padding: "8px 2px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: tableTab === "cost" ? "#00a862" : "#64748b",
                  border: "none",
                  background: "transparent",
                  borderBottom: tableTab === "cost" ? "2.5px solid #00a862" : "2.5px solid transparent",
                  cursor: "pointer",
                }}
              >
                Giá vốn
              </button>
            )}
          </div>

          {/* Right Toolbar: Gợi ý hồ sơ + Chiết khấu */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => notify("AI gợi ý hồ sơ chứng từ giảm trừ...")}
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
                {/* Header row for HÀNG TIỀN */}
                {tableTab === "items" && (
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

                    {isExportTrust ? (
                      /* 3. Bán hàng ủy thác xuất khẩu */
                      <>
                        {showAccounts && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK Nợ
                          </th>
                        )}
                        {returnType === "debt" ? (
                          /* Debt Mode: TK Nợ (331) -> ĐVT -> Số lượng -> TK Có (131) -> Đơn giá -> Thành tiền -> Số CT bán hàng -> Mục thu/chi */
                          <>
                            <th style={{ width: 75, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                              ĐVT
                            </th>
                            <th style={{ width: 90, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              Số lượng
                            </th>
                            {showAccounts && (
                              <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                TK Có
                              </th>
                            )}
                            <th style={{ width: 105, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              Đơn giá
                            </th>
                            <th style={{ width: 120, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              Thành tiền
                            </th>
                            <th style={{ width: 120, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                              Số CT bán hàng
                            </th>
                            <th style={{ width: 120, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                              Mục thu/chi
                            </th>
                          </>
                        ) : (
                          /* Cash Mode: TK Nợ (331) -> TK Có (111) -> ĐVT -> Số lượng -> Đơn giá -> Thành tiền -> Số CT bán hàng */
                          <>
                            {showAccounts && (
                              <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                TK Có
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
                            <th style={{ width: 120, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                              Số CT bán hàng
                            </th>
                          </>
                        )}
                      </>
                    ) : isAgencySale ? (
                      /* 2. Bán hàng đại lý bán đúng giá */
                      <>
                        {showAccounts && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK trả lại
                          </th>
                        )}
                        {showAccounts && returnType === "debt" && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK công nợ
                          </th>
                        )}
                        {showAccounts && returnType === "cash" && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK tiền
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
                          % thuế GTGT
                        </th>
                        <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          Tiền thuế GTGT
                        </th>
                        <th style={{ width: 120, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                          Số CT bán hàng
                        </th>
                      </>
                    ) : (
                      /* 1. Bán hàng hóa, dịch vụ */
                      <>
                        {showAccounts && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK trả lại
                          </th>
                        )}
                        {showAccounts && returnType === "cash" && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK tiền
                          </th>
                        )}
                        <th style={{ width: 75, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          ĐVT
                        </th>
                        <th style={{ width: 90, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          Số lượng
                        </th>
                        {showAccounts && returnType === "debt" && (
                          <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK công nợ
                          </th>
                        )}
                        <th style={{ width: 105, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          Đơn giá
                        </th>
                        <th style={{ width: 120, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          Thành tiền
                        </th>
                        {returnType === "cash" && (
                          <th style={{ width: 140, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            Diễn giải thuế
                          </th>
                        )}
                        <th style={{ width: 90, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          % thuế GTGT
                        </th>
                        <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          Tiền thuế GTGT
                        </th>
                        {showAccounts && returnType === "debt" && (
                          <th style={{ width: 90, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                            TK thuế GTGT
                          </th>
                        )}
                        {returnType === "debt" && (
                          <th style={{ width: 100, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                            Số CT bán h...
                          </th>
                        )}
                      </>
                    )}

                    <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                  </tr>
                )}

                {/* Header row for GIÁ VỐN */}
                {tableTab === "cost" && (
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
                    <th style={{ minWidth: 240, padding: "4px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                      Tên hàng
                    </th>
                    <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      Kho
                    </th>
                    {showAccounts && (
                      <>
                        <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          TK nợ
                        </th>
                        <th style={{ width: 85, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          TK có
                        </th>
                      </>
                    )}
                    <th style={{ width: 75, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                      ĐVT
                    </th>
                    <th style={{ width: 90, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      Số lượng
                    </th>
                    <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      Đơn giá vốn
                    </th>
                    <th style={{ width: 130, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                      Tiền vốn
                    </th>
                    <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                  </tr>
                )}

                {/* Summary / Total row directly under header */}
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

                  {tableTab === "items" ? (
                    <>
                      {isExportTrust ? (
                        returnType === "debt" ? (
                          <>
                            {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                              {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                            <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                              0,00
                            </td>
                            <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                              {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td></td>
                          </>
                        ) : (
                          <>
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
                            <td></td>
                          </>
                        )
                      ) : isAgencySale ? (
                        <>
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
                          <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                            {totalVat === 0 ? "0" : formatVND(totalVat)}
                          </td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td></td>
                        </>
                      ) : (
                        <>
                          {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          {showAccounts && returnType === "cash" && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                            {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          {showAccounts && returnType === "debt" && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                            0,00
                          </td>
                          <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                            {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                          </td>
                          {returnType === "cash" && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                            {totalVat === 0 ? "0" : formatVND(totalVat)}
                          </td>
                          {showAccounts && returnType === "debt" && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          {returnType === "debt" && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                          <td></td>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                      {showAccounts && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                        {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ textAlign: "right", padding: "0 8px", borderRight: "1px solid #cbd5e1" }}>
                        {formatVND(items.reduce((s, it) => s + (it.costAmount || 0), 0))}
                      </td>
                      <td></td>
                    </>
                  )}
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

                    {tableTab === "items" ? (
                      <>
                        {isExportTrust ? (
                          /* 3. Bán hàng ủy thác xuất khẩu body row */
                          returnType === "debt" ? (
                            /* Debt Mode: TK Nợ (331) -> ĐVT -> Số lượng -> TK Có (131) -> Đơn giá -> Thành tiền -> Số CT bán hàng -> Mục thu/chi */
                            <>
                              {/* TK Nợ (331) */}
                              {showAccounts && (
                                <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                  <input
                                    type="text"
                                    value={row.returnAccount}
                                    onChange={(e) => handleItemChange(idx, "returnAccount", e.target.value)}
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

                              {/* TK Có (131) */}
                              {showAccounts && (
                                <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                  <input
                                    type="text"
                                    value={row.debtAccount}
                                    onChange={(e) => handleItemChange(idx, "debtAccount", e.target.value)}
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

                              {/* Mục thu/chi */}
                              <td style={{ padding: "1px 4px", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.revenueExpenditureItem || ""}
                                  onChange={(e) => handleItemChange(idx, "revenueExpenditureItem", e.target.value)}
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
                            </>
                          ) : (
                            /* Cash Mode: TK Nợ (331) -> TK Có (111) -> ĐVT -> Số lượng -> Đơn giá -> Thành tiền -> Số CT bán hàng */
                            <>
                              {/* TK Nợ (331) */}
                              {showAccounts && (
                                <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                  <input
                                    type="text"
                                    value={row.returnAccount}
                                    onChange={(e) => handleItemChange(idx, "returnAccount", e.target.value)}
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

                              {/* TK Có (111) */}
                              {showAccounts && (
                                <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                  <input
                                    type="text"
                                    value={row.cashAccount}
                                    onChange={(e) => handleItemChange(idx, "cashAccount", e.target.value)}
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
                            </>
                          )
                        ) : isAgencySale ? (
                          /* 2. Bán hàng đại lý bán đúng giá body row */
                          <>
                            {/* TK trả lại (331) */}
                            {showAccounts && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.returnAccount}
                                  onChange={(e) => handleItemChange(idx, "returnAccount", e.target.value)}
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

                            {/* TK công nợ (131) for Debt */}
                            {showAccounts && returnType === "debt" && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.debtAccount}
                                  onChange={(e) => handleItemChange(idx, "debtAccount", e.target.value)}
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

                            {/* TK tiền (111) for Cash */}
                            {showAccounts && returnType === "cash" && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.cashAccount}
                                  onChange={(e) => handleItemChange(idx, "cashAccount", e.target.value)}
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

                            {/* Tiền thuế GTGT */}
                            <td
                              style={{
                                padding: "1px 8px",
                                textAlign: "right",
                                borderRight: "1px solid #cbd5e1",
                              }}
                            >
                              {formatVND(row.vatAmount)}
                            </td>

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
                          </>
                        ) : (
                          /* 1. Bán hàng hóa, dịch vụ */
                          <>
                            {/* TK trả lại (5212) */}
                            {showAccounts && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.returnAccount}
                                  onChange={(e) => handleItemChange(idx, "returnAccount", e.target.value)}
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

                            {/* TK tiền (111) for Cash */}
                            {showAccounts && returnType === "cash" && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.cashAccount}
                                  onChange={(e) => handleItemChange(idx, "cashAccount", e.target.value)}
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

                            {/* TK công nợ (131) for Debt */}
                            {showAccounts && returnType === "debt" && (
                              <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.debtAccount}
                                  onChange={(e) => handleItemChange(idx, "debtAccount", e.target.value)}
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

                            {/* Diễn giải thuế for Cash */}
                            {returnType === "cash" && (
                              <td style={{ padding: "1px 6px", borderRight: "1px solid #cbd5e1" }}>
                                <input
                                  type="text"
                                  value={row.taxDesc}
                                  onChange={(e) => handleItemChange(idx, "taxDesc", e.target.value)}
                                  placeholder="Diễn giải thuế..."
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
                            )}

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

                            {/* Tiền thuế GTGT */}
                            <td
                              style={{
                                padding: "1px 8px",
                                textAlign: "right",
                                borderRight: "1px solid #cbd5e1",
                              }}
                            >
                              {formatVND(row.vatAmount)}
                            </td>

                            {/* TK thuế GTGT (33311) for Debt */}
                            {showAccounts && returnType === "debt" && (
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
                            {returnType === "debt" && (
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
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {/* GIÁ VỐN Tab cells */}
                        <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          <input
                            type="text"
                            value={row.stockCode}
                            onChange={(e) => handleItemChange(idx, "stockCode", e.target.value)}
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

                        {showAccounts && (
                          <>
                            <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.costDebitAccount}
                                onChange={(e) => handleItemChange(idx, "costDebitAccount", e.target.value)}
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
                            <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={row.costCreditAccount}
                                onChange={(e) => handleItemChange(idx, "costCreditAccount", e.target.value)}
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
                          </>
                        )}

                        <td style={{ padding: "1px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                          {row.unit}
                        </td>

                        <td style={{ padding: "1px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          {row.quantity}
                        </td>

                        <td style={{ padding: "1px 6px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                          <input
                            type="number"
                            value={row.costPrice}
                            onChange={(e) => handleItemChange(idx, "costPrice", Number(e.target.value) || 0)}
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

                        <td style={{ padding: "1px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", fontWeight: 600 }}>
                          {formatVND(row.costAmount)}
                        </td>
                      </>
                    )}

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
                <Plus size={13} /> Thêm dòng
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
              {/* Row 1: Số đơn hàng khác | Sàn TMĐT | Tên shop */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 150px 140px",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>
                    Số đơn hàng từ hệ thống khác
                  </label>
                  <input
                    type="text"
                    value={otherSystemOrderNo}
                    onChange={(e) => setOtherSystemOrderNo(e.target.value)}
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
                    Sàn thương mại điện tử
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={ecommercePlatform}
                      onChange={(e) => setEcommercePlatform(e.target.value)}
                      style={{
                        width: "100%",
                        height: 24,
                        padding: "0 18px 0 6px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        fontSize: 12,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Chọn sàn --</option>
                      <option value="Shopee">Shopee</option>
                      <option value="Lazada">Lazada</option>
                      <option value="Tiki">Tiki</option>
                      <option value="TikTok Shop">TikTok Shop</option>
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

                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>
                    Tên shop
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      style={{
                        width: "100%",
                        height: 24,
                        padding: "0 18px 0 6px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        fontSize: 12,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        WebkitAppearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">-- Chọn shop --</option>
                      <option value="Shop Chính Hãng">Shop Chính Hãng</option>
                      <option value="Shop Mall HN">Shop Mall HN</option>
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

              {/* Row 2: Mã cửa hàng | Tên cửa hàng */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 240px",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <div>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>
                    Mã cửa hàng
                  </label>
                  <input
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
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
                    Tên cửa hàng
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
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

              {/* Checkbox: [✓] Không lên bảng kê thuế GTGT */}
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

              {/* Row 3: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
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
              {!isExportTrust && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#475569" }}>
                  <span>Thuế GTGT</span>
                  <span style={{ fontWeight: 600 }}>{formatVND(totalVat)}</span>
                </div>
              )}
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
                <span style={{ color: "#00a862" }}>{formatVND(isExportTrust ? totalAmount : totalPayment)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Short info shortcut line */}
        <div style={{ padding: "0 16px 4px 16px", fontSize: 11, color: "#94a3b8" }}>
          F9 - Thêm nhanh
        </div>

        {/* ================================================================= */}
        {/* 8. FOOTER: Toggle Hiển thị tài khoản + Hủy | Cất | Cất và Thêm    */}
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

          {/* Right Action Buttons */}
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
              Cất và Thêm
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
