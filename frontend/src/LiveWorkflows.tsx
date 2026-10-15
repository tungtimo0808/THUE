import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type DocumentType = { id: string; code: string; name: string; supports_workflow: boolean };
type Member = { id: string; user_id: string; full_name: string; email: string; membership_status: string };
type Policy = { id: string; document_type: string; policy: string };
type Version = { id: string; number: number; name: string; description: string; priority: number; status: string; effective_from: string; effective_to: string | null; conditions: unknown; steps: unknown; allow_self_approval: boolean; version: string };
type Workflow = { id: string; code: string; name: string; document_type: string; latest_version: Version };
type Validation = { errors: string[]; warnings: string[]; simulations: unknown[] };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const base = "/api/v1/approval-workflows";

export default function LiveWorkflows() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [history, setHistory] = useState<Version[]>([]);
  const [mode, setMode] = useState<"create" | "edit" | "clone" | null>(null);
  const [docId, setDocId] = useState("");
  const [policy, setPolicy] = useState("REQUIRED");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [conditions, setConditions] = useState("{}");
  const [steps, setSteps] = useState("[]");
  const [approverId, setApproverId] = useState("");
  const [allowSelf, setAllowSelf] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const load = async <T,>(path: string) => rows(await request<T[] | { results: T[] }>(path, token));
    Promise.allSettled([
      load<DocumentType>(`/api/v1/master-data/document-types/?company_id=${companyId}`),
      load<Member>(`/api/v1/iam/memberships/?company_id=${companyId}`),
      load<Policy>(`${base}/policies/?company_id=${companyId}`),
      load<Workflow>(`${base}/workflows/?company_id=${companyId}`),
    ]).then(results => { if (!active) return;
      if (results[0].status === "fulfilled") setDocuments(results[0].value.filter(item => item.supports_workflow));
      if (results[1].status === "fulfilled") setMembers(results[1].value);
      if (results[2].status === "fulfilled") setPolicies(results[2].value);
      if (results[3].status === "fulfilled") { const next = results[3].value; setWorkflows(next); setSelected(current => next.find(item => item.id === current?.id) || null); }
      else setError(results[3].reason instanceof Error ? results[3].reason.message : "Không tải được workflow.");
    });
    return () => { active = false; };
  }, [token, companyId, reload]);

  useEffect(() => {
    if (!selected || !token) { setHistory([]); return; }
    let active = true;
    request<Version[]>(`${base}/workflows/${selected.id}/history/?company_id=${companyId}`, token)
      .then(value => { if (active) setHistory(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được phiên bản."); });
    return () => { active = false; };
  }, [selected?.id, token, companyId, reload]);

  function open(nextMode: typeof mode, workflow: Workflow | null = null) {
    setMode(nextMode); setSelected(workflow); setValidation(null); setError(""); setMessage("");
    setDocId(workflow?.document_type || ""); setCode(nextMode === "clone" ? "" : workflow?.code || ""); setName(nextMode === "clone" ? "" : workflow?.name || "");
    const version = workflow?.latest_version;
    setDescription(version?.description || ""); setPriority(version?.priority || 0); setEffectiveFrom(version?.effective_from || today()); setEffectiveTo(version?.effective_to || ""); setConditions(JSON.stringify(version?.conditions || {}, null, 2)); setSteps(JSON.stringify(version?.steps || [], null, 2)); setAllowSelf(version?.allow_self_approval || false); setApproverId("");
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); setReload(value => value + 1); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được workflow."); return false; }
    finally { setBusy(false); }
  }
  async function savePolicy() {
    if (!docId) return;
    await run(() => request(`${base}/policies/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company: companyId, document_type: docId, policy }) }), "Đã lưu chính sách phê duyệt.");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (mode === "clone" && selected) {
        const ok = await run(() => request(`${base}/workflows/${selected.id}/clone/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ code: code.trim(), name: name.trim() }) }), "Đã sao chép workflow.");
        if (ok) setMode(null); return;
      }
      const parsedConditions = JSON.parse(conditions);
      const parsedSteps = JSON.parse(steps);
      if (!Array.isArray(parsedSteps)) throw new Error("Các bước phải là mảng JSON.");
      const body = { name: name.trim(), description: description.trim(), priority, effective_from: effectiveFrom, effective_to: effectiveTo || null, conditions: parsedConditions, steps: parsedSteps, allow_self_approval: allowSelf };
      const ok = mode === "edit" && selected ? await run(() => request(`${base}/versions/${selected.latest_version.id}/?company_id=${companyId}`, token, { method: "PATCH", body: JSON.stringify({ version: selected.latest_version.version, ...body }) }), "Đã sửa bản nháp.") : await run(() => request(`${base}/workflows/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company: companyId, document_type: docId, code: code.trim(), ...body }) }), "Đã tạo workflow bản nháp.");
      if (ok) setMode(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "JSON không hợp lệ."); }
  }
  async function validate(version: Version) {
    setBusy(true); setError(""); setValidation(null);
    try { setValidation(await request<Validation>(`${base}/versions/${version.id}/validate/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ samples: [] }) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không kiểm tra được workflow."); }
    finally { setBusy(false); }
  }
  async function versionAction(version: Version, action: "activate" | "stop" | "archive") {
    await run(() => request(`${base}/versions/${version.id}/${action}/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ version: version.version }) }), "Đã cập nhật trạng thái phiên bản.");
  }
  const latest = selected?.latest_version;

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-10</p><h1>Quản lý Workflow phê duyệt</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); open(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <button type="button" onClick={() => open("create")}>Tạo Workflow</button>
      <ul className="account-request-list">{workflows.map(item => <li key={item.id}><div><strong>{item.code} · {item.name}</strong><span>{documents.find(doc => doc.id === item.document_type)?.name || item.document_type} · v{item.latest_version?.number} · {item.latest_version?.status}</span></div><button type="button" onClick={() => open(null, item)}>Chi tiết</button></li>)}</ul>
      {selected && !mode && <section className="account-change-email"><h2>{selected.code} · {selected.name}</h2><p>Chính sách: {policies.find(item => item.document_type === selected.document_type)?.policy || "Chưa thiết lập"}</p><div className="account-actions"><button type="button" onClick={() => open("clone", selected)}>Sao chép</button>{latest?.status === "DRAFT" ? <><button type="button" onClick={() => open("edit", selected)}>Sửa bản nháp</button><button type="button" disabled={busy} onClick={() => validate(latest)}>Kiểm tra</button><button type="button" disabled={busy} onClick={() => versionAction(latest, "activate")}>Kích hoạt</button></> : <><button type="button" disabled={busy} onClick={() => run(() => request(`${base}/workflows/${selected.id}/new-version/?company_id=${companyId}`, token, { method: "POST", body: "{}" }), "Đã tạo phiên bản nháp mới.")}>Tạo phiên bản mới</button>{latest && ["ACTIVE", "SCHEDULED"].includes(latest.status) && <button type="button" disabled={busy} onClick={() => versionAction(latest, "stop")}>Ngừng áp dụng</button>}{latest?.status === "INACTIVE" && <button type="button" disabled={busy} onClick={() => versionAction(latest, "archive")}>Lưu trữ</button>}</>}</div>
        {validation && <div role="status"><p>{validation.errors.length ? `Lỗi: ${validation.errors.join("; ")}` : "Kiểm tra hợp lệ."}</p>{validation.warnings.map((item, index) => <p key={index}>Lưu ý: {item}</p>)}</div>}
        <h3>Phiên bản</h3><ul>{history.map(item => <li key={item.id}>v{item.number} · {item.status} · từ {item.effective_from} <span className="account-actions">{item.status === "DRAFT" && <><button type="button" disabled={busy} onClick={() => validate(item)}>Kiểm tra</button><button type="button" disabled={busy} onClick={() => versionAction(item, "activate")}>Kích hoạt</button></>}{["ACTIVE", "SCHEDULED"].includes(item.status) && <button type="button" disabled={busy} onClick={() => versionAction(item, "stop")}>Ngừng áp dụng</button>}{item.status === "INACTIVE" && <button type="button" disabled={busy} onClick={() => versionAction(item, "archive")}>Lưu trữ</button>}</span></li>)}</ul>
      </section>}
      {mode && <form className="account-change-email" onSubmit={save}><h2>{mode === "create" ? "Tạo Workflow" : mode === "clone" ? "Sao chép Workflow" : "Sửa bản nháp"}</h2>
        {mode === "create" && <><label>Loại chứng từ<select value={docId} onChange={event => { setDocId(event.target.value); setPolicy(policies.find(item => item.document_type === event.target.value)?.policy || "REQUIRED"); }} required><option value="">Chọn loại chứng từ</option>{documents.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><label>Chính sách phê duyệt<select value={policy} onChange={event => setPolicy(event.target.value)}><option value="REQUIRED">Bắt buộc</option><option value="OPTIONAL">Tùy chọn</option><option value="NOT_REQUIRED">Không cần</option></select></label><button type="button" disabled={busy || !docId} onClick={savePolicy}>Lưu chính sách</button></>}
        {mode !== "edit" && <label>Mã Workflow<input value={code} onChange={event => setCode(event.target.value)} required maxLength={80} /></label>}
        <label>Tên Workflow<input value={name} onChange={event => setName(event.target.value)} required maxLength={255} /></label>
        {mode !== "clone" && <><label>Mô tả<textarea value={description} onChange={event => setDescription(event.target.value)} /></label><label>Ưu tiên<input type="number" value={priority} onChange={event => setPriority(Number(event.target.value))} /></label><label>Hiệu lực từ<input type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} required /></label><label>Hiệu lực đến<input type="date" value={effectiveTo} min={effectiveFrom} onChange={event => setEffectiveTo(event.target.value)} /></label>
          <label>Người duyệt bước đầu<select value={approverId} onChange={event => { setApproverId(event.target.value); if (event.target.value && steps === "[]") setSteps(JSON.stringify([{ order: 1, name: "Duyệt chứng từ", mode: "ANY_ONE", approvers: [{ type: "USER", id: event.target.value }], on_approve: "COMPLETE", on_reject: "REJECT" }], null, 2)); }}><option value="">Chọn để tạo bước mẫu</option>{members.filter(item => item.membership_status === "ACTIVE").map(item => <option key={item.id} value={item.user_id}>{item.full_name} · {item.email}</option>)}</select></label>
          <label>Điều kiện (JSON)<textarea value={conditions} onChange={event => setConditions(event.target.value)} rows={5} /></label><label>Các bước duyệt (JSON)<textarea value={steps} onChange={event => setSteps(event.target.value)} rows={12} required /></label><label className="account-check"><input type="checkbox" checked={allowSelf} onChange={event => setAllowSelf(event.target.checked)} /> Cho phép tự duyệt</label>
        </>}
        <div className="account-actions"><button type="submit" disabled={busy}>Lưu Workflow</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
