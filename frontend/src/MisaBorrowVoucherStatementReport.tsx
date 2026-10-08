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
  Calendar,
} from "lucide-react";

export interface VoucherStatementRow {
  partnerName: string;
  postDate: string;
  voucherDate: string;
  voucherNo: string;
  description: string;
  disbursedAmount?: number;
  principalPaid?: number;
  interestPaid?: number;
}

export interface PartnerOption {
  code: string;
  name: string;
  address?: string;
  taxCode?: string;
}

export interface BorrowContractOption {
  contractNo: string;
  disbursementDate: string;
  lenderName: string;
}

const DEFAULT_PARTNERS: PartnerOption[] = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
    address: "",
    taxCode: "030178006908",
  },
];

const DEFAULT_CONTRACTS: BorrowContractOption[] = [];

export interface MisaBorrowVoucherStatementReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBorrowVoucherStatementReport({
  onBack,
  notify,
}: MisaBorrowVoucherStatementReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [selectedPartnerCode, setSelectedPartnerCode] = useState("NCC00001");
  const [selectedContractNo, setSelectedContractNo] = useState("");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftPartnerCode, setDraftPartnerCode] = useState("NCC00001");
  const [draftContractNo, setDraftContractNo] = useState("");
  const [partnerSearchText, setPartnerSearchText] = useState("");
  const [contractSearchText, setContractSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Empty by default matching Screenshot 2
  const [voucherData] = useState<VoucherStatementRow[]>([]);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftPartnerCode(selectedPartnerCode);
    setDraftContractNo(selectedContractNo);
    setPartnerSearchText("");
    setContractSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedPartnerCode(draftPartnerCode);
    setSelectedContractNo(draftContractNo);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Bảng kê chứng từ theo khế ước vay.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftPartnerCode("NCC00001");
    setDraftContractNo("");
  };

  const handlePresetChange = (preset: string) => {
    setDraftPeriodPreset(preset);
    if (preset === "Hôm nay") {
      setDraftFromDate("07/10/2026");
      setDraftToDate("07/10/2026");
    } else if (preset === "Tháng này") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/10/2026");
    } else if (preset === "Tháng trước") {
      setDraftFromDate("01/09/2026");
      setDraftToDate("30/09/2026");
    } else if (preset === "Quý 4") {
      setDraftFromDate("01/10/2026");
      setDraftToDate("31/12/2026");
    } else if (preset === "Năm nay") {
      setDraftFromDate("01/01/2026");
      setDraftToDate("31/12/2026");
    }
  };

  // Filter partners in drawer
  const filteredPartners = useMemo(() => {
    if (!partnerSearchText.trim()) return DEFAULT_PARTNERS;
    const kw = partnerSearchText.toLowerCase();
    return DEFAULT_PARTNERS.filter(
      (p) => p.code.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw)
    );
  }, [partnerSearchText]);

  // Filter contracts in drawer
  const filteredContracts = useMemo(() => {
    if (!contractSearchText.trim()) return DEFAULT_CONTRACTS;
    const kw = contractSearchText.toLowerCase();
    return DEFAULT_CONTRACTS.filter(
      (c) =>
        c.contractNo.toLowerCase().includes(kw) ||
        c.lenderName.toLowerCase().includes(kw)
    );
  }, [contractSearchText]);

  // Filter rows in report table
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return voucherData;
    const kw = searchKeyword.toLowerCase();
    return voucherData.filter(
      (r) =>
        r.partnerName.toLowerCase().includes(kw) ||
        r.voucherNo.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw)
    );
  }, [voucherData, searchKeyword]);

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
      {/* 1. Header Bar matching Screenshot 2 */}
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
            Bảng kê chứng từ theo khế ước vay
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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

      {/* 2. Action Toolbar matching Screenshot 2 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 20px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Lọc dữ liệu"
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              padding: "5px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "#64748b",
            }}
            title="Tùy chỉnh cột hiển thị"
          >
            <Columns size={14} />
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
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: 220,
                height: 28,
                padding: "0 30px 0 10px",
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
        </div>
      </div>

      {/* 3. Main Report Area */}
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
        {/* Title Header matching Screenshot 2 */}
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
            BẢNG KÊ CHỨNG TỪ THEO KHẾ ƯỚC VAY
          </h1>
          <div
            style={{
              fontSize: 12.5,
              color: "#475569",
              fontStyle: "italic",
            }}
          >
            Tháng 10 năm 2026
          </div>
        </div>

        {/* Data Table */}
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
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 160,
                  }}
                >
                  Tên đối tượng
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày hạch toán
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày chứng từ
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Số chứng từ
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "left",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 200,
                  }}
                >
                  Diễn giải
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 120,
                  }}
                >
                  Đã giải ngân
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 120,
                  }}
                >
                  Nợ gốc đã trả
                </th>
                <th
                  style={{
                    padding: "9px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    minWidth: 120,
                  }}
                >
                  Lãi đã trả
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
                      {row.partnerName}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {row.postDate}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {row.voucherDate}
                    </td>
                    <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                      {row.voucherNo}
                    </td>
                    <td style={{ padding: "8px 12px", borderRight: "1px solid #e2e8f0" }}>
                      {row.description}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.disbursedAmount)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.principalPaid)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {formatMoney(row.interestPaid)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: "90px 20px", textAlign: "center" }}>
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

      {/* 4. Modal / Drawer "Chọn tham số" matching Screenshot 1 */}
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
              {/* Top Form: Kỳ báo cáo, Từ ngày, Đến ngày */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                  alignItems: "flex-end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
                    }}
                  >
                    Kỳ báo cáo <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <select
                      value={draftPeriodPreset}
                      onChange={(e) => handlePresetChange(e.target.value)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        background: "#ffffff",
                        outline: "none",
                        appearance: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Hôm nay">Hôm nay</option>
                      <option value="Tháng này">Tháng này</option>
                      <option value="Tháng trước">Tháng trước</option>
                      <option value="Quý 4">Quý 4</option>
                      <option value="Năm nay">Năm nay</option>
                    </select>
                    <ChevronDown
                      size={15}
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

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
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
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
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

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      marginBottom: 5,
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
                        height: 32,
                        padding: "0 28px 0 10px",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        outline: "none",
                      }}
                    />
                    <Calendar
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
              </div>

              {/* Table 1: Đối tượng matching Screenshot 1 */}
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
                            width: 120,
                          }}
                        >
                          Mã đối tượng
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                          }}
                        >
                          Tên đối tượng
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
                          Địa chỉ
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            width: 130,
                          }}
                        >
                          Mã số thuế
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
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {p.name}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {p.address || ""}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{p.taxCode || ""}</td>
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

              {/* Table 2: Khế ước đi vay matching Screenshot 1 */}
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
                      checked={false}
                      onChange={() => {}}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={contractSearchText}
                      onChange={(e) => setContractSearchText(e.target.value)}
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
                            checked={false}
                            onChange={() => {}}
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
                          Số khế ước đi vay
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "center",
                            borderRight: "1px solid #cbd5e1",
                            width: 120,
                          }}
                        >
                          Ngày giải ngân
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                          }}
                        >
                          Đối tượng cho vay
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.length > 0 ? (
                        filteredContracts.map((c) => (
                          <tr
                            key={c.contractNo}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                            }}
                          >
                            <td style={{ textAlign: "center", padding: "6px 10px" }}>
                              <input
                                type="checkbox"
                                checked={draftContractNo === c.contractNo}
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
                              {c.contractNo}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                textAlign: "center",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {c.disbursementDate}
                            </td>
                            <td style={{ padding: "6px 10px" }}>{c.lenderName}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "24px 10px",
                              textAlign: "center",
                              color: "#94a3b8",
                            }}
                          >
                            Không có khế ước đi vay nào phù hợp
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
