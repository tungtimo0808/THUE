import React, { useState, useMemo, useEffect, useCallback } from "react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
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
  FileText,
  Send,
  MessageCircle,
} from "lucide-react";

export interface InterimIncomeItem {
  id: string;
  name: string;
  code: string;
  note?: string;
  quarterCurrent?: number | null;  // Quý này - Năm nay
  quarterPrevious?: number | null; // Quý này - Năm trước
  accumCurrent?: number | null;    // Lũy kế - Năm nay
  accumPrevious?: number | null;   // Lũy kế - Năm trước
  contentStatus?: string;
  isBold?: boolean;
  isClickable?: boolean;
  indent?: boolean;
}

const INTERIM_CORE_SUMMARY_CODES = new Set(["10", "20", "30", "40", "50", "60"]);

function toIsoDateInterim(ddmmyyyy: string, fallback: string): string {
  const s = (ddmmyyyy || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return fallback;
}

// Full Catalogue of B02a-DN (21 indicators, initial zero state)
const FULL_B02A_DATA: InterimIncomeItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.1",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "02",
    name: "2. Các khoản giảm trừ doanh thu",
    code: "02",
    note: "VI.2",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "10",
    name: "3. Doanh thu thuần về bán hàng và cung cấp dịch vụ (10 = 01 - 02)",
    code: "10",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "11",
    name: "4. Giá vốn hàng bán",
    code: "11",
    note: "VI.3",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "20",
    name: "5. Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20 = 10 - 11)",
    code: "20",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "21",
    name: "6. Lãi/lỗ của hoạt động bán, thanh lý bất động sản đầu tư",
    code: "21",
    note: "VI.4",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "22",
    name: "7. Doanh thu hoạt động tài chính",
    code: "22",
    note: "VI.5",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "23",
    name: "8. Chi phí tài chính",
    code: "23",
    note: "VI.6",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "24",
    name: "- Trong đó: Chi phí đi vay",
    code: "24",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    indent: true,
    isClickable: true,
  },
  {
    id: "25",
    name: "9. Chi phí bán hàng",
    code: "25",
    note: "VI.9",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "26",
    name: "10. Chi phí quản lý doanh nghiệp",
    code: "26",
    note: "VI.9",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "30",
    name: "11. Lợi nhuận thuần từ hoạt động kinh doanh {30 = 20 + 21 + 22 - (23 + 25 + 26)}",
    code: "30",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "31",
    name: "12. Thu nhập khác",
    code: "31",
    note: "VI.7",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "32",
    name: "13. Chi phí khác",
    code: "32",
    note: "VI.8",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "40",
    name: "14. Lợi nhuận khác (40 = 31 - 32)",
    code: "40",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "50",
    name: "15. Tổng lợi nhuận kế toán trước thuế (50 = 30 + 40)",
    code: "50",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "51",
    name: "16. Chi phí thuế TNDN hiện hành",
    code: "51",
    note: "VI.11",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "52",
    name: "17. Chi phí thuế TNDN hoãn lại",
    code: "52",
    note: "VI.11",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "60",
    name: "18. Lợi nhuận sau thuế thu nhập doanh nghiệp (60 = 50 - 51 - 52)",
    code: "60",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "70",
    name: "19. Lãi cơ bản trên cổ phiếu (*)",
    code: "70",
    note: "VI.12",
    quarterCurrent: null,
    quarterPrevious: null,
    accumCurrent: null,
    accumPrevious: null,
  },
  {
    id: "71",
    name: "20. Lãi suy giảm trên cổ phiếu (*)",
    code: "71",
    note: "VI.12",
    quarterCurrent: null,
    quarterPrevious: null,
    accumCurrent: null,
    accumPrevious: null,
  },
];

