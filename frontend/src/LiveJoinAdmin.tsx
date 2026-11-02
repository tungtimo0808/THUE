import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type JoinRequest = {
  id: string;
  requester_name: string;
  requester_email?: string;
  requester_phone?: string;
  message: string;
  status: string;
  status_display?: string;
  created_at: string;
  expires_at: string | null;
  decided_at?: string | null;
  decided_by_name?: string | null;
  decision_reason: string;
  internal_note: string;
};
type Choice = { id: string; name: string; code: string; status?: string; unit_type?: string };
const rows = <T,>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PENDING: { label: "Chờ xử lý", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  APPROVED: { label: "Đã duyệt", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  REJECTED: { label: "Từ chối", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  CANCELLED: { label: "Đã hủy", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  EXPIRED: { label: "Hết hạn", bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

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
    setSelected(item);
    setDecision(nextDecision);
    setReason("");
    setNote("");
    const defaultRole = roles.find(r => r.status === "ACTIVE" && r.code !== "COMPANY_ADMIN" && r.code !== "ADMIN");
    setRole(defaultRole ? defaultRole.id : "");
    setScope("");
    setUnit("");
    setReactivate(false);
    setError("");
    setMessage("");
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <Link to="/admin">← Về Quản trị Doanh nghiệp</Link>
      <Link to="/select-company">Không gian làm việc →</Link>
    </div>
    <p className="account-eyebrow">QUẢN TRỊ DOANH NGHIỆP</p><h1>Yêu cầu tham gia doanh nghiệp</h1>
    {!token ? <p>Vui lòng <Link to="/login">đăng nhập</Link>.</p> : !companies.length ? <p>Chưa có doanh nghiệp.</p> : <>
      <label>Doanh nghiệp<select value={companyId} onChange={event => { selectCompany(event.target.value); setSelected(null); }}>
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select></label>
      <div className="account-actions" style={{ marginTop: 12, marginBottom: 14 }}>
        <label style={{ flex: 1, minWidth: 160 }}>Trạng thái<select value={status} onChange={event => setStatus(event.target.value)}><option value="PENDING">Chờ xử lý</option><option value="">Tất cả</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="CANCELLED">Đã hủy</option><option value="EXPIRED">Hết hạn</option></select></label>
        <label style={{ flex: 2, minWidth: 220 }}>Tìm người gửi (Tên, Email, SĐT)<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nhập tên, email hoặc số điện thoại..." /></label>
        <button type="button" style={{ alignSelf: "flex-end" }} onClick={() => setReload(value => value + 1)}>Tải lại</button>
      </div>
      {error && <p className="account-error" role="alert">{error}</p>}{message && <p className="account-message" role="status">{message}</p>}
      {!items.length ? <p>Không có yêu cầu phù hợp.</p> : <ul className="account-request-list">{items.map(item => {
        const badge = STATUS_BADGE[item.status] || { label: item.status_display || item.status, bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
        return (
          <li key={item.id} style={{ alignItems: "flex-start", padding: "14px 16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 15, color: "#0f172a" }}>{item.requester_name}</strong>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.border}`,
                  }}
                >
                  {item.status_display || badge.label}
                </span>
              </div>
              <span style={{ marginTop: 4, color: "#334155", fontWeight: 500 }}>
                Email: <strong>{item.requester_email || "—"}</strong>
                {item.requester_phone ? <> · SĐT: <strong>{item.requester_phone}</strong></> : null}
              </span>
              <span style={{ marginTop: 2 }}>
                Gửi lúc: {new Date(item.created_at).toLocaleString("vi-VN")}
                {item.expires_at ? ` · Hạn xử lý: ${new Date(item.expires_at).toLocaleDateString("vi-VN")}` : ""}
              </span>
              {item.message && <span style={{ marginTop: 6, color: "#1e293b" }}><strong>Lời nhắn:</strong> {item.message}</span>}
              {item.decision_reason && <span style={{ marginTop: 4, color: item.status === "REJECTED" ? "#b91c1c" : "#047857" }}><strong>Lý do xử lý:</strong> {item.decision_reason}</span>}
              {item.internal_note && <span style={{ marginTop: 2, color: "#64748b" }}><strong>Ghi chú nội bộ:</strong> {item.internal_note}</span>}
              {item.decided_at && (
                <span style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
                  Đã xử lý lúc: {new Date(item.decided_at).toLocaleString("vi-VN")}
                  {item.decided_by_name ? ` bởi ${item.decided_by_name}` : ""}
                </span>
              )}
            </div>
            {item.status === "PENDING" && (
              <div className="account-actions">
                <button type="button" style={{ background: "#059669", color: "#fff", border: "1px solid #047857" }} onClick={() => choose(item, "APPROVED")}>Chấp thuận</button>
                <button type="button" style={{ background: "#fff", color: "#b91c1c", border: "1px solid #fca5a5" }} onClick={() => choose(item, "REJECTED")}>Từ chối</button>
              </div>
            )}
          </li>
        );
      })}</ul>}
      {selected && <form className="account-change-email" onSubmit={submit}>
        <h2>{decision === "APPROVED" ? "Chấp thuận" : "Từ chối"} {selected.requester_name}</h2>
        <p style={{ margin: "0 0 8px", fontSize: 13.5, color: "#475569" }}>
          Email: <strong>{selected.requester_email || "—"}</strong>
          {selected.requester_phone ? <> · SĐT: <strong>{selected.requester_phone}</strong></> : null}
        </p>
        <label>Lý do{decision === "REJECTED" ? " (bắt buộc)" : ""}<textarea value={reason} onChange={event => setReason(event.target.value)} required={decision === "REJECTED"} maxLength={1000} placeholder={decision === "APPROVED" ? "Nhập ghi chú/lý do chấp thuận (không bắt buộc)..." : "Nhập lý do từ chối yêu cầu tham gia (bắt buộc)..."} /></label>
        <label>Ghi chú nội bộ<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="Ghi chú lưu nội bộ dành cho Admin (người gửi không nhìn thấy)..." /></label>
        {decision === "APPROVED" && <>
          <label>Vai trò ban đầu<select value={role} onChange={event => { setRole(event.target.value); setScope(""); }}><option value="">Vai trò mặc định</option>{roles.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {role && <label>Phạm vi dữ liệu<select value={scope} onChange={event => setScope(event.target.value)}><option value="">Toàn doanh nghiệp</option>{scopes.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <label>Đơn vị / Phòng ban<select value={unit} onChange={event => setUnit(event.target.value)}><option value="">Chưa phân công</option>{units.filter(item => item.status === "ACTIVE").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="account-check"><input type="checkbox" checked={reactivate} onChange={event => setReactivate(event.target.checked)} /> Kích hoạt lại nếu đã từng là thành viên</label>
        </>}
        <div className="account-actions"><button type="submit" disabled={busy}>Xác nhận</button><button type="button" onClick={() => setSelected(null)}>Hủy</button></div>
      </form>}
    </>}
  </section></main>;
}
