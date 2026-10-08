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
  PieChart as PieChartIcon,
  Table as TableIcon,
} from "lucide-react";

export interface StructureAnalysisRow {
  target: string;
  code: string;
  isBold?: boolean;
  indent?: number; // 0, 1, 2
  isHeaderGroup?: boolean;

  // Cuối kỳ
  closingValue?: number;
  closingRatio?: number; // %
  changeValue?: number;
  changeRatio?: number; // %

  // Đầu kỳ
  openingValue?: number;
  openingRatio?: number; // %
}

const DEFAULT_STRUCTURE_ROWS: StructureAnalysisRow[] = [
  // 1. TÀI SẢN
  {
    target: "TÀI SẢN",
    code: "",
    isBold: true,
    indent: 0,
    isHeaderGroup: true,
    changeRatio: 0.0,
  },
  {
    target: "A. TÀI SẢN NGẮN HẠN",
    code: "100",
    isBold: true,
    indent: 0,
    closingValue: 24475000,
    changeValue: 24475000,
    changeRatio: 0.0,
  },
  {
    target: "I. Tiền và các khoản tương đương tiền",
    code: "110",
    isBold: false,
    indent: 1,
    closingValue: -20000000,
    changeValue: -20000000,
    changeRatio: 0.0,
  },
  {
    target: "II. Đầu tư tài chính ngắn hạn",
    code: "120",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "III. Các khoản phải thu ngắn hạn",
    code: "130",
    isBold: false,
    indent: 1,
    closingValue: 30000000,
    changeValue: 30000000,
    changeRatio: 0.0,
  },
  {
    target: "IV. Hàng tồn kho",
    code: "140",
    isBold: false,
    indent: 1,
    closingValue: 12475000,
    changeValue: 12475000,
    changeRatio: 0.0,
  },
  {
    target: "V. Tài sản sinh học ngắn hạn",
    code: "150",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "VI. Tài sản ngắn hạn khác",
    code: "160",
    isBold: false,
    indent: 1,
    closingValue: 2000000,
    changeValue: 2000000,
    changeRatio: 0.0,
  },
  {
    target: "B. TÀI SẢN DÀI HẠN",
    code: "200",
    isBold: true,
    indent: 0,
    changeRatio: 0.0,
  },
  {
    target: "I. Các khoản phải thu dài hạn",
    code: "210",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "II. Tài sản cố định",
    code: "220",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "III. Tài sản sinh học dài hạn",
    code: "230",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "IV. Bất động sản đầu tư",
    code: "240",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "V. Tài sản dở dang dài hạn",
    code: "250",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  // NGUỒN VỐN Header Group matching Screenshot 4/5
  {
    target: "NGUỒN VỐN",
    code: "",
    isBold: true,
    indent: 0,
    isHeaderGroup: true,
    changeRatio: 0.0,
  },
  {
    target: "VI. Đầu tư tài chính dài hạn",
    code: "260",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "VII. Tài sản dài hạn khác",
    code: "270",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "TỔNG CỘNG TÀI SẢN (280 = 100 + 200)",
    code: "280",
    isBold: true,
    indent: 0,
    closingValue: 24475000,
    changeValue: 24475000,
    changeRatio: 0.0,
  },
  {
    target: "C - NỢ PHẢI TRẢ",
    code: "300",
    isBold: true,
    indent: 0,
    closingValue: 17000000,
    closingRatio: 100.0,
    changeValue: 17000000,
    changeRatio: 100.0,
  },
  {
    target: "I. Nợ ngắn hạn",
    code: "310",
    isBold: false,
    indent: 1,
    closingValue: 17000000,
    closingRatio: 100.0,
    changeValue: 17000000,
    changeRatio: 100.0,
  },
  {
    target: "II. Nợ dài hạn",
    code: "330",
    isBold: false,
    indent: 1,
    changeRatio: 0.0,
  },
  {
    target: "D - VỐN CHỦ SỞ HỮU",
    code: "400",
    isBold: true,
    indent: 0,
    changeRatio: 0.0,
  },
  {
    target: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)",
    code: "440",
    isBold: true,
    indent: 0,
    closingValue: 17000000,
    closingRatio: 100.0,
    changeValue: 17000000,
    changeRatio: 100.0,
  },
];

