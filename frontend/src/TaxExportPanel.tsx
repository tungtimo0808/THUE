import { useCallback, useEffect, useState } from "react";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";

type Period = { id: string; code: string; tax_type: string };
type Export = { id: string; period: string; format_code: string; exported_at: string;
  submission_status: string; data_snapshot: { export_type?: string; purpose?: string; row_count?: number;
    period?: string; source_version?: string }; warnings: string[] };
type List<T> = T[] | { results: T[] };
const list = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results || [];
const button = { border: "1px solid #00a862", borderRadius: 4, padding: "7px 12px",
  color: "#008a50", background: "white", cursor: "pointer" };
const labels: Record<string, string> = { VAT_LEDGER: "Sổ VAT", TAX_OBLIGATION: "Nghĩa vụ thuế" };

export default function TaxExportPanel({ companyId, token }: { companyId: string; token?: string }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [exportType, setExportType] = useState("TAX_OBLIGATION");
  const [purpose, setPurpose] = useState("REPORT");
  const [exports, setExports] = useState<Export[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const query = `?company_id=${encodeURIComponent(companyId)}`;
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [periodData, exportData] = await Promise.all([
        request<List<Period>>(`/api/v1/tax/periods/${query}`, token),
        request<List<Export>>(`/api/v1/tax/exports/${query}`, token),
      ]);
      const available = list(periodData);
      setPeriods(available);
      setPeriodId((current) => available.some((item) => item.id === current) ? current : available[0]?.id || "");
      setExports(list(exportData).filter((item) => item.data_snapshot?.export_type));
      setError("");
    } catch (cause) { setError(errorText(cause)); }
  }, [companyId, token]);
  useEffect(() => { void load(); }, [load]);
  const download = async (item: Export) => {
    if (!token) return;
    setError("");
    try {
      const response = await fetch(`/api/v1/tax/exports/${item.id}/download/${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`Không tải được tệp (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url;
      anchor.download = `thue-${item.data_snapshot.export_type?.toLowerCase()}-${item.data_snapshot.period}.xlsx`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (cause) { setError(errorText(cause)); }
  };
  const generate = async () => {
    if (!token || !periodId || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const created = await request<Export>(`/api/v1/tax/exports/generate/${query}`, token, {
        method: "POST", body: JSON.stringify({ company: companyId, period: periodId,
          export_type: exportType, purpose }),
      });
      await load();
      setMessage(`Đã tạo bản xuất ${created.data_snapshot.row_count} dòng từ dữ liệu đã lưu. Chưa nộp CQT.`);
      await download(created);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  return <section style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6,
    padding: 18, marginBottom: 20, fontSize: 13 }}>
    <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#1e293b" }}>Xuất dữ liệu thuế</h2>
    <p style={{ color: "#64748b", marginTop: 0 }}>Tệp Excel báo cáo nội bộ từ dữ liệu thật. Chưa phải tệp hồ sơ để nộp CQT.</p>
    <div style={{ display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
      <label>Kỳ thuế<select aria-label="Kỳ xuất dữ liệu" value={periodId} onChange={(event) => setPeriodId(event.target.value)}
        style={{ display: "block", height: 34, minWidth: 160 }}>
        {periods.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.tax_type}</option>)}
      </select></label>
      <label>Dữ liệu<select aria-label="Loại dữ liệu xuất" value={exportType} onChange={(event) => setExportType(event.target.value)}
        style={{ display: "block", height: 34, minWidth: 160 }}>
        <option value="TAX_OBLIGATION">Nghĩa vụ thuế</option><option value="VAT_LEDGER">Sổ VAT</option>
      </select></label>
      <label>Mục đích<select aria-label="Mục đích xuất" value={purpose} onChange={(event) => setPurpose(event.target.value)}
        style={{ display: "block", height: 34, minWidth: 135 }}>
        <option value="REPORT">Báo cáo</option><option value="REVIEW">Rà soát</option><option value="ARCHIVE">Lưu trữ</option>
      </select></label>
      <button type="button" style={{ ...button, background: "#00a862", color: "white" }} disabled={!periodId || busy}
        onClick={() => void generate()}>{busy ? "Đang xuất..." : "Xuất Excel"}</button>
      <button type="button" style={button} onClick={() => void load()}>Tải lại lịch sử</button>
    </div>
    {!periods.length && <p>Chưa có kỳ thuế để xuất.</p>}
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {message && <p role="status" style={{ color: "#008a50" }}>{message}</p>}
    <h3 style={{ fontSize: 14, marginTop: 20 }}>Lịch sử xuất dữ liệu</h3>
    <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
      <thead><tr style={{ background: "#e2ede6" }}><th>Ngày xuất</th><th>Dữ liệu</th><th>Kỳ</th><th>Dòng</th><th>Phiên bản nguồn</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{exports.map((item) => <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
        <td>{new Date(item.exported_at).toLocaleString("vi-VN")}</td><td>{labels[item.data_snapshot.export_type || ""] || item.data_snapshot.export_type}</td>
        <td>{item.data_snapshot.period}</td><td>{item.data_snapshot.row_count}</td><td>{item.data_snapshot.source_version || "—"}</td>
        <td>Đã xuất · Chưa nộp{item.warnings.length > 0 && <details><summary>{item.warnings.length} lưu ý</summary>
          {item.warnings.map((warning, index) => <div key={index}>{warning}</div>)}</details>}</td>
        <td><button type="button" style={button} onClick={() => void download(item)}>Tải XLSX</button></td>
      </tr>)}{!exports.length && <tr><td colSpan={7} style={{ padding: 12 }}>Chưa có bản xuất dữ liệu.</td></tr>}</tbody>
    </table></div>
  </section>;
}
