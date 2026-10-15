import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type JoinRequest = { id: string; requester_name: string; message: string; status: string; created_at: string; expires_at: string | null; decision_reason: string; internal_note: string };
type Choice = { id: string; name: string; code: string; status?: string; unit_type?: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LiveJoinAdmin() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [items, setItems] = useState<JoinRequest[]>([]);
  const [roles, setRoles] = useState<Choice[]>([]);
  const [scopes, setScopes] = useState<Choice[]>([]);
  const [units, setUnits] = useState<Choice[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<JoinRequest | null>(null);
  const [decision, setDecision] = useState("APPROVED");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("");
  const [scope, setScope] = useState("");
  const [unit, setUnit] = useState("");
  const [reactivate, setReactivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setItems([]); return; }
    let active = true;
    const params = new URLSearchParams({ company_id: companyId });
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    request<JoinRequest[] | { results: JoinRequest[] }>(`/api/v1/common/company-join-requests/?${params}`, token)
      .then(value => { if (active) setItems(rows(value)); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được yêu cầu."); });
    return () => { active = false; };
  }, [token, companyId, status, query, reload]);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const load = async (path: string) => rows(await request<Choice[] | { results: Choice[] }>(`${path}?company_id=${encodeURIComponent(companyId)}`, token));
    Promise.allSettled([load("/api/v1/iam/roles/"), load("/api/v1/iam/data-scopes/"), load("/api/v1/organization/structure/units/")])
      .then(results => { if (!active) return;
        if (results[0].status === "fulfilled") setRoles(results[0].value);
        if (results[1].status === "fulfilled") setScopes(results[1].value);
        if (results[2].status === "fulfilled") setUnits(results[2].value);
      });
    return () => { active = false; };
  }, [token, companyId]);

  function choose(item: JoinRequest, nextDecision: string) {
    setSelected(item); setDecision(nextDecision); setReason(""); setNote(""); setRole(""); setScope(""); setUnit(""); setReactivate(false); setError(""); setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = { company: companyId, decision, reason: reason.trim(), internal_note: note.trim(),
        ...(decision === "APPROVED" ? { ...(role ? { role_assignments: [{ role, ...(scope ? { data_scope_set: scope } : {}) }] } : {}),
          ...(unit ? { organization_unit: unit } : {}), reactivate_membership: reactivate } : {}) };
      await request(`/api/v1/common/company-join-requests/${selected.id}/decide/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify(body) });
      setSelected(null); setMessage(decision === "APPROVED" ? "Đã chấp thuận yêu cầu và tạo thành viên." : "Đã từ chối yêu cầu."); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xử lý được yêu cầu."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-04</p><h1>Yêu cầu tham gia doanh nghiệp</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setSelected(null); }}>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      <div className="account-actions"><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="PENDING">Chờ xử lý</option><option value="">Tất cả</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="EXPIRED">Hết hạn</option></select></label>
        <label>Tìm người gửi<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      {!items.length ? <p>Không có yêu cầu phù hợp.</p> : <ul className="account-request-list">{items.map(item => <li key={item.id}>
        <div><strong>{item.requester_name}</strong><span>{item.status} · {new Date(item.created_at).toLocaleString("vi-VN")}</span><span>{item.message}</span>{item.decision_reason && <span>Lý do: {item.decision_reason}</span>}</div>
        {item.status === "PENDING" && <div className="account-actions"><button type="button" onClick={() => choose(item, "APPROVED")}>Chấp thuận</button><button type="button" onClick={() => choose(item, "REJECTED")}>Từ chối</button></div>}
      </li>)}</ul>}
      {selected && <form className="account-change-email" onSubmit={submit}>
        <h2>{decision === "APPROVED" ? "Chấp thuận" : "Từ chối"} {selected.requester_name}</h2>
        <label>Lý do{decision === "REJECTED" ? " (bắt buộc)" : ""}<textarea value={reason} onChange={event => setReason(event.target.value)} required={decision === "REJECTED"} maxLength={1000} /></label>
        <label>Ghi chú nội bộ<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label>
        {decision === "APPROVED" && <>
          <label>Role ban đầu<select value={role} onChange={event => { setRole(event.target.value); setScope(""); }}><option value="">Role mặc định</option>{roles.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          {role && <label>Data Scope<select value={scope} onChange={event => setScope(event.target.value)}><option value="">Toàn doanh nghiệp</option>{scopes.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>}
          <label>Đơn vị<select value={unit} onChange={event => setUnit(event.target.value)}><option value="">Chưa phân công</option>{units.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
          <label className="account-check"><input type="checkbox" checked={reactivate} onChange={event => setReactivate(event.target.checked)} /> Kích hoạt lại nếu đã từng là thành viên</label>
        </>}
        <div className="account-actions"><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setSelected(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
