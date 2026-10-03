import { useState, useMemo } from "react";
import {
  X,
  HelpCircle,
  ChevronDown,
  Calendar,
  ChevronLeft,
} from "lucide-react";

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

// ============================================================================
// 1. THU TIỀN THEO HÓA ĐƠN (ĐƠN KHÁCH HÀNG - SCREENSHOT 1)
// ============================================================================
export interface SingleCustomerInvoiceCollectionModalProps {
  initialMethod?: "cash" | "bank";
  onClose: () => void;
  onSubmit: (data: {
    payMethod: "cash" | "bank";
    customer: string;
    employee: string;
    collectDate: string;
    totalAmount: number;
    invoices: any[];
  }) => void;
}

export function SingleCustomerInvoiceCollectionModal({
  initialMethod = "bank",
  onClose,
  onSubmit,
}: SingleCustomerInvoiceCollectionModalProps) {
  const [payMethod, setPayMethod] = useState<"cash" | "bank">(initialMethod);
  const [customer, setCustomer] = useState("");
  const [employee, setEmployee] = useState("");
  const [collectDate, setCollectDate] = useState("30/09/2026");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  // Invoices list for this customer
  const [records, setRecords] = useState([
    {
      id: "inv-1",
      voucherDate: "17/02/2023",
      voucherCode: "BH00006",
      invoiceCode: "0000019",
      description: "Bán hàng Bệnh viện Bãi Cháy theo hóa đơn 0000019",
      dueDate: "28/02/2023",
      totalDebt: 19401375,
      remainingDebt: 19401375,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 30 ngày",
      discountRate: "0",
      checked: false,
    },
    {
      id: "inv-2",
      voucherDate: "17/03/2023",
      voucherCode: "BH00013",
      invoiceCode: "0000032",
      description: "Bán hàng Bệnh viện Bãi Cháy theo hóa đơn 0000032",
      dueDate: "17/04/2023",
      totalDebt: 17640000,
      remainingDebt: 17640000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 30 ngày",
      discountRate: "0",
      checked: false,
    },
    {
      id: "inv-3",
      voucherDate: "16/02/2024",
      voucherCode: "BH00021",
      invoiceCode: "213136",
      description: "Bán hàng Bệnh viện Bãi Cháy theo hóa đơn số 213136",
      dueDate: "16/03/2024",
      totalDebt: 1000000,
      remainingDebt: 1000000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT ngay",
      discountRate: "0",
      checked: false,
    },
    {
      id: "inv-4",
      voucherDate: "06/08/2026",
      voucherCode: "BH00038",
      invoiceCode: "",
      description: "Bán hàng Bệnh viện Bãi Cháy",
      dueDate: "06/09/2026",
      totalDebt: 9000000,
      remainingDebt: 9000000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 30 ngày",
      discountRate: "0",
      checked: false,
    },
    {
      id: "inv-5",
      voucherDate: "09/09/2026",
      voucherCode: "BH00044",
      invoiceCode: "",
      description: "Bán hàng Bệnh viện Bãi Cháy",
      dueDate: "09/09/2026",
      totalDebt: 220000000,
      remainingDebt: 220000000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT ngay",
      discountRate: "0",
      checked: false,
    },
  ]);

  // If not fetched yet, records to display can be empty or populated on "Lấy dữ liệu"
  const displayedRecords = useMemo(() => {
    if (!hasFetched) return [];
    if (!searchQuery) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.voucherCode.toLowerCase().includes(q) ||
        r.invoiceCode.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [hasFetched, records, searchQuery]);

  // Toggle row
  const toggleRow = (id: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextChecked = !r.checked;
          return {
            ...r,
            checked: nextChecked,
            collectAmount: nextChecked ? r.remainingDebt : 0,
          };
        }
        return r;
      }),
    );
  };

  // Toggle select all
  const allChecked = useMemo(
    () =>
      displayedRecords.length > 0 && displayedRecords.every((r) => r.checked),
    [displayedRecords],
  );

  const toggleAll = () => {
    const nextVal = !allChecked;
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        checked: nextVal,
        collectAmount: nextVal ? r.remainingDebt : 0,
      })),
    );
  };

  // Row collect amount change
  const handleAmountChange = (id: string, val: string) => {
    const cleanNum = parseInt(val.replace(/\D/g, "") || "0", 10);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const bounded = Math.min(cleanNum, r.remainingDebt);
          return {
            ...r,
            collectAmount: bounded,
            checked: bounded > 0,
          };
        }
        return r;
      }),
    );
  };

  // Quick amount auto allocation
  const handleQuickAmountChange = (val: string) => {
    setQuickAmount(val);
    let remainingToAllocate = parseInt(val.replace(/\D/g, "") || "0", 10);
    setRecords((prev) =>
      prev.map((r) => {
        if (remainingToAllocate <= 0) {
          return { ...r, collectAmount: 0, checked: false };
        }
        const allocated = Math.min(remainingToAllocate, r.remainingDebt);
        remainingToAllocate -= allocated;
        return {
          ...r,
          collectAmount: allocated,
          checked: allocated > 0,
        };
      }),
    );
  };

  // Calculated totals
  const totalDebtSum = useMemo(
    () => displayedRecords.reduce((s, r) => s + r.totalDebt, 0),
    [displayedRecords],
  );
  const totalRemainingSum = useMemo(
    () => displayedRecords.reduce((s, r) => s + r.remainingDebt, 0),
    [displayedRecords],
  );
  const totalCollectedSum = useMemo(
    () =>
      displayedRecords.reduce((s, r) => s + (r.checked ? r.collectAmount : 0), 0),
    [displayedRecords],
  );

  const handleSubmit = () => {
    if (totalCollectedSum <= 0) {
      alert("Vui lòng chọn ít nhất một chứng từ công nợ để thu tiền.");
      return;
    }
    onSubmit({
      payMethod,
      customer,
      employee,
      collectDate,
      totalAmount: totalCollectedSum,
      invoices: displayedRecords.filter((r) => r.checked && r.collectAmount > 0),
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

        {/* Modal Header (Exact Screenshot 1) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">Thu tiền theo hóa đơn</div>
          <div className="misa-invoice-collect-actions">
            <button
              type="button"
              className="misa-invoice-help-link"
              onClick={() => alert("Hướng dẫn sử dụng Thu tiền theo hóa đơn")}
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

        {/* Master Box (Screenshot 1) */}
        <div className="misa-invoice-master-box">
          <div className="misa-invoice-master-left">
            {/* Phương thức thanh toán */}
            <div className="misa-invoice-paymethod-row">
              <span style={{ fontSize: 13, color: "#374151" }}>
                Phương thức thanh toán
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="singleCollectMethod"
                  checked={payMethod === "cash"}
                  onChange={() => setPayMethod("cash")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền mặt</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="singleCollectMethod"
                  checked={payMethod === "bank"}
                  onChange={() => setPayMethod("bank")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền gửi</span>
              </label>
            </div>

            {/* Row 1: Khách hàng (Dropdown) */}
            <div className="misa-invoice-field" style={{ width: "100%", maxWidth: 680 }}>
              <label>Khách hàng</label>
              <div style={{ position: "relative" }}>
                <select
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
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
                  <option value="Bệnh viện Bãi Cháy">Bệnh viện Bãi Cháy</option>
                  <option value="Công ty CP Dược phẩm Sao Thái Dương">Công ty CP Dược phẩm Sao Thái Dương</option>
                  <option value="Bệnh viện Đa khoa Quốc tế Vinmec">Bệnh viện Đa khoa Quốc tế Vinmec</option>
                  <option value="Công ty TNHH Y tế Phương Đông">Công ty TNHH Y tế Phương Đông</option>
                  <option value="Công ty Dịch vụ Vận tải An Bình">Công ty Dịch vụ Vận tải An Bình</option>
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

            {/* Row 2: Nhân viên bán hàng, Ngày thu tiền, Nút Lấy dữ liệu */}
            <div className="misa-invoice-grid-row" style={{ alignItems: "flex-end" }}>
              <div className="misa-invoice-field" style={{ width: 260 }}>
                <label>Nhân viên bán hàng</label>
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
                    <option value="Nguyễn Văn Tuấn">Nguyễn Văn Tuấn</option>
                    <option value="Trần Thị Mai">Trần Thị Mai</option>
                    <option value="Lê Văn Hoàng">Lê Văn Hoàng</option>
                    <option value="Phạm Đức Minh">Phạm Đức Minh</option>
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

              <div className="misa-invoice-field" style={{ width: 150 }}>
                <label>Ngày thu tiền</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
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
                  if (!customer) {
                    setCustomer("Bệnh viện Bãi Cháy");
                  }
                  setHasFetched(true);
                }}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>

          {/* Right Top KPI Total (Screenshot 1: Số thu / 0) */}
          <div className="misa-invoice-master-right">
            <span className="misa-invoice-total-label">Số thu</span>
            <div className="misa-invoice-total-val">
              {formatVND(totalCollectedSum)}
            </div>
          </div>
        </div>

        {/* Table Container (Screenshot 1) */}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

              {/* Nhập số thu quick allocate */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "#374151" }}>Nhập số thu</span>
                <input
                  type="text"
                  value={quickAmount}
                  onChange={(e) => handleQuickAmountChange(e.target.value)}
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

            {/* Table Header and Rows (Exact Screenshot 1) */}
            <div className="misa-invoice-table-wrapper">
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
                    <th style={{ width: 110, textAlign: "center" }}>Ngày chứng từ</th>
                    <th style={{ width: 110 }}>Số chứng từ</th>
                    <th style={{ width: 100 }}>Số hóa đơn</th>
                    <th style={{ minWidth: 260 }}>Diễn giải</th>
                    <th style={{ width: 110, textAlign: "center" }}>Hạn thanh toán</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số phải thu</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số chưa thu</th>
                    <th style={{ width: 130, textAlign: "right" }}>Số thu</th>
                    <th style={{ width: 90, textAlign: "center" }}>TK Phải thu</th>
                    <th style={{ width: 120 }}>Điều khoản TT</th>
                    <th style={{ width: 100, textAlign: "right" }}>Tỷ lệ CK (%)</th>
                  </tr>
                  {/* Summary row directly under Header (Screenshot 2: Cộng) */}
                  <tr className="misa-invoice-summary-row">
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "center", color: "#111827", fontWeight: 700 }}>Cộng</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {hasFetched ? (totalDebtSum === 0 ? "0" : formatVND(totalDebtSum)) : "0"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {hasFetched ? (totalRemainingSum === 0 ? "0" : formatVND(totalRemainingSum)) : "0"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: totalCollectedSum > 0 ? "#00b06b" : "#111827" }}>
                      {hasFetched ? (totalCollectedSum === 0 ? "0" : formatVND(totalCollectedSum)) : "0"}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {!hasFetched || displayedRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        style={{
                          height: 480,
                          background: "#f4f5f8",
                          border: "none",
                        }}
                      />
                    </tr>
                  ) : (
                    displayedRecords.map((r) => (
                      <tr
                        key={r.id}
                        style={{
                          background: r.checked ? "rgba(0, 176, 107, 0.05)" : "#ffffff",
                        }}
                      >
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={r.checked}
                            onChange={() => toggleRow(r.id)}
                            style={{ accentColor: "#00b06b", cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ textAlign: "center", color: "#374151" }}>
                          {r.voucherDate}
                        </td>
                        <td>
                          <span
                            style={{
                              color: "#0284c7",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {r.voucherCode}
                          </span>
                        </td>
                        <td style={{ color: "#374151" }}>{r.invoiceCode || "—"}</td>
                        <td style={{ color: "#111827" }}>{r.description}</td>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>
                          {r.dueDate || "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>
                          {formatVND(r.totalDebt)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>
                          {formatVND(r.remainingDebt)}
                        </td>
                        <td style={{ textAlign: "right", padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={r.collectAmount ? formatVND(r.collectAmount) : "0"}
                            onChange={(e) => handleAmountChange(r.id, e.target.value)}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              textAlign: "right",
                              borderRadius: 4,
                              border: r.checked ? "1px solid #00b06b" : "1px solid #d1d5db",
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: r.checked ? "#00b06b" : "#374151",
                              background: "#ffffff",
                              outline: "none",
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center", color: "#4b5563" }}>
                          {r.account}
                        </td>
                        <td style={{ color: "#6b7280" }}>{r.paymentTerms}</td>
                        <td style={{ textAlign: "right", color: "#6b7280" }}>
                          {r.discountRate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer (Screenshot 1) */}
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
            Thu tiền
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// 2. THU TIỀN THEO HÓA ĐƠN NHIỀU KHÁCH HÀNG (SCREENSHOT 2)
// ============================================================================
export interface MultiCustomerInvoiceCollectionModalProps {
  initialMethod?: "cash" | "bank";
  onClose: () => void;
  onSubmit: (data: {
    payMethod: "cash" | "bank";
    timeRange: string;
    fromDate: string;
    toDate: string;
    employee: string;
    customerGroup: string;
    collectDate: string;
    totalAmount: number;
    invoices: any[];
  }) => void;
}

export function MultiCustomerInvoiceCollectionModal({
  initialMethod = "bank",
  onClose,
  onSubmit,
}: MultiCustomerInvoiceCollectionModalProps) {
  const [payMethod, setPayMethod] = useState<"cash" | "bank">(initialMethod);
  const [timeRange, setTimeRange] = useState("Hôm nay");
  const [fromDate, setFromDate] = useState("30/09/2026");
  const [toDate, setToDate] = useState("30/09/2026");
  const [employee, setEmployee] = useState("");
  const [customerGroup, setCustomerGroup] = useState("");
  const [collectDate, setCollectDate] = useState("30/09/2026");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  // Multi-customer invoices list
  const [records, setRecords] = useState([
    {
      id: "multi-1",
      voucherDate: "17/02/2023",
      voucherCode: "BH00006",
      invoiceCode: "0000019",
      customerCode: "BVBC",
      customerName: "Bệnh viện Bãi Cháy",
      customerGroup: "Bệnh viện công",
      description: "Bán hàng Bệnh viện Bãi Cháy theo hóa đơn 0000019",
      dueDate: "28/02/2023",
      totalDebt: 19401375,
      remainingDebt: 19401375,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 30 ngày",
      discountRate: "0",
      checked: false,
    },
    {
      id: "multi-2",
      voucherDate: "25/04/2026",
      voucherCode: "BH00028",
      invoiceCode: "0000038",
      customerCode: "STD",
      customerName: "Công ty CP Dược phẩm Sao Thái Dương",
      customerGroup: "Đại lý cấp 1",
      description: "Bán dược phẩm thảo dược theo HĐ 0000038",
      dueDate: "25/05/2026",
      totalDebt: 45800000,
      remainingDebt: 45800000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 30 ngày",
      discountRate: "1.5",
      checked: false,
    },
    {
      id: "multi-3",
      voucherDate: "15/06/2026",
      voucherCode: "BH00035",
      invoiceCode: "0000049",
      customerCode: "VMEC",
      customerName: "Bệnh viện Đa khoa Quốc tế Vinmec",
      customerGroup: "Bệnh viện tư",
      description: "Cung cấp vật tư tiêu hao y tế tháng 6",
      dueDate: "15/07/2026",
      totalDebt: 88500000,
      remainingDebt: 88500000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT 15 ngày",
      discountRate: "0",
      checked: false,
    },
    {
      id: "multi-4",
      voucherDate: "10/08/2026",
      voucherCode: "BH00041",
      invoiceCode: "0000057",
      customerCode: "PTD",
      customerName: "Công ty TNHH Y tế Phương Đông",
      customerGroup: "Doanh nghiệp",
      description: "Bán hóa chất xét nghiệm theo hợp đồng KD08",
      dueDate: "10/09/2026",
      totalDebt: 32250000,
      remainingDebt: 32250000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT ngay",
      discountRate: "2.0",
      checked: false,
    },
    {
      id: "multi-5",
      voucherDate: "18/09/2026",
      voucherCode: "BH00045",
      invoiceCode: "0000063",
      customerCode: "ANBINH",
      customerName: "Công ty Dịch vụ Vận tải An Bình",
      customerGroup: "Khách thường",
      description: "Cung cấp trang thiết bị bảo hộ lao động",
      dueDate: "28/09/2026",
      totalDebt: 12600000,
      remainingDebt: 12600000,
      collectAmount: 0,
      account: "131",
      paymentTerms: "TT ngay",
      discountRate: "0",
      checked: false,
    },
  ]);

  const displayedRecords = useMemo(() => {
    if (!hasFetched) return [];
    let list = records;
    if (customerGroup) {
      list = list.filter((r) => r.customerGroup === customerGroup);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.voucherCode.toLowerCase().includes(q) ||
          r.invoiceCode.toLowerCase().includes(q) ||
          r.customerCode.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [hasFetched, records, searchQuery, customerGroup]);

  // Toggle row
  const toggleRow = (id: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextChecked = !r.checked;
          return {
            ...r,
            checked: nextChecked,
            collectAmount: nextChecked ? r.remainingDebt : 0,
          };
        }
        return r;
      }),
    );
  };

  // Toggle select all
  const allChecked = useMemo(
    () =>
      displayedRecords.length > 0 && displayedRecords.every((r) => r.checked),
    [displayedRecords],
  );

  const toggleAll = () => {
    const nextVal = !allChecked;
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        checked: nextVal,
        collectAmount: nextVal ? r.remainingDebt : 0,
      })),
    );
  };

  // Row collect amount change
  const handleAmountChange = (id: string, val: string) => {
    const cleanNum = parseInt(val.replace(/\D/g, "") || "0", 10);
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const bounded = Math.min(cleanNum, r.remainingDebt);
          return {
            ...r,
            collectAmount: bounded,
            checked: bounded > 0,
          };
        }
        return r;
      }),
    );
  };

  // Quick amount auto allocation
  const handleQuickAmountChange = (val: string) => {
    setQuickAmount(val);
    let remainingToAllocate = parseInt(val.replace(/\D/g, "") || "0", 10);
    setRecords((prev) =>
      prev.map((r) => {
        if (remainingToAllocate <= 0) {
          return { ...r, collectAmount: 0, checked: false };
        }
        const allocated = Math.min(remainingToAllocate, r.remainingDebt);
        remainingToAllocate -= allocated;
        return {
          ...r,
          collectAmount: allocated,
          checked: allocated > 0,
        };
      }),
    );
  };

  // Calculated totals
  const totalDebtSum = useMemo(
    () => displayedRecords.reduce((s, r) => s + r.totalDebt, 0),
    [displayedRecords],
  );
  const totalRemainingSum = useMemo(
    () => displayedRecords.reduce((s, r) => s + r.remainingDebt, 0),
    [displayedRecords],
  );
  const totalCollectedSum = useMemo(
    () =>
      displayedRecords.reduce((s, r) => s + (r.checked ? r.collectAmount : 0), 0),
    [displayedRecords],
  );

  const handleSubmit = () => {
    if (totalCollectedSum <= 0) {
      alert("Vui lòng chọn ít nhất một chứng từ công nợ để thu tiền.");
      return;
    }
    onSubmit({
      payMethod,
      timeRange,
      fromDate,
      toDate,
      employee,
      customerGroup,
      collectDate,
      totalAmount: totalCollectedSum,
      invoices: displayedRecords.filter((r) => r.checked && r.collectAmount > 0),
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

        {/* Modal Header (Exact Screenshot 2) */}
        <header className="misa-invoice-collect-header">
          <div className="misa-invoice-collect-title">
            Thu tiền theo hóa đơn nhiều khách hàng
          </div>
          <div className="misa-invoice-collect-actions">
            <button
              type="button"
              className="misa-invoice-help-link"
              onClick={() =>
                alert("Hướng dẫn sử dụng Thu tiền theo hóa đơn nhiều khách hàng")
              }
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

        {/* Master Box (Screenshot 2) */}
        <div className="misa-invoice-master-box">
          <div className="misa-invoice-master-left">
            {/* Phương thức thanh toán */}
            <div className="misa-invoice-paymethod-row">
              <span style={{ fontSize: 13, color: "#374151" }}>
                Phương thức thanh toán
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="multiCollectMethod"
                  checked={payMethod === "cash"}
                  onChange={() => setPayMethod("cash")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền mặt</span>
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="multiCollectMethod"
                  checked={payMethod === "bank"}
                  onChange={() => setPayMethod("bank")}
                  style={{ accentColor: "#00b06b", cursor: "pointer" }}
                />
                <span>Tiền gửi</span>
              </label>
            </div>

            {/* Row 1: Thời gian, Từ ngày, Đến ngày */}
            <div className="misa-invoice-grid-row">
              <div className="misa-invoice-field" style={{ width: 220 }}>
                <label>Thời gian</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={timeRange}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTimeRange(val);
                      if (val === "Hôm nay") {
                        setFromDate("30/09/2026");
                        setToDate("30/09/2026");
                      } else if (val === "Tuần này") {
                        setFromDate("28/09/2026");
                        setToDate("04/10/2026");
                      } else if (val === "Tháng này") {
                        setFromDate("01/09/2026");
                        setToDate("30/09/2026");
                      } else if (val === "Quý này") {
                        setFromDate("01/07/2026");
                        setToDate("30/09/2026");
                      } else if (val === "Năm nay") {
                        setFromDate("01/01/2026");
                        setToDate("31/12/2026");
                      }
                    }}
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
                    <option value="Hôm nay">Hôm nay</option>
                    <option value="Tuần này">Tuần này</option>
                    <option value="Tháng này">Tháng này</option>
                    <option value="Quý này">Quý này</option>
                    <option value="Năm nay">Năm nay</option>
                    <option value="Tùy chọn">Tùy chọn</option>
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

              <div className="misa-invoice-field" style={{ width: 150 }}>
                <label>Từ ngày</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
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

              <div className="misa-invoice-field" style={{ width: 150 }}>
                <label>Đến ngày</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
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
            </div>

            {/* Row 2: Nhân viên bán hàng, Nhóm khách hàng */}
            <div className="misa-invoice-grid-row">
              <div className="misa-invoice-field" style={{ width: 220 }}>
                <label>Nhân viên bán hàng</label>
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
                    <option value="Nguyễn Văn Tuấn">Nguyễn Văn Tuấn</option>
                    <option value="Trần Thị Mai">Trần Thị Mai</option>
                    <option value="Lê Văn Hoàng">Lê Văn Hoàng</option>
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

              <div className="misa-invoice-field" style={{ width: 314 }}>
                <label>Nhóm khách hàng</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={customerGroup}
                    onChange={(e) => setCustomerGroup(e.target.value)}
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
                    <option value="Bệnh viện công">Bệnh viện công</option>
                    <option value="Bệnh viện tư">Bệnh viện tư</option>
                    <option value="Đại lý cấp 1">Đại lý cấp 1</option>
                    <option value="Doanh nghiệp">Doanh nghiệp</option>
                    <option value="Khách thường">Khách thường</option>
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
            </div>

            {/* Row 3: Ngày thu tiền, Nút Lấy dữ liệu */}
            <div className="misa-invoice-grid-row" style={{ alignItems: "flex-end" }}>
              <div className="misa-invoice-field" style={{ width: 220 }}>
                <label>Ngày thu tiền</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={collectDate}
                    onChange={(e) => setCollectDate(e.target.value)}
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
                onClick={() => setHasFetched(true)}
              >
                Lấy dữ liệu
              </button>
            </div>
          </div>

          {/* Right Top KPI Total (Screenshot 2: Số thu / 0) */}
          <div className="misa-invoice-master-right">
            <span className="misa-invoice-total-label">Số thu</span>
            <div className="misa-invoice-total-val">
              {formatVND(totalCollectedSum)}
            </div>
          </div>
        </div>

        {/* Table Container (Screenshot 2) */}
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
                  placeholder="Nhập từ khóa tìm kiếm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

              {/* Nhập số thu */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "#374151" }}>Nhập số thu</span>
                <input
                  type="text"
                  value={quickAmount}
                  onChange={(e) => handleQuickAmountChange(e.target.value)}
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

            {/* Table Header and Rows (Exact Screenshot 2) */}
            <div className="misa-invoice-table-wrapper">
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
                    <th style={{ width: 110, textAlign: "center" }}>Ngày chứng từ</th>
                    <th style={{ width: 110 }}>Số chứng từ</th>
                    <th style={{ width: 100 }}>Số hóa đơn</th>
                    <th style={{ width: 110 }}>Mã khách hàng</th>
                    <th style={{ width: 220 }}>Tên khách hàng</th>
                    <th style={{ width: 140 }}>Nhóm khách hàng</th>
                    <th style={{ minWidth: 260 }}>Diễn giải</th>
                    <th style={{ width: 110, textAlign: "center" }}>Hạn thanh toán</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số phải thu</th>
                    <th style={{ width: 120, textAlign: "right" }}>Số chưa thu</th>
                    <th style={{ width: 130, textAlign: "right" }}>Số thu</th>
                    <th style={{ width: 90, textAlign: "center" }}>TK Phải thu</th>
                    <th style={{ width: 120 }}>Điều khoản TT</th>
                    <th style={{ width: 100, textAlign: "right" }}>Tỷ lệ CK (%)</th>
                  </tr>
                  {/* Summary row directly under Header (Screenshot 3: Tổng) */}
                  <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "center", color: "#111827", fontWeight: 700 }}>Tổng</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {hasFetched ? (totalDebtSum === 0 ? "0" : formatVND(totalDebtSum)) : ""}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {hasFetched ? (totalRemainingSum === 0 ? "0" : formatVND(totalRemainingSum)) : ""}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: totalCollectedSum > 0 ? "#00b06b" : "#111827" }}>
                      {hasFetched ? (totalCollectedSum === 0 ? "0" : formatVND(totalCollectedSum)) : ""}
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                </thead>
                <tbody>
                  {!hasFetched || displayedRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={15}
                        style={{
                          height: 480,
                          background: "#f4f5f8",
                          border: "none",
                        }}
                      />
                    </tr>
                  ) : (
                    displayedRecords.map((r) => (
                      <tr
                        key={r.id}
                        style={{
                          background: r.checked ? "rgba(0, 176, 107, 0.05)" : "#ffffff",
                        }}
                      >
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={r.checked}
                            onChange={() => toggleRow(r.id)}
                            style={{ accentColor: "#00b06b", cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ textAlign: "center", color: "#374151" }}>
                          {r.voucherDate}
                        </td>
                        <td>
                          <span
                            style={{
                              color: "#0284c7",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            {r.voucherCode}
                          </span>
                        </td>
                        <td style={{ color: "#374151" }}>{r.invoiceCode || "—"}</td>
                        <td style={{ fontWeight: 600, color: "#0284c7" }}>{r.customerCode}</td>
                        <td style={{ color: "#111827" }}>{r.customerName}</td>
                        <td style={{ color: "#4b5563" }}>{r.customerGroup}</td>
                        <td style={{ color: "#111827" }}>{r.description}</td>
                        <td style={{ textAlign: "center", color: "#6b7280" }}>
                          {r.dueDate || "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>
                          {formatVND(r.totalDebt)}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>
                          {formatVND(r.remainingDebt)}
                        </td>
                        <td style={{ textAlign: "right", padding: "4px 8px" }}>
                          <input
                            type="text"
                            value={r.collectAmount ? formatVND(r.collectAmount) : "0"}
                            onChange={(e) => handleAmountChange(r.id, e.target.value)}
                            style={{
                              width: "100%",
                              height: 26,
                              padding: "0 6px",
                              textAlign: "right",
                              borderRadius: 4,
                              border: r.checked ? "1px solid #00b06b" : "1px solid #d1d5db",
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: r.checked ? "#00b06b" : "#374151",
                              background: "#ffffff",
                              outline: "none",
                            }}
                          />
                        </td>
                        <td style={{ textAlign: "center", color: "#4b5563" }}>
                          {r.account}
                        </td>
                        <td style={{ color: "#6b7280" }}>{r.paymentTerms}</td>
                        <td style={{ textAlign: "right", color: "#6b7280" }}>
                          {r.discountRate}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer (Screenshot 2) */}
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
            Thu tiền
          </button>
        </footer>
      </div>
    </div>
  );
}

// Backwards-compatible alias for existing imports
export const CustomerCollectionModal = SingleCustomerInvoiceCollectionModal;
