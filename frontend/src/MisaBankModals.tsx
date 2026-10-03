import { useState, useMemo } from "react";
import {
  X,
  HelpCircle,
  Calendar,
  ChevronLeft,
  Pin,
  Landmark,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export {
  SingleCustomerInvoiceCollectionModal,
  MultiCustomerInvoiceCollectionModal,
  CustomerCollectionModal,
} from "./MisaInvoiceCollectionModals";

// ======================================================================
// REUSABLE MISA EMPTY STATE (MATCHING SCREENSHOT 2 & 4)
// ======================================================================
export function MisaEmptyState({ text = "Không có dữ liệu" }: { text?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        gap: 12,
        color: "#64748b",
      }}
    >
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
        {/* Sparkle top left */}
        <path d="M12 16L13.2 12L14.4 16L18.4 17.2L14.4 18.4L13.2 22.4L12 18.4L8 17.2Z" fill="#cbd5e1" />
        {/* Sparkle top right */}
        <path d="M48 12L49 9L50 12L53 13L50 14L49 17L48 14L45 13Z" fill="#cbd5e1" />
        {/* Oval shadow */}
        <ellipse cx="30" cy="54" rx="22" ry="3.5" fill="#e2e8f0" />
        {/* Document sheet */}
        <path
          d="M18 10H38L46 18V48C46 49.1 45.1 50 44 50H18C16.9 50 16 49.1 16 48V12C16 10.9 16.9 10 18 10Z"
          fill="#f8fafc"
          stroke="#94a3b8"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Folded corner */}
        <path
          d="M38 10V18H46"
          fill="#e2e8f0"
          stroke="#94a3b8"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Eyes */}
        <circle cx="26" cy="30" r="1.6" fill="#64748b" />
        <circle cx="36" cy="30" r="1.6" fill="#64748b" />
        {/* Smile */}
        <path
          d="M27 35.5C28.2 38 33.8 38 35 35.5"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span style={{ fontSize: 13, color: "#475569" }}>{text}</span>
    </div>
  );
}

