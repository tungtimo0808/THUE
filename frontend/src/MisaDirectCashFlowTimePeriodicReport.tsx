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

export interface DirectCashFlowRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1
  month10Value?: number;
  month10Change?: number;
}

const DEFAULT_ROWS: DirectCashFlowRow[] = [
  // I. HĐKD
  {
    target: "I. Lưu chuyển tiền từ hoạt động kinh doanh",
    code: "",
    isBold: true,
    indent: 0,
  },
  {
    target: "1. Tiền thu từ bán hàng, cung cấp dịch vụ và doanh thu khác",
    code: "01",
    isBold: false,
    indent: 1,
  },
  {
    target: "2. Tiền chi trả cho người cung cấp hàng hóa và dịch vụ",
    code: "02",
    isBold: false,
    indent: 1,
    month10Value: -20000000,
    month10Change: -20000000,
  },
  {
    target: "3. Tiền chi trả cho người lao động",
    code: "03",
    isBold: false,
    indent: 1,
  },
  {
    target: "4. Chi phí đi vay đã trả",
    code: "04",
    isBold: false,
    indent: 1,
  },
  {
    target: "5. Thuế thu nhập doanh nghiệp đã nộp",
    code: "05",
    isBold: false,
    indent: 1,
  },
  {
    target: "6. Tiền thu khác từ hoạt động kinh doanh",
    code: "06",
    isBold: false,
    indent: 1,
  },
  {
    target: "7. Tiền chi khác cho hoạt động kinh doanh",
    code: "07",
    isBold: false,
    indent: 1,
  },
  {
    target: "Lưu chuyển tiền thuần từ hoạt động kinh doanh",
    code: "20",
    isBold: true,
    indent: 0,
    month10Value: -20000000,
    month10Change: -20000000,
  },

  // II. HĐĐT
  {
    target: "II. Lưu chuyển tiền từ hoạt động đầu tư",
    code: "",
    isBold: true,
    indent: 0,
  },
  {
    target: "1. Tiền chi để mua sắm, xây dựng TSCĐ và các tài sản dài hạn khác",
    code: "21",
    isBold: false,
    indent: 1,
  },
  {
    target: "2. Tiền thu từ thanh lý, nhượng bán TSCĐ và các tài sản dài hạn khác",
    code: "22",
    isBold: false,
    indent: 1,
  },
  {
    target: "3. Tiền chi cho vay, mua các công cụ nợ của đơn vị khác",
    code: "23",
    isBold: false,
    indent: 1,
  },
  {
    target: "4. Tiền thu hồi cho vay, bán lại các công cụ nợ của đơn vị khác",
    code: "24",
    isBold: false,
    indent: 1,
  },
  {
    target: "5. Tiền chi đầu tư góp vốn vào đơn vị khác",
    code: "25",
    isBold: false,
    indent: 1,
  },
  {
    target: "6. Tiền thu hồi đầu tư góp vốn vào đơn vị khác",
    code: "26",
    isBold: false,
    indent: 1,
  },
  {
    target: "7. Tiền thu lãi cho vay, cổ tức và lợi nhuận được chia",
    code: "27",
    isBold: false,
    indent: 1,
  },
  {
    target: "Lưu chuyển tiền thuần từ hoạt động đầu tư",
    code: "30",
    isBold: true,
    indent: 0,
  },

  // III. HĐTC
  {
    target: "III. Lưu chuyển tiền từ hoạt động tài chính",
    code: "",
    isBold: true,
    indent: 0,
  },
  {
    target: "1. Tiền thu từ phát hành cổ phiếu, nhận vốn góp của chủ sở hữu",
    code: "31",
    isBold: false,
    indent: 1,
  },
  {
    target: "2. Tiền trả lại vốn góp cho các chủ sở hữu, mua lại cổ phiếu đã phát hành",
    code: "32",
    isBold: false,
    indent: 1,
  },
  {
    target: "3. Tiền thu từ đi vay",
    code: "33",
    isBold: false,
    indent: 1,
  },
  {
    target: "4. Tiền trả nợ gốc vay",
    code: "34",
    isBold: false,
    indent: 1,
  },
  {
    target: "5. Tiền trả nợ gốc thuê tài chính",
    code: "35",
    isBold: false,
    indent: 1,
  },
  {
    target: "6. Cổ tức, lợi nhuận đã trả cho chủ sở hữu",
    code: "36",
    isBold: false,
    indent: 1,
  },
  {
    target: "Lưu chuyển tiền thuần từ hoạt động tài chính",
    code: "40",
    isBold: true,
    indent: 0,
  },

  // TỔNG KẾT
  {
    target: "Lưu chuyển tiền thuần trong kỳ (50 = 20 + 30 + 40)",
    code: "50",
    isBold: true,
    indent: 0,
    month10Value: -20000000,
    month10Change: -20000000,
  },
  {
    target: "Tiền và tương đương tiền đầu kỳ",
    code: "60",
    isBold: false,
    indent: 0,
  },
  {
    target: "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ",
    code: "61",
    isBold: false,
    indent: 0,
  },
  {
    target: "Tiền và tương đương tiền cuối kỳ (70 = 50 + 60 + 61)",
    code: "70",
    isBold: true,
    indent: 0,
    month10Value: -20000000,
    month10Change: -20000000,
  },
];

export interface MisaDirectCashFlowTimePeriodicReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaDirectCashFlowTimePeriodicReport({
  onBack,
  notify,
}: MisaDirectCashFlowTimePeriodicReportProps) {
  // Drawer Parameters State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"month" | "quarter" | "halfYear" | "year" | "samePeriod">("month");
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState(10);
  const [toYear, setToYear] = useState(2026);
  const [fromPreparedReport, setFromPreparedReport] = useState(false);
  const [hideZeroRows, setHideZeroRows] = useState(false);

  // Temporary drawer draft state
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
    notify?.("Đã tải lại Phân tích báo cáo lưu chuyển tiền tệ theo thời gian (PP trực tiếp).");
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
        if (!row.month10Value && !row.month10Change && row.code) return false;
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
      {/* 1. Header Bar matching Screenshot 4/5 */}
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
            Phân tích báo cáo lưu chuyển tiền tệ theo thời gian (PP trực tiếp)
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

      {/* 2. Action Toolbar matching Screenshot 4/5 */}
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

      {/* 3. Subtitle matching Screenshot 4/5 */}
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

      {/* 4. Table Container matching Screenshot 4 & 5 */}
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

                {/* Tháng 1: ColSpan 1 */}
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
                  Tháng {monthsRange[0]}/{fromYear}
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
                    Tháng {m}/{fromYear}
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

      {/* 5. Parameter Drawer matching Screenshot 4 */}
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
                      name="dcfPeriodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                    />
                    Tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dcfPeriodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                    />
                    Quý
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dcfPeriodType"
                      checked={draftPeriodType === "halfYear"}
                      onChange={() => setDraftPeriodType("halfYear")}
                    />
                    6 tháng
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dcfPeriodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                    />
                    Năm
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="dcfPeriodType"
                      checked={draftPeriodType === "samePeriod"}
                      onChange={() => setDraftPeriodType("samePeriod")}
                    />
                    Cùng kỳ giữa các năm
                  </label>
                </div>
              </div>

              {/* Từ tháng / Đến tháng & Năm matching Screenshot 4 */}
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

              {/* Checkboxes */}
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
