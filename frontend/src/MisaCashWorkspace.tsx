import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Filter,
  Plus,
  Search,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  Info,
  X,
  Check,
  Download,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ClipboardList,
  Coins,
  HelpCircle,
  MessageSquare,
  UserRound,
  Building2,
  Users,
  SlidersHorizontal,
  Trash2,
  Paperclip,
  Upload,
  RotateCcw,
  FileText,
  Calendar,
  Star,
  BookOpen,
  BarChart3,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";
import {
  SingleCustomerInvoiceCollectionModal,
  MultiCustomerInvoiceCollectionModal,
} from "./MisaInvoiceCollectionModals";
import {
  InsurancePaymentModal,
  SalaryPaymentModal,
  InternalTransferModal,
  MisaEmptyState,
} from "./MisaBankModals";
import "./misa-cash.css";


// Helper format tiền tệ VNĐ
export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// Helper chuyển đổi số tiền thành chữ tiếng Việt chuẩn kế toán
export function convertNumberToVietnameseWords(n: number): string {
  if (!n || isNaN(n) || n === 0) return "Không đồng";
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const teens = [
    "mười",
    "mười một",
    "mười hai",
    "mười ba",
    "mười bốn",
    "mười lăm",
    "mười sáu",
    "mười bảy",
    "mười tám",
    "mười chín",
  ];

  function readGroup(g: number): string {
    const h = Math.floor(g / 100);
    const t = Math.floor((g % 100) / 10);
    const u = g % 10;
    let res = "";
    if (h > 0) {
      res += units[h] + " trăm";
      if (t === 0 && u > 0) res += " linh";
    }
    if (t > 1) {
      res += " " + units[t] + " mươi";
      if (u === 1) res += " mốt";
      else if (u === 5) res += " lăm";
      else if (u > 0) res += " " + units[u];
    } else if (t === 1) {
      res += " " + teens[u];
    } else if (u > 0 && h === 0) {
      res += units[u];
    } else if (u > 0) {
      res += " " + units[u];
    }
    return res.trim();
  }

  const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
  let num = Math.abs(Math.round(n));
  let parts: string[] = [];
  let scaleIdx = 0;

  while (num > 0) {
    const grp = num % 1000;
    if (grp > 0) {
      const text = readGroup(grp);
      parts.unshift(text + (scales[scaleIdx] ? " " + scales[scaleIdx] : ""));
    }
    num = Math.floor(num / 1000);
    scaleIdx++;
  }

  const result = parts.join(" ").trim();
  const capitalized = result.charAt(0).toUpperCase() + result.slice(1);
  return capitalized + " đồng";
}

// ----------------------------------------------------------------------
// 1. MODAL "NỘP THUẾ" (MATCHING SCREENSHOT 2)
// ----------------------------------------------------------------------
export function TaxPaymentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (taxData: {
    taxType: string;
    paymentMethod: string;
    taxDate: string;
    totalAmount: number;
    items?: { name: string; due: number; pay: number }[];
  }) => void;
}) {
  const [taxType, setTaxType] = useState("Thuế khác");
  const [taxDate, setTaxDate] = useState("30/09/2026");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");

  const [taxItems, setTaxItems] = useState<
    { id: string; name: string; due: number; pay: number; checked: boolean }[]
  >([]);

  React.useEffect(() => {
    if (taxType === "Thuế khác") {
      setTaxItems([]);
    } else if (taxType === "Thuế GTGT") {
      setTaxItems([
        { id: "vat1", name: "Thuế GTGT phải nộp quý 3/2026", due: 15420000, pay: 15420000, checked: true },
      ]);
    } else if (taxType === "Thuế TNDN") {
      setTaxItems([
        { id: "cit1", name: "Thuế TNDN tạm nộp quý 3/2026", due: 24500000, pay: 24500000, checked: true },
      ]);
    } else if (taxType === "Thuế TNCN") {
      setTaxItems([
        { id: "pit1", name: "Thuế TNCN khấu trừ từ tiền lương tháng 09/2026", due: 5850000, pay: 5850000, checked: true },
      ]);
    } else if (taxType === "Lệ phí môn bài") {
      setTaxItems([
        { id: "mb1", name: "Lệ phí môn bài bậc 1 (VĐL > 10 tỷ đồng)", due: 3000000, pay: 3000000, checked: true },
      ]);
    } else if (taxType === "Thuế hàng nhập khẩu") {
      setTaxItems([
        { id: "nk1", name: "Thuế nhập khẩu linh kiện thiết bị y tế theo tờ khai 105928374920", due: 18200000, pay: 18200000, checked: true },
        { id: "nk2", name: "Thuế GTGT hàng nhập khẩu theo tờ khai 105928374920", due: 11800000, pay: 11800000, checked: true },
      ]);
    }
  }, [taxType]);

  const toggleCheck = (id: string) => {
    setTaxItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextChecked = !item.checked;
          return {
            ...item,
            checked: nextChecked,
            pay: nextChecked ? item.due : 0,
          };
        }
        return item;
      }),
    );
  };

  const updatePayAmount = (id: string, amountStr: string) => {
    const cleanNum = parseInt(amountStr.replace(/\D/g, "") || "0", 10);
    setTaxItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, pay: cleanNum } : item)),
    );
  };

  const totalDue = useMemo(
    () => taxItems.reduce((sum, item) => sum + item.due, 0),
    [taxItems],
  );

  const totalPay = useMemo(
    () =>
      taxItems.reduce(
        (sum, item) => sum + (item.checked ? item.pay : 0),
        0,
      ),
    [taxItems],
  );

  const allChecked = taxItems.length > 0 && taxItems.every((item) => item.checked);
  const toggleAll = () => {
    const nextState = !allChecked;
    setTaxItems((prev) =>
      prev.map((item) => ({
        ...item,
        checked: nextState,
        pay: nextState ? item.due : 0,
      })),
    );
  };

  const handlePay = () => {
    onSubmit({
      taxType,
      paymentMethod,
      taxDate,
      totalAmount: totalPay,
      items: taxItems
        .filter((t) => t.checked && t.pay > 0)
        .map((t) => ({ name: t.name, due: t.due, pay: t.pay })),
    });
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-invoice-collect-window">
        {/* Floating Right Drawer Handle */}
        <button
          type="button"
          className="misa-voucher-drawer-handle"
          title="Thu phóng tab"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Modal Header (Matching Screenshot 2) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">Nộp thuế</div>
          <div className="misa-invoice-collect-actions">
            <button
              type="button"
              className="misa-invoice-help-link"
              onClick={() => alert("Hướng dẫn sử dụng Nộp thuế")}
            >
              <HelpCircle size={15} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={13} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Trợ giúp"
            >
              <HelpCircle size={17} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              onClick={onClose}
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Box (Matching Screenshot 2) */}
        <div className="misa-invoice-master-box" style={{ flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {/* Loại thuế */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Loại thuế</span>
                <div style={{ position: "relative", width: 180 }}>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      background: "#ffffff",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="Thuế khác">Thuế khác</option>
                    <option value="Thuế hàng nhập khẩu">Thuế hàng nhập khẩu</option>
                    <option value="Thuế GTGT">Thuế GTGT</option>
                    <option value="Thuế TNDN">Thuế TNDN tạm tính</option>
                    <option value="Thuế TNCN">Thuế TNCN</option>
                    <option value="Lệ phí môn bài">Lệ phí môn bài</option>
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#6b7280",
                    }}
                  />
                </div>
              </div>

              {/* Ngày nộp thuế */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Ngày nộp thuế</span>
                <div style={{ position: "relative", width: 140 }}>
                  <input
                    type="text"
                    value={taxDate}
                    onChange={(e) => setTaxDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  />
                  <Calendar
                    size={15}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#6b7280",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {/* Phương thức thanh toán (Tiền gửi first, Tiền mặt second - Screenshot 2) */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                <span style={{ color: "#374151" }}>Phương thức thanh toán</span>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="taxPaymentMethod"
                    checked={paymentMethod === "bank"}
                    onChange={() => setPaymentMethod("bank")}
                    style={{ accentColor: "#00b06b", cursor: "pointer" }}
                  />
                  <span>Tiền gửi</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="taxPaymentMethod"
                    checked={paymentMethod === "cash"}
                    onChange={() => setPaymentMethod("cash")}
                    style={{ accentColor: "#00b06b", cursor: "pointer" }}
                  />
                  <span>Tiền mặt</span>
                </label>
              </div>
            </div>

            {/* Right KPI (Screenshot 2: Số nộp lần này / 0) */}
            <div className="misa-invoice-master-right" style={{ paddingRight: 0 }}>
              <span className="misa-invoice-total-label">Số nộp lần này</span>
              <div className="misa-invoice-total-val">
                {formatVND(totalPay)}
              </div>
            </div>
          </div>

          {/* Blue Note (Exact text from Screenshot 2) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              color: "#1d4ed8",
              fontSize: 12.5,
              lineHeight: 1.5,
              padding: "4px 0",
            }}
          >
            <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "#2563eb" }} />
            <div>
              <p style={{ margin: 0 }}>
                <em>Lưu ý: Tại đơn vị có phát sinh thuế nhập khẩu, thuế chống bán phá giá, thuế TTĐB, thuế bảo vệ môi trường, thuế GTGT của hàng nhập khẩu thì vui lòng chọn cách nộp thuế sau:</em>
              </p>
              <p style={{ margin: "2px 0 0 0" }}>
                <em>1. Nếu đơn vị quản lý nộp thuế hàng nhập khẩu theo từng tờ khai hải quan thì khi nộp thuế chọn loại &ldquo;Thuế hàng nhập khẩu&rdquo;</em>
              </p>
              <p style={{ margin: "2px 0 0 0" }}>
                <em>2. Nếu đơn vị không có nhu cầu nộp thuế nhập khẩu, thuế chống bán phá giá, thuế TTĐB, thuế bảo vệ môi trường theo từng tờ khai hải quan thì khi nộp thuế chọn loại &ldquo;Thuế khác&rdquo;</em>
              </p>
            </div>
          </div>
        </div>

        {/* Table Container (Matching Screenshot 2) */}
        <div className="misa-invoice-body">
          <div className="misa-invoice-table-container">
            {/* Title Bar */}
            <div style={{ padding: "10px 14px", background: "#ffffff", borderBottom: "1px solid #cbd5e1" }}>
              <strong style={{ fontSize: 13.5, color: "#111827" }}>Chi tiết khoản thuế</strong>
            </div>

            {/* Table Wrapper */}
            <div className="misa-invoice-table-wrapper" style={{ display: "flex", flexDirection: "column" }}>
              <table className="misa-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        style={{ accentColor: "#00b06b", cursor: "pointer" }}
                      />
                    </th>
                    <th>Khoản phải nộp</th>
                    <th style={{ width: 220, textAlign: "right" }}>Số phải nộp</th>
                    <th style={{ width: 220, textAlign: "right" }}>Số nộp lần này</th>
                  </tr>
                  {/* Summary row directly below Header (Screenshot 2: Cộng) */}
                  <tr style={{ background: "#e2ece5", fontWeight: 700 }}>
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ fontWeight: 700, color: "#111827" }}>Cộng</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalDue)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalPay)}
                    </td>
                  </tr>
                </thead>
                {taxItems.length > 0 && (
                  <tbody>
                    {taxItems.map((item) => (
                      <tr key={item.id} style={{ background: item.checked ? "#f0fdf4" : "#ffffff" }}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleCheck(item.id)}
                            style={{ accentColor: "#00b06b", cursor: "pointer" }}
                          />
                        </td>
                        <td>{item.name}</td>
                        <td style={{ textAlign: "right" }}>{formatVND(item.due)}</td>
                        <td style={{ textAlign: "right" }}>
                          <input
                            type="text"
                            value={formatVND(item.pay)}
                            disabled={!item.checked}
                            onChange={(e) => updatePayAmount(item.id, e.target.value)}
                            style={{
                              height: 28,
                              width: 140,
                              padding: "0 8px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db",
                              textAlign: "right",
                              fontSize: 13,
                              background: item.checked ? "#ffffff" : "#f1f5f9",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>

              {/* Empty state when no records (Screenshot 2) */}
              {taxItems.length === 0 && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MisaEmptyState text="Không có dữ liệu" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Matching Screenshot 2) */}
        <footer className="misa-invoice-footer">
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="misa-invoice-btn-submit"
            onClick={handlePay}
          >
            Nộp thuế
          </button>
        </footer>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 1b. MODAL "TRẢ TIỀN NHÀ CUNG CẤP THEO HÓA ĐƠN" (MATCHING SCREENSHOT 1)
// ----------------------------------------------------------------------
export function SupplierPaymentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    payMethod: string;
    currency: string;
    supplier: string;
    employee: string;
    payDate: string;
    totalAmount: number;
    invoices: any[];
  }) => void;
}) {
  const [payMethod, setPayMethod] = useState("Tiền mặt");
  const [supplier, setSupplier] = useState("");
  const [employee, setEmployee] = useState("");
  const [payDate, setPayDate] = useState("29/09/2026");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [quickAmount, setQuickAmount] = useState("");

  const [invoices, setInvoices] = useState<
    {
      id: string;
      voucherDate: string;
      voucherCode: string;
      invoiceDate: string;
      invoiceCode: string;
      description: string;
      dueDate: string;
      totalDebt: number;
      remainingDebt: number;
      payAmount: number;
      account: string;
      terms: string;
      checked: boolean;
    }[]
  >([]);

  const handleFetchData = () => {
    setInvoices([
      {
        id: "inv-1",
        voucherDate: "01/09/2026",
        voucherCode: "CT00018",
        invoiceDate: "01/09/2026",
        invoiceCode: "HD-00281",
        description: "Mua giấy in, mực in văn phòng tháng 9",
        dueDate: "15/09/2026",
        totalDebt: 18500000,
        remainingDebt: 18500000,
        payAmount: 18500000,
        account: "331",
        terms: "TT 15 ngày",
        checked: true,
      },
      {
        id: "inv-2",
        voucherDate: "28/08/2026",
        voucherCode: "CT00012",
        invoiceDate: "28/08/2026",
        invoiceCode: "HD-00195",
        description: "Mua bàn ghế làm việc phòng kinh doanh",
        dueDate: "10/09/2026",
        totalDebt: 32000000,
        remainingDebt: 12000000,
        payAmount: 12000000,
        account: "331",
        terms: "TT 30 ngày",
        checked: true,
      },
      {
        id: "inv-3",
        voucherDate: "15/08/2026",
        voucherCode: "CT00008",
        invoiceDate: "15/08/2026",
        invoiceCode: "HD-00114",
        description: "Mua linh kiện máy tính bảo trì hệ thống",
        dueDate: "05/09/2026",
        totalDebt: 8400000,
        remainingDebt: 8400000,
        payAmount: 0,
        account: "331",
        terms: "TT ngay",
        checked: false,
      },
    ]);
  };

  const toggleInvoiceCheck = (id: string) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          const nextChecked = !inv.checked;
          return {
            ...inv,
            checked: nextChecked,
            payAmount: nextChecked ? inv.remainingDebt : 0,
          };
        }
        return inv;
      }),
    );
  };

  const updateInvoicePayAmount = (id: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, "") || "0", 10);
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, payAmount: num } : inv)),
    );
  };

  const toggleSelectAll = () => {
    const allChecked = invoices.length > 0 && invoices.every((i) => i.checked);
    setInvoices((prev) =>
      prev.map((inv) => ({
        ...inv,
        checked: !allChecked,
        payAmount: !allChecked ? inv.remainingDebt : 0,
      })),
    );
  };

  const handleQuickAmount = (val: string) => {
    const cleanNum = parseInt(val.replace(/\D/g, "") || "0", 10);
    setQuickAmount(cleanNum > 0 ? formatVND(cleanNum) : "");
    let remain = cleanNum;
    setInvoices((prev) =>
      prev.map((inv) => {
        if (remain <= 0) {
          return { ...inv, payAmount: 0, checked: false };
        }
        const alloc = Math.min(remain, inv.remainingDebt);
        remain -= alloc;
        return {
          ...inv,
          payAmount: alloc,
          checked: alloc > 0,
        };
      }),
    );
  };

  const displayedInvoices = useMemo(() => {
    if (!searchInvoice) return invoices;
    const q = searchInvoice.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.voucherCode.toLowerCase().includes(q) ||
        inv.invoiceCode.toLowerCase().includes(q) ||
        inv.description.toLowerCase().includes(q),
    );
  }, [invoices, searchInvoice]);

  const totalDebtSum = useMemo(
    () => displayedInvoices.reduce((sum, inv) => sum + inv.totalDebt, 0),
    [displayedInvoices],
  );
  const remainingDebtSum = useMemo(
    () => displayedInvoices.reduce((sum, inv) => sum + inv.remainingDebt, 0),
    [displayedInvoices],
  );
  const totalPayAmount = useMemo(
    () =>
      displayedInvoices.reduce(
        (sum, inv) => sum + (inv.checked ? inv.payAmount : 0),
        0,
      ),
    [displayedInvoices],
  );

  const handlePay = () => {
    onSubmit({
      payMethod,
      currency: "VND",
      supplier,
      employee,
      payDate,
      totalAmount: totalPayAmount,
      invoices: displayedInvoices.filter((i) => i.checked && i.payAmount > 0),
    });
  };

  return (
    <div className="misa-modal-backdrop" role="dialog" aria-modal="true">
      <div className="misa-invoice-collect-window">
        {/* Floating Right Drawer Handle */}
        <button
          type="button"
          className="misa-voucher-drawer-handle"
          title="Thu phóng tab"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Modal Header (Matching Screenshot 1) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">
            Trả tiền nhà cung cấp theo hóa đơn
          </div>
          <div className="misa-invoice-collect-actions">
            <button
              type="button"
              className="misa-invoice-help-link"
              onClick={() => alert("Hướng dẫn sử dụng Trả tiền nhà cung cấp theo hóa đơn")}
            >
              <HelpCircle size={15} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={13} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              title="Trợ giúp"
            >
              <HelpCircle size={17} />
            </button>
            <button
              type="button"
              className="misa-invoice-circle-btn"
              onClick={onClose}
              title="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Master Box (Matching Screenshot 1) */}
        <div className="misa-invoice-master-box">
          <div className="misa-invoice-master-left">
            {/* Row 1: Phương thức thanh toán */}
            <div className="misa-invoice-field" style={{ width: 150 }}>
              <label>Phương thức thanh toán</label>
              <div style={{ position: "relative" }}>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 28px 0 10px",
                    borderRadius: 4,
                    border: "1px solid #3b82f6",
                    fontSize: 13,
                    background: "#ffffff",
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="Tiền mặt">Tiền mặt</option>
                  <option value="Tiền gửi">Tiền gửi</option>
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#6b7280",
                  }}
                />
              </div>
            </div>

            {/* Row 2: Nhà cung cấp (Combobox full width / max-width 720) */}
            <div className="misa-invoice-field" style={{ width: "100%", maxWidth: 720 }}>
              <label>Nhà cung cấp</label>
              <div style={{ position: "relative" }}>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 30px 0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    background: "#ffffff",
                    appearance: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">&nbsp;</option>
                  <option value="Công ty TNHH Thiết bị Văn phòng Hồng Hà">
                    Công ty TNHH Thiết bị Văn phòng Hồng Hà
                  </option>
                  <option value="Công ty TNHH Phúc Long">
                    Công ty TNHH Phúc Long
                  </option>
                  <option value="Công ty CP Công nghệ Sao Việt">
                    Công ty CP Công nghệ Sao Việt
                  </option>
                  <option value="Công ty TNHH Hoàng Gia">
                    Công ty TNHH Hoàng Gia
                  </option>
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#6b7280",
                  }}
                />
              </div>
            </div>

            {/* Row 3: Nhân viên mua hàng, Ngày trả tiền, Nút Lấy dữ liệu */}
            <div className="misa-invoice-grid-row" style={{ alignItems: "flex-end" }}>
              <div className="misa-invoice-field" style={{ width: 260 }}>
                <label>Nhân viên mua hàng</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 30px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      background: "#ffffff",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">&nbsp;</option>
                    <option value="Nguyễn Văn Nam">Nguyễn Văn Nam</option>
                    <option value="Lê Thị Mai">Lê Thị Mai</option>
                    <option value="Phạm Hải Đăng">Phạm Hải Đăng</option>
                  </select>
                  <ChevronDown
                    size={14}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                      color: "#6b7280",
                    }}
                  />
                </div>
              </div>

              <div className="misa-invoice-field" style={{ width: 140 }}>
                <label>Ngày trả tiền</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 28px 0 10px",
                      borderRadius: 4,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                      background: "#ffffff",
                    }}
                  />
                  <Calendar
                    size={15}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#6b7280",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="misa-invoice-fetch-btn"
                onClick={() => {
                  if (!supplier) {
                    setSupplier("Công ty TNHH Thiết bị Văn phòng Hồng Hà");
                  }
                  handleFetchData();
                }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>

          {/* Right Top KPI Total (Screenshot 1: Số trả / 0) */}
          <div className="misa-invoice-master-right">
            <span className="misa-invoice-total-label">Số trả</span>
            <div className="misa-invoice-total-val">
              {formatVND(totalPayAmount)}
            </div>
          </div>
        </div>

        {/* Table Container (Matching Screenshot 1) */}
        <div className="misa-invoice-body">
          <div className="misa-invoice-table-container">
            {/* Table Subheader / Toolbar */}
            <div className="misa-invoice-table-toolbar">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <strong style={{ fontSize: 13.5, color: "#111827" }}>
                  Chứng từ công nợ
                </strong>
                <input
                  type="text"
                  placeholder="Tìm theo số chứng từ, số hóa đơn"
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  style={{
                    height: 30,
                    width: 250,
                    padding: "0 10px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 12.5,
                    color: "#111827",
                    outline: "none",
                  }}
                />
              </div>

              {/* Nhập số trả */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "#374151" }}>Nhập số trả</span>
                <input
                  type="text"
                  value={quickAmount}
                  onChange={(e) => handleQuickAmount(e.target.value)}
                  style={{
                    height: 30,
                    width: 140,
                    padding: "0 8px",
                    borderRadius: 4,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    textAlign: "right",
                    outline: "none",
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>

            {/* Table Header and Rows (Matching Screenshot 1) */}
            <div className="misa-invoice-table-wrapper">
              <table className="misa-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={invoices.length > 0 && invoices.every((i) => i.checked)}
                        onChange={toggleSelectAll}
                        style={{ accentColor: "#00b06b", cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ width: 110, textAlign: "center" }}>Ngày chứng từ</th>
                    <th style={{ width: 110 }}>Số chứng từ</th>
                    <th style={{ width: 110, textAlign: "center" }}>Ngày hóa đơn</th>
                    <th style={{ width: 100 }}>Số hóa đơn</th>
                    <th style={{ minWidth: 260 }}>Diễn giải</th>
                    <th style={{ width: 110, textAlign: "center" }}>Hạn thanh toán</th>
                    <th style={{ width: 120, textAlign: "right" }}>Tổng nợ</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số còn nợ</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số trả</th>
                    <th style={{ width: 90, textAlign: "center" }}>TK Phải trả</th>
                    <th style={{ width: 120 }}>Điều khoản TT</th>
                  </tr>
                  {/* Summary row directly under Header (Screenshot 1: Tổng) */}
                  <tr style={{ background: "#e2ece5", fontWeight: 700 }}>
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                    <td></td>
                    <td style={{ fontWeight: 700, color: "#111827" }}>Tổng</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalDebtSum)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(remainingDebtSum)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalPayAmount)}
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {displayedInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{
                        background: inv.checked ? "#f0fdf4" : "#ffffff",
                      }}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={inv.checked}
                          onChange={() => toggleInvoiceCheck(inv.id)}
                          style={{ accentColor: "#00b06b", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>{inv.voucherDate}</td>
                      <td>
                        <strong style={{ color: "#00b06b" }}>{inv.voucherCode}</strong>
                      </td>
                      <td style={{ textAlign: "center" }}>{inv.invoiceDate}</td>
                      <td>{inv.invoiceCode}</td>
                      <td>{inv.description}</td>
                      <td style={{ textAlign: "center" }}>{inv.dueDate}</td>
                      <td style={{ textAlign: "right" }}>{formatVND(inv.totalDebt)}</td>
                      <td style={{ textAlign: "right" }}>{formatVND(inv.remainingDebt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          value={formatVND(inv.payAmount)}
                          disabled={!inv.checked}
                          onChange={(e) => updateInvoicePayAmount(inv.id, e.target.value)}
                          style={{
                            height: 28,
                            width: 110,
                            padding: "0 8px",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            textAlign: "right",
                            fontSize: 13,
                            background: inv.checked ? "#ffffff" : "#f1f5f9",
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>{inv.account}</td>
                      <td>{inv.terms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer (Matching Screenshot 1) */}
        <footer className="misa-invoice-footer">
          <button
            type="button"
            className="misa-invoice-btn-cancel"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="misa-invoice-btn-submit"
            onClick={handlePay}
          >
            Trả tiền
          </button>
        </footer>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. MODAL "CHỨNG TỪ KẾ TOÁN" (MATCHING SCREENSHOT 1-4 & 5)
// ----------------------------------------------------------------------
export function AccountingVoucherModal({
  voucher,
  onClose,
}: {
  voucher: {
    code: string;
    date: string;
    person: string;
    address: string;
    reason: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    amountInWords: string;
    notes?: string;
    chiefAccountant?: string;
    director?: string;
  };
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(150);
  const [showTip, setShowTip] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const amountWords =
    voucher.amountInWords || convertNumberToVietnameseWords(voucher.amount);
  const dateFormatted = voucher.date
    ? voucher.date.split("-").reverse().join("/")
    : "03/09/2026";

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    setShowExportMenu(false);
    const excelContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13pt; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000000; padding: 6px 8px; font-family: 'Times New Roman', serif; }
    th { font-weight: bold; text-align: center; background: #ffffff; }
    .no-border { border: none !important; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    .title { font-size: 18pt; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  <table>
    <tr class="no-border"><td colspan="3" class="no-border">Công ty cổ phần MISA</td><td colspan="2" class="no-border"></td></tr>
    <tr class="no-border"><td colspan="3" class="no-border">Hà Nội</td><td colspan="2" class="no-border"></td></tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 18px;"></td></tr>
    <tr class="no-border"><td colspan="5" class="no-border title">CHỨNG TỪ KẾ TOÁN</td></tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 18px;"></td></tr>
    <tr class="no-border">
      <td colspan="3" class="no-border">Tên: ${voucher.person || "Hoàng Thiên Bảo"}</td>
      <td colspan="2" class="no-border right">Số: ${voucher.code || "PT00005"}</td>
    </tr>
    <tr class="no-border">
      <td colspan="3" class="no-border">Địa chỉ: ${voucher.address || ""}</td>
      <td colspan="2" class="no-border right">Ngày: ${dateFormatted}</td>
    </tr>
    <tr class="no-border">
      <td colspan="5" class="no-border">Diễn giải: ${voucher.reason || ""}</td>
    </tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 10px;"></td></tr>
    <tr>
      <th style="width: 45px;">STT</th>
      <th>Diễn giải</th>
      <th style="width: 85px;">Ghi nợ</th>
      <th style="width: 85px;">Ghi có</th>
      <th style="width: 140px;">Thành tiền</th>
    </tr>
    <tr>
      <td class="center">1</td>
      <td>${voucher.reason}</td>
      <td class="center">${voucher.debitAccount || "111"}</td>
      <td class="center">${voucher.creditAccount || "141"}</td>
      <td class="right bold" style="mso-number-format:'\\#,\\#\\#0';">${formatVND(voucher.amount)}</td>
    </tr>
    <tr>
      <td class="center"></td>
      <td class="center bold">Cộng</td>
      <td class="center"></td>
      <td class="center"></td>
      <td class="right bold" style="mso-number-format:'\\#,\\#\\#0';">${formatVND(voucher.amount)}</td>
    </tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 12px;"></td></tr>
    <tr class="no-border">
      <td colspan="5" class="no-border">Thành tiền bằng chữ: <i>${amountWords}.</i></td>
    </tr>
    <tr class="no-border">
      <td colspan="5" class="no-border">Ghi chú: ...................................................................................................................................................</td>
    </tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 30px;"></td></tr>
    <tr class="no-border">
      <td colspan="2" class="no-border center bold">Kế toán trưởng</td>
      <td class="no-border"></td>
      <td colspan="2" class="no-border center bold">Giám đốc</td>
    </tr>
    <tr class="no-border">
      <td colspan="2" class="no-border center italic">(Ký, họ tên)</td>
      <td class="no-border"></td>
      <td colspan="2" class="no-border center italic">(Ký, họ tên, đóng dấu)</td>
    </tr>
    <tr class="no-border"><td colspan="5" class="no-border" style="height: 75px;"></td></tr>
    <tr class="no-border">
      <td colspan="2" class="no-border center bold">${voucher.chiefAccountant || "Trương Thị B"}</td>
      <td class="no-border"></td>
      <td colspan="2" class="no-border center bold">${voucher.director || "Nguyễn Văn A"}</td>
    </tr>
  </table>
</body>
</html>
    `;
    const blob = new Blob([excelContent], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chung_tu_${voucher.code || "PT00005"}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    setShowExportMenu(false);
    const wordContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/msword; charset=UTF-8"/>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.35; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #000000; padding: 6px 8px; font-family: 'Times New Roman', serif; font-size: 13pt; }
    th { font-weight: bold; text-align: center; }
    .no-border { border: none !important; }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    .title { font-size: 18pt; font-weight: bold; text-align: center; margin: 15px 0 25px 0; }
  </style>
</head>
<body>
  <div style="margin-bottom: 20px;">
    <div>Công ty cổ phần MISA</div>
    <div>Hà Nội</div>
  </div>
  <div class="title">CHỨNG TỪ KẾ TOÁN</div>
  <table style="border: none; width: 100%; margin-bottom: 10px;">
    <tr class="no-border">
      <td class="no-border" style="width: 65%;">Tên: ${voucher.person || "Hoàng Thiên Bảo"}</td>
      <td class="no-border right" style="width: 35%;">Số: ${voucher.code || "PT00005"}</td>
    </tr>
    <tr class="no-border">
      <td class="no-border">Địa chỉ: ${voucher.address || ""}</td>
      <td class="no-border right">Ngày: ${dateFormatted}</td>
    </tr>
    <tr class="no-border">
      <td class="no-border" colspan="2">Diễn giải: ${voucher.reason || ""}</td>
    </tr>
  </table>
  <table>
    <tr>
      <th style="width: 45px;">STT</th>
      <th>Diễn giải</th>
      <th style="width: 85px;">Ghi nợ</th>
      <th style="width: 85px;">Ghi có</th>
      <th style="width: 140px;">Thành tiền</th>
    </tr>
    <tr>
      <td class="center">1</td>
      <td>${voucher.reason}</td>
      <td class="center">${voucher.debitAccount || "111"}</td>
      <td class="center">${voucher.creditAccount || "141"}</td>
      <td class="right bold">${formatVND(voucher.amount)}</td>
    </tr>
    <tr>
      <td class="center"></td>
      <td class="center bold">Cộng</td>
      <td class="center"></td>
      <td class="center"></td>
      <td class="right bold">${formatVND(voucher.amount)}</td>
    </tr>
  </table>
  <div style="margin: 10px 0;">Thành tiền bằng chữ: <i>${amountWords}.</i></div>
  <div style="margin-bottom: 30px;">Ghi chú: ...................................................................................................................................................</div>
  <table style="border: none; width: 100%; margin-top: 20px;">
    <tr class="no-border">
      <td class="no-border center bold" style="width: 50%;">Kế toán trưởng</td>
      <td class="no-border center bold" style="width: 50%;">Giám đốc</td>
    </tr>
    <tr class="no-border">
      <td class="no-border center italic">(Ký, họ tên)</td>
      <td class="no-border center italic">(Ký, họ tên, đóng dấu)</td>
    </tr>
    <tr class="no-border" style="height: 80px;">
      <td class="no-border center" colspan="2" style="height: 80px;"></td>
    </tr>
    <tr class="no-border">
      <td class="no-border center bold">${voucher.chiefAccountant || "Trương Thị B"}</td>
      <td class="no-border center bold">${voucher.director || "Nguyễn Văn A"}</td>
    </tr>
  </table>
</body>
</html>
    `;
    const blob = new Blob([wordContent], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chung_tu_${voucher.code || "PT00005"}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="misa-voucher-modal-overlay">
      {/* Top Action Bar */}
      <header className="misa-voucher-topbar">
        <div className="misa-voucher-topbar-left">
          <h2>Chứng từ kế toán</h2>
        </div>
        <div className="misa-voucher-topbar-center">
          <button
            className="misa-voucher-action-btn amis-chat"
            type="button"
            title="Gửi chứng từ qua AMIS Chat"
          >
            <MessageSquare size={16} />
            Gửi chứng từ
          </button>
          <button
            className="misa-voucher-action-btn"
            type="button"
            onClick={handlePrint}
          >
            <Printer size={16} />
            In
          </button>

          <div style={{ position: "relative" }}>
            <button
              className="misa-voucher-action-btn"
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              title="Xuất biểu mẫu chứng từ"
            >
              <Download size={16} />
              Xuất file
              <ChevronDown size={12} style={{ marginLeft: 2 }} />
            </button>

            {showExportMenu && (
              <div className="misa-voucher-export-menu">
                <button
                  type="button"
                  className="misa-voucher-export-item"
                  onClick={handleExportExcel}
                >
                  <FileSpreadsheet size={16} style={{ color: "#00b06b" }} />
                  <span>Xuất Excel biểu mẫu (.xls)</span>
                </button>
                <button
                  type="button"
                  className="misa-voucher-export-item"
                  onClick={handleExportWord}
                >
                  <FileText size={16} style={{ color: "#2563eb" }} />
                  <span>Xuất Word biểu mẫu (.doc)</span>
                </button>
                <button
                  type="button"
                  className="misa-voucher-export-item"
                  onClick={() => {
                    setShowExportMenu(false);
                    handlePrint();
                  }}
                >
                  <Printer size={16} style={{ color: "#ea580c" }} />
                  <span>Xuất PDF / In biểu mẫu (.pdf)</span>
                </button>
              </div>
            )}
          </div>

          <button className="misa-voucher-action-btn" type="button">
            <Settings size={15} />
            Sửa mẫu
          </button>
          <button className="misa-voucher-action-btn" type="button">
            <ClipboardList size={15} />
            Thiết lập người ký
          </button>
        </div>
        <div className="misa-voucher-topbar-right">
          <button className="misa-tax-icon-btn" type="button" title="Trợ giúp">
            <HelpCircle size={18} />
          </button>
          <button
            className="misa-tax-icon-btn"
            onClick={onClose}
            type="button"
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Floating Tip Badge */}
      {showTip && (
        <div className="misa-voucher-tip-badge">
          <span className="misa-voucher-tip-tag">Mới</span>
          <span>Thay đổi thiết lập thông tin người ký trên báo cáo chứng từ tại đây.</span>
          <button
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              marginLeft: 4,
            }}
            onClick={() => setShowTip(false)}
            aria-label="Đóng gợi ý"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sub Bar (Pagination & Zoom) */}
      <div className="misa-voucher-subbar">
        <div className="misa-voucher-subbar-left">
          <button type="button" title="Trang trước">
            &lt;
          </button>
          <span>1 / 1</span>
          <button type="button" title="Trang sau">
            &gt;
          </button>
        </div>
        <div className="misa-voucher-subbar-right">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 10, 80))}
          >
            <ZoomOut size={14} />
          </button>
          <span>{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 10, 200))}
          >
            <ZoomIn size={14} />
          </button>
          <button type="button" title="Xoay">
            <RotateCw size={14} />
          </button>
          <button type="button" onClick={handlePrint} title="In chứng từ">
            <Printer size={14} />
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            title="Tải xuống Excel biểu mẫu (.xls)"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* Split Viewer: Thumbnail sidebar + A4 Paper */}
      <div className="misa-voucher-container">
        {/* Left Thumbnails Sidebar */}
        <aside className="misa-voucher-sidebar">
          <button className="misa-voucher-sidebar-toggle-btn" type="button">
            &lt; - 5
          </button>
          <div className="misa-voucher-thumbnail-card" title="Trang 1 / 1">
            <div className="misa-voucher-thumb-skeleton header" />
            <div className="misa-voucher-thumb-skeleton" />
            <div className="misa-voucher-thumb-skeleton table" />
            <div className="misa-voucher-thumb-skeleton" />
            <div className="misa-voucher-thumb-page-num">1</div>
          </div>
        </aside>

        {/* Paper View Container */}
        <div className="misa-voucher-viewer">
          <div
            className="misa-voucher-paper"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            {/* Company Header (Matching Screenshot) */}
            <div className="misa-paper-company-header">
              <div className="misa-paper-company-left">
                <div>Công ty cổ phần MISA</div>
                <div>Hà Nội</div>
              </div>
            </div>

            {/* Title (Matching Screenshot) */}
            <div className="misa-paper-title">
              <h1>CHỨNG TỪ KẾ TOÁN</h1>
            </div>

            {/* Meta Grid (Matching Screenshot) */}
            <div className="misa-paper-meta-grid">
              <div className="misa-paper-meta-left">
                <div className="misa-paper-meta-row">
                  <span className="label">Tên:</span>
                  <span className="value">{voucher.person || "Hoàng Thiên Bảo"}</span>
                </div>
                <div className="misa-paper-meta-row">
                  <span className="label">Địa chỉ:</span>
                  <span className="value">{voucher.address || ""}</span>
                </div>
                <div className="misa-paper-meta-row">
                  <span className="label">Diễn giải:</span>
                  <span className="value">{voucher.reason}</span>
                </div>
              </div>

              <div className="misa-paper-meta-right">
                <div className="misa-paper-meta-row right">
                  <span className="label">Số:</span>
                  <span className="value">{voucher.code}</span>
                </div>
                <div className="misa-paper-meta-row right">
                  <span className="label">Ngày:</span>
                  <span className="value">{dateFormatted}</span>
                </div>
              </div>
            </div>

            {/* Accounting Table (Matching Screenshot) */}
            <table className="misa-paper-table">
              <thead>
                <tr>
                  <th style={{ width: 45 }}>STT</th>
                  <th>Diễn giải</th>
                  <th style={{ width: 85 }}>Ghi nợ</th>
                  <th style={{ width: 85 }}>Ghi có</th>
                  <th style={{ width: 140 }}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="center">1</td>
                  <td>{voucher.reason}</td>
                  <td className="center">{voucher.debitAccount || "111"}</td>
                  <td className="center">{voucher.creditAccount || "141"}</td>
                  <td className="right bold">{formatVND(voucher.amount)}</td>
                </tr>
                <tr className="total-row">
                  <td className="center"></td>
                  <td className="center bold">Cộng</td>
                  <td className="center"></td>
                  <td className="center"></td>
                  <td className="right bold">{formatVND(voucher.amount)}</td>
                </tr>
              </tbody>
            </table>

            {/* Words & Notes (Matching Screenshot) */}
            <div className="misa-paper-words">
              Thành tiền bằng chữ: <em>{amountWords}.</em>
            </div>
            <div className="misa-paper-notes">
              <span>Ghi chú:</span>
              <span className="misa-paper-notes-dots"></span>
            </div>

            {/* Signatures (Matching Screenshot) */}
            <div className="misa-paper-signatures">
              <div className="misa-signature-block">
                <strong>Kế toán trưởng</strong>
                <small>(Ký, họ tên)</small>
                <div className="misa-signature-name">
                  {voucher.chiefAccountant || "Trương Thị B"}
                </div>
              </div>
              <div className="misa-signature-block">
                <strong>Giám đốc</strong>
                <small>(Ký, họ tên, đóng dấu)</small>
                <div className="misa-signature-name">
                  {voucher.director || "Nguyễn Văn A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. MODAL "TẠO PHIẾU THU / CHI" MISA FORM CHUẨN
// ----------------------------------------------------------------------
export interface VoucherTypeOption {
  id: string;
  index: number;
  label: string;
  shortLabel: string;
  codeLabel: string;
  nameLabel: string;
  personLabel: string;
  addressLabel: string;
  defaultPartnerCode: string;
  defaultPartnerName: string;
  defaultPerson: string;
  defaultAddress: string;
  defaultReason: string;
  defaultDebit: string;
  defaultCredit: string;
  defaultAmount: number;
  hasEmployeeField?: boolean;
  hasCustomerDebtBtn?: boolean;
  hasSettlementDueDate?: boolean;
  hasTaxDeclarationTab?: boolean;
  hasYearField?: boolean;
  hasBatchPaymentCheckbox?: boolean;
  hasQuickAddHint?: boolean;
  layoutType?:
    | "receipt_standard"
    | "receipt_wide_reason"
    | "payment_supplier"
    | "payment_advance"
    | "payment_standard"
    | "bank_payment_supplier"
    | "bank_payment_advance"
    | "bank_payment_external"
    | "bank_payment_salary_advance"
    | "bank_payment_standard";
  extraColumns?: Array<
    | "bankAccount"
    | "bankName"
    | "partnerCode"
    | "partnerName"
    | "employeeCode"
    | "employeeName"
    | "loanContract"
  >;
  samplePartners: Array<{
    code: string;
    name: string;
    person: string;
    address: string;
    bankAccount?: string;
    bankName?: string;
  }>;
}

export const SAMPLE_BANK_ACCOUNTS = [
  { account: "1028475929", name: "Vietcombank - CN Hoàn Kiếm (VND)" },
  { account: "1023847592", name: "Vietcombank - CN Ba Đình (VND)" },
  { account: "1903482710", name: "Techcombank - Hội sở (VND)" },
  { account: "2151000129", name: "BIDV - CN Cầu Giấy (VND)" },
  { account: "0011004123899", name: "Vietcombank - Sở Giao Dịch (VND)" },
];

export const SAMPLE_BENEFICIARY_ACCOUNTS = [
  { account: "0021000348291", name: "Vietcombank - CN Thăng Long" },
  { account: "19028374910012", name: "Techcombank - CN Hai Bà Trưng" },
  { account: "21510008472910", name: "BIDV - CN Hà Nội" },
  { account: "123000847291", name: "Vietinbank - CN Đống Đa" },
  { account: "0451000389102", name: "Vietcombank - CN Thành Công" },
];

export const SAMPLE_EMPLOYEES = [
  { code: "NV0005", name: "Hoàng Thiên Bảo", dept: "Phòng Kinh doanh & Dự án" },
  { code: "NV0001", name: "Nguyễn Thị Mai", dept: "Phòng Kế toán - Tài chính" },
  { code: "NV0008", name: "Trương Quốc Khánh", dept: "Phòng Marketing" },
  { code: "NV0012", name: "Đặng Văn Lâm", dept: "Phòng Kỹ thuật & Công nghệ" },
];

export const MISA_RECEIPT_TYPES: VoucherTypeOption[] = [
  {
    id: "customer",
    index: 1,
    label: "1. Thu tiền khách hàng (không theo hóa đơn)",
    shortLabel: "1. Thu tiền khách hàng (không the...",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu tiền của ",
    defaultDebit: "111",
    defaultCredit: "131",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: true,
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "KH001", name: "Công ty TNHH Minh Phúc", person: "Nguyễn Thị Thanh", address: "Số 18 Hoàng Quốc Việt, Cầu Giấy, Hà Nội" },
      { code: "KH002", name: "Công ty Cổ phần Thương mại Sao Việt", person: "Trần Văn Hưng", address: "25 Lê Duẩn, Hoàn Kiếm, Hà Nội" },
      { code: "KH003", name: "Công ty CP Cơ khí An Phát", person: "Lê Minh Tuấn", address: "KCN Thăng Long, Đông Anh, Hà Nội" },
    ],
  },
  {
    id: "advance_refund",
    index: 2,
    label: "2. Thu hoàn ứng nhân viên",
    shortLabel: "2. Thu hoàn ứng nhân viên",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu hoàn ứng sau khi quyết toán tạm ứng cho ",
    defaultDebit: "111",
    defaultCredit: "141",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh & Dự án" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán - Tài chính" },
      { code: "NV0012", name: "Đặng Văn Lâm", person: "Đặng Văn Lâm", address: "Phòng Kỹ thuật & Công nghệ" },
    ],
  },
  {
    id: "bank_withdrawal",
    index: 3,
    label: "3. Rút tiền gửi về nhập quỹ",
    shortLabel: "3. Rút tiền gửi về nhập quỹ",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Rút tiền gửi về nhập quỹ",
    defaultDebit: "111",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["bankAccount", "bankName"],
    samplePartners: [
      { code: "NH001", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", person: "Thủ quỹ", address: "198 Trần Quang Khải, Hoàn Kiếm, Hà Nội" },
      { code: "NH002", name: "Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)", person: "Thủ quỹ", address: "6 Quang Trung, Hoàn Kiếm, Hà Nội" },
      { code: "NH003", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", person: "Thủ quỹ", address: "35 Hàng Vôi, Hoàn Kiếm, Hà Nội" },
    ],
  },
  {
    id: "loan_recovery",
    index: 4,
    label: "4. Thu hồi các khoản cho vay",
    shortLabel: "4. Thu hồi các khoản cho vay",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu hồi các khoản cho vay của ",
    defaultDebit: "111",
    defaultCredit: "1283",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName", "loanContract"],
    samplePartners: [
      { code: "DT002", name: "Công ty CP Đầu tư & Công nghệ Sao Mai", person: "Trần Quốc Đạt", address: "Duy Tân, Cầu Giấy, Hà Nội" },
      { code: "DT007", name: "Công ty TNHH Tư vấn & Dịch vụ Kim Đô", person: "Nguyễn Lan Hương", address: "Phạm Hùng, Nam Từ Liêm, Hà Nội" },
    ],
  },
  {
    id: "other_receipt",
    index: 5,
    label: "5. Thu khác",
    shortLabel: "5. Thu khác",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu tiền của ",
    defaultDebit: "111",
    defaultCredit: "711",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT008", name: "Công ty CP Tái chế & Xử lý Kim loại Nam Hà", person: "Phạm Hải Đăng", address: "KCN Quang Minh, Mê Linh, Hà Nội" },
      { code: "DT015", name: "Bảo hiểm Bảo Việt Hà Nội", person: "Lê Thu Hằng", address: "Trần Hưng Đạo, Hoàn Kiếm, Hà Nội" },
      { code: "KH005", name: "Công ty CP Tập đoàn Sơn Hà", person: "Vũ Tuấn Kiệt", address: "KCN Từ Liêm, Bắc Từ Liêm, Hà Nội" },
    ],
  },
];

export const MISA_BANK_RECEIPT_TYPES: VoucherTypeOption[] = [
  {
    id: "customer",
    index: 1,
    label: "1. Thu tiền khách hàng",
    shortLabel: "1. Thu tiền khách hàng",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu tiền khách hàng của ",
    defaultDebit: "112",
    defaultCredit: "131",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: true,
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "KH001", name: "Công ty TNHH Minh Phúc", person: "Nguyễn Thị Thanh", address: "Số 18 Hoàng Quốc Việt, Cầu Giấy, Hà Nội" },
      { code: "KH002", name: "Công ty Cổ phần Thương mại Sao Việt", person: "Trần Văn Hưng", address: "25 Lê Duẩn, Hoàn Kiếm, Hà Nội" },
      { code: "KH003", name: "Công ty CP Cơ khí An Phát", person: "Lê Minh Tuấn", address: "KCN Thăng Long, Đông Anh, Hà Nội" },
    ],
  },
  {
    id: "advance_refund",
    index: 2,
    label: "2. Thu hoàn ứng nhân viên",
    shortLabel: "2. Thu hoàn ứng nhân viên",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu hoàn ứng sau quyết toán tạm ứng cho ",
    defaultDebit: "112",
    defaultCredit: "141",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh & Dự án" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán - Tài chính" },
      { code: "NV0012", name: "Đặng Văn Lâm", person: "Đặng Văn Lâm", address: "Phòng Kỹ thuật & Công nghệ" },
    ],
  },
  {
    id: "financial_interest",
    index: 3,
    label: "3. Thu lãi đầu tư tài chính",
    shortLabel: "3. Thu lãi đầu tư tài chính",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu lãi đầu tư tài chính của ",
    defaultDebit: "112",
    defaultCredit: "515",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["loanContract"],
    samplePartners: [
      { code: "DT001", name: "Công ty CP Chứng khoán VPS", person: "Vũ Hải Đăng", address: "14 Lê Liễu, Cầu Giấy, Hà Nội" },
      { code: "DT002", name: "Công ty CP Đầu tư & Công nghệ Sao Mai", person: "Trần Quốc Đạt", address: "Duy Tân, Cầu Giấy, Hà Nội" },
      { code: "NH001", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", person: "Nguyễn Văn Hùng", address: "198 Trần Quang Khải, Hoàn Kiếm, Hà Nội" },
    ],
  },
  {
    id: "bank_loan",
    index: 4,
    label: "4. Thu tiền vay qua ngân hàng",
    shortLabel: "4. Thu tiền vay qua ngân hàng",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu tiền vay qua ngân hàng của ",
    defaultDebit: "112",
    defaultCredit: "3411",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName", "loanContract"],
    samplePartners: [
      { code: "NH001", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", person: "Nguyễn Văn Hùng", address: "198 Trần Quang Khải, Hoàn Kiếm, Hà Nội" },
      { code: "NH002", name: "Ngân hàng TMCP Kỹ Thương Việt Nam (Techcombank)", person: "Trần Minh", address: "6 Quang Trung, Hoàn Kiếm, Hà Nội" },
      { code: "NH003", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", person: "Lê Hoàng", address: "35 Hàng Vôi, Hoàn Kiếm, Hà Nội" },
    ],
  },
  {
    id: "vat_refund",
    index: 5,
    label: "5. Thu hoàn thuế GTGT",
    shortLabel: "5. Thu hoàn thuế GTGT",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu hoàn thuế GTGT của ",
    defaultDebit: "112",
    defaultCredit: "1331",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: [],
    samplePartners: [
      { code: "CQT01", name: "Cục Thuế Thành phố Hà Nội", person: "Kế toán thuế", address: "187 Giảng Võ, Đống Đa, Hà Nội" },
      { code: "CQT02", name: "Chi cục Thuế Quận Cầu Giấy", person: "Kế toán thuế", address: "Nguyễn Phong Sắc, Cầu Giấy, Hà Nội" },
    ],
  },
  {
    id: "loan_recovery",
    index: 6,
    label: "6. Thu hồi các khoản cho vay",
    shortLabel: "6. Thu hồi các khoản cho vay",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu hồi các khoản cho vay của ",
    defaultDebit: "112",
    defaultCredit: "1283",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: ["partnerCode", "partnerName", "loanContract"],
    samplePartners: [
      { code: "DT002", name: "Công ty CP Đầu tư & Công nghệ Sao Mai", person: "Trần Quốc Đạt", address: "Duy Tân, Cầu Giấy, Hà Nội" },
      { code: "DT007", name: "Công ty TNHH Tư vấn & Dịch vụ Kim Đô", person: "Nguyễn Lan Hương", address: "Phạm Hùng, Nam Từ Liêm, Hà Nội" },
    ],
  },
  {
    id: "other_receipt",
    index: 7,
    label: "7. Thu khác",
    shortLabel: "7. Thu khác",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nộp",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Thu khác vào tài khoản của ",
    defaultDebit: "112",
    defaultCredit: "711",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    extraColumns: [],
    samplePartners: [
      { code: "DT008", name: "Công ty CP Tái chế & Xử lý Kim loại Nam Hà", person: "Phạm Hải Đăng", address: "KCN Quang Minh, Mê Linh, Hà Nội" },
      { code: "DT015", name: "Bảo hiểm Bảo Việt Hà Nội", person: "Lê Thu Hằng", address: "Trần Hưng Đạo, Hoàn Kiếm, Hà Nội" },
      { code: "KH005", name: "Công ty CP Tập đoàn Sơn Hà", person: "Vũ Tuấn Kiệt", address: "KCN Từ Liêm, Bắc Từ Liêm, Hà Nội" },
    ],
  },
];

export const MISA_PAYMENT_TYPES: VoucherTypeOption[] = [
  {
    id: "supplier",
    index: 1,
    label: "1. Trả tiền nhà cung cấp (không theo hóa đơn)",
    shortLabel: "1. Trả tiền nhà cung cấp (không th...",
    codeLabel: "Mã nhà cung cấp",
    nameLabel: "Tên nhà cung cấp",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho",
    defaultDebit: "331",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: true,
    layoutType: "payment_supplier",
    extraColumns: [],
    samplePartners: [
      { code: "NCC001", name: "Công ty TNHH Thiết bị Văn phòng Hồng Hà", person: "Nguyễn Đức Anh", address: "25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội" },
      { code: "NCC002", name: "Công ty CP Giấy Hải Tiến", person: "Trần Thị Nga", address: "Phố Nối, Hưng Yên" },
      { code: "NCC003", name: "Công ty Viễn thông CMC", person: "Đỗ Tuấn Kiệt", address: "Duy Tân, Cầu Giấy, Hà Nội" },
    ],
  },
  {
    id: "advance",
    index: 2,
    label: "2. Tạm ứng cho nhân viên",
    shortLabel: "2. Tạm ứng cho nhân viên",
    codeLabel: "Mã nhân viên",
    nameLabel: "Tên nhân viên",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Tạm ứng cho nhân viên",
    defaultDebit: "141",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    hasSettlementDueDate: true,
    layoutType: "payment_advance",
    extraColumns: [],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh & Dự án" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán - Tài chính" },
      { code: "NV0012", name: "Đặng Văn Lâm", person: "Đặng Văn Lâm", address: "Phòng Kỹ thuật & Công nghệ" },
    ],
  },
  {
    id: "external_purchase",
    index: 3,
    label: "3. Chi mua ngoài có hóa đơn",
    shortLabel: "3. Chi mua ngoài có hóa đơn",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho",
    defaultDebit: "",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    hasTaxDeclarationTab: true,
    layoutType: "payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT001", name: "Công ty TNHH Dịch vụ Vận tải An Bình", person: "Trần Văn Bình", address: "Hải Phòng" },
      { code: "DT004", name: "Công ty CP Dược phẩm Sao Thái Dương", person: "Phạm Hải Đăng", address: "Hà Nội" },
    ],
  },
  {
    id: "salary_advance",
    index: 4,
    label: "4. Trả lương tạm ứng cho nhân viên",
    shortLabel: "4. Trả lương tạm ứng cho nhân viên",
    codeLabel: "Mã nhân viên",
    nameLabel: "Tên nhân viên",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả lương tạm ứng cho nhân viên",
    defaultDebit: "334",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    layoutType: "payment_standard",
    extraColumns: ["employeeCode", "employeeName"],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán" },
      { code: "NV0008", name: "Trương Quốc Khánh", person: "Trương Quốc Khánh", address: "Phòng Marketing" },
    ],
  },
  {
    id: "salary_payment",
    index: 5,
    label: "5. Trả lương nhân viên",
    shortLabel: "5. Trả lương nhân viên",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả lương nhân viên",
    defaultDebit: "334",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    layoutType: "payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT002", name: "Nhân viên Toàn công ty", person: "Đại diện Công đoàn", address: "Hà Nội" },
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh" },
    ],
  },
  {
    id: "bank_deposit",
    index: 6,
    label: "6. Gửi tiền vào ngân hàng",
    shortLabel: "6. Gửi tiền vào ngân hàng",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Gửi tiền vào ngân hàng",
    defaultDebit: "112",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    layoutType: "payment_standard",
    extraColumns: ["bankAccount", "bankName"],
    samplePartners: [
      { code: "DT001", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", person: "Nguyễn Văn A", address: "Hà Nội" },
      { code: "DT002", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", person: "Trần Thị B", address: "Hà Nội" },
      { code: "DT003", name: "Ngân hàng TMCP Quân đội (MBBank)", person: "Lê Văn C", address: "Hà Nội" },
    ],
  },
  {
    id: "loan_disbursement",
    index: 7,
    label: "7. Chi cho vay",
    shortLabel: "7. Chi cho vay",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho vay",
    defaultDebit: "1283",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    layoutType: "payment_supplier",
    extraColumns: ["partnerCode", "partnerName", "loanContract"],
    samplePartners: [
      { code: "DT001", name: "Công ty CP Tập đoàn Tài chính Hòa Bình", person: "Vũ Hải Đăng", address: "Cầu Giấy, Hà Nội" },
      { code: "DT005", name: "Công ty TNHH Đầu tư Việt Hưng", person: "Lê Minh Tuấn", address: "Đống Đa, Hà Nội" },
    ],
  },
  {
    id: "other_expense",
    index: 8,
    label: "8. Chi khác",
    shortLabel: "8. Chi khác",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho",
    defaultDebit: "",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    layoutType: "payment_supplier",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT001", name: "Công ty Cổ phần Vận chuyển Á Châu", person: "Phạm Quốc Hùng", address: "Hoàng Mai, Hà Nội" },
      { code: "DT003", name: "Trung tâm Hội nghị Quốc gia", person: "Trần Mai Anh", address: "Nam Từ Liêm, Hà Nội" },
    ],
  },
  {
    id: "corporate_tax",
    index: 9,
    label: "9. Nộp thuế TNDN tạm tính",
    shortLabel: "9. Nộp thuế TNDN tạm tính",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Nộp thuế thu nhập doanh nghiệp tạm tính",
    defaultDebit: "3334",
    defaultCredit: "111",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    hasYearField: true,
    layoutType: "payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT001", name: "Chi cục Thuế TP Hà Nội - Kho bạc Nhà nước", person: "Kho bạc Nhà nước", address: "Hà Nội" },
      { code: "DT002", name: "Chi cục Thuế Quận Cầu Giấy", person: "Đại diện Thuế", address: "Cầu Giấy, Hà Nội" },
    ],
  },
];

