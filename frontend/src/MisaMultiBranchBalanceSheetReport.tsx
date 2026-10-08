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

export interface BalanceSheetRow {
  target: string;
  code: string;
  note?: string;
  closeAmount?: number;
  openAmount?: number;
  isBold?: boolean;
  isSection?: boolean;
  indent?: number; // 0, 1, 2
}

const DEFAULT_ROWS: BalanceSheetRow[] = [
  // TÀI SẢN
  { target: "TÀI SẢN", code: "", isBold: true, isSection: true, indent: 0 },
  {
    target: "A. TÀI SẢN NGẮN HẠN",
    code: "100",
    closeAmount: 24475000,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },
  {
    target: "I. Tiền và các khoản tương đương tiền",
    code: "110",
    note: "V.1",
    closeAmount: -20000000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Tiền",
    code: "111",
    closeAmount: -20000000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Các khoản tương đương tiền",
    code: "112",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "II. Đầu tư tài chính ngắn hạn",
    code: "120",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Chứng khoán kinh doanh",
    code: "121",
    note: "V.2(a)",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Dự phòng giảm giá chứng khoán kinh doanh (*)",
    code: "122",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Đầu tư nắm giữ đến ngày đáo hạn",
    code: "123",
    note: "V.2(b)",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Dự phòng đầu tư nắm giữ đến ngày đáo hạn ngắn hạn (*)",
    code: "124",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Đầu tư ngắn hạn khác",
    code: "125",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Dự phòng tổn thất các khoản đầu tư ngắn hạn khác (*)",
    code: "126",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "III. Các khoản phải thu ngắn hạn",
    code: "130",
    closeAmount: 30000000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Phải thu ngắn hạn của khách hàng",
    code: "131",
    note: "V.3(a)",
    closeAmount: 20000000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Trả trước cho người bán ngắn hạn",
    code: "132",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Phải thu nội bộ ngắn hạn",
    code: "133",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "4. Phải thu theo tiến độ kế hoạch hợp đồng xây dựng",
    code: "134",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "5. Phải thu về cho vay ngắn hạn",
    code: "135",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "6. Phải thu ngắn hạn khác",
    code: "136",
    closeAmount: 10000000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "7. Dự phòng phải thu ngắn hạn khó đòi (*)",
    code: "137",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "8. Tài sản thiếu chờ xử lý",
    code: "139",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "IV. Hàng tồn kho",
    code: "140",
    note: "V.4",
    closeAmount: 12475000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Hàng tồn kho",
    code: "141",
    closeAmount: 12475000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Dự phòng giảm giá hàng tồn kho (*)",
    code: "149",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "V. Tài sản ngắn hạn khác",
    code: "150",
    closeAmount: 2000000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Chi phí trả trước ngắn hạn",
    code: "151",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Thuế GTGT được khấu trừ",
    code: "152",
    closeAmount: 2000000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Thuế và các khoản khác phải thu Nhà nước",
    code: "153",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "B. TÀI SẢN DÀI HẠN",
    code: "200",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },
  {
    target: "TỔNG CỘNG TÀI SẢN (270 = 100 + 200)",
    code: "270",
    closeAmount: 24475000,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },

  // NGUỒN VỐN
  { target: "NGUỒN VỐN", code: "", isBold: true, isSection: true, indent: 0 },
  {
    target: "C. NỢ PHẢI TRẢ",
    code: "300",
    closeAmount: 17000000,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },
  {
    target: "I. Nợ ngắn hạn",
    code: "310",
    closeAmount: 17000000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Phải trả người bán ngắn hạn",
    code: "311",
    note: "V.11",
    closeAmount: 17000000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "2. Người mua trả tiền trước ngắn hạn",
    code: "312",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "3. Thuế và các khoản phải nộp Nhà nước",
    code: "313",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "D. VỐN CHỦ SỞ HỮU",
    code: "400",
    closeAmount: 7475000,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },
  {
    target: "I. Vốn chủ sở hữu",
    code: "410",
    closeAmount: 7475000,
    openAmount: undefined,
    isBold: true,
    indent: 1,
  },
  {
    target: "1. Vốn góp của chủ sở hữu",
    code: "411",
    closeAmount: undefined,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "11. Lợi nhuận sau thuế chưa phân phối",
    code: "421",
    closeAmount: 7475000,
    openAmount: undefined,
    isBold: false,
    indent: 2,
  },
  {
    target: "TỔNG CỘNG NGUỒN VỐN (440 = 300 + 400)",
    code: "440",
    closeAmount: 24475000,
    openAmount: undefined,
    isBold: true,
    indent: 0,
  },
];

export interface MisaMultiBranchBalanceSheetReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchBalanceSheetReport({
  onBack,
  notify,
}: MisaMultiBranchBalanceSheetReportProps) {
  // Drawer Parameters State matching Screenshot 1
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
    notify?.("Đã tải lại Bảng cân đối kế toán theo nhiều chi nhánh với tham số mới.");
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
            Bảng cân đối kế toán theo nhiều chi nhánh
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
              notify?.("Đã lưu Bảng cân đối kế toán theo nhiều chi nhánh.")
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
              BẢNG CÂN ĐỐI KẾ TOÁN THEO NHIỀU CHI NHÁNH
            </h1>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
              }}
            >
              Tại ngày 31 tháng 10 năm 2026
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
                    rowSpan={2}
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
                    rowSpan={2}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "8%",
                    }}
                  >
                    Mã số
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "11%",
                    }}
                  >
                    Thuyết minh
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "18%",
                    }}
                  >
                    Số cuối kỳ
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "6px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      width: "18%",
                    }}
                  >
                    Số đầu kỳ
                  </th>
                </tr>
                {/* Subheader row showing branch ID 81ehd8ngkphy matching Screenshot 2 */}
                <tr style={{ background: "#e2f0d9" }}>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "5px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      fontSize: 12,
                    }}
                  >
                    81ehd8ngkphy
                  </th>
                  <th
                    style={{
                      border: "1px solid #cbd5e1",
                      padding: "5px 12px",
                      textAlign: "center",
                      fontWeight: 700,
                      color: "#1e293b",
                      fontSize: 12,
                    }}
                  >
                    81ehd8ngkphy
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const closeFmt = formatCell(row.closeAmount);
                  const openFmt = formatCell(row.openAmount);
                  const isClickable = row.closeAmount !== undefined && row.closeAmount !== 0;

                  return (
                    <tr
                      key={idx}
                      style={{
                        background: row.isSection ? "#fcfdfd" : "#ffffff",
                        cursor: isClickable ? "pointer" : "default",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isClickable
                          ? "#f0fdf4"
                          : "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = row.isSection
                          ? "#fcfdfd"
                          : "#ffffff";
                      }}
                      onClick={() => {
                        if (isClickable) {
                          setDrilldownItem({
                            target: row.target,
                            code: row.code,
                            amount: row.closeAmount || 0,
                          });
                        }
                      }}
                    >
                      {/* Chỉ tiêu */}
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

                      {/* Thuyết minh */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 10px",
                          color: "#334155",
                        }}
                      >
                        {row.note || ""}
                      </td>

                      {/* Số cuối kỳ (81ehd8ngkphy) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: closeFmt.isNegative
                            ? "#dc2626"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                        }}
                      >
                        {closeFmt.text}
                      </td>

                      {/* Số đầu kỳ (81ehd8ngkphy) */}
                      <td
                        style={{
                          border: "1px solid #e2e8f0",
                          padding: "7px 12px",
                          textAlign: "right",
                          fontWeight: row.isBold ? 700 : 400,
                          color: openFmt.isNegative
                            ? "#dc2626"
                            : row.isBold
                            ? "#0f172a"
                            : "#334155",
                        }}
                      >
                        {openFmt.text}
                      </td>
                    </tr>
                  );
                })}
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
                  Chi tiết chỉ tiêu - {drilldownItem.target} (Mã số: {drilldownItem.code})
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Số cuối kỳ:{" "}
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
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px" }}>Tài khoản</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "left" }}>
                      Tên tài khoản
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right" }}>
                      Dư Nợ cuối kỳ
                    </th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right" }}>
                      Dư Có cuối kỳ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>
                      {drilldownItem.code === "111" ? "111" : drilldownItem.code === "131" ? "131" : drilldownItem.code === "141" ? "156" : "331"}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      {drilldownItem.target}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>
                      {drilldownItem.amount > 0 ? drilldownItem.amount.toLocaleString("vi-VN") : ""}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "8px 10px", textAlign: "right", fontWeight: 600, color: drilldownItem.amount < 0 ? "#dc2626" : "inherit" }}>
                      {drilldownItem.amount < 0 ? `(${Math.abs(drilldownItem.amount).toLocaleString("vi-VN")})` : ""}
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
