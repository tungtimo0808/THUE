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
} from "lucide-react";

export interface MultiPeriodRevenueExpenseRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1, 2, 3
  isUppercase?: boolean;
  valueMonth10?: number;
}

const DEFAULT_ROWS: MultiPeriodRevenueExpenseRow[] = [
  // I. DOANH THU
  {
    target: "DOANH THU",
    code: "I",
    isBold: true,
    indent: 0,
    isUppercase: true,
    valueMonth10: 20000000,
  },
  {
    target: "Doanh thu từ bán hàng hóa và cung cấp dịch vụ",
    code: "I.1",
    isBold: true,
    indent: 1,
    valueMonth10: 20000000,
  },
  {
    target: "Doanh thu bán hàng",
    code: "I.1.1",
    isBold: false,
    indent: 2,
    valueMonth10: 20000000,
  },
  {
    target: "Các khoản giảm trừ doanh thu",
    code: "I.2",
    isBold: true,
    indent: 1,
  },
  {
    target: "Doanh thu tài chính",
    code: "I.3",
    isBold: true,
    indent: 1,
  },
  {
    target: "Thu nhập khác",
    code: "I.4",
    isBold: true,
    indent: 1,
  },

  // II. CHI PHÍ
  {
    target: "CHI PHÍ",
    code: "II",
    isBold: true,
    indent: 0,
    isUppercase: true,
    valueMonth10: 12525000,
  },
  {
    target: "Giá vốn hàng bán",
    code: "II.1",
    isBold: true,
    indent: 1,
    valueMonth10: 12525000,
  },
  {
    target: "Chi phí theo khoản mục chi phí",
    code: "II.2",
    isBold: true,
    indent: 1,
  },
  {
    target: "Chi phí tài chính",
    code: "II.3",
    isBold: true,
    indent: 1,
  },
  {
    target: "Chi phí khác",
    code: "II.4",
    isBold: true,
    indent: 1,
  },

  // III. LỢI NHUẬN
  {
    target: "LỢI NHUẬN",
    code: "III",
    isBold: true,
    indent: 0,
    isUppercase: true,
  },
  {
    target: "Tổng lợi nhuận trước thuế (I - II)",
    code: "III.1",
    isBold: true,
    indent: 1,
    valueMonth10: 7475000,
  },
  {
    target: "Lợi nhuận từ việc bán hàng và cung cấp dịch vụ (I.1 - I.2 - II.1 - II.2)",
    code: "III.1.1",
    isBold: false,
    indent: 2,
    valueMonth10: 7475000,
  },
  {
    target: "Trong đó: Lợi nhuận gộp (I.1 - I.2 - II.1)",
    code: "III.1.1.1",
    isBold: false,
    indent: 3,
    valueMonth10: 7475000,
  },
  {
    target: "Lợi nhuận tài chính (I.3 - II.3)",
    code: "III.1.2",
    isBold: false,
    indent: 2,
  },
  {
    target: "Lợi nhuận khác (I.4 - II.4)",
    code: "III.1.3",
    isBold: false,
    indent: 2,
  },
  {
    target: "Thuế TNDN",
    code: "III.2",
    isBold: true,
    indent: 1,
  },
  {
    target: "Lợi nhuận sau thuế (III.1 - III.2)",
    code: "III.3",
    isBold: true,
    indent: 1,
    valueMonth10: 7475000,
  },
];

