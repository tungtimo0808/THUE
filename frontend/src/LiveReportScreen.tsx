import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import type { LiveReportTarget } from "./live-report-map";

type Column = { code: string; name: string; numeric: boolean };
type Row = { key: string; bold?: boolean; cells: Record<string, unknown> };

const TODAY = new Date().toISOString().slice(0, 10);
const YEAR_START = `${TODAY.slice(0, 4)}-01-01`;

function formatCell(value: unknown, numeric: boolean, percent = false) {
  if (value === null || value === undefined || value === "") return "";
  if (!numeric) return String(value);
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return percent ? `${amount.toLocaleString("vi-VN")}%` : amount.toLocaleString("vi-VN");
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
    company_id: companyId, from_date: fromDate, to_date: toDate, date_from: fromDate, date_to: toDate,
    as_of_date: toDate, fiscal_year: Number(toDate.slice(0, 4)), year: Number(toDate.slice(0, 4)),
  });
  const rows: any = await apiClient.get(`${base}/runs/${run.run_id ?? run.id}/rows/${query}`);
  const columns: Column[] = (schema.columns || []).map((column: any) => ({
    code: column.code, name: column.name, numeric: column.data_type === "NUMBER",
  }));
  const data: Row[] = (rows.rows || []).map((row: any, index: number) => ({
    key: String(row.id ?? row.row_id ?? index), bold: row.row_type !== "DETAIL", cells: row.columns || {},
  }));
  const missing = (run.validations || []).find((item: any) => String(item.check_code).endsWith("_SOURCE_MISSING"));
  return { columns, rows: data, note: missing?.message || "" };
}

async function loadAnalysis(target: { kind: string; dimension: string; mode: string }, fromDate: string, toDate: string) {
  const params = new URLSearchParams({ company_id: getSelectedCompanyId(), ...target, from_date: fromDate, to_date: toDate });
  const report: any = await apiClient.get(`/api/v1/reports/analysis/?${params}`);
  const columns: Column[] = [
    { code: "code", name: "Mã", numeric: false }, { code: "name", name: "Chỉ tiêu", numeric: false },
    ...report.columns.map((column: any) => ({ code: column.key, name: column.label, numeric: true })),
  ];
  const data: Row[] = report.rows.map((row: any, index: number) => ({
    key: String(index), bold: row.bold, cells: { code: row.code, name: row.name, ...row.values },
  }));
  return { columns, rows: data, note: report.note as string };
}

export default function LiveReportScreen({ title, target, onBack }: { title: string; target: LiveReportTarget; onBack: () => void }) {
  const [fromDate, setFromDate] = useState(YEAR_START);
  const [toDate, setToDate] = useState(TODAY);
  const [useBank, setUseBank] = useState(false);
  const [report, setReport] = useState<{ columns: Column[]; rows: Row[]; note: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bankCode = "bankCode" in target ? target.bankCode : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport("kind" in target
        ? await loadAnalysis(target, fromDate, toDate)
        : await loadCatalogueReport(target.area, useBank && bankCode ? bankCode : target.code, fromDate, toDate));
    } catch (cause) {
      setReport(null);
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [target, fromDate, toDate, useBank, bankCode]);

  useEffect(() => { void load(); }, [load]);

  const columns = useMemo(() => report?.columns ?? [], [report]);

  const exportExcel = async () => {
    if (!report) return;
    try {
      const XLSX = await import("xlsx");
      const rows = report.rows.map(row => columns.map(column => {
        const value = row.cells[column.code];
        return column.numeric && value !== null && value !== undefined && value !== "" ? Number(value) : value ?? "";
      }));
      const sheet = XLSX.utils.aoa_to_sheet([[title], [`Từ ${fromDate} đến ${toDate}`], [], columns.map(column => column.name), ...rows]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Báo cáo");
      XLSX.writeFile(book, `${title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.xlsx`);
    } catch {
      setError("Không xuất được tệp Excel.");
    }
  };
  return (
    <div style={{ padding: 16, background: "#fff", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={onBack}><ArrowLeft size={16} /> Quay lại</button>
        <strong style={{ fontSize: 16 }}>{title}</strong>
        <label>Từ ngày <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label>
        <label>Đến ngày <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label>
        {bankCode && (
          <select value={useBank ? "BANK" : "CASH"} onChange={event => setUseBank(event.target.value === "BANK")}>
            <option value="CASH">Tiền mặt</option>
            <option value="BANK">Tiền gửi</option>
          </select>
        )}
        <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16} /> Lấy dữ liệu</button>
        <button type="button" onClick={() => void exportExcel()} disabled={!report || report.rows.length === 0}><Download size={16} /> Xuất Excel</button>
        <button type="button" onClick={() => window.print()} disabled={!report}><Printer size={16} /> In</button>
      </div>
      {report?.note && <p style={{ color: "#8a5a00" }}>{report.note}</p>}
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      {loading && <p>Đang tải dữ liệu...</p>}
      {report && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
            <thead>
              <tr>{columns.map(column => (
                <th key={column.code} style={{ border: "1px solid #d0d5dd", padding: 6, background: "#f2f4f7", whiteSpace: "nowrap" }}>{column.name}</th>
              ))}</tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && (
                <tr><td colSpan={columns.length || 1} style={{ padding: 16, textAlign: "center" }}>Không có dữ liệu trong kỳ đã chọn.</td></tr>
              )}
              {report.rows.map(row => (
                <tr key={row.key} style={{ fontWeight: row.bold ? 600 : 400 }}>
                  {columns.map(column => (
                    <td key={column.code} style={{ border: "1px solid #eaecf0", padding: 6, textAlign: column.numeric ? "right" : "left" }}>
                      {formatCell(row.cells[column.code], column.numeric, column.code.endsWith("__pct"))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
