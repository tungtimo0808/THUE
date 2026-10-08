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
  Filter,
} from "lucide-react";

export interface MultiBranchRevenueExpenseRow {
  target: string;
  code: string;
  currentPeriod?: number;
  accumulatedYear?: number;
  isBold?: boolean;
  indent?: number; // 0, 1, 2, 3
  isHeading?: boolean;
}

const DEFAULT_ROWS: MultiBranchRevenueExpenseRow[] = [
  {
    target: "DOANH THU",
    code: "I",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: true,
    indent: 0,
    isHeading: true,
  },
  {
    target: "Doanh thu từ bán hàng hóa và cung cấp dịch vụ",
    code: "I.1",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: true,
    indent: 1,
  },
  {
    target: "Doanh thu bán hàng",
    code: "I.1.1",
    currentPeriod: 20000000,
    accumulatedYear: 20000000,
    isBold: false,
    indent: 2,
  },
  {
    target: "Các khoản giảm trừ doanh thu",
    code: "I.2",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "Doanh thu tài chính",
    code: "I.3",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "Thu nhập khác",
    code: "I.4",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "CHI PHÍ",
    code: "II",
    currentPeriod: 12525000,
    accumulatedYear: 12525000,
    isBold: true,
    indent: 0,
    isHeading: true,
  },
  {
    target: "Giá vốn hàng bán",
    code: "II.1",
    currentPeriod: 12525000,
    accumulatedYear: 12525000,
    isBold: false,
    indent: 1,
  },
  {
    target: "Chi phí bán hàng và QLDN",
    code: "II.2",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "Chi phí tài chính",
    code: "II.3",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "Chi phí khác",
    code: "II.4",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 1,
  },
  {
    target: "LỢI NHUẬN",
    code: "III",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: true,
    indent: 0,
    isHeading: true,
  },
  {
    target: "Tổng lợi nhuận trước thuế (I - II)",
    code: "III.1",
    currentPeriod: 7475000,
    accumulatedYear: 7475000,
    isBold: true,
    indent: 1,
  },
  {
    target: "Lợi nhuận từ việc bán hàng và cung cấp dịch vụ (I.1 - I.2 - II.1 - II.2)",
    code: "III.1.1",
    currentPeriod: 7475000,
    accumulatedYear: 7475000,
    isBold: false,
    indent: 2,
  },
  {
    target: "Trong đó: Lợi nhuận gộp (I.1 - I.2 - II.1)",
    code: "III.1.1.1",
    currentPeriod: 7475000,
    accumulatedYear: 7475000,
    isBold: false,
    indent: 3,
  },
  {
    target: "Lợi nhuận tài chính (I.3 - II.3)",
    code: "III.1.2",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "Lợi nhuận khác (I.4 - II.4)",
    code: "III.1.3",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "Thuế TNDN",
    code: "III.2",
    currentPeriod: undefined,
    accumulatedYear: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "Lợi nhuận sau thuế (III.1 - III.2)",
    code: "III.3",
    currentPeriod: 7475000,
    accumulatedYear: 7475000,
    isBold: true,
    indent: 1,
  },
];

export interface MisaMultiBranchRevenueExpenseReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchRevenueExpenseReport({
  onBack,
  notify,
}: MisaMultiBranchRevenueExpenseReportProps) {
  // Drawer Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [expenseAnalysisBy, setExpenseAnalysisBy] = useState<"item" | "account">("item");
  const [expenseLevel, setExpenseLevel] = useState("1");

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftExpenseAnalysisBy, setDraftExpenseAnalysisBy] = useState<"item" | "account">("item");
  const [draftExpenseLevel, setDraftExpenseLevel] = useState("1");

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    code: string;
    target: string;
    amount: number;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftExpenseAnalysisBy(expenseAnalysisBy);
    setDraftExpenseLevel(expenseLevel);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setExpenseAnalysisBy(draftExpenseAnalysisBy);
    setExpenseLevel(draftExpenseLevel);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí với tham số mới.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftExpenseAnalysisBy("item");
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

  // Filter rows
  const filteredRows = useMemo(() => {
    return DEFAULT_ROWS.filter((row) => {
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.code.toLowerCase().includes(kw) ||
          row.target.toLowerCase().includes(kw)
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
      {/* 1. Top Header Bar matching Screenshot */}
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
            Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều chi nhánh
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
              notify?.(
                "Đã lưu Báo cáo kết quả hoạt động kinh doanh chi tiết doanh thu và chi phí theo nhiều chi nhánh."
              )
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#475569",
              cursor: "pointer",
            }}
            title="Bộ lọc nâng cao"
            onClick={() => notify?.("Mở bảng lọc dữ liệu nâng cao")}
          >
            <Filter size={15} />
          </button>
          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#475569",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột hiển thị"
            onClick={() => notify?.("Tùy chỉnh các cột chi nhánh hiển thị")}
          >
            <Settings size={15} />
          </button>
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
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                height: 30,
                width: 210,
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
            title="Xuất khẩu Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra file Excel...")}
          >
            <Download size={15} />
          </button>
        </div>
      </div>

      {/* 3. Main Sheet Content matching Screenshot 4 */}
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
              BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH CHI TIẾT DOANH THU VÀ CHI PHÍ THEO NHIỀU CHI NHÁNH
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
                      width: "55%",
                    }}
                  >
                    Chỉ tiêu
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "15%",
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
                      width: "15%",
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
                      width: "15%",
                    }}
                  >
                    Lũy kế năm
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
                        background: row.isHeading ? "#fcfdfd" : "#ffffff",
                        cursor: isClickable ? "pointer" : "default",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isClickable
                          ? "#f0fdf4"
                          : "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = row.isHeading
                          ? "#fcfdfd"
                          : "#ffffff";
                      }}
                      onClick={() => {
                        if (isClickable) {
                          setDrilldownItem({
                            code: row.code,
                            target: row.target,
                            amount: row.currentPeriod || 0,
                          });
                        }
                      }}
                    >
                      {/* Target Name */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          paddingLeft: 12 + (row.indent || 0) * 18,
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {row.target}
                      </td>

                      {/* Code */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBold ? "#0f172a" : "#334155",
                        }}
                      >
                        {row.code}
                      </td>

                      {/* Current Period */}
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

                      {/* Accumulated Year */}
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
          </div>
        </div>
      </div>

      {/* 4. Parameter Drawer ("Chọn tham số") matching Screenshot 3 */}
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
            {/* Drawer Header matching Screenshot 3 */}
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

            {/* Drawer Body matching Screenshot 3 */}
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

              {/* Chi phí bán hàng và QLDN phân tích theo matching Screenshot 3 */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12.5,
                    color: "#334155",
                    marginBottom: 10,
                  }}
                >
                  Chi phí bán hàng và QLDN phân tích theo
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
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
                      type="radio"
                      name="expenseAnalysisBy"
                      checked={draftExpenseAnalysisBy === "item"}
                      onChange={() => setDraftExpenseAnalysisBy("item")}
                      style={{
                        accentColor: "#00a862",
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                      }}
                    />
                    <span>Khoản mục chi phí</span>
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
                      type="radio"
                      name="expenseAnalysisBy"
                      checked={draftExpenseAnalysisBy === "account"}
                      onChange={() => setDraftExpenseAnalysisBy("account")}
                      style={{
                        accentColor: "#00a862",
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                      }}
                    />
                    <span>Tài khoản chi phí</span>
                  </label>
                </div>
              </div>

              {/* Cấp khoản mục chi phí matching Screenshot 3 */}
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

            {/* Drawer Footer matching Screenshot 3 */}
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

      {/* 5. Drilldown Modal (Sổ chi tiết / Chứng từ liên quan) */}
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
                  Chi tiết chứng từ phát sinh - {drilldownItem.target} ({drilldownItem.code})
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Tổng số tiền kỳ này:{" "}
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

            {/* Modal Body: Sample journal entries */}
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
                      BH00012
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      {drilldownItem.code.startsWith("II")
                        ? "Xuất kho bán hàng theo hóa đơn 00012"
                        : "Bán hàng hóa linh kiện máy vi tính theo HĐ 00012"}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      {drilldownItem.code.startsWith("II") ? "632" : "131"}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center" }}>
                      {drilldownItem.code.startsWith("II") ? "156" : "511"}
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
