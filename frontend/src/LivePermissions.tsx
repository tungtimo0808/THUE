import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Role = { id: string; code: string; name: string; status: string };
type Member = { id: string; full_name: string; email: string; membership_status: string };
type Permission = { id: string; code: string; description: string };
type Assignment = { id: string; company_membership: string; role: string; data_scope_set: string | null; status: string };
type Override = { id: string; membership_id: string; permission_code: string; effect: string; reason: string; revoked_at: string | null };
type Matrix = { version: string; permission_codes: string[]; affected_users: number };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

export default function LivePermissions() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [directEnabled, setDirectEnabled] = useState<boolean | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [roleId, setRoleId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [permissionCode, setPermissionCode] = useState("");
  const [effect, setEffect] = useState("DENY");
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const load = async <T,>(path: string) => rows(await request<T[] | { results: T[] }>(path, token));
    Promise.allSettled([
      load<Role>(`/api/v1/iam/roles/?company_id=${companyId}`),
      load<Member>(`/api/v1/iam/memberships/?company_id=${companyId}`),
      load<Permission>(`/api/v1/iam/permissions/?company_id=${companyId}`),
      load<Assignment>(`/api/v1/iam/role-assignments/?company_id=${companyId}`),
      load<Override>(`/api/v1/iam/permission-overrides/?company_id=${companyId}`),
    ]).then(results => { if (!active) return;
      if (results[0].status === "fulfilled") setRoles(results[0].value);
      if (results[1].status === "fulfilled") setMembers(results[1].value);
      if (results[2].status === "fulfilled") setPermissions(results[2].value);
      else setError(results[2].reason instanceof Error ? results[2].reason.message : "Không tải được danh mục Permission.");
      if (results[3].status === "fulfilled") setAssignments(results[3].value);
      if (results[4].status === "fulfilled") setOverrides(results[4].value);
    });
    return () => { active = false; };
  }, [token, companyId, reload]);

  useEffect(() => {
    if (!token || !companyId) { setDirectEnabled(null); return; }
    let active = true;
    request<{ configuration: Record<string, unknown> }>(`/api/v1/common/settings/?company_id=${companyId}`, token)
      .then(value => { if (active) setDirectEnabled(value.configuration.direct_user_permissions_enabled === true); })
      .catch(() => { if (active) setDirectEnabled(null); });
    return () => { active = false; };
  }, [token, companyId, reload]);

  useEffect(() => {
    if (!token || !companyId || !roleId) { setMatrix(null); return; }
    let active = true;
    request<Matrix>(`/api/v1/iam/roles/${roleId}/matrix/?company_id=${companyId}`, token)
      .then(value => { if (active) { setMatrix(value); setCodes(value.permission_codes); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được ma trận quyền."); });
    return () => { active = false; };
  }, [token, companyId, roleId, reload]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); setReload(value => value + 1); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được phân quyền."); }
    finally { setBusy(false); }
  }

  function saveMatrix(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!matrix || !roleId) return;
    run(() => request(`/api/v1/iam/roles/${roleId}/set-matrix/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ version: matrix.version, permission_codes: codes, bundle_ids: [] }) }), "Đã lưu quyền của Role.");
  }
  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!memberId || !roleId) return;
    run(() => request(`/api/v1/iam/role-assignments/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company_membership: memberId, role: roleId, reason: reason.trim() }) }), "Đã gán Role.");
  }
  function addOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!memberId || !permissionCode || !reason.trim()) return;
    run(() => request(`/api/v1/iam/permission-overrides/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company_membership: memberId, permission_code: permissionCode, effect, reason: reason.trim() }) }), "Đã lưu quyền trực tiếp.");
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-07</p><h1>Phân quyền Role và User</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setRoleId(""); setMemberId(""); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <label>Role<select value={roleId} onChange={event => setRoleId(event.target.value)}><option value="">Chọn Role</option>{roles.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      {matrix && <form className="account-change-email" onSubmit={saveMatrix}><h2>Quyền của Role</h2><p>{matrix.affected_users} người dùng chịu tác động.</p><div className="account-results" style={{ maxHeight: 300, overflow: "auto" }}>{permissions.map(item => <label key={item.id} className="account-check"><input type="checkbox" checked={codes.includes(item.code)} onChange={event => setCodes(current => event.target.checked ? [...current, item.code] : current.filter(code => code !== item.code))} /> {item.code} · {item.description}</label>)}</div><button type="submit" disabled={busy}>Lưu quyền Role</button></form>}
      <label>Người dùng<select value={memberId} onChange={event => setMemberId(event.target.value)}><option value="">Chọn người dùng</option>{members.filter(item => item.membership_status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.full_name} · {item.email}</option>)}</select></label>
      {memberId && <><form className="account-change-email" onSubmit={assign}><h2>Gán Role</h2><label>Lý do<input value={reason} onChange={event => setReason(event.target.value)} /></label><button type="submit" disabled={busy || !roleId}>Gán Role đã chọn</button></form>
        <h2>Role đang gán</h2><ul className="account-request-list">{assignments.filter(item => item.company_membership === memberId && item.status === "ACTIVE").map(item => <li key={item.id}><span>{roles.find(role => role.id === item.role)?.name || item.role}</span><button type="button" disabled={busy} onClick={() => run(() => request(`/api/v1/iam/role-assignments/${item.id}/revoke/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ reason: reason.trim() || "Thu hồi qua giao diện" }) }), "Đã thu hồi Role.")}>Thu hồi</button></li>)}</ul>
        <form className="account-change-email" onSubmit={addOverride}><h2>Quyền trực tiếp</h2>{directEnabled === false && <p>Doanh nghiệp chưa bật quyền trực tiếp trong Cài đặt doanh nghiệp.</p>}<label>Permission<select value={permissionCode} onChange={event => setPermissionCode(event.target.value)}><option value="">Chọn Permission</option>{permissions.map(item => <option key={item.id} value={item.code}>{item.code}</option>)}</select></label><label>Hiệu lực<select value={effect} onChange={event => setEffect(event.target.value)}><option value="DENY">Từ chối</option><option value="GRANT">Cấp</option></select></label><label>Lý do<input value={reason} onChange={event => setReason(event.target.value)} required /></label><button type="submit" disabled={busy || directEnabled === false || !permissions.length}>Lưu quyền trực tiếp</button></form>
        <ul className="account-request-list">{overrides.filter(item => item.membership_id === memberId && !item.revoked_at).map(item => <li key={item.id}><span>{item.effect} · {item.permission_code} · {item.reason}</span><button type="button" disabled={busy} onClick={() => run(() => request(`/api/v1/iam/permission-overrides/${item.id}/revoke/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ reason: reason.trim() || "Thu hồi qua giao diện" }) }), "Đã thu hồi quyền trực tiếp.")}>Thu hồi</button></li>)}</ul>
      </>}
    </>}
  </section></main>;
}
