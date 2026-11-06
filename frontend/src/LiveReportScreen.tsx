import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Download, FileSpreadsheet, FileText, Filter, HelpCircle, Printer, RefreshCw, X } from "lucide-react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import { clearLiveApiGetCache, request } from "./live-api";
import { useApiSession } from "./ApiSession";
import {
  MISA_REPORT_PERIOD_OPTIONS,
  MisaBranchTagSelector,
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
import type { LiveReportTarget } from "./live-report-map";

type Column = { code: string; name: string; numeric: boolean };
type Row = { key: string; bold?: boolean; cells: Record<string, unknown> };

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR_START = `${TODAY.slice(0, 4)}-01-01`;
const YEAR_END = `${TODAY.slice(0, 4)}-12-31`;

function formatCell(value: unknown, numeric: boolean, percent = false) {
  if (value === null || value === undefined || value === "") return "";
  if (!numeric) return String(value);
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  if (amount === 0) return "";
  return percent ? `${amount.toLocaleString("vi-VN")}%` : amount.toLocaleString("vi-VN");
}

function formatVNDate(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return iso;
}

function resolveColumnGrouping(col: Column): { group: string | null; sublabel: string } {
  const code = col.code.toLowerCase();
  const rawName = col.name.trim();

  if (rawName.includes(" - ")) {
    const [left, ...rest] = rawName.split(" - ");
    const right = rest.join(" - ").trim();
    const g = left.trim()
      .replace(/^Số dư đầu kỳ$/i, "Đầu kỳ")
      .replace(/^Số phát sinh trong kỳ$/i, "Phát sinh")
      .replace(/^Số dư cuối kỳ$/i, "Cuối kỳ");
    const s = right
      .replace(/^Dư Nợ\s*(\(.*\))?$/i, "Nợ")
      .replace(/^Dư Có\s*(\(.*\))?$/i, "Có")
      .replace(/^Phát sinh Nợ\s*(\(.*\))?$/i, "Nợ")
      .replace(/^Phát sinh Có\s*(\(.*\))?$/i, "Có");
    return { group: g, sublabel: s || right };
  }

  if (code === "opening_debit" || code === "open_debit") return { group: "Đầu kỳ", sublabel: "Nợ" };
  if (code === "opening_credit" || code === "open_credit") return { group: "Đầu kỳ", sublabel: "Có" };
  if (code === "opening_qty" || code === "open_qty") return { group: "Đầu kỳ", sublabel: "Số lượng" };
  if (code === "opening_amount" || code === "open_amount") return { group: "Đầu kỳ", sublabel: "Giá trị" };

  if (code === "period_debit") return { group: "Phát sinh", sublabel: "Nợ" };
  if (code === "period_credit") return { group: "Phát sinh", sublabel: "Có" };
  if (code === "accum_debit" || code === "cumulative_debit" || code === "ytd_debit")
    return { group: "Phát sinh", sublabel: "Nợ lũy kế" };
  if (code === "accum_credit" || code === "cumulative_credit" || code === "ytd_credit")
    return { group: "Phát sinh", sublabel: "Có lũy kế" };

  if (code === "closing_debit" || code === "close_debit") return { group: "Cuối kỳ", sublabel: "Nợ" };
  if (code === "closing_credit" || code === "close_credit") return { group: "Cuối kỳ", sublabel: "Có" };
  if (code === "closing_qty" || code === "close_qty") return { group: "Cuối kỳ", sublabel: "Số lượng" };
  if (code === "closing_amount" || code === "close_amount") return { group: "Cuối kỳ", sublabel: "Giá trị" };

  if (code === "in_qty" || code === "import_qty" || code === "receipt_qty")
    return { group: "Nhập trong kỳ", sublabel: "Số lượng" };
  if (code === "in_amount" || code === "import_amount" || code === "receipt_amount")
    return { group: "Nhập trong kỳ", sublabel: "Giá trị" };

  if (code === "out_qty" || code === "export_qty" || code === "issue_qty")
    return { group: "Xuất trong kỳ", sublabel: "Số lượng" };
  if (code === "out_amount" || code === "export_amount" || code === "issue_amount")
    return { group: "Xuất trong kỳ", sublabel: "Giá trị" };

  if (code === "document_no" || code === "voucher_no") return { group: "Chứng từ", sublabel: "Số hiệu" };
  if (code === "document_date" || code === "voucher_date") return { group: "Chứng từ", sublabel: "Ngày tháng" };

  return { group: null, sublabel: rawName };
}

function errorText(cause: any) {
  if (cause?.status === 403) return "Bạn không có quyền xem báo cáo này.";
  return cause?.message || "Không tải được báo cáo.";
}

async function loadCatalogueReport(area: string, code: string, fromDate: string, toDate: string) {
  const companyId = getSelectedCompanyId();
  const query = `?company_id=${encodeURIComponent(companyId)}`;
  const base = `/api/v1/reports/${area}`;
  const schema: any = await apiClient.get(`${base}/${code}/schema/${query}`);
  const run: any = await apiClient.post(`${base}/${code}/query/${query}`, {
    company_id: companyId,
    from_date: fromDate,
    to_date: toDate,
    date_from: fromDate,
    date_to: toDate,
    as_of_date: toDate,
    fiscal_year: Number(toDate.slice(0, 4)),
    year: Number(toDate.slice(0, 4)),
  });
  const rows: any = await apiClient.get(`${base}/runs/${run.run_id ?? run.id}/rows/${query}`);
  const columns: Column[] = (schema.columns || []).map((column: any) => ({
    code: column.code,
    name: column.name,
    numeric: column.data_type === "NUMBER",
  }));
  const data: Row[] = (rows.rows || []).map((row: any, index: number) => ({
    key: String(row.id ?? row.row_id ?? index),
    bold: row.row_type !== "DETAIL",
    cells: row.columns || {},
  }));
  const missing = (run.validations || []).find((item: any) => String(item.check_code).endsWith("_SOURCE_MISSING"));
  return { columns, rows: data, note: missing?.message || "", reportCode: code };
}

async function loadAnalysis(
  target: { kind: string; dimension: string; mode: string },
  fromDate: string,
  toDate: string,
  branchId?: string,
  accountLevel?: string,
) {
  const params = new URLSearchParams({
    company_id: getSelectedCompanyId(),
    ...target,
    from_date: fromDate,
    to_date: toDate,
  });
  if (branchId && branchId !== "ALL") {
    params.set("branch_id", branchId);
  }
  if (accountLevel && accountLevel !== "all") {
    params.set("account_level", accountLevel);
  }
  const report: any = await apiClient.get(`/api/v1/reports/analysis/?${params}`);
  const columns: Column[] = [
    { code: "code", name: "Mã", numeric: false },
    { code: "name", name: "Chỉ tiêu", numeric: false },
    ...report.columns.map((column: any) => ({ code: column.key, name: column.label, numeric: true })),
  ];
  const data: Row[] = report.rows.map((row: any, index: number) => ({
    key: String(index),
    bold: row.bold,
    cells: { code: row.code, name: row.name, ...row.values },
  }));
  return {
    columns,
    rows: data,
    note: report.note as string,
    reportCode: `RPT-ANALYSIS-${target.kind}`,
    branches: Array.isArray(report.branches) ? report.branches : [],
  };
}

const ctrlStyle: React.CSSProperties = {
  height: 34,
  minHeight: 34,
  maxHeight: 34,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
};

const btnBaseStyle: React.CSSProperties = {
  height: 34,
  minHeight: 34,
  maxHeight: 34,
  padding: "0 12px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#1e293b",
  fontSize: 13,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
};

export default function LiveReportScreen({
  title,
  target,
  onBack,
}: {
  title: string;
  target: LiveReportTarget;
  onBack: () => void;
}) {
  const session = useApiSession();
  const [period, setPeriod] = useState("Năm nay");
  const [fromDate, setFromDate] = useState(YEAR_START);
  const [toDate, setToDate] = useState(YEAR_END);
  const [fromDateDmy, setFromDateDmy] = useState(() => formatVNDate(YEAR_START));
  const [toDateDmy, setToDateDmy] = useState(() => formatVNDate(YEAR_END));
  const [branchId, setBranchId] = useState("");
  const [branchLabel, setBranchLabel] = useState("Trụ sở chính (Toàn doanh nghiệp)");
  const [branches, setBranches] = useState<Array<{ id: string; code?: string; name: string }>>([]);
  const [accountLevel, setAccountLevel] = useState("all");
  const [showTwoSideBalance, setShowTwoSideBalance] = useState(true);
  const [accumulateFrom, setAccumulateFrom] = useState<"data_start" | "fiscal_start">("fiscal_start");
  const [useBank, setUseBank] = useState(false);

  // Slide-over Drawer "Chọn tham số" state
  const [isParamDrawerOpen, setIsParamDrawerOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState("Năm nay");
  const [draftFromDateDmy, setDraftFromDateDmy] = useState(() => formatVNDate(YEAR_START));
  const [draftToDateDmy, setDraftToDateDmy] = useState(() => formatVNDate(YEAR_END));
  const [draftBranchId, setDraftBranchId] = useState("");
  const [draftBranchLabel, setDraftBranchLabel] = useState("Trụ sở chính (Toàn doanh nghiệp)");
  const [draftAccountLevel, setDraftAccountLevel] = useState("all");
  const [draftShowTwoSideBalance, setDraftShowTwoSideBalance] = useState(true);
  const [draftAccumulateFrom, setDraftAccumulateFrom] = useState<"data_start" | "fiscal_start">("fiscal_start");

  const [report, setReport] = useState<{
    columns: Column[];
    rows: Row[];
    note: string;
    reportCode?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const bankCode = "bankCode" in target ? target.bankCode : undefined;

  const executeLoad = useCallback(
    async (
      isoFrom: string,
      isoTo: string,
      activeBranchId: string,
      activeLevel: string,
      forceRefresh = false,
    ) => {
      if (forceRefresh) {
        clearLiveApiGetCache();
      }
      setLoading(true);
      setError("");
      try {
        if ("kind" in target) {
          const res = await loadAnalysis(target, isoFrom, isoTo, activeBranchId, activeLevel);
          setReport(res);
          if (res.branches && res.branches.length > 0) {
            setBranches(res.branches);
          }
        } else {
          const res = await loadCatalogueReport(
            target.area,
            useBank && bankCode ? bankCode : target.code,
            isoFrom,
            isoTo,
          );
          setReport(res);
        }
      } catch (cause) {
        setReport(null);
        setError(errorText(cause));
      } finally {
        setLoading(false);
      }
    },
    [target, useBank, bankCode],
  );

  useEffect(() => {
    void executeLoad(YEAR_START, YEAR_END, "", "all", false);
  }, [executeLoad]);

  const handleFetchData = useCallback(() => {
    const isoFrom = dmyToIsoDate(fromDateDmy) || fromDate;
    const isoTo = dmyToIsoDate(toDateDmy) || toDate;
    setFromDate(isoFrom);
    setToDate(isoTo);
    setFromDateDmy(formatVNDate(isoFrom));
    setToDateDmy(formatVNDate(isoTo));
    void executeLoad(isoFrom, isoTo, branchId, accountLevel, true);
  }, [fromDateDmy, toDateDmy, fromDate, toDate, branchId, accountLevel, executeLoad]);

  const handleToolbarPeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    if (newPeriod !== "Tùy chọn") {
      const computed = computeMisaPeriodDates(newPeriod, Number(YEAR_START.slice(0, 4)));
      const isoFrom = dmyToIsoDate(computed.fromDate) || YEAR_START;
      const isoTo = dmyToIsoDate(computed.toDate) || YEAR_END;
      setFromDateDmy(computed.fromDate);
      setToDateDmy(computed.toDate);
      setFromDate(isoFrom);
      setToDate(isoTo);
      void executeLoad(isoFrom, isoTo, branchId, accountLevel, true);
    }
  };

  const handleOpenDrawer = () => {
    setDraftPeriod(period);
    setDraftFromDateDmy(fromDateDmy);
    setDraftToDateDmy(toDateDmy);
    setDraftBranchId(branchId);
    setDraftBranchLabel(branchLabel);
    setDraftAccountLevel(accountLevel);
    setDraftShowTwoSideBalance(showTwoSideBalance);
    setDraftAccumulateFrom(accumulateFrom);
    setIsParamDrawerOpen(true);
  };

  const handleApplyDrawer = () => {
    const isoFrom = dmyToIsoDate(draftFromDateDmy) || fromDate;
    const isoTo = dmyToIsoDate(draftToDateDmy) || toDate;
    setPeriod(draftPeriod);
    setFromDate(isoFrom);
    setToDate(isoTo);
    setFromDateDmy(formatVNDate(isoFrom));
    setToDateDmy(formatVNDate(isoTo));
    setBranchId(draftBranchId);
    setBranchLabel(draftBranchLabel);
    setAccountLevel(draftAccountLevel);
    setShowTwoSideBalance(draftShowTwoSideBalance);
    setAccumulateFrom(draftAccumulateFrom);
    setIsParamDrawerOpen(false);
    void executeLoad(isoFrom, isoTo, draftBranchId, draftAccountLevel, true);
  };

  const handleResetDrawer = () => {
    setDraftPeriod("Năm nay");
    setDraftFromDateDmy(formatVNDate(YEAR_START));
    setDraftToDateDmy(formatVNDate(YEAR_END));
    setDraftBranchId("");
    setDraftBranchLabel("Trụ sở chính (Toàn doanh nghiệp)");
    setDraftAccountLevel("all");
    setDraftShowTwoSideBalance(true);
    setDraftAccumulateFrom("fiscal_start");
  };

  const isTrialBalance = "kind" in target && target.kind === "TRIAL_BALANCE";
  const isAnalysis = "kind" in target;
  // "Hiển thị số dư hai bên": tách mỗi cột số dư thành Nợ / Có (dương -> Nợ, âm -> Có)
  const viewReport = useMemo(() => {
    if (!report) return null;
    if (!isTrialBalance || !showTwoSideBalance) return report;
    const cols: Column[] = [];
    for (const c of report.columns) {
      if (!c.numeric) { cols.push(c); continue; }
      cols.push({ code: `${c.code}__debit`, name: `${c.name} - Nợ`, numeric: true });
      cols.push({ code: `${c.code}__credit`, name: `${c.name} - Có`, numeric: true });
    }
    const rows = report.rows.map((r) => {
      const cells: Record<string, unknown> = { ...r.cells };
      for (const c of report.columns) {
        if (!c.numeric) continue;
        const v = Number(r.cells[c.code] ?? 0) || 0;
        cells[`${c.code}__debit`] = v > 0 ? v : 0;
        cells[`${c.code}__credit`] = v < 0 ? -v : 0;
      }
      return { ...r, cells };
    });
    return { ...report, columns: cols, rows };
  }, [report, isTrialBalance, showTwoSideBalance]);
  const columns = useMemo(() => viewReport?.columns ?? [], [viewReport]);

  const grandTotals = useMemo(() => {
    if (!viewReport || viewReport.rows.length === 0) return null;
    const detailRows = viewReport.rows.filter((r) => !r.bold);
    const source = detailRows.length > 0 ? detailRows : viewReport.rows;
    const totals: Record<string, number> = {};
    let hasNumeric = false;
    for (const col of columns) {
      if (!col.numeric || col.code === "row_index" || col.code === "stt" || col.code.includes("price") || col.code.endsWith("__pct")) {
        continue;
      }
      let sum = 0;
      for (const r of source) {
        const v = Number(r.cells[col.code]);
        if (!Number.isNaN(v)) sum += v;
      }
      totals[col.code] = sum;
      hasNumeric = true;
    }
    return hasNumeric ? totals : null;
  }, [viewReport, columns]);

  const fallbackClientExcel = async () => {
    if (!report) return;
    const XLSX = await import("xlsx");
    const rows =
      viewReport.rows.length > 0
        ? viewReport.rows.map((row) =>
            columns.map((column) => {
              const value = row.cells[column.code];
              return column.numeric && value !== null && value !== undefined && value !== ""
                ? Number(value)
                : value ?? "";
            }),
          )
        : [["Không có dữ liệu phát sinh trong kỳ đã chọn."]];
    const sheet = XLSX.utils.aoa_to_sheet([
      [session.company?.name || "Công ty TNHH Tùng Timo"],
      [(session.company as any)?.address || "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội - Việt Nam"],
      [title.toUpperCase()],
      [`Từ ngày ${formatVNDate(fromDate)} đến ngày ${formatVNDate(toDate)}`],
      [],
      columns.map((column) => column.name),
      ...rows,
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Báo cáo");
    XLSX.writeFile(book, `${title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.xlsx`);
  };

  const handleExport = async (format: "XLSX" | "PDF" | "CSV" | "PRINT") => {
    if (!report) return;
    setExporting(format);
    setError("");
    const exportPayload = {
      company_id: getSelectedCompanyId() || session.company?.id || "",
      report_code: report.reportCode || ("code" in target ? target.code : "RPT-STANDARD"),
      title,
      period_str: `Từ ngày ${formatVNDate(fromDate)} đến ngày ${formatVNDate(toDate)}`,
      output_format: format,
      export_scope: "ALL_MATCHING_FILTERS",
      columns: columns.map((c) => {
        const grp = resolveColumnGrouping(c);
        return {
          key: c.code,
          label: c.name,
          group: grp.group,
          sublabel: grp.sublabel,
          type: c.numeric ? "number" : "text",
          data_type: c.numeric ? "number" : "text",
          grand_total: grandTotals ? grandTotals[c.code] : undefined,
        };
      }),
      rows: viewReport.rows.map((r) => ({
        ...r.cells,
        is_subtotal: Boolean(r.bold),
        is_bold: Boolean(r.bold),
      })),
      grand_total: grandTotals || undefined,
      parameters: {
        from_date: fromDate,
        to_date: toDate,
        period_label: `Từ ngày ${formatVNDate(fromDate)} đến ngày ${formatVNDate(toDate)}`,
      },
      options: {
        orientation: columns.length > 6 ? "LANDSCAPE" : "PORTRAIT",
        paper_size: "A4",
        company_name: session.company?.name || "Công ty TNHH XYZ",
        company_address:
          (session.company as any)?.address ||
          "Tầng 9 Technosoft, Duy Tân, Cầu Giấy, Hà Nội - Việt Nam",
      },
    };
    try {
      const companyId = exportPayload.company_id;
      const token = session.token || localStorage.getItem("erp_token") || "";
      if (companyId && token) {
        const writer = createApiWriter(companyId, (path, init) =>
          request(path, token || undefined, init),
        );
        await executeReportExportUcRpt15(writer, exportPayload, token);
        return;
      }
      openMisaReportPreviewModal({
        htmlText: buildClientFallbackMisaHtml(exportPayload),
        title,
        reportCode: exportPayload.report_code,
        requestedFormat: format,
        onDownloadExcel: fallbackClientExcel,
      });
    } catch {
      try {
        openMisaReportPreviewModal({
          htmlText: buildClientFallbackMisaHtml(exportPayload),
          title,
          reportCode: exportPayload.report_code,
          requestedFormat: format,
          onDownloadExcel: fallbackClientExcel,
        });
      } catch {
        setError("Không xuất được tệp báo cáo.");
      }
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ padding: "16px 20px", background: "#f8fafc", minHeight: "100%", boxSizing: "border-box" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
          padding: "12px 16px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={onBack} style={btnBaseStyle}>
            <ArrowLeft size={15} /> Quay lại
          </button>
          <strong style={{ fontSize: 15.5, color: "#0f172a" }}>{title}</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <select
            value={period}
            onChange={(event) => handleToolbarPeriodChange(event.target.value)}
            style={{ ...ctrlStyle, minWidth: 128, padding: "0 8px" }}
            title="Chọn nhanh kỳ báo cáo"
          >
            {MISA_REPORT_PERIOD_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569", fontWeight: 500 }}>
            Từ ngày
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={fromDateDmy}
                onChange={(event) => {
                  const val = event.target.value;
                  setFromDateDmy(val);
                  setPeriod("Tùy chọn");
                  const iso = dmyToIsoDate(val);
                  if (iso) setFromDate(iso);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleFetchData();
                }}
                style={{ ...ctrlStyle, width: 118, padding: "0 26px 0 8px" }}
              />
              <label
                style={{
                  position: "absolute",
                  right: 7,
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  color: "#64748b",
                }}
                title="Chọn ngày từ lịch (Ngày/Tháng/Năm)"
              >
                <Calendar size={14} />
                <input
                  type="date"
                  value={dmyToIsoDate(fromDateDmy) || fromDate}
                  onChange={(event) => {
                    const iso = event.target.value;
                    if (iso) {
                      const dmy = isoToDmyDate(iso);
                      setFromDate(iso);
                      setFromDateDmy(dmy);
                      setPeriod("Tùy chọn");
                      void executeLoad(iso, dmyToIsoDate(toDateDmy) || toDate, branchId, accountLevel, true);
                    }
                  }}
                  style={{ position: "absolute", opacity: 0, width: 26, height: 26, left: -6, top: -6, cursor: "pointer", padding: 0, border: "none" }}
                />
              </label>
            </div>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#475569", fontWeight: 500 }}>
            Đến ngày
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={toDateDmy}
                onChange={(event) => {
                  const val = event.target.value;
                  setToDateDmy(val);
                  setPeriod("Tùy chọn");
                  const iso = dmyToIsoDate(val);
                  if (iso) setToDate(iso);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleFetchData();
                }}
                style={{ ...ctrlStyle, width: 118, padding: "0 26px 0 8px" }}
              />
              <label
                style={{
                  position: "absolute",
                  right: 7,
                  top: "50%",
                  transform: "translateY(-50%)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  color: "#64748b",
                }}
                title="Chọn ngày đến lịch (Ngày/Tháng/Năm)"
              >
                <Calendar size={14} />
                <input
                  type="date"
                  value={dmyToIsoDate(toDateDmy) || toDate}
                  onChange={(event) => {
                    const iso = event.target.value;
                    if (iso) {
                      const dmy = isoToDmyDate(iso);
                      setToDate(iso);
                      setToDateDmy(dmy);
                      setPeriod("Tùy chọn");
                      void executeLoad(dmyToIsoDate(fromDateDmy) || fromDate, iso, branchId, accountLevel, true);
                    }
                  }}
                  style={{ position: "absolute", opacity: 0, width: 26, height: 26, left: -6, top: -6, cursor: "pointer", padding: 0, border: "none" }}
                />
              </label>
            </div>
          </label>
          {bankCode && (
            <select
              value={useBank ? "BANK" : "CASH"}
              onChange={(event) => setUseBank(event.target.value === "BANK")}
              style={ctrlStyle}
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK">Tiền gửi</option>
            </select>
          )}
          <button
            type="button"
            onClick={handleFetchData}
            disabled={loading}
            style={{
              ...btnBaseStyle,
              padding: "0 10px",
              background: "#00b06b",
              borderColor: "#00b06b",
              color: "#ffffff",
            }}
          >
            <RefreshCw size={14} /> Lấy dữ liệu
          </button>
          <button
            type="button"
            onClick={handleOpenDrawer}
            style={{
              ...btnBaseStyle,
              padding: "0 10px",
              background: "#ffffff",
              borderColor: "#00a862",
              color: "#00a862",
            }}
            title="Mở bảng Chọn tham số báo cáo"
          >
            <Filter size={14} /> Chọn tham số
          </button>
          <button
            type="button"
            onClick={() => void handleExport("XLSX")}
            disabled={!report || exporting !== null}
            style={{
              ...btnBaseStyle,
              padding: "0 10px",
              background: "#f0fdf4",
              borderColor: "#86efac",
              color: "#166534",
            }}
            title="Kết xuất tệp Excel (.xlsx) chuẩn kế toán"
          >
            <FileSpreadsheet size={15} /> {exporting === "XLSX" ? "Đang xuất..." : "Xuất Excel"}
          </button>
          <button
            type="button"
            onClick={() => void handleExport("PDF")}
            disabled={!report || exporting !== null}
            style={{
              ...btnBaseStyle,
              padding: "0 10px",
              background: "#eff6ff",
              borderColor: "#bfdbfe",
              color: "#1d4ed8",
            }}
            title="Kết xuất tệp PDF (.pdf) có chữ ký"
          >
            <FileText size={15} /> {exporting === "PDF" ? "Đang xuất..." : "Xuất PDF"}
          </button>
          <button
            type="button"
            onClick={() => void handleExport("CSV")}
            disabled={!report || exporting !== null}
            style={{ ...btnBaseStyle, padding: "0 9px" }}
            title="Kết xuất tệp CSV (.csv)"
          >
            <Download size={14} /> {exporting === "CSV" ? "Đang xuất..." : "CSV"}
          </button>
          <button
            type="button"
            onClick={() => void handleExport("PRINT")}
            disabled={!report || exporting !== null}
            style={{ ...btnBaseStyle, padding: "0 9px" }}
            title="In báo cáo"
          >
            <Printer size={15} /> In
          </button>
        </div>
      </div>

      {report?.note && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            fontSize: 12.5,
          }}
        >
          {report.note}
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b42318",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {loading && (
        <div style={{ padding: 28, textAlign: "center", color: "#64748b", background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          Đang tải dữ liệu báo cáo...
        </div>
      )}
      {report && !loading && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              padding: "12px 16px 10px",
              borderBottom: "1px solid #e2e8f0",
              background: "#fafbfc",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, color: "#334155" }}>
              Kỳ báo cáo: <strong>Từ ngày {formatVNDate(fromDate)} đến ngày {formatVNDate(toDate)}</strong>
              {isAnalysis && branchLabel ? (
                <span style={{ marginLeft: 12, color: "#64748b" }}>
                  • Chi nhánh: <strong>{branchLabel}</strong>
                </span>
              ) : null}
              {"kind" in target && target.kind === "TRIAL_BALANCE" ? (
                <span style={{ marginLeft: 12, color: "#64748b" }}>
                  • Bậc tài khoản: <strong>{accountLevel === "all" ? "Tất cả" : `Bậc ${accountLevel}`}</strong>
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 12.5, color: "#64748b" }}>
              Tổng số dòng: <strong>{viewReport.rows.length}</strong>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 250px)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.code}
                      style={{
                        borderBottom: "1px solid #cbd5e1",
                        borderRight: "1px solid #e2e8f0",
                        padding: "9px 10px",
                        background: "#f1f5f9",
                        color: "#1e293b",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        textAlign: column.numeric
                          ? "right"
                          : ["unit", "dvt", "don_vi", "uom"].some((k) =>
                              column.code.toLowerCase().includes(k),
                            )
                            ? "center"
                            : "left",
                        height: 38,
                      }}
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewReport.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length || 1}
                      style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}
                    >
                      Không có dữ liệu phát sinh trong kỳ đã chọn ({formatVNDate(fromDate)} → {formatVNDate(toDate)}).
                    </td>
                  </tr>
                )}
                {viewReport.rows.map((row) => (
                  <tr
                    key={row.key}
                    style={{
                      fontWeight: row.bold ? 700 : 400,
                      background: row.bold ? "#f8fafc" : "#ffffff",
                      height: 36,
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.code}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          borderRight: "1px solid #f1f5f9",
                          padding: "7px 10px",
                          textAlign: column.numeric
                          ? "right"
                          : ["unit", "dvt", "don_vi", "uom"].some((k) =>
                              column.code.toLowerCase().includes(k),
                            )
                            ? "center"
                            : "left",
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatCell(row.cells[column.code], column.numeric, column.code.endsWith("__pct"))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over Drawer "Chọn tham số" */}
      {isParamDrawerOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsParamDrawerOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 485,
              background: "#ffffff",
              height: "100%",
              boxShadow: "-8px 0 30px rgba(15, 23, 42, 0.16)",
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
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Chọn tham số</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
                  title="Đóng"
                  onClick={() => setIsParamDrawerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "18px 20px",
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                fontSize: 13,
              }}
            >
              {isAnalysis && (
              <MisaBranchTagSelector
                branchId={draftBranchId}
                branchLabel={draftBranchLabel}
                branches={branches}
                onChange={(id, label) => {
                  setDraftBranchId(id);
                  setDraftBranchLabel(label);
                }}
              />
              )}

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
                      const computed = computeMisaPeriodDates(val, Number(YEAR_START.slice(0, 4)));
                      setDraftFromDateDmy(computed.fromDate);
                      setDraftToDateDmy(computed.toDate);
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
                  {MISA_REPORT_PERIOD_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>Từ ngày</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={draftFromDateDmy}
                      onChange={(e) => {
                        setDraftFromDateDmy(e.target.value);
                        setDraftPeriod("Tùy chọn");
                      }}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <label
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                        color: "#64748b",
                        display: "inline-flex",
                      }}
                    >
                      <Calendar size={14} />
                      <input
                        type="date"
                        value={dmyToIsoDate(draftFromDateDmy) || fromDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setDraftFromDateDmy(isoToDmyDate(e.target.value));
                            setDraftPeriod("Tùy chọn");
                          }
                        }}
                        style={{ position: "absolute", opacity: 0, width: 26, height: 26, left: -6, top: -6, cursor: "pointer", padding: 0, border: "none" }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>Đến ngày</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="DD/MM/YYYY"
                      value={draftToDateDmy}
                      onChange={(e) => {
                        setDraftToDateDmy(e.target.value);
                        setDraftPeriod("Tùy chọn");
                      }}
                      style={{
                        width: "100%",
                        height: 34,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <label
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        cursor: "pointer",
                        color: "#64748b",
                        display: "inline-flex",
                      }}
                    >
                      <Calendar size={14} />
                      <input
                        type="date"
                        value={dmyToIsoDate(draftToDateDmy) || toDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setDraftToDateDmy(isoToDmyDate(e.target.value));
                            setDraftPeriod("Tùy chọn");
                          }
                        }}
                        style={{ position: "absolute", opacity: 0, width: 26, height: 26, left: -6, top: -6, cursor: "pointer", padding: 0, border: "none" }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {isTrialBalance && (<>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, color: "#1e293b" }}>Bậc tài khoản</label>
                <select
                  value={draftAccountLevel}
                  onChange={(e) => setDraftAccountLevel(e.target.value)}
                  style={{
                    width: 110,
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
                  <option value="all">Tất cả</option>
                </select>
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  color: "#1e293b",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={draftShowTwoSideBalance}
                  onChange={(e) => setDraftShowTwoSideBalance(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#00a862", cursor: "pointer" }}
                />
                <span>Hiển thị số dư hai bên</span>
              </label>
              </>)}

            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={handleResetDrawer}
                style={{
                  height: 34,
                  padding: "0 14px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  color: "#1e293b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Xóa điều kiện
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsParamDrawerOpen(false)}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    color: "#1e293b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleApplyDrawer}
                  style={{
                    height: 34,
                    padding: "0 18px",
                    border: "none",
                    borderRadius: 4,
                    background: "#00a862",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
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
