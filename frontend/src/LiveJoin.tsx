import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

type FoundCompany = { id: string; code: string; name: string; tax_code?: string; address?: string };
type JoinRequest = {
  id: string;
  company_code?: string;
  company_name: string;
  company_tax_code?: string;
  company_address?: string;
  status: string;
  status_display?: string;
  created_at: string;
  expires_at?: string | null;
  decided_at?: string | null;
  decided_by_name?: string | null;
  decision_reason?: string;
  message: string;
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PENDING: { label: "Chờ xử lý", bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  APPROVED: { label: "Đã duyệt", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  REJECTED: { label: "Từ chối", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
  CANCELLED: { label: "Đã hủy", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  EXPIRED: { label: "Đã hết hạn", bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

export default function LiveJoin() {
  const { token, restoring, signOut, refreshCompanies } = useApiSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isManualOpen = params.get("manual") === "1";
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<FoundCompany[]>([]);
  const [selected, setSelected] = useState<FoundCompany | null>(null);
  const [invitationCode, setInvitationCode] = useState("");
  const [note, setNote] = useState("");
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [reloadCount, setReloadCount] = useState(0);
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
  }, [token, isManualOpen, reloadCount]);

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
      if (value.status === "APPROVED") {
        await refreshCompanies();
        setMessage("Mã mời tự động phê duyệt! Bạn đã trở thành thành viên doanh nghiệp.");
      } else {
        setMessage("Đã gửi yêu cầu tham gia. Bạn có thể theo dõi trạng thái bên dưới.");
      }
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link to="/select-company">← Về không gian làm việc</Link>
        <button type="button" className="account-text-button" style={{ marginTop: 0 }} onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>Đăng xuất</button>
      </div>
      <p className="account-eyebrow">DOANH NGHIỆP</p>
      <h1>Tham gia doanh nghiệp</h1>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      <form onSubmit={search}>
        <label>Tìm doanh nghiệp theo tên, mã hoặc mã số thuế<input value={query} onChange={event => setQuery(event.target.value)} minLength={2} placeholder="Nhập tên công ty, mã DN hoặc MST (tối thiểu 2 ký tự)..." required /></label>
        <button type="submit" disabled={busy}>Tìm doanh nghiệp</button>
      </form>
      {found.length > 0 && <div className="account-results" role="region" aria-label="Kết quả tìm doanh nghiệp">{found.map(company =>
        <button type="button" key={company.id} className={selected?.id === company.id ? "selected" : ""} onClick={() => setSelected(company)}>
          <strong>{company.name}</strong>
          <span>Mã DN: {company.code} · MST: {company.tax_code || "Chưa có MST"}</span>
          {company.address && <span>Địa chỉ: {company.address}</span>}
        </button>,
      )}</div>}
      {query && !busy && !found.length && <p>Không có doanh nghiệp phù hợp. Bạn có thể dùng mã mời.</p>}
      <form className="account-join-form" onSubmit={submit}>
        {selected && (
          <div style={{ padding: "12px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, color: "#0369a1" }}>Đã chọn: <strong>{selected.name}</strong></p>
              <span style={{ display: "block", fontSize: 12.5, color: "#475569", marginTop: 4 }}>
                Mã DN: <strong>{selected.code}</strong> · MST: <strong>{selected.tax_code || "—"}</strong>
                {selected.address ? ` · ${selected.address}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{ background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", padding: "4px 10px", fontSize: 12, fontWeight: 600 }}
            >
              Bỏ chọn
            </button>
          </div>
        )}
        <label>Mã mời, nếu có<input value={invitationCode} onChange={event => setInvitationCode(event.target.value)} placeholder="Nhập mã mời từ Admin doanh nghiệp (nếu có)..." /></label>
        <label>Lời nhắn<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Giới thiệu ngắn gọn họ tên, bộ phận/vị trí công việc bạn xin gia nhập (tối đa 500 ký tự)..." /></label>
        <button type="submit" disabled={busy || (!selected && !invitationCode.trim())}>Gửi yêu cầu tham gia</button>
      </form>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Yêu cầu của tôi ({requests.length})</h2>
        <button
          type="button"
          onClick={() => setReloadCount(c => c + 1)}
          disabled={busy}
          style={{ background: "#f8fafc", color: "#1763ab", border: "1px solid #cbd5e1", padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}
        >
          Làm mới trạng thái
        </button>
      </div>
      {!requests.length ? <p>Chưa có yêu cầu nào.</p> : <ul className="account-request-list">{requests.map(item => {
        const badge = STATUS_LABELS[item.status] || { label: item.status_display || item.status, bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
        return (
          <li key={item.id} style={{ alignItems: "flex-start", flexDirection: "column", gap: 10, padding: "14px 16px" }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15, color: "#0f172a" }}>{item.company_name}</strong>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 9px",
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
                <span style={{ marginTop: 4 }}>
                  {item.company_code && <>Mã DN: <strong>{item.company_code}</strong> · </>}
                  {item.company_tax_code && <>MST: <strong>{item.company_tax_code}</strong> · </>}
                  Gửi lúc: {new Date(item.created_at).toLocaleString("vi-VN")}
                  {item.status === "PENDING" && item.expires_at && (
                    <> · Hết hạn: {new Date(item.expires_at).toLocaleDateString("vi-VN")}</>
                  )}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {item.status === "PENDING" && (
                  <button type="button" disabled={busy} onClick={() => cancel(item)}>Hủy yêu cầu</button>
                )}
                {item.status === "APPROVED" && (
                  <button
                    type="button"
                    style={{ background: "#059669", color: "#ffffff", border: "1px solid #047857", padding: "7px 12px", fontSize: 12.5 }}
                    onClick={async () => {
                      await refreshCompanies();
                      navigate("/select-company");
                    }}
                  >
                    Vào không gian làm việc →
                  </button>
                )}
              </div>
            </div>

            {(item.message || item.decision_reason || item.decided_at) && (
              <div style={{ width: "100%", paddingTop: 8, borderTop: "1px dashed #e2e8f0", fontSize: 13, color: "#334155", display: "grid", gap: 4 }}>
                {item.message && (
                  <div><strong style={{ color: "#475569" }}>Lời nhắn đã gửi:</strong> {item.message}</div>
                )}
                {item.decision_reason && (
                  <div>
                    <strong style={{ color: item.status === "REJECTED" ? "#b91c1c" : "#047857" }}>
                      {item.status === "REJECTED" ? "Lý do từ chối:" : "Ghi chú phê duyệt:"}
                    </strong>{" "}
                    {item.decision_reason}
                  </div>
                )}
                {item.decided_at && (
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Xử lý lúc: {new Date(item.decided_at).toLocaleString("vi-VN")}
                    {item.decided_by_name ? ` bởi ${item.decided_by_name}` : ""}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}</ul>}
    </div>
  </main>;
}
