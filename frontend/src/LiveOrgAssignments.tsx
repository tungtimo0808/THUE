import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type Member = { id: string; full_name: string; email: string; membership_status: string };
type Unit = { id: string; code: string; name: string; status: string; unit_type: string };
type Position = { id: string; code: string; name: string; status: string };
type Assignment = { id: string; membership: string; unit: string; assignment_type: string; position: string | null; job_title: string; start_date: string; end_date: string | null; status: string; note: string; version: string };
type Preview = { status: string; requires_transfer: boolean; current_primary: { id: string }[] };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });

export default function LiveOrgAssignments() {
  const { token, companies, companyId, selectCompany } = useApiSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [memberId, setMemberId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [assignmentType, setAssignmentType] = useState("PRIMARY");
  const [jobTitle, setJobTitle] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [transfer, setTransfer] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !companyId) return;
    let active = true;
    const load = async <T,>(path: string) => rows(await request<T[] | { results: T[] }>(path, token));
    Promise.allSettled([
      load<Member>(`/api/v1/iam/memberships/?company_id=${companyId}`),
      load<Unit>(`/api/v1/organization/structure/units/?company_id=${companyId}`),
      load<Position>(`/api/v1/organization/positions/?company_id=${companyId}`),
      load<Assignment>(`/api/v1/iam/organization-assignments/?company_id=${companyId}`),
    ]).then(results => { if (!active) return;
      if (results[0].status === "fulfilled") setMembers(results[0].value);
      if (results[1].status === "fulfilled") setUnits(results[1].value);
      if (results[2].status === "fulfilled") setPositions(results[2].value);
      if (results[3].status === "fulfilled") setAssignments(results[3].value);
      else setError(results[3].reason instanceof Error ? results[3].reason.message : "Không tải được phân công.");
    });
    return () => { active = false; };
  }, [token, companyId, reload]);

  function edit(item: Assignment) {
    setEditing(item); setMemberId(item.membership); setUnitId(item.unit); setPositionId(item.position || ""); setAssignmentType(item.assignment_type); setJobTitle(item.job_title); setStartDate(item.start_date); setEndDate(item.end_date || ""); setNote(item.note); setPreview(null); setError(""); setMessage("");
  }
  function reset() {
    setEditing(null); setUnitId(""); setPositionId(""); setAssignmentType("PRIMARY"); setJobTitle(""); setStartDate(today()); setEndDate(""); setNote(""); setTransfer(false); setPreview(null);
  }
  const payload = { company: companyId, membership: memberId, unit: unitId, assignment_type: assignmentType, position: positionId || null, job_title: jobTitle.trim(), start_date: startDate, end_date: endDate || null, note: note.trim(), transfer };
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); setReload(value => value + 1); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không cập nhật được phân công."); return false; }
    finally { setBusy(false); }
  }
  async function previewCreate() {
    if (!memberId || !unitId) return;
    setBusy(true); setError("");
    try { setPreview(await request<Preview>(`/api/v1/iam/organization-assignments/preview/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify(payload) })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xem trước được phân công."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) {
      const ok = await run(() => request(`/api/v1/iam/organization-assignments/${editing.id}/?company_id=${companyId}`, token, { method: "PATCH", body: JSON.stringify({ version: editing.version, position: positionId || null, job_title: jobTitle.trim(), start_date: startDate, end_date: endDate || null, note: note.trim() }) }), "Đã sửa phân công.");
      if (ok) reset();
    } else {
      const ok = await run(() => request(`/api/v1/iam/organization-assignments/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify(payload) }), "Đã phân công người dùng.");
      if (ok) reset();
    }
  }
  async function revoke(item: Assignment) {
    const reason = window.prompt("Lý do kết thúc phân công:");
    if (!reason?.trim()) return;
    await run(() => request(`/api/v1/iam/organization-assignments/${item.id}/revoke/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({ version: item.version, reason: reason.trim() }) }), "Đã kết thúc phân công.");
  }

  return <main className="account-page"><section className="account-card account-wide"><Link to="/login">← Phiên làm việc</Link><p className="account-eyebrow">SYS-09</p><h1>Phân công người dùng vào đơn vị</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); reset(); setMemberId(""); }}>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      <label>Người dùng<select value={memberId} onChange={event => { setMemberId(event.target.value); setPreview(null); }} disabled={Boolean(editing)}><option value="">Chọn người dùng</option>{members.filter(item => item.membership_status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.full_name} · {item.email}</option>)}</select></label>
      <ul className="account-request-list">{assignments.filter(item => !memberId || item.membership === memberId).map(item => <li key={item.id}><div><strong>{members.find(member => member.id === item.membership)?.full_name} · {units.find(unit => unit.id === item.unit)?.name}</strong><span>{item.assignment_type} · {item.status} · {item.start_date}{item.end_date ? ` → ${item.end_date}` : ""}</span><span>{item.job_title}</span></div><div className="account-actions">{item.status !== "REVOKED" && <><button type="button" onClick={() => edit(item)}>Sửa</button><button type="button" onClick={() => revoke(item)}>Kết thúc</button></>}</div></li>)}</ul>
      <form className="account-change-email" onSubmit={submit}><h2>{editing ? "Sửa phân công" : "Tạo phân công"}</h2>
        <label>Đơn vị<select value={unitId} onChange={event => { setUnitId(event.target.value); setPreview(null); }} required disabled={Boolean(editing)}><option value="">Chọn đơn vị</option>{units.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Loại phân công<select value={assignmentType} onChange={event => { setAssignmentType(event.target.value); setPreview(null); }} disabled={Boolean(editing)}><option value="PRIMARY">Chính</option><option value="SECONDARY">Kiêm nhiệm</option><option value="TEMPORARY">Tạm thời</option></select></label>
        <label>Chức vụ<select value={positionId} onChange={event => setPositionId(event.target.value)}><option value="">Chưa chọn</option>{positions.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        <label>Chức danh<input value={jobTitle} onChange={event => setJobTitle(event.target.value)} maxLength={150} /></label>
        <label>Ngày bắt đầu<input type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setPreview(null); }} required /></label><label>Ngày kết thúc<input type="date" value={endDate} min={startDate} onChange={event => { setEndDate(event.target.value); setPreview(null); }} required={assignmentType === "TEMPORARY"} /></label>
        <label>Ghi chú<textarea value={note} onChange={event => setNote(event.target.value)} /></label>
        {!editing && <><button type="button" disabled={busy || !memberId || !unitId} onClick={previewCreate}>Xem trước tác động</button>{preview && <p>Trạng thái: {preview.status}. {preview.requires_transfer ? "Cần chuyển đơn vị chính hiện tại." : "Không cần chuyển đơn vị chính."}</p>}{preview?.requires_transfer && <label className="account-check"><input type="checkbox" checked={transfer} onChange={event => setTransfer(event.target.checked)} /> Xác nhận chuyển đơn vị chính</label>}</>}
        <div className="account-actions"><button type="submit" disabled={busy || !memberId || !unitId || Boolean(preview?.requires_transfer && !transfer)}>{editing ? "Lưu phân công" : "Tạo phân công"}</button>{editing && <button type="button" onClick={reset}>Hủy sửa</button>}</div>
      </form>
    </>}
  </section></main>;
}
