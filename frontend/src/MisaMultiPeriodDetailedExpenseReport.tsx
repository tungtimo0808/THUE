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

export interface MultiPeriodExpenseRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1, 2
  isUppercase?: boolean;
  type: "cogs" | "sellingAdmin" | "financial" | "other";
  valuesByPeriod?: Record<string, number>;
  samePeriodLastYear?: Record<string, number>;
}

const BASE_ROWS: MultiPeriodExpenseRow[] = [
  {
    target: "GIÁ VỐN HÀNG BÁN",
    code: "I",
    isBold: true,
    indent: 0,
    isUppercase: true,
    type: "cogs",
    valuesByPeriod: {},
    samePeriodLastYear: {},
  },
  {
    target: "CHI PHÍ BÁN HÀNG VÀ QUẢN LÝ DOANH NGHIỆP",
    code: "II",
    isBold: true,
    indent: 0,
    isUppercase: true,
    type: "sellingAdmin",
    valuesByPeriod: {},
    samePeriodLastYear: {},
  },
  {
    target: "CHI PHÍ TÀI CHÍNH",
    code: "III",
    isBold: true,
    indent: 0,
    isUppercase: true,
    type: "financial",
    valuesByPeriod: {},
    samePeriodLastYear: {},
  },
  {
    target: "CHI PHÍ KHÁC",
    code: "IV",
    isBold: true,
    indent: 0,
    isUppercase: true,
    type: "other",
    valuesByPeriod: {},
    samePeriodLastYear: {},
  },
];

