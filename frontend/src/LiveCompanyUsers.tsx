import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Member = { id: string; full_name: string; email: string; phone: string; membership_status: string; account_status: string | null; access_status: string; joined_at: string; updated_at: string; internal_display_name: string; internal_note: string | null; employee: string | null; employee_code: string | null; organization_unit_name: string | null; role_assignments: { role_name: string; data_scope_set_name: string | null }[]; can_update: boolean };
type Employee = { id: string; employee_code: string; full_name: string };
type History = { id: string; action: string; actor_name: string; occurred_at: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LiveCompanyUsers() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<Member | null>(null);
  const [mode, setMode] = useState<"detail" | "edit" | "history" | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [note, setNote] = useState("");
  const [employee, setEmployee] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) { setMembers([]); return; }
    let active = true;
    const params = new URLSearchParams({ company_id: companyId });
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    request<Member[] | { results: Member[] }>(`/api/v1/iam/memberships/?${params}`, token)
      .then(value => { if (active) setMembers(rows(value)); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được thành viên."); });
    return () => { active = false; };
  }, [token, companyId, status, query, reload]);

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    request<Employee[] | { results: Employee[] }>(`/api/v1/organization/employees/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(value => { if (active) setEmployees(rows(value)); }).catch(() => setEmployees([]));
    return () => { active = false; };
  }, [token, companyId]);

  function open(member: Member, nextMode: typeof mode) {
    setSelected(member); setMode(nextMode); setDisplayName(member.internal_display_name || ""); setNote(member.internal_note || ""); setEmployee(member.employee || ""); setConfirmUnlink(false); setError(""); setMessage(""); setHistory([]);
    if (nextMode === "history") request<History[]>(`/api/v1/iam/memberships/${member.id}/history/?company_id=${encodeURIComponent(companyId)}`, token)
      .then(setHistory).catch(cause => setError(cause instanceof Error ? cause.message : "Không tải được lịch sử."));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await request<Member>(`/api/v1/iam/memberships/${selected.id}/?company_id=${encodeURIComponent(companyId)}`, token, {
        method: "PATCH", body: JSON.stringify({ version: selected.updated_at, internal_display_name: displayName.trim(), internal_note: note.trim(),
          ...(employee !== (selected.employee || "") ? { employee: employee || null, confirm_unlink: confirmUnlink } : {}) }),
      });
      setSelected(updated); setMode("detail"); setMessage("Đã cập nhật hồ sơ người dùng."); setReload(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được hồ sơ."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-05</p><h1>Người dùng trong doanh nghiệp</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setMode(null); }}>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      <div className="account-actions"><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option><option value="ENDED">Đã ngừng</option></select></label>
        <label>Tìm người dùng<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      {!members.length ? <p>Không có người dùng phù hợp.</p> : <ul className="account-request-list">{members.map(member => <li key={member.id}>
        <div><strong>{member.internal_display_name || member.full_name}</strong><span>{member.email} · {member.membership_status} · {member.account_status || member.access_status}</span><span>{member.organization_unit_name || "Chưa phân đơn vị"} · {member.role_assignments.map(item => item.role_name).join(", ") || "Chưa có Role"}</span></div>
        <div className="account-actions"><button type="button" onClick={() => open(member, "detail")}>Chi tiết</button><button type="button" onClick={() => open(member, "history")}>Lịch sử</button>{member.can_update && <button type="button" onClick={() => open(member, "edit")}>Sửa</button>}</div>
      </li>)}</ul>}
      {selected && mode === "detail" && <section className="account-change-email"><h2>{selected.full_name}</h2><p>{selected.email} · {selected.phone || "Chưa có số điện thoại"}</p><p>Nhân viên: {selected.employee_code || "Chưa liên kết"}</p><p>Đơn vị: {selected.organization_unit_name || "Chưa phân công"}</p><p>Role: {selected.role_assignments.map(item => `${item.role_name}${item.data_scope_set_name ? ` (${item.data_scope_set_name})` : ""}`).join(", ") || "Chưa có"}</p><p>Ghi chú: {selected.internal_note || "Không có"}</p><button type="button" onClick={() => setMode(null)}>Đóng</button></section>}
      {selected && mode === "history" && <section className="account-change-email"><h2>Lịch sử {selected.full_name}</h2>{history.length ? <ul>{history.map(item => <li key={item.id}>{item.action} · {item.actor_name} · {new Date(item.occurred_at).toLocaleString("vi-VN")}</li>)}</ul> : <p>Chưa có lịch sử.</p>}<button type="button" onClick={() => setMode(null)}>Đóng</button></section>}
      {selected && mode === "edit" && <form className="account-change-email" onSubmit={save}><h2>Sửa {selected.full_name}</h2>
        <label>Tên hiển thị nội bộ<input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={255} /></label>
        <label>Ghi chú nội bộ<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label>
        <label>Liên kết nhân viên<select value={employee} onChange={event => setEmployee(event.target.value)}><option value="">Chưa liên kết</option>{employees.map(item => <option key={item.id} value={item.id}>{item.employee_code} · {item.full_name}</option>)}</select></label>
        {selected.employee && !employee && <label className="account-check"><input type="checkbox" checked={confirmUnlink} onChange={event => setConfirmUnlink(event.target.checked)} /> Xác nhận bỏ liên kết nhân viên</label>}
        <div className="account-actions"><button type="submit" disabled={busy || Boolean(selected.employee && !employee && !confirmUnlink)}>Lưu hồ sơ</button><button type="button" onClick={() => setMode(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
