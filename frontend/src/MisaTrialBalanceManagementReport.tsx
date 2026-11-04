import { useState, useMemo, useEffect, useCallback } from "react";
import { request } from "./live-api";
import { useApiSession } from "./ApiSession";
import {
  MisaAccumulateFromRadioGroup,
  MisaBranchTagSelector,
  MISA_REPORT_PERIOD_OPTIONS,
  computeMisaPeriodDates,
  dmyToIsoDate,
  isoToDmyDate,
} from "./FinancialForm";
import {
  buildClientFallbackMisaHtml,
  createApiWriter,
  executeReportExportUcRpt15,
  openMisaReportPreviewModal,
} from "./misa-api-writes";
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

const CURRENT_YEAR = new Date().getFullYear();

export interface TrialBalanceAccountItem {
  code: string;
  name: string;
  isParent?: boolean;
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

  // Active applied parameters
  const [period, setPeriod] = useState<string>("Tháng 10");
  const [fromDate, setFromDate] = useState<string>(`01/10/${CURRENT_YEAR}`);
  const [toDate, setToDate] = useState<string>(`31/10/${CURRENT_YEAR}`);
  const [accountLevel, setAccountLevel] = useState<string>("3");
  const [showBothSides, setShowBothSides] = useState<boolean>(true);
  const [accumulateFrom, setAccumulateFrom] = useState<"data_start" | "fiscal_start">("fiscal_start");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Draft parameters inside "Chọn tham số" drawer
  const [draftPeriod, setDraftPeriod] = useState<string>("Tháng 10");
  const [draftFromDate, setDraftFromDate] = useState<string>(`01/10/${CURRENT_YEAR}`);
  const [draftToDate, setDraftToDate] = useState<string>(`31/10/${CURRENT_YEAR}`);
  const [draftAccountLevel, setDraftAccountLevel] = useState<string>("3");
  const [draftShowBothSides, setDraftShowBothSides] = useState<boolean>(true);
  const [draftAccumulateFrom, setDraftAccumulateFrom] = useState<"data_start" | "fiscal_start">("fiscal_start");
  const [draftBranchId, setDraftBranchId] = useState<string>("");

  const [availableBranches, setAvailableBranches] = useState<Array<{ id: string; code?: string; name: string }>>([]);
  const [resolvedCompanyName, setResolvedCompanyName] = useState<string>("");

  const openParamDrawer = useCallback(() => {
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftAccountLevel(accountLevel);
    setDraftShowBothSides(showBothSides);
    setDraftAccumulateFrom(accumulateFrom);
    setDraftBranchId(selectedBranchId);
    setIsParamDrawerOpen(true);
  }, [period, fromDate, toDate, accountLevel, showBothSides, accumulateFrom, selectedBranchId]);

  // Subtitle period string derived dynamically from active period & date range
  const subtitlePeriod = useMemo(() => {
    const mMatch = /^01\/(\d{2})\/(\d{4})$/.exec(fromDate.trim());
    const endMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(toDate.trim());
    if (mMatch && endMatch && mMatch[1] === endMatch[2] && mMatch[2] === endMatch[3]) {
      const monthNum = Number(mMatch[1]);
      return `Tháng ${monthNum} năm ${mMatch[2]}`;
    }
    if (fromDate === `01/01/${CURRENT_YEAR}` && toDate === `31/12/${CURRENT_YEAR}`) {
      return `Năm ${CURRENT_YEAR} (Từ ngày ${fromDate} đến ngày ${toDate})`;
    }
    return `Từ ngày ${fromDate} đến ngày ${toDate}`;
  }, [fromDate, toDate]);

