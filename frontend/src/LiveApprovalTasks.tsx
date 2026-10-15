import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Task = { id: string; document_type: string; status: string; version: number; due_at: string | null; source: Record<string, string>; request_status: string; step: number };
type Detail = Task & { history: { action: string; actor_name: string; comment: string; at: string }[]; workflow: { allowed_actions: string[]; steps: unknown[] }; fingerprint_valid: boolean; ai_assistance: { summary: string; warnings: string[]; checkpoints: string[]; disclaimer: string } };
type Member = { id: string; user_id: string; full_name: string; email: string; membership_status: string };
type Delegation = { id: string; delegator_name: string; delegate_name: string; document_type: string | null; start_date: string; end_date: string | null; is_active: boolean };
type Notification = { id: string; event: string; status: string; at: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
const base = "/api/v1/approval-workflows";

export default function LiveApprovalTasks() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("APPROVE");
  const [comment, setComment] = useState("");
  const [changes, setChanges] = useState("");
  const [pin, setPin] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [delegate, setDelegate] = useState("");
  const [delegationDate, setDelegationDate] = useState(today);
  const [delegationEnd, setDelegationEnd] = useState("");
  const [delegationReason, setDelegationReason] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const params = new URLSearchParams({ company_id: companyId, status });
    if (query.trim()) params.set("search", query.trim());
    const load = async <T,>(path: string) => rows(await request<T[] | { results: T[] }>(path, token));
    Promise.allSettled([
      load<Task>(`${base}/tasks/?${params}`),
      load<Member>(`/api/v1/iam/memberships/?company_id=${companyId}`),
      load<Delegation>(`${base}/delegations/?company_id=${companyId}`),
      load<Notification>(`${base}/notifications/?company_id=${companyId}`),
    ]).then(results => { if (!active) return;
      if (results[0].status === "fulfilled") setTasks(results[0].value);
      else setError(results[0].reason instanceof Error ? results[0].reason.message : "Không tải được việc phê duyệt.");
      if (results[1].status === "fulfilled") setMembers(results[1].value);
      if (results[2].status === "fulfilled") setDelegations(results[2].value);
      if (results[3].status === "fulfilled") setNotifications(results[3].value);
    });
    return () => { active = false; };
  }, [token, companyId, status, query, reload]);

  async function open(task: Task) {
    setBusy(true); setError(""); setMessage(""); setAction("APPROVE"); setComment(""); setChanges(""); setPin(""); setTargetUser("");
    try { setDetail(await request<Detail>(`${base}/tasks/${task.id}/?company_id=${companyId}`, token)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được chi tiết việc phê duyệt."); }
    finally { setBusy(false); }
  }
  async function run(actionCall: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await actionCall(); setMessage(success); setReload(value => value + 1); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xử lý được yêu cầu."); return false; }
    finally { setBusy(false); }
  }
  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    const ok = await run(() => request(`${base}/tasks/${detail.id}/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ action, version: detail.version, comment: comment.trim(), changes: changes.trim(), auth_pin: pin.trim(), ...(action === "FORWARD" ? { target_user_id: targetUser } : {}) }) }), "Đã xử lý việc phê duyệt.");
    if (ok) setDetail(null);
  }
  async function bulk(actionName: "APPROVE" | "REJECT") {
    const selected = tasks.filter(item => selectedIds.includes(item.id));
    if (!selected.length) return;
    if (actionName === "REJECT" && !comment.trim()) { setError("Cần nhập lý do từ chối."); return; }
    const ok = await run(async () => {
      const result = await request<{ results: { success: boolean; error?: string }[] }>(`${base}/tasks/bulk-decision/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ decisions: selected.map(item => ({ task_id: item.id, action: actionName, version: item.version, comment: comment.trim(), auth_pin: pin.trim() })) }) });
      const failures = result.results.filter(item => !item.success);
      if (failures.length) throw new Error(`${failures.length} việc thất bại: ${failures.map(item => item.error).join("; ")}`);
    }, "Đã xử lý hàng loạt.");
    if (ok) setSelectedIds([]);
  }
  async function createDelegation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!delegate) return;
    await run(() => request(`${base}/delegations/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ company: companyId, delegate, start_date: delegationDate, end_date: delegationEnd || null, reason: delegationReason.trim() }) }), "Đã tạo ủy quyền phê duyệt.");
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-11</p><h1>Xử lý yêu cầu phê duyệt</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setDetail(null); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <div className="account-actions"><label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="PENDING">Chờ duyệt</option><option value="ALL">Tất cả</option></select></label><label>Tìm chứng từ<input value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={() => setReload(value => value + 1)}>Tải lại</button></div>
      {!tasks.length ? <p>Không có việc phê duyệt phù hợp.</p> : <ul className="account-request-list">{tasks.map(task => <li key={task.id}><div><label className="account-check"><input type="checkbox" checked={selectedIds.includes(task.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} /> Chọn</label><strong>{task.document_type} · {task.source.number || task.source.description || task.id}</strong><span>Bước {task.step} · {task.status} · {task.due_at ? new Date(task.due_at).toLocaleString("vi-VN") : "Không có hạn"}</span></div><button type="button" onClick={() => open(task)}>Chi tiết</button></li>)}</ul>}
      {selectedIds.length > 0 && <section className="account-change-email"><h2>Xử lý {selectedIds.length} việc</h2><label>Ý kiến/lý do<input value={comment} onChange={event => setComment(event.target.value)} /></label><label>Mã xác thực nếu có<input value={pin} onChange={event => setPin(event.target.value)} /></label><div className="account-actions"><button type="button" disabled={busy} onClick={() => bulk("APPROVE")}>Duyệt hàng loạt</button><button type="button" disabled={busy} onClick={() => bulk("REJECT")}>Từ chối hàng loạt</button></div></section>}
      {detail && <section className="account-change-email"><h2>{detail.document_type} · {detail.source.number || detail.id}</h2><p>Trạng thái: {detail.status}. Dữ liệu chứng từ {detail.fingerprint_valid ? "còn khớp" : "đã thay đổi"}.</p><dl>{Object.entries(detail.source).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><h3>Tóm tắt hỗ trợ</h3><p>{detail.ai_assistance.summary}</p>{detail.ai_assistance.warnings.map((item, index) => <p key={index}>{item}</p>)}<h3>Lịch sử</h3><ul>{detail.history.map((item, index) => <li key={index}>{item.action} · {item.actor_name} · {item.comment} · {new Date(item.at).toLocaleString("vi-VN")}</li>)}</ul>
        <form onSubmit={decide}><label>Hành động<select value={action} onChange={event => setAction(event.target.value)}>{detail.workflow.allowed_actions.filter(item => item !== "VIEW_HISTORY").map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>Ý kiến/lý do<textarea value={comment} onChange={event => setComment(event.target.value)} required={["REJECT", "REQUEST_CHANGES", "COMMENT"].includes(action)} maxLength={500} /></label>{action === "REQUEST_CHANGES" && <label>Nội dung cần sửa<textarea value={changes} onChange={event => setChanges(event.target.value)} required maxLength={2000} /></label>}{action === "FORWARD" && <label>Chuyển cho<select value={targetUser} onChange={event => setTargetUser(event.target.value)} required><option value="">Chọn người nhận</option>{members.filter(item => item.membership_status === "ACTIVE").map(item => <option key={item.id} value={item.user_id}>{item.full_name} · {item.email}</option>)}</select></label>}<label>Mã xác thực nếu có<input value={pin} onChange={event => setPin(event.target.value)} /></label><div className="account-actions"><button type="submit" disabled={busy}>Xác nhận xử lý</button><button type="button" onClick={() => setDetail(null)}>Đóng</button></div></form>
      </section>}
      <section className="account-change-email"><h2>Ủy quyền phê duyệt</h2><ul>{delegations.map(item => <li key={item.id}>{item.delegator_name} → {item.delegate_name} · {item.start_date} · {item.is_active ? "Đang hiệu lực" : "Đã hủy"} {item.is_active && <button type="button" disabled={busy} onClick={() => run(() => request(`${base}/delegations/${item.id}/?company_id=${companyId}`, token, { method: "DELETE" }), "Đã hủy ủy quyền.")}>Hủy ủy quyền</button>}</li>)}</ul><form onSubmit={createDelegation}><label>Người được ủy quyền<select value={delegate} onChange={event => setDelegate(event.target.value)} required><option value="">Chọn người dùng</option>{members.filter(item => item.membership_status === "ACTIVE").map(item => <option key={item.id} value={item.user_id}>{item.full_name} · {item.email}</option>)}</select></label><label>Từ ngày<input type="date" value={delegationDate} onChange={event => setDelegationDate(event.target.value)} required /></label><label>Đến ngày<input type="date" value={delegationEnd} min={delegationDate} onChange={event => setDelegationEnd(event.target.value)} /></label><label>Lý do<input value={delegationReason} onChange={event => setDelegationReason(event.target.value)} /></label><button type="submit" disabled={busy || !delegate}>Tạo ủy quyền</button></form></section>
      <section className="account-change-email"><h2>Thông báo phê duyệt</h2><ul>{notifications.map(item => <li key={item.id}>{item.event} · {item.status} · {new Date(item.at).toLocaleString("vi-VN")}</li>)}</ul></section>
    </>}
  </section></main>;
}
