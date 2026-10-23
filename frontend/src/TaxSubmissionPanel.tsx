import { useCallback, useEffect, useState } from "react";
import { request } from "./live-api";
import { errorText } from "./misa-api-writes";

type Submission = { id: string; declaration: string; declaration_version: number; status: string;
  channel: string; verification_source: string; external_reference: string; submitted_at: string;
  evidence_reference: string; snapshot_hash: string; events: { id: string; from_status: string;
    to_status: string; evidence_reference: string; note: string; created_at: string }[] };
type List<T> = T[] | { results: T[] };
const list = <T,>(value: List<T>): T[] => Array.isArray(value) ? value : value.results || [];
const labels: Record<string, string> = { SUBMITTED_EXTERNALLY: "Đã ghi nhận nộp ngoài", UNKNOWN: "Chưa rõ kết quả",
  ACCEPTED: "Được báo chấp nhận (thủ công)", REJECTED: "Được báo từ chối (thủ công)" };
const button = { padding: "7px 12px", border: "1px solid #00a862", background: "white",
  color: "#008a50", borderRadius: 4, cursor: "pointer" };
const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function TaxSubmissionPanel({ companyId, token, declaration, notify }: {
  companyId: string; token?: string; declaration: { id: string; version: number;
    period_code: string; form_code: string; preparation_status: string };
  notify: (message: string) => void;
}) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [submittedAt, setSubmittedAt] = useState(localNow);
  const [reference, setReference] = useState("");
  const [initialEvidence, setInitialEvidence] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [target, setTarget] = useState("ACCEPTED");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = `?company_id=${encodeURIComponent(companyId)}`;
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await request<List<Submission>>(`/api/v1/tax/submissions/${query}&declaration=${declaration.id}`, token);
      setRows(list(data)); setError("");
    } catch (cause) { setError(errorText(cause)); }
  }, [companyId, declaration.id, token]);
  useEffect(() => { void load(); }, [load]);
  const create = async () => {
    if (!token || busy || !reference.trim() || !submittedAt) return;
    setBusy(true); setError("");
    try {
      await request(`/api/v1/tax/declarations/${declaration.id}/manual-submissions/${query}`, token, {
        method: "POST", body: JSON.stringify({ declaration_version: declaration.version,
          submitted_at: new Date(submittedAt).toISOString(), external_reference: reference.trim(),
          evidence_reference: initialEvidence.trim() }),
      });
      setReference(""); setInitialEvidence(""); await load();
      notify("Đã ghi nhận lần nộp ngoài hệ thống; kết quả chưa được Provider xác minh.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const update = async () => {
    if (!token || !selectedId || busy) return;
    setBusy(true); setError("");
    try {
      await request(`/api/v1/tax/submissions/${selectedId}/manual-status/${query}`, token, {
        method: "POST", body: JSON.stringify({ status: target, evidence_reference: evidence.trim(), note: note.trim() }),
      });
      setSelectedId(""); setEvidence(""); setNote(""); await load();
      notify("Đã lưu kết quả do người dùng ghi nhận; nguồn xác minh vẫn là MANUAL.");
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  return <section style={{ marginTop: 18, borderTop: "1px solid #cbd5e1", paddingTop: 14 }}>
    <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Lịch sử nộp hồ sơ</h3>
    <p style={{ color: "#64748b" }}>Nộp điện tử chưa khả dụng vì chưa có kết nối Provider được xác thực. Thao tác dưới đây chỉ ghi nhận việc đã thực hiện ngoài hệ thống.</p>
    {declaration.preparation_status === "READY_TO_SUBMIT" && <div style={{ padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
      <strong>Ghi nhận nộp ngoài hệ thống · {declaration.form_code} · {declaration.period_code} · v{declaration.version}</strong>
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
        <label>Ngày giờ nộp<input aria-label="Ngày giờ nộp ngoài hệ thống" type="datetime-local" value={submittedAt}
          onChange={(event) => setSubmittedAt(event.target.value)} style={{ display: "block", height: 32 }} /></label>
        <label>Mã tham chiếu<input aria-label="Mã tham chiếu nộp" value={reference} onChange={(event) => setReference(event.target.value)}
          style={{ display: "block", height: 32 }} /></label>
        <label>Mã/chỗ lưu bằng chứng (nếu có)<input aria-label="Bằng chứng nộp ban đầu" value={initialEvidence}
          onChange={(event) => setInitialEvidence(event.target.value)} style={{ display: "block", height: 32 }} /></label>
        <button type="button" style={{ ...button, background: "#00a862", color: "white" }} disabled={busy || !reference.trim() || !submittedAt}
          onClick={() => void create()}>Ghi nhận nộp ngoài</button>
      </div>
    </div>}
    {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
    {rows.map((row) => <div key={row.id} style={{ padding: 12, border: "1px solid #cbd5e1", marginTop: 10 }}>
      <strong>{labels[row.status] || row.status}</strong> · MANUAL · {row.external_reference} · {new Date(row.submitted_at).toLocaleString("vi-VN")}
      <div>Hồ sơ v{row.declaration_version} · Snapshot {row.snapshot_hash.slice(0, 12)} · {row.evidence_reference || "Chưa có mã bằng chứng"}</div>
      <details><summary>{row.events.length} sự kiện</summary>{row.events.map((event) => <p key={event.id}>
        {new Date(event.created_at).toLocaleString("vi-VN")} · {labels[event.to_status] || event.to_status}
        {event.evidence_reference && ` · ${event.evidence_reference}`}{event.note && ` · ${event.note}`}</p>)}</details>
      {["SUBMITTED_EXTERNALLY", "UNKNOWN"].includes(row.status) && <button type="button" style={button}
        onClick={() => { setSelectedId(row.id); setTarget("ACCEPTED"); setEvidence(""); setNote(""); }}>Cập nhật kết quả thủ công</button>}
    </div>)}
    {!rows.length && <p>Chưa có lần nộp nào được ghi nhận.</p>}
    {selectedId && <div role="dialog" aria-label="Cập nhật kết quả nộp thủ công" style={{ marginTop: 10, padding: 12, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
      <strong>Kết quả được người dùng ghi nhận, chưa xác minh tự động</strong>
      <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 8 }}>
        <label>Trạng thái<select aria-label="Kết quả nộp thủ công" value={target} onChange={(event) => setTarget(event.target.value)} style={{ display: "block", height: 34 }}>
          <option value="ACCEPTED">Được báo chấp nhận</option><option value="REJECTED">Được báo từ chối</option>
          <option value="UNKNOWN">Chưa rõ kết quả</option>
        </select></label>
        <label>Mã/chỗ lưu bằng chứng<input aria-label="Bằng chứng kết quả" value={evidence} onChange={(event) => setEvidence(event.target.value)} style={{ display: "block", height: 32 }} /></label>
        <label>Ghi chú kết quả<input aria-label="Ghi chú kết quả" value={note} onChange={(event) => setNote(event.target.value)} style={{ display: "block", height: 32, minWidth: 220 }} /></label>
        <button type="button" style={{ ...button, background: "#00a862", color: "white" }} disabled={busy}
          onClick={() => void update()}>Lưu kết quả</button>
        <button type="button" style={button} onClick={() => setSelectedId("")}>Đóng</button>
      </div>
    </div>}
  </section>;
}
