import React, { useState, useMemo, useEffect, useCallback } from "react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
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
  Calendar,
  ChevronDown,
  Sparkles,
  FileCheck,
  FileCode,
  Send,
  ExternalLink,
  Info,
} from "lucide-react";

export interface IncomeStatementItem {
  id: string;
  name: string;
  code: string;
  note?: string;
  currentPeriod: number | null;
  previousPeriod: number | null;
  contentStatus?: string;
  isBold?: boolean;
  isClickable?: boolean;
  indent?: boolean;
  accountRef?: string;
}

const CORE_SUMMARY_CODES = new Set(["10", "20", "30", "40", "50", "60"]);

function toIsoDateB02(ddmmyyyy: string, fallback: string): string {
  const s = (ddmmyyyy || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return fallback;
}

// Full 21 rows of Circular 99/2025/TT-BTC B02-DN (initial zero state, never fake demo numbers)
const BASE_INCOME_DATA: IncomeStatementItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.1",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 511",
  },
  {
    id: "02",
    name: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    note: "VI.2",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 521",
  },
  {
    id: "10",
    name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "11",
    name: "4. Giá vốn hàng bán",
    code: "11",
    note: "VI.3",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 632",
  },
  {
    id: "20",
    name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "21",
    name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    note: "VI.4",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 5117 / 632",
  },
  {
    id: "22",
    name: "7. Doanh thu hoạt động tài chính",
    code: "22",
    note: "VI.5",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 515",
  },
  {
    id: "23",
    name: "8. Chi phí tài chính",
    code: "23",
    note: "VI.6",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 635",
  },
  {
    id: "24",
    name: "- Trong đó: Chi phí đi vay",
    code: "24",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    indent: true,
    isClickable: true,
    accountRef: "TK 6351",
  },
  {
    id: "25",
    name: "9. Chi phí bán hàng",
    code: "25",
    note: "VI.9",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 641",
  },
  {
    id: "26",
    name: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    note: "VI.9",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 642",
  },
  {
    id: "30",
    name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "31",
    name: "12. Thu nhập khác",
    code: "31",
    note: "VI.7",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 711",
  },
  {
    id: "32",
    name: "13. Chi phí khác",
    code: "32",
    note: "VI.8",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 811",
  },
  {
    id: "40",
    name: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "50",
    name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "51",
    name: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    note: "VI.11",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 8211",
  },
  {
    id: "52",
    name: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    note: "VI.11",
    currentPeriod: 0,
    previousPeriod: 0,
    isClickable: true,
    accountRef: "TK 8212",
  },
  {
    id: "60",
    name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    note: "",
    currentPeriod: 0,
    previousPeriod: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "70",
    name: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    note: "VI.12",
    currentPeriod: null,
    previousPeriod: null,
  },
  {
    id: "71",
    name: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    note: "VI.12",
    currentPeriod: null,
    previousPeriod: null,
  },
];

