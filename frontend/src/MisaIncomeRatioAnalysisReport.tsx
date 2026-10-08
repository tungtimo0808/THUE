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
  BarChart3,
} from "lucide-react";

export interface IncomeRatioRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number;
  // Monthly values: month 1..10
  monthlyValue?: Record<number, number>;
  monthlyRatio?: Record<number, number>;
  monthlyChangeVal?: Record<number, number>;
  monthlyChangeRatio?: Record<number, number>;
}

const DEFAULT_ROWS: IncomeRatioRow[] = [
  {
    target: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    isBold: false,
    indent: 0,
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
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
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
  },
  {
    target: "4. Giá vốn hàng bán",
    code: "11",
    isBold: false,
    indent: 0,
  },
  {
    target: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    isBold: true,
    indent: 0,
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
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
    target: "- Trong đó: Chi phí đi vay",
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
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
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
    isBold: false,
    indent: 0,
  },
  {
    target: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    isBold: true,
    indent: 0,
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
  },
  {
    target: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    isBold: false,
    indent: 0,
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
    monthlyValue: { 10: 20000000 },
    monthlyRatio: { 10: 100 },
    monthlyChangeVal: { 10: 20000000 },
    monthlyChangeRatio: { 10: 100 },
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

export interface MisaIncomeRatioAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaIncomeRatioAnalysisReport({
  onBack,
  notify,
}: MisaIncomeRatioAnalysisReportProps) {
  // Drawer Parameters State matching Screenshot 1
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

  // View mode matching Screenshot 2 dropdown: "Dữ liệu" or "Biểu đồ"
  const [displayMode, setDisplayMode] = useState<"data" | "chart">("data");

  // Search keyword inside report
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
    notify?.("Đã tải lại Phân tích báo cáo KQHĐKD (so sánh tỷ lệ trên doanh thu).");
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
  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return "";
    if (val === 0) return "0";
    if (val < 0) return `(${Math.abs(val).toLocaleString("vi-VN")})`;
    return val.toLocaleString("vi-VN");
  };

  // Format percentage helper (Vietnamese comma decimal: 100,00)
  const formatRatio = (val?: number) => {
    if (val === undefined || val === null) return "";
    return val.toFixed(2).replace(".", ",");
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
        const hasData = monthsRange.some(
          (m) => (row.monthlyValue?.[m] || 0) !== 0
        );
        if (!hasData) return false;
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
  }, [hideZeroRows, monthsRange, searchKeyword]);

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
      {/* 1. Top Header Bar matching Screenshot 2/3/4 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 46,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
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
            Phân tích báo cáo kết quả hoạt động kinh doanh (so sánh tỷ lệ trên doanh thu)
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Tải xuống"
            onClick={() => notify?.("Đang tải xuống dữ liệu báo cáo...")}
          >
            <Download size={17} />
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

      {/* 2. Action Toolbar matching Screenshot 2 */}
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
        {/* Left: Dạng hiển thị dropdown matching Screenshot 2 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#475569" }}>Dạng hiển thị</span>
          <div style={{ position: "relative" }}>
            <select
              value={displayMode}
              onChange={(e) => setDisplayMode(e.target.value as "data" | "chart")}
              style={{
                height: 30,
                padding: "0 28px 0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                background: "#ffffff",
                cursor: "pointer",
                appearance: "none",
              }}
            >
              <option value="data">Dữ liệu</option>
              <option value="chart">Biểu đồ</option>
            </select>
            <ChevronDown
              size={14}
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                color: "#64748b",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>

        {/* Right Toolbar Actions */}
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
                width: 190,
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
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Nạp lại"
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email")}
          >
            <Mail size={15} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#0284c7",
              cursor: "pointer",
            }}
            title="Bình luận / Trao đổi"
            onClick={() => notify?.("Mở bảng trao đổi nội bộ")}
          >
            <MessageCircle size={15} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="In báo cáo"
            onClick={() => notify?.("Đang tải dữ liệu in báo cáo...")}
          >
            <Printer size={15} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 6px",
              display: "flex",
              alignItems: "center",
              gap: 2,
              background: "transparent",
              border: "none",
              color: "#16a34a",
              cursor: "pointer",
            }}
            title="Xuất khẩu Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>XLS</span>
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

      {/* 3. Centered Subtitle matching Screenshot 2 */}
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

      {/* 4. Main Body: Data Table OR Chart View */}
      {displayMode === "chart" ? (
        /* Chart View */
        <div style={{ flex: 1, padding: "20px 40px", overflow: "auto" }}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <BarChart3 size={20} color="#00a862" />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                Biểu đồ tỷ lệ Lợi nhuận gộp trên Doanh thu thuần
              </h4>
            </div>

            {/* Simple SVG Chart */}
            <div style={{ height: 260, display: "flex", alignItems: "flex-end", gap: 24, paddingBottom: 20, borderBottom: "2px solid #cbd5e1" }}>
              {monthsRange.map((m) => {
                const ratio = m === 10 ? 100 : 0;
                const heightPx = (ratio / 100) * 180;
                return (
                  <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ratio > 0 ? "#00a862" : "#94a3b8" }}>
                      {ratio > 0 ? `${ratio}%` : "0%"}
                    </span>
                    <div
                      style={{
                        width: 36,
                        height: Math.max(heightPx, 4),
                        background: ratio > 0 ? "linear-gradient(180deg, #10b981 0%, #00a862 100%)" : "#e2e8f0",
                        borderRadius: "4px 4px 0 0",
                        transition: "all 0.3s ease",
                      }}
                    />
                    <span style={{ fontSize: 11.5, color: "#475569" }}>T{m}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#64748b" }}>
              <span>Doanh thu thuần T10/2026: <strong>20.000.000 đ</strong></span>
              <span>Lợi nhuận gộp: <strong>20.000.000 đ</strong> (100,00%)</span>
              <span>Lợi nhuận sau thuế: <strong>20.000.000 đ</strong> (100,00%)</span>
            </div>
          </div>
        </div>
      ) : (
        /* Data Table matching Screenshots 2, 3, 4 */
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
                      minWidth: 260,
                    }}
                  >
                    Chỉ tiêu
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      position: "sticky",
                      left: 260,
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

                  {/* Month 1: Colspan 2 matching Screenshot 2 */}
                  <th
                    colSpan={2}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      minWidth: 220,
                    }}
                  >
                    Tháng 1/{fromYear}
                  </th>

                  {/* Months 2..10: Colspan 4 matching Screenshot 3 & 4 */}
                  {monthsRange.slice(1).map((m) => (
                    <th
                      key={m}
                      colSpan={4}
                      style={{
                        border: "1px solid #cbd5e1",
                        padding: "6px 10px",
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#1e293b",
                        minWidth: 420,
                      }}
                    >
                      Tháng {m}/{toYear}
                    </th>
                  ))}
                </tr>

                {/* Row 2 Subheaders */}
                <tr style={{ background: "#e2f0d9" }}>
                  {/* Month 1 subheaders: Giá trị | Tỷ lệ/Doanh thu (%) */}
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                    Giá trị
                  </th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 120 }}>
                    Tỷ lệ/Doanh thu (%)
                  </th>

                  {/* Months 2..10 subheaders: Giá trị | Tỷ lệ/Doanh thu (%) | Tăng/giảm giá trị | Tăng/giảm tỷ lệ (%) */}
                  {monthsRange.slice(1).map((m) => (
                    <React.Fragment key={m}>
                      <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                        Giá trị
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                        Tỷ lệ/Doanh thu (%)
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                        Tăng/giảm giá trị
                      </th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                        Tăng/giảm tỷ lệ (%)
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.code}
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
                        left: 260,
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

                    {/* Month 1: Giá trị | Tỷ lệ */}
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}>
                      {formatMoney(row.monthlyValue?.[1])}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}>
                      {formatRatio(row.monthlyRatio?.[1])}
                    </td>

                    {/* Months 2..10 */}
                    {monthsRange.slice(1).map((m) => {
                      const val = row.monthlyValue?.[m];
                      const ratio = row.monthlyRatio?.[m];
                      const chgVal = row.monthlyChangeVal?.[m];
                      const chgRatio = row.monthlyChangeRatio?.[m];

                      return (
                        <React.Fragment key={m}>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right", fontWeight: row.isBold ? 600 : 400 }}>
                            {formatMoney(val)}
                          </td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}>
                            {formatRatio(ratio)}
                          </td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}>
                            {formatMoney(chgVal)}
                          </td>
                          <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "right" }}>
                            {formatRatio(chgRatio)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Parameter Drawer matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(1px)",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: 520,
              maxWidth: "100%",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
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
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body matching Screenshot 1 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
                fontSize: 13,
              }}
            >
              {/* Kỳ báo cáo Radio Buttons: Tháng / Quý / 6 tháng / Năm / Cùng kỳ giữa các năm */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: 10,
                    color: "#0f172a",
                  }}
                >
                  Kỳ báo cáo
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "month"}
                      onChange={() => setDraftPeriodType("month")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Tháng</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "quarter"}
                      onChange={() => setDraftPeriodType("quarter")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Quý</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "halfYear"}
                      onChange={() => setDraftPeriodType("halfYear")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>6 tháng</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "year"}
                      onChange={() => setDraftPeriodType("year")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Năm</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="periodType"
                      checked={draftPeriodType === "samePeriod"}
                      onChange={() => setDraftPeriodType("samePeriod")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Cùng kỳ giữa các năm</span>
                  </label>
                </div>
              </div>

              {/* Từ tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Từ tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftFromMonth}
                      onChange={(e) => setDraftFromMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftFromYear}
                    onChange={(e) => setDraftFromYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Đến tháng / Năm */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Đến tháng
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftToMonth}
                      onChange={(e) => setDraftToMonth(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 13,
                        outline: "none",
                        appearance: "none",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ width: 100 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftToYear}
                    onChange={(e) => setDraftToYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Checkboxes matching Screenshot 1 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={draftFromPreparedReport}
                    onChange={(e) => setDraftFromPreparedReport(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính đã lập</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#0f172a" }}>
                  <input
                    type="checkbox"
                    checked={draftHideZeroRows}
                    onChange={(e) => setDraftHideZeroRows(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
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
                  background: "transparent",
                  border: "none",
                  fontSize: 13,
                  color: "#0f172a",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "6px 8px",
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
