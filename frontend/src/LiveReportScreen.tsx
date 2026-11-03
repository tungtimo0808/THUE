import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Printer, RefreshCw } from "lucide-react";
import { apiClient, getSelectedCompanyId } from "./apiClient";
import { useApiSession } from "./ApiSession";
import { createApiWriter, executeReportExportUcRpt15 } from "./misa-api-writes";
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
) {
  const params = new URLSearchParams({
    company_id: getSelectedCompanyId(),
    ...target,
    from_date: fromDate,
    to_date: toDate,
  });
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
  return { columns, rows: data, note: report.note as string, reportCode: `RPT-ANALYSIS-${target.kind}` };
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
  const [fromDate, setFromDate] = useState(YEAR_START);
  const [toDate, setToDate] = useState(TODAY);
  const [useBank, setUseBank] = useState(false);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(
        "kind" in target
          ? await loadAnalysis(target, fromDate, toDate)
          : await loadCatalogueReport(target.area, useBank && bankCode ? bankCode : target.code, fromDate, toDate),
      );
    } catch (cause) {
      setReport(null);
      setError(errorText(cause));
    } finally {
      setLoading(false);
    }
  }, [target, fromDate, toDate, useBank, bankCode]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo(() => report?.columns ?? [], [report]);

  const fallbackClientExcel = async () => {
    if (!report) return;
    const XLSX = await import("xlsx");
    const rows =
      report.rows.length > 0
        ? report.rows.map((row) =>
            columns.map((column) => {
              const value = row.cells[column.code];
              return column.numeric && value !== null && value !== undefined && value !== ""
                ? Number(value)
                : value ?? "";
            }),
          )
        : [["Không có dữ liệu phát sinh trong kỳ đã chọn."]];
    const sheet = XLSX.utils.aoa_to_sheet([
      [session.company?.name || "DOANH NGHIỆP"],
      [title.toUpperCase()],
      [`Từ ngày ${fromDate} đến ngày ${toDate}`],
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
    try {
      const companyId = getSelectedCompanyId() || session.company?.id || "";
      const token = session.token || localStorage.getItem("erp_token") || "";
      if (companyId && token) {
        const writer = createApiWriter(token, companyId);
        await executeReportExportUcRpt15(
          writer,
          {
            company_id: companyId,
            report_code: report.reportCode || ("code" in target ? target.code : "RPT-STANDARD"),
            title,
            period_str: `Từ ngày ${fromDate} đến ngày ${toDate}`,
            output_format: format,
            export_scope: "ALL_MATCHING_FILTERS",
            columns: columns.map((c) => ({
              key: c.code,
              label: c.name,
              type: c.numeric ? "number" : "text",
            })),
            rows: report.rows.map((r) => ({
              ...r.cells,
              is_subtotal: Boolean(r.bold),
            })),
            parameters: {
              from_date: fromDate,
              to_date: toDate,
            },
          },
          token,
        );
        return;
      }
      if (format === "XLSX" || format === "CSV") {
        await fallbackClientExcel();
      } else {
        window.print();
      }
    } catch {
      try {
        if (format === "XLSX" || format === "CSV") {
          await fallbackClientExcel();
        } else {
          window.print();
        }
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569", fontWeight: 500 }}>
            Từ ngày
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              style={ctrlStyle}
            />
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569", fontWeight: 500 }}>
            Đến ngày
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              style={ctrlStyle}
            />
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
            onClick={() => void load()}
            disabled={loading}
            style={{
              ...btnBaseStyle,
              background: "#00b06b",
              borderColor: "#00b06b",
              color: "#ffffff",
            }}
          >
            <RefreshCw size={14} /> Lấy dữ liệu
          </button>
          <button
            type="button"
            onClick={() => void handleExport("XLSX")}
            disabled={!report || exporting !== null}
            style={{
              ...btnBaseStyle,
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
            style={btnBaseStyle}
            title="Kết xuất tệp CSV (.csv)"
          >
            <Download size={14} /> {exporting === "CSV" ? "Đang xuất..." : "CSV"}
          </button>
          <button
            type="button"
            onClick={() => void handleExport("PRINT")}
            disabled={!report || exporting !== null}
            style={btnBaseStyle}
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
          <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 220px)" }}>
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
                        textAlign: column.numeric ? "right" : "left",
                        height: 38,
                      }}
                    >
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length || 1}
                      style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}
                    >
                      Không có dữ liệu phát sinh trong kỳ đã chọn ({fromDate} → {toDate}).
                    </td>
                  </tr>
                )}
                {report.rows.map((row) => (
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
                          textAlign: column.numeric ? "right" : "left",
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
    </div>
  );
}
