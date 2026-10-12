import "./misa-borrow-summary.css";
import {MISA_REPORT_ACCOUNTS} from "./misa-report-accounts";
import {CASH_PERIODS,cashPeriodDates,cashPeriodSubtitle} from "./cash-report-periods";
import {cashDateValue} from "./cash-date";
import { useState, useMemo } from "react";
import {
  ChevronLeft,
  Printer,
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

export interface BorrowContractSummaryRow {
  contractNo: string;
  partnerName: string;
  disbursementDate: string;
  dueDate: string;
  interestRate: number;
  loanAmount: number;
  disbursedAmount: number;
  openingPrincipal: number;
  principalPaidPeriod: number;
  principalPaidCumul: number;
  closingPrincipal: number;
  interestPaidPeriod: number;
  interestPaidCumul: number;
}

export interface AccountOption {
  code: string;
  name: string;
  level: number;
}

const DEFAULT_ACCOUNTS: AccountOption[] = MISA_REPORT_ACCOUNTS;

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

export interface MisaBorrowContractSummaryReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBorrowContractSummaryReport({
  onBack,
  notify,
}: MisaBorrowContractSummaryReportProps) {
  // Drawer Parameters State matching Image 1
  const [paramError,setParamError]=useState("");
  const [accountPage,setAccountPage]=useState(1);
  const [accountPageSize,setAccountPageSize]=useState(20);
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [toDate, setToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [selectedAccCode, setSelectedAccCode] = useState("111");
  const [selectedPartnerName, setSelectedPartnerName] = useState("Tran Thi Huong");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState(()=>cashPeriodDates("Tháng này")![0]);
  const [draftToDate, setDraftToDate] = useState(()=>cashPeriodDates("Tháng này")![1]);
  const [draftAccCode, setDraftAccCode] = useState("111");
  const [draftPartnerCode, setDraftPartnerCode] = useState("NCC00001");
  const [accSearchText, setAccSearchText] = useState("");
  const [partnerSearchText, setPartnerSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Empty by default matching Image 2
  const [contractData] = useState<BorrowContractSummaryRow[]>([]);

  const toggleAccount=(code:string)=>setDraftAccCode(previous=>{const codes=previous?previous.split(','):[];return (codes.includes(code)?codes.filter(item=>item!==code):[...codes,code]).join(',');});
  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccCode(selectedAccCode);
    setAccSearchText("");
    setPartnerSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    if(!Number.isFinite(cashDateValue(draftFromDate))||!Number.isFinite(cashDateValue(draftToDate))||cashDateValue(draftFromDate)>cashDateValue(draftToDate)){setParamError('Chọn khoảng ngày hợp lệ theo DD/MM/YYYY.');return;}setParamError('');
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccCode(draftAccCode);
    const partner = DEFAULT_PARTNERS.find((p) => p.code === draftPartnerCode);
    setSelectedPartnerName(partner?.name||"Tất cả");
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Báo cáo tổng hợp tình hình khế ước vay.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate(cashPeriodDates("Tháng này")![0]);
    setDraftToDate(cashPeriodDates("Tháng này")![1]);
    setDraftAccCode("111");setAccountPage(1);setParamError("");
    setDraftPartnerCode("NCC00001");
  };

  const handlePresetChange=(preset:string)=>{setDraftPeriodPreset(preset);const range=cashPeriodDates(preset);if(range){setDraftFromDate(range[0]);setDraftToDate(range[1]);}};

  // Subtitle period text matching Image 2
  const periodSubtitle = useMemo(() => {
    return `Đối tượng: ${selectedPartnerName}, Tài khoản: ${selectedAccCode||"Tất cả"}, ${cashPeriodSubtitle(fromDate,toDate)}`;
  }, [selectedPartnerName, selectedAccCode,fromDate,toDate]);

  // Filter accounts in drawer
  const filteredAccounts = useMemo(() => {
    if (!accSearchText.trim()) return DEFAULT_ACCOUNTS;
    const kw = accSearchText.toLowerCase();
    return DEFAULT_ACCOUNTS.filter(
      (a) => a.code.toLowerCase().includes(kw) || a.name.toLowerCase().includes(kw)
    );
  }, [accSearchText]);

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
    if (!searchKeyword.trim()) return contractData;
    const kw = searchKeyword.toLowerCase();
    return contractData.filter(
      (r) =>
        r.contractNo.toLowerCase().includes(kw) ||
        r.partnerName.toLowerCase().includes(kw)
    );
  }, [contractData, searchKeyword]);

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toLocaleString("vi-VN");
  };

  return (
    <div className="misa-borrow-summary"
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
      {/* 1. Header Bar matching Image 2 */}
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
            Báo cáo tổng hợp tình hình khế ước vay
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

      {/* 2. Action Toolbar matching Image 2 */}
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

      {/* 3. Centered Report Title matching Image 2 */}
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
          BÁO CÁO TỔNG HỢP TÌNH HÌNH KHẾ ƯỚC VAY
        </h3>
        <div
          style={{
            fontSize: 12.5,
            fontStyle: "italic",
            color: "#475569",
            marginTop: 4,
          }}
        >
          {periodSubtitle}
        </div>
      </div>

      {/* 4. Table Area matching Image 2 */}
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
                    minWidth: 120,
                  }}
                >
                  Khế ước vay
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 180,
                  }}
                >
                  Tên đối tượng
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 110,
                  }}
                >
                  Ngày giải ngân
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 110,
                  }}
                >
                  Ngày đáo hạn
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 100,
                  }}
                >
                  Lãi suất (%)
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Giá trị khoản vay
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Giá trị giải ngân
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Dư nợ gốc đầu kỳ
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 240,
                  }}
                >
                  Đã trả gốc
                </th>
                <th
                  rowSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "8px 12px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 130,
                  }}
                >
                  Dư nợ gốc cuối kỳ
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "6px 12px",
                    textAlign: "center",
                    fontWeight: 700,
                    color: "#1e293b",
                    minWidth: 240,
                  }}
                >
                  Đã trả lãi
                </th>
              </tr>

              {/* Header Row 2 Subheaders */}
              <tr style={{ background: "#e2f0d9" }}>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "5px 8px",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 12,
                    minWidth: 120,
                  }}
                >
                  Trong kỳ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "5px 8px",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 12,
                    minWidth: 120,
                  }}
                >
                  Lũy kế
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "5px 8px",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 12,
                    minWidth: 120,
                  }}
                >
                  Trong kỳ
                </th>
                <th
                  style={{
                    border: "1px solid #cbd5e1",
                    padding: "5px 8px",
                    textAlign: "right",
                    fontWeight: 700,
                    fontSize: 12,
                    minWidth: 120,
                  }}
                >
                  Lũy kế
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
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
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 10px",
                      textAlign: "center",
                      color: "#0284c7",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                    onClick={() =>
                      notify?.(`Xem chi tiết khế ước vay ${row.contractNo}`)
                    }
                  >
                    {row.contractNo}
                  </td>
                  <td style={{ border: "1px solid #e2e8f0", padding: "7px 12px" }}>
                    {row.partnerName}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 10px",
                      textAlign: "center",
                    }}
                  >
                    {row.disbursementDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 10px",
                      textAlign: "center",
                    }}
                  >
                    {row.dueDate}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {row.interestRate}%
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.loanAmount)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.disbursedAmount)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.openingPrincipal)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.principalPaidPeriod)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.principalPaidCumul)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {formatMoney(row.closingPrincipal)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.interestPaidPeriod)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "7px 12px",
                      textAlign: "right",
                    }}
                  >
                    {formatMoney(row.interestPaidCumul)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State Illustration matching Image 2 */}
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
                  <rect
                    x="26"
                    y="20"
                    width="30"
                    height="34"
                    rx="3"
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <line
                    x1="32"
                    y1="28"
                    x2="48"
                    y2="28"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="32"
                    y1="34"
                    x2="44"
                    y2="34"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="48"
                    cy="38"
                    r="8"
                    fill="#ffffff"
                    stroke="#00a862"
                    strokeWidth="2.5"
                  />
                  <line
                    x1="54"
                    y1="44"
                    x2="62"
                    y2="52"
                    stroke="#00a862"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  fontWeight: 500,
                }}
              >
                Không có dữ liệu
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar matching Image 2 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 4px",
            fontSize: 12.5,
            color: "#475569",
          }}
        >
          <div>Tổng số: {filteredRows.length}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Số dòng/trang</span>
              <select
                defaultValue="20"
                style={{
                  height: 26,
                  padding: "0 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 3,
                  fontSize: 12,
                  outline: "none",
                  background: "#ffffff",
                }}
              >
                <option value="10">10</option>
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
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                |&lt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &lt;
              </button>
              <span
                style={{
                  padding: "2px 8px",
                  background: "#00a862",
                  color: "#ffffff",
                  borderRadius: 3,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                1
              </span>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;
              </button>
              <button
                type="button"
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "not-allowed",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                &gt;|
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Parameter Drawer matching Image 1 */}
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
              width: "min(1050px,100vw)",
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
              {paramError&&<p role="alert" style={{color:"#b91c1c"}}>{paramError}</p>}
              {/* Kỳ báo cáo - Từ ngày - Đến ngày matching Image 1 */}
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
                    {CASH_PERIODS.map(period=><option key={period}>{period}</option>)}
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
                      onChange={(e) => {setDraftFromDate(e.target.value);setDraftPeriodPreset("Tùy chọn");}}
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
                      onChange={(e) => {setDraftToDate(e.target.value);setDraftPeriodPreset("Tùy chọn");}}
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

              {/* Table 1: Danh sách Tài khoản matching Image 1 */}
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
                      type="checkbox" aria-label="Chọn tất cả tài khoản" checked={filteredAccounts.length>0&&filteredAccounts.every(account=>draftAccCode.split(",").includes(account.code))} onChange={event=>setDraftAccCode(event.target.checked?filteredAccounts.map(account=>account.code).join(","):"")}
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
                      onChange={(e) => {setAccSearchText(e.target.value);setAccountPage(1);}}
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
                    maxHeight: 260,
                    overflowY: "auto",
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
                            aria-label="Chọn tất cả tài khoản đang lọc" checked={filteredAccounts.length>0&&filteredAccounts.every(account=>draftAccCode.split(",").includes(account.code))}
                            onChange={event=>setDraftAccCode(event.target.checked?filteredAccounts.map(account=>account.code).join(","):"")}
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
                      {filteredAccounts.slice((Math.min(accountPage,Math.max(1,Math.ceil(filteredAccounts.length/accountPageSize)))-1)*accountPageSize,Math.min(accountPage,Math.max(1,Math.ceil(filteredAccounts.length/accountPageSize)))*accountPageSize).map((acc) => (
                        <tr
                          key={acc.code}
                          style={{ background: "#ffffff", cursor: "pointer" }}
                          onClick={() => toggleAccount(acc.code)}
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
                              aria-label={`Chọn tài khoản ${acc.code}`} checked={draftAccCode.split(",").includes(acc.code)}
                              onClick={event=>event.stopPropagation()} onChange={() => toggleAccount(acc.code)}
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
                  <div>Tổng số: {filteredAccounts.length}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Số dòng/trang</span>
                    <select
                      aria-label="Số dòng trang tài khoản khế ước" value={accountPageSize} onChange={event=>{setAccountPageSize(Number(event.target.value));setAccountPage(1);}}
                      style={{
                        height: 22,
                        padding: "0 4px",
                        fontSize: 11,
                        border: "1px solid #cbd5e1",
                        borderRadius: 3,
                      }}
                    >
                      {[10,20,30,50,100].map(size=><option key={size} value={size}>{size}</option>)}
                    </select>
                    <button aria-label="Trang tài khoản trước" disabled={accountPage<=1} onClick={()=>setAccountPage(previous=>previous-1)}>‹</button><span>{Math.min(accountPage,Math.max(1,Math.ceil(filteredAccounts.length/accountPageSize)))}/{Math.max(1,Math.ceil(filteredAccounts.length/accountPageSize))}</span><button aria-label="Trang tài khoản sau" disabled={accountPage>=Math.max(1,Math.ceil(filteredAccounts.length/accountPageSize))} onClick={()=>setAccountPage(previous=>previous+1)}>›</button>
                  </div>
                </div>
              </div>

              {/* Table 2: Danh sách Đối tượng matching Image 1 */}
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
                      type="checkbox" aria-label="Chọn tất cả đối tượng" checked={Boolean(draftPartnerCode)} onChange={event=>setDraftPartnerCode(event.target.checked?"NCC00001":"")}
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
                            onChange={event=>setDraftPartnerCode(event.target.checked?"NCC00001":"")}
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
                          Mã đối tượng
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
                          Tên đối tượng
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
                              onClick={event=>event.stopPropagation()} onChange={event=>setDraftPartnerCode(event.target.checked?partner.code:"")}
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

            {/* Footer matching Image 1 */}
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