// Condensed Catalogue of B02b-DN (ONLY 4 indicators per Circular 99/2025/TT-BTC: 01, 31, 50, 60)
const FULL_B02B_DATA: InterimIncomeItem[] = [
  {
    id: "01",
    name: "1. Doanh thu bán hàng và cung cấp dịch vụ",
    code: "01",
    note: "VI.01",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "31",
    name: "2. Doanh thu hoạt động tài chính và thu nhập khác",
    code: "31",
    note: "VI.05, VI.07",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isClickable: true,
  },
  {
    id: "50",
    name: "3. Tổng lợi nhuận kế toán trước thuế",
    code: "50",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
  {
    id: "60",
    name: "4. Lợi nhuận sau thuế thu nhập doanh nghiệp",
    code: "60",
    note: "",
    quarterCurrent: 0,
    quarterPrevious: 0,
    accumCurrent: 0,
    accumPrevious: 0,
    isBold: true,
    isClickable: true,
  },
];

export interface MisaInterimBusinessResultReportProps {
  onBack: () => void;
  notify?: (msg: string) => void;
}

export default function MisaInterimBusinessResultReport({
  onBack,
  notify,
}: MisaInterimBusinessResultReportProps) {
  // Drawer Parameters State matching Screenshot 1
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [formCode, setFormCode] = useState<"B02a-DN" | "B02b-DN">("B02a-DN");
  const [period, setPeriod] = useState("Quý 4");
  const [year, setYear] = useState(2026);
  const [fromDate, setFromDate] = useState("01/10/2026");
  const [toDate, setToDate] = useState("31/12/2026");
  const [fetchFromSaved, setFetchFromSaved] = useState(false);
  const [hideZero, setHideZero] = useState(false);

  // Temporary drawer draft state
  const [draftFormCode, setDraftFormCode] = useState<"B02a-DN" | "B02b-DN">("B02a-DN");
  const [draftPeriod, setDraftPeriod] = useState("Quý 4");
  const [draftYear, setDraftYear] = useState(2026);
  const [draftFromDate, setDraftFromDate] = useState("01/10/2026");
  const [draftToDate, setDraftToDate] = useState("31/12/2026");
  const [draftFetchFromSaved, setDraftFetchFromSaved] = useState(false);
  const [draftHideZero, setDraftHideZero] = useState(false);

  // Search keyword inside report
  const [searchKeyword, setSearchKeyword] = useState("");

  // Saved reports modal & Run state (UC-RPT-04)
  const [isSavedReportsOpen, setIsSavedReportsOpen] = useState(false);
  const [currentRun, setCurrentRun] = useState<any | null>(null);
  const [savedRuns, setSavedRuns] = useState<any[]>([]);

  // Drilldown modal item
  const [drilldownItem, setDrilldownItem] = useState<{
    name: string;
    code: string;
    val?: number | null;
    slotCode?: string;
  } | null>(null);
  const [drilldownDetail, setDrilldownDetail] = useState<any | null>(null);
  const [isLoadingDrilldown, setIsLoadingDrilldown] = useState(false);

  const [rowsData, setRowsData] = useState<InterimIncomeItem[]>(FULL_B02A_DATA);

  const mapInterimLines = useCallback(
    (backendLines: any[], targetForm: "B02a-DN" | "B02b-DN") => {
      const baseCatalog = targetForm === "B02b-DN" ? FULL_B02B_DATA : FULL_B02A_DATA;
      const byCode: Record<string, any> = {};
      for (const ln of backendLines) {
        if (ln && ln.indicator_code) {
          byCode[String(ln.indicator_code)] = ln;
        }
      }
      return baseCatalog.map((r) => {
        const ln = byCode[r.code];
        if (!ln) return r;
        const slots = ln.slots_by_code || {};
        const qCurRaw = slots.QUARTER_CURRENT?.amount ?? ln.current_period_amount;
        const qPrevRaw = slots.QUARTER_PREVIOUS?.amount ?? ln.comparative_period_amount;
        const ytdCurRaw = slots.YTD_CURRENT?.amount ?? ln.current_period_amount;
        const ytdPrevRaw = slots.YTD_PREVIOUS?.amount ?? ln.comparative_period_amount;
        return {
          ...r,
          name: ln.indicator_name || r.name,
          note: ln.note_reference ?? r.note,
          contentStatus: ln.content_status || "COMPLETE",
          quarterCurrent: qCurRaw === null || qCurRaw === undefined ? null : Number(qCurRaw),
          quarterPrevious: qPrevRaw === null || qPrevRaw === undefined ? null : Number(qPrevRaw),
          accumCurrent: ytdCurRaw === null || ytdCurRaw === undefined ? null : Number(ytdCurRaw),
          accumPrevious: ytdPrevRaw === null || ytdPrevRaw === undefined ? null : Number(ytdPrevRaw),
        };
      });
    },
    []
  );

  const loadInterimReport = useCallback(
    async (opts?: {
      targetForm?: "B02a-DN" | "B02b-DN";
      targetYear?: number;
      targetFrom?: string;
      targetTo?: string;
      useSavedOnly?: boolean;
      forceGenerate?: boolean;
    }) => {
      const fCode = opts?.targetForm || formCode;
      const fYear = opts?.targetYear || year;
      const fDate = opts?.targetFrom || fromDate;
      const tDate = opts?.targetTo || toDate;
      const savedOnly = opts?.useSavedOnly ?? fetchFromSaved;

      setRowsData(fCode === "B02b-DN" ? FULL_B02B_DATA : FULL_B02A_DATA);

      try {
        const cid = getSelectedCompanyId();
        if (cid) {
          const runsRes: any = await apiClient.get(
            `/api/v1/reports/business-result/runs/?company_id=${encodeURIComponent(cid)}&legal_form_code=${encodeURIComponent(fCode)}`
          );
          const list = Array.isArray(runsRes?.runs) ? runsRes.runs : [];
          setSavedRuns(list);

          if (!opts?.forceGenerate && list.length > 0 && savedOnly) {
            const detail: any = await apiClient.get(
              `/api/v1/reports/business-result/runs/${encodeURIComponent(list[0].statement_run_id || list[0].id)}/?company_id=${encodeURIComponent(cid)}`
            );
            if (detail) {
              setCurrentRun(detail.run || detail);
              if (Array.isArray(detail.lines)) {
                setRowsData(mapInterimLines(detail.lines, fCode));
              }
              return;
            }
          }

          const created: any = await apiClient.post("/api/v1/reports/business-result/runs/", {
            company_id: cid,
            template_code: fCode,
            period_type: "QUARTERLY",
            fiscal_year: fYear,
            period_start_date: toIsoDateInterim(fDate, `${fYear}-10-01`),
            period_end_date: toIsoDateInterim(tDate, `${fYear}-12-31`),
          });
          if (created) {
            setCurrentRun(created.run || created);
            if (Array.isArray(created.lines)) {
              setRowsData(mapInterimLines(created.lines, fCode));
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
        // Fallback to tt99 summary if company context is unavailable
      }

      try {
        const res: any = await apiClient.get(`/api/v1/reports/tt99-financial-statements/?year=${fYear}`);
        if (res?.b02_dn) {
          const base = fCode === "B02b-DN" ? FULL_B02B_DATA : FULL_B02A_DATA;
          setRowsData(
            base.map((r) => {
              const m = res.b02_dn[r.code];
              return m
                ? {
                    ...r,
                    quarterCurrent: Number(m.current ?? m.currentPeriod ?? 0),
                    quarterPrevious: Number(m.previous ?? m.previousPeriod ?? 0),
                    accumCurrent: Number(m.current ?? m.currentPeriod ?? 0),
                    accumPrevious: Number(m.previous ?? m.previousPeriod ?? 0),
                  }
                : r;
            })
          );
        }
      } catch {
        // Keep clean zero state
      }
    },
    [fetchFromSaved, formCode, fromDate, mapInterimLines, toDate, year]
  );

  useEffect(() => {
    void loadInterimReport();
  }, [loadInterimReport]);

  const handleOpenInterimDrilldown = async (
    row: InterimIncomeItem,
    val: number | null | undefined,
    slotCode: "QUARTER_CURRENT" | "YTD_CURRENT"
  ) => {
    setDrilldownItem({
      name: row.name,
      code: row.code,
      val,
      slotCode,
    });
    setDrilldownDetail(null);
    const cid = getSelectedCompanyId();
    const runId = currentRun?.statement_run_id || currentRun?.id;
    if (!cid || !runId) return;
    setIsLoadingDrilldown(true);
    try {
      const res: any = await apiClient.get(
        `/api/v1/reports/business-result/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(row.code)}/drilldown/?company_id=${encodeURIComponent(cid)}&slot_code=${encodeURIComponent(slotCode)}`
      );
      setDrilldownDetail(res);
    } catch {
      setDrilldownDetail(null);
    } finally {
      setIsLoadingDrilldown(false);
    }
  };

  const handleOpenDrawer = () => {
    setDraftFormCode(formCode);
    setDraftPeriod(period);
    setDraftYear(year);
    setDraftFromDate(fromDate);
    setDraftToDate(toDate);
    setDraftFetchFromSaved(fetchFromSaved);
    setDraftHideZero(hideZero);
    setIsParamDrawerOpen(true);
  };

  const handleApplyParams = () => {
    setFormCode(draftFormCode);
    setPeriod(draftPeriod);
    setYear(draftYear);
    setFromDate(draftFromDate);
    setToDate(draftToDate);
    setFetchFromSaved(draftFetchFromSaved);
    setHideZero(draftHideZero);
    setIsParamDrawerOpen(false);
    void loadInterimReport({
      targetForm: draftFormCode,
      targetYear: draftYear,
      targetFrom: draftFromDate,
      targetTo: draftToDate,
      useSavedOnly: draftFetchFromSaved,
    });
    notify?.(`Đã tải lại ${draftFormCode} với tham số mới.`);
  };

  const handleResetParams = () => {
    setDraftFormCode("B02a-DN");
    setDraftPeriod("Quý 4");
    setDraftYear(2026);
    setDraftFromDate("01/10/2026");
    setDraftToDate("31/12/2026");
    setDraftFetchFromSaved(false);
    setDraftHideZero(false);
  };

  // Format currency helper
  const formatValue = (val?: number | null, status?: string) => {
    if (status === "NOT_APPLICABLE") return { text: "-", isNegative: false };
    if (status === "INSUFFICIENT_DATA" || status === "ZERO_DENOMINATOR") {
      return { text: "Chưa đủ dữ liệu", isNegative: false };
    }
    if (val === undefined || val === null) return { text: "-", isNegative: false };
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

  // Filter rows for B02a-DN / B02b-DN
  const filteredB02aRows = useMemo(() => {
    return rowsData.filter((row) => {
      if (hideZero && !INTERIM_CORE_SUMMARY_CODES.has(row.code)) {
        const allZero =
          (!row.quarterCurrent || row.quarterCurrent === 0) &&
          (!row.quarterPrevious || row.quarterPrevious === 0) &&
          (!row.accumCurrent || row.accumCurrent === 0) &&
          (!row.accumPrevious || row.accumPrevious === 0);
        if (allZero) {
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
  }, [rowsData, hideZero, searchKeyword]);

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
            {formCode}: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (
            {formCode === "B02b-DN" ? "Dạng tóm lược – 4 chỉ tiêu" : "Dạng đầy đủ – 21 chỉ tiêu"})
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
            onClick={() => {
              void loadInterimReport({ forceGenerate: true });
              notify?.(`Đã lưu phiên bản mới của báo cáo ${formCode} kỳ ${period}/${year} thành công.`);
            }}
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

      {/* 2. Action Toolbar matching Screenshot */}
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
            onClick={() => notify?.("Đang xuất khẩu tệp XML theo chuẩn TCT...")}
          >
            <FileText size={15} color="#64748b" />
            <span>Xuất XML</span>
          </button>

          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#0284c7",
              cursor: "pointer",
              fontWeight: 600,
            }}
            onClick={() => notify?.("Kết nối cổng nộp thuế điện tử Sổ Việt eTax...")}
          >
            <Send size={15} color="#0284c7" />
            <span>Nộp báo cáo qua Sổ Việt eTax</span>
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
            onClick={() => notify?.(`Đã xuất khẩu báo cáo ${formCode} ra Excel.`)}
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
            BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH GIỮA NIÊN ĐỘ
          </h1>
          <div style={{ fontSize: 13, fontStyle: "italic", color: "#475569", marginTop: 4 }}>
            ({formCode === "B02b-DN" ? "Dạng tóm lược – Mẫu B02b-DN" : "Dạng đầy đủ – Mẫu B02a-DN"})
          </div>
          <div style={{ fontSize: 13, color: "#1e293b", marginTop: 4, fontWeight: 500 }}>
            Kỳ kế toán {period.toLowerCase()} năm {year} (Từ {fromDate} đến {toDate})
          </div>
        </div>

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
                background: "#e2f0d9",
                borderBottom: "1px solid #cbd5e1",
                color: "#1e293b",
                fontWeight: 700,
              }}
            >
              <th
                rowSpan={2}
                style={{
                  padding: "8px 12px",
                  textAlign: "center",
                  borderRight: "1px solid #c2d9b8",
                  verticalAlign: "middle",
                }}
              >
                Chỉ tiêu
              </th>
              <th
                rowSpan={2}
                style={{
                  padding: "8px 8px",
                  textAlign: "center",
                  width: 65,
                  borderRight: "1px solid #c2d9b8",
                  verticalAlign: "middle",
                }}
              >
                Mã số
              </th>
              <th
                rowSpan={2}
                style={{
                  padding: "8px 8px",
                  textAlign: "center",
                  width: 95,
                  borderRight: "1px solid #c2d9b8",
                  verticalAlign: "middle",
                }}
              >
                Thuyết minh
              </th>
              <th
                colSpan={2}
                style={{
                  padding: "8px 14px",
                  textAlign: "center",
                  borderRight: "1px solid #c2d9b8",
                  borderBottom: "1px solid #c2d9b8",
                }}
              >
                {period}
              </th>
              <th
                colSpan={2}
                style={{
                  padding: "8px 14px",
                  textAlign: "center",
                  borderBottom: "1px solid #c2d9b8",
                }}
              >
                Lũy kế từ đầu năm đến cuối quý này
              </th>
            </tr>
            <tr
              style={{
                background: "#e2f0d9",
                borderBottom: "1px solid #cbd5e1",
                color: "#1e293b",
                fontWeight: 700,
              }}
            >
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm nay
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm trước
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                  borderRight: "1px solid #c2d9b8",
                }}
              >
                Năm nay
              </th>
              <th
                style={{
                  padding: "7px 14px",
                  textAlign: "center",
                  width: 140,
                }}
              >
                Năm trước
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredB02aRows.map((row, index) => {
              const qCur = formatValue(row.quarterCurrent, row.contentStatus);
              const qPrev = formatValue(row.quarterPrevious, row.contentStatus);
              const accCur = formatValue(row.accumCurrent, row.contentStatus);
              const accPrev = formatValue(row.accumPrevious, row.contentStatus);

              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: "1px solid #e2e8f0",
                    background: index % 2 === 1 ? "#fafbfc" : "#ffffff",
                  }}
                >
                  <td
                    style={{
                      padding: "7px 12px",
                      paddingLeft: row.indent ? 28 : 12,
                      borderRight: "1px solid #f1f5f9",
                      fontWeight: row.isBold ? 700 : 400,
                      color: "#1e293b",
                    }}
                  >
                    {row.name}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "center",
                      borderRight: "1px solid #f1f5f9",
                      color: "#475569",
                    }}
                  >
                    {row.code}
                  </td>
                  <td
                    style={{
                      padding: "7px 8px",
                      textAlign: "center",
                      borderRight: "1px solid #f1f5f9",
                      color: "#64748b",
                    }}
                  >
                    {row.note || ""}
                  </td>
                  {/* Quý này - Năm nay */}
                  <td
                    onClick={() => {
                      if (row.isClickable) {
                        void handleOpenInterimDrilldown(row, row.quarterCurrent, "QUARTER_CURRENT");
                      }
                    }}
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: qCur.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || qCur.isNegative ? 700 : 400,
                      cursor: row.isClickable ? "pointer" : "default",
                    }}
                  >
                    {qCur.text}
                  </td>
                  {/* Quý này - Năm trước */}
                  <td
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: qPrev.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || qPrev.isNegative ? 700 : 400,
                    }}
                  >
                    {qPrev.text}
                  </td>
                  {/* Lũy kế - Năm nay */}
                  <td
                    onClick={() => {
                      if (row.isClickable) {
                        void handleOpenInterimDrilldown(row, row.accumCurrent, "YTD_CURRENT");
                      }
                    }}
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      borderRight: "1px solid #f1f5f9",
                      color: accCur.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || accCur.isNegative ? 700 : 400,
                      cursor: row.isClickable ? "pointer" : "default",
                    }}
                  >
                    {accCur.text}
                  </td>
                  {/* Lũy kế - Năm trước */}
                  <td
                    style={{
                      padding: "7px 14px",
                      textAlign: "right",
                      color: accPrev.isNegative ? "#dc2626" : "#1e293b",
                      fontWeight: row.isBold || accPrev.isNegative ? 700 : 400,
                    }}
                  >
                    {accPrev.text}
                  </td>
                </tr>
              );
            })}
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
            Tổng số: <strong>{filteredB02aRows.length}</strong>
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
                    notify?.("Xem hướng dẫn lập B02a-DN / B02b-DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ.")
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
                  Mẫu biểu giữa niên độ (TT99)
                </label>
                <select
                  value={draftFormCode}
                  onChange={(e) => setDraftFormCode(e.target.value as "B02a-DN" | "B02b-DN")}
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
                  <option value="B02a-DN">B02a-DN (Dạng đầy đủ – 21 chỉ tiêu)</option>
                  <option value="B02b-DN">B02b-DN (Dạng tóm lược – 4 chỉ tiêu: 01, 31, 50, 60)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Kỳ báo cáo <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    value={draftPeriod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftPeriod(val);
                      if (val === "Quý 4") {
                        setDraftFromDate(`01/10/${draftYear}`);
                        setDraftToDate(`31/12/${draftYear}`);
                      } else if (val === "Quý 3") {
                        setDraftFromDate(`01/07/${draftYear}`);
                        setDraftToDate(`30/09/${draftYear}`);
                      } else if (val === "Quý 2") {
                        setDraftFromDate(`01/04/${draftYear}`);
                        setDraftToDate(`30/06/${draftYear}`);
                      } else if (val === "Quý 1") {
                        setDraftFromDate(`01/01/${draftYear}`);
                        setDraftToDate(`31/03/${draftYear}`);
                      } else if (val === "6 tháng đầu năm") {
                        setDraftFromDate(`01/01/${draftYear}`);
                        setDraftToDate(`30/06/${draftYear}`);
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
                    <option value="Quý 4">Quý 4</option>
                    <option value="Quý 3">Quý 3</option>
                    <option value="Quý 2">Quý 2</option>
                    <option value="Quý 1">Quý 1</option>
                    <option value="6 tháng đầu năm">6 tháng đầu năm</option>
                    <option value="9 tháng">9 tháng</option>
                    <option value="Tùy chọn">Tùy chọn</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#334155" }}>
                    Năm
                  </label>
                  <input
                    type="number"
                    value={draftYear}
                    onChange={(e) => setDraftYear(Number(e.target.value))}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                </div>
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

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
                  <input
                    type="checkbox"
                    checked={draftFetchFromSaved}
                    onChange={(e) => setDraftFetchFromSaved(e.target.checked)}
                    style={{ accentColor: "#00a862", width: 16, height: 16 }}
                  />
                  <span>Lấy dữ liệu từ báo cáo tài chính giữa niên độ đã lập</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#334155" }}>
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

      {/* 6. Modal: Drill-down Sổ chi tiết */}
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
              maxWidth: 780,
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
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  {drilldownItem.name}
                </h3>
              </div>
              <button
                type="button"
                style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setDrilldownItem(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12.5, color: "#64748b" }}>
                <span>
                  Kỳ: <strong>{period}/{year}</strong> (Từ {fromDate} đến {toDate})
                </span>
                <span>
                  Số phát sinh:{" "}
                  <strong style={{ color: "#00a862" }}>{formatValue(drilldownItem.val).text}</strong>
                </span>
              </div>

              {isLoadingDrilldown ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Đang tải bút toán nguồn...
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, border: "1px solid #e2e8f0" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left", color: "#334155" }}>
                      <th style={{ padding: "8px 10px" }}>Ngày CT</th>
                      <th style={{ padding: "8px 10px" }}>Số CT</th>
                      <th style={{ padding: "8px 10px" }}>Diễn giải</th>
                      <th style={{ padding: "8px 10px" }}>Tài khoản</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Số tiền (VND)</th>
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
                          <td style={{ padding: "8px 10px" }}>{jl.description}</td>
                          <td style={{ padding: "8px 10px" }}>{jl.account_code}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#00a862" }}>
                            {Number(jl.contribution_amount || 0).toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                          Không có chứng từ phát sinh trong kỳ.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
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

      {/* 7. Modal: Danh sách báo cáo đã lưu */}
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
              maxWidth: 640,
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Danh sách {formCode} đã lưu</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                onClick={() => setIsSavedReportsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {savedRuns.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, border: "1px solid #e2e8f0" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Phiên bản</th>
                    <th style={{ padding: "8px 12px" }}>Kỳ áp dụng</th>
                    <th style={{ padding: "8px 12px" }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {savedRuns.map((r: any) => (
                    <tr key={r.statement_run_id || r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600 }}>
                        {r.legal_form_code || formCode} (v{r.version_number || 1})
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {r.period_start_date} → {r.period_end_date}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {r.run_status} ({r.validation_status})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Hiện tại chưa có báo cáo {formCode} nào được lưu trong kỳ này.
              </p>
            )}
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
