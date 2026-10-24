import { useCallback, useEffect, useState } from "react";
import { errorText } from "./misa-api-writes";
import { request } from "./live-api";

type Period = { id: string; code: string; tax_type: string; start_date: string; end_date: string };
type Row = { key: string; label: string; source_a: string; source_b: string; difference: string;
  status: string; difference_type: string; source_refs: Record<string, unknown>; assessed?: string;
  remaining?: string; draft_orders?: number };
type Run = { id: string; period: string; period_code: string; created_at: string; rule_version: string;
  result_status: string; source_is_current: boolean | null;
  summary: { row_count: number; variance_count: number; missing_count: number; review_count: number };
  details: { rows: Row[]; warnings: string[] } };
type List<T> = T[] | { results: T[] };
const list = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results || [];
const money = (value: string) => Number(value).toLocaleString("vi-VN");
const statusText: Record<string, string> = { MATCHED: "Khớp", VARIANCE: "Có chênh lệch",
  REVIEW_REQUIRED: "Cần rà soát", MISSING_SOURCE: "Thiếu nguồn" };
const button = { border: "1px solid #00a862", borderRadius: 4, padding: "7px 13px",
  color: "#008a50", background: "white", cursor: "pointer" };

export default function TaxReconciliationModal({ companyId, companyName, token, title, reconciliationType, onClose }: {
  companyId: string; companyName: string; token?: string; title: string;
  reconciliationType: "VAT_GL" | "OBLIGATION_PAYMENT"; onClose: () => void;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = `?company_id=${encodeURIComponent(companyId)}`;
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [periodData, runData] = await Promise.all([
        request<List<Period>>(`/api/v1/tax/periods/${base}`, token),
        request<List<Run>>(`/api/v1/tax/reconciliations/${base}&reconciliation_type=${reconciliationType}`, token),
      ]);
      const available = list(periodData).filter((item) => reconciliationType !== "VAT_GL" || item.tax_type === "VAT");
      setPeriods(available);
      setPeriodId((current) => current && available.some((item) => item.id === current) ? current : available[0]?.id || "");
      setRuns(list(runData));
      setError("");
    } catch (cause) { setError(errorText(cause)); }
  }, [companyId, token, reconciliationType]);
  useEffect(() => { void load(); }, [load]);
  const visibleRuns = runs.filter((item) => item.period === periodId);
  const selected = visibleRuns.find((item) => item.id === selectedId) || visibleRuns[0];
  const run = async () => {
    if (!token || !periodId || busy) return;
    setBusy(true); setError("");
    try {
      const created = await request<Run>(`/api/v1/tax/reconciliations/run/${base}`, token, {
        method: "POST", body: JSON.stringify({ company: companyId, period: periodId, reconciliation_type: reconciliationType }),
      });
      await load(); setSelectedId(created.id);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const exportCsv = () => {
    if (!selected) return;
    const cells = (values: (string | number)[]) => values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",");
    const body = [cells(["Hạng mục", "Nguồn thuế", "Nguồn đối chiếu", "Chênh lệch", "Trạng thái", "Tham chiếu"]),
      ...selected.details.rows.map((row) => cells([row.label, row.source_a, row.source_b, row.difference,
        statusText[row.status] || row.status, JSON.stringify(row.source_refs)]))].join("\r\n");
    const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `doi-chieu-thue-${reconciliationType.toLowerCase()}-${selected.period_code}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };
  return <div className="misa-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <div className="misa-modal-card" style={{ width: 1060, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto" }}>
      <header style={{ padding: "15px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2><small>{companyName} · Đối chiếu dữ liệu đã lưu</small></div>
        <button type="button" aria-label="Đóng đối chiếu" onClick={onClose} style={button}>Đóng</button>
      </header>
      <div style={{ padding: 20, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label>Kỳ thuế<select aria-label="Kỳ đối chiếu" value={periodId} onChange={(event) => { setPeriodId(event.target.value); setSelectedId(""); }}
            style={{ display: "block", height: 34, minWidth: 180, border: "1px solid #cbd5e1", borderRadius: 4 }}>
            {periods.map((period) => <option key={period.id} value={period.id}>{period.code} · {period.tax_type}</option>)}
          </select></label>
          <button type="button" style={{ ...button, background: "#00a862", color: "white" }} disabled={!periodId || busy} onClick={() => void run()}>{busy ? "Đang đối chiếu..." : "Chạy đối chiếu"}</button>
          <button type="button" style={button} disabled={!selected} onClick={exportCsv}>Xuất CSV</button>
          <button type="button" style={button} onClick={() => void load()}>Tải lại</button>
        </div>
        {!periods.length && <p>Chưa có kỳ thuế phù hợp. Hãy tạo kỳ thuế trước khi đối chiếu.</p>}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        {periodId && !selected && <p>Chưa có lần đối chiếu cho kỳ này. Bấm “Chạy đối chiếu” để lấy dữ liệu nguồn hiện tại.</p>}
        {selected && <>
          <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{statusText[selected.result_status] || selected.result_status}</strong>
            <span>{new Date(selected.created_at).toLocaleString("vi-VN")}</span><span>Quy tắc {selected.rule_version}</span>
            <span>{selected.source_is_current === false ? "Nguồn đã thay đổi · hãy chạy lại" : "Snapshot chưa thay đổi"}</span>
          </div>
          <p>Hạng mục: {selected.summary.row_count} · Chênh lệch: {selected.summary.variance_count} · Thiếu nguồn: {selected.summary.missing_count} · Cần rà soát: {selected.summary.review_count}</p>
          {selected.details.warnings.map((warning, index) => <p key={index} style={{ background: "#fff7ed", padding: 10, border: "1px solid #fed7aa" }}>{warning}</p>)}
          <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead><tr style={{ background: "#e2ede6" }}><th>Hạng mục</th><th>Nguồn thuế</th><th>Nguồn đối chiếu</th><th>Chênh lệch (+/-)</th><th>Kết quả</th><th>Truy vết</th></tr></thead>
            <tbody>{selected.details.rows.map((row) => <tr key={row.key} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td>{row.label}</td><td>{money(row.source_a)}</td><td>{money(row.source_b)}</td>
              <td>{money(row.difference)}</td><td>{statusText[row.status] || row.status}</td>
              <td><details><summary>Tham chiếu nguồn</summary><pre style={{ whiteSpace: "pre-wrap", maxWidth: 240 }}>{JSON.stringify(row.source_refs, null, 2)}</pre></details></td>
            </tr>)}</tbody>
          </table></div>
          <label style={{ display: "block", marginTop: 16 }}>Lần chạy<select aria-label="Lần đối chiếu" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}
            style={{ display: "block", height: 34, minWidth: 250 }}>
            {visibleRuns.map((item) => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString("vi-VN")} · {statusText[item.result_status] || item.result_status}</option>)}
          </select></label>
        </>}
      </div>
    </div>
  </div>;
}
