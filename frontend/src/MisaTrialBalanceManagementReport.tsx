import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Search,
  RotateCw,
  Mail,
  MessageCircle,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Filter,
  Columns,
  Calendar,
  ChevronDown,
} from "lucide-react";

export interface TrialBalanceAccountItem {
  code: string;
  name: string;
  openingDebit?: number;
  openingCredit?: number;
  periodDebit?: number;
  periodCredit?: number;
  accumDebit?: number;
  accumCredit?: number;
  closingDebit?: number;
  closingCredit?: number;
}

// Exact 9 rows from MISA Screenshot
const DEFAULT_TRIAL_BALANCE_DATA: TrialBalanceAccountItem[] = [
  {
    code: "111",
    name: "Tiền mặt",
    periodCredit: 10000000,
    accumCredit: 10000000,
    closingDebit: -10000000, // Displays as (10.000.000) in red
  },
  {
    code: "112",
    name: "Tiền gửi không kỳ hạn",
    periodCredit: 10000000,
    accumCredit: 10000000,
    closingDebit: -10000000, // Displays as (10.000.000) in red
  },
  {
    code: "131",
    name: "Phải thu của khách hàng",
    periodDebit: 20000000,
    accumDebit: 20000000,
    closingDebit: 20000000,
  },
  {
    code: "133",
    name: "Thuế GTGT được khấu trừ",
    periodDebit: 2000000,
    accumDebit: 2000000,
    closingDebit: 2000000,
  },
  {
    code: "141",
    name: "Tạm ứng",
    periodDebit: 10000000,
    accumDebit: 10000000,
    closingDebit: 10000000,
  },
  {
    code: "156",
    name: "Hàng hóa",
    periodDebit: 25000000,
    periodCredit: 12525000,
    accumDebit: 25000000,
    accumCredit: 12525000,
    closingDebit: 12475000,
  },
  {
    code: "331",
    name: "Phải trả cho người bán",
    periodDebit: 10000000,
    periodCredit: 27000000,
    accumDebit: 10000000,
    accumCredit: 27000000,
    closingCredit: 17000000,
  },
  {
    code: "511",
    name: "Doanh thu bán hàng và cung cấp dịch vụ",
    periodCredit: 20000000,
    accumCredit: 20000000,
    closingCredit: 20000000,
  },
  {
    code: "632",
    name: "Giá vốn hàng bán",
    periodDebit: 12525000,
    accumDebit: 12525000,
    closingDebit: 12525000,
  },
];

function formatCurrency(val?: number): { text: string; isNegative: boolean } {
  if (val === undefined || val === null || val === 0) {
    return { text: "", isNegative: false };
  }
  if (val < 0) {
    const absVal = Math.abs(val);
    return { text: `(${absVal.toLocaleString("vi-VN")})`, isNegative: true };
  }
  return { text: val.toLocaleString("vi-VN"), isNegative: false };
}

export interface MisaTrialBalanceManagementReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaTrialBalanceManagementReport({
  onBack,
  notify,
}: MisaTrialBalanceManagementReportProps) {
  // Parameter Drawer Open State (opens initially or via "Chọn tham số" button)
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState<boolean>(false);

  // Search keyword in table
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // Parameter Form State (matching Screenshot 1)
  const [period, setPeriod] = useState<string>("Tháng này");
  const [fromDate, setFromDate] = useState<string>("01/10/2026");
  const [toDate, setToDate] = useState<string>("31/10/2026");
  const [accountLevel, setAccountLevel] = useState<string>("1");
  const [showBothSides, setShowBothSides] = useState<boolean>(true);
  const [accumulateFrom, setAccumulateFrom] = useState<"data_start" | "fiscal_start">("data_start");

  // Subtitle period string derived from date range
  const subtitlePeriod = useMemo(() => {
    return "Tháng 10 năm 2026";
  }, []);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return DEFAULT_TRIAL_BALANCE_DATA;
    const kw = searchKeyword.toLowerCase();
    return DEFAULT_TRIAL_BALANCE_DATA.filter(
      (r) => r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw)
    );
  }, [searchKeyword]);

  // Totals matching screenshot
  const totals = useMemo(() => {
    return {
      openingDebit: 0,
      openingCredit: 0,
      periodDebit: 79525000,
      periodCredit: 79525000,
      accumDebit: 79525000,
      accumCredit: 79525000,
      closingDebit: 37000000,
      closingCredit: 37000000,
    };
  }, []);

  const handleApplyParams = () => {
    setIsParamDrawerOpen(false);
    notify?.("Đã nạp số liệu Báo cáo cân đối tài khoản theo tham số đã chọn.");
  };

  const handleResetParams = () => {
    setPeriod("Tháng này");
    setFromDate("01/10/2026");
    setToDate("31/10/2026");
    setAccountLevel("1");
    setShowBothSides(true);
    setAccumulateFrom("data_start");
    notify?.("Đã xóa điều kiện lọc về mặc định.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#f8fafc", position: "relative" }}>
      {/* 1. Top Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          minHeight: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            title="Quay lại danh mục báo cáo"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#334155",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            Bảng cân đối tài khoản (Mẫu quản trị)
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            onClick={() => notify?.("Xem danh sách báo cáo mẫu đã lưu.")}
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
            onClick={() => notify?.("Đã lưu mẫu báo cáo tùy chỉnh thành công.")}
          >
            Lưu báo cáo
          </button>
          <button
            type="button"
            style={{
              height: 32,
              padding: "0 16px",
              background: "#00a862",
              border: "none",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onClick={() => setIsParamDrawerOpen(true)}
          >
            Chọn tham số
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar Action Strip */}
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
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Lọc nhanh"
            onClick={() => setIsParamDrawerOpen(true)}
          >
            <Filter size={14} />
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
            title="Tùy chỉnh cột hiển thị"
            onClick={() => notify?.("Tùy biến hiển thị các cột báo cáo.")}
          >
            <Columns size={14} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Search Box */}
          <div style={{ position: "relative", width: 240 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
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
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Làm mới"
            onClick={() => notify?.("Đã làm mới dữ liệu báo cáo.")}
          >
            <RotateCw size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
          >
            <Mail size={14} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", cursor: "pointer" }}
            title="Trợ giúp / Phản hồi"
            onClick={() => notify?.("Hệ thống hỗ trợ kế toán AMIS.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => notify?.("Đang chuẩn bị lệnh in...")}
          >
            <Printer size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            onClick={() => notify?.("Đã kết xuất báo cáo ra Excel thành công.")}
          >
            <Download size={14} />
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            style={{ width: 30, height: 30, border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", cursor: "pointer" }}
            title="Thiết lập"
            onClick={() => notify?.("Thiết lập báo cáo nâng cao.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. Main Report Content Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
        {/* Centered Report Title */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.2px" }}>
            BẢNG CÂN ĐỐI TÀI KHOẢN (MẪU QUẢN TRỊ)
          </h1>
          <div style={{ fontSize: 13, color: "#475569", fontStyle: "italic" }}>
            {subtitlePeriod}
          </div>
        </div>

        {/* Data Table */}
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              {/* Row 1 Header */}
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 700, borderBottom: "1px solid #bbf7d0" }}>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1", width: 90 }}>
                  Số tài khoản
                </th>
                <th rowSpan={2} style={{ padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1", minWidth: 220 }}>
                  Tên tài khoản
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Đầu kỳ
                </th>
                <th colSpan={4} style={{ padding: "6px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Phát sinh
                </th>
                <th colSpan={2} style={{ padding: "6px 10px", textAlign: "center" }}>
                  Cuối kỳ
                </th>
              </tr>

              {/* Row 2 Sub-headers */}
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 600, borderBottom: "1px solid #cbd5e1" }}>
                {/* Đầu kỳ */}
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 100 }}>Nợ</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 100 }}>Có</th>
                {/* Phát sinh */}
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Có</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ lũy kế</th>
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Có lũy kế</th>
                {/* Cuối kỳ */}
                <th style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ</th>
                <th style={{ padding: "6px 10px", textAlign: "right", width: 110 }}>Có</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => {
                const cDebit = formatCurrency(row.closingDebit);
                const cCredit = formatCurrency(row.closingCredit);
                return (
                  <tr
                    key={row.code}
                    style={{ borderBottom: "1px solid #e2e8f0", transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {/* Số TK */}
                    <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", color: "#0284c7", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => notify?.(`Mở sổ chi tiết tài khoản ${row.code} - ${row.name}`)}
                      title="Bấm để xem sổ chi tiết tài khoản"
                    >
                      {row.code}
                    </td>

                    {/* Tên TK */}
                    <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                      {row.name}
                    </td>

                    {/* Đầu kỳ Nợ / Có */}
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.openingDebit).text}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.openingCredit).text}
                    </td>

                    {/* Phát sinh Nợ / Có */}
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.periodDebit).text}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.periodCredit).text}
                    </td>

                    {/* Lũy kế Nợ / Có */}
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.accumDebit).text}
                    </td>
                    <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.accumCredit).text}
                    </td>

                    {/* Cuối kỳ Nợ / Có (Red if negative) */}
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                        color: cDebit.isNegative ? "#dc2626" : "#334155",
                        fontWeight: cDebit.isNegative ? 600 : 400,
                      }}
                    >
                      {cDebit.text}
                    </td>
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "right",
                        color: cCredit.isNegative ? "#dc2626" : "#334155",
                        fontWeight: cCredit.isNegative ? 600 : 400,
                      }}
                    >
                      {cCredit.text}
                    </td>
                  </tr>
                );
              })}

              {/* Total Summary Row */}
              <tr style={{ background: "#f1f5f9", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                <td colSpan={2} style={{ padding: "9px 10px", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  Tổng cộng
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}></td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}></td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.periodDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.periodCredit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.accumDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.accumCredit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.closingDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "9px 10px", textAlign: "right", color: "#1e293b" }}>
                  {totals.closingCredit.toLocaleString("vi-VN")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. Footer Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 4px",
            fontSize: 13,
            color: "#475569",
          }}
        >
          <div>Tổng số: <strong>{filteredRows.length}</strong></div>

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
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
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
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{ width: 26, height: 26, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 4, color: "#94a3b8", cursor: "not-allowed" }}
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
              maxWidth: 440,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInRight 0.2s ease-out",
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
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Trợ giúp"
                  onClick={() => notify?.("Xem hướng dẫn lập bảng cân đối tài khoản quản trị.")}
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body Form */}
            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, fontSize: 13 }}>
              {/* 1. Kỳ báo cáo */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
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
                  <option value="Năm nay">Năm nay</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* 2. Từ ngày - Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
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
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
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
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  </div>
                </div>
              </div>

              {/* 3. Bậc tài khoản */}
              <div>
                <label style={{ display: "block", marginBottom: 6, color: "#475569" }}>
                  Bậc tài khoản
                </label>
                <select
                  value={accountLevel}
                  onChange={(e) => setAccountLevel(e.target.value)}
                  style={{
                    width: 140,
                    height: 32,
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
                  <option value="3">3</option>
                  <option value="all">Bậc tổng hợp</option>
                </select>
              </div>

              {/* 4. Hiển thị số dư hai bên */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="showBothSides"
                  checked={showBothSides}
                  onChange={(e) => setShowBothSides(e.target.checked)}
                  style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="showBothSides" style={{ cursor: "pointer", color: "#1e293b", fontWeight: 500 }}>
                  Hiển thị số dư hai bên
                </label>
              </div>

              {/* 5. Lấy lũy kế phát sinh từ */}
              <div style={{ marginTop: 8 }}>
                <div style={{ color: "#334155", fontWeight: 600, marginBottom: 8 }}>
                  Lấy lũy kế phát sinh từ
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="radio"
                      name="accumulateFrom"
                      value="data_start"
                      checked={accumulateFrom === "data_start"}
                      onChange={() => setAccumulateFrom("data_start")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Ngày bắt đầu dữ liệu</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                    <input
                      type="radio"
                      name="accumulateFrom"
                      value="fiscal_start"
                      checked={accumulateFrom === "fiscal_start"}
                      onChange={() => setAccumulateFrom("fiscal_start")}
                      style={{ accentColor: "#00a862", width: 16, height: 16 }}
                    />
                    <span>Ngày bắt đầu năm tài chính của kỳ báo cáo</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                style={{
                  height: 34,
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#334155",
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
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
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
                    padding: "0 20px",
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
    </div>
  );
}
