import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
  Download,
  Settings,
  HelpCircle,
  X,
  Search,
  RefreshCw,
  Mail,
  ChevronDown,
  Filter,
  Columns,
} from "lucide-react";

export interface RepaymentScheduleRow {
  contractNo: string;
  creditAgreement?: string;
  partnerCode?: string;
  partnerName: string;
  loanAmount?: number;
  repaymentDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
}

export interface PartnerOption {
  code: string;
  name: string;
}

const DEFAULT_PARTNERS: PartnerOption[] = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
  },
];

export interface MisaBorrowRepaymentScheduleSummaryReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBorrowRepaymentScheduleSummaryReport({
  onBack,
  notify,
}: MisaBorrowRepaymentScheduleSummaryReportProps) {
  // Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [fromMonth, setFromMonth] = useState("Tháng 10");
  const [fromYear, setFromYear] = useState(2026);
  const [toMonth, setToMonth] = useState("Tháng 10");
  const [toYear, setToYear] = useState(2026);
  const [selectedPartnerCode, setSelectedPartnerCode] = useState("NCC00001");

  // Drawer draft state
  const [draftFromMonth, setDraftFromMonth] = useState("Tháng 10");
  const [draftFromYear, setDraftFromYear] = useState(2026);
  const [draftToMonth, setDraftToMonth] = useState("Tháng 10");
  const [draftToYear, setDraftToYear] = useState(2026);
  const [draftPartnerCode, setDraftPartnerCode] = useState("NCC00001");
  const [partnerSearchText, setPartnerSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Empty by default matching Screenshot 4
  const [scheduleData] = useState<RepaymentScheduleRow[]>([]);

  const handleOpenDrawer = () => {
    setDraftFromMonth(fromMonth);
    setDraftFromYear(fromYear);
    setDraftToMonth(toMonth);
    setDraftToYear(toYear);
    setDraftPartnerCode(selectedPartnerCode);
    setPartnerSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setFromMonth(draftFromMonth);
    setFromYear(draftFromYear);
    setToMonth(draftToMonth);
    setToYear(draftToYear);
    setSelectedPartnerCode(draftPartnerCode);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Tổng hợp lịch trả nợ khế ước vay.");
  };

  const handleResetParams = () => {
    setDraftFromMonth("Tháng 10");
    setDraftFromYear(2026);
    setDraftToMonth("Tháng 10");
    setDraftToYear(2026);
    setDraftPartnerCode("NCC00001");
  };

  // Subtitle period matching Screenshot 4: ", Từ tháng 10/2026 đến tháng 10/2026"
  const periodSubtitle = useMemo(() => {
    const fromMonthNum = fromMonth.replace("Tháng ", "").padStart(2, "0");
    const toMonthNum = toMonth.replace("Tháng ", "").padStart(2, "0");
    return `, Từ tháng ${fromMonthNum}/${fromYear} đến tháng ${toMonthNum}/${toYear}`;
  }, [fromMonth, fromYear, toMonth, toYear]);

  // Current month column title
  const monthColumnTitle = useMemo(() => {
    const fromMonthNum = fromMonth.replace("Tháng ", "").padStart(2, "0");
    return `Tháng ${fromMonthNum}/${fromYear}`;
  }, [fromMonth, fromYear]);

  // Filter partners in drawer
  const filteredPartners = useMemo(() => {
    if (!partnerSearchText.trim()) return DEFAULT_PARTNERS;
    const kw = partnerSearchText.toLowerCase();
    return DEFAULT_PARTNERS.filter(
      (p) => p.code.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw)
    );
  }, [partnerSearchText]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return scheduleData;
    const kw = searchKeyword.toLowerCase();
    return scheduleData.filter(
      (r) =>
        r.contractNo.toLowerCase().includes(kw) ||
        r.partnerName.toLowerCase().includes(kw)
    );
  }, [scheduleData, searchKeyword]);

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN");
  };

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
      {/* 1. Header Bar matching Screenshot 4 */}
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
            Tổng hợp lịch trả nợ khế ước vay
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: 180,
                height: 30,
                padding: "0 28px 0 10px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                outline: "none",
                background: "#ffffff",
              }}
            />
            <Search
              size={14}
              style={{
                position: "absolute",
                right: 8,
                color: "#94a3b8",
                pointerEvents: "none",
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
            title="Nạp lại dữ liệu"
            onClick={() => notify?.("Đã nạp lại dữ liệu báo cáo.")}
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
            title="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={15} />
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
            title="Xuất khẩu ra Excel"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <Download size={15} />
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
            onClick={() => notify?.("Mở hộp thoại gửi email báo cáo...")}
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
            title="Tùy chọn khác"
          >
            <Settings size={15} />
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Xem danh sách báo cáo đã lưu...")}
          >
            Danh sách báo cáo đã lưu
          </button>

          <button
            type="button"
            style={{
              height: 32,
              padding: "0 12px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              fontSize: 12.5,
              fontWeight: 500,
              color: "#334155",
              cursor: "pointer",
            }}
            onClick={() => notify?.("Đã lưu mẫu báo cáo thành công.")}
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

      {/* 2. Main Report Area */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Title Header matching Screenshot 4 */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: 15.5,
              fontWeight: 700,
              color: "#0f172a",
              textTransform: "uppercase",
              letterSpacing: "0.4px",
            }}
          >
            TỔNG HỢP LỊCH TRẢ NỢ KHẾ ƯỚC VAY
          </h1>
          <div
            style={{
              fontSize: 12.5,
              color: "#475569",
              fontStyle: "italic",
            }}
          >
            {periodSubtitle}
          </div>
        </div>

        {/* Data Table with 2-tier headers matching Screenshot 4 */}
        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              color: "#1e293b",
            }}
          >
            <thead>
              {/* Header Tier 1 */}
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 160,
                  }}
                >
                  Số khế ước đi vay
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 180,
                  }}
                >
                  Tên đối tượng
                </th>
                <th
                  colSpan={4}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderBottom: "1px solid #cbd5e1",
                  }}
                >
                  {monthColumnTitle}
                </th>
              </tr>
              {/* Header Tier 2 */}
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 120,
                  }}
                >
                  Ngày trả
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 130,
                  }}
                >
                  Trả gốc
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 130,
                  }}
                >
                  Trả lãi
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    minWidth: 140,
                  }}
                >
                  Tổng phải trả
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      background: idx % 2 === 1 ? "#fafafa" : "#ffffff",
                    }}
                  >
                    <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                      {row.contractNo}
                    </td>
                    <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                      {row.partnerName}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {row.repaymentDate}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.principalDue)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.interestDue)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {formatMoney(row.totalDue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "90px 20px", textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 12,
                      }}
                    >
                      <svg
                        width="80"
                        height="80"
                        viewBox="0 0 96 96"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="24"
                          y="24"
                          width="48"
                          height="48"
                          rx="8"
                          fill="#f8fafc"
                          stroke="#cbd5e1"
                          strokeWidth="2"
                        />
                        <path
                          d="M36 44H60M36 52H52"
                          stroke="#94a3b8"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <circle
                          cx="58"
                          cy="58"
                          r="14"
                          fill="#ffffff"
                          stroke="#00a862"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M68 68L78 78"
                          stroke="#00a862"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                        Không có dữ liệu
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Modal / Drawer "Chọn tham số" matching Screenshot 3 */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: 820,
              maxWidth: "92vw",
              height: "100%",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.15)",
              animation: "slideInRight 0.25s ease-out",
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                Chọn tham số
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                  title="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              {/* Top Monthly Range Selection matching Screenshot 3 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                {/* Từ tháng */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Từ tháng
                  </label>
                  <div style={{ position: "relative", width: 110 }}>
                    <select
                      value={draftFromMonth}
                      onChange={(e) => setDraftFromMonth(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 24px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`).map(
                        (m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        )
                      )}
                    </select>
                    <ChevronDown
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Năm (từ) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftFromYear}
                    onChange={(e) => setDraftFromYear(Number(e.target.value))}
                    style={{
                      width: 76,
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Đến tháng */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Đến tháng
                  </label>
                  <div style={{ position: "relative", width: 110 }}>
                    <select
                      value={draftToMonth}
                      onChange={(e) => setDraftToMonth(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 24px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`).map(
                        (m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        )
                      )}
                    </select>
                    <ChevronDown
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#64748b",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Năm (đến) */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftToYear}
                    onChange={(e) => setDraftToYear(Number(e.target.value))}
                    style={{
                      width: 76,
                      height: 32,
                      padding: "0 8px",
                      borderRadius: 4,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Table: Đối tượng matching Screenshot 3 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={draftPartnerCode === "NCC00001"}
                      onChange={(e) =>
                        setDraftPartnerCode(e.target.checked ? "NCC00001" : "")
                      }
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={partnerSearchText}
                      onChange={(e) => setPartnerSearchText(e.target.value)}
                      style={{
                        width: 200,
                        height: 26,
                        padding: "0 26px 0 8px",
                        fontSize: 11.5,
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                    />
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: 6,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ width: 36, padding: "7px 10px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={draftPartnerCode === "NCC00001"}
                            onChange={(e) =>
                              setDraftPartnerCode(e.target.checked ? "NCC00001" : "")
                            }
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                            width: 140,
                          }}
                        >
                          Mã đối tượng
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          Tên đối tượng
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPartners.map((p) => {
                        const isSelected = draftPartnerCode === p.code;
                        return (
                          <tr
                            key={p.code}
                            onClick={() =>
                              setDraftPartnerCode(isSelected ? "" : p.code)
                            }
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              cursor: "pointer",
                              background: isSelected ? "#f0fdf4" : "#ffffff",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px 10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                style={{ accentColor: "#00a862" }}
                              />
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {p.code}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{p.name}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 12px",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: 11.5,
                      color: "#64748b",
                    }}
                  >
                    <span>Tổng số: 1</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span>Số dòng/trang: 20</span>
                      <span>&lt; 1 &gt;</span>
                    </div>
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
