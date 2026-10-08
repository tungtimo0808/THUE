import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronDown,
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
} from "lucide-react";

export interface DetailedRevenueRow {
  target: string;
  account?: string;
  currentPeriod?: number;
  accumulatedYear?: number;
  isBold?: boolean;
  indent?: number; // 0, 1, 2
  isUppercase?: boolean;
  itemCode?: string;
}

const DEFAULT_ROWS: DetailedRevenueRow[] = [
  {
    target: "DOANH THU BÁN HÀNG VÀ CUNG CẤP DỊCH VỤ",
    account: "511",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: true,
    indent: 0,
    isUppercase: true,
  },
  {
    target: "Doanh thu bán hàng",
    account: "5111",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: true,
    indent: 1,
    isUppercase: false,
  },
  {
    target: "Man hinh 21 LG inch",
    account: "5111",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: false,
    indent: 2,
    isUppercase: false,
    itemCode: "MH-LG21",
  },
  {
    target: "DOANH THU THUẦN BÁN HÀNG HÓA VÀ CUNG CẤP DỊCH VỤ",
    account: undefined,
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: true,
    indent: 0,
    isUppercase: true,
  },
  {
    target: "Man hinh 21 LG inch",
    account: undefined,
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: false,
    indent: 2,
    isUppercase: false,
    itemCode: "MH-LG21",
  },
];

export interface MisaMultiBranchDetailedRevenueReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchDetailedRevenueReport({
  onBack,
  notify,
}: MisaMultiBranchDetailedRevenueReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");

  // Doanh thu phân tích checkboxes
  const [analysisSales, setAnalysisSales] = useState(true);
  const [analysisFinance, setAnalysisFinance] = useState(false);
  const [analysisOther, setAnalysisOther] = useState(false);

  // Phân tích theo checkboxes
  const [byAccount, setByAccount] = useState(true);
  const [byCategory, setByCategory] = useState(false);
  const [byItem, setByItem] = useState(true);

  // Draft state inside drawer
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftAnalysisSales, setDraftAnalysisSales] = useState(true);
  const [draftAnalysisFinance, setDraftAnalysisFinance] = useState(false);
  const [draftAnalysisOther, setDraftAnalysisOther] = useState(false);
  const [draftByAccount, setDraftByAccount] = useState(true);
  const [draftByCategory, setDraftByCategory] = useState(false);
  const [draftByItem, setDraftByItem] = useState(true);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Pagination state matching Screenshot 2
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    target: string;
    account?: string;
    amount: number;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAnalysisSales(analysisSales);
    setDraftAnalysisFinance(analysisFinance);
    setDraftAnalysisOther(analysisOther);
    setDraftByAccount(byAccount);
    setDraftByCategory(byCategory);
    setDraftByItem(byItem);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setAnalysisSales(draftAnalysisSales);
    setAnalysisFinance(draftAnalysisFinance);
    setAnalysisOther(draftAnalysisOther);
    setByAccount(draftByAccount);
    setByCategory(draftByCategory);
    setByItem(draftByItem);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftAnalysisSales(true);
    setDraftAnalysisFinance(false);
    setDraftAnalysisOther(false);
    setDraftByAccount(true);
    setDraftByCategory(false);
    setDraftByItem(true);
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

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_ROWS.filter((row) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.target.toLowerCase().includes(kw) ||
          (row.account && row.account.toLowerCase().includes(kw))
        );
      }
      return true;
    });
  }, [searchKeyword]);

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
            Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh
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
              notify?.("Đã lưu Báo cáo phân tích chi tiết doanh thu theo nhiều chi nhánh.")
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
              BÁO CÁO PHÂN TÍCH CHI TIẾT DOANH THU THEO NHIỀU CHI NHÁNH
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
                      width: "50%",
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
                    Tài khoản
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "17%",
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
                      width: "17%",
                    }}
                  >
                    Lũy kế từ đầu năm
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
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
                            account: row.account,
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
                          textTransform: row.isUppercase ? "uppercase" : "none",
                        }}
                      >
                        {row.target}
                      </td>

                      {/* Tài khoản */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {row.account || ""}
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
                })}
              </tbody>
            </table>

            {/* Pagination Footer matching Screenshot 2 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 16px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                fontSize: 12.5,
                color: "#475569",
              }}
            >
              <div>
                Tổng số: <strong>{filteredRows.length}</strong>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>Số dòng/trang</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{
                      height: 26,
                      padding: "0 6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: "#ffffff",
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "default",
                      fontSize: 13,
                    }}
                  >
                    &lt;&lt;
                  </button>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "default",
                      fontSize: 13,
                    }}
                  >
                    &lt;
                  </button>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "#f1f5f9",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {currentPage}
                  </span>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "default",
                      fontSize: 13,
                    }}
                  >
                    &gt;
                  </button>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "default",
                      fontSize: 13,
                    }}
                  >
                    &gt;&gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Parameter Drawer ("Chọn tham số") matching Screenshot 1 */}
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
                      border: "1px solid #cbd5e1",
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
                      color: "#64748b",
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

              {/* Two-column Checkbox groups matching Screenshot 1 */}
              <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
                {/* Column 1: Doanh thu phân tích */}
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 10,
                    }}
                  >
                    Doanh thu phân tích
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                        checked={draftAnalysisSales}
                        onChange={(e) => setDraftAnalysisSales(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Doanh thu bán hàng hóa, dịch vụ</span>
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
                        checked={draftAnalysisFinance}
                        onChange={(e) => setDraftAnalysisFinance(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Doanh thu hoạt động tài chính</span>
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
                        checked={draftAnalysisOther}
                        onChange={(e) => setDraftAnalysisOther(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Thu nhập khác</span>
                    </label>
                  </div>
                </div>

                {/* Column 2: Phân tích theo */}
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 10,
                    }}
                  >
                    Phân tích theo
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                        checked={draftByAccount}
                        onChange={(e) => setDraftByAccount(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Tài khoản doanh thu</span>
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
                        checked={draftByCategory}
                        onChange={(e) => setDraftByCategory(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Nhóm vật tư hàng hóa</span>
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
                        checked={draftByItem}
                        onChange={(e) => setDraftByItem(e.target.checked)}
                        style={{
                          accentColor: "#00a862",
                          width: 16,
                          height: 16,
                          cursor: "pointer",
                        }}
                      />
                      <span>Vật tư hàng hóa</span>
                    </label>
                  </div>
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
                  Chi tiết chứng từ doanh thu - {drilldownItem.target} {drilldownItem.account ? `(${drilldownItem.account})` : ""}
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Tổng doanh thu phát sinh:{" "}
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
                      Khách hàng
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left" }}>
                      Tên hàng hóa
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
                      BH00012
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      Công ty Cổ phần Công nghệ Tin học Á Đông
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      Màn hình 21 inch LG IPS Full HD
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      131
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      5111
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
