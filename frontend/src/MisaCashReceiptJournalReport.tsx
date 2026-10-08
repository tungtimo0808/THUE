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
  MessageCircle,
  ChevronDown,
  Filter,
  Columns,
  Calendar,
} from "lucide-react";

export interface CashReceiptRow {
  bookDate: string;
  voucherNo: string;
  voucherDate: string;
  description: string;
  debit111?: number;
  creditAcc1?: number; // e.g., 511
  creditAcc2?: number; // e.g., 131
  creditAcc3?: number; // e.g., 112
  creditAcc4?: number; // e.g., 711
  creditOtherAmount?: number;
  creditOtherAcc?: string;
}

export interface AccountOption {
  code: string;
  name: string;
}

const ACCOUNT_OPTIONS: AccountOption[] = [
  { code: "111", name: "Tiền mặt" },
  { code: "112", name: "Tiền gửi không kỳ hạn" },
  { code: "1121", name: "TGNH BIDV" },
];

export interface MisaCashReceiptJournalReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaCashReceiptJournalReport({
  onBack,
  notify,
}: MisaCashReceiptJournalReportProps) {
  // Drawer Parameters State matching Screenshot 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [selectedAccount, setSelectedAccount] = useState("111");
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [mergeSameEntries, setMergeSameEntries] = useState(true);

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftAccount, setDraftAccount] = useState("111");
  const [draftBankAccount, setDraftBankAccount] = useState("");
  const [draftMergeSameEntries, setDraftMergeSameEntries] = useState(true);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Sample data: Empty by default matching Screenshot 1 & 2
  const [receiptData] = useState<CashReceiptRow[]>([]);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccount(selectedAccount);
    setDraftBankAccount(selectedBankAccount);
    setDraftMergeSameEntries(mergeSameEntries);
    setIsAccountDropdownOpen(false);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccount(draftAccount);
    setSelectedBankAccount(draftBankAccount);
    setMergeSameEntries(draftMergeSameEntries);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật S03a1 - DN: Sổ nhật ký thu tiền.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftAccount("111");
    setDraftBankAccount("");
    setDraftMergeSameEntries(true);
    setIsAccountDropdownOpen(false);
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

  // Subtitle period text matching Screenshot 1 & 2
  const periodSubtitle = useMemo(() => {
    if (fromDate.startsWith("01/10/2026") && toDate.startsWith("31/10/2026")) {
      return "Tháng 10 năm 2026";
    }
    return `Từ ngày ${fromDate} đến ngày ${toDate}`;
  }, [fromDate, toDate]);

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!searchKeyword.trim()) return receiptData;
    const kw = searchKeyword.toLowerCase();
    return receiptData.filter(
      (r) =>
        r.voucherNo.toLowerCase().includes(kw) ||
        r.description.toLowerCase().includes(kw)
    );
  }, [receiptData, searchKeyword]);

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
      {/* 1. Header Bar matching Screenshot 1 */}
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
            S03a1 - DN: Sổ nhật ký thu tiền
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

      {/* 2. Action Toolbar matching Screenshot 1 & 2 */}
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
        {/* Left Toolbar Icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Bộ lọc"
            onClick={() => notify?.("Mở bộ lọc...")}
          >
            <Filter size={14} />
          </button>
          <button
            type="button"
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 4,
              color: "#64748b",
              cursor: "pointer",
            }}
            title="Tùy chỉnh cột"
            onClick={() => notify?.("Tùy chỉnh hiển thị cột...")}
          >
            <Columns size={14} />
          </button>
        </div>

        {/* Right Toolbar Icons */}
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
                width: 200,
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
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
            title="Tùy chỉnh"
            onClick={() => notify?.("Mở cài đặt...")}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. Centered Report Title matching Screenshot 1 */}
      <div style={{ textAlign: "center", padding: "16px 20px 10px 20px" }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "0.2px",
          }}
        >
          SỔ NHẬT KÝ THU TIỀN
        </h3>
        <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
          {periodSubtitle}
        </div>
      </div>

      {/* 4. Table Area with exact columns matching Screenshots 1 & 2 */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 20px 16px 20px",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflowX: "auto",
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <table
            style={{
              width: "max-content",
              minWidth: "100%",
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
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Ngày, tháng ghi sổ
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 200,
                  }}
                >
                  Chứng từ
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 260,
                  }}
                >
                  Diễn giải
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 140,
                  }}
                >
                  Ghi nợ TK {selectedAccount}
                </th>
                <th
                  colSpan={4}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 440,
                  }}
                >
                  Ghi có các TK
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 200,
                  }}
                >
                  Ghi có các TK khác
                </th>
              </tr>

              {/* Header Row 2 Subheaders matching Screenshots 1 & 2 */}
              <tr style={{ background: "#e2f0d9" }}>
                {/* Chứng từ subheaders */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                  Số hiệu
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 100 }}>
                  Ngày tháng
                </th>

                {/* Ghi có các TK subheaders matching Screenshot 1 */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                  .....
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                  .....
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                  .....
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 110 }}>
                  .....
                </th>

                {/* Ghi có các TK khác subheaders matching Screenshot 2 */}
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 120 }}>
                  Số tiền
                </th>
                <th style={{ border: "1px solid #cbd5e1", padding: "5px 8px", textAlign: "center", fontWeight: 700, fontSize: 12, minWidth: 80 }}>
                  Số hiệu
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      background: "#ffffff",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>
                      {row.bookDate}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>
                      {row.voucherNo}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 10px", textAlign: "center" }}>
                      {row.voucherDate}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px" }}>
                      {row.description}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>
                      {formatMoney(row.debit111)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>
                      {formatMoney(row.creditAcc1)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>
                      {formatMoney(row.creditAcc2)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>
                      {formatMoney(row.creditAcc3)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>
                      {formatMoney(row.creditAcc4)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px", textAlign: "right" }}>
                      {formatMoney(row.creditOtherAmount)}
                    </td>
                    <td style={{ border: "1px solid #e2e8f0", padding: "7px 8px", textAlign: "center" }}>
                      {row.creditOtherAcc || ""}
                    </td>
                  </tr>
                ))
              ) : null}
            </tbody>
          </table>

          {/* Empty State Illustration matching Screenshot 1 & 2 */}
          {filteredRows.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 20px",
                color: "#64748b",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 90,
                  height: 70,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Cloud & Document Icon Illustration */}
                <svg width="80" height="60" viewBox="0 0 80 60" fill="none">
                  <path
                    d="M18 42C12 42 8 38 8 32C8 26.5 12 22 17 22C17.5 15 23 10 30 10C35 10 39.5 13 42 17C44.5 15 48 14 52 14C60 14 66 20 66 28C71 29 74 33 74 38C74 43 70 47 64 47L18 47"
                    fill="#f1f5f9"
                  />
                  <rect x="26" y="20" width="30" height="34" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                  <line x1="32" y1="28" x2="48" y2="28" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <line x1="32" y1="34" x2="44" y2="34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="48" cy="38" r="8" fill="#ffffff" stroke="#00a862" strokeWidth="2.5" />
                  <line x1="54" y1="44" x2="62" y2="52" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>
                Không có dữ liệu
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Parameter Drawer matching Screenshot 3 */}
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
              {/* Kỳ báo cáo * */}
              <div>
                <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriodPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 10px",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    fontSize: 13,
                    background: "#ffffff",
                    outline: "none",
                  }}
                >
                  <option value="Hôm nay">Hôm nay</option>
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý 4">Quý 4</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* Từ ngày - Đến ngày matching Screenshot 3 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
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
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 10, top: 9, color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
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
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 10, top: 9, color: "#94a3b8" }} />
                  </div>
                </div>
              </div>

              {/* Tài khoản * & Tài khoản ngân hàng matching Screenshot 3 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 12 }}>
                {/* Tài khoản with dropdown */}
                <div style={{ position: "relative" }}>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Tài khoản <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <div
                    style={{
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #00a862",
                      borderRadius: 4,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      background: "#ffffff",
                    }}
                    onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                  >
                    <span>{draftAccount}</span>
                    <ChevronDown size={14} color="#64748b" />
                  </div>

                  {/* Account Dropdown Table matching Screenshot 3 */}
                  {isAccountDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: 58,
                        left: 0,
                        width: 320,
                        background: "#ffffff",
                        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                        borderRadius: 4,
                        border: "1px solid #cbd5e1",
                        zIndex: 100,
                        overflow: "hidden",
                      }}
                    >
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#334155", width: "40%" }}>
                              Số tài khoản
                            </th>
                            <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#334155" }}>
                              Tên tài khoản
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {ACCOUNT_OPTIONS.map((acc) => {
                            const isSelected = draftAccount === acc.code;
                            return (
                              <tr
                                key={acc.code}
                                style={{
                                  background: isSelected ? "#00a862" : "#ffffff",
                                  color: isSelected ? "#ffffff" : "#1e293b",
                                  cursor: "pointer",
                                  transition: "background 0.15s ease",
                                }}
                                onClick={() => {
                                  setDraftAccount(acc.code);
                                  setIsAccountDropdownOpen(false);
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "#f1f5f9";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = "#ffffff";
                                }}
                              >
                                <td style={{ padding: "6px 10px", fontWeight: isSelected ? 700 : 400 }}>
                                  {acc.code}
                                </td>
                                <td style={{ padding: "6px 10px" }}>{acc.name}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Tài khoản ngân hàng */}
                <div>
                  <label style={{ fontSize: 12.5, color: "#475569", display: "block", marginBottom: 6 }}>
                    Tài khoản ngân hàng
                  </label>
                  <select
                    value={draftBankAccount}
                    onChange={(e) => setDraftBankAccount(e.target.value)}
                    disabled={draftAccount === "111"}
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: draftAccount === "111" ? "#f8fafc" : "#ffffff",
                      color: draftAccount === "111" ? "#94a3b8" : "#1e293b",
                      outline: "none",
                      cursor: draftAccount === "111" ? "not-allowed" : "pointer",
                    }}
                  >
                    <option value="">(Tất cả)</option>
                    <option value="BIDV_01">BIDV - 1234567890</option>
                    <option value="VCB_01">Vietcombank - 0987654321</option>
                  </select>
                </div>
              </div>

              {/* Checkbox: Cộng gộp các bút toán giống nhau matching Image 3 */}
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#1e293b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftMergeSameEntries}
                    onChange={(e) =>
                      setDraftMergeSameEntries(e.target.checked)
                    }
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Cộng gộp các bút toán giống nhau</span>
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