export interface MisaMultiPeriodRevenueExpenseReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiPeriodRevenueExpenseReport({
  onBack,
  notify,
}: MisaMultiPeriodRevenueExpenseReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [fromMonth, setFromMonth] = useState(10);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);
  const [compareSamePeriodLastYear, setCompareSamePeriodLastYear] = useState(false);
  const [evaluateDiffBetweenPeriods, setEvaluateDiffBetweenPeriods] = useState(false);
  const [expenseItemLevel, setExpenseItemLevel] = useState("1");

  // Temporary drawer draft state
  const [draftPeriodType, setDraftPeriodType] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [draftFromMonth, setDraftFromMonth] = useState(10);
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState(10);
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftCompareSamePeriodLastYear, setDraftCompareSamePeriodLastYear] = useState(false);
  const [draftEvaluateDiffBetweenPeriods, setDraftEvaluateDiffBetweenPeriods] = useState(false);
  const [draftExpenseItemLevel, setDraftExpenseItemLevel] = useState("1");

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodType(periodType);
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftCompareSamePeriodLastYear(compareSamePeriodLastYear);
    setDraftEvaluateDiffBetweenPeriods(evaluateDiffBetweenPeriods);
    setDraftExpenseItemLevel(expenseItemLevel);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodType(draftPeriodType);
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setCompareSamePeriodLastYear(draftCompareSamePeriodLastYear);
    setEvaluateDiffBetweenPeriods(draftEvaluateDiffBetweenPeriods);
    setExpenseItemLevel(draftExpenseItemLevel);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều kỳ.");
  };

  const handleResetParams = () => {
    setDraftPeriodType("month");
    setDraftFromMonth(10);
    setDraftFromYear(2026);
    setDraftToMonth(10);
    setDraftToYear(2026);
    setDraftCompareSamePeriodLastYear(false);
    setDraftEvaluateDiffBetweenPeriods(false);
    setDraftExpenseItemLevel("1");
  };

  // Generate list of periods
  const periods = useMemo(() => {
    const list: string[] = [];
    if (periodType === "month") {
      if (fromYear === toYear) {
        for (let m = fromMonth; m <= toMonth; m++) {
          list.push(`Thg ${m}/${fromYear}`);
        }
      } else {
        list.push(`Thg ${fromMonth}/${fromYear}`);
        list.push(`Thg ${toMonth}/${toYear}`);
      }
    } else if (periodType === "quarter") {
      list.push(`Quý 4/${fromYear}`);
    } else if (periodType === "year") {
      list.push(`Năm ${fromYear}`);
    } else {
      list.push(`Thg ${fromMonth}/${fromYear}`);
    }
    return list;
  }, [periodType, fromMonth, fromYear, toMonth, toYear]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return DEFAULT_ROWS;
    const kw = searchKeyword.toLowerCase();
    return DEFAULT_ROWS.filter(
      (r) => r.target.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw)
    );
  }, [searchKeyword]);

  const formatCell = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    if (val < 0) return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    return val.toLocaleString("vi-VN");
  };

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
            Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều kỳ
          </h2>
        </div>

        {/* Action icons right matching Screenshot 2 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={() => notify?.("Mở gửi email...")}
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
          {fromMonth === toMonth && fromYear === toYear
            ? `Tháng ${fromMonth} năm ${fromYear}`
            : `Từ tháng ${fromMonth}/${fromYear} đến tháng ${toMonth}/${toYear}`}
        </h3>
      </div>

      {/* 3. Table Container matching Screenshot 2 */}
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
              {/* Header Row 1 */}
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  rowSpan={2}
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
                    minWidth: 320,
                  }}
                >
                  Chỉ tiêu
                </th>
                <th
                  rowSpan={2}
                  style={{
                    position: "sticky",
                    left: 320,
                    zIndex: 2,
                    background: "#e2f0d9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 80,
                  }}
                >
                  Mã số
                </th>

                {/* Periods columns */}
                {periods.map((p) => (
                  <th
                    key={p}
                    colSpan={1}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 140,
                    }}
                  >
                    {p}
                  </th>
                ))}

                {/* Compare same period last year if checked */}
                {compareSamePeriodLastYear && (
                  <th
                    colSpan={1}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 140,
                    }}
                  >
                    Thg {toMonth}/{toYear - 1}
                  </th>
                )}
              </tr>

              {/* Header Row 2 Subheaders */}
              <tr style={{ background: "#e2f0d9" }}>
                {periods.map((p) => (
                  <th
                    key={p}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "5px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: 12,
                      minWidth: 140,
                    }}
                  >
                    Giá trị
                  </th>
                ))}
                {compareSamePeriodLastYear && (
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "5px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontSize: 12,
                      minWidth: 140,
                    }}
                  >
                    Giá trị
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
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

                  {/* Mã số (Sticky) */}
                  <td
                    style={{
                      position: "sticky",
                      left: 320,
                      zIndex: 1,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      padding: "7px 10px",
                      textAlign: "center",
                      fontWeight: row.isBold ? 700 : 400,
                      color: row.isBold ? "#0f172a" : "#334155",
                    }}
                  >
                    {row.code}
                  </td>

                  {/* Periods Values */}
                  {periods.map((p) => {
                    const isThg10 = p.includes("10/2026");
                    const val = isThg10 ? row.valueMonth10 : undefined;
                    return (
                      <td
                        key={p}
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
                    );
                  })}

                  {/* Prior year period value */}
                  {compareSamePeriodLastYear && (
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 12px",
                        textAlign: "right",
                        color: "#334155",
                      }}
                    ></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Parameter Drawer matching Screenshot 1 */}
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
              width: 520,
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
                gap: 18,
              }}
            >
              {/* Radio Kỳ */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 8 }}>
                  Kỳ
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13, color: "#334155" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="rePeriodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                    />
                    Tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="rePeriodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                    />
                    Quý
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="rePeriodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                    />
                    Năm
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="rePeriodType"
                      checked={draftPeriodType === "custom"}
                      onChange={() => setDraftPeriodType("custom")}
                    />
                    Tùy chọn
                  </label>
                </div>
              </div>

              {/* Từ tháng / Đến tháng & Năm matching Screenshot 1 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Từ tháng
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={draftFromMonth}
                      onChange={(e) => setDraftFromMonth(Number(e.target.value))}
                      style={{
                        flex: 1,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={draftFromYear}
                      onChange={(e) => setDraftFromYear(Number(e.target.value))}
                      style={{
                        width: 70,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Đến tháng
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={draftToMonth}
                      onChange={(e) => setDraftToMonth(Number(e.target.value))}
                      style={{
                        flex: 1,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={draftToYear}
                      onChange={(e) => setDraftToYear(Number(e.target.value))}
                      style={{
                        width: 70,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Checkboxes matching Screenshot 1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draftCompareSamePeriodLastYear}
                    onChange={(e) => setDraftCompareSamePeriodLastYear(e.target.checked)}
                  />
                  So sánh với cùng kỳ năm trước
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draftEvaluateDiffBetweenPeriods}
                    onChange={(e) => setDraftEvaluateDiffBetweenPeriods(e.target.checked)}
                  />
                  Đánh giá chênh lệch giữa các kỳ
                </label>
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
                    width: 120,
                    height: 32,
                    padding: "0 8px",
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
            </div>

            {/* Footer matching Screenshot 1 */}
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