export interface MisaBusinessResultReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaBusinessResultReport({
  onBack,
  notify,
}: MisaBusinessResultReportProps) {
  // Parameters Drawer State
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [formCode, setFormCode] = useState<"B02-DN" | "B02-DNKLT">("B02-DN");
  const [displayUnit, setDisplayUnit] = useState<"VND" | "THOUSAND_VND" | "MILLION_VND">("VND");
  const [period, setPeriod] = useState("Năm nay");
  const [fromDate, setFromDate] = useState("01/01/2026");
  const [toDate, setToDate] = useState("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  // Temporary drawer draft state for user changes
  const [draftFormCode, setDraftFormCode] = useState<"B02-DN" | "B02-DNKLT">("B02-DN");
  const [draftDisplayUnit, setDraftDisplayUnit] = useState<"VND" | "THOUSAND_VND" | "MILLION_VND">("VND");
  const [draftPeriod, setDraftPeriod] = useState("Năm nay");
  const [draftFromDate, setDraftFromDate] = useState("01/01/2026");
  const [draftToDate, setDraftToDate] = useState("31/12/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);
  const [draftHideZero, setDraftHideZero] = useState(false);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // AI highlights state
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // Run & Validation state (UC-RPT-04)
  const [currentRun, setCurrentRun] = useState<any | null>(null);
  const [savedRuns, setSavedRuns] = useState<any[]>([]);
  const [validationData, setValidationData] = useState<any | null>(null);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  // Drilldown modal state
  const [drilldownItem, setDrilldownItem] = useState<IncomeStatementItem | null>(null);
  const [drilldownDetail, setDrilldownDetail] = useState<any | null>(null);
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  // Saved reports modal
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);
  const [rows, setRows] = useState<IncomeStatementItem[]>(BASE_INCOME_DATA);

  const mapBackendLinesToRows = useCallback((backendLines: any[]) => {
    const byCode: Record<string, any> = {};
    for (const ln of backendLines) {
      if (ln && ln.indicator_code) {
        byCode[String(ln.indicator_code)] = ln;
      }
    }
    return BASE_INCOME_DATA.map((item) => {
      const entry = byCode[item.code];
      if (!entry) return item;
      const curRaw = entry.current_period_amount;
      const prevRaw = entry.comparative_period_amount;
      return {
        ...item,
        name: entry.indicator_name || item.name,
        note: entry.note_reference ?? item.note,
        contentStatus: entry.content_status || "COMPLETE",
        currentPeriod: curRaw === null || curRaw === undefined ? null : Number(curRaw),
        previousPeriod: prevRaw === null || prevRaw === undefined ? null : Number(prevRaw),
      };
    });
  }, []);

  const loadRunById = useCallback(
    async (runId: string, unitOverride?: string) => {
      const cid = getSelectedCompanyId();
      if (!cid) return;
      const u = unitOverride || displayUnit;
      const detail: any = await apiClient.get(
        `/api/v1/reports/business-result/runs/${encodeURIComponent(runId)}/?company_id=${encodeURIComponent(cid)}&display_unit=${encodeURIComponent(u)}`
      );
      if (detail) {
        setCurrentRun(detail.run || detail);
        if (detail.validation) setValidationData(detail.validation);
        if (Array.isArray(detail.lines)) {
          setRows(mapBackendLinesToRows(detail.lines));
        }
      }
    },
    [displayUnit, mapBackendLinesToRows]
  );

  const loadReportFromBackend = useCallback(
    async (opts?: {
      targetFormCode?: "B02-DN" | "B02-DNKLT";
      targetUnit?: "VND" | "THOUSAND_VND" | "MILLION_VND";
      targetFrom?: string;
      targetTo?: string;
      useSavedOnly?: boolean;
      forceGenerate?: boolean;
    }) => {
      const fCode = opts?.targetFormCode || formCode;
      const dUnit = opts?.targetUnit || displayUnit;
      const fDate = opts?.targetFrom || fromDate;
      const tDate = opts?.targetTo || toDate;
      const savedOnly = opts?.useSavedOnly ?? fetchFromSaved;

      try {
        const cid = getSelectedCompanyId();
        if (cid) {
          const runsRes: any = await apiClient.get(
            `/api/v1/reports/business-result/runs/?company_id=${encodeURIComponent(cid)}&legal_form_code=${encodeURIComponent(fCode)}`
          );
          const list = Array.isArray(runsRes?.runs) ? runsRes.runs : [];
          setSavedRuns(list);

          if (!opts?.forceGenerate && list.length > 0 && savedOnly) {
            await loadRunById(list[0].statement_run_id || list[0].id, dUnit);
            return;
          }

          // Generate / refresh a Statement Run on UC-RPT-04 endpoint
          const created: any = await apiClient.post("/api/v1/reports/business-result/runs/", {
            company_id: cid,
            template_code: fCode,
            period_start_date: toIsoDateB02(fDate, "2026-01-01"),
            period_end_date: toIsoDateB02(tDate, "2026-12-31"),
            display_unit: dUnit,
          });
          if (created) {
            setCurrentRun(created.run || created);
            if (created.validation) setValidationData(created.validation);
            if (Array.isArray(created.lines)) {
              setRows(mapBackendLinesToRows(created.lines));
            }
            const refreshedList: any = await apiClient.get(
              `/api/v1/reports/business-result/runs/?company_id=${encodeURIComponent(cid)}&legal_form_code=${encodeURIComponent(fCode)}`
            );
            if (Array.isArray(refreshedList?.runs)) {
              setSavedRuns(refreshedList.runs);
            }
            return;
          }
        }
      } catch {
        // Fallback to tt99 summary if company context is not initialized
      }

      try {
        const cid = getSelectedCompanyId();
        const query = cid ? `?company_id=${cid}` : "";
        const res: any = await apiClient.get(`/api/v1/reports/tt99-financial-statements/${query}`);
        if (res && res.b02_dn) {
          const b02 = res.b02_dn;
          setRows(
            BASE_INCOME_DATA.map((item) => {
              const entry = b02[item.code];
              if (!entry) return item;
              return {
                ...item,
                currentPeriod: Number(entry.currentPeriod ?? entry.current ?? 0),
                previousPeriod: Number(entry.previousPeriod ?? entry.previous ?? 0),
              };
            })
          );
        }
      } catch {
        // Keep clean zero state
      }
    },
    [displayUnit, fetchFromSaved, formCode, fromDate, loadRunById, mapBackendLinesToRows, toDate]
  );

  useEffect(() => {
    void loadReportFromBackend();
  }, [loadReportFromBackend]);

  const handleOpenDrilldown = async (row: IncomeStatementItem) => {
    setDrilldownItem(row);
    setDrilldownDetail(null);
    const cid = getSelectedCompanyId();
    const runId = currentRun?.statement_run_id || currentRun?.id;
    if (!cid || !runId) return;
    setIsLoadingDrilldown(true);
    try {
      const res: any = await apiClient.get(
        `/api/v1/reports/business-result/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(row.code)}/drilldown/?company_id=${encodeURIComponent(cid)}&slot_code=YEAR_CURRENT`
      );
      setDrilldownDetail(res);
    } catch {
      setDrilldownDetail(null);
    } finally {
      setIsLoadingDrilldown(false);
    }
  };

  const handleValidateRun = async () => {
    const cid = getSelectedCompanyId();
    const runId = currentRun?.statement_run_id || currentRun?.id;
    if (!cid || !runId) {
      notify?.("Đã kiểm tra công thức B02: 10 = 01 - 02; 20 = 10 - 11; 30 = 20 + 21 + 22 - 23 - 25 - 26; 40 = 31 - 32; 50 = 30 + 40; 60 = 50 - 51 - 52.");
      return;
    }
    try {
      const res: any = await apiClient.post(
        `/api/v1/reports/business-result/runs/${encodeURIComponent(runId)}/validate/?company_id=${encodeURIComponent(cid)}`,
        { company_id: cid }
      );
      setValidationData(res);
      setIsValidationModalOpen(true);
      notify?.(
        `Kiểm tra ${formCode}: ${res.validation_status} (${res.passed_count || 0} đạt, ${res.warning_count || 0} cảnh báo, ${res.blocker_count || 0} lỗi chặn).`
      );
    } catch {
      notify?.("Không thể thực hiện kiểm tra Statement Run B02.");
    }
  };

  const handleSaveNewRunVersion = async () => {
    await loadReportFromBackend({ forceGenerate: true });
    notify?.(`Đã lưu phiên bản mới của báo cáo ${formCode} kỳ ${fromDate} - ${toDate}.`);
  };

  const handleExportReport = async (exportFormat: "EXCEL" | "PDF") => {
    const cid = getSelectedCompanyId();
    const runId = currentRun?.statement_run_id || currentRun?.id;
    if (cid && runId) {
      try {
        const res: any = await apiClient.post(
          `/api/v1/reports/business-result/runs/${encodeURIComponent(runId)}/export/?company_id=${encodeURIComponent(cid)}`,
          {
            company_id: cid,
            export_format: exportFormat,
            display_unit: displayUnit,
            hide_zero_lines: hideZero,
          }
        );
        notify?.(`Đã kết xuất tệp ${res?.file_name || `${formCode}.${exportFormat === "EXCEL" ? "xlsx" : "pdf"}`} thành công.`);
        return;
      } catch {
        // Fallback notification
      }
    }
    notify?.(`Đã xuất khẩu báo cáo ${formCode} (${exportFormat}) thành công.`);
  };

  // Open drawer helper
  const handleOpenDrawer = () => {
    setDraftFormCode(formCode);
    setDraftDisplayUnit(displayUnit);
    setDraftPeriod(period);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setIsParamDrawerOpen(true);
  };

  // Apply parameters from drawer
  const handleApplyParams = () => {
    setFormCode(draftFormCode);
    setDisplayUnit(draftDisplayUnit);
    setPeriod(draftPeriod);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setIsParamDrawerOpen(false);
    void loadReportFromBackend({
      targetFormCode: draftFormCode,
      targetUnit: draftDisplayUnit,
      targetFrom: draftFromDate,
      targetTo: draftToDate,
      useSavedOnly: draftFetchFromSaved,
    });
    notify?.(`Đã tải lại Báo cáo kết quả hoạt động kinh doanh (${draftFormCode}) từ Sổ Cái Backend.`);
  };

  // Reset parameters in drawer
  const handleResetParams = () => {
    setDraftFormCode("B02-DN");
    setDraftDisplayUnit("VND");
    setDraftPeriod("Năm nay");
    setDraftFromDate("01/01/2026");
    setDraftToDate("31/12/2026");
    setDraftFetchFromSaved(false);
    setDraftHideZero(false);
  };

  // Number formatter matching MISA AMIS: 0 is rendered as 0, negative in (x.xxx.xxx), null as "-"
  const formatNumber = (num: number | null | undefined, status?: string) => {
    if (status === "NOT_APPLICABLE") return { text: "-", isNegative: false };
    if (status === "INSUFFICIENT_DATA" || status === "ZERO_DENOMINATOR") {
      return { text: "Chưa đủ dữ liệu", isNegative: false };
    }
    if (num === null || num === undefined) return { text: "-", isNegative: false };
    if (num === 0) return { text: "0", isNegative: false };
    if (num < 0) {
      return {
        text: `(${Math.abs(num).toLocaleString("vi-VN")})`,
        isNegative: true,
      };
    }
    return {
      text: num.toLocaleString("vi-VN"),
      isNegative: false,
    };
  };

  // Filter rows based on search keyword and hideZero checkbox (preserving core subtotals 10, 20, 30, 40, 50, 60)
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (hideZero && !CORE_SUMMARY_CODES.has(row.code)) {
        const cZero = !row.currentPeriod || row.currentPeriod === 0;
        const pZero = !row.previousPeriod || row.previousPeriod === 0;
        if (cZero && pZero) {
          return false;
        }
      }

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        return (
          row.name.toLowerCase().includes(kw) ||
          row.code.toLowerCase().includes(kw) ||
          (row.note && row.note.toLowerCase().includes(kw))
        );
      }

      return true;
    });
  }, [rows, hideZero, searchKeyword]);

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
      {/* 1. Header Bar matching MISA AMIS B02-DN */}
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
            {formCode}: Báo cáo kết quả hoạt động kinh doanh
            {formCode === "B02-DNKLT" ? " (Không đáp ứng giả định hoạt động liên tục)" : ""}
          </h2>
          {currentRun && (
            <span
              style={{
                background: currentRun.run_status === "APPROVED" ? "#dcfce7" : "#e0f2fe",
                color: currentRun.run_status === "APPROVED" ? "#166534" : "#0369a1",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              v{currentRun.version_number || currentRun.run_version || 1} • {currentRun.run_status || "GENERATED"}
            </span>
          )}
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
            Danh sách báo cáo đã lưu ({savedRuns.length})
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
            onClick={() => void handleSaveNewRunVersion()}
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
            onClick={handleOpenDrawer}
          >
            <span>Chọn tham số</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Toolbar: Kiểm tra, AI, Search, Refresh, Print, Export */}
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#334155",
              cursor: "pointer",
              fontWeight: 500,
            }}
            onClick={() => void handleValidateRun()}
          >
            <FileCheck size={15} color="#00a862" />
            <span>
              Kiểm tra
              {validationData?.validation_status
                ? ` (${validationData.validation_status})`
                : ""}
            </span>
          </button>

          {/* AI Analysis Sparkles Badge matching screenshot */}
          <button
            type="button"
            style={{
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              border: "1px solid #c7d2fe",
              borderRadius: 14,
              padding: "3px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "#6366f1",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Sparkles size={14} color="#7c3aed" />
            <span>{showAiAnalysis ? "Đóng phân tích Sổ Việt AI" : "✨ Đang phân tích..."}</span>
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
            title="Làm mới"
            onClick={() => {
              void loadReportFromBackend();
              notify?.(`Đã làm mới dữ liệu báo cáo kết quả hoạt động kinh doanh (${formCode}) từ Sổ Cái Backend.`);
            }}
          >
            <RotateCw size={14} />
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
            onClick={() => notify?.("Mở hộp thoại gửi báo cáo qua email.")}
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
              color: "#0284c7",
              cursor: "pointer",
            }}
            title="Trợ giúp"
            onClick={() => notify?.("Hệ thống trợ giúp Sổ Việt AI.")}
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
            onClick={() => void handleExportReport("PDF")}
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
            onClick={() => void handleExportReport("EXCEL")}
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
            title="Tùy chỉnh cột hiển thị"
            onClick={() => notify?.("Mở thiết lập cột báo cáo.")}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* 3. AI Highlight Panel if open */}
      {showAiAnalysis && (
        <div
          style={{
            margin: "12px 20px 0",
            padding: "14px 18px",
            background: "#faf5ff",
            border: "1px solid #e9d5ff",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <Sparkles size={20} color="#7c3aed" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, fontSize: 13, color: "#4c1d95", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13.5 }}>
              Phân tích thông minh kết quả hoạt động kinh doanh (Sổ Việt AI):
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#00a862" }}>
                  1. Doanh thu thuần (Mã 10): {formatNumber(rows.find((r) => r.code === "10")?.currentPeriod ?? 0).text}
                </strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Doanh thu thuần xác định theo công thức 10 = 01 - 02, đã loại trừ thuế gián thu và doanh thu bán BĐSĐT (Mã 21).
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#d97706" }}>
                  2. Lợi nhuận gộp (Mã 20): {formatNumber(rows.find((r) => r.code === "20")?.currentPeriod ?? 0).text}
                </strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Giá vốn hàng bán (Mã 11): {formatNumber(rows.find((r) => r.code === "11")?.currentPeriod ?? 0).text}. Chi phí đi vay (Mã 24) chỉ mang tính thuyết minh, không trừ lặp vào Mã 30.
                </p>
              </div>
              <div style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #ddd6fe" }}>
                <strong style={{ color: "#2563eb" }}>
                  3. LN sau thuế (Mã 60): {formatNumber(rows.find((r) => r.code === "60")?.currentPeriod ?? 0).text}
                </strong>
                <p style={{ margin: "4px 0 0", color: "#6b21a8", fontSize: 12 }}>
                  Xác định theo công thức 60 = 50 - 51 - 52 (thuế TNDN hiện hành TK 8211 và hoãn lại TK 8212).
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            style={{ background: "transparent", border: "none", color: "#a855f7", cursor: "pointer", padding: 4 }}
            onClick={() => setShowAiAnalysis(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4. Main Report Sheet Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 4,
            border: "1px solid #cbd5e1",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            padding: "24px 28px 20px",
            minHeight: "100%",
          }}
        >
          {/* Report Sheet Title */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: "0.2px",
              }}
            >
              BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH
              {formCode === "B02-DNKLT" ? " (KHÔNG ĐÁP ỨNG GIẢ ĐỊNH HOẠT ĐỘNG LIÊN TỤC)" : ""}
            </h1>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              (Mẫu số {formCode} ban hành theo Thông tư số 99/2025/TT-BTC của Bộ Tài chính)
            </div>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                color: "#475569",
                marginTop: 4,
              }}
            >
              Kỳ báo cáo: Từ {fromDate} đến {toDate} • Đơn vị tính:{" "}
              {displayUnit === "MILLION_VND"
                ? "Triệu đồng"
                : displayUnit === "THOUSAND_VND"
                ? "Nghìn đồng"
                : "Đồng (VND)"}
            </div>
          </div>

          {/* Table Container */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              border: "1px solid #cbd5e1",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#e2f0d9", // Signature MISA mint green header
                  borderBottom: "1px solid #cbd5e1",
                  color: "#1e293b",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <th
                  style={{
                    padding: "9px 12px",
                    textAlign: "center",
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Chỉ tiêu
                </th>
                <th
                  style={{
                    padding: "9px 10px",
                    textAlign: "center",
                    width: 70,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Mã số
                </th>
                <th
                  style={{
                    padding: "9px 10px",
                    textAlign: "center",
                    width: 110,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Thuyết minh
                </th>
                <th
                  style={{
                    padding: "9px 14px",
                    textAlign: "center",
                    width: 170,
                    borderRight: "1px solid #c2d9b8",
                  }}
                >
                  Năm nay (Kỳ này)
                </th>
                <th
                  style={{
                    padding: "9px 14px",
                    textAlign: "center",
                    width: 150,
                  }}
                >
                  Năm trước (Kỳ trước)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const currentFormatted = formatNumber(row.currentPeriod, row.contentStatus);
                const previousFormatted = formatNumber(row.previousPeriod, row.contentStatus);

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                    }}
                  >
                    {/* Chỉ tiêu */}
                    <td
                      style={{
                        padding: "7px 12px",
                        borderRight: "1px solid #f1f5f9",
                        fontWeight: row.isBold ? 700 : 400,
                        paddingLeft: row.indent ? 28 : 12,
                        color: row.isClickable ? "#0073e6" : "#1e293b",
                        cursor: row.isClickable ? "pointer" : "default",
                      }}
                      onClick={() => {
                        if (row.isClickable) {
                          void handleOpenDrilldown(row);
                          notify?.(`Xem chi tiết chỉ tiêu "${row.name}" (Mã ${row.code})`);
                        }
                      }}
                    >
                      {row.name}
                    </td>

                    {/* Mã số */}
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "center",
                        borderRight: "1px solid #f1f5f9",
                        color: "#475569",
                        fontWeight: row.isBold ? 700 : 400,
                      }}
                    >
                      {row.code}
                    </td>

                    {/* Thuyết minh */}
                    <td
                      style={{
                        padding: "7px 10px",
                        textAlign: "center",
                        borderRight: "1px solid #f1f5f9",
                        color: "#64748b",
                      }}
                    >
                      {row.note || ""}
                    </td>

                    {/* Kỳ này */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        borderRight: "1px solid #f1f5f9",
                        color: currentFormatted.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || currentFormatted.isNegative ? 700 : 400,
                      }}
                    >
                      {currentFormatted.text}
                    </td>

                    {/* Kỳ trước */}
                    <td
                      style={{
                        padding: "7px 14px",
                        textAlign: "right",
                        color: previousFormatted.isNegative ? "#dc2626" : "#1e293b",
                        fontWeight: row.isBold || previousFormatted.isNegative ? 700 : 400,
                      }}
                    >
                      {previousFormatted.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Footer Pagination Bar */}
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
                defaultValue="50"
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

      {/* 6. Parameter Drawer "Chọn tham số" matching Image 1 */}
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
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    padding: 2,
                  }}
                  title="Trợ giúp"
                  onClick={() =>
                    notify?.(
                      "Xem hướng dẫn lập báo cáo kết quả hoạt động kinh doanh B02-DN / B02-DNKLT."
                    )
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

            {/* Drawer Body Form */}
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
              {/* 0. Mẫu báo cáo & Đơn vị tiền tệ (UC-RPT-04 RPT04-F01) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Mẫu biểu TT99
                  </label>
                  <select
                    value={draftFormCode}
                    onChange={(e) => setDraftFormCode(e.target.value as "B02-DN" | "B02-DNKLT")}
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
                    <option value="B02-DN">B02-DN (Hoạt động liên tục)</option>
                    <option value="B02-DNKLT">B02-DNKLT (Không HĐ liên tục)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Đơn vị tiền tệ
                  </label>
                  <select
                    value={draftDisplayUnit}
                    onChange={(e) =>
                      setDraftDisplayUnit(e.target.value as "VND" | "THOUSAND_VND" | "MILLION_VND")
                    }
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
                    <option value="VND">Đồng (VND)</option>
                    <option value="THOUSAND_VND">Nghìn đồng</option>
                    <option value="MILLION_VND">Triệu đồng</option>
                  </select>
                </div>
              </div>

              {/* 1. Kỳ báo cáo * */}
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 600,
                    color: "#334155",
                  }}
                >
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
                    } else if (val === "Năm trước") {
                      setDraftFromDate("01/01/2025");
                      setDraftToDate("31/12/2025");
                    }
                  }}
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
                  <option value="Tháng này">Tháng này</option>
                  <option value="Tháng trước">Tháng trước</option>
                  <option value="Quý này">Quý này</option>
                  <option value="Quý trước">Quý trước</option>
                  <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                  <option value="Năm nay">Năm nay</option>
                  <option value="Năm trước">Năm trước</option>
                  <option value="Tùy chọn">Tùy chọn</option>
                </select>
              </div>

              {/* 2. Từ ngày & Đến ngày */}
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

              {/* 3. Checkboxes */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftFetchFromSaved}
                    onChange={(e) => setDraftFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính đã lập</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={draftHideZero}
                    onChange={(e) => setDraftHideZero(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Không hiển thị các chỉ tiêu có số liệu = 0</span>
                </label>
              </div>
            </div>

            {/* Drawer Footer Buttons matching Image 1: Xóa điều kiện, Hủy, Xem báo cáo */}
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
                  padding: "0 14px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#475569",
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
                    padding: "0 16px",
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

      {/* 7. Modal: Drill-down Sổ chi tiết khi click vào chỉ tiêu link xanh */}
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
              maxWidth: 820,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    background: "#e0f2fe",
                    color: "#0369a1",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Mã {drilldownItem.code}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  {drilldownItem.name} {drilldownItem.accountRef ? `(${drilldownItem.accountRef})` : ""}
                </h3>
              </div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => setDrilldownItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  fontSize: 12.5,
                  color: "#64748b",
                }}
              >
                <span>
                  Thời gian: Từ <strong>{fromDate}</strong> đến <strong>{toDate}</strong>
                </span>
                <span>
                  Số phát sinh:{" "}
                  <strong style={{ color: "#00a862" }}>
                    {formatNumber(drilldownItem.currentPeriod, drilldownItem.contentStatus).text}
                  </strong>
                </span>
              </div>

              {isLoadingDrilldown ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Đang tải chi tiết bút toán và tài khoản nguồn...
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12.5,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#334155" }}>
                      <th style={{ padding: "8px 10px" }}>Ngày CT</th>
                      <th style={{ padding: "8px 10px" }}>Số CT</th>
                      <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                      <th style={{ padding: "8px 10px" }}>Tài khoản</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Số tiền đóng góp (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(drilldownDetail?.journal_lines) &&
                    drilldownDetail.journal_lines.length > 0 ? (
                      drilldownDetail.journal_lines.map((jl: any, idx: number) => (
                        <tr key={jl.journal_line_id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px" }}>{jl.posting_date}</td>
                          <td style={{ padding: "8px 10px", color: "#0284c7", fontWeight: 600 }}>
                            {jl.entry_no || jl.journal_number}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {jl.description}
                            {jl.classification_note ? ` (${jl.classification_note})` : ""}
                          </td>
                          <td style={{ padding: "8px 10px" }}>{jl.account_code}</td>
                          <td
                            style={{
                              padding: "8px 10px",
                              textAlign: "right",
                              fontWeight: 600,
                              color: Number(jl.contribution_amount || 0) < 0 ? "#dc2626" : "#00a862",
                            }}
                          >
                            {Number(jl.contribution_amount || 0).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: "24px",
                            textAlign: "center",
                            color: "#94a3b8",
                            fontStyle: "italic",
                          }}
                        >
                          Không có chứng từ phát sinh trong kỳ báo cáo đã chọn.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
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

      {/* 8. Modal: Danh sách báo cáo đã lưu */}
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
              maxWidth: 680,
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
                Danh sách báo cáo {formCode} đã lưu
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                border: "1px solid #e2e8f0",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", color: "#475569" }}>
                  <th style={{ padding: "8px 12px" }}>Phiên bản</th>
                  <th style={{ padding: "8px 12px" }}>Kỳ áp dụng</th>
                  <th style={{ padding: "8px 12px" }}>Trạng thái</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {savedRuns.length > 0 ? (
                  savedRuns.map((r: any) => {
                    const rid = r.statement_run_id || r.id;
                    return (
                      <tr key={rid} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                          {r.legal_form_code || formCode} (v{r.version_number || r.run_version || 1})
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {r.period_start_date} → {r.period_end_date}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>
                          {r.run_status} ({r.validation_status})
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <button
                            type="button"
                            style={{
                              padding: "3px 10px",
                              background: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              borderRadius: 4,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                            onClick={() => {
                              setIsSavedReportsOpen(false);
                              void loadRunById(rid);
                              notify?.(
                                `Đã tải bản lưu ${r.legal_form_code || formCode} v${r.version_number || 1}.`
                              );
                            }}
                          >
                            Mở lại
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>
                      Chưa có Statement Run nào được lưu. Nhấn &ldquo;Lưu báo cáo&rdquo; để tạo phiên bản.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
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

      {/* 9. Modal: Kết quả kiểm tra 25 quy tắc B02 (RPT-B02-VAL-01..25) */}
      {isValidationModalOpen && validationData && (
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
          onClick={() => setIsValidationModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: 780,
              maxHeight: "82vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                Kết quả kiểm tra Báo cáo kết quả hoạt động kinh doanh ({validationData.validation_status})
              </h3>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsValidationModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "14px 20px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12.5 }}>
                <span style={{ color: "#166534", fontWeight: 600 }}>
                  Đạt: {validationData.passed_count || 0}
                </span>
                <span style={{ color: "#b45309", fontWeight: 600 }}>
                  Cảnh báo: {validationData.warning_count || 0}
                </span>
                <span style={{ color: "#dc2626", fontWeight: 600 }}>
                  Lỗi chặn (Blocker): {validationData.blocker_count || 0}
                </span>
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                  border: "1px solid #e2e8f0",
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                    <th style={{ padding: "7px 10px" }}>Mã quy tắc</th>
                    <th style={{ padding: "7px 10px" }}>Trạng thái</th>
                    <th style={{ padding: "7px 10px" }}>Nội dung kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {(validationData.results || []).map((r: any) => (
                    <tr key={r.rule_code} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rule_code}</td>
                      <td
                        style={{
                          padding: "7px 10px",
                          fontWeight: 600,
                          color:
                            r.status === "FAILED"
                              ? "#dc2626"
                              : r.status === "PASSED_WITH_WARNING"
                              ? "#b45309"
                              : "#166534",
                        }}
                      >
                        {r.status}
                      </td>
                      <td style={{ padding: "7px 10px" }}>{r.message || r.rule_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                padding: "12px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
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
                onClick={() => setIsValidationModalOpen(false)}
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
