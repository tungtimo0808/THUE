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

export interface MultiBranchTrialBalanceRow {
  accountCode: string;
  accountName: string;
  openDebit?: number;
  openCredit?: number;
  occurDebit?: number;
  occurCredit?: number;
  accumDebit?: number;
  accumCredit?: number;
  closeDebit?: number;
  closeCredit?: number;
}

const DEFAULT_ROWS: MultiBranchTrialBalanceRow[] = [
  {
    accountCode: "111",
    accountName: "Tiền mặt",
    occurCredit: 10000000,
    accumCredit: 10000000,
    closeDebit: -10000000,
  },
  {
    accountCode: "112",
    accountName: "Tiền gửi không kỳ hạn",
    occurCredit: 10000000,
    accumCredit: 10000000,
    closeDebit: -10000000,
  },
  {
    accountCode: "131",
    accountName: "Phải thu của khách hàng",
    occurDebit: 20000000,
    accumDebit: 20000000,
    closeDebit: 20000000,
  },
  {
    accountCode: "133",
    accountName: "Thuế GTGT được khấu trừ",
    occurDebit: 20000000,
    accumDebit: 20000000,
    closeDebit: 2000000,
  },
  {
    accountCode: "141",
    accountName: "Tạm ứng",
    occurDebit: 10000000,
    accumDebit: 10000000,
    closeDebit: 10000000,
  },
  {
    accountCode: "156",
    accountName: "Hàng hóa",
    occurDebit: 25000000,
    occurCredit: 12525000,
    accumDebit: 25000000,
    accumCredit: 12525000,
    closeDebit: 12475000,
  },
  {
    accountCode: "331",
    accountName: "Phải trả cho người bán",
    occurDebit: 10000000,
    occurCredit: 27000000,
    accumDebit: 10000000,
    accumCredit: 27000000,
    closeCredit: 17000000,
  },
  {
    accountCode: "511",
    accountName: "Doanh thu bán hàng và cung cấp dịch vụ",
    occurCredit: 20000000,
    accumCredit: 20000000,
    closeCredit: 20000000,
  },
  {
    accountCode: "632",
    accountName: "Giá vốn hàng bán",
    occurDebit: 12525000,
    accumDebit: 12525000,
    closeDebit: 12525000,
  },
];

export interface MisaMultiBranchTrialBalanceReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaMultiBranchTrialBalanceReport({
  onBack,
  notify,
}: MisaMultiBranchTrialBalanceReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [period, setPeriod] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [accountLevel, setAccountLevel] = useState("1");
  const [showTwoSideBalance, setShowTwoSideBalance] = useState(true);
  const [accumSource, setAccumSource] = useState<"dataStart" | "fiscalStart">("fiscalStart");

  // Temporary drawer draft state
  const [draftPeriod, setDraftPeriod] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftAccountLevel, setDraftAccountLevel] = useState("1");
  const [draftShowTwoSideBalance, setDraftShowTwoSideBalance] = useState(true);
  const [draftAccumSource, setDraftAccumSource] = useState<"dataStart" | "fiscalStart">("fiscalStart");

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    code: string;
    name: string;
  } | null>(null);

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccountLevel(accountLevel);
    setDraftShowTwoSideBalance(showTwoSideBalance);
    setDraftAccumSource(accumSource);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setAccountLevel(draftAccountLevel);
    setShowTwoSideBalance(draftShowTwoSideBalance);
    setAccumSource(draftAccumSource);
    setIsParamDrawerOpen(false);
    notify?.("Đã tải lại Bảng cân đối tài khoản theo nhiều chi nhánh với tham số mới.");
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftAccountLevel("1");
    setDraftShowTwoSideBalance(true);
    setDraftAccumSource("fiscalStart");
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
          row.accountCode.toLowerCase().includes(kw) ||
          row.accountName.toLowerCase().includes(kw)
        );
      }
      return true;
    });
  }, [searchKeyword]);

  // Compute totals
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.occurDebit += r.occurDebit || 0;
        acc.occurCredit += r.occurCredit || 0;
        acc.accumDebit += r.accumDebit || 0;
        acc.accumCredit += r.accumCredit || 0;
        acc.closeDebit += (r.closeDebit && r.closeDebit > 0 ? r.closeDebit : 0);
        acc.closeCredit += r.closeCredit || 0;
        return acc;
      },
      {
        openDebit: 0,
        openCredit: 0,
        occurDebit: 0,
        occurCredit: 0,
        accumDebit: 0,
        accumCredit: 0,
        closeDebit: 0,
        closeCredit: 0,
      }
    );
  }, [filteredRows]);

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
            Bảng cân đối tài khoản theo nhiều chi nhánh
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
            onClick={() => notify?.("Đã lưu Bảng cân đối tài khoản theo nhiều chi nhánh.")}
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
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              cursor: "pointer",
            }}
            title="Lọc nhanh"
            onClick={handleOpenDrawer}
          >
            <Filter size={14} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: "100%",
                height: 30,
                padding: "0 10px 0 32px",
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
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Nạp lại"
            onClick={() => notify?.("Đã nạp lại dữ liệu báo cáo.")}
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở chức năng gửi email báo cáo.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Trợ giúp"
            onClick={() => notify?.("Hệ thống trợ giúp AVA Kế toán.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đang chuẩn bị lệnh in...")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              height: 30,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "#334155",
              fontSize: 12.5,
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã xuất khẩu báo cáo ra Excel thành công.")}
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{
              width: 30,
              height: 30,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột"
            onClick={() => notify?.("Mở thiết lập cột báo cáo.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Sheet Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          background: "#ffffff",
          margin: 16,
          borderRadius: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: "#0f172a",
              textTransform: "uppercase",
              letterSpacing: "0.2px",
            }}
          >
            BẢNG CÂN ĐỐI TÀI KHOẢN THEO NHIỀU CHI NHÁNH
          </h1>
          <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
            Tháng 10 năm 2026
          </div>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12.5,
            border: "1px solid #cbd5e1",
          }}
        >
          <thead>
            <tr
              style={{
                background: "#e2f0d9",
                borderBottom: "1px solid #cbd5e1",
                color: "#1e293b",
                fontWeight: 700,
              }}
            >
              <th
                rowSpan={2}
                style={{
                  padding: "8px 10px",
                  textAlign: "left",
                  width: 90,
                  borderRight: "1px solid #c2d9b8",
                  verticalAlign: "middle",
                }}
              >
                Số tài khoản
              </th>
              <th
                rowSpan={2}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  minWidth: 160,
                  borderRight: "1px solid #c2d9b8",
                  verticalAlign: "middle",
                }}
              >
                Tên tài khoản
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 110 }}>
                Nợ đầu kỳ
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 110 }}>
                Có đầu kỳ
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 115 }}>
                Phát sinh Nợ trong kỳ
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 115 }}>
                Phát sinh Có trong kỳ
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 115 }}>
                Nợ lũy kế phát sinh
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 115 }}>
                Có lũy kế phát sinh
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", borderRight: "1px solid #c2d9b8", width: 110 }}>
                Nợ cuối kỳ
              </th>
              <th style={{ padding: "6px 8px", textAlign: "center", width: 110 }}>
                Có cuối kỳ
              </th>
            </tr>
            <tr
              style={{
                background: "#e2f0d9",
                borderBottom: "1px solid #cbd5e1",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 11.5,
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <th
                  key={i}
                  style={{
                    padding: "5px 6px",
                    textAlign: "center",
                    borderRight: i < 7 ? "1px solid #c2d9b8" : "none",
                  }}
                >
                  81ehd8ngkphy
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => {
              const cCloseDeb = formatCell(row.closeDebit);
              const cCloseCred = formatCell(row.closeCredit);

              return (
                <tr
                  key={row.accountCode}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                  }}
                >
                  <td
                    onClick={() => setDrilldownItem({ code: row.accountCode, name: row.accountName })}
                    style={{
                      padding: "7px 10px",
                      borderRight: "1px solid #f1f5f9",
                      fontWeight: 600,
                      color: "#0073e6",
                      cursor: "pointer",
                    }}
                  >
                    {row.accountCode}
                  </td>
                  <td
                    style={{
                      padding: "7px 12px",
                      borderRight: "1px solid #f1f5f9",
                      color: "#1e293b",
                    }}
                  >
                    {row.accountName}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.openDebit).text}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.openCredit).text}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.occurDebit).text}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.occurCredit).text}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.accumDebit).text}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", borderRight: "1px solid #f1f5f9" }}>
                    {formatCell(row.accumCredit).text}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: cCloseDeb.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: cCloseDeb.isNegative ? 600 : 400,
                    }}
                  >
                    {cCloseDeb.text}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "right",
                      color: cCloseCred.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: cCloseCred.isNegative ? 600 : 400,
                    }}
                  >
                    {cCloseCred.text}
                  </td>
                </tr>
              );
            })}

            {/* Total Row matching Screenshot 2 */}
            <tr
              style={{
                background: "#f8fafc",
                fontWeight: 700,
                borderTop: "2px solid #cbd5e1",
                borderBottom: "1px solid #cbd5e1",
              }}
            >
              <td colSpan={2} style={{ padding: "9px 12px", borderRight: "1px solid #e2e8f0", color: "#0f172a" }}>
                Tổng cộng
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                {totals.occurDebit.toLocaleString("vi-VN")}
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                {totals.occurCredit.toLocaleString("vi-VN")}
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                {totals.accumDebit.toLocaleString("vi-VN")}
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                {totals.accumCredit.toLocaleString("vi-VN")}
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                {totals.closeDebit.toLocaleString("vi-VN")}
              </td>
              <td style={{ padding: "9px 8px", textAlign: "right" }}>
                {totals.closeCredit.toLocaleString("vi-VN")}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. Footer Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 4px 0",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <div>
            Tổng số: <strong>{filteredRows.length}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                style={{
                  height: 26,
                  padding: "0 6px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: 12.5,
                }}
                defaultValue="20"
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &lt;
              </button>
              <span
                style={{
                  minWidth: 26,
                  height: 26,
                  padding: "0 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid #00a862",
                  borderRadius: 4,
                  background: "#e6f7ef",
                  color: "#00a862",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  width: 26,
                  height: 26,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  borderRadius: 4,
                  color: "#94a3b8",
                  cursor: "not-allowed",
                }}
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer "Chọn tham số" matching Screenshot 1 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(1px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Giúp"
                  onClick={() =>
                    notify?.("Xem hướng dẫn lập Bảng cân đối tài khoản theo nhiều chi nhánh.")
                  }
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "20px 24px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontSize: 13,
              }}
            >
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftPeriod(val);
                    if (val === "Tháng này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/10/2026");
                    } else if (val === "Tháng trước") {
                      setDraftFromDate("01/09/2026");
                      setDraftToDate("30/09/2026");
                    } else if (val === "Quý này") {
                      setDraftFromDate("01/10/2026");
                      setDraftToDate("31/12/2026");
                    } else if (val === "Năm nay") {
                      setDraftFromDate("01/01/2026");
                      setDraftToDate("31/12/2026");
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
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
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
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
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                  Bậc tài khoản
                </label>
                <select
                  value={draftAccountLevel}
                  onChange={(e) => setDraftAccountLevel(e.target.value)}
                  style={{
                    width: "100%",
                    height: 34,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="all">Tất cả</option>
                </select>
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={draftShowTwoSideBalance}
                    onChange={(e) => setDraftShowTwoSideBalance(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Hiển thị số dư hai bên</span>
                </label>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600, color: "#334155" }}>
                  Lấy lũy kế phát sinh từ
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="radio"
                      name="accumSource"
                      value="dataStart"
                      checked={draftAccumSource === "dataStart"}
                      onChange={() => setDraftAccumSource("dataStart")}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Ngày bắt đầu dữ liệu</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="radio"
                      name="accumSource"
                      value="fiscalStart"
                      checked={draftAccumSource === "fiscalStart"}
                      onChange={() => setDraftAccumSource("fiscalStart")}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Ngày bắt đầu năm tài chính của kỳ báo cáo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer matching Screenshot 1 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 16px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#334155",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                onClick={handleResetParams}
              >
                Xóa điều kiện
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  style={{
                    height: 34,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={handleApplyParams}
                >
                  Xem báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Drilldown Modal */}
      {drilldownItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDrilldownItem(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 720,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Sổ chi tiết tài khoản {drilldownItem.code} - {drilldownItem.name}
              </h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setDrilldownItem(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#475569" }}>
              Chi nhánh: <strong>81ehd8ngkphy</strong> (Kỳ: {fromDate} - {toDate})
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
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
                onClick={() => setDrilldownItem(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Saved Reports Modal */}
      {isSavedReportsOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setIsSavedReportsOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 580,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Danh sách báo cáo đã lưu</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#64748b" }}>Chưa có báo cáo đã lưu trong kỳ này.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
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
                onClick={() => setIsSavedReportsOpen(false)}
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