export interface MisaMultiPeriodDetailedExpenseReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiPeriodDetailedExpenseReport({
  onBack,
  notify,
}: MisaMultiPeriodDetailedExpenseReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [fromMonth, setFromMonth] = useState(10);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);

  // Chi phí phân tích checkboxes
  const [analysisCOGS, setAnalysisCOGS] = useState(false);
  const [analysisSellingAdmin, setAnalysisSellingAdmin] = useState(true);
  const [sellingAdminMethod, setSellingAdminMethod] = useState("Khoản mục chi phí");
  const [analysisFinancial, setAnalysisFinancial] = useState(false);
  const [analysisOther, setAnalysisOther] = useState(false);

  // Checkbox: So sánh với cùng kỳ năm trước
  const [compareSamePeriodLastYear, setCompareSamePeriodLastYear] = useState(true);

  // Cấp khoản mục chi phí
  const [expenseItemLevel, setExpenseItemLevel] = useState("1");

  // Drawer draft state
  const [draftPeriodType, setDraftPeriodType] = useState<"month" | "quarter" | "year" | "custom">("month");
  const [draftFromMonth, setDraftFromMonth] = useState(10);
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState(10);
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftAnalysisCOGS, setDraftAnalysisCOGS] = useState(false);
  const [draftAnalysisSellingAdmin, setDraftAnalysisSellingAdmin] = useState(true);
  const [draftSellingAdminMethod, setDraftSellingAdminMethod] = useState("Khoản mục chi phí");
  const [draftAnalysisFinancial, setDraftAnalysisFinancial] = useState(false);
  const [draftAnalysisOther, setDraftAnalysisOther] = useState(false);
  const [draftCompareSamePeriodLastYear, setDraftCompareSamePeriodLastYear] = useState(true);
  const [draftExpenseItemLevel, setDraftExpenseItemLevel] = useState("1");

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const handleOpenDrawer = () => {
    setDraftPeriodType(periodType);
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftAnalysisCOGS(analysisCOGS);
    setDraftAnalysisSellingAdmin(analysisSellingAdmin);
    setDraftSellingAdminMethod(sellingAdminMethod);
    setDraftAnalysisFinancial(analysisFinancial);
    setDraftAnalysisOther(analysisOther);
    setDraftCompareSamePeriodLastYear(compareSamePeriodLastYear);
    setDraftExpenseItemLevel(expenseItemLevel);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodType(draftPeriodType);
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setAnalysisCOGS(draftAnalysisCOGS);
    setAnalysisSellingAdmin(draftAnalysisSellingAdmin);
    setSellingAdminMethod(draftSellingAdminMethod);
    setAnalysisFinancial(draftAnalysisFinancial);
    setAnalysisOther(draftAnalysisOther);
    setCompareSamePeriodLastYear(draftCompareSamePeriodLastYear);
    setExpenseItemLevel(draftExpenseItemLevel);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Báo cáo phân tích chi tiết chi phí theo nhiều kỳ.");
  };

  const handleResetParams = () => {
    setDraftPeriodType("month");
    setDraftFromMonth(10);
    setDraftFromYear(2026);
    setDraftToMonth(10);
    setDraftToYear(2026);
    setDraftAnalysisCOGS(false);
    setDraftAnalysisSellingAdmin(true);
    setDraftSellingAdminMethod("Khoản mục chi phí");
    setDraftAnalysisFinancial(false);
    setDraftAnalysisOther(false);
    setDraftCompareSamePeriodLastYear(true);
    setDraftExpenseItemLevel("1");
  };

  // Generate period column headers
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

  // Filter rows based on selected analysis checkboxes
  const displayedRows = useMemo(() => {
    return BASE_ROWS.filter((r) => {
      if (r.type === "cogs" && !analysisCOGS) return false;
      if (r.type === "sellingAdmin" && !analysisSellingAdmin) return false;
      if (r.type === "financial" && !analysisFinancial) return false;
      if (r.type === "other" && !analysisOther) return false;

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return r.target.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw);
      }
      return true;
    });
  }, [analysisCOGS, analysisSellingAdmin, analysisFinancial, analysisOther, searchKeyword]);

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
            Báo cáo phân tích chi tiết chi phí theo nhiều kỳ
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
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
              padding: "0 14px",
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

      {/* 2. Action Icons Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 12,
        }}
      >
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
          onClick={() => notify?.("Mở cửa sổ phản hồi hỗ trợ...")}
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
          onClick={() => notify?.("Mở cấu hình hiển thị cột...")}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* 3. Centered Report Title matching Screenshot 2 */}
      <div style={{ textAlign: "center", padding: "16px 20px 12px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
          }}
        >
          BÁO CÁO PHÂN TÍCH CHI TIẾT CHI PHÍ THEO NHIỀU KỲ
        </h3>
      </div>

      {/* 4. Table Area matching Screenshot 2 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
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
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    width: "45%",
                  }}
                >
                  Chỉ tiêu
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
                  Mã số
                </th>

                {/* Periods columns */}
                {periods.map((p) => (
                  <th
                    key={p}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: 130,
                    }}
                  >
                    {p}
                  </th>
                ))}

                {/* Compare same period last year column if checked */}
                {compareSamePeriodLastYear && (
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: 130,
                    }}
                  >
                    Thg {toMonth}/{toYear - 1}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row, idx) => (
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
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "8px 12px",
                      paddingLeft: 12 + (row.indent || 0) * 16,
                      fontWeight: row.isBold ? 700 : 400,
                      color: row.isBold ? "#0f172a" : "#334155",
                    }}
                  >
                    {row.target}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "8px 10px",
                      textAlign: "center",
                      fontWeight: row.isBold ? 700 : 400,
                      color: row.isBold ? "#0f172a" : "#334155",
                    }}
                  >
                    {row.code}
                  </td>

                  {periods.map((p) => (
                    <td
                      key={p}
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "8px 12px",
                        textAlign: "right",
                        color: "#334155",
                      }}
                    >
                      {formatCell(row.valuesByPeriod?.[p])}
                    </td>
                  ))}

                  {compareSamePeriodLastYear && (
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "8px 12px",
                        textAlign: "right",
                        color: "#334155",
                      }}
                    >
                      {formatCell(row.samePeriodLastYear?.[`Thg ${toMonth}/${toYear - 1}`])}
                    </td>
                  )}
                </tr>
              ))}

              {/* Total Row matching Screenshot 2 */}
              <tr style={{ background: "#ffffff", fontWeight: 700 }}>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "8px 12px",
                    color: "#0f172a",
                  }}
                >
                  Tổng cộng
                </td>
                <td
                  style={{
                    border: "1px solid #e2e8f0",
                    padding: "8px 10px",
                    textAlign: "center",
                  }}
                ></td>
                {periods.map((p) => (
                  <td
                    key={p}
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "8px 12px",
                      textAlign: "right",
                    }}
                  ></td>
                ))}
                {compareSamePeriodLastYear && (
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "8px 12px",
                      textAlign: "right",
                    }}
                  ></td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Pagination Bar matching Screenshot 2 */}
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
        <div>Tổng số: {displayedRows.length}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Số dòng/trang</span>
          <select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
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

      {/* 6. Parameter Drawer matching Screenshot 1 */}
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
            {/* Drawer Header */}
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

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Radio Group Kỳ báo cáo */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 8 }}>
                  Kỳ
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 13, color: "#334155" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                    />
                    Tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                    />
                    Quý
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                    />
                    Năm
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "custom"}
                      onChange={() => setDraftPeriodType("custom")}
                    />
                    Tùy chọn
                  </label>
                </div>
              </div>

              {/* Từ tháng / Đến tháng & Năm */}
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

              {/* Chi phí phân tích matching Screenshot 1 */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 10 }}>
                  Chi phí phân tích
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#334155" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftAnalysisCOGS}
                        onChange={(e) => setDraftAnalysisCOGS(e.target.checked)}
                      />
                      Giá vốn
                    </label>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        type="checkbox"
                        id="chk-sellingAdmin"
                        checked={draftAnalysisSellingAdmin}
                        onChange={(e) => setDraftAnalysisSellingAdmin(e.target.checked)}
                      />
                      <label htmlFor="chk-sellingAdmin" style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                        Chi phí bán hàng và QLDN theo
                      </label>
                      <select
                        value={draftSellingAdminMethod}
                        onChange={(e) => setDraftSellingAdminMethod(e.target.value)}
                        style={{
                          height: 28,
                          padding: "0 6px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 12.5,
                          background: "#ffffff",
                          outline: "none",
                        }}
                      >
                        <option value="Khoản mục chi phí">Khoản mục chi phí</option>
                        <option value="Tài khoản">Tài khoản</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftAnalysisFinancial}
                        onChange={(e) => setDraftAnalysisFinancial(e.target.checked)}
                      />
                      Chi phí tài chính
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftAnalysisOther}
                        onChange={(e) => setDraftAnalysisOther(e.target.checked)}
                      />
                      Chi phí khác
                    </label>
                  </div>
                </div>
              </div>

              {/* Checkbox So sánh với cùng kỳ năm trước */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draftCompareSamePeriodLastYear}
                    onChange={(e) => setDraftCompareSamePeriodLastYear(e.target.checked)}
                  />
                  So sánh với cùng kỳ năm trước
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

            {/* Drawer Footer matching Screenshot 1 */}
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
