import { useState, useEffect } from "react";
import {
  X,
  RotateCcw,
  ChevronDown,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Settings,
  Search,
  Globe,
  Printer,
  Info,
  HelpCircle,
  FileText,
  Pin,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";
import { SAMPLE_SALE_ITEMS, SAMPLE_SALE_CUSTOMERS } from "./MisaSalesModals";

export interface SaleVoucherItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  tradeDiscount?: boolean; // Chiết khấu thương mại (Type 1)
  debitAccount: string; // TK nợ / TK công nợ / TK tiền (131, 111)
  creditAccount: string; // TK có / TK doanh thu (5111, 331, 511)
  vatAccount?: string; // TK thuế GTGT (33311)
  unitPrice: number;
  amount: number;
  vatRate: number | string; // % Thuế GTGT
  vatAmount: number; // Tiền thuế GTGT
  exportTaxBase?: number; // Giá tính thuế XK (Type 2 & 4)
  exportTaxRate?: number; // % Thuế xuất khẩu (Type 2)
  exportTaxAmount?: number; // Tiền thuế xuất khẩu
}

export interface SaleVoucherModalProps {
  initialCode?: string;
  initialType?: number; // 1: Bán hàng hóa trong nước, 2: Bán hàng xuất khẩu, 3: Bán hàng đại lý bán đúng giá, 4: Bán hàng ủy thác xuất khẩu
  initialData?: any;
  ordersList?: any[];
  isService?: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  onOpenCustomerModal?: () => void;
  notify?: (msg: string) => void;
}