// ======================================================================
// 2. NỘP BẢO HIỂM MODAL (MATCHING SCREENSHOT 3)
// ======================================================================
export function InsurancePaymentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    payMethod: "cash" | "bank";
    payDate: string;
    totalAmount: number;
    items?: any[];
  }) => void;
}) {
  const [payMethod, setPayMethod] = useState<"cash" | "bank">("cash");
  const [payDate, setPayDate] = useState("30/09/2026");

  const [items, setItems] = useState<
    { id: string; name: string; due: number; pay: number; checked: boolean }[]
  >([]);

  const handleFetchData = () => {
    setItems([
      { id: "bhxh", name: "Bảo hiểm Xã hội (BHXH - 25.5%)", due: 38250000, pay: 38250000, checked: true },
      { id: "bhyt", name: "Bảo hiểm Y tế (BHYT - 4.5%)", due: 6750000, pay: 6750000, checked: true },
      { id: "bhtn", name: "Bảo hiểm Thất nghiệp (BHTN - 2%)", due: 3000000, pay: 3000000, checked: true },
      { id: "bhtnld", name: "Bảo hiểm TNLĐ - BNN (0.5%)", due: 750000, pay: 750000, checked: true },
    ]);
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const next = !it.checked;
          return { ...it, checked: next, pay: next ? it.due : 0 };
        }
        return it;
      }),
    );
  };

  const updateItemPay = (id: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, "") || "0", 10);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, pay: num } : it)),
    );
  };

  const toggleSelectAll = () => {
    const allChecked = items.length > 0 && items.every((i) => i.checked);
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        checked: !allChecked,
        pay: !allChecked ? it.due : 0,
      })),
    );
  };

  const totalDue = useMemo(
    () => items.reduce((s, it) => s + it.due, 0),
    [items],
  );

  const totalPay = useMemo(
    () => items.reduce((s, it) => s + (it.checked ? it.pay : 0), 0),
    [items],
  );

  const handleSubmit = () => {
    onSubmit({
      payMethod,
      payDate,
      totalAmount: totalPay,
      items: items.filter((i) => i.checked),
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

        {/* Modal Header (Matching Screenshot 3) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">Nộp bảo hiểm</div>
          <div className="misa-invoice-collect-actions">
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

        {/* Master Box (Matching Screenshot 3) */}
        <div className="misa-invoice-master-box" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            {/* Phương thức thanh toán */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ color: "#374151" }}>Phương thức thanh toán</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="insurancePayMethod"
                  checked={payMethod === "cash"}
                  onChange={() => setPayMethod("cash")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền mặt</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="insurancePayMethod"
                  checked={payMethod === "bank"}
                  onChange={() => setPayMethod("bank")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền gửi</span>
              </label>
            </div>

            {/* Ngày nộp bảo hiểm */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Ngày nộp bảo hiểm</span>
              <div style={{ position: "relative", width: 140 }}>
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

            {/* Button Lấy dữ liệu */}
            <button
              type="button"
              className="misa-invoice-fetch-btn"
              onClick={handleFetchData}
            >
              Lấy dữ liệu
            </button>
          </div>
        </div>

        {/* Table Container (Matching Screenshot 3) */}
        <div className="misa-invoice-body">
          <div className="misa-invoice-table-container">
            {/* Title Bar */}
            <div style={{ padding: "10px 14px", background: "#ffffff", borderBottom: "1px solid #cbd5e1" }}>
              <strong style={{ fontSize: 13.5, color: "#111827" }}>Thông tin chi tiết</strong>
            </div>

            {/* Table Wrapper */}
            <div className="misa-invoice-table-wrapper">
              <table className="misa-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((i) => i.checked)}
                        onChange={toggleSelectAll}
                        style={{ accentColor: "#00b06b", cursor: "pointer" }}
                      />
                    </th>
                    <th>Khoản phải nộp</th>
                    <th style={{ width: 220, textAlign: "right" }}>Số phải nộp</th>
                    <th style={{ width: 220, textAlign: "right" }}>Số nộp lần này</th>
                  </tr>
                  {/* Summary row directly under Header (Screenshot 3: Tổng) */}
                  <tr style={{ background: "#e2ece5", fontWeight: 700 }}>
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ fontWeight: 700, color: "#111827" }}>Tổng</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalDue)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalPay)}
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ background: item.checked ? "#f0fdf4" : "#ffffff" }}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item.id)}
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
                          onChange={(e) => updateItemPay(item.id, e.target.value)}
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
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer (Matching Screenshot 3) */}
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
            onClick={handleSubmit}
          >
            Nộp bảo hiểm
          </button>
        </footer>
      </div>
    </div>
  );
}

