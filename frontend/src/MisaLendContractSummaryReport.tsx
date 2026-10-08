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
  MessageCircle,
  FileSpreadsheet,
} from "lucide-react";

export interface LendContractSummaryRow {
  contractNo: string;
  partnerName: string;
  disbursementDate: string;
  dueDate: string;
  interestRate: number;
  loanAmount: number;
  disbursedAmount: number;
  openingPrincipal: number;
  principalCollectedPeriod: number;
  principalCollectedCumul: number;
  closingPrincipal: number;
  interestCollectedPeriod: number;
  interestCollectedCumul: number;
}

export interface AccountOption {
  code: string;
  name: string;
  level: number;
}

const DEFAULT_ACCOUNTS: AccountOption[] = [
  { code: "111", name: "Tiền mặt", level: 1 },
  { code: "112", name: "Tiền gửi không kỳ hạn", level: 1 },
  { code: "1121", name: "TGNH BIDV", level: 2 },
  { code: "113", name: "Tiền đang chuyển", level: 1 },
  { code: "121", name: "Chứng khoán kinh doanh", level: 1 },
  { code: "128", name: "Đầu tư nắm giữ đến ngày đáo hạn", level: 1 },
  { code: "1281", name: "Tiền gửi có kỳ hạn", level: 2 },
  { code: "1288", name: "Các khoản đầu tư nắm giữ đến ngày đáo hạn khác", level: 2 },
];

export interface PartnerOption {
  code: string;
  name: string;
  address?: string;
  taxCode?: string;
}

const DEFAULT_PARTNERS: PartnerOption[] = [
  {
    code: "KH00001",
    name: "Tuan Anh",
    address: "Số 625 đường Lạc Long Quân, Phường Tây Hồ, TP Hà Nội",
    taxCode: "01720400104",
  },
  {
    code: "KH00002",
    name: "Tuan Anh",
    address: "Số 625 đường Lạc Long Quân, Phường Tây Hồ, TP Hà Nội",
    taxCode: "017204001074",
  },
  {
    code: "NCC00001",
    name: "Tran Thi Huong",
    address: "",
    taxCode: "030178006908",
  },
  {
    code: "NV000001",
    name: "Nguyen Hoang Tung",
    address: "",
    taxCode: "",
  },
];

