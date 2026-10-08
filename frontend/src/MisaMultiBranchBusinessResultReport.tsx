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

export interface MultiBranchBusinessRow {
  target: string;
  code: string;
  currentPeriod?: number;
  prevPeriod?: number;
  samePeriodLastYear?: number;
  isBold?: boolean;
  isBlueLink?: boolean;
  indent?: number; // 0, 1, 2
}

const DEFAULT_ROWS: MultiBranchBusinessRow[] = [
  {
    target: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    currentPeriod: 20000000,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    currentPeriod: 20000000,
    isBold: true,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "4. Giá vốn hàng bán",
    code: "11",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    currentPeriod: 20000000,
    isBold: true,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "7. Doanh thu hoạt động tài chính",
    code: "22",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "7.1. Lãi từ đánh giá lại tài khoản ngoại tệ",
    code: "22.1",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 1,
  },
  {
    target: "7.2. Doanh thu hoạt động tài chính",
    code: "22.2",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 1,
  },
  {
    target: "8. Chi phí tài chính",
    code: "23",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "8.1. Lỗ từ đánh giá lại tài khoản ngoại tệ",
    code: "23.1",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 1,
  },
  {
    target: "8.2 Chi phí tài chính",
    code: "23.2",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 1,
  },
  {
    target: "- Trong đó: Chi phí lãi vay",
    code: "24",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 1,
  },
  {
    target: "9. Chi phí bán hàng",
    code: "25",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    currentPeriod: 20000000,
    isBold: true,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "12. Thu nhập khác",
    code: "31",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "12.1. Lãi từ thanh lý TSCĐ",
    code: "31.1",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 1,
  },
  {
    target: "12.2 Thu nhập khác",
    code: "31.2",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 1,
  },
  {
    target: "13. Chi phí khác",
    code: "32",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "13.1. Lỗ từ thanh lý TSCĐ",
    code: "32.1",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 1,
  },
  {
    target: "13.2. Chi phí khác",
    code: "32.2",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 1,
  },
  {
    target: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    currentPeriod: 20000000,
    isBold: true,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: true,
    indent: 0,
  },
  {
    target: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    currentPeriod: 20000000,
    isBold: true,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 0,
  },
  {
    target: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    currentPeriod: undefined,
    isBold: false,
    isBlueLink: false,
    indent: 0,
  },
];

export interface MisaMultiBranchBusinessResultReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchBusinessResultReport({
  onBack,
  notify,
}: MisaMultiBranchBusinessResultReportProps) {
  // Drawer Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");

  // Draft state inside drawer
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");

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
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Báo cáo kết quả hoạt động kinh doanh theo nhiều chi nhánh.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
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
          row.code.toLowerCase().includes(kw)
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
      {/* 1. Top Header Bar matching Screenshot 4 */}
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
            Báo cáo kết quả hoạt động kinh doanh theo nhiều chi nhánh
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
                "Đã lưu Báo cáo kết quả hoạt động kinh doanh theo nhiều chi nhánh."
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
          justifyContent: "flex-end",
          padding: "8px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          gap: 10,
        }}
      >
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
            color: "#64748b",
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
            color: "#64748b",
            cursor: "pointer",
          }}
          title="Xuất khẩu Excel"
          onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
        >
          <Download size={15} />
          <ChevronDown size={13} />
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
          title="Tùy chỉnh cột"
          onClick={() => notify?.("Tùy chỉnh cột hiển thị")}
        >
          <Settings size={15} />
        </button>
      </div>

      {/* 3. Main Sheet Content matching Screenshot 4 & 5 */}
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
              BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH THEO NHIỀU CHI NHÁNH
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
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "10%",
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
                      width: "14%",
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
                      width: "14%",
                    }}
                  >
                    Kỳ trước
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
                      textAlign: "right",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "14%",
                    }}
                  >
                    Cùng kỳ năm trước
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const currFmt = formatCell(row.currentPeriod);
                  const prevFmt = formatCell(row.prevPeriod);
                  const sameFmt = formatCell(row.samePeriodLastYear);
                  const isClickable = row.isBlueLink || (row.currentPeriod !== undefined && row.currentPeriod !== 0);

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
                      {/* Chỉ tiêu (Blue link if isBlueLink matches Screenshots 4 & 5) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          paddingLeft: 12 + (row.indent || 0) * 16,
                          fontWeight: row.isBold ? 700 : 400,
                          color: row.isBlueLink
                            ? "#0284c7"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                          textDecoration: row.isBlueLink ? "underline" : "none",
                          textUnderlineOffset: 2,
                        }}
                      >
                        {row.target}
                      </td>

                      {/* Mã số */}
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

                      {/* Kỳ này */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: currFmt.isNegative
                            ? "#dc2626"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                        }}
                      >
                        {currFmt.text}
                      </td>

                      {/* Kỳ trước */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: prevFmt.isNegative
                            ? "#dc2626"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                        }}
                      >
                        {prevFmt.text}
                      </td>

                      {/* Cùng kỳ năm trước */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: sameFmt.isNegative
                            ? "#dc2626"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                        }}
                      >
                        {sameFmt.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. Parameter Drawer matching Screenshot 3 */}
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
                  Chi tiết chỉ tiêu - {drilldownItem.target} (Mã số: {drilldownItem.code})
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Số tiền phát sinh kỳ này:{" "}
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
                      BH00012
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      Bán hàng hóa linh kiện màn hình vi tính theo HĐ 00012
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