export const MISA_BANK_PAYMENT_TYPES: VoucherTypeOption[] = [
  {
    id: "supplier",
    index: 1,
    label: "1. Trả tiền nhà cung cấp (không theo hóa đơn)",
    shortLabel: "1. Trả tiền nhà cung cấp (không th...",
    codeLabel: "Mã nhà cung cấp",
    nameLabel: "Tên nhà cung cấp",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả tiền nhà cung cấp",
    defaultDebit: "331",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: true,
    hasBatchPaymentCheckbox: true,
    layoutType: "bank_payment_supplier",
    extraColumns: [],
    samplePartners: [
      { code: "NCC001", name: "Công ty TNHH Thiết bị Văn phòng Hồng Hà", person: "Nguyễn Đức Anh", address: "25 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội", bankAccount: "0021000348291", bankName: "Vietcombank - CN Thăng Long" },
      { code: "NCC002", name: "Công ty CP Giấy Hải Tiến", person: "Trần Thị Nga", address: "Phố Nối, Hưng Yên", bankAccount: "19028374910012", bankName: "Techcombank - CN Phố Nối" },
      { code: "NCC003", name: "Công ty Viễn thông CMC", person: "Đỗ Tuấn Kiệt", address: "Duy Tân, Cầu Giấy, Hà Nội", bankAccount: "21510008472910", bankName: "BIDV - CN Cầu Giấy" },
    ],
  },
  {
    id: "loan_payment",
    index: 2,
    label: "2. Trả các khoản vay",
    shortLabel: "2. Trả các khoản vay",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả các khoản vay cho",
    defaultDebit: "3411",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    hasQuickAddHint: true,
    layoutType: "bank_payment_standard",
    extraColumns: ["loanContract"],
    samplePartners: [
      { code: "NH001", name: "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)", person: "Đại diện Tín dụng VCB", address: "198 Trần Quang Khải, Hoàn Kiếm, Hà Nội", bankAccount: "0011004123899", bankName: "Vietcombank - Sở Giao Dịch" },
      { code: "NH003", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)", person: "Phòng Tín dụng DN", address: "35 Hàng Vôi, Hoàn Kiếm, Hà Nội", bankAccount: "2151000129", bankName: "BIDV - CN Hoàn Kiếm" },
      { code: "DT001", name: "Công ty CP Tập đoàn Tài chính Hòa Bình", person: "Vũ Hải Đăng", address: "Cầu Giấy, Hà Nội", bankAccount: "1903482710", bankName: "Techcombank - Hội sở" },
    ],
  },
  {
    id: "advance",
    index: 3,
    label: "3. Tạm ứng cho nhân viên",
    shortLabel: "3. Tạm ứng cho nhân viên",
    codeLabel: "Mã nhân viên",
    nameLabel: "Tên nhân viên",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Tạm ứng cho nhân viên",
    defaultDebit: "141",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    hasSettlementDueDate: true,
    layoutType: "bank_payment_advance",
    extraColumns: [],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh & Dự án", bankAccount: "1028475929", bankName: "Vietcombank - CN Hoàn Kiếm" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán - Tài chính", bankAccount: "1023847592", bankName: "Vietcombank - CN Ba Đình" },
      { code: "NV0012", name: "Đặng Văn Lâm", person: "Đặng Văn Lâm", address: "Phòng Kỹ thuật & Công nghệ", bankAccount: "1903482710", bankName: "Techcombank - Hội sở" },
    ],
  },
  {
    id: "external_purchase",
    index: 4,
    label: "4. Chi mua ngoài có hóa đơn",
    shortLabel: "4. Chi mua ngoài có hóa đơn",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi mua ngoài có hóa đơn cho",
    defaultDebit: "",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    hasTaxDeclarationTab: true,
    layoutType: "bank_payment_external",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT001", name: "Công ty TNHH Dịch vụ Vận tải An Bình", person: "Trần Văn Bình", address: "Hải Phòng", bankAccount: "0021000348291", bankName: "Vietcombank - CN Hải Phòng" },
      { code: "DT004", name: "Công ty CP Dược phẩm Sao Thái Dương", person: "Phạm Hải Đăng", address: "Hà Nội", bankAccount: "19028374910012", bankName: "Techcombank - CN Thăng Long" },
    ],
  },
  {
    id: "salary_advance",
    index: 5,
    label: "5. Trả lương tạm ứng cho nhân viên",
    shortLabel: "5. Trả lương tạm ứng cho nhân viên",
    codeLabel: "Mã nhân viên",
    nameLabel: "Tên nhân viên",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả lương tạm ứng cho nhân viên cho",
    defaultDebit: "334",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasCustomerDebtBtn: false,
    layoutType: "bank_payment_salary_advance",
    extraColumns: ["employeeCode", "employeeName"],
    samplePartners: [
      { code: "NV0005", name: "Hoàng Thiên Bảo", person: "Hoàng Thiên Bảo", address: "Phòng Kinh doanh", bankAccount: "1028475929", bankName: "Vietcombank - CN Hoàn Kiếm" },
      { code: "NV0001", name: "Nguyễn Thị Mai", person: "Nguyễn Thị Mai", address: "Phòng Kế toán", bankAccount: "1023847592", bankName: "Vietcombank - CN Ba Đình" },
      { code: "NV0008", name: "Trương Quốc Khánh", person: "Trương Quốc Khánh", address: "Phòng Marketing", bankAccount: "2151000129", bankName: "BIDV - CN Cầu Giấy" },
    ],
  },
  {
    id: "salary_payment",
    index: 6,
    label: "6. Trả lương nhân viên",
    shortLabel: "6. Trả lương nhân viên",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Trả lương nhân viên",
    defaultDebit: "334",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    hasBatchPaymentCheckbox: true,
    layoutType: "bank_payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT002", name: "Nhân viên Toàn công ty", person: "Đại diện Công đoàn", address: "Hà Nội", bankAccount: "0011004123899", bankName: "Vietcombank - Hội sở" },
      { code: "DT005", name: "Phòng Kỹ thuật & Công nghệ", person: "Đỗ Tuấn Kiệt", address: "Cầu Giấy, Hà Nội", bankAccount: "0021000348291", bankName: "Vietcombank - CN Thăng Long" },
    ],
  },
  {
    id: "loan_disbursement",
    index: 7,
    label: "7. Chi cho vay",
    shortLabel: "7. Chi cho vay",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho vay",
    defaultDebit: "1283",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    hasBatchPaymentCheckbox: true,
    layoutType: "bank_payment_standard",
    extraColumns: ["partnerCode", "partnerName", "loanDisbursementContract"],
    samplePartners: [
      { code: "DT001", name: "Công ty CP Tập đoàn Tài chính Hòa Bình", person: "Vũ Hải Đăng", address: "Cầu Giấy, Hà Nội", bankAccount: "1903482710", bankName: "Techcombank - Hội sở" },
      { code: "DT006", name: "Công ty CP Bất động sản Thăng Long", person: "Lê Văn Hùng", address: "Nam Từ Liêm, Hà Nội", bankAccount: "21510008472910", bankName: "BIDV - CN Cầu Giấy" },
    ],
  },
  {
    id: "other_expense",
    index: 8,
    label: "8. Chi khác",
    shortLabel: "8. Chi khác",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Chi tiền cho",
    defaultDebit: "",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: true,
    hasCustomerDebtBtn: false,
    hasBatchPaymentCheckbox: true,
    layoutType: "bank_payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "DT001", name: "Công ty Cổ phần Vận chuyển Á Châu", person: "Phạm Quốc Hùng", address: "Hoàng Mai, Hà Nội", bankAccount: "0021000348291", bankName: "Vietcombank - CN Thăng Long" },
      { code: "DT003", name: "Công ty Dịch vụ Môi trường Đô thị", person: "Nguyễn Văn Tuấn", address: "Đống Đa, Hà Nội", bankAccount: "19028374910012", bankName: "Techcombank - CN Thăng Long" },
    ],
  },
  {
    id: "tax_cit_payment",
    index: 9,
    label: "9. Nộp thuế TNDN tạm tính",
    shortLabel: "9. Nộp thuế TNDN tạm tính",
    codeLabel: "Mã đối tượng",
    nameLabel: "Tên đối tượng",
    personLabel: "Người nhận",
    addressLabel: "Địa chỉ",
    defaultPartnerCode: "",
    defaultPartnerName: "",
    defaultPerson: "",
    defaultAddress: "",
    defaultReason: "Nộp thuế thu nhập doanh nghiệp tạm tính",
    defaultDebit: "3334",
    defaultCredit: "112",
    defaultAmount: 0,
    hasEmployeeField: false,
    hasYearField: true,
    hasCustomerDebtBtn: false,
    hasBatchPaymentCheckbox: false,
    layoutType: "bank_payment_standard",
    extraColumns: ["partnerCode", "partnerName"],
    samplePartners: [
      { code: "CQT001", name: "Chi cục Thuế Quận Cầu Giấy", person: "Kho bạc Nhà nước Cầu Giấy", address: "Số 68 Nguyễn Phong Sắc, Cầu Giấy, Hà Nội", bankAccount: "71111054321", bankName: "Kho bạc Nhà nước Cầu Giấy" },
      { code: "CQT002", name: "Cục Thuế Thành phố Hà Nội", person: "Kho bạc Nhà nước Hà Nội", address: "187 Giảng Võ, Đống Đa, Hà Nội", bankAccount: "71111000001", bankName: "Kho bạc Nhà nước TP Hà Nội" },
    ],
  },
];

