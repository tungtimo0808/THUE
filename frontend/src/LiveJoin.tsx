import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type FoundCompany = { id: string; code: string; name: string; tax_code?: string; address?: string };
type JoinRequest = { id: string; company_name: string; status: string; created_at: string; message: string };

export default function LiveJoin() {
  const { token, restoring, signOut } = useApiSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isManualOpen = params.get("manual") === "1";
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundCompany[]>([]);
  const [selected, setSelected] = useState<FoundCompany | null>(null);
  const [invitationCode, setInvitationCode] = useState("");
  const [note, setNote] = useState("");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !isManualOpen) { setRequests([]); return; }
    let active = true;
    request<JoinRequest[]>("/api/v1/common/join-requests/", token)
      .then(value => { if (active) setRequests(value); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được yêu cầu."); });
    return () => { active = false; };
  }, [token, isManualOpen]);

  if (!restoring && !token) {
    return <Navigate to="/login" replace />;
  }

  if (!restoring && token && !isManualOpen) {
    return <Navigate to="/select-company" replace />;
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setSelected(null);
    try {
      const value = await request<FoundCompany[]>(`/api/v1/common/companies/search/?q=${encodeURIComponent(query.trim())}`, token);
      setFound(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không tìm được doanh nghiệp."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const value = await request<JoinRequest>("/api/v1/common/join-requests/", token, {
        method: "POST",
        body: JSON.stringify({ ...(selected ? { company: selected.id } : {}), invitation_code: invitationCode.trim(), message: note.trim() }),
      });
      setRequests(current => [value, ...current]); setSelected(null); setInvitationCode(""); setNote("");
      setMessage("Đã gửi yêu cầu tham gia. Bạn có thể theo dõi trạng thái bên dưới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được yêu cầu."); }
    finally { setBusy(false); }
  }

  async function cancel(item: JoinRequest) {
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await request<JoinRequest>(`/api/v1/common/join-requests/${item.id}/cancel/`, token, { method: "POST", body: "{}" });
      setRequests(current => current.map(row => row.id === item.id ? updated : row));
      setMessage("Đã hủy yêu cầu tham gia.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không hủy được yêu cầu."); }
    finally { setBusy(false); }
  }

  return <main className="account-page">
    <div className="account-card account-wide">
      <Link to="/select-company">← Về không gian làm việc</Link>
      <p className="account-eyebrow">COM-02</p>
      <h1>Tham gia doanh nghiệp</h1>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <button type="button" className="account-text-button" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>Đăng xuất</button>
      <form onSubmit={search}>
        <label>Tìm doanh nghiệp theo tên, mã hoặc mã số thuế<input value={query} onChange={event => setQuery(event.target.value)} minLength={2} required /></label>
        <button type="submit" disabled={busy}>Tìm doanh nghiệp</button>
      </form>
      {found.length > 0 && <div className="account-results" role="region" aria-label="Kết quả tìm doanh nghiệp">{found.map(company =>
        <button type="button" key={company.id} className={selected?.id === company.id ? "selected" : ""} onClick={() => setSelected(company)}>
          <strong>{company.name}</strong><span>{company.code} · {company.tax_code || "Chưa có MST"}</span><span>{company.address}</span>
        </button>,
      )}</div>}
      {query && !busy && !found.length && <p>Không có doanh nghiệp phù hợp. Bạn có thể dùng mã mời.</p>}
      <form className="account-join-form" onSubmit={submit}>
        {selected && <p>Đã chọn: <strong>{selected.name}</strong></p>}
        <label>Mã mời, nếu có<input value={invitationCode} onChange={event => setInvitationCode(event.target.value)} /></label>
        <label>Lời nhắn<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} /></label>
        <button type="submit" disabled={busy || (!selected && !invitationCode.trim())}>Gửi yêu cầu tham gia</button>
      </form>
      <h2>Yêu cầu của tôi</h2>
      {!requests.length ? <p>Chưa có yêu cầu nào.</p> : <ul className="account-request-list">{requests.map(item =>
        <li key={item.id}><div><strong>{item.company_name}</strong><span>{item.status} · {new Date(item.created_at).toLocaleString("vi-VN")}</span></div>
          {item.status === "PENDING" && <button type="button" disabled={busy} onClick={() => cancel(item)}>Hủy yêu cầu</button>}</li>,
      )}</ul>}
    </div>
  </main>;
}