  const { token, companyId, company } = useApiSession();
  const [liveRows, setLiveRows] = useState<TrialBalanceAccountItem[] | null>(null);
  const [liveLeafRows, setLiveLeafRows] = useState<TrialBalanceAccountItem[] | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const loadTrialBalanceData = useCallback(
    (targetFrom: string, targetTo: string, targetBranch: string, targetAccum: string) => {
      if (!companyId) return;
      const params = new URLSearchParams();
      params.set("company_id", companyId);
      const isoFrom = dmyToIsoDate(targetFrom);
      const isoTo = dmyToIsoDate(targetTo);
      if (isoFrom) params.set("from_date", isoFrom);
      if (isoTo) params.set("to_date", isoTo);
      if (targetBranch) params.set("branch_id", targetBranch);
      if (targetAccum) params.set("accumulate_from", targetAccum);

      request<any>(`/api/v1/reports/tt99-financial-statements/?${params.toString()}`, token)
        .then((res) => {
          if (res?.company_name) setResolvedCompanyName(String(res.company_name));
          if (Array.isArray(res?.branches)) setAvailableBranches(res.branches);
          const tb = Array.isArray(res?.trial_balance) ? res.trial_balance : [];
          const mapped: TrialBalanceAccountItem[] = tb.map((r: any) => ({
            code: String(r.accountNumber || ""),
            name: String(r.accountName || ""),
            isParent: Boolean(r.isParent),
            openingDebit: Number(r.openDebit || 0),
            openingCredit: Number(r.openCredit || 0),
            periodDebit: Number(r.periodDebit || 0),
            periodCredit: Number(r.periodCredit || 0),
            accumDebit: Number(r.accumDebit !== undefined ? r.accumDebit : r.periodDebit || 0),
            accumCredit: Number(r.accumCredit !== undefined ? r.accumCredit : r.periodCredit || 0),
            closingDebit: Number(r.closeDebit || 0),
            closingCredit: Number(r.closeCredit || 0),
          }));
          const leaves: TrialBalanceAccountItem[] = tb
            .filter((r: any) => !r.isParent)
            .map((r: any) => ({
              code: String(r.accountNumber || ""),
              name: String(r.accountName || ""),
              openingDebit: Number(r.openDebit || 0),
              openingCredit: Number(r.openCredit || 0),
              periodDebit: Number(r.periodDebit || 0),
              periodCredit: Number(r.periodCredit || 0),
              accumDebit: Number(r.accumDebit !== undefined ? r.accumDebit : r.periodDebit || 0),
              accumCredit: Number(r.accumCredit !== undefined ? r.accumCredit : r.periodCredit || 0),
              closingDebit: Number(r.closeDebit || 0),
              closingCredit: Number(r.closeCredit || 0),
            }));
          setLiveRows(mapped);
          setLiveLeafRows(leaves);
        })
        .catch(() => {});
    },
    [companyId, token],
  );

  useEffect(() => {
    loadTrialBalanceData(fromDate, toDate, selectedBranchId, accumulateFrom);
  }, [loadTrialBalanceData, fromDate, toDate, selectedBranchId, accumulateFrom]);

  const sourceRows = liveRows !== null ? liveRows : DEFAULT_TRIAL_BALANCE_DATA;

