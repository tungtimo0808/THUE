import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
  Filter,
} from "lucide-react";

export interface MultiUnitRow {
  target: string;
  code: string;
  account?: string;
  expenseItemCode?: string;
  isBold?: boolean;
  indent?: number; // 0, 1, 2, 3
  // Base raw value for unit calculation
  baseValue?: number;
  isTax?: boolean;
  isNetProfit?: boolean;
}

const DEFAULT_ROWS: MultiUnitRow[] = [
  // 1. DOANH THU
  {
    target: "DOANH THU",
    code: "I",
    isBold: true,
    indent: 0,
    baseValue: 20000000,
  },
  {
    target: "Doanh thu từ bán hàng hóa và cung cấp dịch vụ",
    code: "I.1",
    account: "511",
    isBold: true,
    indent: 0,
    baseValue: 20000000,
  },
  {
    target: "Doanh thu bán hàng",
    code: "I.1.1",
    account: "5111",
    isBold: false,
    indent: 1,
    baseValue: 20000000,
  },
  {
    target: "Các khoản giảm trừ doanh thu",
    code: "I.2",
    isBold: true,
    indent: 0,
  },
  {
    target: "Doanh thu tài chính",
    code: "I.3",
    isBold: true,
    indent: 0,
  },
  {
    target: "Thu nhập khác",
    code: "I.4",
    isBold: true,
    indent: 0,
  },

  // 2. CHI PHÍ
  {
    target: "CHI PHÍ",
    code: "II",
    isBold: true,
    indent: 0,
    baseValue: 12525000,
  },
  {
    target: "Giá vốn hàng bán",
    code: "II.1",
    isBold: true,
    indent: 0,
    baseValue: 12525000,
  },
  {
    target: "<<Khác>>",
    code: "II.1.1",
    account: "632",
    isBold: false,
    indent: 1,
    baseValue: 12525000,
  },
  {
    target: "Chi phí bán hàng và QLDN",
    code: "II.2",
    isBold: true,
    indent: 0,
  },
  {
    target: "Chi phí tài chính",
    code: "II.3",
    isBold: true,
    indent: 0,
  },
  {
    target: "Chi phí khác",
    code: "II.4",
    isBold: true,
    indent: 0,
  },

  // 3. LỢI NHUẬN
  {
    target: "LỢI NHUẬN",
    code: "III",
    isBold: true,
    indent: 0,
  },
  {
    target: "Tổng lợi nhuận trước thuế (I - II)",
    code: "III.1",
    isBold: true,
    indent: 0,
    baseValue: 7475000,
  },
  {
    target: "Lợi nhuận từ việc bán hàng và cung cấp dịch vụ (I.1 - I.2 - II.1 - II.2)",
    code: "III.1.1",
    isBold: false,
    indent: 1,
    baseValue: 7475000,
  },
  {
    target: "Trong đó: Lợi nhuận gộp (I.1 - I.2 - II.1)",
    code: "III.1.1.1",
    isBold: false,
    indent: 2,
    baseValue: 7475000,
  },
  {
    target: "Lợi nhuận tài chính (I.3 - II.3)",
    code: "III.1.2",
    isBold: false,
    indent: 1,
  },
  {
    target: "Lợi nhuận khác (I.4 - II.4)",
    code: "III.1.3",
    isBold: false,
    indent: 1,
  },
  {
    target: "Thuế TNDN",
    code: "III.2",
    isBold: true,
    indent: 0,
    isTax: true,
  },
  {
    target: "Lợi nhuận sau thuế (III.1 - III.2)",
    code: "III.3",
    isBold: true,
    indent: 0,
    isNetProfit: true,
  },
];

export interface UnitItem {
  code: string;
  name: string;
  level: number;
  selected: boolean;
}

const DEFAULT_UNITS: UnitItem[] = [
  { code: "81ehd8ngkphy", name: "Tung", level: 1, selected: true },
  { code: "81ehd8ngkphy_01", name: "Tung", level: 2, selected: false },
];

export interface MisaMultiUnitRevenueExpenseReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiUnitRevenueExpenseReport({
  onBack,
  notify,
}: MisaMultiUnitRevenueExpenseReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodPreset, setPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [expenseAnalysisMethod, setExpenseAnalysisMethod] = useState<"item" | "account">("item");
  const [expenseItemLevel, setExpenseItemLevel] = useState("1");
  const [taxRate, setTaxRate] = useState(20.0);
  const [units, setUnits] = useState<UnitItem[]>(DEFAULT_UNITS);

  // Temporary drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftExpenseAnalysisMethod, setDraftExpenseAnalysisMethod] = useState<"item" | "account">("item");
  const [draftExpenseItemLevel, setDraftExpenseItemLevel] = useState("1");
  const [draftTaxRate, setDraftTaxRate] = useState(20.0);
  const [draftUnits, setDraftUnits] = useState<UnitItem[]>(DEFAULT_UNITS);
  const [unitSearch, setUnitSearch] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(periodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftExpenseAnalysisMethod(expenseAnalysisMethod);
    setDraftExpenseItemLevel(expenseItemLevel);
    setDraftTaxRate(taxRate);
    setDraftUnits([...units]);
    setUnitSearch("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setExpenseAnalysisMethod(draftExpenseAnalysisMethod);
    setExpenseItemLevel(draftExpenseItemLevel);
    setTaxRate(draftTaxRate);
    setUnits([...draftUnits]);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo đơn vị.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftExpenseAnalysisMethod("item");
    setDraftExpenseItemLevel("1");
    setDraftTaxRate(20.0);
    setDraftUnits(DEFAULT_UNITS.map((u) => ({ ...u, selected: u.code === "81ehd8ngkphy" })));
  };

  const toggleSelectAllUnits = (checked: boolean) => {
    setDraftUnits((prev) => prev.map((u) => ({ ...u, selected: checked })));
  };

  const toggleSelectUnit = (code: string) => {
    setDraftUnits((prev) =>
      prev.map((u) => (u.code === code ? { ...u, selected: !u.selected } : u))
    );
  };

  // Selected units in main view
  const selectedUnits = useMemo(() => {
    const list = units.filter((u) => u.selected);
    return list.length > 0 ? list : [DEFAULT_UNITS[0]];
  }, [units]);

  // Format currency helper
  const formatCell = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    if (val < 0) return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    return val.toLocaleString("vi-VN");
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return DEFAULT_ROWS;
    const kw = searchKeyword.toLowerCase();
    return DEFAULT_ROWS.filter(
      (r) =>
        r.target.toLowerCase().includes(kw) ||
        r.code.toLowerCase().includes(kw) ||
        (r.account && r.account.includes(kw))
    );
  }, [searchKeyword]);

  // Unit display title
  const currentUnitTitle = useMemo(() => {
    return selectedUnits.map((u) => u.name).join(", ") || "Tung";
  }, [selectedUnits]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#ffffff",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Header Bar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#334155",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 4,
            }}
            title="Quay lại danh mục báo cáo"
          >
            <ChevronLeft size={20} />
          </button>
          <h2
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo đơn vị
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                height: 30,
                width: 180,
                padding: "0 10px 0 30px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Nạp lại"
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email...")}
          >
            <Mail size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Phản hồi"
            onClick={() => notify?.("Mở phản hồi...")}
          >
            <MessageCircle size={15} />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="In"
            onClick={() => window.print()}
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "3px 8px",
              color: "#334155",
              cursor: "pointer",
            }}
            title="Xuất khẩu Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <span style={{ fontSize: 12, fontWeight: 700 }}>XLS</span>
            <ChevronDown size={13} color="#64748b" />
          </button>

          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Tùy chỉnh cột"
            onClick={() => notify?.("Mở cấu hình cột...")}
          >
            <Settings size={15} />
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Xem danh sách báo cáo đã lưu...")}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu mẫu báo cáo thành công.")}
          >
            Lưu báo cáo
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 18px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
            onClick={handleOpenDrawer}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Subtitle matching Screenshot 2 */}
      <div style={{ textAlign: "center", padding: "14px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Đơn vị: {currentUnitTitle}, Tháng 10 năm 2026
        </h3>
      </div>

      {/* 3. Table Container matching Screenshot 2 & 3 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "35%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Chỉ tiêu</span>
                    <Filter size={13} color="#64748b" style={{ cursor: "pointer" }} />
                  </div>
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: 70,
                  }}
                >
                  Mã số
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: 90,
                  }}
                >
                  Tài khoản
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: 160,
                  }}
                >
                  Mã khoản mục chi phí
                </th>

                {/* Units columns matching Screenshot 2 */}
                {selectedUnits.map((u) => (
                  <th
                    key={u.code}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 140,
                    }}
                  >
                    {u.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                // Compute value dynamically
                let val = row.baseValue;
                const profitBeforeTax = 7475000;
                const calcTax = Math.round((profitBeforeTax * taxRate) / 100);
                const calcNetProfit = profitBeforeTax - calcTax;

                if (row.isTax) {
                  val = calcTax;
                } else if (row.isNetProfit) {
                  val = calcNetProfit;
                }

                return (
                  <tr
                    key={idx}
                    style={{
                      background: "#ffffff",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    {/* Chỉ tiêu (Sticky) */}
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        zIndex: 1,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        paddingLeft: 12 + (row.indent || 0) * 16,
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {row.target}
                    </td>

                    {/* Mã số */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 10px",
                        textAlign: "center",
                        fontWeight: row.isBold ? 700 : 400,
                        color: row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {row.code}
                    </td>

                    {/* Tài khoản */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 10px",
                        textAlign: "center",
                        color: "#334155",
                      }}
                    >
                      {row.account || ""}
                    </td>

                    {/* Mã khoản mục chi phí */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        color: "#334155",
                      }}
                    >
                      {row.expenseItemCode || ""}
                    </td>

                    {/* Units columns */}
                    {selectedUnits.map((u) => (
                      <td
                        key={u.code}
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {formatCell(val)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Table Pagination matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          fontSize: 12.5,
          color: "#475569",
        }}
      >
        <div>Tổng số: {filteredRows.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Số dòng/trang</span>
          <select
            defaultValue={20}
            style={{
              padding: "3px 8px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              background: "#ffffff",
              outline: "none",
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ cursor: "pointer", color: "#94a3b8" }}>&lt;</span>
            <span
              style={{
                padding: "2px 8px",
                background: "#00a862",
                color: "#ffffff",
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              1
            </span>
            <span style={{ cursor: "pointer", color: "#94a3b8" }}>&gt;</span>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(0, 0, 0, 0.45)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 540,
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle size={18} color="#64748b" style={{ cursor: "pointer" }} />
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {/* Kỳ báo cáo * */}
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={draftPeriodPreset}
                    onChange={(e) => setDraftPeriodPreset(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                      color: "#0f172a",
                    }}
                  >
                    <option value="Tháng này">Tháng này</option>
                    <option value="Tháng trước">Tháng trước</option>
                    <option value="Quý này">Quý này</option>
                    <option value="Năm nay">Năm nay</option>
                    <option value="Tùy chọn">Tùy chọn</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Từ ngày
                  </label>
                  <input
                    type="text"
                    value={draftFromDate}
                    onChange={(e) => setDraftFromDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Đến ngày
                  </label>
                  <input
                    type="text"
                    value={draftToDate}
                    onChange={(e) => setDraftToDate(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Chi phí phân tích theo radio */}
              <div>
                <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                  Chi phí phân tích theo
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13, color: "#334155" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="expenseMethod"
                      checked={draftExpenseAnalysisMethod === "item"}
                      onChange={() => setDraftExpenseAnalysisMethod("item")}
                    />
                    Khoản mục chi phí
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="expenseMethod"
                      checked={draftExpenseAnalysisMethod === "account"}
                      onChange={() => setDraftExpenseAnalysisMethod("account")}
                    />
                    Tài khoản chi phí
                  </label>
                </div>
              </div>

              {/* Cấp khoản mục chi phí */}
              <div>
                <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                  Cấp khoản mục chi phí
                </label>
                <select
                  value={draftExpenseItemLevel}
                  onChange={(e) => setDraftExpenseItemLevel(e.target.value)}
                  style={{
                    width: 140,
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    outline: "none",
                  }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="all">Tất cả</option>
                </select>
              </div>

              {/* Thuế suất thuế TNDN */}
              <div>
                <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                  Thuế suất thuế TNDN
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    value={draftTaxRate}
                    onChange={(e) => setDraftTaxRate(Number(e.target.value))}
                    style={{
                      width: 140,
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#334155" }}>%</span>
                </div>
              </div>

              {/* Unit Table Selection matching Screenshot 1 */}
              <div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <div style={{ position: "relative", width: 220 }}>
                    <Search size={14} style={{ position: "absolute", right: 8, top: 9, color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e2f0d9" }}>
                        <th style={{ width: 36, padding: "6px 8px", textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>
                          <input
                            type="checkbox"
                            checked={draftUnits.every((u) => u.selected)}
                            onChange={(e) => toggleSelectAllUnits(e.target.checked)}
                          />
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          Mã đơn vị
                        </th>
                        <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          Tên đơn vị
                        </th>
                        <th style={{ width: 60, padding: "6px 10px", textAlign: "center", fontWeight: 700, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                          Bậc
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftUnits
                        .filter(
                          (u) =>
                            !unitSearch ||
                            u.code.toLowerCase().includes(unitSearch.toLowerCase()) ||
                            u.name.toLowerCase().includes(unitSearch.toLowerCase())
                        )
                        .map((u) => (
                          <tr key={u.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ textAlign: "center", padding: "6px 8px" }}>
                              <input
                                type="checkbox"
                                checked={u.selected}
                                onChange={() => toggleSelectUnit(u.code)}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", paddingLeft: u.level === 2 ? 24 : 10, color: "#1e293b" }}>
                              {u.level === 1 ? `[-] ${u.code}` : u.code}
                            </td>
                            <td style={{ padding: "6px 10px", color: "#334155" }}>{u.name}</td>
                            <td style={{ textAlign: "center", padding: "6px 10px", color: "#64748b" }}>
                              {u.level}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={handleResetParams}
                style={{
                  height: 32,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyParams}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