export interface MisaAssetCapitalStructureAnalysisReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaAssetCapitalStructureAnalysisReport({
  onBack,
  notify,
}: MisaAssetCapitalStructureAnalysisReportProps) {
  // Drawer Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("Tháng 10");
  const [year, setYear] = useState(2026);
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [fromPreparedReport, setFromPreparedReport] = useState(false);
  const [hideZeroRows, setHideZeroRows] = useState(false);

  // Drawer draft state
  const [draftReportPeriod, setDraftReportPeriod] = useState("Tháng 10");
  const [draftYear, setDraftYear] = useState(2026);
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftFromPreparedReport, setDraftFromPreparedReport] = useState(false);
  const [draftHideZeroRows, setDraftHideZeroRows] = useState(false);

  // Display mode matching Screenshot 4: "Dữ liệu" | "Biểu đồ" | "Dữ liệu và biểu đồ"
  const [displayMode, setDisplayMode] = useState<"data" | "chart" | "dataAndChart">("data");
  const [searchKeyword, setSearchKeyword] = useState("");

  const handleOpenDrawer = () => {
    setDraftReportPeriod(reportPeriod);
    setDraftYear(year);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFromPreparedReport(fromPreparedReport);
    setDraftHideZeroRows(hideZeroRows);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriod(draftReportPeriod);
    setYear(draftYear);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFromPreparedReport(draftFromPreparedReport);
    setHideZeroRows(draftHideZeroRows);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Phân tích cơ cấu tài sản, nguồn vốn trên Báo cáo tình hình tài chính.");
  };

  const handleResetParams = () => {
    setDraftReportPeriod("Tháng 10");
    setDraftYear(2026);
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftFromPreparedReport(false);
    setDraftHideZeroRows(false);
  };

  // Format currency
  const formatMoney = (val?: number) => {
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

  // Format percentage
  const formatRatio = (val?: number) => {
    if (val === undefined || val === null) return "";
    return val.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_STRUCTURE_ROWS.filter((row) => {
      if (hideZeroRows) {
        if (!row.closingValue && !row.changeValue && !row.closingRatio && !row.isHeaderGroup) {
          return false;
        }
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return row.target.toLowerCase().includes(kw) || row.code.toLowerCase().includes(kw);
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
      {/* 1. Modal / Workspace Header matching Screenshot 4 */}
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
            Phân tích cơ cấu tài sản, nguồn vốn trên Báo cáo tình hình tài chính
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
            onClick={() => notify?.("Mở hướng dẫn báo cáo...")}
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

      {/* 2. Action Toolbar matching Screenshot 4 */}
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
        {/* Left: Dạng hiển thị dropdown */}
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

        {/* Right action icons matching Screenshot 4 */}
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

      {/* 3. Subtitle matching Screenshot 4 */}
      <div style={{ textAlign: "center", padding: "14px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          {reportPeriod.toLowerCase().includes("tháng")
            ? `${reportPeriod} năm ${year}`
            : `Kỳ ${reportPeriod} năm ${year}`}
        </h3>
      </div>

      {/* 4. Chart View (when displayMode is 'chart' or 'dataAndChart') */}
      {(displayMode === "chart" || displayMode === "dataAndChart") && (
        <div
          style={{
            padding: "0 20px 16px 20px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          {/* Chart 1: Cơ cấu tài sản */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: 16,
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 12, textAlign: "center" }}>
              Cơ cấu Tài sản (Tổng: 24.475.000 đ)
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
              <svg width="140" height="140" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="#f8fafc" />
                <circle
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke="#22c55e"
                  strokeWidth="6"
                  strokeDasharray="100 0"
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "#22c55e", borderRadius: 2 }}></span>
                  <span>Tài sản ngắn hạn: 100% (24.475.000 đ)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "#94a3b8", borderRadius: 2 }}></span>
                  <span>Tài sản dài hạn: 0% (0 đ)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Cơ cấu nguồn vốn */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: 16,
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 12, textAlign: "center" }}>
              Cơ cấu Nguồn vốn (Tổng: 17.000.000 đ)
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around" }}>
              <svg width="140" height="140" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="15.915" fill="#f8fafc" />
                <circle
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke="#3b82f6"
                  strokeWidth="6"
                  strokeDasharray="100 0"
                  strokeDashoffset="25"
                />
              </svg>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "#3b82f6", borderRadius: 2 }}></span>
                  <span>Nợ phải trả: 100% (17.000.000 đ)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: "#94a3b8", borderRadius: 2 }}></span>
                  <span>Vốn chủ sở hữu: 0% (0 đ)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Table Container matching Screenshot 4 & 5 */}
      {displayMode !== "chart" && (
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

                  {/* Cuối kỳ (4 columns) */}
                  <th
                    colSpan={4}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                    }}
                  >
                    Cuối kỳ
                  </th>

                  {/* Đầu kỳ (2 columns) */}
                  <th
                    colSpan={2}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                    }}
                  >
                    Đầu kỳ
                  </th>
                </tr>

                {/* Header Row 2 Subheaders */}
                <tr style={{ background: "#e2f0d9" }}>
                  {/* Cuối kỳ subheaders */}
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 120 }}>
                    Giá trị
                  </th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                    Tỷ trọng (%)
                  </th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 130 }}>
                    Tăng/giảm giá trị
                  </th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 140 }}>
                    Tăng/giảm tỷ trọng (%)
                  </th>

                  {/* Đầu kỳ subheaders */}
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 120 }}>
                    Giá trị
                  </th>
                  <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                    Tỷ trọng (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const closingValFmt = formatMoney(row.closingValue);
                  const changeValFmt = formatMoney(row.changeValue);
                  const isSectionHeader = row.isHeaderGroup;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: isSectionHeader ? "#f8fafc" : "#ffffff",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f1f5f9";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSectionHeader ? "#f8fafc" : "#ffffff";
                      }}
                    >
                      {/* Chỉ tiêu (Sticky) */}
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: isSectionHeader ? "#f8fafc" : "#ffffff",
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
                          background: isSectionHeader ? "#f8fafc" : "#ffffff",
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "center",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {row.code}
                      </td>

                      {/* Cuối kỳ - Giá trị */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: closingValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {closingValFmt.text}
                      </td>

                      {/* Cuối kỳ - Tỷ trọng (%) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {formatRatio(row.closingRatio)}
                      </td>

                      {/* Cuối kỳ - Tăng/giảm giá trị */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: changeValFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {changeValFmt.text}
                      </td>

                      {/* Cuối kỳ - Tăng/giảm tỷ trọng (%) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {formatRatio(row.changeRatio)}
                      </td>

                      {/* Đầu kỳ - Giá trị */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                        }}
                      >
                        {formatMoney(row.openingValue).text}
                      </td>

                      {/* Đầu kỳ - Tỷ trọng (%) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          textAlign: "right",
                        }}
                      >
                        {formatRatio(row.openingRatio)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Parameter Drawer matching Screenshot 3 */}
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
              {/* Kỳ báo cáo & Năm matching Screenshot 3 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Kỳ báo cáo
                  </label>
                  <select
                    value={draftReportPeriod}
                    onChange={(e) => setDraftReportPeriod(e.target.value)}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  >
                    <option value="Tháng 1">Tháng 1</option>
                    <option value="Tháng 2">Tháng 2</option>
                    <option value="Tháng 3">Tháng 3</option>
                    <option value="Tháng 4">Tháng 4</option>
                    <option value="Tháng 5">Tháng 5</option>
                    <option value="Tháng 6">Tháng 6</option>
                    <option value="Tháng 7">Tháng 7</option>
                    <option value="Tháng 8">Tháng 8</option>
                    <option value="Tháng 9">Tháng 9</option>
                    <option value="Tháng 10">Tháng 10</option>
                    <option value="Tháng 11">Tháng 11</option>
                    <option value="Tháng 12">Tháng 12</option>
                    <option value="Quý 1">Quý 1</option>
                    <option value="Quý 2">Quý 2</option>
                    <option value="Quý 3">Quý 3</option>
                    <option value="Quý 4">Quý 4</option>
                    <option value="Năm">Cả năm</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftYear}
                    onChange={(e) => setDraftYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Từ ngày - Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                      background: "#ffffff",
                      outline: "none",
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
                      background: "#ffffff",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Checkboxes matching Screenshot 3 */}
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

            {/* Footer matching Screenshot 3 */}
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