export interface MisaLendContractSummaryReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaLendContractSummaryReport({
  onBack,
  notify,
}: MisaLendContractSummaryReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("Tháng này");
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/10/2026");
  const [selectedAccCode, setSelectedAccCode] = useState("111");
  const [selectedPartnerName, setSelectedPartnerName] = useState("Tuan Anh");

  // Drawer draft state
  const [draftPeriodPreset, setDraftPeriodPreset] = useState("Tháng này");
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/10/2026");
  const [draftAccCode, setDraftAccCode] = useState("111");
  const [draftPartnerCode, setDraftPartnerCode] = useState("KH00001");
  const [accSearchText, setAccSearchText] = useState("");
  const [partnerSearchText, setPartnerSearchText] = useState("");

  // Search keyword inside report table
  const [searchKeyword, setSearchKeyword] = useState("");

  // Data: Empty by default matching Screenshot 2
  const [contractData] = useState<LendContractSummaryRow[]>([]);

  const handleOpenDrawer = () => {
    setDraftPeriodPreset(reportPeriodPreset);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccCode(selectedAccCode);
    const partner = DEFAULT_PARTNERS.find((p) => p.name === selectedPartnerName);
    setDraftPartnerCode(partner ? partner.code : "KH00001");
    setAccSearchText("");
    setPartnerSearchText("");
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setReportPeriodPreset(draftPeriodPreset);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setSelectedAccCode(draftAccCode);
    const partner = DEFAULT_PARTNERS.find((p) => p.code === draftPartnerCode);
    if (partner) setSelectedPartnerName(partner.name);
    setIsParamDrawerOpen(false);
    notify?.("Đã cập nhật Báo cáo tổng hợp tình hình khế ước cho vay.");
  };

  const handleResetParams = () => {
    setDraftPeriodPreset("Tháng này");
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/10/2026");
    setDraftAccCode("111");
    setDraftPartnerCode("KH00001");
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

  // Subtitle period text matching Screenshot 2: "Đối tượng: Tuan Anh, Tài khoản: 111, Tháng 10 năm 2026"
  const periodSubtitle = useMemo(() => {
    return `Đối tượng: ${selectedPartnerName}, Tài khoản: ${selectedAccCode}, Tháng 10 năm 2026`;
  }, [selectedPartnerName, selectedAccCode]);

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
      (p) =>
        p.code.toLowerCase().includes(kw) ||
        p.name.toLowerCase().includes(kw) ||
        (p.address && p.address.toLowerCase().includes(kw))
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
            Báo cáo tổng hợp tình hình khế ước cho vay
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
            title="Tùy chỉnh hiển thị"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3zm2 4.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4z" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Search box with purple search icon on the left matching Screenshot */}
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
                left: 9,
                color: "#8b5cf6",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Nhập từ khóa tìm kiếm"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: 220,
                height: 28,
                padding: "0 10px 0 30px",
                fontSize: 12,
                borderRadius: 4,
                border: "1px solid #cbd5e1",
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>

          {/* 1. Nạp lại */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            title="Nạp lại dữ liệu"
            onClick={() => notify?.("Đã nạp lại dữ liệu báo cáo.")}
          >
            <RefreshCw size={15} />
          </button>

          {/* 2. Gửi email */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
            title="Gửi email"
            onClick={() => notify?.("Mở hộp thoại gửi email báo cáo...")}
          >
            <Mail size={15} />
          </button>

          {/* 3. Kênh chat / Trợ giúp trực tuyến MISA */}
          <button
            type="button"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#0284c7",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
            title="Hỗ trợ trực tuyến MISA"
            onClick={() => notify?.("Mở hỗ trợ trực tuyến.")}
          >
            <MessageCircle size={13} fill="#ffffff" />
          </button>

          {/* 4. In báo cáo kèm dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="In báo cáo"
            onClick={() => window.print()}
          >
            <Printer size={15} />
            <ChevronDown size={12} />
          </div>

          {/* 5. Xuất khẩu Excel kèm dropdown */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
              color: "#64748b",
              padding: "2px 4px",
            }}
            title="Xuất khẩu báo cáo"
            onClick={() => notify?.("Đang xuất khẩu báo cáo ra Excel...")}
          >
            <Download size={15} />
            <ChevronDown size={12} />
          </div>

          {/* 6. Thiết lập */}
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
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
            BÁO CÁO TỔNG HỢP TÌNH HÌNH KHẾ ƯỚC CHO VAY
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

        {/* Data Table with 2-tier headers matching Screenshot 1 & 2 */}
        <div
          style={{
            width: "100%",
            border: "1px solid #cbd5e1",
            borderRadius: 4,
            overflowX: "auto",
            overflowY: "auto",
            background: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 1520,
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
                    minWidth: 140,
                  }}
                >
                  Khế ước cho vay
                </th>
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
                  Tên đối tượng
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày giải ngân
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 110,
                  }}
                >
                  Ngày đáo hạn
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 100,
                  }}
                >
                  Lãi suất (%)
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 125,
                  }}
                >
                  Giá trị khoản vay
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 125,
                  }}
                >
                  Giá trị giải ngân
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 125,
                  }}
                >
                  Dư nợ gốc đầu kỳ
                </th>
                <th
                  colSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderRight: "1px solid #cbd5e1",
                    borderBottom: "1px solid #cbd5e1",
                  }}
                >
                  Đã thu gốc
                </th>
                <th
                  rowSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 125,
                  }}
                >
                  Dư nợ gốc cuối kỳ
                </th>
                <th
                  colSpan={2}
                  style={{
                    padding: "8px 12px",
                    fontWeight: 600,
                    textAlign: "center",
                    borderBottom: "1px solid #cbd5e1",
                  }}
                >
                  Đã thu lãi
                </th>
              </tr>

              {/* Header Tier 2 */}
              <tr style={{ background: "#e8f5ec", borderBottom: "1px solid #cbd5e1" }}>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 115,
                  }}
                >
                  Trong kỳ
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 115,
                  }}
                >
                  Lũy kế
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    borderRight: "1px solid #cbd5e1",
                    minWidth: 115,
                  }}
                >
                  Trong kỳ
                </th>
                <th
                  style={{
                    padding: "7px 12px",
                    fontWeight: 600,
                    textAlign: "right",
                    minWidth: 115,
                  }}
                >
                  Lũy kế
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
                      {row.disbursementDate}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "center",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {row.dueDate}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {row.interestRate ? `${row.interestRate}%` : ""}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.loanAmount)}
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
                      {formatMoney(row.openingPrincipal)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.principalCollectedPeriod)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.principalCollectedCumul)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.closingPrincipal)}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {formatMoney(row.interestCollectedPeriod)}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      {formatMoney(row.interestCollectedCumul)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={13} style={{ padding: "90px 20px", textAlign: "center" }}>
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
                        width="88"
                        height="64"
                        viewBox="0 0 88 64"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        {/* Soft capsule background */}
                        <rect x="8" y="20" width="72" height="26" rx="13" fill="#f1f5f9" />
                        {/* Document sheet */}
                        <rect
                          x="28"
                          y="10"
                          width="30"
                          height="40"
                          rx="3"
                          fill="#ffffff"
                          stroke="#e2e8f0"
                          strokeWidth="1.5"
                        />
                        <line
                          x1="34"
                          y1="19"
                          x2="48"
                          y2="19"
                          stroke="#cbd5e1"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <line
                          x1="34"
                          y1="25"
                          x2="52"
                          y2="25"
                          stroke="#cbd5e1"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <line
                          x1="34"
                          y1="31"
                          x2="44"
                          y2="31"
                          stroke="#cbd5e1"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        {/* Green magnifying glass */}
                        <circle
                          cx="50"
                          cy="38"
                          r="11"
                          fill="#ffffff"
                          stroke="#00a862"
                          strokeWidth="2.5"
                        />
                        <path
                          d="M58 46L66 54"
                          stroke="#00a862"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {/* Green accents/sparkles */}
                        <circle cx="20" cy="34" r="2" fill="#00a862" opacity="0.6" />
                        <circle cx="68" cy="22" r="2" fill="#00a862" opacity="0.7" />
                        <polygon
                          points="70,16 71.5,19 74.5,20 71.5,21 70,24 68.5,21 65.5,20 68.5,19"
                          fill="#00a862"
                          opacity="0.8"
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
              width: 840,
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

              {/* Table 1: Tài khoản matching Screenshot 1 */}
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
                      checked={draftAccCode === "111"}
                      onChange={(e) => setDraftAccCode(e.target.checked ? "111" : "")}
                      style={{ accentColor: "#00a862" }}
                    />
                    <span>Chọn tất cả</span>
                  </label>

                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Nhập từ khóa tìm kiếm"
                      value={accSearchText}
                      onChange={(e) => setAccSearchText(e.target.value)}
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
                            checked={draftAccCode === "111"}
                            onChange={(e) => setDraftAccCode(e.target.checked ? "111" : "")}
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
                          Số tài khoản
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "left",
                            borderRight: "1px solid #cbd5e1",
                          }}
                        >
                          Tên tài khoản
                        </th>
                        <th
                          style={{
                            padding: "7px 10px",
                            fontWeight: 600,
                            textAlign: "right",
                            width: 60,
                          }}
                        >
                          Bậc
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((acc) => {
                        const isSelected = draftAccCode === acc.code;
                        return (
                          <tr
                            key={acc.code}
                            onClick={() =>
                              setDraftAccCode(isSelected ? "" : acc.code)
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
                              {acc.code}
                            </td>
                            <td
                              style={{
                                padding: "6px 10px",
                                borderRight: "1px solid #f1f5f9",
                              }}
                            >
                              {acc.name}
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>
                              {acc.level}
                            </td>
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
                    <span>Tổng số: 208</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span>Số dòng/trang: 20</span>
                      <span>&lt; 1 2 3 .. 11 &gt;</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table 2: Đối tượng matching Screenshot 1 */}
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
                      checked={draftPartnerCode === "KH00001"}
                      onChange={(e) =>
                        setDraftPartnerCode(e.target.checked ? "KH00001" : "")
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
                            checked={draftPartnerCode === "KH00001"}
                            onChange={(e) =>
                              setDraftPartnerCode(e.target.checked ? "KH00001" : "")
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
                            width: 130,
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
                    <span>Tổng số: 4</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span>Số dòng/trang: 20</span>
                      <span>&lt; 1 &gt;</span>
                    </div>
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