export function SaleVoucherModal({
  initialCode = "BH00001",
  initialType = 1,
  initialData,
  ordersList = [],
  isService = false,
  onClose,
  onSubmit,
  onOpenCustomerModal,
  notify = () => {},
}: SaleVoucherModalProps) {
  // 1. Master sale type (1, 2, 3, 4)
  const [saleType, setSaleType] = useState<number>(initialData?.saleType || initialType || 1);

  // 2. Collection mode: Chưa thu tiền / Thu tiền ngay
  const [collectionType, setCollectionType] = useState<"uncollected" | "collected_now">(
    initialData?.collectionType || "uncollected"
  );
  const [paymentMethod, setPaymentMethod] = useState(initialData?.paymentMethod || "Tiền mặt");

  // 3. Checkboxes
  const [hasDeliveryNote, setHasDeliveryNote] = useState(
    initialData?.hasDeliveryNote !== undefined ? initialData.hasDeliveryNote : !isService
  ); // Kiêm phiếu xuất
  const [hasInvoice, setHasInvoice] = useState(
    initialData?.hasInvoice !== undefined ? initialData.hasInvoice : true
  ); // Lập kèm hóa đơn

  // 4. Voucher Sub-tabs: Chứng từ ghi nợ / Phiếu thu | Phiếu xuất | Hóa đơn
  const [voucherTab, setVoucherTab] = useState<"main" | "delivery" | "invoice">("main");

  // 5. Grid active tab: Hàng tiền | Giá vốn
  const [detailTab, setDetailTab] = useState<"items" | "cogs">("items");

  // 6. Account visibility toggle
  const [showAccounts, setShowAccounts] = useState(true);

  // 7. Search reference / quick pick
  const [searchOrderCode, setSearchOrderCode] = useState("");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);

  // 8. Voucher Code & Dates
  const [voucherCode, setVoucherCode] = useState(() => {
    if (initialData?.code) return initialData.code;
    return collectionType === "collected_now" ? "PT00001" : initialCode;
  });
  const [postingDate, setPostingDate] = useState(
    initialData?.postingDate || (isService ? "03/10/2026" : "03/10/2026 21:09:17")
  );
  const [voucherDate, setVoucherDate] = useState(initialData?.date || "03/10/2026");

  // Delivery tab fields
  const [deliveryCode, setDeliveryCode] = useState(initialData?.deliveryCode || "XK00001");
  const [deliveryReason, setDeliveryReason] = useState(initialData?.deliveryReason || "Xuất kho bán hàng");
  const [receiver, setReceiver] = useState(initialData?.receiver || "");
  const [deliveryAttachQuantity, setDeliveryAttachQuantity] = useState(initialData?.deliveryAttachQuantity || "");

  // Invoice tab fields
  const [budgetUnitCode, setBudgetUnitCode] = useState(initialData?.budgetUnitCode || "");
  const [citizenId, setCitizenId] = useState(initialData?.citizenId || "");
  const [passportNumber, setPassportNumber] = useState(initialData?.passportNumber || "");
  const [buyerPhone, setBuyerPhone] = useState(initialData?.buyerPhone || "");
  const [buyerEmail, setBuyerEmail] = useState(initialData?.buyerEmail || "");
  const [buyerName, setBuyerName] = useState(initialData?.buyerName || "");
  const [buyerBirthDate, setBuyerBirthDate] = useState(initialData?.buyerBirthDate || "");
  const [paymentMethodType, setPaymentMethodType] = useState(
    initialData?.paymentMethodType || (collectionType === "collected_now" ? "Tiền mặt" : "TM/CK")
  );
  const [bankAccount, setBankAccount] = useState(initialData?.bankAccount || "");
  const [province, setProvince] = useState(initialData?.province || "");
  const [ward, setWard] = useState(initialData?.ward || "");
  const [invoiceForm, setInvoiceForm] = useState(initialData?.invoiceForm || "");
  const [invoiceSerial, setInvoiceSerial] = useState(initialData?.invoiceSerial || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoiceNumber || "");
  const [invoiceDate, setInvoiceDate] = useState(initialData?.invoiceDate || "03/10/2026");

  // Customer dropdown
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // 9. Master party & customer fields
  const [customerCode, setCustomerCode] = useState(initialData?.customerCode || "");
  const [customerName, setCustomerName] = useState(initialData?.customer || "");
  const [taxCode, setTaxCode] = useState(initialData?.taxCode || "");
  const [contactPerson, setContactPerson] = useState(initialData?.contact || ""); // Người liên hệ (Chưa thu) hoặc Người nộp (Thu ngay)
  const [address, setAddress] = useState(initialData?.address || "");
  const [salesPerson, setSalesPerson] = useState(initialData?.salesPerson || "");
  const [description, setDescription] = useState(
    initialData?.description !== undefined
      ? initialData.description
      : collectionType === "collected_now"
      ? "Thu tiền bán hàng"
      : isService
      ? ""
      : "Bán hàng"
  );

  // Type 3 & 4 specific: Đơn vị giao đại lý / Đơn vị ủy thác
  const [agencyUnit, setAgencyUnit] = useState(initialData?.agencyUnit || "");
  const [trusteeUnit, setTrusteeUnit] = useState(initialData?.trusteeUnit || "");

  // Thu tiền ngay: Kèm theo ... Chứng từ gốc
  const [attachQuantity, setAttachQuantity] = useState(initialData?.attachQuantity || "");

  // Payment terms (Chưa thu tiền)
  const [paymentTerm, setPaymentTerm] = useState(initialData?.paymentTerm || "");
  const [debtDays, setDebtDays] = useState<number | string>(initialData?.debtDays || "");
  const [paymentDueDate, setPaymentDueDate] = useState(initialData?.paymentDueDate || "");

  // Discount mode
  const [discountMode, setDiscountMode] = useState("Không chiết khấu");

  // Tooltip hover
  const [showVatTooltip, setShowVatTooltip] = useState(false);

  // Extra options below table
  const [isReplacementInvoice, setIsReplacementInvoice] = useState(false);
  const [externalOrderCode, setExternalOrderCode] = useState("");
  const [ecommercePlatform, setEcommercePlatform] = useState("");
  const [deliveredDate, setDeliveredDate] = useState("");
  const [shopName, setShopName] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [otherTerms, setOtherTerms] = useState(initialData?.otherTerms || "");
  const [invoiceLookupCode, setInvoiceLookupCode] = useState(initialData?.invoiceLookupCode || "");
  const [invoiceLookupUrl, setInvoiceLookupUrl] = useState(initialData?.invoiceLookupUrl || "");

  // Determine initial default accounts based on saleType & collectionType
  const getDefaultAccounts = (st: number, col: "uncollected" | "collected_now") => {
    let debit = col === "collected_now" ? "111" : "131";
    let credit = isService
      ? (col === "collected_now" ? "5113" : "511")
      : st === 3 || st === 4
      ? "331"
      : "5111";
    return { debit, credit };
  };

  // Table items
  const [items, setItems] = useState<SaleVoucherItem[]>(() => {
    if (initialData?.items && initialData.items.length > 0) return initialData.items;
    const def = getDefaultAccounts(initialType, "uncollected");
    return [
      {
        id: "item-1",
        code: "",
        name: "",
        unit: "",
        quantity: 1,
        tradeDiscount: false,
        debitAccount: def.debit,
        creditAccount: def.credit,
        vatAccount: "33311",
        unitPrice: 0,
        amount: 0,
        vatRate: initialType === 2 ? "" : initialType === 3 || initialType === 4 ? "0" : "",
        vatAmount: 0,
        exportTaxBase: 0,
        exportTaxRate: 0,
        exportTaxAmount: 0,
      },
    ];
  });

  // Handle switching collectionType (Chưa thu tiền / Thu tiền ngay)
  const handleToggleCollection = (type: "uncollected" | "collected_now") => {
    setCollectionType(type);

    // Switch voucher code prefix between BH and PT
    if (type === "collected_now") {
      setVoucherCode("PT00001");
      setPaymentMethodType("Tiền mặt");
      setDescription("Thu tiền bán hàng");
    } else {
      setVoucherCode("BH00001");
      setPaymentMethodType("TM/CK");
      setDescription(isService ? "" : "Bán hàng");
    }

    // Update table debit account (111 vs 131) and credit account (5113 vs 511 for service)
    const targetDebit = type === "collected_now" ? "111" : "131";
    const targetCredit = isService
      ? (type === "collected_now" ? "5113" : "511")
      : (saleType === 3 || saleType === 4 ? "331" : "5111");

    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        debitAccount: targetDebit,
        creditAccount: targetCredit,
      }))
    );
  };

  // Handle switching saleType (1: Trong nước, 2: Xuất khẩu, 3: Đại lý, 4: Ủy thác)
  const handleChangeSaleType = (newType: number) => {
    setSaleType(newType);
    const def = getDefaultAccounts(newType, collectionType);

    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        debitAccount: def.debit,
        creditAccount: def.credit,
        vatRate: newType === 3 || newType === 4 ? (it.vatRate || "0") : it.vatRate,
      }))
    );
  };

  // Select customer helper
  const handleSelectCustomer = (code: string) => {
    setCustomerCode(code);
    const found = SAMPLE_SALE_CUSTOMERS.find((c) => c.code === code);
    if (found) {
      setCustomerName(found.name);
      setTaxCode(found.taxCode);
      setAddress(found.address);
      setContactPerson(found.contact);
      setReceiver(found.contact);
      setBuyerName(found.contact);
      setBuyerPhone(found.phone);
    }
    setShowCustomerDropdown(false);
  };

  // Quick pick from delivery note / sales order
  const handleSelectOrder = (order: any) => {
    setCustomerName(order.customer || "");
    if (order.customerCode) setCustomerCode(order.customerCode);
    if (order.taxCode) setTaxCode(order.taxCode);
    if (order.address) setAddress(order.address);
    if (order.contact) {
      setContactPerson(order.contact);
      setReceiver(order.contact);
      setBuyerName(order.contact);
    }
    setDescription(`Xuất bán hàng theo đơn hàng ${order.code}`);

    const def = getDefaultAccounts(saleType, collectionType);

    if (order.items && order.items.length > 0) {
      setItems(
        order.items.map((it: any, idx: number) => ({
          id: `item-${idx + 1}`,
          code: it.code || "",
          name: it.name || "",
          unit: it.unit || "",
          quantity: it.quantity || 1,
          tradeDiscount: false,
          debitAccount: def.debit,
          creditAccount: def.credit,
          unitPrice: it.unitPrice || 0,
          amount: it.amount || 0,
          vatRate: it.vatRate || "",
          vatAmount: it.vatAmount || 0,
          exportTaxBase: 0,
          exportTaxRate: 0,
          exportTaxAmount: 0,
        }))
      );
    }
    setSearchOrderCode(order.code);
    setShowOrderDropdown(false);
    notify(`Đã lấy thông tin đơn hàng ${order.code} vào chứng từ bán hàng!`);
  };

  // Table row actions
  const handleAddItem = () => {
    const def = getDefaultAccounts(saleType, collectionType);
    const newItem: SaleVoucherItem = {
      id: `item-${Date.now()}`,
      code: "",
      name: "",
      unit: "",
      quantity: 1,
      tradeDiscount: false,
      debitAccount: def.debit,
      creditAccount: def.credit,
      vatAccount: "33311",
      unitPrice: 0,
      amount: 0,
      vatRate: "",
      vatAmount: 0,
      exportTaxBase: 0,
      exportTaxRate: 0,
      exportTaxAmount: 0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      const def = getDefaultAccounts(saleType, collectionType);
      setItems([
        {
          id: `item-${Date.now()}`,
          code: "",
          name: "",
          unit: "",
          quantity: 1,
          tradeDiscount: false,
          debitAccount: def.debit,
          creditAccount: def.credit,
          vatAccount: "33311",
          unitPrice: 0,
          amount: 0,
          vatRate: "",
          vatAmount: 0,
          exportTaxBase: 0,
          exportTaxRate: 0,
          exportTaxAmount: 0,
        },
      ]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleClearAllItems = () => {
    const def = getDefaultAccounts(saleType, collectionType);
    setItems([
      {
        id: `item-${Date.now()}`,
        code: "",
        name: "",
        unit: "",
        quantity: 1,
        tradeDiscount: false,
        debitAccount: def.debit,
        creditAccount: def.credit,
        vatAccount: "33311",
        unitPrice: 0,
        amount: 0,
        vatRate: "",
        vatAmount: 0,
        exportTaxBase: 0,
        exportTaxRate: 0,
        exportTaxAmount: 0,
      },
    ]);
    notify("Đã xóa hết các dòng dữ liệu");
  };

  const handleItemChange = (index: number, field: keyof SaleVoucherItem, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "code") {
      const catalogItem = SAMPLE_SALE_ITEMS.find((s) => s.code === value);
      if (catalogItem) {
        item.name = catalogItem.name;
        item.unit = catalogItem.unit;
        item.unitPrice = catalogItem.price;
        item.vatRate = saleType === 2 ? "" : catalogItem.vat;
        item.amount = Math.round(item.quantity * catalogItem.price);
        const vatR = Number(item.vatRate) || 0;
        item.vatAmount = Math.round((item.amount * vatR) / 100);
      }
    }

    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(value) || 0 : item.quantity;
      const p = field === "unitPrice" ? Number(value) || 0 : item.unitPrice;
      item.amount = Math.round(q * p);
      const vatR = typeof item.vatRate === "number" ? item.vatRate : Number(item.vatRate) || 0;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
      if (item.exportTaxRate) {
        item.exportTaxAmount = Math.round(((item.exportTaxBase || item.amount) * item.exportTaxRate) / 100);
      }
    }

    if (field === "vatRate") {
      const vatR = Number(value) || 0;
      item.vatRate = value;
      item.vatAmount = Math.round((item.amount * vatR) / 100);
    }

    if (field === "exportTaxRate") {
      const rate = Number(value) || 0;
      item.exportTaxRate = rate;
      item.exportTaxAmount = Math.round(((item.exportTaxBase || item.amount) * rate) / 100);
    }

    updated[index] = item;
    setItems(updated);
  };

  // Calculations
  const totalQuantity = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const totalVat = items.reduce((s, it) => s + (Number(it.vatAmount) || 0), 0);
  const totalExportTax = items.reduce((s, it) => s + (Number(it.exportTaxAmount) || 0), 0);
  const grandTotal = totalAmount + totalVat + totalExportTax;

  // AI suggestions
  const handleAIAssistDescription = () => {
    const text =
      collectionType === "collected_now"
        ? (isService ? "Thu tiền cung ứng dịch vụ tư vấn và kỹ thuật" : "Thu tiền bán thiết bị điện công nghiệp và phụ kiện theo chứng từ bán hàng")
        : (isService ? "Cung ứng dịch vụ tư vấn và hỗ trợ kỹ thuật" : "Bán thiết bị điện công nghiệp kèm phiếu xuất kho và hóa đơn GTGT");
    setDescription(text);
    notify("AVA Kế toán đã tạo tự động diễn giải nghiệp vụ!");
  };

  const handleAIAssistProfile = () => {
    notify("AVA Kế toán: Đã kiểm tra hồ sơ, áp dụng chính sách giảm thuế và định khoản chuẩn theo Thông tư 200/133!");
  };

  const handleSave = (andPrint = false) => {
    const payload = {
      code: voucherCode,
      saleType,
      collectionType,
      paymentMethod,
      hasDeliveryNote: isService ? false : hasDeliveryNote,
      hasInvoice,
      postingDate,
      date: voucherDate,
      customer: customerName || (isService ? "Khách hàng dịch vụ" : "Khách hàng mua hàng"),
      customerCode,
      taxCode,
      contact: contactPerson,
      address,
      salesPerson,
      description,
      deliveryCode,
      deliveryReason,
      receiver,
      deliveryAttachQuantity,
      budgetUnitCode,
      citizenId,
      passportNumber,
      buyerPhone,
      buyerEmail,
      buyerName,
      buyerBirthDate,
      paymentMethodType,
      bankAccount,
      province,
      ward,
      invoiceForm,
      invoiceSerial,
      invoiceNumber,
      invoiceDate,
      agencyUnit,
      attachQuantity,
      paymentTerm,
      debtDays,
      paymentDueDate,
      items,
      amount: totalAmount,
      vatAmount: totalVat,
      exportTaxAmount: totalExportTax,
      totalPayment: grandTotal,
      isReplacementInvoice,
      externalOrderCode,
      ecommercePlatform,
      deliveredDate,
      shopName,
      storeCode,
      storeName,
      shippingAddress,
      otherTerms,
      invoiceLookupCode,
      invoiceLookupUrl,
      isService,
    };

    onSubmit(payload);
    notify(
      andPrint
        ? `Đã lưu và chuẩn bị in ${isService ? "Chứng từ bán dịch vụ" : "Chứng từ bán hàng"} ${voucherCode}!`
        : `Đã lưu ${isService ? "Chứng từ bán dịch vụ" : "Chứng từ bán hàng"} ${voucherCode} thành công!`
    );
    onClose();
  };

  // Title string matching screenshots
  const modalTitle = isService ? `Chứng từ bán dịch vụ ${voucherCode}` : `Chứng từ bán hàng ${voucherCode}`;

  return (
    <div
      className="misa-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.45)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "12px",
        boxSizing: "border-box",
      }}
    >
      <div
        className="misa-purchase-modal-window"
        style={{
          width: "min(1560px, 98vw)",
          maxWidth: 1560,
          height: "min(930px, 96vh)",
          maxHeight: "96vh",
          background: "#ffffff",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 60px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08)",
          border: "1px solid #cbd5e1",
          position: "relative",
          fontSize: 13,
          color: "#1e293b",
        }}
      >
        {/* ================================================================= */}
        {/* 1. TOP HEADER (MATCHING ALL SCREENSHOTS)                          */}
        {/* ================================================================= */}
        <div
          style={{
            height: 46,
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* History / reload icon */}
            <button
              type="button"
              onClick={() => notify("Làm mới thông tin chứng từ bán hàng")}
              title="Lịch sử chứng từ"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <RotateCcw size={16} />
            </button>

            {/* Title */}
            <h2 style={{ fontSize: 16.5, fontWeight: 700, color: "#1e293b", margin: 0 }}>
              {modalTitle}
            </h2>

            {/* Sale Type Select Dropdown (1, 2, 3, 4) - only for regular sale */}
            {!isService && (
              <div style={{ position: "relative" }}>
                <select
                  value={saleType}
                  onChange={(e) => handleChangeSaleType(Number(e.target.value))}
                  style={{
                    height: 28,
                    padding: "0 26px 0 10px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#1e293b",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value={1}>1. Bán hàng hóa trong nước</option>
                  <option value={2}>2. Bán hàng xuất khẩu</option>
                  <option value={3}>3. Bán hàng đại lý bán đúng giá</option>
                  <option value={4}>4. Bán hàng ủy thác xuất khẩu</option>
                </select>
              </div>
            )}

            {/* Gear + Quick lookup input */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                title="Cấu hình tìm kiếm"
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
                <Settings size={15} />
              </button>

              <div style={{ position: "relative" }}>
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
                    placeholder={isService ? "Nhập số hóa đơn" : "Nhập số phiếu xuất"}
                    value={searchOrderCode}
                    onChange={(e) => {
                      setSearchOrderCode(e.target.value);
                      setShowOrderDropdown(true);
                    }}
                    onFocus={() => setShowOrderDropdown(true)}
                    style={{
                      border: "none",
                      outline: "none",
                      fontSize: 12.5,
                      width: 155,
                      color: "#1e293b",
                    }}
                  />
                  <Search size={13} style={{ color: "#94a3b8" }} />
                  <button
                    type="button"
                    onClick={() => setShowOrderDropdown(!showOrderDropdown)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      padding: 0,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                {/* Dropdown list */}
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
                      minWidth: 290,
                    }}
                  >
                    <div
                      style={{
                        padding: "6px 10px",
                        fontSize: 11.5,
                        background: "#f8fafc",
                        color: "#64748b",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      Chọn đơn đặt hàng / phiếu xuất:
                    </div>
                    {(ordersList.length > 0
                      ? ordersList
                      : [
                          { code: "ĐH00001", customer: "Công ty Cổ phần Xây lắp Dầu khí Đông Đô", amount: 128000000 },
                          { code: "PXK00001", customer: "Công ty TNHH Thiết bị Điện Thiên An", amount: 64000000 },
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
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => notify("Mở tài liệu Hướng dẫn quản lý Chứng từ bán hàng")}
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

            {/* Keyboard shortcuts icon */}
            <button
              type="button"
              title="Phím tắt"
              onClick={() => notify("Phím tắt: F3 (Tìm nhanh), F9 (Thêm nhanh), Ctrl+F3 (Tra cứu giảm thuế)")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "6px",
                borderRadius: 4,
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
              title="Tùy chọn giao diện"
              onClick={() => notify("Cài đặt trường mẫu chứng từ bán hàng")}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "6px",
                borderRadius: 4,
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
                padding: "6px",
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. SUB-HEADER BAR (RADIOS, CHECKBOXES, TABS, BADGE & TOTAL)       */}
        {/* ================================================================= */}
        <div
          style={{
            padding: "8px 20px 0 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Row 1: Radios & Checkboxes */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* Radio Chưa thu tiền */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontWeight: collectionType === "uncollected" ? 600 : 400,
                  fontSize: 13,
                  color: "#1e293b",
                }}
              >
                <input
                  type="radio"
                  name="voucherCollectionType"
                  checked={collectionType === "uncollected"}
                  onChange={() => handleToggleCollection("uncollected")}
                  style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
                />
                <span>Chưa thu tiền</span>
              </label>

              {/* Radio Thu tiền ngay + Dropdown Tiền mặt */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontWeight: collectionType === "collected_now" ? 600 : 400,
                    fontSize: 13,
                    color: "#1e293b",
                  }}
                >
                  <input
                    type="radio"
                    name="voucherCollectionType"
                    checked={collectionType === "collected_now"}
                    onChange={() => handleToggleCollection("collected_now")}
                    style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
                  />
                  <span>Thu tiền ngay</span>
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    height: 26,
                    padding: "0 22px 0 8px",
                    borderRadius: 4,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    background: "#ffffff",
                    color: "#1e293b",
                    outline: "none",
                  }}
                >
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Ủy nhiệm chi">Ủy nhiệm chi</option>
                  <option value="Séc chuyển khoản">Séc chuyển khoản</option>
                  <option value="Thẻ tín dụng">Thẻ tín dụng</option>
                </select>
              </div>

              {/* Checkbox: Kiêm phiếu xuất (Chỉ hiện khi bán hàng hóa, ẩn ở bán dịch vụ) */}
              {!isService && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#1e293b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hasDeliveryNote}
                    onChange={(e) => setHasDeliveryNote(e.target.checked)}
                    style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
                  />
                  <span>Kiêm phiếu xuất</span>
                </label>
              )}

              {/* Checkbox: Lập kèm hóa đơn */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#1e293b",
                }}
              >
                <input
                  type="checkbox"
                  checked={hasInvoice}
                  onChange={(e) => setHasInvoice(e.target.checked)}
                  style={{ accentColor: "#00b06b", cursor: "pointer", width: 15, height: 15 }}
                />
                <span>Lập kèm hóa đơn</span>
              </label>
            </div>

            {/* Row 2: Sub-tabs (Chứng từ ghi nợ / Phiếu thu | Phiếu xuất | Hóa đơn) */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setVoucherTab("main")}
                style={{
                  background: "none",
                  border: "none",
                  padding: "6px 2px",
                  fontSize: 13,
                  fontWeight: voucherTab === "main" ? 600 : 400,
                  color: voucherTab === "main" ? "#00b06b" : "#64748b",
                  borderBottom: voucherTab === "main" ? "2px solid #00b06b" : "2px solid transparent",
                  cursor: "pointer",
                }}
              >
                {collectionType === "collected_now" ? "Phiếu thu" : "Chứng từ ghi nợ"}
              </button>

              {!isService && hasDeliveryNote && (
                <button
                  type="button"
                  onClick={() => setVoucherTab("delivery")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "6px 2px",
                    fontSize: 13,
                    fontWeight: voucherTab === "delivery" ? 600 : 400,
                    color: voucherTab === "delivery" ? "#00b06b" : "#64748b",
                    borderBottom: voucherTab === "delivery" ? "2px solid #00b06b" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Phiếu xuất
                </button>
              )}

              {hasInvoice && (
                <button
                  type="button"
                  onClick={() => setVoucherTab("invoice")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "6px 2px",
                    fontSize: 13,
                    fontWeight: voucherTab === "invoice" ? 600 : 400,
                    color: voucherTab === "invoice" ? "#00b06b" : "#64748b",
                    borderBottom: voucherTab === "invoice" ? "2px solid #00b06b" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hóa đơn
                </button>
              )}
            </div>
          </div>

          {/* Right Corner: Invoice Badge & Large Bold Total */}
          <div style={{ textAlign: "right", paddingBottom: 6 }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 12,
                background: "#f0fdf4",
                border: "1px solid #10b981",
                color: "#15803d",
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 4,
              }}
            >
              Đã lập hóa đơn
            </span>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {isService ? "Tổng tiền" : "Tổng tiền thanh toán"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", lineHeight: 1.15 }}>
              {formatVND(grandTotal)}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. MODAL BODY (SCROLLABLE)                                        */}
        {/* ================================================================= */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: "#ffffff",
          }}
        >
          {/* =============================================================== */}
          {/* MASTER INFO (EXACTLY MATCHING SCREENSHOTS 1, 2, 3, 4, 5)        */}
          {/* =============================================================== */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: DYNAMIC BASED ON voucherTab & collectionType      */}
            {/* ------------------------------------------------------------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* TAB: CHỨNG TỪ GHI NỢ / PHIẾU THU (main) */}
              {voucherTab === "main" && (
                <>
                  {/* Row 1 */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    {/* Mã khách hàng */}
                    <div style={{ width: 220, flexShrink: 0, position: "relative" }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Mã khách hàng
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            border: "1px solid #00b06b",
                            borderRadius: 4,
                            height: 28,
                            padding: "0 4px 0 6px",
                            background: "#ffffff",
                            flex: 1,
                          }}
                        >
                          <input
                            type="text"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value)}
                            onFocus={() => setShowCustomerDropdown(true)}
                            style={{ border: "none", outline: "none", width: "100%", height: "100%", padding: 0, background: "transparent", fontSize: 12.5 }}
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
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                        {/* ($) Button */}
                        <button
                          type="button"
                          onClick={() => notify(`Công nợ hiện tại của khách hàng: 64.000.000 đ`)}
                          title="Tra cứu công nợ khách hàng"
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
                          }}
                        >
                          $
                        </button>
                      </div>

                      {/* Customer dropdown */}
                      {showCustomerDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: 4,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            minWidth: 320,
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          <div style={{ padding: "6px 10px", fontSize: 11.5, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                            Chọn khách hàng:
                          </div>
                          {SAMPLE_SALE_CUSTOMERS.map((c) => (
                            <div
                              key={c.code}
                              onClick={() => handleSelectCustomer(c.code)}
                              style={{ padding: "6px 10px", fontSize: 12, borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <strong style={{ color: "#00b06b" }}>{c.code}</strong> - {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tên khách hàng */}
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

                    {/* Mã số thuế/CCCD chủ hộ (Only shown if uncollected) */}
                    {collectionType === "uncollected" && (
                      <div style={{ width: 180, flexShrink: 0 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Mã số thuế/CCCD chủ hộ
                        </label>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="text"
                            value={taxCode}
                            onChange={(e) => setTaxCode(e.target.value)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: 28,
                              padding: "0 8px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              fontSize: 12.5,
                              background: "transparent",
                              boxSizing: "border-box",
                            }}
                          />
                          <button
                            type="button"
                            title="Lấy thông tin từ cơ quan thuế"
                            onClick={() => notify("Lấy thông tin từ cơ quan thuế")}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              border: "1px solid #cbd5e1",
                              background: "#f1f5f9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              padding: 0,
                              color: "#64748b",
                              flexShrink: 0,
                              boxSizing: "border-box",
                            }}
                          >
                            <Globe size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2 */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    {/* Người liên hệ (Chưa thu) hoặc Người nộp (Thu ngay) */}
                    <div style={{ width: 220, flexShrink: 0 }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        {collectionType === "collected_now" ? "Người nộp" : "Người liên hệ"}
                      </label>
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

                    {/* Địa chỉ */}
                    <div style={{ flex: 1 }}>
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
                  </div>

                  {/* Row 3 */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    {/* Nhân viên bán hàng */}
                    <div style={{ width: 220, flexShrink: 0 }}>
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
                          value={salesPerson}
                          onChange={(e) => setSalesPerson(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                        />
                        <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                        <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                      </div>
                    </div>

                    {/* Diễn giải (Chưa thu) hoặc Lý do nộp (Thu ngay) */}
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        {collectionType === "collected_now" ? "Lý do nộp" : "Diễn giải"}
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
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                        />
                        <button
                          type="button"
                          onClick={handleAIAssistDescription}
                          title="AVA AI gợi ý diễn giải tự động"
                          style={{ background: "none", border: "none", color: "#8b5cf6", cursor: "pointer", padding: "2px" }}
                        >
                          <Sparkles size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Thu tiền ngay: Kèm theo ... Chứng từ gốc */}
                    {collectionType === "collected_now" && (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <div>
                          <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                            Kèm theo
                          </label>
                          <input
                            type="text"
                            placeholder="Số lượng"
                            value={attachQuantity}
                            onChange={(e) => setAttachQuantity(e.target.value)}
                            style={{
                              width: 70,
                              height: 28,
                              padding: "0 6px",
                              border: "1px solid #cbd5e1",
                              borderRadius: 4,
                              fontSize: 12,
                              boxSizing: "border-box",
                              textAlign: "center",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12.5, color: "#334155", paddingBottom: 5 }}>Chứng từ gốc</span>
                      </div>
                    )}
                  </div>

                  {/* Row 4: Type 3 (Đại lý) & Type 4 (Ủy thác) */}
                  {(saleType === 3 || saleType === 4) ? (
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                      <div style={{ width: 260, flexShrink: 0 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          {saleType === 4 ? "Đơn vị ủy thác" : "Đơn vị giao đại lý"}
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
                            value={saleType === 4 ? trusteeUnit : agencyUnit}
                            onChange={(e) =>
                              saleType === 4 ? setTrusteeUnit(e.target.value) : setAgencyUnit(e.target.value)
                            }
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                          />
                          <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                          <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                        </div>
                      </div>

                      <div style={{ paddingBottom: 4 }}>
                        <button
                          type="button"
                          onClick={() => notify("Chọn chứng từ tham chiếu")}
                          style={{ background: "none", border: "none", color: "#00b06b", fontSize: 12.5, cursor: "pointer", padding: 0 }}
                        >
                          Tham chiếu ...
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => notify("Chọn chứng từ tham chiếu")}
                        style={{ background: "none", border: "none", color: "#00b06b", fontSize: 12.5, cursor: "pointer", padding: 0 }}
                      >
                        Tham chiếu ...
                      </button>
                    </div>
                  )}

                  {/* Row 6: Điều khoản thanh toán (Chỉ có khi Chưa thu tiền) */}
                  {collectionType === "uncollected" && (
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                      {/* ▾ Điều khoản thanh toán */}
                      <div style={{ width: 220, flexShrink: 0 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          ▾ Điều khoản thanh toán
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
                            value={paymentTerm}
                            onChange={(e) => {
                              setPaymentTerm(e.target.value);
                              if (e.target.value === "NET30") setDebtDays(30);
                              else if (e.target.value === "NET45") setDebtDays(45);
                              else setDebtDays(0);
                            }}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }}
                          >
                            <option value=""></option>
                            <option value="TTN">Thanh toán ngay</option>
                            <option value="NET30">Gối nợ 30 ngày</option>
                            <option value="NET45">Gối nợ 45 ngày</option>
                          </select>
                          <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                          <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                        </div>
                      </div>

                      {/* Số ngày được nợ */}
                      <div style={{ width: 120 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Số ngày được nợ
                        </label>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
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

                      {/* Hạn thanh toán */}
                      <div style={{ width: 140 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Hạn thanh toán
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
                            value={paymentDueDate}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                          />
                          <Calendar size={13} style={{ color: "#94a3b8" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB: PHIẾU XUẤT (delivery) */}
              {voucherTab === "delivery" && (
                <>
                  {/* Row 1: Mã KH & Tên KH */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    <div style={{ width: 220, flexShrink: 0, position: "relative" }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Mã khách hàng
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            border: "1px solid #00b06b",
                            borderRadius: 4,
                            height: 28,
                            padding: "0 4px 0 6px",
                            background: "#ffffff",
                            flex: 1,
                          }}
                        >
                          <input
                            type="text"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value)}
                            onFocus={() => setShowCustomerDropdown(true)}
                            style={{ border: "none", outline: "none", width: "100%", height: "100%", padding: 0, background: "transparent", fontSize: 12.5 }}
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
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => notify(`Công nợ hiện tại của khách hàng: 64.000.000 đ`)}
                          title="Tra cứu công nợ khách hàng"
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
                          }}
                        >
                          $
                        </button>
                      </div>

                      {showCustomerDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: 4,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            minWidth: 320,
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          <div style={{ padding: "6px 10px", fontSize: 11.5, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                            Chọn khách hàng:
                          </div>
                          {SAMPLE_SALE_CUSTOMERS.map((c) => (
                            <div
                              key={c.code}
                              onClick={() => handleSelectCustomer(c.code)}
                              style={{ padding: "6px 10px", fontSize: 12, borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <strong style={{ color: "#00b06b" }}>{c.code}</strong> - {c.name}
                            </div>
                          ))}
                        </div>
                      )}
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

                  {/* Row 2: Người nhận & Địa chỉ */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    <div style={{ width: 220, flexShrink: 0 }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Người nhận
                      </label>
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
                    <div style={{ flex: 1 }}>
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
                  </div>

                  {/* Row 3: Nhân viên bán hàng & Lý do xuất */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    <div style={{ width: 220, flexShrink: 0 }}>
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
                          value={salesPerson}
                          onChange={(e) => setSalesPerson(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                        />
                        <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                        <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Lý do xuất
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
                          value={deliveryReason}
                          onChange={(e) => setDeliveryReason(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                        />
                        <Sparkles size={14} style={{ color: "#8b5cf6", cursor: "pointer" }} />
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Kèm theo ... Chứng từ gốc & Tham chiếu */}
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                      <div>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Kèm theo
                        </label>
                        <input
                          type="text"
                          placeholder="Số lượng"
                          value={deliveryAttachQuantity}
                          onChange={(e) => setDeliveryAttachQuantity(e.target.value)}
                          style={{
                            width: 70,
                            height: 28,
                            padding: "0 6px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12,
                            boxSizing: "border-box",
                            textAlign: "center",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12.5, color: "#334155", paddingBottom: 5 }}>Chứng từ gốc</span>
                    </div>

                    <div style={{ paddingTop: 18 }}>
                      <button
                        type="button"
                        onClick={() => notify("Chọn chứng từ tham chiếu")}
                        style={{ background: "none", border: "none", color: "#00b06b", fontSize: 12.5, cursor: "pointer", padding: 0 }}
                      >
                        Tham chiếu ...
                      </button>
                    </div>
                  </div>

                  {/* Row 5: Điều khoản thanh toán (Chỉ có khi Chưa thu tiền) */}
                  {collectionType === "uncollected" && (
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                      <div style={{ width: 220, flexShrink: 0 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          ▾ Điều khoản thanh toán
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
                            value={paymentTerm}
                            onChange={(e) => {
                              setPaymentTerm(e.target.value);
                              if (e.target.value === "NET30") setDebtDays(30);
                              else if (e.target.value === "NET45") setDebtDays(45);
                              else setDebtDays(0);
                            }}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }}
                          >
                            <option value=""></option>
                            <option value="TTN">Thanh toán ngay</option>
                            <option value="NET30">Gối nợ 30 ngày</option>
                            <option value="NET45">Gối nợ 45 ngày</option>
                          </select>
                          <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                          <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                        </div>
                      </div>

                      <div style={{ width: 120 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Số ngày được nợ
                        </label>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
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

                      <div style={{ width: 140 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Hạn thanh toán
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
                            value={paymentDueDate}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                          />
                          <Calendar size={13} style={{ color: "#94a3b8" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB: HÓA ĐƠN (invoice) */}
              {voucherTab === "invoice" && (
                <>
                  {/* Row 1: Mã KH & Tên KH */}
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                    <div style={{ width: 220, flexShrink: 0, position: "relative" }}>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Mã khách hàng
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            border: "1px solid #00b06b",
                            borderRadius: 4,
                            height: 28,
                            padding: "0 4px 0 6px",
                            background: "#ffffff",
                            flex: 1,
                          }}
                        >
                          <input
                            type="text"
                            value={customerCode}
                            onChange={(e) => setCustomerCode(e.target.value)}
                            onFocus={() => setShowCustomerDropdown(true)}
                            style={{ border: "none", outline: "none", width: "100%", height: "100%", padding: 0, background: "transparent", fontSize: 12.5 }}
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
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px", display: "grid", placeItems: "center" }}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => notify(`Công nợ hiện tại của khách hàng: 64.000.000 đ`)}
                          title="Tra cứu công nợ khách hàng"
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
                          }}
                        >
                          $
                        </button>
                      </div>

                      {showCustomerDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            marginTop: 4,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                            zIndex: 100,
                            minWidth: 320,
                            maxHeight: 200,
                            overflowY: "auto",
                          }}
                        >
                          <div style={{ padding: "6px 10px", fontSize: 11.5, background: "#f8fafc", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                            Chọn khách hàng:
                          </div>
                          {SAMPLE_SALE_CUSTOMERS.map((c) => (
                            <div
                              key={c.code}
                              onClick={() => handleSelectCustomer(c.code)}
                              style={{ padding: "6px 10px", fontSize: 12, borderBottom: "1px solid #f1f5f9", cursor: "pointer" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                            >
                              <strong style={{ color: "#00b06b" }}>{c.code}</strong> - {c.name}
                            </div>
                          ))}
                        </div>
                      )}
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

                  {/* Row 2: 4 columns: MST, Mã số ĐVQHNS, Số CCCD, Số hộ chiếu */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.2fr", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Mã số thuế/CCCD chủ hộ
                      </label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="text"
                          value={taxCode}
                          onChange={(e) => setTaxCode(e.target.value)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            height: 28,
                            padding: "0 8px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            background: "transparent",
                            boxSizing: "border-box",
                          }}
                        />
                        <button
                          type="button"
                          title="Lấy thông tin từ cơ quan thuế"
                          onClick={() => notify("Lấy thông tin từ cơ quan thuế")}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 4,
                            border: "1px solid #cbd5e1",
                            background: "#f1f5f9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            padding: 0,
                            color: "#64748b",
                            flexShrink: 0,
                            boxSizing: "border-box",
                          }}
                        >
                          <Globe size={13} />
                        </button>
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
                          value={citizenId}
                          onChange={(e) => setCitizenId(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                        />
                        <Search size={13} style={{ color: "#94a3b8" }} />
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

                  {/* Row 3: 4 columns: Địa chỉ (span 2), Điện thoại, Email */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.2fr", gap: 14 }}>
                    <div style={{ gridColumn: "span 2" }}>
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
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
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
                        type="text"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
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

                  {/* Row 4: 4 columns: Người mua hàng ℹ️, Ngày sinh, Hình thức thanh toán, Tài khoản ngân hàng (nếu không phải Tiền mặt) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.2fr", gap: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                        <label style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
                          Người mua hàng
                        </label>
                        <Info size={12} style={{ color: "#3b82f6" }} />
                      </div>
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
                          value={buyerBirthDate}
                          onChange={(e) => setBuyerBirthDate(e.target.value)}
                          style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                        />
                        <Calendar size={13} style={{ color: "#94a3b8" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Hình thức thanh toán
                      </label>
                      <select
                        value={paymentMethodType}
                        onChange={(e) => setPaymentMethodType(e.target.value)}
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
                        <option value="Tiền mặt">Tiền mặt</option>
                        <option value="TM/CK">TM/CK</option>
                        <option value="Chuyển khoản">Chuyển khoản</option>
                      </select>
                    </div>

                    {paymentMethodType !== "Tiền mặt" ? (
                      <div>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Tài khoản ngân hàng
                        </label>
                        <select
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
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
                          <option value="">-- Chọn TK ngân hàng --</option>
                          <option value="VCB">VCB - 0011001234567</option>
                          <option value="TCB">TCB - 19034567890123</option>
                          <option value="MBB">MBB - 0680123456789</option>
                        </select>
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>

                  {/* Row 5: 4 columns: Tỉnh/Thành phố, Xã/Phường, Tham chiếu */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1.2fr 1.2fr", gap: 14, alignItems: "flex-end" }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Tỉnh/Thành phố
                      </label>
                      <select
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
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
                        <option value=""></option>
                        <option value="Hà Nội">Hà Nội</option>
                        <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                        <option value="Đà Nẵng">Đà Nẵng</option>
                        <option value="Hải Phòng">Hải Phòng</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Xã/Phường
                      </label>
                      <select
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
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
                        <option value=""></option>
                        <option value="Phường Láng Hạ">Phường Láng Hạ</option>
                        <option value="Phường Bến Nghé">Phường Bến Nghé</option>
                        <option value="Phường Điện Biên">Phường Điện Biên</option>
                      </select>
                    </div>

                    <div style={{ paddingBottom: 4 }}>
                      <button
                        type="button"
                        onClick={() => notify("Chọn chứng từ tham chiếu")}
                        style={{ background: "none", border: "none", color: "#00b06b", fontSize: 12.5, cursor: "pointer", padding: 0 }}
                      >
                        Tham chiếu ...
                      </button>
                    </div>

                    <div />
                  </div>

                  {/* Row 6: Điều khoản thanh toán (Chỉ có khi Chưa thu tiền) */}
                  {collectionType === "uncollected" && (
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
                      <div style={{ width: 220, flexShrink: 0 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          ▾ Điều khoản thanh toán
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
                            value={paymentTerm}
                            onChange={(e) => {
                              setPaymentTerm(e.target.value);
                              if (e.target.value === "NET30") setDebtDays(30);
                              else if (e.target.value === "NET45") setDebtDays(45);
                              else setDebtDays(0);
                            }}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12, background: "transparent" }}
                          >
                            <option value=""></option>
                            <option value="TTN">Thanh toán ngay</option>
                            <option value="NET30">Gối nợ 30 ngày</option>
                            <option value="NET45">Gối nợ 45 ngày</option>
                          </select>
                          <Plus size={13} style={{ color: "#00b06b", cursor: "pointer", marginRight: 2 }} />
                          <ChevronDown size={13} style={{ color: "#64748b", cursor: "pointer" }} />
                        </div>
                      </div>

                      <div style={{ width: 120 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Số ngày được nợ
                        </label>
                        <input
                          type="text"
                          value={debtDays}
                          onChange={(e) => setDebtDays(e.target.value)}
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

                      <div style={{ width: 140 }}>
                        <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Hạn thanh toán
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
                            value={paymentDueDate}
                            onChange={(e) => setPaymentDueDate(e.target.value)}
                            style={{ border: "none", outline: "none", width: "100%", fontSize: 12 }}
                          />
                          <Calendar size={13} style={{ color: "#94a3b8" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: VOUCHER METADATA BASED ON voucherTab            */}
            {/* ------------------------------------------------------------- */}
            <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {voucherTab !== "invoice" ? (
                <>
                  {/* Row 1: Ngày hạch toán */}
                  <div>
                    <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Ngày hạch toán
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
                        value={postingDate}
                        onChange={(e) => setPostingDate(e.target.value)}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                      />
                      <Calendar size={13} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>

                  {/* Row 2: Ngày chứng từ / Ngày phiếu thu */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <label style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
                        {voucherTab === "main" && collectionType === "collected_now"
                          ? "Ngày phiếu thu"
                          : "Ngày chứng từ"}
                      </label>
                      <Info size={12} style={{ color: "#3b82f6" }} />
                    </div>
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
                        value={voucherDate}
                        onChange={(e) => setVoucherDate(e.target.value)}
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                      />
                      <Calendar size={13} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>

                  {/* Row 3: Số chứng từ / Số phiếu xuất / Số phiếu thu */}
                  <div>
                    <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      {voucherTab === "delivery"
                        ? "Số phiếu xuất"
                        : voucherTab === "main" && collectionType === "collected_now"
                        ? "Số phiếu thu"
                        : "Số chứng từ"}
                    </label>
                    <input
                      type="text"
                      value={voucherTab === "delivery" ? deliveryCode : voucherCode}
                      onChange={(e) => {
                        if (voucherTab === "delivery") setDeliveryCode(e.target.value);
                        else setVoucherCode(e.target.value);
                      }}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Tab Hóa đơn: 4 items: Mẫu số HĐ, Ký hiệu HĐ, Số hóa đơn, Ngày HĐ */}
                  <div>
                    <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Mẫu số HĐ
                    </label>
                    <input
                      type="text"
                      value={invoiceForm}
                      onChange={(e) => setInvoiceForm(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Ký hiệu HĐ
                    </label>
                    <input
                      type="text"
                      value={invoiceSerial}
                      onChange={(e) => setInvoiceSerial(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                      Số hóa đơn
                    </label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        boxSizing: "border-box",
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                      <label style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>
                        Ngày HĐ
                      </label>
                      <Info size={12} style={{ color: "#3b82f6" }} />
                    </div>
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
                        style={{ border: "none", outline: "none", width: "100%", fontSize: 12.5 }}
                      />
                      <Calendar size={13} style={{ color: "#94a3b8" }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* =============================================================== */}
          {/* 4. DETAIL TABLE TABS & CONTROLS                                 */}
          {/* =============================================================== */}
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #cbd5e1",
                paddingBottom: 4,
                marginBottom: 8,
              }}
            >
              {/* Left tabs: Hàng tiền | Giá vốn */}
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  type="button"
                  onClick={() => setDetailTab("items")}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "4px 2px",
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: detailTab === "items" ? "#00b06b" : "#64748b",
                    borderBottom: detailTab === "items" ? "2px solid #00b06b" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hàng tiền
                </button>

                {!isService && (
                  <button
                    type="button"
                    onClick={() => setDetailTab("cogs")}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "4px 2px",
                      fontWeight: 600,
                      fontSize: 13.5,
                      color: detailTab === "cogs" ? "#00b06b" : "#64748b",
                      borderBottom: detailTab === "cogs" ? "2px solid #00b06b" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Giá vốn
                  </button>
                )}
              </div>

              {/* Right controls: Gợi ý hồ sơ AVA AI / AVA Kế toán | Chiết khấu */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  type="button"
                  onClick={handleAIAssistProfile}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    borderRadius: 14,
                    background: isService ? "#f5f3ff" : "#eff6ff",
                    border: isService ? "1px solid #ddd6fe" : "1px solid #bfdbfe",
                    color: isService ? "#7c3aed" : "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: isService ? "#7c3aed" : "#2563eb",
                      display: "grid",
                      placeItems: "center",
                      color: "#ffffff",
                      fontSize: 9,
                    }}
                  >
                    🤖
                  </div>
                  <span>{isService ? "AVA Kế toán" : "Gợi ý hồ sơ"}</span>
                  {isService && <ChevronDown size={12} />}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
                  <span>Chiết khấu</span>
                  <select
                    value={discountMode}
                    onChange={(e) => setDiscountMode(e.target.value)}
                    style={{
                      height: 26,
                      padding: "0 22px 0 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="Không chiết khấu">Không chiết khấu</option>
                    <option value="Chiết khấu theo dòng">Chiết khấu theo dòng</option>
                    <option value="Chiết khấu theo hóa đơn">Chiết khấu theo hóa đơn</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: HÀNG TIỀN */}
            {detailTab === "items" && (
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  overflowX: "auto",
                  background: "#ffffff",
                  position: "relative",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                  <thead>
                    {isService ? (
                      <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                        <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                        <th style={{ width: 110, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Pin size={12} style={{ color: "#64748b" }} />
                            <span>Mã hàng</span>
                          </div>
                        </th>
                        <th style={{ minWidth: 200, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Tên dịch vụ
                        </th>
                        {showAccounts && (
                          <>
                            <th style={{ width: 95, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              {collectionType === "collected_now" ? "TK tiền" : "TK công nợ"}
                            </th>
                            <th style={{ width: 95, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              TK doanh thu
                            </th>
                          </>
                        )}
                        <th style={{ width: 60, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          ĐVT
                        </th>
                        <th style={{ width: 85, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Số lượng
                        </th>
                        <th style={{ width: 100, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Đơn giá
                        </th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Thành tiền
                        </th>
                        <th
                          onMouseEnter={() => setShowVatTooltip(true)}
                          onMouseLeave={() => setShowVatTooltip(false)}
                          style={{
                            width: 90,
                            textAlign: "right",
                            borderRight: "1px solid #cbd5e1",
                            padding: "4px 8px",
                            cursor: "help",
                            position: "relative",
                          }}
                        >
                          % Thuế GTGT
                        </th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Tiền thuế GTGT
                        </th>
                        <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                      </tr>
                    ) : (
                      <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                        <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                        <th style={{ width: 120, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Pin size={12} style={{ color: "#64748b" }} />
                            <span>Mã hàng</span>
                          </div>
                        </th>
                        <th style={{ minWidth: 200, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Tên hàng
                        </th>
                        <th style={{ width: 60, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span>ĐVT</span>
                            <FileText size={11} style={{ color: "#00b06b" }} />
                          </div>
                        </th>
                        <th style={{ width: 85, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Số lượng
                        </th>

                        {/* Type 1: Chiết khấu thương mại */}
                        {saleType === 1 && (
                          <th style={{ width: 130, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px 6px" }}>
                            Chiết khấu thương mại
                          </th>
                        )}

                        {/* Accounts columns based on saleType & collectionType */}
                        {showAccounts && (
                          <>
                            {saleType === 1 && (
                              <>
                                <th style={{ width: 85, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  {collectionType === "collected_now" ? "TK tiền" : "TK công nợ"}
                                </th>
                                <th style={{ width: 95, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  TK doanh thu
                                </th>
                              </>
                            )}
                            {saleType === 2 && (
                              <>
                                <th style={{ width: 130, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  {collectionType === "collected_now" ? "TK tiền/ chi phí" : "TK công nợ/ chi phí"}
                                </th>
                                <th style={{ width: 95, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  TK doanh thu
                                </th>
                              </>
                            )}
                            {(saleType === 3 || saleType === 4) && (
                              <>
                                <th style={{ width: 85, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  TK nợ
                                </th>
                                <th style={{ width: 85, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                                  TK có
                                </th>
                              </>
                            )}
                          </>
                        )}

                        <th style={{ width: 100, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Đơn giá
                        </th>
                        <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                          Thành tiền
                        </th>

                        {/* Tax columns: Type 1 vs Type 3 vs Type 2 vs Type 4 */}
                        {saleType === 1 && (
                          <>
                            <th
                              onMouseEnter={() => setShowVatTooltip(true)}
                              onMouseLeave={() => setShowVatTooltip(false)}
                              style={{
                                width: 90,
                                textAlign: "right",
                                borderRight: "1px solid #cbd5e1",
                                padding: "4px 8px",
                                cursor: "help",
                                position: "relative",
                              }}
                            >
                              % Thuế GTGT
                            </th>
                            <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              Tiền thuế GTGT
                            </th>
                          </>
                        )}

                        {(saleType === 3 || saleType === 4) && (
                          <th style={{ width: 100, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                            % Thuế GTGT
                          </th>
                        )}

                        {saleType === 2 && (
                          <>
                            <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              Giá tính thuế XK
                            </th>
                            <th style={{ width: 100, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              % thuế XK
                            </th>
                            <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>
                              Tiền thuế XK
                            </th>
                          </>
                        )}

                        <th style={{ width: 36, textAlign: "center", padding: "4px" }}></th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {isService ? (
                      items.map((it, idx) => (
                        <tr
                          key={it.id}
                          style={{
                            borderBottom: "1px solid #e2e8f0",
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
                              list={`voucher-catalog-items-${idx}`}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                            <datalist id={`voucher-catalog-items-${idx}`}>
                              {SAMPLE_SALE_ITEMS.map((si) => (
                                <option key={si.code} value={si.code}>{si.name}</option>
                              ))}
                            </datalist>
                          </td>

                          {/* Tên dịch vụ */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                          </td>

                          {/* TK công nợ & TK doanh thu */}
                          {showAccounts && (
                            <>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <FileText size={11} style={{ color: "#00b06b", flexShrink: 0 }} />
                                  <input
                                    type="text"
                                    value={it.debitAccount}
                                    onChange={(e) => handleItemChange(idx, "debitAccount", e.target.value)}
                                    style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                                  />
                                </div>
                              </td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                                <input
                                  type="text"
                                  value={it.creditAccount}
                                  onChange={(e) => handleItemChange(idx, "creditAccount", e.target.value)}
                                  style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                                />
                              </td>
                            </>
                          )}

                          {/* ĐVT */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                            <input
                              type="text"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Số lượng */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="text"
                              value={it.quantity === 0 ? "0,00" : it.quantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value.replace(",", "."))}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Đơn giá */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                            <input
                              type="text"
                              value={it.unitPrice === 0 ? "0,00" : formatVND(it.unitPrice)}
                              onChange={(e) => {
                                const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                                handleItemChange(idx, "unitPrice", v);
                              }}
                              style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                            />
                          </td>

                          {/* Thành tiền */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                            {it.amount === 0 ? "0" : formatVND(it.amount)}
                          </td>

                          {/* % Thuế GTGT */}
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "right" }}>
                            <select
                              value={it.vatRate}
                              onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                              style={{ border: "none", background: "transparent", fontSize: 12.5, outline: "none", width: "100%", textAlign: "right" }}
                            >
                              <option value=""></option>
                              <option value="0">0%</option>
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

                          {/* Delete row */}
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
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      items.map((it, idx) => (
                      <tr
                        key={it.id}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
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
                            list={`voucher-catalog-items-${idx}`}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                          />
                          <datalist id={`voucher-catalog-items-${idx}`}>
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

                        {/* Số lượng */}
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={it.quantity === 0 ? "0,00" : Number(it.quantity).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value.replace(",", "."))}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                          />
                        </td>

                        {/* Type 1: Chiết khấu thương mại checkbox */}
                        {saleType === 1 && (
                          <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "center", padding: "2px" }}>
                            <input
                              type="checkbox"
                              checked={!!it.tradeDiscount}
                              onChange={(e) => handleItemChange(idx, "tradeDiscount", e.target.checked)}
                              style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
                            />
                          </td>
                        )}

                        {/* Accounts */}
                        {showAccounts && (
                          <>
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                              <input
                                type="text"
                                value={it.debitAccount}
                                onChange={(e) => handleItemChange(idx, "debitAccount", e.target.value)}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px" }}>
                              <input
                                type="text"
                                value={it.creditAccount}
                                onChange={(e) => handleItemChange(idx, "creditAccount", e.target.value)}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: 12.5 }}
                              />
                            </td>
                          </>
                        )}

                        {/* Đơn giá */}
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                          <input
                            type="text"
                            value={it.unitPrice === 0 ? "0,00" : formatVND(it.unitPrice)}
                            onChange={(e) => {
                              const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                              handleItemChange(idx, "unitPrice", v);
                            }}
                            style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                          />
                        </td>

                        {/* Thành tiền */}
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                          {it.amount === 0 ? "0" : formatVND(it.amount)}
                        </td>

                        {/* Taxes for Type 1 */}
                        {saleType === 1 && (
                          <>
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
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                              {it.vatAmount === 0 ? "0" : formatVND(it.vatAmount)}
                            </td>
                          </>
                        )}

                        {/* Taxes for Type 3 (Bán hàng đại lý bán đúng giá) & Type 4 (Bán hàng ủy thác xuất khẩu) */}
                        {(saleType === 3 || saleType === 4) && (
                          <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "right" }}>
                            <select
                              value={it.vatRate || "0"}
                              onChange={(e) => handleItemChange(idx, "vatRate", e.target.value)}
                              style={{ border: "none", background: "transparent", fontSize: 12.5, outline: "none", width: "100%", textAlign: "right" }}
                            >
                              <option value="0">0</option>
                              <option value="5">5</option>
                              <option value="8">8</option>
                              <option value="10">10</option>
                              <option value="KCT">KCT</option>
                            </select>
                          </td>
                        )}

                        {/* Taxes for Type 2 (Xuất khẩu) */}
                        {saleType === 2 && (
                          <>
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                              <input
                                type="number"
                                value={it.exportTaxBase || 0}
                                onChange={(e) => handleItemChange(idx, "exportTaxBase", Number(e.target.value) || 0)}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 6px", textAlign: "right" }}>
                              <input
                                type="text"
                                value={it.exportTaxRate === 0 ? "0,00" : it.exportTaxRate}
                                onChange={(e) => handleItemChange(idx, "exportTaxRate", Number(e.target.value) || 0)}
                                style={{ width: "100%", border: "none", outline: "none", background: "transparent", textAlign: "right", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                              {it.exportTaxAmount === 0 ? "0" : formatVND(it.exportTaxAmount || 0)}
                            </td>
                          </>
                        )}

                        {/* Delete row */}
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
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* SUMMARY ROW (MATCHING SCREENSHOTS) */}
                  {isService ? (
                    <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      {showAccounts && (
                        <>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        </>
                      )}
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                        {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                        {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                      </td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                        {totalVat === 0 ? "0" : formatVND(totalVat)}
                      </td>
                      <td></td>
                    </tr>
                  ) : (
                    <tr style={{ background: "#f8fafc", fontWeight: 600, height: 30, borderBottom: "1px solid #cbd5e1" }}>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                        {totalQuantity.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {saleType === 1 && <td style={{ borderRight: "1px solid #cbd5e1" }}></td>}
                      {showAccounts && (
                        <>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                        </>
                      )}
                      <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                        {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                      </td>
                      {saleType === 1 && (
                        <>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                            {totalVat === 0 ? "0" : formatVND(totalVat)}
                          </td>
                        </>
                      )}
                      {(saleType === 3 || saleType === 4) && (
                        <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                      )}
                      {saleType === 2 && (
                        <>
                          <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>0</td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1", textAlign: "right", padding: "2px 8px" }}>
                            {totalExportTax === 0 ? "0" : formatVND(totalExportTax)}
                          </td>
                        </>
                      )}
                      <td></td>
                    </tr>
                  )}
                  </tbody>
                </table>

                {/* Tooltip hovering on % Thuế GTGT as shown in Screenshot 1 */}
                {showVatTooltip && (
                  <div
                    style={{
                      position: "absolute",
                      top: 36,
                      right: 150,
                      background: "#1e293b",
                      color: "#ffffff",
                      padding: "6px 10px",
                      borderRadius: 4,
                      fontSize: 11.5,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                      zIndex: 80,
                      pointerEvents: "none",
                    }}
                  >
                    Tra cứu mặt hàng giảm thuế theo quy định (Ctrl + F3)
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: GIÁ VỐN */}
            {detailTab === "cogs" && (
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflowX: "auto", background: "#ffffff" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#e8f2ec", color: "#1e293b", height: 32 }}>
                      <th style={{ width: 36, textAlign: "center", borderRight: "1px solid #cbd5e1", padding: "4px" }}>#</th>
                      <th style={{ width: 120, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Mã hàng</th>
                      <th style={{ width: 220, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Tên hàng</th>
                      <th style={{ width: 90, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Kho xuất</th>
                      <th style={{ width: 90, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>TK giá vốn</th>
                      <th style={{ width: 90, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>TK kho</th>
                      <th style={{ width: 70, textAlign: "left", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>ĐVT</th>
                      <th style={{ width: 85, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Số lượng</th>
                      <th style={{ width: 110, textAlign: "right", borderRight: "1px solid #cbd5e1", padding: "4px 8px" }}>Đơn giá vốn</th>
                      <th style={{ width: 120, textAlign: "right", padding: "4px 8px" }}>Tiền vốn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #e2e8f0", height: 32 }}>
                        <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", color: "#0284c7" }}>{it.code || "—"}</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px" }}>{it.name || "—"}</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px" }}>Kho 1561</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px" }}>632</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px" }}>1561</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px" }}>{it.unit || "—"}</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>{it.quantity}</td>
                        <td style={{ borderRight: "1px solid #cbd5e1", padding: "2px 8px", textAlign: "right" }}>
                          {formatVND(Math.round(it.unitPrice * 0.7))}
                        </td>
                        <td style={{ padding: "2px 8px", textAlign: "right", fontWeight: 600 }}>
                          {formatVND(Math.round(it.amount * 0.7))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              {/* Left Column: Action Buttons & Shipping / E-commerce Form */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      style={{
                        height: 28,
                        padding: "0 10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        color: "#334155",
                      }}
                    >
                      <Plus size={13} />
                      <span>Thêm dòng</span>
                    </button>

                    {isService ? (
                      <>
                        <button
                          type="button"
                          onClick={handleAIAssistDescription}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
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
                            height: 28,
                            padding: "0 10px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#dc2626",
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Xóa hết dòng</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleClearAllItems}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#dc2626",
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Xóa hết dòng</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAIAssistDescription}
                          style={{
                            height: 28,
                            padding: "0 10px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            fontSize: 12.5,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "#334155",
                          }}
                        >
                          <FileText size={13} />
                          <span>Thêm ghi chú</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Checkbox: Là hóa đơn thay thế */}
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={isReplacementInvoice}
                      onChange={(e) => setIsReplacementInvoice(e.target.checked)}
                      style={{ cursor: "pointer", width: 14, height: 14, accentColor: "#00b06b" }}
                    />
                    <span>Là hóa đơn thay thế</span>
                  </label>
                </div>

                {/* Shipping & E-commerce Block for Normal vs Service Sales */}
                {isService ? (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      background: "#ffffff",
                    }}
                  >
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

                    {/* Row 2: Điều khoản khác */}
                    <div>
                      <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Điều khoản khác
                      </label>
                      <textarea
                        rows={2}
                        value={otherTerms}
                        onChange={(e) => setOtherTerms(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12,
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                          resize: "none",
                        }}
                      />
                    </div>

                    {/* Row 3: Mã tra cứu HĐĐT | Đường dẫn tra cứu HĐĐT */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Mã tra cứu HĐĐT
                        </label>
                        <input
                          type="text"
                          value={invoiceLookupCode}
                          onChange={(e) => setInvoiceLookupCode(e.target.value)}
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
                          value={invoiceLookupUrl}
                          onChange={(e) => setInvoiceLookupUrl(e.target.value)}
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
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      background: "#ffffff",
                    }}
                  >
                    {/* Row 1: Số đơn hàng từ hệ thống khác | Sàn TMĐT | Ngày giao hàng */}
                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                          Số đơn hàng từ hệ thống khác
                        </label>
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

                    {/* Row 2: Tên shop */}
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

                    {/* Row 4: Địa điểm giao hàng (Screenshots 2, 4, 5) */}
                    <div>
                      <label style={{ fontSize: 11.5, color: "#334155", display: "block", marginBottom: 3, fontWeight: 500 }}>
                        Địa điểm giao hàng
                      </label>
                      <input
                        type="text"
                        value={shippingAddress}
                        onChange={(e) => setShippingAddress(e.target.value)}
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
                )}
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

                {/* Totals summary matching Screenshots 1, 2, 3, 4, 5 & Service Sale */}
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
                  {isService ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Tổng tiền dịch vụ</span>
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
                    </>
                  ) : saleType === 4 ? (
                    <>
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
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Thuế xuất khẩu</span>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalExportTax === 0 ? "0" : formatVND(totalExportTax)}</span>
                      </div>
                    </>
                  ) : saleType === 2 ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Tổng tiền hàng</span>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalAmount === 0 ? "0" : formatVND(totalAmount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155", fontWeight: 700 }}>
                        <span>Tổng tiền thanh toán</span>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>{grandTotal === 0 ? "0" : formatVND(grandTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#334155" }}>
                        <span>Thuế xuất khẩu</span>
                        <span style={{ fontWeight: 600, color: "#1e293b" }}>{totalExportTax === 0 ? "0" : formatVND(totalExportTax)}</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Shortcut hints matching screenshot */}
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, userSelect: "none" }}>
              F3 - Tìm nhanh, F9 - Thêm nhanh
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 6. BOTTOM BAR & MODAL FOOTER                                      */}
        {/* ================================================================= */}
        <div
          style={{
            height: 46,
            padding: "0 18px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          {/* Left: Switch Hiển thị tài khoản */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 13,
                color: "#334155",
              }}
            >
              <div
                onClick={() => setShowAccounts(!showAccounts)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: showAccounts ? "#00b06b" : "#cbd5e1",
                  position: "relative",
                  transition: "background 0.2s ease",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#ffffff",
                    position: "absolute",
                    top: 2,
                    left: showAccounts ? 18 : 2,
                    transition: "left 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }}
                />
              </div>
              <span>Hiển thị tài khoản</span>
            </label>
          </div>

          {/* Right: Hủy, Cất, Cất và In */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 32,
                padding: "0 16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
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
                height: 32,
                padding: "0 18px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                color: "#1e293b",
                cursor: "pointer",
              }}
            >
              Cất
            </button>

            <div style={{ display: "inline-flex" }}>
              <button
                type="button"
                onClick={() => handleSave(true)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "none",
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                  background: "#00a862",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Cất và In</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                style={{
                  height: 32,
                  padding: "0 6px",
                  border: "none",
                  borderLeft: "1px solid rgba(255,255,255,0.3)",
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
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
  );
}
