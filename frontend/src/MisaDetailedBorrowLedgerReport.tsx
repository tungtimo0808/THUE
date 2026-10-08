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
  Calendar,
  PenTool,
} from "lucide-react";

export interface BorrowLedgerRow {
  bookDate?: string;
  voucherNo?: string;
  voucherDate?: string;
  description: string;
  correspAcc?: string;
  dueDate?: string;
  debitAmount?: number;
  creditAmount?: number;
  isOpening?: boolean;
}

export interface AccountOption {
  code: string;
  name: string;
  level: number;
}

const DEFAULT_ACCOUNTS: AccountOption[] = [
  { code: "341", name: "Vay và nợ thuê tài chính", level: 1 },
  { code: "3411", name: "Các khoản đi vay", level: 2 },
  { code: "3412", name: "Nợ thuê tài chính", level: 2 },
];

export interface PartnerOption {
  code: string;
  name: string;
  address?: string;
  taxCode?: string;
}

const DEFAULT_PARTNERS: PartnerOption[] = [
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
    address: "",
    taxCode: "030178006908",
  },
];

export interface MisaDetailedBorrowLedgerReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaDetailedBorrowLedgerReport({
  onBack,
  notify,
}: MisaDetailedBorrowLedgerReportProps) {
  // Drawer Parameters State matching Image 3
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [viewDetailByContract, setViewDetailByContract] = useState(false);
  const [selectedAccCode, setSelectedAccCode] = useState("341");
  const [selectedPartnerName, setSelectedPartnerName] = useState("Tran Thi Huong");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftViewDetail, setDraftViewDetail] = useState(false);
  const [draftAccCode, setDraftAccCode] = useState("341");
  const [draftPartnerCode, setDraftPartnerCode] = useState("NCC00001");
  const [accSearchText, setAccSearchText] = useState("");
  const [partnerSearchText, setPartnerSearchText] = useState("");

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftViewDetail(viewDetailByContract);
    setDraftAccCode(selectedAccCode);
    setAccSearchText("");
    setPartnerSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setViewDetailByContract(draftViewDetail);
    setSelectedAccCode(draftAccCode);
    const p = DEFAULT_PARTNERS.find((it) => it.code === draftPartnerCode);
    if (p) setSelectedPartnerName(p.name);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật S34-DN: Sổ chi tiết tiền vay.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftViewDetail(false);
    setDraftAccCode("341");
    setDraftPartnerCode("NCC00001");
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

  const filteredAccounts = useMemo(() => {
    if (!accSearchText.trim()) return DEFAULT_ACCOUNTS;
    const kw = accSearchText.toLowerCase();
    return DEFAULT_ACCOUNTS.filter(
      (a) => a.code.toLowerCase().includes(kw) || a.name.toLowerCase().includes(kw)
    );
  }, [accSearchText]);

  const filteredPartners = useMemo(() => {
    if (!partnerSearchText.trim()) return DEFAULT_PARTNERS;
    const kw = partnerSearchText.toLowerCase();
    return DEFAULT_PARTNERS.filter(
      (p) => p.code.toLowerCase().includes(kw) || p.name.toLowerCase().includes(kw)
    );
  }, [partnerSearchText]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "#e2e8f0",
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    >
      {/* 1. Header Bar matching Image 4 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #cbd5e1",
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
            S34-DN: Sổ chi tiết tiền vay
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

      {/* 2. Subtoolbar matching Image 4 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 20px",
          background: "#ffffff",
          borderBottom: "1px solid #cbd5e1",
        }}
      >
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: "#334155",
            fontSize: 12.5,
            cursor: "pointer",
          }}
          onClick={() => notify?.("Thiết lập người ký mẫu báo cáo...")}
        >
          <PenTool size={14} color="#64748b" />
          <span>Thiết lập người ký</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email...")}
          >
            <Mail size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Phản hồi"
            onClick={() => notify?.("Mở phản hồi...")}
          >
            <MessageCircle size={15} />
          </button>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
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
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
            title="Tùy chỉnh"
            onClick={() => notify?.("Mở cài đặt...")}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* 3. A4 Document Sheet Presentation matching Image 4 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 20px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 820,
            background: "#ffffff",
            boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
            padding: "40px 48px",
            fontFamily: "'Times New Roman', Times, serif",
            color: "#0f172a",
            minHeight: 1100,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top header row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Tung</div>
            </div>
            <div style={{ textAlign: "center", fontSize: 12, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Mẫu số: S34-DN</div>
              <div style={{ fontStyle: "italic", fontSize: 11.5 }}>
                (Ban hành theo Thông tư số 200/2014/TT-BTC
              </div>
              <div style={{ fontStyle: "italic", fontSize: 11.5 }}>
                ngày 22 tháng 12 năm 2014 của Bộ trưởng Bộ Tài chính)
              </div>
            </div>
          </div>

          {/* Document Title */}
          <div style={{ textAlign: "center", margin: "16px 0 20px 0" }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.5px",
              }}
            >
              SỔ CHI TIẾT TIỀN VAY
            </h1>
            <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
              (Dùng cho TK: {selectedAccCode})
            </div>
            <div style={{ fontStyle: "italic", fontSize: 13, marginTop: 4 }}>
              Tháng 10 năm 2026
            </div>
          </div>

          {/* Metadata Block */}
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
            <div><strong>Chi nhánh:</strong></div>
            <div><strong>Tài khoản:</strong> {selectedAccCode}</div>
            <div><strong>Đối tượng cho vay:</strong> {selectedPartnerName}</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <strong>Khế ước vay:</strong> .................... Số .................... ngày ....................
              </div>
              <div><strong>Loại tiền:</strong> VND</div>
            </div>
            <div>(Tỷ lệ lãi vay ....................)</div>
          </div>

          {/* Main Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12.5,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <thead>
              {/* Row 1 */}
              <tr>
                <th
                  rowSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 4px", width: "12%" }}
                >
                  Ngày tháng ghi sổ
                </th>
                <th
                  colSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 4px", width: "18%" }}
                >
                  Chứng từ ghi sổ
                </th>
                <th
                  rowSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 8px", width: "30%", textAlign: "left" }}
                >
                  Diễn giải
                </th>
                <th
                  rowSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 4px", width: "8%" }}
                >
                  TK đối ứng
                </th>
                <th
                  rowSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 4px", width: "12%" }}
                >
                  Ngày đến hạn thanh toán
                </th>
                <th
                  colSpan={2}
                  style={{ border: "1px solid #000", padding: "6px 4px", width: "20%" }}
                >
                  Số tiền
                </th>
              </tr>

              {/* Row 2 Subheaders */}
              <tr>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Số hiệu</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Ngày tháng</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Nợ</th>
                <th style={{ border: "1px solid #000", padding: "4px" }}>Có</th>
              </tr>

              {/* Row 3 Column Reference Labels (A, B, C, D, E, G, 1, 2) */}
              <tr style={{ fontStyle: "italic", background: "#fafafa" }}>
                <th style={{ border: "1px solid #000", padding: "3px" }}>A</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>B</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>C</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>D</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>E</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>G</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>1</th>
                <th style={{ border: "1px solid #000", padding: "3px" }}>2</th>
              </tr>
            </thead>
            <tbody>
              {/* Row: Số dư đầu kỳ */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: 700 }}>
                  Số dư đầu kỳ
                </td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
              </tr>

              {/* Row: Số phát sinh trong kỳ */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px", textAlign: "left" }}>
                  Số phát sinh trong kỳ
                </td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
              </tr>

              {/* Row: Cộng số phát sinh */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: 700 }}>
                  Cộng số phát sinh
                </td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
              </tr>

              {/* Row: Số dư cuối kỳ */}
              <tr>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px", textAlign: "left", fontWeight: 700 }}>
                  Số dư cuối kỳ
                </td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
                <td style={{ border: "1px solid #000", padding: "6px" }}></td>
              </tr>
            </tbody>
          </table>

          {/* Notes */}
          <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 24 }}>
            <div>- Sổ này có 1 trang, đánh số từ trang số 01 đến trang 1</div>
            <div>- Ngày mở sổ: ....................</div>
          </div>

          {/* Signature Block */}
          <div style={{ marginTop: "auto" }}>
            <div style={{ textAlign: "right", fontStyle: "italic", fontSize: 13, marginBottom: 8, paddingRight: 40 }}>
              Ngày 31 tháng 10 năm 2026
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>Người ghi sổ</div>
                <div style={{ fontStyle: "italic", fontSize: 12 }}>(Ký, họ tên)</div>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>Kế toán trưởng</div>
                <div style={{ fontStyle: "italic", fontSize: 12 }}>(Ký, họ tên)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Parameter Drawer matching Image 3 */}
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
              width: 580,
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle
                  size={18}
                  color="#64748b"
                  style={{ cursor: "pointer" }}
                />
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
              {/* Kỳ báo cáo - Từ ngày - Đến ngày matching Image 3 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
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

                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
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
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      fontSize: 12.5,
                      color: "#475569",
                      display: "block",
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
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        background: "#ffffff",
                      }}
                    />
                    <Calendar
                      size={14}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: 9,
                        color: "#94a3b8",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Checkbox: Xem chi tiết theo khế ước vay matching Image 3 */}
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
                    checked={draftViewDetail}
                    onChange={(e) => setDraftViewDetail(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Xem chi tiết theo khế ước vay</span>
                </label>
              </div>

              {/* Table 1: Danh sách Tài khoản vay (341, 3411, 3412) matching Image 3 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 7,
                        color: "#94a3b8",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={accSearchText}
                      onChange={(e) => setAccSearchText(e.target.value)}
                      style={{
                        height: 26,
                        width: 170,
                        padding: "0 8px 0 26px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        fontSize: 12,
                        outline: "none",
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
                      fontSize: 12.5,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e2f0d9" }}>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 8px",
                            width: 36,
                            textAlign: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draftAccCode === "341"}
                            onChange={() => {}}
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "28%",
                          }}
                        >
                          Số tài khoản
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "50%",
                          }}
                        >
                          Tên tài khoản
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "18%",
                          }}
                        >
                          Bậc
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((acc) => (
                        <tr
                          key={acc.code}
                          style={{ background: "#ffffff", cursor: "pointer" }}
                          onClick={() => setDraftAccCode(acc.code)}
                        >
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 8px",
                              textAlign: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={draftAccCode === acc.code}
                              onChange={() => setDraftAccCode(acc.code)}
                              style={{ accentColor: "#00a862" }}
                            />
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                              fontWeight: 600,
                            }}
                          >
                            {acc.code}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                            }}
                          >
                            {acc.name}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                              textAlign: "center",
                            }}
                          >
                            {acc.level}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 2px",
                    fontSize: 11.5,
                    color: "#64748b",
                  }}
                >
                  <div>Tổng số: 3</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Số dòng/trang</span>
                    <select
                      defaultValue="20"
                      style={{
                        height: 22,
                        padding: "0 4px",
                        fontSize: 11,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                      }}
                    >
                      <option value="20">20</option>
                    </select>
                    <span>&lt; 1 &gt;</span>
                  </div>
                </div>
              </div>

              {/* Table 2: Danh sách NCC / Đối tượng vay matching Image 3 */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12.5,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 8,
                        top: 7,
                        color: "#94a3b8",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={partnerSearchText}
                      onChange={(e) => setPartnerSearchText(e.target.value)}
                      style={{
                        height: 26,
                        width: 170,
                        padding: "0 8px 0 26px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                        fontSize: 12,
                        outline: "none",
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
                      fontSize: 12.5,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#e2f0d9" }}>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 8px",
                            width: 36,
                            textAlign: "center",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={draftPartnerCode === "NCC00001"}
                            onChange={() => {}}
                            style={{ accentColor: "#00a862" }}
                          />
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "25%",
                          }}
                        >
                          Mã NCC
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "35%",
                          }}
                        >
                          Tên NCC
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "15%",
                          }}
                        >
                          Địa chỉ
                        </th>
                        <th
                          style={{
                            border: "1px solid #cbd5e1",
                            padding: "6px 10px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: "#1e293b",
                            width: "25%",
                          }}
                        >
                          Mã số thuế
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPartners.map((partner) => (
                        <tr
                          key={partner.code}
                          style={{ background: "#ffffff", cursor: "pointer" }}
                          onClick={() => setDraftPartnerCode(partner.code)}
                        >
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 8px",
                              textAlign: "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={draftPartnerCode === partner.code}
                              onChange={() => setDraftPartnerCode(partner.code)}
                              style={{ accentColor: "#00a862" }}
                            />
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                              fontWeight: 600,
                            }}
                          >
                            {partner.code}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                            }}
                          >
                            {partner.name}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                            }}
                          >
                            {partner.address || ""}
                          </td>
                          <td
                            style={{
                              border: "1px solid #e2e8f0",
                              padding: "6px 10px",
                            }}
                          >
                            {partner.taxCode || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 2px",
                    fontSize: 11.5,
                    color: "#64748b",
                  }}
                >
                  <div>Tổng số: 1</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Số dòng/trang</span>
                    <select
                      defaultValue="20"
                      style={{
                        height: 22,
                        padding: "0 4px",
                        fontSize: 11,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                      }}
                    >
                      <option value="20">20</option>
                    </select>
                    <span>&lt; 1 &gt;</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer matching Image 3 */}
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