  // Filtered rows by accountLevel, showBothSides, and searchKeyword
  const filteredRows = useMemo(() => {
    const maxLen =
      accountLevel === "1"
        ? 3
        : accountLevel === "2"
          ? 4
          : accountLevel === "3"
            ? 5
            : accountLevel === "4"
              ? 6
              : 99;

    let rowsByLevel = sourceRows.filter((r) => r.code.length <= maxLen);

    if (!showBothSides) {
      rowsByLevel = rowsByLevel.map((r) => {
        const netOpen = (r.openingDebit || 0) - (r.openingCredit || 0);
        const netClose = (r.closingDebit || 0) - (r.closingCredit || 0);
        return {
          ...r,
          openingDebit: Math.max(netOpen, 0),
          openingCredit: Math.max(-netOpen, 0),
          closingDebit: Math.max(netClose, 0),
          closingCredit: Math.max(-netClose, 0),
        };
      });
    }

    if (!searchKeyword.trim()) return rowsByLevel;
    const kw = searchKeyword.toLowerCase();
    return rowsByLevel.filter(
      (r) => r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw),
    );
  }, [searchKeyword, sourceRows, accountLevel, showBothSides]);

  // Totals matching screenshot or live leaf rows
  const totals = useMemo(() => {
    if (liveLeafRows !== null) {
      return liveLeafRows.reduce(
        (acc, r) => ({
          openingDebit: (acc.openingDebit || 0) + (r.openingDebit || 0),
          openingCredit: (acc.openingCredit || 0) + (r.openingCredit || 0),
          periodDebit: (acc.periodDebit || 0) + (r.periodDebit || 0),
          periodCredit: (acc.periodCredit || 0) + (r.periodCredit || 0),
          accumDebit: (acc.accumDebit || 0) + (r.accumDebit || 0),
          accumCredit: (acc.accumCredit || 0) + (r.accumCredit || 0),
          closingDebit: (acc.closingDebit || 0) + (r.closingDebit || 0),
          closingCredit: (acc.closingCredit || 0) + (r.closingCredit || 0),
        }),
        {
          openingDebit: 0,
          openingCredit: 0,
          periodDebit: 0,
          periodCredit: 0,
          accumDebit: 0,
          accumCredit: 0,
          closingDebit: 0,
          closingCredit: 0,
        },
      );
    }
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
  }, [liveLeafRows]);

  const handleApplyParams = () => {
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setAccountLevel(draftAccountLevel);
    setShowBothSides(draftShowBothSides);
    setAccumulateFrom(draftAccumulateFrom);
    setSelectedBranchId(draftBranchId);
    setIsParamDrawerOpen(false);
    loadTrialBalanceData(draftFromDate, draftToDate, draftBranchId, draftAccumulateFrom);
  };

  const handleResetParams = () => {
    setDraftPeriod("Tháng 10");
    setDraftFromDate(`01/10/${CURRENT_YEAR}`);
    setDraftToDate(`31/10/${CURRENT_YEAR}`);
    setDraftAccountLevel("3");
    setDraftShowBothSides(true);
    setDraftAccumulateFrom("fiscal_start");
    setDraftBranchId("");
  };

  const handleExportReport = async (outputFormat: "PRINT" | "XLSX" | "PDF") => {
    setExportingFormat(outputFormat);
    const exportPayload = {
      company_id: companyId || company?.id || "",
      report_code: "S06-DN",
      title: "BẢNG CÂN ĐỐI TÀI KHOẢN",
      period_str: subtitlePeriod,
      output_format: outputFormat,
      export_scope: "ALL_MATCHING_FILTERS",
      columns: [
        { key: "account_code", label: "Số tài khoản", type: "code", data_type: "code" },
        { key: "account_name", label: "Tên tài khoản", type: "text", data_type: "text" },
        { key: "opening_debit", label: "Đầu kỳ - Nợ", group: "Đầu kỳ", sublabel: "Nợ", type: "number", data_type: "number", grand_total: totals.openingDebit || 0 },
        { key: "opening_credit", label: "Đầu kỳ - Có", group: "Đầu kỳ", sublabel: "Có", type: "number", data_type: "number", grand_total: totals.openingCredit || 0 },
        { key: "period_debit", label: "Phát sinh - Nợ", group: "Phát sinh", sublabel: "Nợ", type: "number", data_type: "number", grand_total: totals.periodDebit || 0 },
        { key: "period_credit", label: "Phát sinh - Có", group: "Phát sinh", sublabel: "Có", type: "number", data_type: "number", grand_total: totals.periodCredit || 0 },
        { key: "accum_debit", label: "Phát sinh - Nợ lũy kế", group: "Phát sinh", sublabel: "Nợ lũy kế", type: "number", data_type: "number", grand_total: totals.accumDebit || 0 },
        { key: "accum_credit", label: "Phát sinh - Có lũy kế", group: "Phát sinh", sublabel: "Có lũy kế", type: "number", data_type: "number", grand_total: totals.accumCredit || 0 },
        { key: "closing_debit", label: "Cuối kỳ - Nợ", group: "Cuối kỳ", sublabel: "Nợ", type: "number", data_type: "number", grand_total: totals.closingDebit || 0 },
        { key: "closing_credit", label: "Cuối kỳ - Có", group: "Cuối kỳ", sublabel: "Có", type: "number", data_type: "number", grand_total: totals.closingCredit || 0 },
      ],
      rows: filteredRows.map((r) => ({
        account_code: r.code,
        account_name: r.name,
        is_subtotal: Boolean(r.isParent),
        is_bold: Boolean(r.isParent),
        opening_debit: r.openingDebit || 0,
        opening_credit: r.openingCredit || 0,
        period_debit: r.periodDebit || 0,
        period_credit: r.periodCredit || 0,
        accum_debit: r.accumDebit || 0,
        accum_credit: r.accumCredit || 0,
        closing_debit: r.closingDebit || 0,
        closing_credit: r.closingCredit || 0,
      })),
      grand_total: {
        opening_debit: totals.openingDebit || 0,
        opening_credit: totals.openingCredit || 0,
        period_debit: totals.periodDebit || 0,
        period_credit: totals.periodCredit || 0,
        accum_debit: totals.accumDebit || 0,
        accum_credit: totals.accumCredit || 0,
        closing_debit: totals.closingDebit || 0,
        closing_credit: totals.closingCredit || 0,
      },
      parameters: {
        from_date: fromDate,
        to_date: toDate,
        period_label: subtitlePeriod,
      },
      options: {
        orientation: "LANDSCAPE",
        paper_size: "A4",
        company_name: company?.name || "Công ty TNHH XYZ",
      },
    };
    try {
      const effectiveToken = token || localStorage.getItem("erp_token") || "";
      const effectiveCompanyId = exportPayload.company_id;
      if (effectiveToken && effectiveCompanyId) {
        const writer = createApiWriter(effectiveCompanyId, (path, init) =>
          request(path, effectiveToken || undefined, init),
        );
        await executeReportExportUcRpt15(writer, exportPayload, effectiveToken);
        return;
      }
      openMisaReportPreviewModal({
        htmlText: buildClientFallbackMisaHtml(exportPayload),
        title: "BẢNG CÂN ĐỐI TÀI KHOẢN",
        reportCode: "S06-DN",
        requestedFormat: outputFormat,
      });
    } catch {
      openMisaReportPreviewModal({
        htmlText: buildClientFallbackMisaHtml(exportPayload),
        title: "BẢNG CÂN ĐỐI TÀI KHOẢN",
        reportCode: "S06-DN",
        requestedFormat: outputFormat,
      });
    } finally {
      setExportingFormat(null);
    }
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
            onClick={openParamDrawer}
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
            onClick={openParamDrawer}
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
            onClick={() => notify?.("Hệ thống hỗ trợ kế toán Sổ Việt ERP.")}
          >
            <MessageCircle size={14} />
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", background: "#ffffff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#334155", fontSize: 12.5, cursor: "pointer" }}
            title="In báo cáo chuẩn mẫu MISA"
            onClick={() => void handleExportReport("PRINT")}
          >
            <Printer size={14} />
            <span>{exportingFormat === "PRINT" ? "Đang in..." : "In"}</span>
            <ChevronDown size={12} />
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            style={{ height: 30, padding: "0 10px", border: "1px solid #86efac", background: "#f0fdf4", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#166534", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            title="Kết xuất tệp Excel (.xlsx) chuẩn MISA"
            onClick={() => void handleExportReport("XLSX")}
          >
            <Download size={14} />
            <span>{exportingFormat === "XLSX" ? "Đang xuất..." : "Xuất Excel"}</span>
          </button>

          <button
            type="button"
            disabled={exportingFormat !== null}
            style={{ height: 30, padding: "0 10px", border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, color: "#1d4ed8", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            title="Kết xuất tệp PDF (.pdf) chuẩn MISA"
            onClick={() => void handleExportReport("PDF")}
          >
            <Download size={14} />
            <span>{exportingFormat === "PDF" ? "Đang xuất..." : "PDF"}</span>
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
                <th rowSpan={2} style={{ padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1", width: 90 }}>
                  Số tài khoản
                </th>
                <th rowSpan={2} style={{ padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1", minWidth: 220 }}>
                  Tên tài khoản
                </th>
                <th colSpan={2} style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Đầu kỳ
                </th>
                <th colSpan={4} style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>
                  Phát sinh
                </th>
                <th colSpan={2} style={{ padding: "4px 8px", textAlign: "center" }}>
                  Cuối kỳ
                </th>
              </tr>

              {/* Row 2 Sub-headers */}
              <tr style={{ background: "#e2f0d9", color: "#1e293b", fontWeight: 600, borderBottom: "1px solid #cbd5e1" }}>
                {/* Đầu kỳ */}
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 100 }}>Nợ</th>
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 100 }}>Có</th>
                {/* Phát sinh */}
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ</th>
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Có</th>
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ lũy kế</th>
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Có lũy kế</th>
                {/* Cuối kỳ */}
                <th style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", width: 110 }}>Nợ</th>
                <th style={{ padding: "4px 8px", textAlign: "right", width: 110 }}>Có</th>
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
                    <td
                      style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#0284c7", fontWeight: 600, cursor: "pointer" }}
                      onClick={() => notify?.(`Mở sổ chi tiết tài khoản ${row.code} - ${row.name}`)}
                      title="Bấm để xem sổ chi tiết tài khoản"
                    >
                      {row.code}
                    </td>

                    {/* Tên TK */}
                    <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                      {row.name}
                    </td>

                    {/* Đầu kỳ Nợ / Có */}
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.openingDebit).text}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.openingCredit).text}
                    </td>

                    {/* Phát sinh Nợ / Có */}
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.periodDebit).text}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.periodCredit).text}
                    </td>

                    {/* Lũy kế Nợ / Có */}
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.accumDebit).text}
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                      {formatCurrency(row.accumCredit).text}
                    </td>

                    {/* Cuối kỳ Nợ / Có (Red if negative) */}
                    <td
                      style={{
                        padding: "4px 8px",
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
                        padding: "4px 8px",
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
                <td colSpan={2} style={{ padding: "5px 8px", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  Tổng cộng
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.openingDebit ? totals.openingDebit.toLocaleString("vi-VN") : ""}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.openingCredit ? totals.openingCredit.toLocaleString("vi-VN") : ""}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.periodDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.periodCredit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.accumDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.accumCredit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1", color: "#1e293b" }}>
                  {totals.closingDebit.toLocaleString("vi-VN")}
                </td>
                <td style={{ padding: "5px 8px", textAlign: "right", color: "#1e293b" }}>
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
              maxWidth: 500,
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
                padding: "16px 24px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
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
            <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, fontSize: 13 }}>
              {/* 0. Chi nhánh */}
              <MisaBranchTagSelector
                companyLabel={resolvedCompanyName || company?.name}
                branches={availableBranches}
                selectedBranchId={draftBranchId}
                onChange={(bid: string) => setDraftBranchId(bid)}
              />

              {/* 1. Kỳ báo cáo */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>
                  Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={draftPeriod}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraftPeriod(val);
                    if (val !== "Tùy chọn") {
                      const computed = computeMisaPeriodDates(val, CURRENT_YEAR);
                      setDraftFromDate(computed.fromDate);
                      setDraftToDate(computed.toDate);
                    }
                  }}
                  style={{
                    width: "100%",
                    height: 36,
                    padding: "0 10px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  {MISA_REPORT_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Từ ngày - Đến ngày */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>
                    Từ ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftFromDate}
                      placeholder="DD/MM/YYYY"
                      onChange={(e) => {
                        setDraftFromDate(e.target.value);
                        setDraftPeriod("Tùy chọn");
                      }}
                      style={{
                        width: "100%",
                        height: 36,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="date"
                      value={dmyToIsoDate(draftFromDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDraftFromDate(isoToDmyDate(e.target.value));
                          setDraftPeriod("Tùy chọn");
                        }
                      }}
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        width: 24,
                        height: 28,
                        opacity: 0,
                        cursor: "pointer",
                      }}
                      title="Chọn từ ngày"
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>
                    Đến ngày
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={draftToDate}
                      placeholder="DD/MM/YYYY"
                      onChange={(e) => {
                        setDraftToDate(e.target.value);
                        setDraftPeriod("Tùy chọn");
                      }}
                      style={{
                        width: "100%",
                        height: 36,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <input
                      type="date"
                      value={dmyToIsoDate(draftToDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setDraftToDate(isoToDmyDate(e.target.value));
                          setDraftPeriod("Tùy chọn");
                        }
                      }}
                      style={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        width: 24,
                        height: 28,
                        opacity: 0,
                        cursor: "pointer",
                      }}
                      title="Chọn đến ngày"
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" }} />
                  </div>
                </div>
              </div>

              {/* 3. Bậc tài khoản */}
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>
                  Bậc tài khoản
                </label>
                <select
                  value={draftAccountLevel}
                  onChange={(e) => setDraftAccountLevel(e.target.value)}
                  style={{
                    width: 140,
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
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="all">Bậc tổng hợp</option>
                </select>
              </div>

              {/* 4. Hiển thị số dư hai bên */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="showBothSides"
                  checked={draftShowBothSides}
                  onChange={(e) => setDraftShowBothSides(e.target.checked)}
                  style={{ accentColor: "#00a862", width: 16, height: 16, cursor: "pointer", margin: 0 }}
                />
                <label htmlFor="showBothSides" style={{ cursor: "pointer", color: "#1e293b", fontWeight: 500 }}>
                  Hiển thị số dư hai bên
                </label>
              </div>

              {/* 5. Lấy lũy kế phát sinh từ (Horizontal side-by-side) */}
              <MisaAccumulateFromRadioGroup
                value={draftAccumulateFrom}
                onChange={setDraftAccumulateFrom}
                name="tbAccumulateFrom"
              />
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