export interface VoucherDetailRow {
  id: string;
  description: string;
  debit: string;
  credit: string;
  amount: number;
  bankAccount?: string;
  bankName?: string;
  partnerCode?: string;
  partnerName?: string;
  employeeCode?: string;
  employeeName?: string;
  loanContract?: string;
  loanDisbursementContract?: string;
}

export interface VoucherTaxRow {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceSeries: string;
  partnerCode: string;
  partnerName: string;
  taxCode: string;
  itemDescription: string;
  untaxedAmount: number;
  taxRate: number;
  taxAmount: number;
  taxAccount: string;
}

// ----------------------------------------------------------------------
// 3. MODAL "TẠO PHIẾU THU / CHI" MISA FORM CHUẨN (CHUẨN 5 LOẠI MISA)
// ----------------------------------------------------------------------
export function CreateVoucherModal({
  kind,
  voucherCategory = "cash",
  initialTypeIndex = 0,
  onClose,
  onSave,
}: {
  kind: "receipt" | "payment";
  voucherCategory?: "cash" | "bank";
  initialTypeIndex?: number;
  onClose: () => void;
  onSave: (doc: any) => void;
}) {
  const [currentCategory, setCurrentCategory] = useState<"cash" | "bank">(voucherCategory);
  const isBank = currentCategory === "bank";
  const isReceipt = kind === "receipt";
  const voucherTypes = isReceipt
    ? (isBank ? MISA_BANK_RECEIPT_TYPES : MISA_RECEIPT_TYPES)
    : (isBank ? MISA_BANK_PAYMENT_TYPES : MISA_PAYMENT_TYPES);

  // Defaults: For receipt/payment
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(initialTypeIndex);
  const currentType = voucherTypes[selectedTypeIndex] || voucherTypes[0];

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showPartnerDropdown, setShowPartnerDropdown] = useState(false);
  const [showBankAccountDropdown, setShowBankAccountDropdown] = useState(false);
  const [showReceiverDropdown, setShowReceiverDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Ủy nhiệm chi");
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [isBatchPayment, setIsBatchPayment] = useState(false);
  const [showRefModal, setShowRefModal] = useState(false);
  const [showDebtLookupModal, setShowDebtLookupModal] = useState(false);

  const initialCode = isBank
    ? (isReceipt ? "NTTK00001" : "UNC00001")
    : (isReceipt ? "PT00001" : "PC00001");
  const [code, setCode] = useState(initialCode);
  const [bankAccount, setBankAccount] = useState("");
  const [bankName, setBankName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [receiverBank, setReceiverBank] = useState("");
  const [partnerCode, setPartnerCode] = useState(currentType.defaultPartnerCode);
  const [partnerName, setPartnerName] = useState(currentType.defaultPartnerName);
  const [person, setPerson] = useState(currentType.defaultPerson);
  const [address, setAddress] = useState(currentType.defaultAddress);
  const [employee, setEmployee] = useState("");
  const [reason, setReason] = useState(currentType.defaultReason);
  const [originalDocsCount, setOriginalDocsCount] = useState<string>("");
  const [settlementDueDate, setSettlementDueDate] = useState("");
  const [taxYear, setTaxYear] = useState<number>(2026);
  const [hachToanDate, setHachToanDate] = useState("02/10/2026");
  const [voucherDate, setVoucherDate] = useState("02/10/2026");
  const [showAccount, setShowAccount] = useState(true);
  const [activeTab, setActiveTab] = useState<"accounting" | "tax">("accounting");
  const [batchTaxInvoices, setBatchTaxInvoices] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const initialDebit = isReceipt
    ? (isBank ? "112" : "111")
    : (currentType.defaultDebit || "");
  const initialCredit = !isReceipt
    ? (isBank ? "112" : "111")
    : (currentType.defaultCredit || "");

  // Rows state in detail table
  const [rows, setRows] = useState<VoucherDetailRow[]>([
    {
      id: "1",
      description: currentType.defaultReason,
      debit: initialDebit,
      credit: initialCredit,
      amount: currentType.defaultAmount,
      bankAccount: "",
      bankName: "",
      partnerCode: "",
      partnerName: "",
      employeeCode: "",
      employeeName: "",
      loanContract: "",
      loanDisbursementContract: "",
    },
  ]);

  // Tax rows state in "Kê khai hóa đơn và hạch toán thuế"
  const [taxRows, setTaxRows] = useState<VoucherTaxRow[]>([
    {
      id: "1",
      invoiceNo: "0001234",
      invoiceDate: "02/10/2026",
      invoiceSeries: "1C26TAA",
      partnerCode: currentType.defaultPartnerCode || "",
      partnerName: currentType.defaultPartnerName || "",
      taxCode: "0108849201",
      itemDescription: "Chi phí mua ngoài",
      untaxedAmount: 0,
      taxRate: 10,
      taxAmount: 0,
      taxAccount: "1331",
    },
  ]);

  // Compute total amounts
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [rows]);

  const totalUntaxedAmount = useMemo(() => {
    return taxRows.reduce((sum, r) => sum + (Number(r.untaxedAmount) || 0), 0);
  }, [taxRows]);

  const totalTaxAmount = useMemo(() => {
    return taxRows.reduce((sum, r) => sum + (Number(r.taxAmount) || 0), 0);
  }, [taxRows]);

  const handleToggleCategory = (cat: "cash" | "bank") => {
    setCurrentCategory(cat);
    const nextIsBank = cat === "bank";
    const nextVoucherTypes = isReceipt
      ? (nextIsBank ? MISA_BANK_RECEIPT_TYPES : MISA_RECEIPT_TYPES)
      : (nextIsBank ? MISA_BANK_PAYMENT_TYPES : MISA_PAYMENT_TYPES);
    const nextIdx = Math.min(selectedTypeIndex, nextVoucherTypes.length - 1);
    setSelectedTypeIndex(nextIdx);
    const nextType = nextVoucherTypes[nextIdx] || nextVoucherTypes[0];
    setPartnerCode(nextType.defaultPartnerCode);
    setPartnerName(nextType.defaultPartnerName);
    setPerson(nextType.defaultPerson);
    setAddress(nextType.defaultAddress);
    setReason(nextType.defaultReason);
    if (cat === "bank") {
      if (isReceipt) {
        if (!code.startsWith("NTTK")) setCode("NTTK00001");
      } else {
        if (!code.startsWith("UNC")) setCode("UNC00001");
      }
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          debit: isReceipt ? "112" : (nextType.defaultDebit || r.debit),
          credit: !isReceipt ? "112" : nextType.defaultCredit,
        }))
      );
    } else {
      if (code.startsWith("NTTK") || code.startsWith("UNC")) {
        setCode(isReceipt ? "PT00001" : "PC00001");
      }
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          debit: isReceipt ? "111" : (nextType.defaultDebit || r.debit),
          credit: !isReceipt ? "111" : nextType.defaultCredit,
        }))
      );
    }
  };

  // Switching voucher type
  const handleSelectType = (idx: number) => {
    setSelectedTypeIndex(idx);
    setShowTypeDropdown(false);
    setShowPartnerDropdown(false);
    setShowBankAccountDropdown(false);
    setShowReceiverDropdown(false);
    setShowEmployeeDropdown(false);
    setShowPaymentMethodDropdown(false);
    const chosen = voucherTypes[idx] || voucherTypes[0];
    setPartnerCode(chosen.defaultPartnerCode);
    setPartnerName(chosen.defaultPartnerName);
    setPerson(chosen.defaultPerson);
    setAddress(chosen.defaultAddress);
    setReason(chosen.defaultReason);
    setEmployee("");
    setSettlementDueDate(chosen.hasSettlementDueDate ? "02/10/2026" : "");
    if (chosen.hasYearField) {
      setTaxYear(2026);
    }
    setActiveTab("accounting");
    setBatchTaxInvoices(false);
    const debitAccount = isReceipt
      ? (isBank ? "112" : "111")
      : (chosen.defaultDebit || "");
    const creditAccount = !isReceipt
      ? (isBank ? "112" : "111")
      : (chosen.defaultCredit || "");
    setRows([
      {
        id: crypto.randomUUID(),
        description: chosen.defaultReason,
        debit: debitAccount,
        credit: creditAccount,
        amount: 0,
        bankAccount: bankAccount,
        bankName: bankName,
        partnerCode: chosen.extraColumns?.includes("partnerCode") ? (chosen.defaultPartnerCode || "") : "",
        partnerName: chosen.extraColumns?.includes("partnerName") ? (chosen.defaultPartnerName || "") : "",
        employeeCode: chosen.extraColumns?.includes("employeeCode") ? (chosen.defaultPartnerCode || "") : "",
        employeeName: chosen.extraColumns?.includes("employeeName") ? (chosen.defaultPartnerName || "") : "",
        loanContract: "",
        loanDisbursementContract: "",
      },
    ]);
    setTaxRows([
      {
        id: crypto.randomUUID(),
        invoiceNo: "0001234",
        invoiceDate: "02/10/2026",
        invoiceSeries: "1C26TAA",
        partnerCode: chosen.defaultPartnerCode || "",
        partnerName: chosen.defaultPartnerName || "",
        taxCode: "0108849201",
        itemDescription: chosen.defaultReason || "Chi mua ngoài có hóa đơn",
        untaxedAmount: 0,
        taxRate: 10,
        taxAmount: 0,
        taxAccount: "1331",
      },
    ]);
  };

  useEffect(() => {
    if (initialTypeIndex !== undefined && initialTypeIndex !== selectedTypeIndex) {
      handleSelectType(initialTypeIndex);
    }
  }, [initialTypeIndex]);

  const handleSelectPartner = (p: { code: string; name: string; person: string; address: string }) => {
    setPartnerCode(p.code);
    setPartnerName(p.name);
    setPerson(p.person);
    setAddress(p.address);
    setShowPartnerDropdown(false);
    // sync to rows
    setRows((prev) =>
      prev.map((r, i) =>
        i === 0
          ? {
            ...r,
            partnerCode: p.code,
            partnerName: p.name,
            employeeCode: p.code,
            employeeName: p.name,
          }
          : r
      )
    );
    setTaxRows((prev) =>
      prev.map((r, i) =>
        i === 0
          ? {
            ...r,
            partnerCode: p.code,
            partnerName: p.name,
          }
          : r
      )
    );
  };

  // Row operations for accounting table
  const handleAddRow = () => {
    const debitAccount = isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultDebit || "");
    const creditAccount = !isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultCredit || "");
    setRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: reason || currentType.defaultReason,
        debit: debitAccount,
        credit: creditAccount,
        amount: 0,
        bankAccount: bankAccount,
        bankName: bankName,
        partnerCode: partnerCode || "",
        partnerName: partnerName || "",
        employeeCode: partnerCode || "",
        employeeName: partnerName || "",
        loanContract: "",
        loanDisbursementContract: "",
      },
    ]);
  };

  const handleDeleteRow = (id: string) => {
    const debitAccount = isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultDebit || "");
    const creditAccount = !isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultCredit || "");
    if (rows.length <= 1) {
      setRows([
        {
          id: crypto.randomUUID(),
          description: reason,
          debit: debitAccount,
          credit: creditAccount,
          amount: 0,
          bankAccount: bankAccount,
          bankName: bankName,
          partnerCode: "",
          partnerName: "",
          employeeCode: "",
          employeeName: "",
          loanContract: "",
          loanDisbursementContract: "",
        },
      ]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllRows = () => {
    const debitAccount = isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultDebit || "");
    const creditAccount = !isReceipt
      ? (isBank ? "112" : "111")
      : (currentType.defaultCredit || "");
    setRows([
      {
        id: crypto.randomUUID(),
        description: reason,
        debit: debitAccount,
        credit: creditAccount,
        amount: 0,
        bankAccount: bankAccount,
        bankName: bankName,
        partnerCode: "",
        partnerName: "",
        employeeCode: "",
        employeeName: "",
        loanContract: "",
        loanDisbursementContract: "",
      },
    ]);
  };

  // Row operations for tax declaration table
  const handleAddTaxRow = () => {
    setTaxRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        invoiceNo: "",
        invoiceDate: "02/10/2026",
        invoiceSeries: "1C26TAA",
        partnerCode: partnerCode || "",
        partnerName: partnerName || "",
        taxCode: "",
        itemDescription: reason || "Chi mua ngoài có hóa đơn",
        untaxedAmount: 0,
        taxRate: 10,
        taxAmount: 0,
        taxAccount: "1331",
      },
    ]);
  };

  const handleDeleteTaxRow = (id: string) => {
    if (taxRows.length <= 1) {
      setTaxRows([
        {
          id: crypto.randomUUID(),
          invoiceNo: "",
          invoiceDate: "02/10/2026",
          invoiceSeries: "1C26TAA",
          partnerCode: "",
          partnerName: "",
          taxCode: "",
          itemDescription: reason || "Chi mua ngoài có hóa đơn",
          untaxedAmount: 0,
          taxRate: 10,
          taxAmount: 0,
          taxAccount: "1331",
        },
      ]);
      return;
    }
    setTaxRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllTaxRows = () => {
    setTaxRows([
      {
        id: crypto.randomUUID(),
        invoiceNo: "",
        invoiceDate: "02/10/2026",
        invoiceSeries: "1C26TAA",
        partnerCode: "",
        partnerName: "",
        taxCode: "",
        itemDescription: reason || "Chi mua ngoài có hóa đơn",
        untaxedAmount: 0,
        taxRate: 10,
        taxAmount: 0,
        taxAccount: "1331",
      },
    ]);
  };

  const handleUpdateTaxRow = (id: string, field: keyof VoucherTaxRow, value: any) => {
    setTaxRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === "untaxedAmount" || field === "taxRate") {
          const untaxed = field === "untaxedAmount" ? Number(value) : r.untaxedAmount;
          const rate = field === "taxRate" ? Number(value) : r.taxRate;
          updated.taxAmount = Math.round((untaxed * rate) / 100);
        }
        return updated;
      })
    );
  };

  const handleUpdateRow = (id: string, field: keyof VoucherDetailRow, val: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, [field]: val };
        }
        return r;
      }),
    );
  };

  // Handle Save
  const handleSave = (andNew = false) => {
    const formattedIsoDate = voucherDate.includes("/")
      ? voucherDate.split("/").reverse().join("-")
      : voucherDate;

    onSave({
      id: crypto.randomUUID(),
      code,
      date: formattedIsoDate,
      partner: partnerName || partnerCode,
      description: reason,
      amount: totalAmount,
      kind,
      status: "posted",
      debit: rows[0]?.debit || currentType.defaultDebit,
      credit: rows[0]?.credit || (isBank ? "112" : currentType.defaultCredit),
      person,
      address,
      bankAccount,
      bankName,
      receiverAccount,
      receiverBank,
      paymentMethod,
      isBatchPayment,
      rows,
    });

    if (andNew) {
      const numPart = parseInt(code.replace(/\D/g, "") || "1", 10) + 1;
      const prefix = isBank ? (isReceipt ? "NTTK" : "UNC") : (isReceipt ? "PT" : "PC");
      const nextCode = `${prefix}${String(numPart).padStart(5, "0")}`;
      setCode(nextCode);
      const debitAccount = isReceipt
        ? (isBank ? "112" : "111")
        : (currentType.defaultDebit || "");
      const creditAccount = !isReceipt
        ? (isBank ? "112" : "111")
        : (currentType.defaultCredit || "");
      setRows([
        {
          id: crypto.randomUUID(),
          description: currentType.defaultReason,
          debit: debitAccount,
          credit: creditAccount,
          amount: 0,
          bankAccount: bankAccount,
          bankName: "",
          partnerCode: "",
          partnerName: "",
          employeeCode: "",
          employeeName: "",
          loanContract: "",
          loanDisbursementContract: "",
        },
      ]);
      const msg = `Đã cất chứng từ ${code}! Sẵn sàng nhập tiếp ${nextCode}.`;
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      onClose();
    }
  };

  // Handle file drop/upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileNames = Array.from(e.target.files).map((f) => f.name);
      setAttachedFiles((prev) => [...prev, ...fileNames]);
    }
  };

  return (
    <div className="misa-tax-modal-overlay">
      <div className="misa-voucher-window">
        {/* Toast alert if any */}
        {toastMessage && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#00b06b",
              color: "#ffffff",
              padding: "6px 16px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Check size={16} />
            {toastMessage}
          </div>
        )}

        {/* 1. Header (Matching Screenshot) */}
        <header className="misa-voucher-header">
          <div className="misa-voucher-header-left">
            <button
              className="misa-voucher-back-btn"
              title="Quay lại / Lịch sử"
              type="button"
            >
              <RotateCcw size={16} />
            </button>

            <h2 className="misa-voucher-title" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {isBank ? (isReceipt ? "Thu tiền gửi" : "Ủy nhiệm chi") : (isReceipt ? "Phiếu thu" : "Phiếu chi")} {code}
              {isReceipt && !isBank && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: "#f0fdf4",
                    color: "#16a34a",
                    border: "1px solid #bbf7d0",
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                  title="Bấm để chuyển đổi giữa Tiền gửi (NTTK) và Tiền mặt (PT)"
                  onClick={() => handleToggleCategory(isBank ? "cash" : "bank")}
                >
                  Tiền mặt (PT) ⇄
                </span>
              )}
            </h2>

            {/* Type selector pill button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="misa-voucher-type-pill"
                style={{
                  border: showTypeDropdown ? "1px solid #00b06b" : "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "4px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffffff",
                  cursor: "pointer",
                }}
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              >
                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>
                  {currentType.label}
                </span>
                <Plus size={14} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
                {showTypeDropdown ? (
                  <ChevronUp size={14} style={{ color: "#111827" }} />
                ) : (
                  <ChevronDown size={14} style={{ color: "#64748b" }} />
                )}
              </button>

              {/* Type Dropdown Popover */}
              {showTypeDropdown && (
                <div
                  className="misa-voucher-type-menu"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    minWidth: 340,
                    maxHeight: 280,
                    overflowY: "auto",
                    width: "max-content",
                    background: "#ffffff",
                    borderRadius: 6,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                    border: "1px solid #e2e8f0",
                    padding: "4px 0",
                    zIndex: 100,
                  }}
                >
                  {voucherTypes.map((t, idx) => {
                    const isActive = idx === selectedTypeIndex;
                    return (
                      <div
                        key={t.id}
                        className={`misa-voucher-type-item ${isActive ? "active" : ""}`}
                        style={{
                          padding: "9px 16px",
                          fontSize: 13,
                          cursor: "pointer",
                          background: isActive ? "#00b06b" : "transparent",
                          color: isActive ? "#ffffff" : "#1e293b",
                          fontWeight: isActive ? 600 : 400,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "#dbece2";
                            e.currentTarget.style.color = "#047857";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#1e293b";
                          }
                        }}
                        onClick={() => handleSelectType(idx)}
                      >
                        <span>{t.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Method Selector Dropdown for Bank Payment (Matching all 5 screenshots) */}
            {isBank && !isReceipt && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="misa-voucher-type-pill"
                  style={{
                    border: showPaymentMethodDropdown ? "1px solid #00b06b" : "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "4px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowPaymentMethodDropdown(!showPaymentMethodDropdown)}
                >
                  <span style={{ fontWeight: 500, color: "#1e293b", fontSize: 13 }}>
                    {paymentMethod}
                  </span>
                  <ChevronDown size={14} style={{ color: "#64748b" }} />
                </button>

                {showPaymentMethodDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      minWidth: 180,
                      background: "#ffffff",
                      borderRadius: 6,
                      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                      border: "1px solid #e2e8f0",
                      padding: "4px 0",
                      zIndex: 100,
                    }}
                  >
                    {[
                      "Ủy nhiệm chi",
                      "Séc chuyển khoản",
                      "Séc tiền mặt",
                      "Bảng kê nộp thuế",
                    ].map((method) => {
                      const isActive = method === paymentMethod;
                      return (
                        <div
                          key={method}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            cursor: "pointer",
                            background: isActive ? "#00b06b" : "transparent",
                            color: isActive ? "#ffffff" : "#1e293b",
                            fontWeight: isActive ? 600 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = "#f1f5f9";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = "transparent";
                          }}
                          onClick={() => {
                            setPaymentMethod(method);
                            setShowPaymentMethodDropdown(false);
                          }}
                        >
                          {method}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="misa-voucher-header-tools">
            <a
              href="#help"
              className="misa-voucher-help-link"
              onClick={(e) => {
                e.preventDefault();
                alert(
                  `Hướng dẫn hạch toán theo chuẩn MISA:\n- Nghiệp vụ: ${currentType.label}\n- Nợ TK: ${currentType.defaultDebit || "(Tùy chọn)"}\n- Có TK: ${currentType.defaultCredit || "(Tùy chọn)"}`
                );
              }}
            >
              <HelpCircle size={15} style={{ color: "#00b06b" }} />
              <span>Hướng dẫn sử dụng</span>
              <ChevronDown size={12} />
            </a>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Thiết lập mẫu chứng từ"
            >
              <Settings size={16} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              onClick={onClose}
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Subheader: Là UNC chuyển tiền theo lô (Format 1 matching Screenshot 1) */}
        {isBank && !isReceipt && currentType.hasBatchPaymentCheckbox && (
          <div
            style={{
              padding: "6px 20px 2px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#334155",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={isBatchPayment}
                onChange={(e) => setIsBatchPayment(e.target.checked)}
                style={{ accentColor: "#00b06b", width: 15, height: 15 }}
              />
              <span>Là UNC chuyển tiền theo lô</span>
            </label>
          </div>
        )}

        {/* 2. Body Container */}
        <div className="misa-voucher-body">
          {/* Master Form Section */}
          <div className="misa-voucher-master-grid">
            {/* Left Section: Master Form Details */}
            <div className="misa-voucher-master-left">
              {isBank && !isReceipt ? (
                /* CHI TIỀN GỬI / ỦY NHIỆM CHI (MATCHING SCREENSHOTS 1, 2, 3, 4, 5) */
                <>
                  {/* Row 1: Tài khoản chi [+] [v] | Tên ngân hàng chi */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                      <label>Tài khoản chi</label>
                      <div className="misa-voucher-combo-input">
                        <input
                          type="text"
                          className="misa-voucher-input"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder=""
                        />
                        <div className="misa-voucher-combo-actions">
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Thêm tài khoản"
                            onClick={() => {
                              const acc = prompt("Nhập số tài khoản ngân hàng chi mới:");
                              if (acc) setBankAccount(acc);
                            }}
                          >
                            <Plus size={13} style={{ strokeWidth: 2.5 }} />
                          </button>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Chọn tài khoản"
                            onClick={() => setShowBankAccountDropdown(!showBankAccountDropdown)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                        {showBankAccountDropdown && (
                          <div className="misa-voucher-partner-dropdown" style={{ minWidth: 340 }}>
                            {SAMPLE_BANK_ACCOUNTS.map((b) => (
                              <div
                                key={b.account}
                                className="misa-voucher-partner-item"
                                onClick={() => {
                                  setBankAccount(b.account);
                                  setBankName(b.name);
                                  setShowBankAccountDropdown(false);
                                }}
                              >
                                <strong>{b.account}</strong>
                                <small style={{ color: "#64748b" }}>{b.name}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label style={{ visibility: "hidden" }}>Tên ngân hàng chi</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder=""
                      />
                    </div>
                  </div>

                  {/* Row 2: Mã nhà cung cấp / đối tượng / nhân viên [+] [v] [($)] | Tên */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                      <label>{currentType.codeLabel || "Mã đối tượng"}</label>
                      <div className="misa-voucher-combo-input">
                        <input
                          type="text"
                          className="misa-voucher-input"
                          value={partnerCode}
                          onChange={(e) => setPartnerCode(e.target.value)}
                        />
                        <div className="misa-voucher-combo-actions">
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Thêm nhanh"
                            onClick={() => {
                              const newCode = prompt(`Nhập ${currentType.codeLabel || "mã"} mới:`);
                              if (newCode) setPartnerCode(newCode);
                            }}
                          >
                            <Plus size={13} style={{ strokeWidth: 2.5 }} />
                          </button>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Chọn từ danh mục"
                            onClick={() => setShowPartnerDropdown(!showPartnerDropdown)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>

                        {currentType.hasCustomerDebtBtn && (
                          <button
                            type="button"
                            className="misa-voucher-circle-icon-btn"
                            title="Tra cứu công nợ nhà cung cấp"
                            onClick={() => setShowDebtLookupModal(true)}
                          >
                            $
                          </button>
                        )}

                        {showPartnerDropdown && (
                          <div className="misa-voucher-partner-dropdown" style={{ minWidth: 320 }}>
                            {currentType.samplePartners.map((p) => (
                              <div
                                key={p.code}
                                className="misa-voucher-partner-item"
                                onClick={() => {
                                  handleSelectPartner(p);
                                  if (p.bankAccount) setReceiverAccount(p.bankAccount);
                                  if (p.bankName) setReceiverBank(p.bankName);
                                }}
                              >
                                <strong>
                                  {p.code} - {p.name}
                                </strong>
                                <small style={{ color: "#64748b" }}>
                                  {p.person} | {p.address}
                                </small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label>{currentType.nameLabel || "Tên đối tượng"}</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 3: Địa chỉ full width */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label>{currentType.addressLabel || "Địa chỉ"}</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 4: Tài khoản nhận [v] | Ngân hàng nhận */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                      <label>Tài khoản nhận</label>
                      <div className="misa-voucher-combo-input">
                        <input
                          type="text"
                          className="misa-voucher-input"
                          value={receiverAccount}
                          onChange={(e) => setReceiverAccount(e.target.value)}
                          placeholder=""
                        />
                        <div className="misa-voucher-combo-actions">
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Chọn tài khoản nhận"
                            onClick={() => setShowReceiverDropdown(!showReceiverDropdown)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>
                        {showReceiverDropdown && (
                          <div className="misa-voucher-partner-dropdown" style={{ minWidth: 340 }}>
                            {SAMPLE_BENEFICIARY_ACCOUNTS.map((b) => (
                              <div
                                key={b.account}
                                className="misa-voucher-partner-item"
                                onClick={() => {
                                  setReceiverAccount(b.account);
                                  setReceiverBank(b.bank);
                                  setShowReceiverDropdown(false);
                                }}
                              >
                                <strong>{b.account}</strong>
                                <small style={{ color: "#64748b" }}>{b.name} - {b.bank}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label style={{ visibility: "hidden" }}>Ngân hàng nhận</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={receiverBank}
                        onChange={(e) => setReceiverBank(e.target.value)}
                        placeholder=""
                      />
                    </div>
                  </div>

                  {/* Row 5 & 6: Nhân viên + Nội dung thanh toán OR Nội dung thanh toán + Tham chiếu */}
                  {currentType.hasEmployeeField ? (
                    <>
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                          <label>Nhân viên</label>
                          <div className="misa-voucher-combo-input">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={employee}
                              onChange={(e) => setEmployee(e.target.value)}
                            />
                            <div className="misa-voucher-combo-actions">
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Thêm nhân viên"
                                onClick={() => {
                                  const emp = prompt("Nhập mã nhân viên mới:");
                                  if (emp) setEmployee(emp);
                                }}
                              >
                                <Plus size={13} style={{ strokeWidth: 2.5 }} />
                              </button>
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Chọn nhân viên"
                                onClick={() => setShowEmployeeDropdown(!showEmployeeDropdown)}
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>
                            {showEmployeeDropdown && (
                              <div className="misa-voucher-partner-dropdown" style={{ minWidth: 260 }}>
                                {SAMPLE_EMPLOYEES.map((emp) => (
                                  <div
                                    key={emp.code}
                                    className="misa-voucher-partner-item"
                                    onClick={() => {
                                      setEmployee(`${emp.code} - ${emp.name}`);
                                      setShowEmployeeDropdown(false);
                                    }}
                                  >
                                    <strong>{emp.code} - {emp.name}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Nội dung thanh toán</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason} ${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 6: Tham chiếu ... */}
                      <div style={{ paddingTop: 2 }}>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2, marginLeft: 4 }}>...</span>
                        </a>
                      </div>
                    </>
                  ) : currentType.hasYearField ? (
                    <>
                      <div className="misa-voucher-row-main" style={{ alignItems: "center" }}>
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Nội dung thanh toán</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason} ${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="misa-voucher-field" style={{ width: 85, flexShrink: 0 }}>
                          <label>Năm</label>
                          <input
                            type="number"
                            className="misa-voucher-input"
                            value={taxYear}
                            onChange={(e) => setTaxYear(Number(e.target.value) || 2026)}
                            style={{ textAlign: "center" }}
                          />
                        </div>
                      </div>

                      {/* Row 6: Tham chiếu ... */}
                      <div style={{ paddingTop: 2 }}>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2, marginLeft: 4 }}>...</span>
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="misa-voucher-row-main" style={{ alignItems: "center" }}>
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Nội dung thanh toán</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason} ${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 6: Tham chiếu ... */}
                      <div style={{ paddingTop: 2 }}>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2, marginLeft: 4 }}>...</span>
                        </a>
                      </div>
                    </>
                  )}
                </>
              ) : isReceipt ? (
                /* PHIẾU THU / THU TIỀN GỬI (MATCHING SCREENSHOT 1) */
                <>
                  {/* Row 1: Code and Name */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                      <label>{isReceipt ? "Mã đối tượng" : currentType.codeLabel}</label>
                      <div className="misa-voucher-combo-input">
                        <input
                          type="text"
                          className="misa-voucher-input"
                          value={partnerCode}
                          onChange={(e) => setPartnerCode(e.target.value)}
                        />
                        <div className="misa-voucher-combo-actions">
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Thêm nhanh"
                            onClick={() => {
                              const newCode = prompt(`Nhập ${currentType.codeLabel} mới:`);
                              if (newCode) setPartnerCode(newCode);
                            }}
                          >
                            <Plus size={13} style={{ strokeWidth: 2.5 }} />
                          </button>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Chọn từ danh mục"
                            onClick={() => setShowPartnerDropdown(!showPartnerDropdown)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>

                        {currentType.hasCustomerDebtBtn && (
                          <button
                            type="button"
                            className="misa-voucher-circle-icon-btn"
                            title={isReceipt ? "Tra cứu công nợ khách hàng" : "Tra cứu công nợ nhà cung cấp"}
                            onClick={() => setShowDebtLookupModal(true)}
                          >
                            $
                          </button>
                        )}

                        {showPartnerDropdown && (
                          <div className="misa-voucher-partner-dropdown">
                            {currentType.samplePartners.map((p) => (
                              <div
                                key={p.code}
                                className="misa-voucher-partner-item"
                                onClick={() => handleSelectPartner(p)}
                              >
                                <strong>
                                  {p.code} - {p.name}
                                </strong>
                                <small style={{ color: "#64748b" }}>
                                  {p.person} | {p.address}
                                </small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label>{isReceipt ? "Tên đối tượng" : currentType.nameLabel}</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                      />
                    </div>
                  </div>

                  {isBank ? (
                    <>
                      {/* Row 2 (Bank): Địa chỉ full width */}
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Địa chỉ</label>
                          <input
                            type="text"
                            className="misa-voucher-input"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 3 (Bank): Nộp vào tài khoản combo + Tên tài khoản ngân hàng */}
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                          <label>Nộp vào tài khoản</label>
                          <div className="misa-voucher-combo-input">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={bankAccount}
                              onChange={(e) => setBankAccount(e.target.value)}
                              placeholder=""
                            />
                            <div className="misa-voucher-combo-actions">
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Thêm tài khoản"
                                onClick={() => {
                                  const acc = prompt("Nhập số tài khoản ngân hàng mới:");
                                  if (acc) setBankAccount(acc);
                                }}
                              >
                                <Plus size={13} style={{ strokeWidth: 2.5 }} />
                              </button>
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Chọn tài khoản"
                                onClick={() => setShowBankAccountDropdown(!showBankAccountDropdown)}
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>

                            {showBankAccountDropdown && (
                              <div className="misa-voucher-partner-dropdown" style={{ minWidth: 320 }}>
                                {SAMPLE_BANK_ACCOUNTS.map((b) => (
                                  <div
                                    key={b.account}
                                    className="misa-voucher-partner-item"
                                    onClick={() => {
                                      setBankAccount(b.account);
                                      setBankName(b.name);
                                      setShowBankAccountDropdown(false);
                                    }}
                                  >
                                    <strong>{b.account}</strong>
                                    <small style={{ color: "#64748b" }}>{b.name}</small>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label style={{ visibility: "hidden" }}>Tên tài khoản</label>
                          <input
                            type="text"
                            className="misa-voucher-input"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder=""
                          />
                        </div>
                      </div>

                      {/* Row 4 (Bank): Lý do thu + Tham chiếu ... */}
                      <div className="misa-voucher-row-main" style={{ alignItems: "center" }}>
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Lý do thu</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason}${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>

                        <div style={{ marginLeft: 16, marginTop: 18, display: "flex", alignItems: "center" }}>
                          <a
                            href="#ref"
                            className="misa-voucher-ref-link"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowRefModal(true);
                            }}
                          >
                            <span>Tham chiếu</span>
                            <span style={{ letterSpacing: 2, marginLeft: 4 }}>...</span>
                          </a>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* CASH RECEIPT (Phiếu thu tiền mặt) */
                    <>
                      {/* Row 2: Người nộp + Địa chỉ */}
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                          <label>{currentType.personLabel || "Người nộp"}</label>
                          <input
                            type="text"
                            className="misa-voucher-input"
                            value={person}
                            onChange={(e) => setPerson(e.target.value)}
                          />
                        </div>

                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>{currentType.addressLabel || "Địa chỉ"}</label>
                          <input
                            type="text"
                            className="misa-voucher-input"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Row 3: Lý do nộp + Kèm theo [Số lượng] chứng từ gốc */}
                      <div className="misa-voucher-row-main" style={{ alignItems: "center" }}>
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Lý do nộp</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason}${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                          <label>Kèm theo</label>
                          <div className="misa-voucher-doc-count">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={originalDocsCount}
                              onChange={(e) => setOriginalDocsCount(e.target.value)}
                              placeholder="Số lượng"
                            />
                            <span>chứng từ gốc</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Tham chiếu */}
                      <div style={{ paddingTop: 2 }}>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2 }}>...</span>
                        </a>
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* PHIẾU CHI TIỀN MẶT LAYOUT */
                <>
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                      <label>{currentType.codeLabel}</label>
                      <div className="misa-voucher-combo-input">
                        <input
                          type="text"
                          className="misa-voucher-input"
                          value={partnerCode}
                          onChange={(e) => setPartnerCode(e.target.value)}
                        />
                        <div className="misa-voucher-combo-actions">
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Thêm nhanh"
                            onClick={() => {
                              const newCode = prompt(`Nhập ${currentType.codeLabel} mới:`);
                              if (newCode) setPartnerCode(newCode);
                            }}
                          >
                            <Plus size={13} style={{ strokeWidth: 2.5 }} />
                          </button>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            title="Chọn từ danh mục"
                            onClick={() => setShowPartnerDropdown(!showPartnerDropdown)}
                          >
                            <ChevronDown size={13} />
                          </button>
                        </div>

                        {currentType.hasCustomerDebtBtn && (
                          <button
                            type="button"
                            className="misa-voucher-circle-icon-btn"
                            title="Tra cứu công nợ nhà cung cấp"
                            onClick={() => setShowDebtLookupModal(true)}
                          >
                            $
                          </button>
                        )}

                        {showPartnerDropdown && (
                          <div className="misa-voucher-partner-dropdown">
                            {currentType.samplePartners.map((p) => (
                              <div
                                key={p.code}
                                className="misa-voucher-partner-item"
                                onClick={() => handleSelectPartner(p)}
                              >
                                <strong>
                                  {p.code} - {p.name}
                                </strong>
                                <small style={{ color: "#64748b" }}>
                                  {p.person} | {p.address}
                                </small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label>{currentType.nameLabel}</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={partnerName}
                        onChange={(e) => setPartnerName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Address */}
                  <div className="misa-voucher-row-main">
                    <div className="misa-voucher-field" style={{ flex: 1 }}>
                      <label>{currentType.addressLabel || "Địa chỉ"}</label>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>

                  {currentType.layoutType === "payment_supplier" ? (
                    /* PHIẾU CHI TYPE 1: Row 3 Lý do chi (full-width), Row 4 Nhân viên + Kèm theo, Row 5 Tham chiếu */
                    <>
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Lý do chi</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason} ${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ width: 240, flexShrink: 0 }}>
                          <label>Nhân viên</label>
                          <div className="misa-voucher-combo-input">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={employee}
                              onChange={(e) => setEmployee(e.target.value)}
                            />
                            <div className="misa-voucher-combo-actions">
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Thêm nhân viên"
                                onClick={() => {
                                  const emp = prompt("Nhập mã nhân viên mới:");
                                  if (emp) setEmployee(emp);
                                }}
                              >
                                <Plus size={13} style={{ strokeWidth: 2.5 }} />
                              </button>
                              <button
                                type="button"
                                className="misa-voucher-mini-btn"
                                title="Chọn nhân viên"
                                onClick={() => setEmployee("NV0005 - Hoàng Thiên Bảo")}
                              >
                                <ChevronDown size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="misa-voucher-field" style={{ width: 210, flexShrink: 0 }}>
                          <label>Kèm theo</label>
                          <div className="misa-voucher-doc-count">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={originalDocsCount}
                              onChange={(e) => setOriginalDocsCount(e.target.value)}
                              placeholder="Số lượng"
                            />
                            <span>chứng từ gốc</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2 }}>...</span>
                        </a>
                      </div>
                    </>
                  ) : (
                    /* PHIẾU CHI TYPE 2, 3, 4, 5: Row 3 Lý do chi + Kèm theo, Row 4 Tham chiếu */
                    <>
                      <div className="misa-voucher-row-main">
                        <div className="misa-voucher-field" style={{ flex: 1 }}>
                          <label>Lý do chi</label>
                          <div className="misa-voucher-reason-wrapper">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", e.target.value);
                                }
                              }}
                            />
                            <div
                              className="misa-voucher-ava-spark"
                              title="AVA AI Gợi ý lý do tự động"
                              onClick={() => {
                                const suggested = partnerName
                                  ? `${currentType.defaultReason} ${partnerName}`
                                  : currentType.defaultReason;
                                setReason(suggested);
                                if (rows.length > 0) {
                                  handleUpdateRow(rows[0].id, "description", suggested);
                                }
                              }}
                            >
                              <Sparkles size={14} />
                            </div>
                          </div>
                        </div>

                        {currentType.hasYearField && (
                          <div className="misa-voucher-field" style={{ width: 85, flexShrink: 0 }}>
                            <label>Năm</label>
                            <input
                              type="number"
                              className="misa-voucher-input"
                              value={taxYear}
                              onChange={(e) => setTaxYear(Number(e.target.value) || 2026)}
                              style={{ textAlign: "center" }}
                            />
                          </div>
                        )}

                        <div className="misa-voucher-field" style={{ width: 210, flexShrink: 0 }}>
                          <label>Kèm theo</label>
                          <div className="misa-voucher-doc-count">
                            <input
                              type="text"
                              className="misa-voucher-input"
                              value={originalDocsCount}
                              onChange={(e) => setOriginalDocsCount(e.target.value)}
                              placeholder="Số lượng"
                            />
                            <span>chứng từ gốc</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <a
                          href="#ref"
                          className="misa-voucher-ref-link"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowRefModal(true);
                          }}
                        >
                          <span>Tham chiếu</span>
                          <span style={{ letterSpacing: 2 }}>...</span>
                        </a>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Right Section: Dates, Total, Voucher Code, Settlement Due Date */}
            <div className="misa-voucher-master-right">
              {/* Row 1: Ngày hạch toán and Tổng tiền */}
              <div className="misa-voucher-right-row">
                <div className="misa-voucher-field" style={{ width: 145 }}>
                  <label>Ngày hạch toán</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      className="misa-voucher-input"
                      value={hachToanDate}
                      onChange={(e) => setHachToanDate(e.target.value)}
                      style={{ paddingRight: 26 }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div className="misa-voucher-total-block">
                  <div className="misa-voucher-total-label">Tổng tiền</div>
                  <div className="misa-voucher-total-number">
                    {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                  </div>
                </div>
              </div>

              {/* Row 2: Ngày chứng từ / Ngày phiếu */}
              <div className="misa-voucher-right-row">
                <div className="misa-voucher-field" style={{ width: 145 }}>
                  <label>{isBank ? "Ngày chứng từ" : (isReceipt ? "Ngày phiếu thu" : "Ngày phiếu chi")}</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      className="misa-voucher-input"
                      value={voucherDate}
                      onChange={(e) => setVoucherDate(e.target.value)}
                      style={{ paddingRight: 26 }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Số chứng từ */}
              <div className="misa-voucher-right-row">
                <div className="misa-voucher-field" style={{ width: 145 }}>
                  <label>{isBank ? "Số chứng từ" : (isReceipt ? "Số phiếu thu" : "Số phiếu chi")}</label>
                  <input
                    type="text"
                    className="misa-voucher-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Row 4 (Settlement Due Date for Advance / Format 3) */}
              {currentType.hasSettlementDueDate && (
                <div className="misa-voucher-right-row">
                  <div className="misa-voucher-field" style={{ width: 145 }}>
                    <label>Hạn quyết toán</label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <input
                        type="text"
                        className="misa-voucher-input"
                        value={settlementDueDate}
                        onChange={(e) => setSettlementDueDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{ paddingRight: 26 }}
                      />
                      <Calendar
                        size={14}
                        style={{
                          position: "absolute",
                          right: 8,
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

          {/* 3. Detail Section: Tab Bar & Accounting Grid Table */}
          <div className="misa-voucher-details-section" style={{ position: "relative" }}>
            {/* Drawer side toggle button matching MISA assistant */}
            <div
              className="misa-voucher-drawer-handle"
              title="Mở trợ lý kế toán AVA"
              onClick={() => alert("Trợ lý AVA AMIS Kế toán")}
            >
              <ChevronLeft size={14} />
            </div>

            <div className="misa-voucher-tabs-bar">
              <div
                className={`misa-voucher-tab ${activeTab === "accounting" ? "active" : ""}`}
                onClick={() => setActiveTab("accounting")}
                style={{ cursor: "pointer" }}
              >
                Hạch toán
              </div>

              {currentType.hasTaxDeclarationTab && (
                <div
                  className={`misa-voucher-tab ${activeTab === "tax" ? "active" : ""}`}
                  onClick={() => setActiveTab("tax")}
                  style={{
                    cursor: "pointer",
                    borderBottom: activeTab === "tax" ? "2px solid #00b06b" : "none",
                    color: activeTab === "tax" ? "#00b06b" : "#475569",
                    fontWeight: activeTab === "tax" ? 700 : 500,
                  }}
                >
                  Kê khai hóa đơn và hạch toán thuế
                </div>
              )}

              <div className="misa-voucher-tab-tools">
                {currentType.hasTaxDeclarationTab && (
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#374151",
                      cursor: "pointer",
                      marginRight: 10,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={batchTaxInvoices}
                      onChange={(e) => setBatchTaxInvoices(e.target.checked)}
                      style={{ accentColor: "#00b06b" }}
                    />
                    <span>Hạch toán gộp nhiều hóa đơn</span>
                    <HelpCircle size={13} style={{ color: "#9ca3af" }} />
                  </label>
                )}

                <button
                  type="button"
                  className="misa-voucher-ava-pill"
                  onClick={() => {
                    alert(
                      `AVA Kế toán: Đã kiểm tra hạch toán hợp lệ!\n- Nghiệp vụ: ${currentType.label}\n- Định khoản: Nợ TK ${currentType.defaultDebit || "(Tùy chọn)"} / Có TK ${currentType.defaultCredit || "(Tùy chọn)"}`
                    );
                  }}
                >
                  <img
                    src="/ava_avatar.jpg"
                    alt="AVA"
                    style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <span>AVA Kế toán</span>
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            {/* Grid Table */}
            {activeTab === "accounting" ? (
              <div className="misa-voucher-table-wrapper">
                <table className="misa-voucher-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th>Diễn giải</th>
                      {showAccount && (
                        <th style={{ width: 75, textAlign: "center" }}>TK Nợ</th>
                      )}
                      {showAccount && (
                        <th style={{ width: 75, textAlign: "center" }}>TK Có</th>
                      )}
                      <th style={{ width: 130, textAlign: "right" }}>Số tiền</th>
                      {currentType.extraColumns?.includes("bankAccount") && (
                        <th style={{ width: 130 }}>TK ngân hàng</th>
                      )}
                      {currentType.extraColumns?.includes("bankName") && (
                        <th style={{ width: 160 }}>Tên ngân hàng</th>
                      )}
                      {currentType.extraColumns?.includes("partnerCode") && (
                        <th style={{ width: 110 }}>Đối tượng</th>
                      )}
                      {currentType.extraColumns?.includes("partnerName") && (
                        <th style={{ width: 150 }}>Tên đối tượng</th>
                      )}
                      {currentType.extraColumns?.includes("employeeCode") && (
                        <th style={{ width: 110 }}>Mã nhân viên</th>
                      )}
                      {currentType.extraColumns?.includes("employeeName") && (
                        <th style={{ width: 150 }}>Tên nhân viên</th>
                      )}
                      {currentType.extraColumns?.includes("loanContract") && (
                        <th style={{ width: 140 }}>Khế ước đi vay</th>
                      )}
                      {currentType.extraColumns?.includes("loanDisbursementContract") && (
                        <th style={{ width: 140 }}>Khế ước cho vay</th>
                      )}
                      <th style={{ width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id}>
                        <td style={{ textAlign: "center", color: "#64748b" }}>
                          {idx + 1}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={row.description}
                            onChange={(e) =>
                              handleUpdateRow(row.id, "description", e.target.value)
                            }
                            placeholder="Diễn giải nghiệp vụ..."
                          />
                        </td>
                        {showAccount && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              style={{ textAlign: "center" }}
                              value={row.debit}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "debit", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {showAccount && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              style={{ textAlign: "center" }}
                              value={row.credit}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "credit", e.target.value)
                              }
                            />
                          </td>
                        )}
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            style={{ textAlign: "right", fontWeight: 500 }}
                            value={row.amount === 0 ? "0" : formatVND(row.amount)}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                              handleUpdateRow(row.id, "amount", raw);
                            }}
                          />
                        </td>
                        {currentType.extraColumns?.includes("bankAccount") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.bankAccount || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "bankAccount", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("bankName") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.bankName || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "bankName", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("partnerCode") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.partnerCode || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "partnerCode", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("partnerName") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.partnerName || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "partnerName", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("employeeCode") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.employeeCode || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "employeeCode", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("employeeName") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.employeeName || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "employeeName", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("loanContract") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.loanContract || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "loanContract", e.target.value)
                              }
                            />
                          </td>
                        )}
                        {currentType.extraColumns?.includes("loanDisbursementContract") && (
                          <td>
                            <input
                              type="text"
                              className="misa-voucher-cell-input"
                              value={row.loanDisbursementContract || ""}
                              onChange={(e) =>
                                handleUpdateRow(row.id, "loanDisbursementContract", e.target.value)
                              }
                            />
                          </td>
                        )}
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            style={{ color: "#ef4444" }}
                            title="Xóa dòng này"
                            onClick={() => handleDeleteRow(row.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      <td></td>
                      {showAccount && <td></td>}
                      {showAccount && <td></td>}
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        {totalAmount === 0 ? "0" : formatVND(totalAmount)}
                      </td>
                      {currentType.extraColumns?.map((col) => (
                        <td key={col}></td>
                      ))}
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="misa-voucher-table-wrapper">
                <table className="misa-voucher-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th style={{ width: 110 }}>Số hóa đơn</th>
                      <th style={{ width: 110 }}>Ngày HĐ</th>
                      <th style={{ width: 100 }}>Ký hiệu HĐ</th>
                      <th style={{ width: 110 }}>Mã đối tượng</th>
                      <th style={{ width: 150 }}>Tên đối tượng</th>
                      <th style={{ width: 120 }}>Mã số thuế</th>
                      <th>Diễn giải hàng hóa, DV</th>
                      <th style={{ width: 130, textAlign: "right" }}>Giá trị chưa thuế</th>
                      <th style={{ width: 85, textAlign: "center" }}>% thuế</th>
                      <th style={{ width: 120, textAlign: "right" }}>Tiền thuế GTGT</th>
                      <th style={{ width: 75, textAlign: "center" }}>TK thuế</th>
                      <th style={{ width: 40, textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxRows.map((tr, idx) => (
                      <tr key={tr.id}>
                        <td style={{ textAlign: "center", color: "#64748b" }}>
                          {idx + 1}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.invoiceNo}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "invoiceNo", e.target.value)}
                            placeholder="0001234"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.invoiceDate}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "invoiceDate", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.invoiceSeries}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "invoiceSeries", e.target.value)}
                            placeholder="1C26TAA"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.partnerCode}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "partnerCode", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.partnerName}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "partnerName", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.taxCode}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "taxCode", e.target.value)}
                            placeholder="MST..."
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            value={tr.itemDescription}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "itemDescription", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            style={{ textAlign: "right", fontWeight: 500 }}
                            value={tr.untaxedAmount === 0 ? "0" : formatVND(tr.untaxedAmount)}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                              handleUpdateTaxRow(tr.id, "untaxedAmount", raw);
                            }}
                          />
                        </td>
                        <td>
                          <select
                            className="misa-voucher-cell-input"
                            style={{ textAlign: "center", cursor: "pointer" }}
                            value={tr.taxRate}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "taxRate", Number(e.target.value))}
                          >
                            <option value={0}>0%</option>
                            <option value={5}>5%</option>
                            <option value={8}>8%</option>
                            <option value={10}>10%</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            style={{ textAlign: "right", fontWeight: 600, color: "#00b06b" }}
                            value={tr.taxAmount === 0 ? "0" : formatVND(tr.taxAmount)}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                              handleUpdateTaxRow(tr.id, "taxAmount", raw);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="misa-voucher-cell-input"
                            style={{ textAlign: "center" }}
                            value={tr.taxAccount}
                            onChange={(e) => handleUpdateTaxRow(tr.id, "taxAccount", e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="misa-voucher-mini-btn"
                            style={{ color: "#ef4444" }}
                            title="Xóa dòng hóa đơn này"
                            onClick={() => handleDeleteTaxRow(tr.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>Tổng cộng:</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                        {totalUntaxedAmount === 0 ? "0" : formatVND(totalUntaxedAmount)}
                      </td>
                      <td></td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#00b06b" }}>
                        {totalTaxAmount === 0 ? "0" : formatVND(totalTaxAmount)}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Toolbar under table */}
            <div className="misa-voucher-table-toolbar">
              <div className="misa-voucher-toolbar-left">
                <span className="misa-voucher-count-badge">
                  Tổng số: {activeTab === "tax" ? taxRows.length : rows.length}
                </span>

                <button
                  type="button"
                  className="misa-voucher-tool-btn"
                  onClick={activeTab === "tax" ? handleAddTaxRow : handleAddRow}
                >
                  <Plus size={13} style={{ color: "#00b06b", strokeWidth: 2.5 }} />
                  <span>Thêm dòng</span>
                </button>

                <button
                  type="button"
                  className="misa-voucher-tool-btn"
                  onClick={activeTab === "tax" ? handleClearAllTaxRows : handleClearAllRows}
                >
                  <Trash2 size={13} style={{ color: "#ef4444" }} />
                  <span>Xóa hết dòng</span>
                </button>

                {isReceipt && (
                  <button
                    type="button"
                    className="misa-voucher-tool-btn"
                    onClick={() => {
                      const note = prompt("Nhập ghi chú cho chứng từ:");
                      if (note) alert(`Đã thêm ghi chú: ${note}`);
                    }}
                  >
                    <FileText size={13} />
                    <span>Thêm ghi chú</span>
                  </button>
                )}
              </div>

              <div className="misa-voucher-toolbar-right">
                <span>Số dòng/trang</span>
                <select
                  style={{
                    height: 24,
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12,
                    padding: "0 4px",
                  }}
                  defaultValue="20"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: "#64748b",
                    fontSize: 13,
                    userSelect: "none",
                  }}
                >
                  <span style={{ cursor: "pointer" }}>|&lt;</span>
                  <span style={{ cursor: "pointer" }}>&lt;</span>
                  <span style={{ fontWeight: 700, color: "#00b06b" }}>1</span>
                  <span style={{ cursor: "pointer" }}>&gt;</span>
                  <span style={{ cursor: "pointer" }}>&gt;|</span>
                </div>
              </div>
            </div>

            {/* 4. Attachment Dropzone */}
            <div className="misa-voucher-attach-zone">
              <div className="misa-voucher-attach-header">
                <Paperclip size={13} style={{ color: "#00b06b" }} />
                <span style={{ fontWeight: 600, color: "#1e293b" }}>Đính kèm</span>
                <span style={{ color: "#64748b", fontSize: 12, marginLeft: 6 }}>
                  Dung lượng tối đa 5MB
                </span>
              </div>

              <label className="misa-voucher-dropzone">
                <Upload size={16} style={{ color: "#64748b" }} />
                <span>
                  {attachedFiles.length > 0 ? (
                    `Đã đính kèm (${attachedFiles.length}): ${attachedFiles.join(", ")}`
                  ) : (
                    <>
                      <span style={{ color: "#2563eb", cursor: "pointer" }}>Chọn tệp</span> hoặc
                      kéo và thả tệp vào đây
                    </>
                  )}
                </span>
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Quick hint for format 2 matching Screenshot 2 */}
        {currentType.hasQuickAddHint && (
          <div
            style={{
              padding: "4px 20px",
              fontSize: 12,
              color: "#475569",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <span>F9 - Thêm nhanh</span>
          </div>
        )}

        {/* 5. Footer Action Bar (Matching Screenshot) */}
        <footer className="misa-voucher-footer">
          <div className="misa-voucher-footer-left" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <label className="misa-voucher-ios-toggle">
              <input
                type="checkbox"
                checked={showAccount}
                onChange={(e) => setShowAccount(e.target.checked)}
              />
              <span className="misa-voucher-ios-slider" />
              <span className="misa-voucher-toggle-text">Hiển thị tài khoản</span>
            </label>
          </div>

          <div className="misa-voucher-footer-right">
            <button
              type="button"
              className="misa-voucher-btn-white"
              onClick={onClose}
            >
              Hủy
            </button>

            <button
              type="button"
              className="misa-voucher-btn-white"
              onClick={() => handleSave(false)}
            >
              Cất
            </button>

            <button
              type="button"
              className="misa-voucher-btn-green"
              onClick={() => handleSave(true)}
            >
              <span>Cất và Thêm</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </footer>

        {/* Modal Tra cứu công nợ nhà cung cấp ($) */}
        {showDebtLookupModal && (
          <div className="misa-tax-modal-overlay" style={{ zIndex: 10000 }}>
            <div className="misa-tax-modal-window" style={{ maxWidth: 820 }}>
              <header className="misa-tax-modal-header">
                <div>
                  <h2 style={{ fontSize: 16 }}>Tra cứu công nợ nhà cung cấp</h2>
                  <small style={{ color: "#64748b" }}>
                    {partnerCode ? `${partnerCode} - ${partnerName}` : "Tất cả nhà cung cấp"}
                  </small>
                </div>
                <button
                  type="button"
                  className="misa-tax-icon-btn"
                  onClick={() => setShowDebtLookupModal(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="misa-tax-modal-body" style={{ padding: 16 }}>
                <table className="misa-voucher-table" style={{ border: "1px solid #e2e8f0" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th style={{ width: 110 }}>Số hóa đơn</th>
                      <th style={{ width: 100 }}>Ngày HĐ</th>
                      <th>Nội dung</th>
                      <th style={{ width: 120, textAlign: "right" }}>Số tiền phải trả</th>
                      <th style={{ width: 120, textAlign: "right" }}>Đã trả</th>
                      <th style={{ width: 120, textAlign: "right" }}>Còn phải trả</th>
                      <th style={{ width: 70, textAlign: "center" }}>Chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { no: "HĐ00291", date: "15/09/2026", desc: "Mua máy in và văn phòng phẩm", total: 18500000, paid: 5000000, remain: 13500000 },
                      { no: "HĐ00342", date: "22/09/2026", desc: "Giấy in A4 và mực in văn phòng", total: 9200000, paid: 0, remain: 9200000 },
                      { no: "HĐ00411", date: "28/09/2026", desc: "Bảo dưỡng máy photocopy định kỳ", total: 4500000, paid: 0, remain: 4500000 },
                    ].map((inv, idx) => (
                      <tr key={inv.no}>
                        <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                        <td><strong>{inv.no}</strong></td>
                        <td>{inv.date}</td>
                        <td>{inv.desc}</td>
                        <td style={{ textAlign: "right" }}>{formatVND(inv.total)}</td>
                        <td style={{ textAlign: "right", color: "#00b06b" }}>{formatVND(inv.paid)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{formatVND(inv.remain)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            style={{
                              background: "#00b06b",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 4,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              handleUpdateRow(rows[0].id, "amount", inv.remain);
                              handleUpdateRow(rows[0].id, "description", `Thanh toán ${inv.no} - ${inv.desc}`);
                              setShowDebtLookupModal(false);
                            }}
                          >
                            Trả nợ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="misa-voucher-footer" style={{ borderTop: "1px solid #e2e8f0" }}>
                <div />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="misa-voucher-btn-white"
                    onClick={() => setShowDebtLookupModal(false)}
                  >
                    Đóng
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}

        {/* Modal Tham chiếu chứng từ */}
        {showRefModal && (
          <div className="misa-tax-modal-overlay" style={{ zIndex: 10000 }}>
            <div className="misa-tax-modal-window" style={{ maxWidth: 780 }}>
              <header className="misa-tax-modal-header">
                <div>
                  <h2 style={{ fontSize: 16 }}>Chọn chứng từ tham chiếu</h2>
                  <small style={{ color: "#64748b" }}>
                    Liên kết hóa đơn, đơn mua hàng, khế ước vay hoặc giấy tạm ứng vào chứng từ này
                  </small>
                </div>
                <button
                  type="button"
                  className="misa-tax-icon-btn"
                  onClick={() => setShowRefModal(false)}
                >
                  <X size={18} />
                </button>
              </header>

              <div className="misa-tax-modal-body" style={{ padding: 16 }}>
                <table className="misa-voucher-table" style={{ border: "1px solid #e2e8f0" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th style={{ width: 110 }}>Loại chứng từ</th>
                      <th style={{ width: 110 }}>Số chứng từ</th>
                      <th style={{ width: 100 }}>Ngày lập</th>
                      <th>Diễn giải</th>
                      <th style={{ width: 120, textAlign: "right" }}>Giá trị</th>
                      <th style={{ width: 80, textAlign: "center" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { type: "Đơn mua hàng", code: "PO-2026-089", date: "20/09/2026", desc: "Hợp đồng cung cấp thiết bị văn phòng", val: 32000000 },
                      { type: "Giấy tạm ứng", code: "TU-0021", date: "25/09/2026", desc: "Đề nghị tạm ứng công tác phí quý 4", val: 15000000 },
                      { type: "Khế ước vay", code: "KUV-VCB-04", date: "10/08/2026", desc: "Hạn mức vay vốn lưu động đợt 4/2026", val: 500000000 },
                    ].map((item, idx) => (
                      <tr key={item.code}>
                        <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                        <td>{item.type}</td>
                        <td><strong>{item.code}</strong></td>
                        <td>{item.date}</td>
                        <td>{item.desc}</td>
                        <td style={{ textAlign: "right" }}>{formatVND(item.val)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            style={{
                              background: "#00b06b",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: 4,
                              padding: "4px 8px",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              alert(`Đã tham chiếu tới chứng từ: ${item.code} (${item.type})`);
                              setShowRefModal(false);
                            }}
                          >
                            Chọn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="misa-voucher-footer" style={{ borderTop: "1px solid #e2e8f0" }}>
                <div />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="misa-voucher-btn-white"
                    onClick={() => setShowRefModal(false)}
                  >
                    Đóng
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ----------------------------------------------------------------------
// 4. MODAL "THÊM BẰNG AI" (AVA KẾ TOÁN)
// ----------------------------------------------------------------------
export function AIAssistantModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (data: any) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const samplePrompts = [
    "Thu hoàn ứng sau khi quyết toán tạm ứng cho Hoàng Thiên Bảo số tiền 5 triệu",
    "Chi tiền nộp thuế GTGT tháng 8 số tiền 64.107.650 đồng",
    "Thu tiền bán hàng trực tiếp của Công ty Phúc Long 15.400.000 đồng",
    "Chi tiếp khách và mua quà tặng đối tác 3.250.000 đồng",
  ];

  const handleRun = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onApply({
        code: "PT00005",
        partner: "Hoàng Thiên Bảo",
        description: prompt || "Thu hoàn ứng sau khi quyết toán tạm ứng cho Hoàng Thiên Bảo",
        amount: 5000000,
        debit: "1111",
        credit: "141",
      });
    }, 800);
  };

  return (
    <div className="misa-tax-modal-overlay">
      <div className="misa-tax-modal-window" style={{ maxWidth: 620 }}>
        <header
          className="misa-tax-modal-header"
          style={{
            background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="misa-ava-avatar">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: 16 }}>AVA Kế toán — Thêm chứng từ bằng AI</h2>
              <small style={{ color: "#6b7280" }}>
                Nhập câu lệnh tự nhiên, quét hóa đơn hoặc dán nội dung tin nhắn
              </small>
            </div>
          </div>
          <button className="misa-tax-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="misa-tax-modal-body">
          <div className="misa-tax-form-group">
            <label>Nội dung nghiệp vụ cần tạo</label>
            <textarea
              style={{
                width: "100%",
                height: 100,
                padding: 10,
                borderRadius: 6,
                border: "1px solid #d1d5db",
                fontSize: 13,
                fontFamily: "inherit",
              }}
              placeholder="Ví dụ: Thu tiền hoàn ứng cho Hoàng Thiên Bảo 5.000.000đ sau chuyến công tác..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div>
            <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
              Gợi ý nhanh từ mẫu MISA:
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(p)}
                  style={{
                    textAlign: "left",
                    padding: "6px 10px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  ✨ {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="misa-tax-modal-footer">
          <div />
          <div className="misa-tax-footer-actions">
            <button className="misa-btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              className="misa-ai-add-btn"
              onClick={handleRun}
              disabled={isProcessing}
            >
              {isProcessing ? "Đang xử lý..." : "Trích xuất & Tạo chứng từ"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 4.5. BÁO CÁO TIỀN MẶT CHUẨN MISA AMIS (CASH REPORTS HUB & VIEWER)
// ----------------------------------------------------------------------
export interface CashReportItem {
  id: string;
  code: string;
  name: string;
  circular: string;
  category: "ledger" | "cashflow" | "advance" | "inventory";
  categoryLabel: string;
  description: string;
  isFavorite: boolean;
}

export const MISA_CASH_REPORTS: CashReportItem[] = [
  {
    id: "s07a",
    code: "S07a-DN",
    name: "S07a-DN: Sổ kế toán chi tiết quỹ tiền mặt",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "ledger",
    categoryLabel: "Sổ sách tiền mặt",
    description: "Phản ánh chi tiết tình hình thu, chi và tồn quỹ theo từng ngày trong tháng, theo chứng từ phát sinh và tài khoản đối ứng (thay thế mẫu S08a-DN của TT200).",
    isFavorite: true,
  },
  {
    id: "th_tc_t",
    code: "TH-TC-T",
    name: "Báo cáo tổng hợp tình hình thu, chi, tồn quỹ tiền mặt theo tháng (12 tháng)",
    circular: "Mẫu quản trị MISA AMIS (Theo TT 99/2025/TT-BTC)",
    category: "cashflow",
    categoryLabel: "Thống kê cả tháng",
    description: "Bảng tổng hợp và biểu đồ dòng tiền thu - chi - tồn quỹ so sánh 12 tháng trong năm tài chính 2026, giúp kế toán trưởng và ban giám đốc đánh giá thanh khoản cả năm.",
    isFavorite: true,
  },
  {
    id: "s07",
    code: "S07-DN",
    name: "S07-DN: Sổ quỹ tiền mặt",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "ledger",
    categoryLabel: "Sổ sách tiền mặt",
    description: "Dành cho Thủ quỹ ghi chép các nghiệp vụ thu, chi tiền mặt thực tế hàng ngày theo trình tự thời gian.",
    isFavorite: true,
  },
  {
    id: "bksd",
    code: "BK-SDT",
    name: "Bảng kê số dư tiền mặt theo ngày trong tháng",
    circular: "Mẫu biểu quản trị MISA",
    category: "ledger",
    categoryLabel: "Sổ sách tiền mặt",
    description: "Theo dõi biến động số dư tồn quỹ tiền mặt từng ngày trong tháng, đối chiếu với định mức tồn quỹ an toàn.",
    isFavorite: true,
  },
  {
    id: "s03a1",
    code: "S03a1-DN",
    name: "S03a1-DN: Sổ nhật ký thu tiền",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "ledger",
    categoryLabel: "Sổ sách tiền mặt",
    description: "Theo dõi tuần tự thời gian tất cả các nghiệp vụ thu tiền mặt phát sinh trong tháng theo chứng từ thu.",
    isFavorite: false,
  },
  {
    id: "s03a2",
    code: "S03a2-DN",
    name: "S03a2-DN: Sổ nhật ký chi tiền",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "ledger",
    categoryLabel: "Sổ sách tiền mặt",
    description: "Theo dõi tuần tự thời gian tất cả các nghiệp vụ chi tiền mặt phát sinh trong tháng theo chứng từ chi.",
    isFavorite: false,
  },
  {
    id: "cashflow",
    code: "B03-DN",
    name: "B03-DN: Báo cáo lưu chuyển tiền tệ tiền mặt (Phương pháp trực tiếp)",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "cashflow",
    categoryLabel: "Dòng tiền & Quản trị",
    description: "Phân tích các luồng tiền thu - chi theo 3 hoạt động: Hoạt động kinh doanh, Hoạt động đầu tư và Hoạt động tài chính theo quy định TT 99/2025/TT-BTC.",
    isFavorite: true,
  },
  {
    id: "advance141",
    code: "TH-TU-141",
    name: "Bảng tổng hợp tình hình tạm ứng theo nhân viên (TK 141)",
    circular: "Thông tư 99/2025/TT-BTC",
    category: "advance",
    categoryLabel: "Tạm ứng & Công nợ",
    description: "Tổng hợp số dư tạm ứng đầu kỳ, số đã tạm ứng trong tháng, số đã thanh toán quyết toán và số còn phải thu hoàn ứng của từng nhân viên.",
    isFavorite: false,
  },
  {
    id: "inventory",
    code: "BB-KK-01",
    name: "Biên bản kiểm kê quỹ tiền mặt & Bảng xử lý thừa thiếu",
    circular: "Mẫu số 01-VT / TT 99",
    category: "inventory",
    categoryLabel: "Kiểm kê quỹ",
    description: "Ghi nhận kết quả kiểm kê thực tế các loại tiền mặt tại két, đối chiếu số dư sổ sách và lập phương án xử lý chênh lệch.",
    isFavorite: false,
  },
];

// Dữ liệu dòng tiền thống kê cả 12 tháng năm 2026 (Chuẩn MISA AMIS)
export const MONTHLY_CASH_STATS_2026 = [
  { month: "Tháng 01/2026", mShort: "T1", opening: 32000000, inAmount: 58000000, outAmount: 51200000, diff: 6800000, closing: 38800000 },
  { month: "Tháng 02/2026", mShort: "T2", opening: 38800000, inAmount: 62500000, outAmount: 55000000, diff: 7500000, closing: 46300000 },
  { month: "Tháng 03/2026", mShort: "T3", opening: 46300000, inAmount: 71000000, outAmount: 68400000, diff: 2600000, closing: 48900000 },
  { month: "Tháng 04/2026", mShort: "T4", opening: 48900000, inAmount: 64200000, outAmount: 61000000, diff: 3200000, closing: 52100000 },
  { month: "Tháng 05/2026", mShort: "T5", opening: 52100000, inAmount: 83000000, outAmount: 74500000, diff: 8500000, closing: 60600000 },
  { month: "Tháng 06/2026", mShort: "T6", opening: 60600000, inAmount: 69000000, outAmount: 72000000, diff: -3000000, closing: 57600000 },
  { month: "Tháng 07/2026", mShort: "T7", opening: 57600000, inAmount: 76500000, outAmount: 69800000, diff: 6700000, closing: 64300000 },
  { month: "Tháng 08/2026", mShort: "T8", opening: 64300000, inAmount: 55900000, outAmount: 75000000, diff: -19100000, closing: 45200000 },
  { month: "Tháng 09/2026", mShort: "T9", opening: 45200000, inAmount: 70000000, outAmount: 18400000, diff: 51600000, closing: 96800000, isCurrent: true },
  { month: "Tháng 10/2026", mShort: "T10", opening: 96800000, inAmount: 68000000, outAmount: 62000000, diff: 6000000, closing: 102800000, isPlan: true },
  { month: "Tháng 11/2026", mShort: "T11", opening: 102800000, inAmount: 75000000, outAmount: 69000000, diff: 6000000, closing: 108800000, isPlan: true },
  { month: "Tháng 12/2026", mShort: "T12", opening: 108800000, inAmount: 92000000, outAmount: 85000000, diff: 7000000, closing: 115800000, isPlan: true },
];

export function CashReportsTab({ notify }: { notify: (msg: string) => void }) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(["s07a", "th_tc_t", "s07", "bksd", "cashflow"]),
  );
  const [activeReport, setActiveReport] = useState<CashReportItem | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("Tháng 09/2026");
  const [viewMode, setViewMode] = useState<"detail" | "monthly_summary">("detail");

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        notify("Đã bỏ ghim báo cáo khỏi mục yêu thích.");
      } else {
        next.add(id);
        notify("Đã thêm báo cáo vào danh mục yêu thích ⭐.");
      }
      return next;
    });
  };

  const filteredReports = useMemo(() => {
    return MISA_CASH_REPORTS.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (filterCategory === "favorite") return favorites.has(r.id);
      if (filterCategory === "ledger") return r.category === "ledger";
      if (filterCategory === "cashflow") return r.category === "cashflow" || r.category === "advance";
      return true;
    });
  }, [search, filterCategory, favorites]);

  const openReport = (rep: CashReportItem) => {
    setActiveReport(rep);
    if (rep.id === "th_tc_t") {
      setViewMode("monthly_summary");
    } else {
      setViewMode("detail");
    }
  };

  // If a report is selected, show the MISA Paper Report Viewer!
  if (activeReport) {
    return (
      <div className="misa-report-viewer-container">
        {/* Viewer Toolbar */}
        <header className="misa-report-viewer-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              className="misa-tax-icon-btn"
              onClick={() => setActiveReport(null)}
              title="Quay lại danh sách báo cáo"
              style={{ display: "flex", alignItems: "center", gap: 6, width: "auto", padding: "0 10px" }}
            >
              <ArrowLeft size={16} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Danh sách báo cáo</span>
            </button>

            <div style={{ height: 20, width: 1, background: "#cbd5e1" }} />

            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
              {activeReport.name}
            </span>

            {/* Chế độ xem: Sổ chi tiết cả tháng vs Bảng thống kê 12 tháng */}
            <div className="misa-report-mode-toggle" style={{ marginLeft: 8 }}>
              <button
                type="button"
                className={`misa-report-mode-btn ${viewMode === "detail" ? "active" : ""}`}
                onClick={() => setViewMode("detail")}
              >
                📑 Sổ chi tiết ({selectedMonth.replace("Tháng ", "T")})
              </button>
              <button
                type="button"
                className={`misa-report-mode-btn ${viewMode === "monthly_summary" ? "active" : ""}`}
                onClick={() => setViewMode("monthly_summary")}
              >
                📊 Thống kê 12 tháng (Năm 2026)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Kỳ chọn tháng chuẩn MISA */}
            <div className="misa-period-select-box">
              <Calendar size={14} style={{ color: "#107e3e" }} />
              <span>Kỳ:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  notify(`Đã cập nhật kỳ báo cáo: ${e.target.value}`);
                }}
              >
                <option value="Tháng 09/2026">Tháng 09/2026 (Kỳ hiện tại)</option>
                <option value="Tháng 08/2026">Tháng 08/2026</option>
                <option value="Tháng 07/2026">Tháng 07/2026</option>
                <option value="Tháng 06/2026">Tháng 06/2026</option>
                <option value="Tháng 05/2026">Tháng 05/2026</option>
                <option value="Tháng 04/2026">Tháng 04/2026</option>
                <option value="Tháng 03/2026">Tháng 03/2026</option>
                <option value="Tháng 02/2026">Tháng 02/2026</option>
                <option value="Tháng 01/2026">Tháng 01/2026</option>
                <option value="Tháng 10/2026">Tháng 10/2026 (Kế hoạch)</option>
                <option value="Tháng 11/2026">Tháng 11/2026 (Kế hoạch)</option>
                <option value="Tháng 12/2026">Tháng 12/2026 (Kế hoạch)</option>
              </select>
            </div>

            <button
              className="misa-btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, fontSize: 12.5 }}
              onClick={() => notify("Đang kết xuất tệp Excel báo cáo chuẩn Thông tư 99/2025/TT-BTC...")}
            >
              <FileSpreadsheet size={15} style={{ color: "#107e3e" }} />
              <span>Xuất khẩu Excel</span>
            </button>

            <button
              className="misa-btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, fontSize: 12.5 }}
              onClick={() => window.print()}
            >
              <Printer size={15} style={{ color: "#0284c7" }} />
              <span>In (Ctrl+P)</span>
            </button>

            <button
              className="misa-btn-primary"
              style={{ height: 32, fontSize: 12.5 }}
              onClick={() => notify(`Thiết lập tham số: ${selectedMonth}, Tài khoản 1111, Mẫu Thông tư 99/2025/TT-BTC`)}
            >
              Chọn tham số
            </button>
          </div>
        </header>

        {/* Paper Sheet Content */}
        <div className="misa-report-viewer-content">
          <div className="misa-report-paper">
            {/* Header info */}
            <div className="misa-report-paper-header">
              <div className="misa-report-company-info">
                <strong>CÔNG TY CỔ PHẦN CÔNG NGHỆ MINH AN</strong>
                <div>Địa chỉ: Tầng 4, Tòa nhà MISA, Cầu Giấy, Hà Nội</div>
                <div>Mã số thuế: <strong>0108923456</strong></div>
              </div>

              <div className="misa-report-template-code">
                <strong>{viewMode === "monthly_summary" ? "TH-TC-T" : (activeReport.code === "S08a-DN" ? "S07a-DN" : activeReport.code)}</strong>
                <div>(Ban hành theo Thông tư số 99/2025/TT-BTC ngày 27/10/2025 của Bộ Tài chính)</div>
              </div>
            </div>

            {/* =======================================================
                VIEW MODE 1: SỔ KẾ TOÁN CHI TIẾT CẢ THÁNG (MẪU S07a-DN)
                ======================================================= */}
            {viewMode === "detail" && (
              <>
                <div className="misa-report-paper-title">
                  <h1>SỔ KẾ TOÁN CHI TIẾT QUỸ TIỀN MẶT</h1>
                  <p>Tài khoản: <strong>1111 - Tiền Việt Nam</strong></p>
                  <p style={{ fontStyle: "italic", fontSize: 12.5, color: "#64748b" }}>
                    Kỳ báo cáo: Cả {selectedMonth} (Từ ngày 01/09/2026 đến ngày 30/09/2026)
                  </p>
                </div>

                {/* Data Table */}
                <table className="misa-report-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>STT</th>
                      <th style={{ width: 85 }}>Ngày HT</th>
                      <th style={{ width: 85 }}>Ngày CT</th>
                      <th style={{ width: 90 }}>Số chứng từ</th>
                      <th>Diễn giải nghiệp vụ</th>
                      <th style={{ width: 75 }}>TK đối ứng</th>
                      <th style={{ width: 120, textAlign: "right" }}>Số tiền Thu</th>
                      <th style={{ width: 120, textAlign: "right" }}>Số tiền Chi</th>
                      <th style={{ width: 130, textAlign: "right" }}>Số dư Tồn quỹ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Dòng Số dư đầu tháng */}
                    <tr style={{ background: "#f8fafc", fontWeight: 600 }}>
                      <td colSpan={6} style={{ textAlign: "left", paddingLeft: 14 }}>
                        <strong>Số dư đầu tháng 09/2026 (01/09/2026):</strong>
                      </td>
                      <td className="numeric">-</td>
                      <td className="numeric">-</td>
                      <td className="numeric" style={{ textAlign: "right", color: "#107e3e", fontWeight: 700 }}>
                        45.200.000
                      </td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>1</td>
                      <td style={{ textAlign: "center" }}>03/09/2026</td>
                      <td style={{ textAlign: "center" }}>03/09/2026</td>
                      <td style={{ textAlign: "center", color: "#0284c7", fontWeight: 600 }}>PT00001</td>
                      <td>Thu tiền bán hàng trực tiếp tại quầy thu ngân</td>
                      <td style={{ textAlign: "center" }}>5111</td>
                      <td style={{ textAlign: "right" }}>15.000.000</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>60.200.000</td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>2</td>
                      <td style={{ textAlign: "center" }}>03/09/2026</td>
                      <td style={{ textAlign: "center" }}>03/09/2026</td>
                      <td style={{ textAlign: "center", color: "#0284c7", fontWeight: 600 }}>PT00005</td>
                      <td>Thu hoàn ứng sau khi quyết toán tạm ứng cho Hoàng Thiên Bảo</td>
                      <td style={{ textAlign: "center" }}>141</td>
                      <td style={{ textAlign: "right" }}>5.000.000</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>65.200.000</td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>3</td>
                      <td style={{ textAlign: "center" }}>05/09/2026</td>
                      <td style={{ textAlign: "center" }}>05/09/2026</td>
                      <td style={{ textAlign: "center", color: "#ea580c", fontWeight: 600 }}>PC00001</td>
                      <td>Chi thanh toán tiền tiếp khách hội nghị khách hàng</td>
                      <td style={{ textAlign: "center" }}>6427</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right" }}>3.500.000</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>61.700.000</td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>4</td>
                      <td style={{ textAlign: "center" }}>08/09/2026</td>
                      <td style={{ textAlign: "center" }}>08/09/2026</td>
                      <td style={{ textAlign: "center", color: "#ea580c", fontWeight: 600 }}>PC00006</td>
                      <td>Chi thanh toán tiền mua văn phòng phẩm và vật tư văn phòng</td>
                      <td style={{ textAlign: "center" }}>6422</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right" }}>1.850.000</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>59.850.000</td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>5</td>
                      <td style={{ textAlign: "center" }}>15/09/2026</td>
                      <td style={{ textAlign: "center" }}>15/09/2026</td>
                      <td style={{ textAlign: "center", color: "#0284c7", fontWeight: 600 }}>PT00008</td>
                      <td>Rút tiền gửi ngân hàng Vietcombank 1023847592 về nhập quỹ</td>
                      <td style={{ textAlign: "center" }}>1121</td>
                      <td style={{ textAlign: "right" }}>50.000.000</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>109.850.000</td>
                    </tr>

                    <tr>
                      <td style={{ textAlign: "center" }}>6</td>
                      <td style={{ textAlign: "center" }}>20/09/2026</td>
                      <td style={{ textAlign: "center" }}>20/09/2026</td>
                      <td style={{ textAlign: "center", color: "#ea580c", fontWeight: 600 }}>PC00012</td>
                      <td>Tạm ứng công tác phí thị trường Hải Phòng cho Hoàng Thiên Bảo</td>
                      <td style={{ textAlign: "center" }}>141</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right" }}>13.050.000</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>96.800.000</td>
                    </tr>

                    {/* Tổng phát sinh cả tháng */}
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={6} style={{ textAlign: "right", paddingRight: 14 }}>
                        <strong>Cộng số phát sinh cả {selectedMonth}:</strong>
                      </td>
                      <td style={{ textAlign: "right", color: "#107e3e" }}>70.000.000</td>
                      <td style={{ textAlign: "right", color: "#ea580c" }}>18.400.000</td>
                      <td style={{ textAlign: "right" }}>-</td>
                    </tr>

                    {/* Số dư cuối tháng */}
                    <tr style={{ background: "#ecfdf5", fontWeight: 800, fontSize: 13 }}>
                      <td colSpan={6} style={{ textAlign: "left", paddingLeft: 14, color: "#065f46" }}>
                        <strong>Số dư cuối {selectedMonth} (30/09/2026):</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right" }}>-</td>
                      <td style={{ textAlign: "right", color: "#107e3e", fontSize: 14 }}>
                        96.800.000
                      </td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* =======================================================
                VIEW MODE 2: BÁO CÁO TỔNG HỢP THU CHI TỒN 12 THÁNG
                ======================================================= */}
            {viewMode === "monthly_summary" && (
              <>
                <div className="misa-report-paper-title">
                  <h1>BÁO CÁO TỔNG HỢP TÌNH HÌNH THU, CHI, TỒN QUỸ TIỀN MẶT THEO THÁNG</h1>
                  <p>Tài khoản: <strong>1111 - Tiền Việt Nam</strong></p>
                  <p style={{ fontStyle: "italic", fontSize: 12.5, color: "#64748b" }}>
                    Năm tài chính 2026 (Từ ngày 01/01/2026 đến ngày 31/12/2026) — Đơn vị tính: VNĐ
                  </p>
                </div>

                {/* 4 Thẻ chỉ số tổng hợp cả năm */}
                <div className="misa-monthly-summary-kpis">
                  <div className="misa-monthly-kpi-card">
                    <span>Số dư đầu năm (01/01/2026)</span>
                    <strong>32.000.000 đ</strong>
                    <small>Chuyển từ năm 2025 sang</small>
                  </div>
                  <div className="misa-monthly-kpi-card">
                    <span>Tổng thu lũy kế (T1 - T9)</span>
                    <strong style={{ color: "#107e3e" }}>586.500.000 đ</strong>
                    <small>Bán lẻ + rút NH + thu hồi nợ</small>
                  </div>
                  <div className="misa-monthly-kpi-card">
                    <span>Tổng chi lũy kế (T1 - T9)</span>
                    <strong style={{ color: "#ea580c" }}>521.700.000 đ</strong>
                    <small>Chi phí + tạm ứng + nộp thuế</small>
                  </div>
                  <div className="misa-monthly-kpi-card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0" }}>
                    <span>Số dư tồn quỹ hiện tại (Tháng 9)</span>
                    <strong style={{ color: "#065f46" }}>96.800.000 đ</strong>
                    <small style={{ color: "#059669" }}>Khớp 100% két và biên bản</small>
                  </div>
                </div>

                {/* Biểu đồ trực quan so sánh 12 tháng */}
                <div className="misa-monthly-chart-box">
                  <div className="misa-monthly-chart-header">
                    <h4>Biểu đồ so sánh Dòng tiền Thu - Chi từng tháng trong năm 2026</h4>
                    <div className="misa-monthly-chart-legend">
                      <div className="misa-monthly-legend-item">
                        <span className="misa-legend-color" style={{ background: "#107e3e" }} />
                        <span>Tiền thu vào (VNĐ)</span>
                      </div>
                      <div className="misa-monthly-legend-item">
                        <span className="misa-legend-color" style={{ background: "#ef4444" }} />
                        <span>Tiền chi ra (VNĐ)</span>
                      </div>
                    </div>
                  </div>

                  <div className="misa-monthly-bars">
                    {MONTHLY_CASH_STATS_2026.map((st) => {
                      const maxVal = 100000000;
                      const inPercent = Math.min(100, Math.round((st.inAmount / maxVal) * 100));
                      const outPercent = Math.min(100, Math.round((st.outAmount / maxVal) * 100));
                      const isSelected = st.month === selectedMonth;

                      return (
                        <div
                          key={st.mShort}
                          className={`misa-monthly-bar-group ${isSelected || st.isCurrent ? "current" : ""}`}
                          title={`${st.month}: Thu ${formatVND(st.inAmount)}đ | Chi ${formatVND(st.outAmount)}đ | Tồn cuối ${formatVND(st.closing)}đ (Nhấn để xem sổ chi tiết)`}
                          onClick={() => {
                            setSelectedMonth(st.month);
                            setViewMode("detail");
                            notify(`Đã chuyển sang xem sổ chi tiết của ${st.month}`);
                          }}
                        >
                          <div className="misa-monthly-bar-pair">
                            <div className="misa-bar-in" style={{ height: `${inPercent}%` }} />
                            <div className="misa-bar-out" style={{ height: `${outPercent}%` }} />
                          </div>
                          <span className="misa-monthly-bar-label">
                            {st.mShort}
                            {isSelected ? " 📍" : st.isCurrent ? " ⭐" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ textAlign: "right", marginTop: 8, fontSize: 11.5, color: "#64748b" }}>
                    * Nhấn vào cột tháng bất kỳ trên biểu đồ để xem chi tiết từng chứng từ thu - chi của tháng đó.
                  </div>
                </div>

                {/* Bảng số liệu thống kê 12 tháng */}
                <table className="misa-report-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 45, textAlign: "center" }}>STT</th>
                      <th style={{ width: 110 }}>Kỳ kế toán</th>
                      <th style={{ width: 130, textAlign: "right" }}>Số dư đầu tháng</th>
                      <th style={{ width: 130, textAlign: "right" }}>Thu trong tháng</th>
                      <th style={{ width: 130, textAlign: "right" }}>Chi trong tháng</th>
                      <th style={{ width: 130, textAlign: "right" }}>Chênh lệch (Thu - Chi)</th>
                      <th style={{ width: 130, textAlign: "right" }}>Số dư cuối tháng</th>
                      <th style={{ width: 90, textAlign: "center" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHLY_CASH_STATS_2026.map((row, idx) => {
                      const isSelected = row.month === selectedMonth;
                      return (
                        <tr
                          key={row.mShort}
                          style={{
                            background: isSelected ? "#f0fdf4" : (row.isCurrent ? "#f8fafc" : undefined),
                            fontWeight: isSelected || row.isCurrent ? 600 : 400,
                          }}
                        >
                          <td style={{ textAlign: "center" }}>{idx + 1}</td>
                          <td>
                            <strong>{row.month}</strong>
                            {row.isCurrent && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "#15803d", background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>
                                Hiện tại
                              </span>
                            )}
                            {row.isPlan && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>
                                Kế hoạch
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>{formatVND(row.opening)}</td>
                          <td style={{ textAlign: "right", color: "#107e3e" }}>{formatVND(row.inAmount)}</td>
                          <td style={{ textAlign: "right", color: "#ea580c" }}>{formatVND(row.outAmount)}</td>
                          <td style={{ textAlign: "right", color: row.diff >= 0 ? "#107e3e" : "#dc2626" }}>
                            {row.diff >= 0 ? `+${formatVND(row.diff)}` : `(${formatVND(Math.abs(row.diff))})`}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>{formatVND(row.closing)}</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="misa-drilldown-btn"
                              onClick={() => {
                                setSelectedMonth(row.month);
                                setViewMode("detail");
                                notify(`Mở sổ chi tiết ${row.month}`);
                              }}
                            >
                              <span>Chi tiết</span>
                              <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Tổng cộng lũy kế cả năm 2026 */}
                    <tr style={{ background: "#ecfdf5", fontWeight: 800, fontSize: 13 }}>
                      <td colSpan={2} style={{ textAlign: "left", paddingLeft: 14, color: "#065f46" }}>
                        <strong>TỔNG CỘNG LŨY KẾ CẢ NĂM 2026:</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>32.000.000</td>
                      <td style={{ textAlign: "right", color: "#107e3e" }}>821.500.000</td>
                      <td style={{ textAlign: "right", color: "#ea580c" }}>737.700.000</td>
                      <td style={{ textAlign: "right", color: "#107e3e" }}>+83.800.000</td>
                      <td style={{ textAlign: "right", color: "#065f46", fontSize: 14 }}>115.800.000</td>
                      <td style={{ textAlign: "center" }}>-</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {/* Signatures block theo Thông tư 99/2025/TT-BTC */}
            <div className="misa-report-signatures">
              <div className="misa-report-sign-col">
                <strong>Người lập biểu</strong>
                <small>(Ký, họ tên)</small>
                <div className="misa-report-sign-name">Nguyễn Văn Kế Toán</div>
              </div>

              <div className="misa-report-sign-col">
                <strong>Thủ quỹ</strong>
                <small>(Ký, họ tên)</small>
                <div className="misa-report-sign-name">Vũ Thị Mai</div>
              </div>

              <div className="misa-report-sign-col">
                <strong>Kế toán trưởng</strong>
                <small>(Ký, họ tên)</small>
                <div className="misa-report-sign-name">Trương Thị B</div>
              </div>

              <div className="misa-report-sign-col">
                <strong>Giám đốc</strong>
                <small>(Ký, họ tên, đóng dấu)</small>
                <div className="misa-report-sign-name">Nguyễn Văn A</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reports Hub Grid View
  return (
    <div className="misa-cash-reports-wrapper">
      {/* Header */}
      <header className="misa-cash-reports-header">
        <div className="misa-cash-reports-title">
          <h2>
            <BookOpen size={20} style={{ color: "#107e3e" }} />
            <span>Báo cáo Tiền mặt</span>
          </h2>
          <p>
            Hệ thống sổ kế toán, sổ quỹ và báo cáo dòng tiền theo <strong>Thông tư 99/2025/TT-BTC</strong> & Chuẩn quản trị MISA AMIS
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexShrink: 0, alignItems: "center" }}>
          <button
            className="misa-btn-secondary"
            style={{ height: 34, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => openReport(MISA_CASH_REPORTS[0])}
          >
            <Printer size={15} style={{ marginRight: 6 }} />
            In nhanh sổ chi tiết (S07a-DN)
          </button>
          <button
            className="misa-btn-primary"
            style={{ height: 34, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => openReport(MISA_CASH_REPORTS[1])}
          >
            <BarChart3 size={15} style={{ marginRight: 6 }} />
            Thống kê 12 tháng (Năm 2026)
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="misa-cash-reports-toolbar">
        <div className="misa-reports-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Tìm theo tên, mã hoặc nội dung báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="misa-reports-filter-chips">
          <button
            className={`misa-reports-chip ${filterCategory === "all" ? "active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            Tất cả ({MISA_CASH_REPORTS.length})
          </button>

          <button
            className={`misa-reports-chip ${filterCategory === "favorite" ? "active" : ""}`}
            onClick={() => setFilterCategory("favorite")}
          >
            ⭐ Yêu thích ({favorites.size})
          </button>

          <button
            className={`misa-reports-chip ${filterCategory === "ledger" ? "active" : ""}`}
            onClick={() => setFilterCategory("ledger")}
          >
            Sổ sách tiền mặt (5)
          </button>

          <button
            className={`misa-reports-chip ${filterCategory === "cashflow" ? "active" : ""}`}
            onClick={() => setFilterCategory("cashflow")}
          >
            Dòng tiền & Thống kê tháng (4)
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="misa-reports-grid">
        {filteredReports.map((rep) => {
          const isFav = favorites.has(rep.id);
          return (
            <div
              key={rep.id}
              className="misa-report-card"
              onClick={() => openReport(rep)}
            >
              <div>
                <div className="misa-report-card-top">
                  <div className="misa-report-icon-box">
                    {rep.category === "cashflow" ? (
                      <BarChart3 size={20} />
                    ) : (
                      <BookOpen size={20} />
                    )}
                  </div>

                  <div className="misa-report-info">
                    <div className="misa-report-title-row">
                      <span className="misa-report-title">{rep.name}</span>
                      <button
                        className={`misa-report-star ${isFav ? "starred" : ""}`}
                        title={isFav ? "Bỏ ghim yêu thích" : "Ghim báo cáo yêu thích"}
                        onClick={(e) => toggleFavorite(e, rep.id)}
                      >
                        <Star size={16} fill={isFav ? "#eab308" : "none"} />
                      </button>
                    </div>

                    <span className="misa-report-circular">{rep.circular}</span>
                    <p className="misa-report-desc">{rep.description}</p>
                  </div>
                </div>
              </div>

              <div className="misa-report-card-footer">
                <span className="misa-report-category-badge">{rep.categoryLabel}</span>
                <button
                  className="misa-report-view-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    openReport(rep);
                  }}
                >
                  <span>Xem báo cáo</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 4.6. DỰ BÁO DÒNG TIỀN CHUẨN MISA AMIS (CASH FLOW FORECAST WORKSPACE)
// ----------------------------------------------------------------------
export interface ForecastItem {
  id: string;
  date: string;
  kind: "in" | "out";
  category: string;
  partner: string;
  documentRef: string;
  amount: number;
  probability: number;
}

export const INITIAL_FORECAST_ITEMS: ForecastItem[] = [
  {
    id: "fc-01",
    date: "26/09/2026",
    kind: "in",
    category: "Thu bán lẻ tại quầy",
    partner: "Khách lẻ vãng lai",
    documentRef: "Hóa đơn bán lẻ quầy thu ngân",
    amount: 12000000,
    probability: 95,
  },
  {
    id: "fc-02",
    date: "28/09/2026",
    kind: "in",
    category: "Thu hồi nợ bán hàng quá hạn",
    partner: "Công ty Cổ phần Hoàng Gia",
    documentRef: "HĐBH-2026-00129",
    amount: 25000000,
    probability: 85,
  },
  {
    id: "fc-03",
    date: "30/09/2026",
    kind: "out",
    category: "Cước viễn thông & Internet",
    partner: "Tập đoàn VNPT Hà Nội",
    documentRef: "Hóa đơn GTGT tiền cước T8",
    amount: 3500000,
    probability: 100,
  },
  {
    id: "fc-04",
    date: "01/10/2026",
    kind: "in",
    category: "Dịch vụ bảo trì phần mềm",
    partner: "Công ty TNHH Ánh Dương",
    documentRef: "Hợp đồng dịch vụ 18/HD-DV",
    amount: 15000000,
    probability: 90,
  },
  {
    id: "fc-05",
    date: "05/10/2026",
    kind: "out",
    category: "Chi tạm ứng lương đợt 1",
    partner: "Cán bộ nhân viên công ty",
    documentRef: "Bảng thanh toán lương đợt 1/10",
    amount: 20000000,
    probability: 100,
  },
  {
    id: "fc-06",
    date: "08/10/2026",
    kind: "out",
    category: "Tiền điện nước & Dịch vụ tòa nhà",
    partner: "BQL Tòa nhà MISA Cầu Giấy",
    documentRef: "Thông báo cước định kỳ",
    amount: 4500000,
    probability: 100,
  },
  {
    id: "fc-07",
    date: "10/10/2026",
    kind: "in",
    category: "Thu tiền bán hàng đại lý",
    partner: "Công ty TNHH Phúc Long",
    documentRef: "HĐBH-2026-00142",
    amount: 18500000,
    probability: 85,
  },
  {
    id: "fc-08",
    date: "12/10/2026",
    kind: "out",
    category: "Trả tiền nhà cung cấp vật tư",
    partner: "Công ty TNHH Minh Phát",
    documentRef: "Hóa đơn mua hàng 00214",
    amount: 8200000,
    probability: 100,
  },
  {
    id: "fc-09",
    date: "15/10/2026",
    kind: "out",
    category: "Nộp tiền BHXH, BHYT, BHTN T9",
    partner: "Bảo hiểm xã hội quận Cầu Giấy",
    documentRef: "Thông báo nộp tiền BHXH tháng 9",
    amount: 11700000,
    probability: 100,
  },
  {
    id: "fc-10",
    date: "18/10/2026",
    kind: "in",
    category: "Thu hoàn ứng công tác phí",
    partner: "Lê Thị Mai (Phòng KD)",
    documentRef: "Giấy thanh toán tạm ứng",
    amount: 3000000,
    probability: 90,
  },
  {
    id: "fc-11",
    date: "20/10/2026",
    kind: "out",
    category: "Nộp tạm tính thuế GTGT và TNDN Q3",
    partner: "Chi cục Thuế quận Cầu Giấy",
    documentRef: "Tờ khai thuế quý 3/2026",
    amount: 15800000,
    probability: 100,
  },
  {
    id: "fc-12",
    date: "25/10/2026",
    kind: "in",
    category: "Thu tiền bán hàng dự án đợt 2",
    partner: "Công ty CP Đầu tư An Phát",
    documentRef: "Biên bản nghiệm thu bàn giao",
    amount: 15000000,
    probability: 80,
  },
];

export function CashForecastTab({ notify }: { notify: (msg: string) => void }) {
  const [period, setPeriod] = useState("30days");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out" | "sure">("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ForecastItem[]>(INITIAL_FORECAST_ITEMS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);

  // New item form state
  const [newItem, setNewItem] = useState({
    date: "2026-10-02",
    kind: "in" as "in" | "out",
    category: "Thu tiền bán hàng dự án",
    partner: "",
    documentRef: "",
    amount: 10000000,
    probability: 90,
  });

  const startingBalance = 96800000;
  const safetyThreshold = 25000000;

  // Running cumulative balance calculation
  const timelineData = useMemo(() => {
    let running = startingBalance;
    return items.map((it) => {
      if (it.kind === "in") {
        running += it.amount;
      } else {
        running -= it.amount;
      }
      return {
        ...it,
        balanceAfter: running,
        isSafe: running >= safetyThreshold,
      };
    });
  }, [items, startingBalance, safetyThreshold]);

  const totalIn = useMemo(
    () => items.filter((i) => i.kind === "in").reduce((s, i) => s + i.amount, 0),
    [items]
  );

  const totalOut = useMemo(
    () => items.filter((i) => i.kind === "out").reduce((s, i) => s + i.amount, 0),
    [items]
  );

  const netCashflow = totalIn - totalOut;
  const finalBalance = startingBalance + netCashflow;
  const minBalance = useMemo(
    () => Math.min(startingBalance, ...timelineData.map((d) => d.balanceAfter)),
    [timelineData, startingBalance]
  );

  const filteredItems = useMemo(() => {
    return timelineData.filter((i) => {
      const matchSearch =
        i.category.toLowerCase().includes(search.toLowerCase()) ||
        i.partner.toLowerCase().includes(search.toLowerCase()) ||
        i.documentRef.toLowerCase().includes(search.toLowerCase()) ||
        i.date.includes(search);

      if (!matchSearch) return false;

      if (typeFilter === "in") return i.kind === "in";
      if (typeFilter === "out") return i.kind === "out";
      if (typeFilter === "sure") return i.probability === 100;
      return true;
    });
  }, [timelineData, typeFilter, search]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.partner || !newItem.amount) {
      notify("Vui lòng nhập đầy đủ đối tác và số tiền!");
      return;
    }
    const dParts = newItem.date.split("-");
    const formattedDate = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
    const created: ForecastItem = {
      id: crypto.randomUUID(),
      date: formattedDate,
      kind: newItem.kind,
      category: newItem.category,
      partner: newItem.partner,
      documentRef: newItem.documentRef || "Kế hoạch bổ sung",
      amount: Number(newItem.amount),
      probability: Number(newItem.probability),
    };
    setItems((prev) => [...prev, created]);
    setShowAddModal(false);
    notify(
      `Đã bổ sung khoản dự kiến ${created.kind === "in" ? "Thu" : "Chi"} ${formatVND(created.amount)}đ vào kế hoạch dòng tiền!`
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    notify("Đã xóa khoản dự kiến khỏi kế hoạch dòng tiền.");
  };

  return (
    <div className="misa-forecast-wrapper">
      {/* 1. Header Toolbar */}
      <header className="misa-forecast-toolbar">
        <div className="misa-forecast-title-group">
          <h2>
            <TrendingUp size={20} style={{ color: "#107e3e" }} />
            <span>Dự báo dòng tiền (Cash Flow Forecast)</span>
            <span style={{ fontSize: 11, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 12 }}>
              Chuẩn MISA AMIS
            </span>
          </h2>
          <p>
            Phân tích tự động từ Hóa đơn bán hàng, Hóa đơn mua hàng, Lương, BHXH và Thuế để dự báo thanh khoản quỹ tiền mặt
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Period selector */}
          <div className="misa-period-select-box">
            <Calendar size={14} style={{ color: "#107e3e" }} />
            <span>Kỳ dự báo:</span>
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                notify(`Đã cập nhật kỳ dự báo dòng tiền: ${e.target.value}`);
              }}
            >
              <option value="30days">30 ngày tới (26/09/2026 - 25/10/2026)</option>
              <option value="60days">60 ngày tới (26/09/2026 - 24/11/2026)</option>
              <option value="nextMonth">Tháng tới (Tháng 10/2026)</option>
              <option value="q4">Quý 4/2026 (01/10/2026 - 31/12/2026)</option>
            </select>
          </div>

          <button
            type="button"
            className="misa-btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, fontSize: 12.5 }}
            onClick={() => setShowAdvisorModal(true)}
          >
            <Sparkles size={15} style={{ color: "#8b5cf6" }} />
            <span>AVA Phân tích</span>
          </button>

          <button
            type="button"
            className="misa-btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, fontSize: 12.5 }}
            onClick={() => notify("Đang xuất kế hoạch dòng tiền ra tệp Excel...")}
          >
            <FileSpreadsheet size={15} style={{ color: "#107e3e" }} />
            <span>Xuất khẩu Excel</span>
          </button>

          <button
            type="button"
            className="misa-btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, fontSize: 12.5 }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={15} />
            <span>Thêm khoản dự kiến</span>
          </button>
        </div>
      </header>

      {/* 2. KPI Cards */}
      <div className="misa-forecast-kpis">
        <div className="misa-forecast-kpi-card">
          <div className="misa-forecast-kpi-icon" style={{ background: "#f0fdf4", color: "#107e3e", border: "1px solid #bbf7d0" }}>
            <Coins size={22} />
          </div>
          <div className="misa-forecast-kpi-info">
            <span>Tiền mặt hiện có (25/09)</span>
            <strong>{formatVND(startingBalance)} đ</strong>
            <small>Sẵn sàng chi trả tức thì</small>
          </div>
        </div>

        <div className="misa-forecast-kpi-card">
          <div className="misa-forecast-kpi-icon" style={{ background: "#eff6ff", color: "#0284c7", border: "1px solid #bfdbfe" }}>
            <TrendingUp size={22} />
          </div>
          <div className="misa-forecast-kpi-info">
            <span>Dự kiến thu tiền (+)</span>
            <strong style={{ color: "#107e3e" }}>+{formatVND(totalIn)} đ</strong>
            <small>{items.filter((i) => i.kind === "in").length} khoản thu (HĐ bán lẻ + nợ KH)</small>
          </div>
        </div>

        <div className="misa-forecast-kpi-card">
          <div className="misa-forecast-kpi-icon" style={{ background: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3" }}>
            <TrendingDown size={22} />
          </div>
          <div className="misa-forecast-kpi-info">
            <span>Dự kiến chi tiền (-)</span>
            <strong style={{ color: "#ea580c" }}>-{formatVND(totalOut)} đ</strong>
            <small>{items.filter((i) => i.kind === "out").length} khoản chi (Lương + Thuế + BHXH)</small>
          </div>
        </div>

        <div className="misa-forecast-kpi-card" style={{ background: "#ecfdf5", borderColor: "#a7f3d0" }}>
          <div className="misa-forecast-kpi-icon" style={{ background: "#107e3e", color: "#ffffff" }}>
            <ShieldCheck size={22} />
          </div>
          <div className="misa-forecast-kpi-info">
            <span>Dự báo tồn quỹ cuối kỳ (25/10)</span>
            <strong style={{ color: "#065f46" }}>{formatVND(finalBalance)} đ</strong>
            <small style={{ color: "#059669", fontWeight: 600 }}>
              ✓ An toàn thanh khoản (Thấp nhất: {formatVND(minBalance)}đ)
            </small>
          </div>
        </div>
      </div>

      {/* 3. AVA Smart Advisor Banner */}
      <div className="misa-forecast-advisor">
        <div className="misa-forecast-advisor-icon">
          <Sparkles size={20} />
        </div>
        <div className="misa-forecast-advisor-body" style={{ flex: 1 }}>
          <h4>
            <span>Khuyến nghị thông minh từ Trợ lý MISA AVA:</span>
            <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4 }}>
              Độ tin cậy 96%
            </span>
          </h4>
          <p>
            Quỹ tiền mặt duy trì khả năng thanh khoản an toàn trong suốt 30 ngày tới. Điểm trũng tồn quỹ thấp nhất là <strong>{formatVND(minBalance)} đ</strong>, cao hơn định mức an toàn tối thiểu (25.000.000 đ). Các mốc chi tập trung lớn: Ngày <strong>05/10</strong> (chi tạm ứng lương 20.000.000 đ) và Ngày <strong>20/10</strong> (nộp thuế tạm tính quý 3: 15.800.000 đ). Đề xuất ưu tiên đôn đốc Công ty Hoàng Gia thu hồi nợ 25.000.000 đ đúng hạn ngày 28/09.
          </p>
        </div>
        <button
          type="button"
          className="misa-btn-secondary"
          style={{ height: 28, fontSize: 11.5, background: "#ffffff", borderColor: "#86efac", color: "#15803d" }}
          onClick={() => setShowAdvisorModal(true)}
        >
          Xem chi tiết phân tích
        </button>
      </div>

      {/* 4. Interactive Timeline & Bar Chart */}
      <div className="misa-forecast-chart-card">
        <div className="misa-forecast-chart-header">
          <div>
            <h3>Biểu đồ biến động dòng tiền và số dư quỹ tiền mặt dự báo (30 ngày tới)</h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Đơn vị: VNĐ — Tồn đầu kỳ: {formatVND(startingBalance)} đ | Định mức an toàn tối thiểu: {formatVND(safetyThreshold)} đ
            </span>
          </div>

          <div className="misa-monthly-chart-legend">
            <div className="misa-monthly-legend-item">
              <span className="misa-legend-color" style={{ background: "#107e3e" }} />
              <span>Tiền thu vào (+)</span>
            </div>
            <div className="misa-monthly-legend-item">
              <span className="misa-legend-color" style={{ background: "#ef4444" }} />
              <span>Tiền chi ra (-)</span>
            </div>
            <div className="misa-monthly-legend-item">
              <span className="misa-legend-color" style={{ background: "#0284c7" }} />
              <span>Số dư quỹ dự báo</span>
            </div>
          </div>
        </div>

        <div className="misa-forecast-timeline-bars">
          {/* Safety line */}
          <div
            className="misa-forecast-safety-line"
            style={{ bottom: `${Math.round((safetyThreshold / 160000000) * 100)}%` }}
          >
            <span className="misa-forecast-safety-label">
              Ngưỡng tồn quỹ an toàn: 25.000.000 đ
            </span>
          </div>

          {timelineData.map((d) => {
            const maxVal = 160000000;
            const inH = d.kind === "in" ? Math.min(100, Math.round((d.amount / maxVal) * 100)) : 0;
            const outH = d.kind === "out" ? Math.min(100, Math.round((d.amount / maxVal) * 100)) : 0;
            const balH = Math.min(100, Math.round((d.balanceAfter / maxVal) * 100));

            return (
              <div
                key={d.id}
                className="misa-forecast-col-group"
                title={`${d.date} — ${d.category}\n${d.kind === "in" ? "Thu: +" : "Chi: -"}${formatVND(d.amount)}đ\nSố dư quỹ sau phát sinh: ${formatVND(d.balanceAfter)}đ\nKhả năng xảy ra: ${d.probability}%`}
              >
                <div className="misa-forecast-col-bars">
                  {d.kind === "in" && <div className="misa-fbar-in" style={{ height: `${Math.max(14, inH * 2.8)}px` }} />}
                  {d.kind === "out" && <div className="misa-fbar-out" style={{ height: `${Math.max(14, outH * 2.8)}px` }} />}
                  <div className="misa-fbar-balance" style={{ height: `${Math.max(20, balH * 1.1)}px` }} />
                </div>
                <span className="misa-forecast-col-date">{d.date.slice(0, 5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Detailed Schedule Table */}
      <div className="misa-forecast-table-card">
        <div className="misa-forecast-table-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              Bảng kế hoạch thu - chi tiền mặt chi tiết ({filteredItems.length} khoản)
            </h3>

            <div className="misa-reports-search-box" style={{ width: 230, height: 30 }}>
              <Search size={14} />
              <input
                type="text"
                placeholder="Tìm khoản thu, chi, đối tác..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 12.5 }}
              />
            </div>
          </div>

          <div className="misa-reports-filter-chips">
            <button
              className={`misa-reports-chip ${typeFilter === "all" ? "active" : ""}`}
              onClick={() => setTypeFilter("all")}
            >
              Tất cả ({timelineData.length})
            </button>
            <button
              className={`misa-reports-chip ${typeFilter === "in" ? "active" : ""}`}
              onClick={() => setTypeFilter("in")}
            >
              Tiền thu (+{formatVND(totalIn)})
            </button>
            <button
              className={`misa-reports-chip ${typeFilter === "out" ? "active" : ""}`}
              onClick={() => setTypeFilter("out")}
            >
              Tiền chi (-{formatVND(totalOut)})
            </button>
            <button
              className={`misa-reports-chip ${typeFilter === "sure" ? "active" : ""}`}
              onClick={() => setTypeFilter("sure")}
            >
              Chắc chắn 100%
            </button>
          </div>
        </div>

        <table className="misa-report-data-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}>STT</th>
              <th style={{ width: 90 }}>Ngày dự kiến</th>
              <th>Nội dung / Hạng mục dòng tiền</th>
              <th style={{ width: 180 }}>Đối tác / Đơn vị</th>
              <th style={{ width: 170 }}>Căn cứ chứng từ</th>
              <th style={{ width: 125, textAlign: "right" }}>Dự kiến Thu (+)</th>
              <th style={{ width: 125, textAlign: "right" }}>Dự kiến Chi (-)</th>
              <th style={{ width: 135, textAlign: "right" }}>Dự báo tồn quỹ</th>
              <th style={{ width: 100, textAlign: "center" }}>Mức độ khả thi</th>
              <th style={{ width: 50, textAlign: "center" }}>Xóa</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => {
              return (
                <tr key={item.id}>
                  <td style={{ textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ textAlign: "center", fontWeight: 600, color: "#1e293b" }}>{item.date}</td>
                  <td>
                    <strong>{item.category}</strong>
                  </td>
                  <td>{item.partner}</td>
                  <td style={{ color: "#64748b", fontSize: 12 }}>{item.documentRef}</td>
                  <td style={{ textAlign: "right", color: item.kind === "in" ? "#107e3e" : "#94a3b8", fontWeight: item.kind === "in" ? 700 : 400 }}>
                    {item.kind === "in" ? `+${formatVND(item.amount)}` : "-"}
                  </td>
                  <td style={{ textAlign: "right", color: item.kind === "out" ? "#ea580c" : "#94a3b8", fontWeight: item.kind === "out" ? 700 : 400 }}>
                    {item.kind === "out" ? `-${formatVND(item.amount)}` : "-"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: item.balanceAfter >= safetyThreshold ? "#0f172a" : "#dc2626" }}>
                    {formatVND(item.balanceAfter)}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      className={`misa-forecast-prob-badge ${item.probability === 100
                        ? "misa-forecast-prob-100"
                        : item.probability >= 85
                          ? "misa-forecast-prob-high"
                          : "misa-forecast-prob-medium"
                        }`}
                    >
                      {item.probability}% {item.probability === 100 ? "✓" : ""}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
                      title="Xóa khỏi kế hoạch"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* Dòng tổng kết */}
            <tr style={{ background: "#ecfdf5", fontWeight: 800, fontSize: 13 }}>
              <td colSpan={5} style={{ textAlign: "left", paddingLeft: 14, color: "#065f46" }}>
                <strong>TỔNG HỢP KẾ HOẠCH DÒNG TIỀN (30 NGÀY TỚI):</strong>
              </td>
              <td style={{ textAlign: "right", color: "#107e3e" }}>+{formatVND(totalIn)}</td>
              <td style={{ textAlign: "right", color: "#ea580c" }}>-{formatVND(totalOut)}</td>
              <td style={{ textAlign: "right", color: "#065f46", fontSize: 14 }}>{formatVND(finalBalance)}</td>
              <td colSpan={2} style={{ textAlign: "center", color: "#059669", fontSize: 11.5 }}>
                Dòng tiền ròng: +{formatVND(netCashflow)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 6. Modal Thêm khoản dự kiến */}
      {showAddModal && (
        <div className="misa-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div
            className="misa-modal-box"
            style={{ width: 520, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="misa-modal-header">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Plus size={18} style={{ color: "#107e3e" }} />
                <span>Thêm khoản dự kiến thu / chi tiền mặt</span>
              </h3>
              <button
                type="button"
                className="misa-tax-icon-btn"
                onClick={() => setShowAddModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddItem} style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Loại dòng tiền
                  </label>
                  <select
                    value={newItem.kind}
                    onChange={(e) => setNewItem({ ...newItem, kind: e.target.value as "in" | "out" })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
                  >
                    <option value="in">Tiền thu vào (+)</option>
                    <option value="out">Tiền chi ra (-)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Ngày dự kiến phát sinh
                  </label>
                  <input
                    type="date"
                    value={newItem.date}
                    onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                  Hạng mục thu / chi
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thu tiền bán hàng theo hợp đồng, Chi mua văn phòng phẩm..."
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Đối tác / Khách hàng / NCC
                  </label>
                  <input
                    type="text"
                    placeholder="Tên công ty hoặc người nộp/nhận..."
                    value={newItem.partner}
                    onChange={(e) => setNewItem({ ...newItem, partner: e.target.value })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13 }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Số tiền dự kiến (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={newItem.amount}
                    onChange={(e) => setNewItem({ ...newItem, amount: Number(e.target.value) })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Căn cứ chứng từ / Hợp đồng
                  </label>
                  <input
                    type="text"
                    placeholder="Số hóa đơn, hợp đồng hoặc quyết định..."
                    value={newItem.documentRef}
                    onChange={(e) => setNewItem({ ...newItem, documentRef: e.target.value })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 10px", fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#334155" }}>
                    Mức độ khả thi (%)
                  </label>
                  <select
                    value={newItem.probability}
                    onChange={(e) => setNewItem({ ...newItem, probability: Number(e.target.value) })}
                    style={{ width: "100%", height: 34, borderRadius: 6, border: "1px solid #cbd5e1", padding: "0 8px", fontSize: 13 }}
                  >
                    <option value={100}>100% - Chắc chắn (Cam kết/Quy định)</option>
                    <option value={90}>90% - Rất cao (Đã xác nhận thanh toán)</option>
                    <option value={85}>85% - Khả năng cao (Theo hạn nợ HĐ)</option>
                    <option value={70}>70% - Dự kiến (Đang đàm phán)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="misa-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="misa-btn-primary">
                  Lưu vào kế hoạch dòng tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal AVA AI Phân tích dòng tiền */}
      {showAdvisorModal && (
        <div className="misa-modal-backdrop" onClick={() => setShowAdvisorModal(false)}>
          <div
            className="misa-modal-box"
            style={{ width: 640, maxWidth: "92vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="misa-modal-header">
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} style={{ color: "#8b5cf6" }} />
                <span>Báo cáo tư vấn dòng tiền từ Trợ lý MISA AVA</span>
              </h3>
              <button
                type="button"
                className="misa-tax-icon-btn"
                onClick={() => setShowAdvisorModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Tồn quỹ thấp nhất</div>
                  <strong style={{ fontSize: 17, color: "#0284c7" }}>{formatVND(minBalance)} đ</strong>
                  <div style={{ fontSize: 11, color: "#107e3e" }}>Vào ngày 08/10/2026</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Hệ số an toàn dòng tiền</div>
                  <strong style={{ fontSize: 17, color: "#107e3e" }}>3.87x</strong>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Trên định mức tối thiểu</div>
                </div>
                <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11.5, color: "#64748b" }}>Dòng tiền thuần (Net)</div>
                  <strong style={{ fontSize: 17, color: "#107e3e" }}>+{formatVND(netCashflow)} đ</strong>
                  <div style={{ fontSize: 11, color: "#107e3e" }}>Thặng dư tiền mặt</div>
                </div>
              </div>

              <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#0f172a" }}>
                3 Điểm lưu ý trọng yếu từ MISA AVA:
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#334155", display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.45 }}>
                <li>
                  <strong>Tập trung thu hồi nợ ngày 28/09:</strong> Khoản nợ 25.000.000 đ từ Công ty Hoàng Gia là nguồn tiền then chốt để phục vụ chi trả lương đầu tháng 10. Kế toán nên gửi thông báo nhắc nợ sớm trước 2 ngày.
                </li>
                <li>
                  <strong>Dự phòng chi nộp thuế quý 3 ngày 20/10:</strong> Doanh nghiệp dự kiến nộp 15.800.000 đ thuế GTGT & TNDN. Quỹ tiền mặt hoàn toàn đủ năng lực chi trả mà không cần rút thêm tiền gửi ngân hàng.
                </li>
                <li>
                  <strong>Tối ưu hóa lãi suất tiền gửi:</strong> Tồn quỹ cuối kỳ dự kiến đạt 121.600.000 đ, vượt xa định mức an toàn 25.000.000 đ. Đề xuất chuyển 50.000.000 đ từ quỹ tiền mặt sang tiền gửi ngân hàng có kỳ hạn ngắn (1 tháng) để sinh lời.
                </li>
              </ul>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="misa-btn-primary"
                  onClick={() => setShowAdvisorModal(false)}
                >
                  Đã ghi nhận khuyến nghị
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// 4A. PAYMENT REQUESTS TAB ("Đề nghị chi tiền")
// ----------------------------------------------------------------------
function PaymentRequestsTab({
  notify,
  onOpenCreatePayment,
}: {
  notify: (msg: string) => void;
  onOpenCreatePayment: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [requests] = useState([
    {
      id: "dnc-01",
      code: "ĐNC00012",
      date: "25/09/2026",
      requester: "Nguyễn Văn Hải",
      dept: "Phòng Kinh doanh",
      purpose: "Chi tiếp khách đoàn đối tác Công ty CP Minh Khang ký kết HĐ",
      amount: 4500000,
      status: "approved",
      voucherCode: "",
    },
    {
      id: "dnc-02",
      code: "ĐNC00011",
      date: "22/09/2026",
      requester: "Lê Hoàng Yến",
      dept: "Phòng Hành chính - Nhân sự",
      purpose: "Mua văn phòng phẩm và vật dụng tiêu hao quý 3/2026",
      amount: 3200000,
      status: "paid",
      voucherCode: "PC00004",
    },
    {
      id: "dnc-03",
      code: "ĐNC00010",
      date: "18/09/2026",
      requester: "Trần Quốc Tuấn",
      dept: "Phòng Kỹ thuật",
      purpose: "Bảo dưỡng sửa chữa đột xuất hệ thống máy in và điều hòa",
      amount: 5800000,
      status: "pending",
      voucherCode: "",
    },
    {
      id: "dnc-04",
      code: "ĐNC00009",
      date: "15/09/2026",
      requester: "Phạm Hải Đăng",
      dept: "Ban Giám đốc",
      purpose: "Chi phí công tác phí dự hội thảo chuyển đổi số tại TP.HCM",
      amount: 12000000,
      status: "approved",
      voucherCode: "",
    },
    {
      id: "dnc-05",
      code: "ĐNC00008",
      date: "10/09/2026",
      requester: "Vũ Thị Mai",
      dept: "Phòng Kế toán",
      purpose: "Chi nộp phí dịch vụ ngân hàng và chứng thư số điện tử",
      amount: 1540000,
      status: "paid",
      voucherCode: "PC00002",
    },
  ]);

  const filtered = requests.filter((r) => {
    const matchSearch =
      !search ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.requester.toLowerCase().includes(search.toLowerCase()) ||
      r.purpose.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc", padding: 14 }}>
      {/* KPI Header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Tổng tiền đề nghị</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>27.040.000 đ</div>
        </div>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Chờ duyệt</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>1 đề nghị</div>
        </div>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đã duyệt (Chờ chi)</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7" }}>2 đề nghị</div>
        </div>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đã chi tiền</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#00b06b" }}>2 đề nghị</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm kiếm đề nghị chi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                height: 32,
                paddingLeft: 30,
                paddingRight: 10,
                fontSize: 12.5,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                outline: "none",
              }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              height: 32,
              padding: "0 10px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 12.5,
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="paid">Đã chi tiền</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="misa-btn-primary"
            style={{ height: 32, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => notify("Đã mở form lập Giấy đề nghị chi tiền...")}
          >
            <Plus size={14} />
            Thêm đề nghị chi
          </button>
          <button
            type="button"
            className="misa-btn-secondary"
            style={{ height: 32, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={onOpenCreatePayment}
          >
            Lập phiếu chi từ đề nghị
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <table className="misa-tax-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" aria-label="Chọn tất cả" /></th>
              <th style={{ width: 110 }}>Số đề nghị</th>
              <th style={{ width: 100 }}>Ngày đề nghị</th>
              <th style={{ width: 140 }}>Người đề nghị</th>
              <th style={{ width: 150 }}>Bộ phận</th>
              <th>Nội dung chi</th>
              <th className="numeric" style={{ width: 130 }}>Số tiền đề nghị</th>
              <th style={{ width: 120, textAlign: "center" }}>Trạng thái</th>
              <th style={{ width: 110 }}>Số chứng từ chi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Chọn ${r.code}`} /></td>
                <td><strong style={{ color: "#00b06b", cursor: "pointer" }} onClick={() => notify(`Xem chi tiết đề nghị: ${r.code}`)}>{r.code}</strong></td>
                <td>{r.date}</td>
                <td><strong>{r.requester}</strong></td>
                <td>{r.dept}</td>
                <td>{r.purpose}</td>
                <td className="numeric"><strong>{formatVND(r.amount)} đ</strong></td>
                <td style={{ textAlign: "center" }}>
                  {r.status === "paid" ? (
                    <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Đã chi tiền</span>
                  ) : r.status === "approved" ? (
                    <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Đã duyệt</span>
                  ) : (
                    <span style={{ background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Chờ duyệt</span>
                  )}
                </td>
                <td>{r.voucherCode ? <strong style={{ color: "#0284c7" }}>{r.voucherCode}</strong> : <span style={{ color: "#94a3b8" }}>-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 4B. ADVANCE SETTLEMENT TAB ("Đề nghị quyết toán tạm ứng")
// ----------------------------------------------------------------------
function AdvanceSettlementTab({
  notify,
  onOpenCreateReceipt,
}: {
  notify: (msg: string) => void;
  onOpenCreateReceipt: () => void;
}) {
  const [search, setSearch] = useState("");

  const settlements = [
    {
      id: "qt-01",
      code: "QT00005",
      date: "03/09/2026",
      person: "Hoàng Thiên Bảo",
      reason: "Quyết toán tạm ứng công tác phí triển khai dự án miền Trung",
      advanceAmount: 25000000,
      spentAmount: 20000000,
      refundAmount: 5000000,
      status: "settled",
      receiptCode: "PT00005",
    },
    {
      id: "qt-02",
      code: "QT00004",
      date: "28/08/2026",
      person: "Nguyễn Văn Hải",
      reason: "Tạm ứng mua sắm vật tư linh kiện thay thế phòng lab",
      advanceAmount: 15000000,
      spentAmount: 15000000,
      refundAmount: 0,
      status: "settled",
      receiptCode: "-",
    },
    {
      id: "qt-03",
      code: "QT00003",
      date: "15/08/2026",
      person: "Trương Thị B",
      reason: "Tạm ứng chi phí tiếp khách và hội nghị khách hàng thường niên",
      advanceAmount: 30000000,
      spentAmount: 28500000,
      refundAmount: 1500000,
      status: "settled",
      receiptCode: "PT00001",
    },
  ];

  const filtered = settlements.filter(
    (s) =>
      !search ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.person.toLowerCase().includes(search.toLowerCase()) ||
      s.reason.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc", padding: 14 }}>
      {/* KPI Header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Tổng số tiền tạm ứng</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>70.000.000 đ</div>
        </div>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Đã chi thực tế</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0284c7" }}>63.500.000 đ</div>
        </div>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Thu hồi hoàn ứng</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#00b06b" }}>6.500.000 đ</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <div style={{ position: "relative", width: 240 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Tìm kiếm quyết toán tạm ứng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              fontSize: 12.5,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="misa-btn-primary"
            style={{ height: 32, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => notify("Đã mở form lập Bảng quyết toán tạm ứng...")}
          >
            <Plus size={14} />
            Lập quyết toán tạm ứng
          </button>
          <button
            type="button"
            className="misa-btn-secondary"
            style={{ height: 32, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={onOpenCreateReceipt}
          >
            Lập phiếu thu hoàn ứng
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <table className="misa-tax-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: "center" }}><input type="checkbox" aria-label="Chọn tất cả" /></th>
              <th style={{ width: 110 }}>Số quyết toán</th>
              <th style={{ width: 100 }}>Ngày quyết toán</th>
              <th style={{ width: 140 }}>Người tạm ứng</th>
              <th>Nội dung thanh toán tạm ứng</th>
              <th className="numeric" style={{ width: 130 }}>Số tiền tạm ứng</th>
              <th className="numeric" style={{ width: 130 }}>Số chi thực tế</th>
              <th className="numeric" style={{ width: 130 }}>Chênh lệch hoàn ứng</th>
              <th style={{ width: 120, textAlign: "center" }}>Trạng thái</th>
              <th style={{ width: 110 }}>Số phiếu thu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td style={{ textAlign: "center" }}><input type="checkbox" aria-label={`Chọn ${s.code}`} /></td>
                <td><strong style={{ color: "#00b06b", cursor: "pointer" }} onClick={() => notify(`Xem quyết toán: ${s.code}`)}>{s.code}</strong></td>
                <td>{s.date}</td>
                <td><strong>{s.person}</strong></td>
                <td>{s.reason}</td>
                <td className="numeric">{formatVND(s.advanceAmount)} đ</td>
                <td className="numeric" style={{ color: "#ea580c", fontWeight: 600 }}>{formatVND(s.spentAmount)} đ</td>
                <td className="numeric" style={{ color: "#00b06b", fontWeight: 700 }}>{formatVND(s.refundAmount)} đ</td>
                <td style={{ textAlign: "center" }}>
                  <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Đã thanh toán hết</span>
                </td>
                <td>{s.receiptCode !== "-" ? <strong style={{ color: "#0284c7" }}>{s.receiptCode}</strong> : <span style={{ color: "#94a3b8" }}>-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 5. MAIN MISA TIỀN MẶT WORKSPACE COMPONENT
// ----------------------------------------------------------------------
export default function MisaCashWorkspace({
  tab = "transactions",
  href,
  notify,
}: {
  company?: { id: string; name: string };
  period?: string;
  tab: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
}) {
  // Modal states
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showSupplierPayment, setShowSupplierPayment] = useState(false);
  const [showCustomerCollection, setShowCustomerCollection] = useState(false);
  const [showMultiCustomerCollection, setShowMultiCustomerCollection] = useState(false);
  const [showVoucherPrint, setShowVoucherPrint] = useState(false);
  const [showCreateVoucher, setShowCreateVoucher] = useState<"receipt" | "payment" | null>(null);
  const [voucherCategoryChoice, setVoucherCategoryChoice] = useState<"cash" | "bank">("cash");
  const [createVoucherTypeIndex, setCreateVoucherTypeIndex] = useState<number>(0);
  const [showCashPaymentSubmenu, setShowCashPaymentSubmenu] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showInternalTransfer, setShowInternalTransfer] = useState(false);

  // Dropdown menus (Mutually exclusive to prevent multiple open menus)
  const [activeToolbarMenu, setActiveToolbarMenu] = useState<"receipt" | "payment" | null>(null);
  const [activeFlowchartMenu, setActiveFlowchartMenu] = useState<"receipt" | "payment" | null>(null);
  const flowchartMenuTimer = useRef<number | null>(null);

  const handleFlowchartMouseEnter = (menu: "receipt" | "payment") => {
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

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter] = useState("all");
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("ytd");
  const [kpiCollapsed, setKpiCollapsed] = useState(false);

  // Selected voucher for print preview (Default matching Image 5)
  const [selectedVoucher, setSelectedVoucher] = useState({
    code: "PT00005",
    date: "2026-09-03",
    person: "Hoàng Thiên Bảo",
    address: "Tầng 4, Tòa nhà MISA, Cầu Giấy, Hà Nội",
    reason: "Thu hoàn ứng sau khi quyết toán tạm ứng cho Hoàng Thiên Bảo",
    debitAccount: "111",
    creditAccount: "141",
    amount: 5000000,
    amountInWords: "Năm triệu đồng chẵn",
    notes: "Kèm theo giấy đề nghị thanh toán tạm ứng số 05/QTTU",
    chiefAccountant: "Trương Thị B",
    director: "Nguyễn Văn A",
  });

  // Pre-filled authentic MISA cash transactions
  const [transactions, setTransactions] = useState<any[]>([
    {
      id: "pt-05",
      code: "PT00005",
      date: "2026-09-03",
      partner: "Hoàng Thiên Bảo",
      person: "Hoàng Thiên Bảo",
      description: "Thu hoàn ứng sau khi quyết toán tạm ứng cho Hoàng Thiên Bảo",
      amount: 5000000,
      kind: "receipt",
      debit: "111",
      credit: "141",
      status: "posted",
    },
    {
      id: "pc-03",
      code: "PC00003",
      date: "2026-09-07",
      partner: "Chi cục Thuế Cầu Giấy",
      person: "Nguyễn Văn Hải",
      description: "Nộp thuế GTGT đầu ra tháng 8/2026 vào NSNN",
      amount: 64107650,
      kind: "payment",
      debit: "33311",
      credit: "1111",
      status: "posted",
    },
    {
      id: "pt-01",
      code: "PT00001",
      date: "2026-09-01",
      partner: "Công ty CP Minh Khang",
      person: "Phạm Hải Đăng",
      description: "Thu tiền bán hàng trực tiếp theo hóa đơn GTGT",
      amount: 15400000,
      kind: "receipt",
      debit: "1111",
      credit: "131",
      status: "posted",
    },
    {
      id: "pt-02",
      code: "PT00002",
      date: "2026-09-02",
      partner: "Ngân hàng Ngoại thương (VCB)",
      person: "Vũ Thị Mai (Thủ quỹ)",
      description: "Rút tiền gửi ngân hàng về nhập quỹ tiền mặt",
      amount: 50000000,
      kind: "receipt",
      debit: "1111",
      credit: "1121",
      status: "posted",
    },
    {
      id: "pc-01",
      code: "PC00001",
      date: "2026-09-02",
      partner: "VNPT Hà Nội",
      person: "Lê Minh Tuấn",
      description: "Chi tiền thanh toán cước viễn thông, internet tháng 8",
      amount: 2850000,
      kind: "payment",
      debit: "6427",
      credit: "1111",
      status: "posted",
    },
    {
      id: "pc-02",
      code: "PC00002",
      date: "2026-09-03",
      partner: "Lê Thị Mai (Phòng KD)",
      person: "Lê Thị Mai",
      description: "Chi tạm ứng công tác phí thị trường miền Trung",
      amount: 8000000,
      kind: "payment",
      debit: "141",
      credit: "1111",
      status: "posted",
    },
    {
      id: "pc-04",
      code: "PC00004",
      date: "2026-09-08",
      partner: "Công ty TNHH Hồng Hà",
      person: "Nguyễn Văn Nam",
      description: "Chi mua văn phòng phẩm dùng ngay cho khối văn phòng",
      amount: 1450000,
      kind: "payment",
      debit: "6422",
      credit: "1111",
      status: "posted",
    },
    {
      id: "pt-03",
      code: "PT00003",
      date: "2026-09-10",
      partner: "Công ty Đạt Phát",
      person: "Trần Quốc Toản",
      description: "Thu hồi nợ bán hàng tồn đọng quý 2",
      amount: 24500000,
      kind: "receipt",
      debit: "1111",
      credit: "131",
      status: "posted",
    },
  ]);

  // Selected row for inline detail
  const [selectedRowId, setSelectedRowId] = useState<string>("pt-05");

  const selectedTransaction = useMemo(
    () => transactions.find((t) => t.id === selectedRowId) || transactions[0],
    [transactions, selectedRowId],
  );

  // Filtered list
  const filteredList = useMemo(() => {
    return transactions.filter((item) => {
      const matchQuery =
        !searchQuery ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.partner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;
      const matchKind =
        voucherTypeFilter === "all" || item.kind === voucherTypeFilter;
      return matchQuery && matchStatus && matchKind;
    });
  }, [transactions, searchQuery, statusFilter, voucherTypeFilter]);

  // Total summary
  const totalReceipt = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "receipt")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  const totalPayment = useMemo(
    () =>
      transactions
        .filter((t) => t.kind === "payment")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions],
  );

  // Handler for Tax payment submission
  const handleTaxPayment = (taxData: any) => {
    const newDoc = {
      id: crypto.randomUUID(),
      code: `PC${String(transactions.length + 1).padStart(5, "0")}`,
      date: taxData.taxDate,
      partner: "Kho bạc Nhà nước / Chi cục Thuế",
      person: "Thủ quỹ Vũ Thị Mai",
      description: `Nộp ${taxData.taxType} vào NSNN`,
      amount: taxData.totalAmount,
      kind: "payment",
      debit: "33311",
      credit: "1111",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowTaxModal(false);
    notify(`Đã lập thành công chứng từ ${newDoc.code} - Nộp thuế ${formatVND(taxData.totalAmount)}đ!`);
  };

  // Handler for Supplier payment submission
  const handleSupplierPayment = (data: any) => {
    const newDoc = {
      id: crypto.randomUUID(),
      code: `PC${String(transactions.length + 1).padStart(5, "0")}`,
      date: data.payDate,
      partner: data.supplier,
      person: data.employee,
      description: `Trả tiền nhà cung cấp ${data.supplier} theo hóa đơn`,
      amount: data.totalAmount,
      kind: "payment",
      debit: "331",
      credit: "1111",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowSupplierPayment(false);
    notify(
      `Đã lập thành công chứng từ ${newDoc.code} - Trả tiền NCC ${formatVND(data.totalAmount)}đ!`,
    );
  };

  const handleCustomerCollection = (data: any) => {
    const ptCode = `PT${String(transactions.length + 1).padStart(5, "0")}`;
    const newDoc = {
      id: crypto.randomUUID(),
      code: ptCode,
      date: data.collectDate,
      partner: data.customer,
      person: data.employee || data.customer,
      description: `Thu tiền bán hàng từ khách hàng ${data.customer} theo hóa đơn`,
      amount: data.totalAmount,
      kind: "receipt",
      debit: "1111",
      credit: "131",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowCustomerCollection(false);
    notify(
      `Đã lập thành công chứng từ ${newDoc.code} - Thu nợ khách hàng ${formatVND(data.totalAmount)}đ!`,
    );
  };

  const handleMultiCustomerCollection = (data: any) => {
    const nextNum = transactions.length + 1;
    const docCode = `PT${String(nextNum).padStart(5, "0")}`;
    const newDoc: any = {
      id: `pt-${Date.now()}`,
      code: docCode,
      date: data.collectDate || "30/09/2026",
      postDate: data.collectDate || "30/09/2026",
      partner: "Nhiều khách hàng",
      person: data.employee || "Thủ quỹ",
      description: `Thu tiền theo hóa đơn nhiều khách hàng (${data.invoices?.length || 0} hóa đơn)`,
      amount: data.totalAmount,
      kind: "receipt",
      debit: "1111",
      credit: "131",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowMultiCustomerCollection(false);
    notify(
      `Đã lập thành công chứng từ ${newDoc.code} - Thu nợ nhiều khách hàng ${formatVND(data.totalAmount)}đ!`,
    );
  };

  // Handler for saving voucher
  const handleSaveVoucher = (doc: any) => {
    setTransactions([doc, ...transactions]);
    setSelectedRowId(doc.id);
    setShowCreateVoucher(null);
    notify(`Đã lưu và ghi sổ chứng từ ${doc.code} thành công.`);
  };

  const handleInsurancePayment = (data: any) => {
    const nextNum = transactions.length + 1;
    const docCode = `PC${String(nextNum).padStart(5, "0")}`;
    const newDoc = {
      id: `pc-${Date.now()}`,
      code: docCode,
      date: data.payDate || "30/09/2026",
      postDate: data.payDate || "30/09/2026",
      partner: data.insuranceUnit || "Cơ quan Bảo hiểm Xã hội",
      person: "Kế toán tiền mặt",
      description: `Chi nộp BHXH, BHYT, BHTN tháng ${data.payDate?.substring(3, 5) || "09"}/2026`,
      amount: data.totalAmount,
      kind: "payment",
      debit: "3383",
      credit: "1111",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowInsuranceModal(false);
    notify(`Đã lập thành công chứng từ ${docCode} - Nộp bảo hiểm ${formatVND(data.totalAmount)}đ!`);
  };

  const handleSalaryPayment = (data: any) => {
    const nextNum = transactions.length + 1;
    const docCode = `PC${String(nextNum).padStart(5, "0")}`;
    const newDoc = {
      id: `pc-${Date.now()}`,
      code: docCode,
      date: data.payDate || "30/09/2026",
      postDate: data.payDate || "30/09/2026",
      partner: "Cán bộ nhân viên",
      person: "Thủ quỹ",
      description: `Chi trả lương nhân viên tháng ${data.payDate?.substring(3, 5) || "09"}/2026 (${data.employees?.length || 4} nhân viên)`,
      amount: data.totalAmount,
      kind: "payment",
      debit: "3341",
      credit: "1111",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowSalaryModal(false);
    notify(`Đã lập thành công chứng từ ${docCode} - Trả lương ${formatVND(data.totalAmount)}đ!`);
  };

  const handleInternalTransfer = (data: any) => {
    const nextNum = transactions.length + 1;
    const docCode = `CK${String(nextNum).padStart(5, "0")}`;
    const newDoc = {
      id: `ck-${Date.now()}`,
      code: docCode,
      date: data.transferDate || "29/09/2026",
      partner: "Nội bộ",
      person: "Thủ quỹ",
      description: data.reason || "Chuyển tiền nội bộ",
      amount: data.amount,
      kind: "payment",
      debit: "1111",
      credit: "1121",
      status: "posted",
    };
    setTransactions([newDoc, ...transactions]);
    setSelectedRowId(newDoc.id);
    setShowInternalTransfer(false);
    notify(`Đã lập thành công lệnh chuyển tiền nội bộ ${formatVND(data.amount)}đ!`);
  };

  // --------------------------------------------------------------------
  // RENDER TAB: "Thu, chi tiền"
  // --------------------------------------------------------------------
  if (tab === "transactions" || tab === "all") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
        {/* KPI Strip (Matching user screenshot) */}
        {!kpiCollapsed && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
              padding: "10px 14px 4px 14px",
              background: "#ffffff",
            }}
          >
            {/* Card 1: Tổng thu */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  display: "grid",
                  placeItems: "center",
                  color: "#00b06b",
                  flexShrink: 0,
                }}
              >
                <Coins size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Tổng thu đầu năm đến hiện tại
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#00b06b" }}>
                  {totalReceipt > 0 ? "11.820.000" : formatVND(totalReceipt)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>

            {/* Card 2: Tổng chi */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  display: "grid",
                  placeItems: "center",
                  color: "#ea580c",
                  flexShrink: 0,
                }}
              >
                <Coins size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Tổng chi đầu năm đến hiện tại
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ea580c" }}>
                  {totalPayment > 0 ? "155.102.540" : formatVND(totalPayment)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>

            {/* Card 3: Tồn quỹ */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  background: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                  display: "grid",
                  placeItems: "center",
                  color: "#7c3aed",
                  flexShrink: 0,
                }}
              >
                <Coins size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#334155", fontWeight: 500, marginBottom: 2 }}>
                  Tồn quỹ đến ngày 03/09/2026
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>
                  (143.282.540)
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#94a3b8" }}>
                <Clock size={12} />
                <span>15:12</span>
              </div>
            </div>
          </div>
        )}

        {/* Center Collapse/Expand Button for KPI strip */}
        <div style={{ display: "flex", justifyContent: "center", background: "#ffffff", borderBottom: "1px solid #e5e7eb", paddingBottom: 2 }}>
          <button
            type="button"
            onClick={() => setKpiCollapsed(!kpiCollapsed)}
            style={{
              width: 32,
              height: 16,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              boxShadow: "0 -1px 2px rgba(0,0,0,0.04)",
            }}
            title={kpiCollapsed ? "Mở rộng thẻ chỉ số" : "Thu gọn thẻ chỉ số"}
          >
            {kpiCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
        </div>

        {/* Click outside backdrop for toolbar dropdowns */}
        {activeToolbarMenu && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 18 }}
            onClick={() => setActiveToolbarMenu(null)}
          />
        )}

        {/* Action Toolbar (Exact layout from user screenshot) */}
        <div
          className="misa-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            position: "relative",
            zIndex: 19,
            gap: 8,
          }}
        >
          {/* Left Controls: Search, Loại phiếu, Period, Utility Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Search Box */}
            <div style={{ position: "relative", width: 200 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 9,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#8b5cf6",
                }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 32,
                  paddingLeft: 28,
                  paddingRight: 8,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  fontSize: 13,
                  outline: "none",
                  background: "#ffffff",
                }}
              />
            </div>

            {/* Loại phiếu dropdown */}
            <select
              value={voucherTypeFilter}
              onChange={(e) => setVoucherTypeFilter(e.target.value)}
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                background: "#ffffff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              <option value="all">Loại phiếu: Tất cả</option>
              <option value="receipt">Loại phiếu: Thu tiền</option>
              <option value="payment">Loại phiếu: Chi tiền</option>
            </select>

            {/* Period select: Đầu năm tới hiện tại */}
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              style={{
                height: 32,
                padding: "0 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                color: "#334155",
                background: "#ffffff",
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              <option value="ytd">Kỳ: Đầu năm tới hiện tại</option>
              <option value="month">Kỳ: Tháng này</option>
              <option value="quarter">Kỳ: Quý này</option>
              <option value="year">Kỳ: Năm nay</option>
            </select>

            {/* Icon buttons group */}
            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Gợi ý thông minh / AI Insights"
              onClick={() => setShowAIModal(true)}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#8b5cf6",
                cursor: "pointer",
              }}
            >
              <Sparkles size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Làm mới dữ liệu"
              onClick={() => notify("Đã cập nhật danh sách.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Tùy chọn điều chuyển / sắp xếp"
              onClick={() => notify("Tùy chọn hiển thị chứng từ.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <SlidersHorizontal size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Xuất khẩu / Nhập khẩu"
              onClick={() => notify("Xuất danh sách ra Excel.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <FileSpreadsheet size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Tùy chọn cột và thiết lập"
              onClick={() => notify("Mở thiết lập cột.")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              className="misa-tax-icon-btn"
              title="Bộ lọc nâng cao"
              onClick={() => notify("Mở bộ lọc nâng cao")}
              style={{
                width: 32,
                height: 32,
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              <Filter size={15} />
            </button>
          </div>

          {/* Right Buttons: Thêm bằng AI, Thêm thu tiền, Thêm chi tiền (Screenshot 3 & 4) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Thêm bằng AI Button */}
            <button
              type="button"
              onClick={() => setShowAIModal(true)}
              style={{
                height: 34,
                padding: "0 14px",
                background: "linear-gradient(90deg, #0084ff 0%, #a855f7 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 132, 255, 0.25)",
              }}
            >
              <img
                src="/ava_avatar.jpg"
                alt="AVA AI"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "1.5px solid #ffffff",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <span>Thêm bằng AI</span>
            </button>

            {/* Thêm thu tiền Dropdown Button (Screenshot 3) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() =>
                  setActiveToolbarMenu((prev) => (prev === "receipt" ? null : "receipt"))
                }
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#00b06b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
                }}
              >
                <span>Thêm thu tiền</span>
                <ChevronDown size={14} />
              </button>

              {activeToolbarMenu === "receipt" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 295,
                    width: "max-content",
                    background: "#ffffff",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setVoucherCategoryChoice("cash");
                      setShowCreateVoucher("receipt");
                    }}
                  >
                    Thu tiền
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowCustomerCollection(true);
                    }}
                  >
                    Thu tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowMultiCustomerCollection(true);
                    }}
                  >
                    Thu tiền theo nhiều hóa đơn
                  </button>
                </div>
              )}
              {activeToolbarMenu && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setActiveToolbarMenu(null)}
                />
              )}
            </div>

            {/* Thêm chi tiền Dropdown Button (Screenshot 4) */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() =>
                  setActiveToolbarMenu((prev) => (prev === "payment" ? null : "payment"))
                }
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#00b06b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
                }}
              >
                <span>Thêm chi tiền</span>
                <ChevronDown size={14} />
              </button>

              {activeToolbarMenu === "payment" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    minWidth: 220,
                    background: "#ffffff",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.12)",
                    border: "1px solid #e2e8f0",
                    padding: "6px 0",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setVoucherCategoryChoice("cash");
                      setShowCreateVoucher("payment");
                    }}
                  >
                    Phiếu chi
                  </button>
                  <div
                    style={{ position: "relative" }}
                    onMouseEnter={() => setShowCashPaymentSubmenu(true)}
                    onMouseLeave={() => setShowCashPaymentSubmenu(false)}
                  >
                    <button
                      type="button"
                      style={{
                        textAlign: "left",
                        padding: "10px 18px",
                        border: "none",
                        background: showCashPaymentSubmenu ? "#f1f5f9" : "transparent",
                        fontSize: 13.5,
                        color: "#1e293b",
                        cursor: "pointer",
                        width: "100%",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                      onClick={() => {
                        setActiveToolbarMenu(null);
                        setShowCashPaymentSubmenu(false);
                        setVoucherCategoryChoice("bank");
                        setCreateVoucherTypeIndex(0);
                        setShowCreateVoucher("payment");
                      }}
                    >
                      <span>Chi tiền</span>
                      <ChevronRight size={14} style={{ color: "#64748b" }} />
                    </button>

                    {showCashPaymentSubmenu && (
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          right: "100%",
                          marginRight: 4,
                          minWidth: 320,
                          background: "#ffffff",
                          borderRadius: 8,
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15)",
                          border: "1px solid #e2e8f0",
                          padding: "6px 0",
                          zIndex: 60,
                        }}
                      >
                        {MISA_BANK_PAYMENT_TYPES.map((t, idx) => (
                          <button
                            key={t.id}
                            type="button"
                            style={{
                              textAlign: "left",
                              padding: "8px 16px",
                              border: "none",
                              background: "transparent",
                              fontSize: 13,
                              color: "#1e293b",
                              cursor: "pointer",
                              width: "100%",
                              fontFamily: "inherit",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#dbece2";
                              e.currentTarget.style.color = "#047857";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#1e293b";
                            }}
                            onClick={() => {
                              setActiveToolbarMenu(null);
                              setShowCashPaymentSubmenu(false);
                              setVoucherCategoryChoice("bank");
                              setCreateVoucherTypeIndex(idx);
                              setShowCreateVoucher("payment");
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowSupplierPayment(true);
                    }}
                  >
                    Trả tiền theo hóa đơn
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowTaxModal(true);
                    }}
                  >
                    Nộp thuế
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowInsuranceModal(true);
                    }}
                  >
                    Nộp bảo hiểm
                  </button>
                  <button
                    type="button"
                    style={{
                      textAlign: "left",
                      padding: "10px 18px",
                      border: "none",
                      background: "transparent",
                      fontSize: 13.5,
                      color: "#1e293b",
                      cursor: "pointer",
                      width: "100%",
                      fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setActiveToolbarMenu(null);
                      setShowSalaryModal(true);
                    }}
                  >
                    Trả lương
                  </button>
                </div>
              )}
              {activeToolbarMenu && (
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 40 }}
                  onClick={() => setActiveToolbarMenu(null)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", background: "#ffffff" }}>
          <table className="misa-tax-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>
                  <input type="checkbox" aria-label="Chọn tất cả" />
                </th>
                <th style={{ width: 95 }}>Ngày hạch toán</th>
                <th style={{ width: 95 }}>Ngày chứng từ</th>
                <th style={{ width: 90 }}>Số chứng từ</th>
                <th>Diễn giải</th>
                <th className="numeric" style={{ width: 130 }}>
                  Số tiền
                </th>
                <th style={{ width: 180 }}>Đối tượng</th>
                <th style={{ width: 90 }}>Loại</th>
                <th style={{ width: 95 }}>Trạng thái</th>
                <th style={{ width: 100, textAlign: "center" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((t) => (
                <tr
                  key={t.id}
                  className={selectedRowId === t.id ? "selected" : ""}
                  onClick={() => setSelectedRowId(t.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Chọn ${t.code}`} />
                  </td>
                  <td>{t.date.split("-").reverse().join("/")}</td>
                  <td>{t.date.split("-").reverse().join("/")}</td>
                  <td>
                    <strong style={{ color: "#00b06b" }}>{t.code}</strong>
                  </td>
                  <td>{t.description}</td>
                  <td
                    className="numeric"
                    style={{
                      fontWeight: 600,
                      color: t.kind === "receipt" ? "#059669" : "#111827",
                    }}
                  >
                    {formatVND(t.amount)}
                  </td>
                  <td>{t.partner}</td>
                  <td>{t.kind === "receipt" ? "Phiếu thu" : "Phiếu chi"}</td>
                  <td>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500,
                        background: "#ecfdf5",
                        color: "#047857",
                      }}
                    >
                      Đã ghi sổ
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#00b06b",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginRight: 8,
                        fontSize: 12,
                      }}
                      onClick={() => {
                        setSelectedVoucher({
                          code: t.code,
                          date: t.date,
                          person: t.person || t.partner,
                          address: "Cầu Giấy, Hà Nội",
                          reason: t.description,
                          debitAccount: t.debit || "111",
                          creditAccount: t.credit || "141",
                          amount: t.amount,
                          amountInWords: convertNumberToVietnameseWords(t.amount),
                          notes: "Chứng từ kèm theo quyết toán",
                          chiefAccountant: "Trương Thị B",
                          director: "Nguyễn Văn A",
                        });
                        setShowVoucherPrint(true);
                      }}
                    >
                      In
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#2563eb",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      onClick={() => {
                        setSelectedVoucher({
                          code: t.code,
                          date: t.date,
                          person: t.person || t.partner,
                          address: "Cầu Giấy, Hà Nội",
                          reason: t.description,
                          debitAccount: t.debit || "111",
                          creditAccount: t.credit || "141",
                          amount: t.amount,
                          amountInWords: convertNumberToVietnameseWords(t.amount),
                          notes: "Chứng từ kèm theo quyết toán",
                          chiefAccountant: "Trương Thị B",
                          director: "Nguyễn Văn A",
                        });
                        setShowVoucherPrint(true);
                      }}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Split Detail Pane (Bottom Tab) */}
        {selectedTransaction && (
          <div
            style={{
              height: 190,
              borderTop: "1px solid #e5e7eb",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 14px",
                background: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", gap: 16 }}>
                <strong style={{ fontSize: 13, color: "#111827" }}>
                  Chi tiết hạch toán: {selectedTransaction.code} — {selectedTransaction.description}
                </strong>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="misa-btn-secondary"
                  style={{ height: 26, padding: "0 10px", fontSize: 11 }}
                  onClick={() => {
                    setSelectedVoucher({
                      code: selectedTransaction.code,
                      date: selectedTransaction.date,
                      person: selectedTransaction.person || selectedTransaction.partner,
                      address: "Cầu Giấy, Hà Nội",
                      reason: selectedTransaction.description,
                      debitAccount: selectedTransaction.debit || "111",
                      creditAccount: selectedTransaction.credit || "141",
                      amount: selectedTransaction.amount,
                      amountInWords: convertNumberToVietnameseWords(selectedTransaction.amount),
                      notes: "Chứng từ gốc kèm theo quyết toán",
                      chiefAccountant: "Trương Thị B",
                      director: "Nguyễn Văn A",
                    });
                    setShowVoucherPrint(true);
                  }}
                >
                  <Printer size={12} style={{ marginRight: 4 }} />
                  In chứng từ ({selectedTransaction.code})
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "6px 14px" }}>
              <table className="misa-tax-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>STT</th>
                    <th>Diễn giải</th>
                    <th style={{ width: 80 }}>TK Nợ</th>
                    <th style={{ width: 80 }}>TK Có</th>
                    <th className="numeric" style={{ width: 140 }}>Số tiền</th>
                    <th>Đối tượng</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>{selectedTransaction.description}</td>
                    <td><strong style={{ color: "#2563eb" }}>{selectedTransaction.debit || "1111"}</strong></td>
                    <td><strong style={{ color: "#7c3aed" }}>{selectedTransaction.credit || "141"}</strong></td>
                    <td className="numeric"><strong>{formatVND(selectedTransaction.amount)}</strong></td>
                    <td>{selectedTransaction.partner}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODALS */}
        {showTaxModal && (
          <TaxPaymentModal
            onClose={() => setShowTaxModal(false)}
            onSubmit={handleTaxPayment}
          />
        )}

        {showSupplierPayment && (
          <SupplierPaymentModal
            onClose={() => setShowSupplierPayment(false)}
            onSubmit={handleSupplierPayment}
          />
        )}

        {showCustomerCollection && (
          <SingleCustomerInvoiceCollectionModal
            initialMethod="cash"
            onClose={() => setShowCustomerCollection(false)}
            onSubmit={handleCustomerCollection}
          />
        )}

        {showMultiCustomerCollection && (
          <MultiCustomerInvoiceCollectionModal
            initialMethod="cash"
            onClose={() => setShowMultiCustomerCollection(false)}
            onSubmit={handleMultiCustomerCollection}
          />
        )}

        {showInsuranceModal && (
          <InsurancePaymentModal
            onClose={() => setShowInsuranceModal(false)}
            onSubmit={handleInsurancePayment}
          />
        )}

        {showSalaryModal && (
          <SalaryPaymentModal
            onClose={() => setShowSalaryModal(false)}
            onSubmit={handleSalaryPayment}
          />
        )}

        {showInternalTransfer && (
          <InternalTransferModal
            onClose={() => setShowInternalTransfer(false)}
            onSubmit={handleInternalTransfer}
          />
        )}

        {showVoucherPrint && (
          <AccountingVoucherModal
            voucher={selectedVoucher}
            onClose={() => setShowVoucherPrint(false)}
          />
        )}

        {showCreateVoucher && (
          <CreateVoucherModal
            kind={showCreateVoucher}
            voucherCategory={voucherCategoryChoice}
            initialTypeIndex={createVoucherTypeIndex}
            onClose={() => {
              setShowCreateVoucher(null);
              setCreateVoucherTypeIndex(0);
            }}
            onSave={handleSaveVoucher}
          />
        )}

        {showAIModal && (
          <AIAssistantModal
            onClose={() => setShowAIModal(false)}
            onApply={(doc) => {
              setShowAIModal(false);
              handleSaveVoucher(doc);
            }}
          />
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Kiểm kê" (INVENTORY AUDIT)
  // --------------------------------------------------------------------
  if (tab === "inventory") {
    return (
      <div style={{ padding: 16, background: "#f8fafc", overflowY: "auto", height: "100%" }}>
        {/* KPI Grid */}
        <div className="misa-kpi-grid">
          <div className="misa-kpi-card highlight">
            <span>Tổng tiền kiểm kê thực tế</span>
            <strong>96.800.000 đ</strong>
            <small>Đã kiểm kê lúc 17:30 ngày 25/09/2026</small>
          </div>
          <div className="misa-kpi-card">
            <span>Tiền theo sổ kế toán (1111)</span>
            <strong>96.800.000 đ</strong>
            <small>Khớp 100% không chênh lệch</small>
          </div>
          <div className="misa-kpi-card">
            <span>Chênh lệch thừa / thiếu</span>
            <strong style={{ color: "#059669" }}>0 đ</strong>
            <small>Quỹ tiền mặt chuẩn xác</small>
          </div>
          <div className="misa-kpi-card">
            <span>Số biên bản kiểm kê</span>
            <strong>2 biên bản</strong>
            <small>Kỳ tháng 9/2026</small>
          </div>
        </div>

        {/* Actions bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            className="misa-btn-primary"
            onClick={() => notify("Đã mở phiếu tạo biên bản kiểm kê quỹ mới.")}
          >
            <Plus size={14} style={{ marginRight: 4 }} />
            Thêm bảng kiểm kê
          </button>
          <button
            className="misa-btn-secondary"
            onClick={() => notify("Đang in biên bản kiểm kê quỹ tiền mặt...")}
          >
            <Printer size={14} style={{ marginRight: 4 }} />
            In biên bản kiểm kê
          </button>
          <button
            className="misa-btn-secondary"
            onClick={() => notify("Không có chênh lệch quỹ cần xử lý.")}
          >
            Xử lý chênh lệch quỹ
          </button>
        </div>

        {/* Table 1: Danh sách biên bản */}
        <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, marginBottom: 16, border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 14 }}>Danh sách biên bản kiểm kê quỹ</h3>
          <table className="misa-tax-table">
            <thead>
              <tr>
                <th>Số biên bản</th>
                <th>Ngày kiểm kê</th>
                <th>Mục đích kiểm kê</th>
                <th className="numeric">Tiền sổ sách</th>
                <th className="numeric">Tiền thực tế</th>
                <th className="numeric">Chênh lệch</th>
                <th>Kết luận</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style={{ color: "#00b06b" }}>KK00002</strong></td>
                <td>25/09/2026</td>
                <td>Kiểm kê đột xuất quỹ tiền mặt định kỳ</td>
                <td className="numeric">96.800.000</td>
                <td className="numeric">96.800.000</td>
                <td className="numeric" style={{ color: "#059669" }}>0</td>
                <td>Khớp sổ kế toán</td>
                <td><span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>Đã duyệt</span></td>
              </tr>
              <tr>
                <td><strong style={{ color: "#00b06b" }}>KK00001</strong></td>
                <td>31/08/2026</td>
                <td>Kiểm kê chốt quỹ tiền mặt cuối tháng 8</td>
                <td className="numeric">85.200.000</td>
                <td className="numeric">85.200.000</td>
                <td className="numeric" style={{ color: "#059669" }}>0</td>
                <td>Khớp sổ kế toán</td>
                <td><span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 10, fontSize: 11 }}>Đã duyệt</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Table 2: Chi tiết mệnh giá tiền */}
        <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 14 }}>
            Bảng kê chi tiết phân tích mệnh giá tiền thực tế (Biên bản KK00002)
          </h3>
          <table className="misa-denominations-table">
            <thead>
              <tr>
                <th>Mệnh giá</th>
                <th className="numeric" style={{ width: 150 }}>Số tờ</th>
                <th className="numeric" style={{ width: 200 }}>Thành tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>500.000 đ</strong> (Năm trăm nghìn đồng)</td>
                <td className="numeric">120 tờ</td>
                <td className="numeric">60.000.000 đ</td>
              </tr>
              <tr>
                <td><strong>200.000 đ</strong> (Hai trăm nghìn đồng)</td>
                <td className="numeric">85 tờ</td>
                <td className="numeric">17.000.000 đ</td>
              </tr>
              <tr>
                <td><strong>100.000 đ</strong> (Một trăm nghìn đồng)</td>
                <td className="numeric">140 tờ</td>
                <td className="numeric">14.000.000 đ</td>
              </tr>
              <tr>
                <td><strong>50.000 đ</strong> (Năm mươi nghìn đồng)</td>
                <td className="numeric">90 tờ</td>
                <td className="numeric">4.500.000 đ</td>
              </tr>
              <tr>
                <td><strong>20.000 đ</strong> (Hai mươi nghìn đồng)</td>
                <td className="numeric">50 tờ</td>
                <td className="numeric">1.000.000 đ</td>
              </tr>
              <tr>
                <td><strong>10.000 đ</strong> (Mười nghìn đồng)</td>
                <td className="numeric">30 tờ</td>
                <td className="numeric">300.000 đ</td>
              </tr>
              <tr>
                <td><strong>Cộng tiền mặt thực tế</strong></td>
                <td className="numeric"><strong>515 tờ</strong></td>
                <td className="numeric"><strong style={{ color: "#00b06b" }}>96.800.000 đ</strong></td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20, textAlign: "center" }}>
            <div>
              <strong>Trưởng ban kiểm kê</strong>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Giám đốc: Nguyễn Văn A</div>
            </div>
            <div>
              <strong>Kế toán trưởng</strong>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Trương Thị B</div>
            </div>
            <div>
              <strong>Thủ quỹ</strong>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Vũ Thị Mai</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Đề nghị chi tiền"
  // --------------------------------------------------------------------
  if (tab === "payment-requests") {
    return (
      <PaymentRequestsTab
        notify={notify}
        onOpenCreatePayment={() => setShowCreateVoucher("payment")}
      />
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Đề nghị quyết toán tạm ứng"
  // --------------------------------------------------------------------
  if (tab === "advance-settlement") {
    return (
      <AdvanceSettlementTab
        notify={notify}
        onOpenCreateReceipt={() => setShowCreateVoucher("receipt")}
      />
    );
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Dự báo dòng tiền" (CASHFLOW FORECAST - CHUẨN MISA AMIS)
  // --------------------------------------------------------------------
  if (tab === "cashflow") {
    return <CashForecastTab notify={notify} />;
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Báo cáo" (CASH REPORTS HUB - CHUẨN MISA AMIS)
  // --------------------------------------------------------------------
  if (tab === "reports") {
    return <CashReportsTab notify={notify} />;
  }

  // --------------------------------------------------------------------
  // RENDER TAB: "Quy trình" (Flowchart matching MISA AMIS)
  // --------------------------------------------------------------------
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
        {/* Panel 1: NGHIỆP VỤ TIỀN MẶT (Screenshot) */}
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
              padding: "16px 10px 10px 10px",
              color: "#1e293b",
              letterSpacing: "0.5px",
            }}
          >
            NGHIỆP VỤ TIỀN MẶT
          </h2>

          <div
            className="ref-process-canvas"
            style={{
              position: "relative",
              height: 380,
              margin: "0 10px",
              overflow: "visible",
            }}
          >
            {/* SVG Connecting Flow Lines with Arrows */}
            <svg
              className="ref-flow-lines"
              viewBox="0 0 700 340"
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
                <marker
                  id="ref-arrow-cash"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6.5"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 7 3.5, 0 7" fill="#86efac" />
                </marker>
              </defs>

              {/* Arrow from Đề nghị chi tiền to Chi tiền */}
              <circle cx="165" cy="225" r="3.5" fill="#86efac" />
              <path
                d="M 165 225 L 268 225"
                stroke="#a7f3d0"
                strokeWidth="1.8"
                fill="none"
                markerEnd="url(#ref-arrow-cash)"
              />

              {/* Vertical line between Thu tiền and Chi tiền */}
              <circle cx="320" cy="118" r="3.5" fill="#86efac" />
              <circle cx="320" cy="182" r="3.5" fill="#86efac" />
              <path
                d="M 320 118 L 320 182"
                stroke="#a7f3d0"
                strokeWidth="1.8"
                fill="none"
              />

              {/* Horizontal branch from midpoint of Thu/Chi (320, 150) to Kiểm kê quỹ */}
              <path
                d="M 320 150 L 488 150"
                stroke="#a7f3d0"
                strokeWidth="1.8"
                fill="none"
                markerEnd="url(#ref-arrow-cash)"
              />

              {/* Horizontal arrow going right from Kiểm kê quỹ */}
              <path
                d="M 590 150 L 685 150"
                stroke="#a7f3d0"
                strokeWidth="1.8"
                fill="none"
                markerEnd="url(#ref-arrow-cash)"
              />
            </svg>

            {/* Click outside backdrop for flowchart dropdowns */}
            {activeFlowchartMenu && (
              <div
                style={{ position: "fixed", inset: 0, zIndex: 18 }}
                onClick={() => setActiveFlowchartMenu(null)}
              />
            )}

            {/* Node 1: Thu tiền (Top Center) */}
            <div
              style={{
                position: "absolute",
                left: 270,
                top: 38,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: activeFlowchartMenu === "receipt" ? 60 : 10,
              }}
              onMouseEnter={() => handleFlowchartMouseEnter("receipt")}
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
                  setActiveFlowchartMenu((prev) => (prev === "receipt" ? null : "receipt"))
                }
                title="Lập phiếu thu tiền mặt"
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "#dcfce7",
                    border: "1px solid #86efac",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect x="4" y="6" width="30" height="26" rx="4" fill="#059669" />
                    <path d="M 4 10 C 4 7.79 5.79 6 8 6 L 30 6 C 32.21 6 34 7.79 34 10 L 34 14 L 4 14 Z" fill="#047857" />
                    <circle cx="7" cy="10" r="0.9" fill="#a7f3d0" />
                    <circle cx="31" cy="10" r="0.9" fill="#a7f3d0" />
                    <text x="19" y="11.8" fill="#ffffff" fontSize="6.5" fontWeight="900" textAnchor="middle" fontFamily="system-ui, sans-serif">THU</text>
                    <rect x="9" y="17" width="20" height="12" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <circle cx="19" cy="23" r="2.8" fill="#fef3c7" stroke="#d97706" strokeWidth="0.6" />
                    <circle cx="12" cy="23" r="1.1" fill="#d97706" />
                    <circle cx="26" cy="23" r="1.1" fill="#d97706" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: activeFlowchartMenu === "receipt" ? "#00b06b" : "#1e293b",
                    fontWeight: activeFlowchartMenu === "receipt" ? 600 : 500,
                  }}
                >
                  Thu tiền
                </span>
              </div>

              {activeFlowchartMenu === "receipt" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 240,
                    zIndex: 100,
                    background: "#ffffff",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.06)",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    padding: "4px 0",
                  }}
                  onMouseEnter={() => handleFlowchartMouseEnter("receipt")}
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setVoucherCategoryChoice("cash");
                      setShowCreateVoucher("receipt");
                    }}
                  >
                    Thu tiền
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowCustomerCollection(true);
                    }}
                  >
                    Thu tiền theo hóa đơn
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowMultiCustomerCollection(true);
                    }}
                  >
                    Thu tiền theo hóa đơn nhiều khách hàng
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowInternalTransfer(true);
                    }}
                  >
                    Chuyển tiền nội bộ
                  </button>
                </div>
              )}
            </div>

            {/* Node 2: Đề nghị chi tiền (Left Center) */}
            <div
              style={{
                position: "absolute",
                left: 65,
                top: 185,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
                onClick={() => {
                  if (href) {
                    window.location.hash = href("/reference/cash/payment-requests");
                  }
                  notify("Đã mở phân hệ Đề nghị chi tiền.");
                }}
                title="Lập giấy đề nghị chi tiền"
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "#dcfce7",
                    border: "1px solid #86efac",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect x="7" y="5" width="20" height="26" rx="3" fill="#059669" />
                    <path d="M 11 9 L 20 9 M 11 13 L 23 13 M 11 17 L 23 17 M 11 21 L 18 21" stroke="#a7f3d0" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="15" cy="22" r="4.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.7" />
                    <text x="15" y="24.8" fill="#78350f" fontSize="6.5" fontWeight="900" textAnchor="middle" fontFamily="system-ui, sans-serif">$</text>
                    <circle cx="26.5" cy="26.5" r="6" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
                    <path d="M 23.5 26.5 L 29.5 24 L 27 29.5 L 25.8 27.3 Z" fill="#ffffff" />
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, textAlign: "center", lineHeight: 1.25 }}>
                  Đề nghị chi<br />tiền
                </span>
              </div>
            </div>

            {/* Node 3: Chi tiền (Center Bottom) */}
            <div
              style={{
                position: "absolute",
                left: 270,
                top: 185,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: activeFlowchartMenu === "payment" ? 60 : 10,
              }}
              onMouseEnter={() => handleFlowchartMouseEnter("payment")}
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
                  setActiveFlowchartMenu((prev) => (prev === "payment" ? null : "payment"))
                }
                title="Lập phiếu chi tiền mặt"
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: "#dcfce7",
                    border: "1px solid #86efac",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                  }}
                >
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <rect x="4" y="6" width="30" height="26" rx="4" fill="#059669" />
                    <path d="M 4 10 C 4 7.79 5.79 6 8 6 L 30 6 C 32.21 6 34 7.79 34 10 L 34 14 L 4 14 Z" fill="#047857" />
                    <circle cx="7" cy="10" r="0.9" fill="#a7f3d0" />
                    <circle cx="31" cy="10" r="0.9" fill="#a7f3d0" />
                    <text x="19" y="11.8" fill="#ffffff" fontSize="6.5" fontWeight="900" textAnchor="middle" fontFamily="system-ui, sans-serif">CHI</text>
                    <rect x="9" y="17" width="20" height="12" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                    <circle cx="19" cy="23" r="2.8" fill="#fef3c7" stroke="#d97706" strokeWidth="0.6" />
                    <circle cx="12" cy="23" r="1.1" fill="#d97706" />
                    <circle cx="26" cy="23" r="1.1" fill="#d97706" />
                  </svg>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: activeFlowchartMenu === "payment" ? "#00b06b" : "#1e293b",
                    fontWeight: activeFlowchartMenu === "payment" ? 600 : 500,
                  }}
                >
                  Chi tiền
                </span>
              </div>

              {activeFlowchartMenu === "payment" && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    minWidth: 240,
                    zIndex: 100,
                    background: "#ffffff",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.18), 0 3px 8px rgba(0,0,0,0.06)",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    padding: "4px 0",
                  }}
                  onMouseEnter={() => handleFlowchartMouseEnter("payment")}
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setVoucherCategoryChoice("cash");
                      setShowCreateVoucher("payment");
                    }}
                  >
                    Chi tiền
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowSupplierPayment(true);
                    }}
                  >
                    Trả tiền theo hóa đơn
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowTaxModal(true);
                    }}
                  >
                    Nộp thuế
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowInsuranceModal(true);
                    }}
                  >
                    Nộp bảo hiểm
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowSalaryModal(true);
                    }}
                  >
                    Trả lương
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
                    onClick={() => {
                      setActiveFlowchartMenu(null);
                      setShowInternalTransfer(true);
                    }}
                  >
                    Chuyển tiền nội bộ
                  </button>
                </div>
              )}
            </div>

            {/* Node 4: Kiểm kê quỹ (Right Center) */}
            <div
              style={{
                position: "absolute",
                left: 490,
                top: 120,
                width: 100,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "center",
                zIndex: 10,
              }}
              onClick={() => {
                if (href) {
                  window.location.hash = href("/reference/cash/inventory");
                }
                notify("Đã mở phân hệ Kiểm kê quỹ tiền mặt.");
              }}
              title="Kiểm kê quỹ tiền mặt"
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 4px 10px rgba(16, 185, 129, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.04)";
                }}
              >
                <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                  <rect x="6" y="5" width="20" height="26" rx="3" fill="#059669" />
                  <rect x="11.5" y="3" width="9" height="3.5" rx="1.2" fill="#047857" stroke="#a7f3d0" strokeWidth="0.6" />
                  <path d="M 9 11 L 11 13 L 13.5 9.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 9 16.5 L 11 18.5 L 13.5 15" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 9 22 L 11 24 L 13.5 20.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="16.5" y="14" width="16" height="19" rx="2.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" />
                  <rect x="18.5" y="16" width="12" height="3.8" rx="1" fill="#fef3c7" stroke="#d97706" strokeWidth="0.5" />
                  <circle cx="20.5" cy="23" r="0.9" fill="#78350f" />
                  <circle cx="24.5" cy="23" r="0.9" fill="#78350f" />
                  <circle cx="28.5" cy="23" r="0.9" fill="#78350f" />
                  <circle cx="20.5" cy="26.5" r="0.9" fill="#78350f" />
                  <circle cx="24.5" cy="26.5" r="0.9" fill="#78350f" />
                  <circle cx="28.5" cy="26.5" r="0.9" fill="#78350f" />
                  <rect x="19.5" y="29.5" width="10" height="1.8" rx="0.7" fill="#d97706" />
                </svg>
              </div>
              <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, lineHeight: 1.3 }}>
                Kiểm kê quỹ
              </span>
            </div>
          </div>
        </section>

        {/* Panel 2: BÁO CÁO (Right Column - Screenshot 2) */}
        <aside
          className="ref-process-reports"
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
              textAlign: "center",
              margin: 0,
              padding: "14px 10px",
              borderBottom: "1px solid #f1f5f9",
              color: "#1e293b",
              letterSpacing: "0.5px",
            }}
          >
            BÁO CÁO
          </h2>
          <ul
            style={{
              padding: "8px 16px",
              margin: 0,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              listStyle: "none",
            }}
          >
            {[
              "Bảng kê số dư tiền theo ngày",
              "Dòng tiền",
              "S03a1 - DN: Sổ nhật ký thu tiền",
              "Sổ kế toán chi tiết quỹ tiền mặt",
              "S03a2 - DN: Sổ nhật ký chi tiền",
            ].map((repName) => (
              <li
                key={repName}
                style={{
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  minHeight: 46,
                  fontSize: 12,
                  color: "#334155",
                  padding: "6px 0 6px 14px",
                  position: "relative",
                  cursor: "pointer",
                }}
                onClick={() => notify(`Mở báo cáo: ${repName}`)}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#000000",
                  }}
                />
                <span style={{ transition: "color 0.15s ease" }} className="hover-link">
                  {repName}
                </span>
              </li>
            ))}
          </ul>
          <div
            style={{
              textAlign: "center",
              padding: "12px",
              borderTop: "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                color: "#0284c7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => notify("Mở tất cả báo cáo tiền mặt...")}
            >
              Tất cả báo cáo
            </span>
          </div>
        </aside>

        {/* Panel 3: Master Data / Shortcuts (Screenshot 2 - Exactly 4 buttons) */}
        <div
          className="ref-shortcuts"
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            position: "relative",
            zIndex: 1,
          }}
        >
          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => setShowCustomerCollection(true)}
          >
            <UserRound size={20} style={{ color: "#f59e0b" }} />
            <span>Khách hàng</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => setShowSupplierPayment(true)}
          >
            <Building2 size={20} style={{ color: "#00b06b" }} />
            <span>Nhà cung cấp</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              borderRight: "1px solid #f1f5f9",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => notify("Mở danh mục Nhân viên...")}
          >
            <Users size={20} style={{ color: "#10b981" }} />
            <span>Nhân viên</span>
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 8px",
              background: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "#334155",
            }}
            onClick={() => notify("Tùy chọn thiết lập phân hệ Tiền mặt...")}
          >
            <SlidersHorizontal size={20} style={{ color: "#f59e0b" }} />
            <span>Tùy chọn</span>
          </button>
        </div>

        {/* Panel 4: AMIS Quy trình Banner & Featured Stories (Screenshot 2) */}
        <div
          style={{
            gridColumn: "1 / -1",
            background: "linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          {/* Top Banner Row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #06b6d4, #0284c7)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 20,
                  boxShadow: "0 2px 4px rgba(6,182,212,0.3)",
                  flexShrink: 0,
                }}
              >
                Q
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>
                  AMIS Quy trình
                </strong>
                <span style={{ fontSize: 12, color: "#475569" }}>
                  Giảm tải công việc kế toán bằng cách số hóa phê duyệt đề nghị thanh toán, tạm ứng và tự động sinh chứng từ.
                </span>
              </div>
            </div>

            <button
              type="button"
              style={{
                background: "#00b06b",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 3px rgba(0, 176, 107, 0.3)",
              }}
              onClick={() => notify("Mở thiết lập tự động hóa AMIS Quy trình...")}
            >
              <SlidersHorizontal size={14} />
              Thiết lập tự động
            </button>
          </div>

          {/* Bottom Row: CÂU CHUYỆN SỐ HÓA THÀNH CÔNG NỔI BẬT */}
          <div style={{ paddingTop: 12, borderTop: "1px solid #d1fae5" }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 10,
              }}
            >
              CÂU CHUYỆN SỐ HÓA THÀNH CÔNG NỔI BẬT
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {/* Story 1 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
                onClick={() => notify("Mở bài viết: Doanh nghiệp nhỏ có thể tự động hóa...")}
              >
                <img
                  src="/story_1.jpg"
                  alt="Story 1"
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 6,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <strong
                    style={{
                      fontSize: 11.5,
                      color: "#1e293b",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title="Doanh nghiệp nhỏ có thể tự động hóa nhờ..."
                  >
                    Doanh nghiệp nhỏ có thể tự động hóa nhờ...
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 2,
                    }}
                  >
                    Giảm thời gian duyệt chi, tự động...
                  </span>
                </div>
              </div>

              {/* Story 2 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
                onClick={() => notify("Mở bài viết: Lợi ích của việc tự động hóa quy trình đối v...")}
              >
                <img
                  src="/story_2.jpg"
                  alt="Story 2"
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 6,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <strong
                    style={{
                      fontSize: 11.5,
                      color: "#1e293b",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title="Lợi ích của việc tự động hóa quy trình đối v..."
                  >
                    Lợi ích của việc tự động hóa quy trình đối v...
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 2,
                    }}
                  >
                    Giảm thời gian duyệt chi, tự động...
                  </span>
                </div>
              </div>

              {/* Story 3 */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
                onClick={() => notify("Mở bài viết: Hành trình số hóa quy trình tại Đông Dươn...")}
              >
                <img
                  src="/story_3.jpg"
                  alt="Story 3"
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 6,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <strong
                    style={{
                      fontSize: 11.5,
                      color: "#1e293b",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title="Hành trình số hóa quy trình tại Đông Dươn..."
                  >
                    Hành trình số hóa quy trình tại Đông Dươn...
                  </strong>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: 2,
                    }}
                  >
                    Giải pháp tháo gỡ điểm nghẽn cho kế toán
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTaxModal && (
        <TaxPaymentModal
          onClose={() => setShowTaxModal(false)}
          onSubmit={handleTaxPayment}
        />
      )}

      {showSupplierPayment && (
        <SupplierPaymentModal
          onClose={() => setShowSupplierPayment(false)}
          onSubmit={handleSupplierPayment}
        />
      )}

      {showCustomerCollection && (
        <SingleCustomerInvoiceCollectionModal
          initialMethod="cash"
          onClose={() => setShowCustomerCollection(false)}
          onSubmit={handleCustomerCollection}
        />
      )}

      {showMultiCustomerCollection && (
        <MultiCustomerInvoiceCollectionModal
          initialMethod="cash"
          onClose={() => setShowMultiCustomerCollection(false)}
          onSubmit={handleMultiCustomerCollection}
        />
      )}

      {showInsuranceModal && (
        <InsurancePaymentModal
          onClose={() => setShowInsuranceModal(false)}
          onSubmit={handleInsurancePayment}
        />
      )}

      {showSalaryModal && (
        <SalaryPaymentModal
          onClose={() => setShowSalaryModal(false)}
          onSubmit={handleSalaryPayment}
        />
      )}

      {showInternalTransfer && (
        <InternalTransferModal
          onClose={() => setShowInternalTransfer(false)}
          onSubmit={handleInternalTransfer}
        />
      )}

      {showVoucherPrint && (
        <AccountingVoucherModal
          voucher={selectedVoucher}
          onClose={() => setShowVoucherPrint(false)}
        />
      )}

      {showCreateVoucher && (
        <CreateVoucherModal
          kind={showCreateVoucher}
          voucherCategory={voucherCategoryChoice}
          initialTypeIndex={createVoucherTypeIndex}
          onClose={() => {
            setShowCreateVoucher(null);
            setCreateVoucherTypeIndex(0);
          }}
          onSave={handleSaveVoucher}
        />
      )}

      {showAIModal && (
        <AIAssistantModal
          onClose={() => setShowAIModal(false)}
          onApply={(doc) => {
            setShowAIModal(false);
            handleSaveVoucher(doc);
          }}
        />
      )}
    </div>
  );
}