// ======================================================================
// 3. TRẢ LƯƠNG MODAL (MATCHING SCREENSHOT 4)
// ======================================================================
export function SalaryPaymentModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    payMethod: "cash" | "bank";
    payDate: string;
    totalAmount: number;
    employees?: any[];
  }) => void;
}) {
  const [payMethod, setPayMethod] = useState<"cash" | "bank">("cash");
  const [payDate, setPayDate] = useState("30/09/2026");

  const [records, setRecords] = useState<
    {
      id: string;
      code: string;
      name: string;
      department: string;
      account: string;
      bank: string;
      due: number;
      pay: number;
      checked: boolean;
    }[]
  >([]);

  const handleFetchData = () => {
    setRecords([
      {
        id: "e1",
        code: "NV001",
        name: "Nguyễn Văn An",
        department: "Phòng Kinh doanh",
        account: "0011009847291",
        bank: "Vietcombank",
        due: 28500000,
        pay: 28500000,
        checked: true,
      },
      {
        id: "e2",
        code: "NV002",
        name: "Trương Thị Bình",
        department: "Phòng Kế toán",
        account: "1231000948271",
        bank: "BIDV",
        due: 22000000,
        pay: 22000000,
        checked: true,
      },
      {
        id: "e3",
        code: "NV003",
        name: "Phạm Quốc Cường",
        department: "Phòng Kỹ thuật",
        account: "1903847291827",
        bank: "Techcombank",
        due: 18500000,
        pay: 18500000,
        checked: true,
      },
      {
        id: "e4",
        code: "NV004",
        name: "Lê Thu Hà",
        department: "Phòng Hành chính",
        account: "0451000293817",
        bank: "Vietcombank",
        due: 16000000,
        pay: 16000000,
        checked: true,
      },
    ]);
  };

  const toggleRow = (id: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const next = !r.checked;
          return { ...r, checked: next, pay: next ? r.due : 0 };
        }
        return r;
      }),
    );
  };

  const updatePay = (id: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, "") || "0", 10);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, pay: num } : r)),
    );
  };

  const toggleSelectAll = () => {
    const allChecked = records.length > 0 && records.every((r) => r.checked);
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        checked: !allChecked,
        pay: !allChecked ? r.due : 0,
      })),
    );
  };

  const totalDue = useMemo(
    () => records.reduce((s, r) => s + r.due, 0),
    [records],
  );

  const totalPay = useMemo(
    () => records.reduce((s, r) => s + (r.checked ? r.pay : 0), 0),
    [records],
  );

  const handleSubmit = () => {
    onSubmit({
      payMethod,
      payDate,
      totalAmount: totalPay,
      employees: records.filter((r) => r.checked),
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

        {/* Modal Header (Matching Screenshot 4) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">Trả lương</div>
          <div className="misa-invoice-collect-actions">
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

        {/* Master Box (Matching Screenshot 4) */}
        <div className="misa-invoice-master-box" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            {/* Phương thức thanh toán */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
              <span style={{ color: "#374151" }}>Phương thức thanh toán</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="salaryPayMethod"
                  checked={payMethod === "cash"}
                  onChange={() => setPayMethod("cash")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền mặt</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="salaryPayMethod"
                  checked={payMethod === "bank"}
                  onChange={() => setPayMethod("bank")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền gửi</span>
              </label>
            </div>

            {/* Ngày trả lương */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Ngày trả lương</span>
              <div style={{ position: "relative", width: 140 }}>
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

            {/* Button Lấy dữ liệu */}
            <button
              type="button"
              className="misa-invoice-fetch-btn"
              onClick={handleFetchData}
            >
              Lấy dữ liệu
            </button>
          </div>
        </div>

        {/* Table Container (Matching Screenshot 4) */}
        <div className="misa-invoice-body">
          <div className="misa-invoice-table-container">
            {/* Title Bar */}
            <div style={{ padding: "10px 14px", background: "#ffffff", borderBottom: "1px solid #cbd5e1" }}>
              <strong style={{ fontSize: 13.5, color: "#111827" }}>Thông tin trả lương</strong>
            </div>

            {/* Table Wrapper */}
            <div className="misa-invoice-table-wrapper" style={{ display: "flex", flexDirection: "column" }}>
              <table className="misa-invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={records.length > 0 && records.every((r) => r.checked)}
                        onChange={toggleSelectAll}
                        style={{ accentColor: "#00b06b", cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ width: 130 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Pin size={12} style={{ transform: "rotate(45deg)", color: "#64748b" }} />
                        <span>Mã nhân viên</span>
                      </div>
                    </th>
                    <th style={{ width: 170 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Pin size={12} style={{ transform: "rotate(45deg)", color: "#64748b" }} />
                        <span>Tên nhân viên</span>
                      </div>
                    </th>
                    <th style={{ width: 140 }}>Đơn vị</th>
                    <th style={{ width: 140 }}>Số tài khoản</th>
                    <th style={{ width: 150 }}>Tên ngân hàng</th>
                    <th style={{ width: 140, textAlign: "right" }}>Số còn phải trả</th>
                    <th style={{ width: 140, textAlign: "right" }}>Số trả</th>
                    <th style={{ width: 90, textAlign: "center" }}>Chức năng</th>
                  </tr>
                  {/* Summary row directly under Header (Screenshot 4: Tổng) */}
                  <tr style={{ background: "#e2ece5", fontWeight: 700 }}>
                    <td style={{ textAlign: "center", borderRight: "1px solid #cbd5e1" }}></td>
                    <td style={{ fontWeight: 700, color: "#111827" }}>Tổng</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalDue)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#111827" }}>
                      {formatVND(totalPay)}
                    </td>
                    <td></td>
                  </tr>
                </thead>
                {records.length > 0 && (
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} style={{ background: r.checked ? "#f0fdf4" : "#ffffff" }}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={r.checked}
                            onChange={() => toggleRow(r.id)}
                            style={{ accentColor: "#00b06b", cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ fontWeight: 600, color: "#0284c7" }}>{r.code}</td>
                        <td style={{ fontWeight: 500, color: "#1f2937" }}>{r.name}</td>
                        <td style={{ color: "#4b5563" }}>{r.department}</td>
                        <td style={{ color: "#4b5563" }}>{r.account}</td>
                        <td style={{ color: "#4b5563" }}>{r.bank}</td>
                        <td style={{ textAlign: "right" }}>{formatVND(r.due)}</td>
                        <td style={{ textAlign: "right" }}>
                          <input
                            type="text"
                            value={formatVND(r.pay)}
                            disabled={!r.checked}
                            onChange={(e) => updatePay(r.id, e.target.value)}
                            style={{
                              height: 28,
                              width: 120,
                              padding: "0 8px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db",
                              textAlign: "right",
                              fontSize: 13,
                              background: r.checked ? "#ffffff" : "#f1f5f9",
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#0284c7",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                            onClick={() => alert(`Xem chi tiết bảng lương nhân viên ${r.name}`)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>

              {/* Empty state when no records (Screenshot 4) */}
              {records.length === 0 && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MisaEmptyState text="Không có dữ liệu" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Matching Screenshot 4) */}
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
            onClick={handleSubmit}
          >
            Trả lương
          </button>
        </footer>
      </div>
    </div>
  );
}

// ======================================================================
// 4. CHUYỂN TIỀN NỘI BỘ MODAL (GIỮA CÁC TÀI KHOẢN NGÂN HÀNG HOẶC QUỸ TIỀN MẶT)
// ======================================================================
export function InternalTransferModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    sourceAccount: string;
    targetAccount: string;
    amount: number;
    transferDate: string;
    reason: string;
  }) => void;
}) {
  const [sourceAccount, setSourceAccount] = useState("1028475929 - Vietcombank Hoàn Kiếm (TK 1121)");
  const [targetAccount, setTargetAccount] = useState("2151000849201 - BIDV Hai Bà Trưng (TK 1121)");
  const [amount, setAmount] = useState(50000000);
  const [transferDate, setTransferDate] = useState("2026-09-15");
  const [reason, setReason] = useState("Chuyển tiền nội bộ thanh toán chi phí SXKD");

  return (
    <div className="misa-tax-modal-overlay" role="dialog" aria-modal="true">
      <div className="misa-tax-modal misa-modal-md">
        <header className="misa-tax-modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            Lệnh chuyển tiền nội bộ
          </h2>
          <button className="misa-tax-close-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="misa-tax-modal-body">
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#eff6ff", padding: "10px 14px", borderRadius: 6, border: "1px solid #bfdbfe" }}>
              <Landmark size={20} style={{ color: "#2563eb" }} />
              <span style={{ fontSize: 12, color: "#1e40af" }}>
                Nghiệp vụ chuyển tiền giữa các tài khoản ngân hàng hoặc Rút tiền gửi về nhập quỹ tiền mặt (TK 111 / 112).
              </span>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
                Tài khoản trích tiền (Nguồn đi)
              </label>
              <select
                value={sourceAccount}
                onChange={(e) => setSourceAccount(e.target.value)}
                style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
              >
                <option value="1028475929 - Vietcombank Hoàn Kiếm (TK 1121)">1028475929 - Vietcombank Hoàn Kiếm (TK 1121)</option>
                <option value="2151000849201 - BIDV Hai Bà Trưng (TK 1121)">2151000849201 - BIDV Hai Bà Trưng (TK 1121)</option>
                <option value="1111 - Quỹ tiền mặt">1111 - Quỹ tiền mặt</option>
              </select>
            </div>

            <div style={{ display: "grid", placeItems: "center" }}>
              <ArrowRight size={18} style={{ color: "#00b06b", transform: "rotate(90deg)" }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
                Tài khoản nhận tiền (Đích đến)
              </label>
              <select
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
              >
                <option value="2151000849201 - BIDV Hai Bà Trưng (TK 1121)">2151000849201 - BIDV Hai Bà Trưng (TK 1121)</option>
                <option value="1028475929 - Vietcombank Hoàn Kiếm (TK 1121)">1028475929 - Vietcombank Hoàn Kiếm (TK 1121)</option>
                <option value="1111 - Quỹ tiền mặt">1111 - Quỹ tiền mặt (Rút tiền về quỹ)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
                  Số tiền chuyển (VND)
                </label>
                <input
                  type="text"
                  value={formatVND(amount)}
                  onChange={(e) => setAmount(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
                  style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #00b06b", borderRadius: 4, fontSize: 14, fontWeight: 700, color: "#00b06b" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
                  Ngày chuyển tiền
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4, color: "#374151" }}>
                Nội dung chuyển tiền
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: "100%", height: 34, padding: "0 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13 }}
              />
            </div>
          </div>
        </div>

        <footer className="misa-tax-modal-footer">
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Số tiền chuyển: <strong style={{ fontSize: 18, color: "#00b06b" }}>{formatVND(amount)}đ</strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="misa-btn-secondary" onClick={onClose} style={{ padding: "0 20px", height: 36, borderRadius: 4, border: "1px solid #d1d5db", background: "#ffffff", fontWeight: 600 }}>
              Hủy
            </button>
            <button
              type="button"
              className="misa-btn-primary"
              onClick={() =>
                onSubmit({
                  sourceAccount,
                  targetAccount,
                  amount,
                  transferDate,
                  reason,
                })
              }
              style={{ padding: "0 22px", height: 36, borderRadius: 4, background: "#00b06b", color: "#fff", border: "none", fontWeight: 600, boxShadow: "0 2px 4px rgba(0, 176, 107, 0.25)" }}
            >
              Thực hiện chuyển tiền
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ======================================================================
// 5. NHẬP TỪ EXCEL MODAL (NHẬP CHỨNG TỪ TIỀN GỬI)
// ======================================================================
export function ExcelImportModal({
  onClose,
  onImportSuccess,
}: {
  onClose: () => void;
  onImportSuccess: (count: number) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="misa-tax-modal-overlay" role="dialog" aria-modal="true">
      <div className="misa-tax-modal misa-modal-sm">
        <header className="misa-tax-modal-header">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#111827" }}>
            Nhập khẩu chứng từ tiền gửi từ Excel
          </h2>
          <button className="misa-tax-close-btn" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="misa-tax-modal-body">
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, textAlign: "center" }}>
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "36px 20px",
                background: "#f8fafc",
                cursor: "pointer",
              }}
              onClick={() => setSelectedFile("Bang_ke_sao_ke_tien_gui_thang_9_2026.xlsx")}
            >
              <FileSpreadsheet size={42} style={{ color: "#00b06b", margin: "0 auto 12px auto" }} />
              <h4 style={{ margin: "0 0 6px 0", fontSize: 14, color: "#111827" }}>
                Kéo thả tệp Excel vào đây hoặc <span style={{ color: "#0284c7", textDecoration: "underline" }}>chọn tệp từ máy tính</span>
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                Hỗ trợ định dạng .xlsx, .xls theo mẫu chuẩn kế toán MISA
              </p>
            </div>

            {selectedFile && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#00b06b", fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={16} />
                Đã chọn tệp: {selectedFile} (14 dòng hợp lệ)
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "left" }}>
              <span style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", textDecoration: "underline" }}>
                Tải tệp mẫu Excel chuẩn MISA (.xlsx)
              </span>
            </div>
          </div>
        </div>

        <footer className="misa-tax-modal-footer">
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {selectedFile ? "Sẵn sàng nhập dữ liệu" : "Chưa chọn tệp"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" className="misa-btn-secondary" onClick={onClose} style={{ padding: "0 20px", height: 36, borderRadius: 4, border: "1px solid #d1d5db", background: "#ffffff", fontWeight: 600 }}>
              Hủy
            </button>
            <button
              type="button"
              className="misa-btn-primary"
              disabled={!selectedFile}
              onClick={() => {
                onImportSuccess(14);
                onClose();
              }}
              style={{
                padding: "0 22px",
                height: 36,
                borderRadius: 4,
                background: selectedFile ? "#00b06b" : "#9ca3af",
                color: "#fff",
                border: "none",
                fontWeight: 600,
                cursor: selectedFile ? "pointer" : "not-allowed",
                boxShadow: selectedFile ? "0 2px 4px rgba(0, 176, 107, 0.25)" : "none",
              }}
            >
              Thực hiện nhập khẩu
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
