import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

export interface BusinessResultGrowthRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1
  month10Value?: number;
  month10Change?: number;
  month10Rate?: number;
}

const DEFAULT_ROWS: BusinessResultGrowthRow[] = [
  {
    target: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    isBold: false,
    indent: 0,
    month10Value: 20000000,
    month10Change: 20000000,
  },
  {
    target: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    isBold: false,
    indent: 0,
  },
  {
    target: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    isBold: true,
    indent: 0,
    month10Value: 20000000,
    month10Change: 20000000,
  },
  {
    target: "4. Giá vốn hàng bán",
    code: "11",
    isBold: false,
    indent: 0,
    month10Value: 12525000,
    month10Change: 12525000,
  },
  {
    target: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    isBold: true,
    indent: 0,
    month10Value: 7475000,
    month10Change: 7475000,
  },
  {
    target: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    isBold: false,
    indent: 0,
  },
  {
    target: "7. Doanh thu hoạt động tài chính",
    code: "22",
    isBold: false,
    indent: 0,
  },
  {
    target: "8. Chi phí tài chính",
    code: "23",
    isBold: false,
    indent: 0,
  },
  {
    target: "- Trong đó: Chi phí lãi vay",
    code: "24",
    isBold: false,
    indent: 1,
  },
  {
    target: "9. Chi phí bán hàng",
    code: "25",
    isBold: false,
    indent: 0,
  },
  {
    target: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    isBold: false,
    indent: 0,
  },
  {
    target: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    isBold: true,
    indent: 0,
    month10Value: 7475000,
    month10Change: 7475000,
  },
  {
    target: "12. Thu nhập khác",
    code: "31",
    isBold: false,
    indent: 0,
  },
  {
    target: "13. Chi phí khác",
    code: "32",
    isBold: false,
    indent: 0,
  },
  {
    target: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    isBold: true,
    indent: 0,
  },
  {
    target: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    isBold: true,
    indent: 0,
    month10Value: 7475000,
    month10Change: 7475000,
  },
  {
    target: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    isBold: false,
    indent: 0,
    month10Value: 1495000,
    month10Change: 1495000,
  },
  {
    target: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    isBold: false,
    indent: 0,
  },
  {
    target: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    isBold: true,
    indent: 0,
    month10Value: 5980000,
    month10Change: 5980000,
  },
  {
    target: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    isBold: false,
    indent: 0,
  },
  {
    target: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    isBold: false,
    indent: 0,
  },
];

export interface MisaBusinessResultGrowthAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBusinessResultGrowthAnalysisReport({
  onBack,
  notify,
}: MisaBusinessResultGrowthAnalysisReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "halfYear" | "year" | "samePeriod">("month");
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);
  const [fromPreparedReport, setFromPreparedReport] = useState(false);
  const [hideZeroRows, setHideZeroRows] = useState(false);

  // Drawer draft state
  const [draftPeriodType, setDraftPeriodType] = useState<"month" | "quarter" | "halfYear" | "year" | "samePeriod">("month");
  const [draftFromMonth, setDraftFromMonth] = useState(1);
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState(10);
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftFromPreparedReport, setDraftFromPreparedReport] = useState(false);
  const [draftHideZeroRows, setDraftHideZeroRows] = useState(false);

  // Display mode
  const [displayMode, setDisplayMode] = useState<"data" | "chart" | "dataAndChart">("data");
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodType(periodType);
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftFromPreparedReport(fromPreparedReport);
    setDraftHideZeroRows(hideZeroRows);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriodType(draftPeriodType);
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setFromPreparedReport(draftFromPreparedReport);
    setHideZeroRows(draftHideZeroRows);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Phân tích tăng trưởng các chỉ tiêu kết quả hoạt động kinh doanh.");
  };

  const handleResetParams = () => {
    setDraftPeriodType("month");
    setDraftFromMonth(1);
    setDraftFromYear(2026);
    setDraftToMonth(10);
    setDraftToYear(2026);
    setDraftFromPreparedReport(false);
    setDraftHideZeroRows(false);
  };

  // Format currency helper
  const formatCell = (val?: number) => {
    if (val === undefined || val === null) return { text: "", isNegative: false };
    if (val === 0) return { text: "0", isNegative: false };
    if (val < 0) {
      return {
        text: `(${Math.abs(val).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: val.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Range of months for the table columns
  const monthsRange = useMemo(() => {
    const list: number[] = [];
    for (let m = fromMonth; m <= toMonth; m++) {
      list.push(m);
    }
    return list;
  }, [fromMonth, toMonth]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_ROWS.filter((row) => {
      if (hideZeroRows) {
        if (!row.month10Value && !row.month10Change) return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.code.toLowerCase().includes(kw) ||
          row.target.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [hideZeroRows, searchKeyword]);

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
      {/* 1. Header Bar matching Screenshot 2/3 */}
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
            Phân tích tăng trưởng các chỉ tiêu kết quả hoạt động kinh doanh
          </h2>
        </div>

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
            title="Trợ giúp"
            onClick={() => notify?.("Mở trợ giúp...")}
          >
            <HelpCircle size={18} />
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Đóng"
          >
            <X size={19} />
          </button>
        </div>
      </div>

      {/* 2. Action Toolbar matching Screenshot 2/3 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {/* Dạng hiển thị */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>
            Dạng hiển thị
          </span>
          <select
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as any)}
            style={{
              height: 30,
              padding: "0 28px 0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              color: "#1e293b",
              background: "#ffffff",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="data">Dữ liệu</option>
            <option value="chart">Biểu đồ</option>
            <option value="dataAndChart">Dữ liệu và biểu đồ</option>
          </select>
        </div>

        {/* Right action icons */}
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

      {/* 3. Subtitle matching Screenshot 2/3 */}
      <div style={{ textAlign: "center", padding: "14px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          Từ tháng {fromMonth}/{fromYear} đến tháng {toMonth}/{toYear}
        </h3>
      </div>

      {/* 4. Table Container matching Screenshot 2 & 3 */}
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
              width: "max-content",
              minWidth: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <thead>
              {/* Row 1 Header */}
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
                    minWidth: 70,
                  }}
                >
                  Mã số
                </th>

                {/* T1/2026: ColSpan 1 */}
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 10px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 120,
                  }}
                >
                  T{monthsRange[0]}/{fromYear}
                </th>

                {/* Subsequent months: ColSpan 3 each */}
                {monthsRange.slice(1).map((m) => (
                  <th
                    key={m}
                    colSpan={3}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 320,
                    }}
                  >
                    T{m}/{fromYear}
                  </th>
                ))}
              </tr>

              {/* Row 2 Subheaders */}
              <tr style={{ background: "#e2f0d9" }}>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                  Giá trị
                </th>

                {monthsRange.slice(1).map((m) => (
                  <React.Fragment key={m}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                      Giá trị
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                      Tăng/giảm
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                      Tỷ lệ tăng/giảm (%)
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const m10ValFmt = formatCell(row.month10Value);
                const m10ChgFmt = formatCell(row.month10Change);

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

                    {/* First month in range */}
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "7px 8px",
                        textAlign: "right",
                        fontWeight: row.isBold ? 700 : 400,
                        color: monthsRange[0] === 10 && m10ValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                      }}
                    >
                      {monthsRange[0] === 10 ? m10ValFmt.text : ""}
                    </td>

                    {/* Subsequent months in range */}
                    {monthsRange.slice(1).map((m) => {
                      if (m === 10) {
                        return (
                          <React.Fragment key={m}>
                            <td
                              style={{
                                border: "1px solid #e2e8f0",
                                padding: "7px 8px",
                                textAlign: "right",
                                fontWeight: row.isBold ? 700 : 400,
                                color: m10ValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                              }}
                            >
                              {m10ValFmt.text}
                            </td>
                            <td
                              style={{
                                border: "1px solid #e2e8f0",
                                padding: "7px 8px",
                                textAlign: "right",
                                fontWeight: row.isBold ? 700 : 400,
                                color: m10ChgFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                              }}
                            >
                              {m10ChgFmt.text}
                            </td>
                            <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          </React.Fragment>
                        );
                      }
                      return (
                        <React.Fragment key={m}>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}></td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
                gap: 16,
              }}
            >
              {/* Radio Kỳ */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "block", marginBottom: 8 }}>
                  Kỳ báo cáo
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "#334155" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="brgPeriodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                    />
                    Tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="brgPeriodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                    />
                    Quý
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="brgPeriodType"
                      checked={draftPeriodType === "halfYear"}
                      onChange={() => setDraftPeriodType("halfYear")}
                    />
                    6 tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="brgPeriodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                    />
                    Năm
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="brgPeriodType"
                      checked={draftPeriodType === "samePeriod"}
                      onChange={() => setDraftPeriodType("samePeriod")}
                    />
                    Cùng kỳ giữa các năm
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
                        border: "1px solid #00a862",
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draftFromPreparedReport}
                    onChange={(e) => setDraftFromPreparedReport(e.target.checked)}
                  />
                  Lấy dữ liệu từ báo cáo tài chính đã lập
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={draftHideZeroRows}
                    onChange={(e) => setDraftHideZeroRows(e.target.checked)}
                  />
                  Không hiển thị các chỉ tiêu có số liệu = 0
                </label>
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
