import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { LegalPolicyModal, type LegalDocTab } from "./AuthLayout";
import { request } from "./live-api";
import "./live-account.css";

type Profile = { id: string; email: string; display_name: string; phone: string; first_name: string; last_name: string; updated_at: string; avatar_url: string | null };

export default function LiveProfile() {
  const { token, signOut } = useApiSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [legalTab, setLegalTab] = useState<LegalDocTab | null>(null);

  useEffect(() => {
    if (!token) { setProfile(null); return; }
    let active = true;
    request<Profile>("/api/v1/common/profile/", token)
      .then(value => { if (active) { setProfile(value); setName(value.display_name); setPhone(value.phone || ""); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Không tải được hồ sơ."); });
    return () => { active = false; };
  }, [token]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const value = await request<Profile>("/api/v1/common/profile/", token, {
        method: "PATCH", body: JSON.stringify({ display_name: name.trim(), phone: phone.trim(), version: profile.updated_at }),
      });
      setProfile(value); setName(value.display_name); setPhone(value.phone || "");
      setMessage("Đã cập nhật hồ sơ.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được hồ sơ."); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next !== confirm) { setError("Mật khẩu xác nhận không khớp."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      await request<{ changed: boolean }>("/api/v1/common/auth/change-password/", token, {
        method: "POST", body: JSON.stringify({ current_password: current, new_password: next, new_password_confirm: confirm }),
      });
      setCurrent(""); setNext(""); setConfirm(""); setMessage("Đã đổi mật khẩu.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được mật khẩu."); }
    finally { setBusy(false); }
  }

  async function confirmEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailToken.trim()) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await request("/api/v1/common/profile/confirm-email/", token, {
        method: "POST", body: JSON.stringify({ token: emailToken.trim(), code: emailToken.trim() }),
      });
      setEmailToken("");
      setMessage("Đã xác nhận địa chỉ email mới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xác nhận được email."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card account-wide">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <Link to="/" style={{ color: "#0284c7", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>← Bàn làm việc Kế toán</Link>
      <Link to="/session" style={{ color: "#64748b", fontSize: 13, textDecoration: "none" }}>Phiên làm việc</Link>
    </div>
    <p className="account-eyebrow">TÀI KHOẢN CÁ NHÂN</p>
    <h1>Hồ sơ cá nhân</h1>
    {!token ? <p>Bạn cần <Link to="/login">đăng nhập</Link> để xem hồ sơ.</p> : <>
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {!profile ? <p>Đang tải hồ sơ...</p> : <>
        <p>Email: <strong>{profile.email}</strong></p>
        <form onSubmit={save}>
          <label>Họ và tên<input value={name} onChange={event => setName(event.target.value)} required /></label>
          <label>Số điện thoại<input value={phone} onChange={event => setPhone(event.target.value)} type="tel" /></label>
          <button type="submit" disabled={busy}>Lưu hồ sơ</button>
        </form>
        <form className="account-change-email" onSubmit={changePassword}>
          <h2>Đổi mật khẩu</h2>
          <label>Mật khẩu hiện tại<input type="password" value={current} onChange={event => setCurrent(event.target.value)} autoComplete="current-password" required /></label>
          <label>Mật khẩu mới<input type="password" value={next} onChange={event => setNext(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          <label>Xác nhận mật khẩu mới<input type="password" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
          <button type="submit" disabled={busy}>Đổi mật khẩu</button>
        </form>
        <form className="account-change-email" onSubmit={confirmEmailChange}>
          <h2>Xác nhận đổi Email</h2>
          <label>Mã xác nhận email mới<input value={emailToken} onChange={event => setEmailToken(event.target.value)} placeholder="Nhập mã xác thực email" required /></label>
          <button type="submit" disabled={busy}>Xác nhận Email</button>
        </form>
        <div className="account-change-email" style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
          <h2>Quyền của Chủ thể dữ liệu (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP)</h2>
          <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.55, margin: "6px 0 12px" }}>
            Theo Điều 4 và Điều 10 Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, bạn có quyền tải bản sao dữ liệu cá nhân, yêu cầu chỉnh sửa, rút lại sự đồng ý hoặc hạn chế xử lý dữ liệu (thời hạn phản hồi tiếp nhận: 02 ngày làm việc; cung cấp/chỉnh sửa: 10 ngày; rút đồng ý/hạn chế xử lý: 15 ngày; xóa dữ liệu ngoài phạm vi lưu trữ kế toán bắt buộc: 20 ngày theo Điều 5 NĐ 356/2025/NĐ-CP).
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <button
              type="button"
              className="account-text-button"
              onClick={() => {
                const payload = {
                  exported_at: new Date().toISOString(),
                  legal_basis: "Điều 4 Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15",
                  profile,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `du-lieu-ca-nhan-${profile.id.slice(0, 8)}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                setMessage("Đã tải xuống bản sao dữ liệu cá nhân của bạn.");
              }}
            >
              Tải bản sao dữ liệu cá nhân (JSON)
            </button>
            <button
              type="button"
              className="account-text-button"
              onClick={() => setLegalTab("privacy")}
            >
              Xem Chính sách BVDLCN
            </button>
            <button
              type="button"
              className="account-text-button"
              onClick={() =>
                setMessage(
                  "Đã ghi nhận yêu cầu quyền chủ thể dữ liệu. Bộ phận Bảo vệ Dữ liệu Cá nhân (dpo@soviet-erp.vn) sẽ phản hồi xác nhận trong vòng 02 ngày làm việc theo Điều 5 Nghị định 356/2025/NĐ-CP."
                )
              }
            >
              Gửi yêu cầu rút đồng ý / hạn chế xử lý
            </button>
          </div>
        </div>
        <button type="button" className="account-text-button" onClick={signOut}>Đăng xuất</button>
      </>}
    </>}
    <LegalPolicyModal openTab={legalTab} onClose={() => setLegalTab(null)} onSwitchTab={setLegalTab} />
  </section></main>;
}
