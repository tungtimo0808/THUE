import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Calendar,
  Search,
  RefreshCw,
  Mail,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

export interface DetailedExpenseRow {
  target: string;
  code: string;
  currentPeriod?: number;
  accumulatedYear?: number;
  isBold?: boolean;
  indent?: number; // 0, 1, 2
  category: "cogs" | "kmcp" | "financial" | "other";
}

const ALL_EXPENSE_ROWS: DetailedExpenseRow[] = [
  {
    target: "GIÁ VỐN HÀNG BÁN",
    code: "632",
    currentPeriod: 12525000,
    accumulatedYear: 12525000,
    isBold: true,
    indent: 0,
    category: "cogs",
  },
  {
    target: "Giá vốn hàng bán",
    code: "632",
    currentPeriod: 12525000,
    accumulatedYear: 12525000,
    isBold: true,
    indent: 1,
    category: "cogs",
  },
  {
    target: "Man hinh 21 LG inch",
    code: "632",
    currentPeriod: 12525000,
    accumulatedYear: 12525000,
    isBold: false,
    indent: 2,
    category: "cogs",
  },
];

export interface MisaMultiBranchDetailedExpenseReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchDetailedExpenseReport({
  onBack,
  notify,
}: MisaMultiBranchDetailedExpenseReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");

  // Chi phí phân tích matching Screenshot 1:
  // - Giá vốn: unchecked
  // - Chi phí theo KMCP: checked
  // - Chi phí tài chính: unchecked
  // - Chi phí khác: unchecked
  const [filterCogs, setFilterCogs] = useState(false);
  const [filterKmcp, setFilterKmcp] = useState(true);
  const [filterFinance, setFilterFinance] = useState(false);
  const [filterOther, setFilterOther] = useState(false);
  const [expenseLevel, setExpenseLevel] = useState("1");

  // Draft state inside drawer
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftFilterCogs, setDraftFilterCogs] = useState(false);
  const [draftFilterKmcp, setDraftFilterKmcp] = useState(true);
  const [draftFilterFinance, setDraftFilterFinance] = useState(false);
  const [draftFilterOther, setDraftFilterOther] = useState(false);
  const [draftExpenseLevel, setDraftExpenseLevel] = useState("1");

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    target: string;
    code: string;
    amount: number;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFilterCogs(filterCogs);
    setDraftFilterKmcp(filterKmcp);
    setDraftFilterFinance(filterFinance);
    setDraftFilterOther(filterOther);
    setDraftExpenseLevel(expenseLevel);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFilterCogs(draftFilterCogs);
    setFilterKmcp(draftFilterKmcp);
    setFilterFinance(draftFilterFinance);
    setFilterOther(draftFilterOther);
    setExpenseLevel(draftExpenseLevel);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftFilterCogs(false);
    setDraftFilterKmcp(true);
    setDraftFilterFinance(false);
    setDraftFilterOther(false);
    setDraftExpenseLevel("1");
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

  // Filter rows based on parameters
  const filteredRows = useMemo(() => {
    return ALL_EXPENSE_ROWS.filter((row) => {
      // Check category filter
      if (row.category === "cogs" && !filterCogs) return false;
      if (row.category === "kmcp" && !filterKmcp) return false;
      if (row.category === "financial" && !filterFinance) return false;
      if (row.category === "other" && !filterOther) return false;

      // Keyword search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.target.toLowerCase().includes(kw) ||
          row.code.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [filterCogs, filterKmcp, filterFinance, filterOther, searchKeyword]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#f1f5f9",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Top Header Bar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              letterSpacing: "-0.2px",
            }}
          >
            Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 14px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => setIsSavedReportsOpen(true)}
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
              fontSize: 13,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() =>
              notify?.("Đã lưu Báo cáo phân tích chi tiết chi phí theo nhiều chi nhánh.")
            }
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

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 10,
        }}
      >
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
            placeholder="Nhập từ khóa tìm kiếm"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{
              height: 30,
              width: 220,
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
          onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua Email")}
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
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Bình luận / Trao đổi"
          onClick={() => notify?.("Mở bảng trao đổi nội bộ về báo cáo")}
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

        <div style={{ display: "flex", alignItems: "center" }}>
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
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Xuất khẩu Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <Download size={15} />
            <ChevronDown size={13} />
          </button>
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
          title="Tùy chỉnh cột"
          onClick={() => notify?.("Tùy chỉnh cột hiển thị")}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* 3. Main Sheet Content matching Screenshot 2 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          background: "#ffffff",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* Sheet Header */}
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h1
              style={{
                fontSize: 15.5,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.2px",
                margin: "0 0 6px 0",
              }}
            >
              BÁO CÁO PHÂN TÍCH CHI TIẾT CHI PHÍ THEO NHIỀU CHI NHÁNH
            </h1>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
              }}
            >
              Tháng 10 năm 2026
            </div>
          </div>

          {/* Table Container */}
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
                fontSize: 13,
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
                      width: "48%",
                    }}
                  >
                    Chỉ tiêu
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "16%",
                    }}
                  >
                    Mã số
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "18%",
                    }}
                  >
                    Kỳ này
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "18%",
                    }}
                  >
                    Lũy kế từ đầu năm
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => {
                    const currFmt = formatCell(row.currentPeriod);
                    const accumFmt = formatCell(row.accumulatedYear);
                    const isClickable = row.currentPeriod !== undefined && row.currentPeriod !== 0;

                    return (
                      <tr
                        key={idx}
                        style={{
                          background: "#ffffff",
                          cursor: isClickable ? "pointer" : "default",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isClickable
                            ? "#f0fdf4"
                            : "#f8fafc";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                        }}
                        onClick={() => {
                          if (isClickable) {
                            setDrilldownItem({
                              target: row.target,
                              code: row.code,
                              amount: row.currentPeriod || 0,
                            });
                          }
                        }}
                      >
                        {/* Chỉ tiêu */}
                        <td
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: "7px 12px",
                            paddingLeft: 12 + (row.indent || 0) * 20,
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
                            padding: "7px 12px",
                            fontWeight: row.isBold ? 700 : 400,
                            color: row.isBold ? "#0f172a" : "#334155",
                          }}
                        >
                          {row.code}
                        </td>

                        {/* Kỳ này */}
                        <td
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: "7px 12px",
                            textAlign: "right",
                            fontWeight: row.isBold ? 700 : 400,
                            color: currFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                          }}
                        >
                          {currFmt.text}
                        </td>

                        {/* Lũy kế từ đầu năm */}
                        <td
                          style={{
                            border: "1px solid #e2e8f0",
                            padding: "7px 12px",
                            textAlign: "right",
                            fontWeight: row.isBold ? 700 : 400,
                            color: accumFmt.isNegative ? "#dc2626" : row.isBold ? "#0f172a" : "#334155",
                          }}
                        >
                          {accumFmt.text}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  /* Empty state matching Screenshot 2 */
                  <tr>
                    <td colSpan={4} style={{ padding: "60px 20px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 12,
                        }}
                      >
                        {/* Clean MISA Empty State SVG Graphic */}
                        <svg
                          width="120"
                          height="80"
                          viewBox="0 0 120 80"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <ellipse cx="60" cy="62" rx="42" ry="10" fill="#f1f5f9" />
                          <path
                            d="M42 22C42 18.6863 44.6863 16 48 16H66L78 28V58C78 61.3137 75.3137 64 72 64H48C44.6863 64 42 61.3137 42 58V22Z"
                            fill="#ffffff"
                            stroke="#cbd5e1"
                            strokeWidth="2"
                          />
                          <path d="M66 16V28H78" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
                          <line x1="50" y1="36" x2="68" y2="36" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
                          <line x1="50" y1="44" x2="64" y2="44" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                          {/* Magnifying Glass */}
                          <circle cx="74" cy="46" r="14" fill="#ffffff" stroke="#00a862" strokeWidth="3" />
                          <circle cx="74" cy="46" r="9" fill="#f0fdf4" />
                          <line x1="84" y1="56" x2="94" y2="66" stroke="#00a862" strokeWidth="3.5" strokeLinecap="round" />
                          <circle cx="98" cy="38" r="2" fill="#10b981" />
                          <circle cx="34" cy="30" r="1.5" fill="#94a3b8" />
                        </svg>
                        <div
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            fontWeight: 500,
                          }}
                        >
                          Không có dữ liệu
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Parameter Drawer matching Screenshot 1 */}
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
              {/* Kỳ báo cáo * */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    marginBottom: 6,
                    color: "#0f172a",
                  }}
                >
                  Kỳ báo cáo <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={draftPeriod}
                    onChange={(e) => setDraftPeriod(e.target.value)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 30px 0 10px",
                      border: "1px solid #10b981",
                      borderRadius: 4,
                      background: "#ffffff",
                      fontSize: 13,
                      outline: "none",
                      appearance: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="Hôm nay">Hôm nay</option>
                    <option value="Tuần này">Tuần này</option>
                    <option value="Tháng này">Tháng này</option>
                    <option value="Tháng trước">Tháng trước</option>
                    <option value="Quý này">Quý này</option>
                    <option value="Quý trước">Quý trước</option>
                    <option value="Năm nay">Năm nay</option>
                    <option value="Năm trước">Năm trước</option>
                  </select>
                  <ChevronDown
                    size={16}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: 9,
                      color: "#10b981",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {/* Từ ngày / Đến ngày */}
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
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      onChange={(e) => setDraftFromDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 32px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar
                      size={15}
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

                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      color: "#334155",
                      marginBottom: 6,
                    }}
                  >
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      onChange={(e) => setDraftToDate(e.target.value)}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 32px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar
                      size={15}
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
              </div>

              {/* Chi phí phân tích matching Screenshot 1 */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 10,
                  }}
                >
                  Chi phí phân tích
                </label>
                <div style={{ display: "flex", gap: 24 }}>
                  {/* Left Column */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftFilterCogs}
                        onChange={(e) => setDraftFilterCogs(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Giá vốn</span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftFilterKmcp}
                        onChange={(e) => setDraftFilterKmcp(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Chi phí theo KMCP</span>
                    </label>
                  </div>

                  {/* Right Column */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftFilterFinance}
                        onChange={(e) => setDraftFilterFinance(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Chi phí tài chính</span>
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#0f172a",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftFilterOther}
                        onChange={(e) => setDraftFilterOther(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Chi phí khác</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Cấp khoản mục chi phí matching Screenshot 1 */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Cấp khoản mục chi phí
                </label>
                <div style={{ position: "relative" }}>
                  <select
                    value={draftExpenseLevel}
                    onChange={(e) => setDraftExpenseLevel(e.target.value)}
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
                      cursor: "pointer",
                    }}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="Tất cả">Tất cả</option>
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

      {/* 5. Drilldown Modal */}
      {drilldownItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            padding: 20,
          }}
          onClick={() => setDrilldownItem(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "85vh",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  Chi tiết chứng từ chi phí - {drilldownItem.target} ({drilldownItem.code})
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Tổng chi phí phát sinh:{" "}
                  <strong>{drilldownItem.amount.toLocaleString("vi-VN")} đ</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrilldownItem(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                  border: "1px solid #cbd5e1",
                }}
              >
                <thead>
                  <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700 }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Ngày HT</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Số chứng từ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left" }}>
                      Diễn giải
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>TK Nợ</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>TK Có</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right" }}>
                      Số tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      05/10/2026
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "8px 10px",
                        textAlign: "center",
                        color: "#0284c7",
                        fontWeight: 600,
                      }}
                    >
                      XK00008
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      Xuất kho giá vốn bán hàng hóa theo hóa đơn 00012
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      632
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      156
                    </td>
                    <td
                      style={{
                        border: "1px solid #e2e8f0",
                        padding: "8px 10px",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {drilldownItem.amount.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "10px 16px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => notify?.("Đã xuất khẩu chứng từ ra Excel.")}
                style={{
                  height: 30,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={() => setDrilldownItem(null)}
                style={{
                  height: 30,
                  padding: "0 18px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Saved Reports Modal */}
      {isSavedReportsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            padding: 20,
          }}
          onClick={() => setIsSavedReportsOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 680,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 45px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Danh sách mẫu báo cáo đã lưu
              </h3>
              <button
                type="button"
                onClick={() => setIsSavedReportsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0" }}>
              Hiện chưa có mẫu báo cáo tùy chỉnh nào được lưu cho báo cáo này.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setIsSavedReportsOpen(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
