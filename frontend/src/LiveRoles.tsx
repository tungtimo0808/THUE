import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Role = { id: string; code: string; name: string; description: string; role_type: string; role_class: string; status: string; permission_count: number; active_user_count: number; updated_at: string };
type Impact = { active_user_count: number; active_work_item_count: number; users: { user_id: string; name: string }[]; active_work_items: { id: string; title: string }[] };
type History = { id: string; action: string; actor_name: string; occurred_at: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LiveRoles() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"create" | "edit" | "clone" | "deactivate" | "reactivate" | "impact" | "history" | null>(null);
  const [selected, setSelected] = useState<Role | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setRoles([]); return; }
    let active = true;
    const params = new URLSearchParams({ company_id: companyId });
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    request<Role[] | { results: Role[] }>(`/api/v1/iam/roles/?${params}`, token)
      .then(value => { if (active) setRoles(rows(value)); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được Role."); });
    return () => { active = false; };
  }, [token, companyId, status, query, reload]);

  function open(nextMode: typeof mode, role: Role | null = null) {
    setMode(nextMode); setSelected(role); setCode(nextMode === "clone" ? "" : role?.code || ""); setName(nextMode === "clone" ? "" : role?.name || ""); setDescription(role?.description || ""); setConfirm(false); setImpact(null); setHistory([]); setError(""); setMessage("");
    if (!role) return;
    if (nextMode === "impact" || nextMode === "deactivate") request<Impact>(`/api/v1/iam/roles/${role.id}/impact/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(setImpact).catch(cause => setError(cause instanceof Error ? cause.message : "Không tải được tác động."));
    if (nextMode === "history") request<History[]>(`/api/v1/iam/roles/${role.id}/history/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(setHistory).catch(cause => setError(cause instanceof Error ? cause.message : "Không tải được lịch sử."));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!mode) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const base = `/api/v1/iam/roles/${selected ? `${selected.id}/` : ""}?company_id=${encodeURIComponent(companyId)}`;
      if (mode === "create") await request(base, token, { method: "POST", body: JSON.stringify({ code: code.trim(), name: name.trim(), description: description.trim() }) });
      if (mode === "edit" && selected) await request(base, token, { method: "PATCH", body: JSON.stringify({ version: selected.updated_at, code: code.trim(), name: name.trim(), description: description.trim() }) });
      if (mode === "clone" && selected) await request(`/api/v1/iam/roles/${selected.id}/clone/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify({ version: selected.updated_at, code: code.trim(), name: name.trim(), description: description.trim() }) });
      if ((mode === "deactivate" || mode === "reactivate") && selected) await request(`/api/v1/iam/roles/${selected.id}/${mode}/?company_id=${encodeURIComponent(companyId)}`, token, { method: "POST", body: JSON.stringify({ version: selected.updated_at, confirm }) });
      setMode(null); setSelected(null); setMessage("Đã cập nhật Role."); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được Role."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-06</p><h1>Quản lý Role</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setMode(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      <div className="account-actions"><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng</option></select></label><label>Tìm Role<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => open("create")}>Tạo Role</button><button type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      {!roles.length ? <p>Không có Role phù hợp.</p> : <ul className="account-request-list">{roles.map(role => <li key={role.id}><div><strong>{role.code} · {role.name}</strong><span>{role.role_class} · {role.status} · {role.permission_count} quyền · {role.active_user_count} người dùng</span><span>{role.description}</span></div>
        <div className="account-actions"><button type="button" onClick={() => open("impact", role)}>Tác động</button><button type="button" onClick={() => open("history", role)}>Lịch sử</button>{role.status === "ACTIVE" && <button type="button" onClick={() => open("clone", role)}>Sao chép</button>}{role.role_class === "COMPANY" && <><button type="button" onClick={() => open("edit", role)}>Sửa</button><button type="button" onClick={() => open(role.status === "ACTIVE" ? "deactivate" : "reactivate", role)}>{role.status === "ACTIVE" ? "Ngừng" : "Kích hoạt lại"}</button></>}</div>
      </li>)}</ul>}
      {mode === "impact" && <section className="account-change-email"><h2>Tác động {selected?.code}</h2>{impact && <><p>{impact.active_user_count} người dùng; {impact.active_work_item_count} việc đang mở.</p><ul>{impact.users.map(item => <li key={item.user_id}>{item.name}</li>)}{impact.active_work_items.map(item => <li key={item.id}>{item.title}</li>)}</ul></>}<button type="button" onClick={() => setMode(null)}>Đóng</button></section>}
      {mode === "history" && <section className="account-change-email"><h2>Lịch sử {selected?.code}</h2>{history.length ? <ul>{history.map(item => <li key={item.id}>{item.action} · {item.actor_name} · {new Date(item.occurred_at).toLocaleString("vi-VN")}</li>)}</ul> : <p>Chưa có lịch sử.</p>}<button type="button" onClick={() => setMode(null)}>Đóng</button></section>}
      {mode && !["impact", "history"].includes(mode) && <form className="account-change-email" onSubmit={save}><h2>{mode === "create" ? "Tạo Role" : mode === "edit" ? `Sửa ${selected?.code}` : mode === "clone" ? `Sao chép ${selected?.code}` : mode === "deactivate" ? `Ngừng ${selected?.code}` : `Kích hoạt lại ${selected?.code}`}</h2>
        {["create", "edit", "clone"].includes(mode) ? <><label>Mã Role<input value={code} onChange={event => setCode(event.target.value)} required maxLength={80} /></label><label>Tên Role<input value={name} onChange={event => setName(event.target.value)} required maxLength={255} /></label><label>Mô tả<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} /></label></> : <><p>{impact ? `${impact.active_user_count} người dùng, ${impact.active_work_item_count} việc đang mở chịu tác động.` : "Đang tải tác động..."}</p><label className="account-check"><input type="checkbox" checked={confirm} onChange={event => setConfirm(event.target.checked)} /> Xác nhận thay đổi trạng thái</label></>}
        <div className="account-actions"><button type="submit" disabled={busy || (["deactivate", "reactivate"].includes(mode) && !confirm)}>Xác nhận</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
