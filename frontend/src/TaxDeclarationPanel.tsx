import { useCallback, useEffect, useState } from "react";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";
import TaxSubmissionPanel from "./TaxSubmissionPanel";

type Period = { id: string; code: string; tax_type: string; status: string };
type Declaration = {
  id: string; period_code: string; form_code: string; version: number; form_version: string;
  preparation_status: string; source_is_current: boolean; calculation_version: number;
  indicators: Record<string, string>; warnings: string[]; notes: string; row_version: number;
};
const list = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results || [];
const amount = (value?: string) => value == null ? "—" : Number(value).toLocaleString("vi-VN");
const labels: Record<string, string> = {
  input_tax: "Thuế GTGT đầu vào", input_deductible: "Đầu vào được khấu trừ",
  output_tax: "Thuế GTGT đầu ra", deducted: "Đã khấu trừ",
  payable: "Còn phải nộp", carry_forward: "Chuyển kỳ sau",
};
const statusLabel: Record<string, string> = {
  DRAFT: "Nháp", REVIEW_REQUIRED: "Cần rà soát", READY_TO_SUBMIT: "Sẵn sàng nộp",
};

export default function TaxDeclarationPanel({ companyId, token, notify }: {
  companyId: string; token?: string; notify: (message: string) => void;
}) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<Declaration[]>([]);
  const [selected, setSelected] = useState<Declaration | null>(null);
  const [notes, setNotes] = useState("");
  const [sources, setSources] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `?company_id=${encodeURIComponent(companyId)}`;
  const load = useCallback(async () => {
    if (!token || !companyId) return;
    try {
      const [periodData, declarationData] = await Promise.all([
        request<Period[] | { results: Period[] }>(`/api/v1/tax/periods/${base}`, token),
        request<Declaration[] | { results: Declaration[] }>(`/api/v1/tax/declarations/${base}`, token),
      ]);
      const vatPeriods = list(periodData).filter((row) => row.tax_type === "VAT");
      setPeriods(vatPeriods);
      setPeriodId((current) => vatPeriods.some((row) => row.id === current) ? current : vatPeriods[0]?.id || "");
      setRows(list(declarationData));
      if (selected) {
        const current = list(declarationData).find((row) => row.id === selected.id);
        if (current) { setSelected(current); setNotes(current.notes); }
      }
    } catch (error) { notify(`Không tải được hồ sơ kê khai: ${errorText(error)}`); }
  }, [companyId, token]);
  useEffect(() => { void load(); }, [load]);

  const run = async (path: string, body: Record<string, unknown>, success: string) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      const result = await request<Declaration>(path, token, { method: "POST", body: JSON.stringify(body) });
      setSelected(result); setNotes(result.notes); setSources(null);
      await load(); notify(success);
    } catch (error) { notify(`Không thực hiện được: ${errorText(error)}`); }
    finally { setBusy(false); }
  };
  return <section style={{ marginTop: 28 }}>
    <h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#1e293b" }}>Hồ sơ kê khai</h2>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, fontSize: 13 }}>
      <label htmlFor="declaration-period">Kỳ thuế GTGT</label>
      <select id="declaration-period" value={periodId} onChange={(event) => setPeriodId(event.target.value)}
        style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 4 }}>
        {periods.map((row) => <option key={row.id} value={row.id}>{row.code}{row.status !== "OPEN" ? " (Đã khóa)" : ""}</option>)}
      </select>
      <button type="button" disabled={!periodId || busy} onClick={() => void run(`/api/v1/tax/declarations/${base}`,
        { company: companyId, period: periodId, form_code: "01/GTGT" }, "Đã mở hồ sơ 01/GTGT.")}
        style={{ padding: "8px 14px", border: 0, borderRadius: 4, background: "#00a862", color: "white", cursor: "pointer" }}>
        Lập tờ khai 01/GTGT
      </button>
      <button type="button" onClick={() => void load()} style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "white" }}>Tải lại</button>
    </div>
    {!periods.length && <p style={{ fontSize: 13, color: "#64748b" }}>Chưa có kỳ thuế GTGT. Tạo kỳ ở màn Khấu trừ thuế GTGT trước khi lập tờ khai.</p>}
    <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: "#e2ede6", height: 36 }}>
          <th style={{ textAlign: "left", padding: 8 }}>Mẫu</th><th>Kỳ</th><th>Phiên bản</th><th>Trạng thái chuẩn bị</th><th>Số phải nộp</th><th></th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} style={{ borderTop: "1px solid #e2e8f0", height: 38 }}>
          <td style={{ padding: 8 }}>{row.form_code}</td><td>{row.period_code}</td><td>{row.version}</td>
          <td>{statusLabel[row.preparation_status] || row.preparation_status}{!row.source_is_current ? " · Nguồn đã đổi" : ""}</td>
          <td>{amount(row.indicators.payable)}</td>
          <td><button type="button" onClick={() => { setSelected(row); setNotes(row.notes); setSources(null); }}
            style={{ border: 0, background: "transparent", color: "#008a50", cursor: "pointer" }}>Xem</button></td>
        </tr>)}{!rows.length && <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "#64748b" }}>Chưa có hồ sơ kê khai</td></tr>}</tbody>
      </table>
    </div>
    {selected && <div role="dialog" aria-label="Chi tiết hồ sơ kê khai" style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 4, padding: 18, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><strong>01/GTGT · {selected.period_code} · hồ sơ v{selected.version} · mẫu {selected.form_version} · {statusLabel[selected.preparation_status] || selected.preparation_status}</strong>
        <button type="button" onClick={() => setSelected(null)} aria-label="Đóng chi tiết">×</button></div>
      <p>Nguồn: Tổng hợp GTGT phiên bản {selected.calculation_version} · {selected.source_is_current ? "Còn hiệu lực" : "Đã thay đổi"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {Object.entries(labels).map(([key, label]) => <div key={key}>{label}: <strong>{amount(selected.indicators[key])}</strong></div>)}
      </div>
      {!!selected.warnings.length && <div style={{ marginTop: 12, color: "#a16207" }}>{selected.warnings.map((warning, index) => <div key={index}>• {warning}</div>)}</div>}
      <label style={{ display: "block", marginTop: 12 }}>Ghi chú nội bộ<textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={selected.preparation_status === "READY_TO_SUBMIT"}
        style={{ display: "block", width: "100%", boxSizing: "border-box", minHeight: 60, border: "1px solid #cbd5e1", borderRadius: 4, marginTop: 5 }} /></label>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={busy || selected.preparation_status === "READY_TO_SUBMIT"} onClick={() => void run(`/api/v1/tax/declarations/${selected.id}/save-draft/${base}`,
          { row_version: selected.row_version, notes }, "Đã lưu nháp.")}>Lưu nháp</button>
        <button type="button" onClick={async () => { try { const data = await request<{ sources: any[] }>(`/api/v1/tax/declarations/${selected.id}/sources/${base}`, token); setSources(data.sources); } catch (error) { notify(errorText(error)); } }}>Xem nguồn chỉ tiêu</button>
        <button type="button" disabled={busy || selected.preparation_status === "READY_TO_SUBMIT"}
          onClick={() => void run(`/api/v1/tax/declarations/${selected.id}/refresh-source/${base}`, {}, "Đã lấy lại kết quả tổng hợp GTGT mới nhất.")}>Lấy lại dữ liệu</button>
        <button type="button" disabled={busy || !selected.source_is_current || selected.warnings.length > 0 || selected.preparation_status === "READY_TO_SUBMIT"}
          onClick={() => void run(`/api/v1/tax/declarations/${selected.id}/confirm/${base}`, {}, "Hồ sơ đã sẵn sàng để nộp; chưa gửi cơ quan thuế.")}>Xác nhận hồ sơ</button>
      </div>
      {sources && <div style={{ marginTop: 12, maxHeight: 180, overflow: "auto" }}><strong>Nguồn GTGT ({sources.length})</strong>
        {sources.map((source, index) => <div key={index}>{source.invoice_number || source.invoice_id || "Nguồn"} · {source.direction} · {amount(source.tax_amount)} · {source.decision}</div>)}
      </div>}
      <TaxSubmissionPanel companyId={companyId} token={token} declaration={selected} notify={notify} />
    </div>}
  </section>;
}
