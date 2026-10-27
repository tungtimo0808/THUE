import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { request } from "./live-api";
import "./live-account.css";

type RegistrationResponse = { challenge: string; verification_required: boolean; dev_otp?: string; warning?: string };
type VerificationResponse = { verified: boolean; access: string; refresh: string };

export default function LiveAccount() {
  const [step, setStep] = useState<"register" | "verify" | "complete">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) { setError("Mật khẩu xác nhận không khớp."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<RegistrationResponse>("/api/v1/common/auth/register/", undefined, {
        method: "POST",
        body: JSON.stringify({ full_name: fullName, email, phone, password, password_confirm: confirmPassword, terms_accepted: accepted }),
      });
      setPassword(""); setConfirmPassword("");
      setChallenge(result.challenge);
      setDevOtp(result.dev_otp || "");
      setMessage(result.warning || "Đã gửi mã xác thực đến email của bạn.");
      setStep("verify");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đăng ký được."); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<VerificationResponse>("/api/v1/common/auth/verify-registration/", undefined, {
        method: "POST", body: JSON.stringify({ challenge, code }),
      });
      if (!result.verified) throw new Error("Backend chưa xác nhận tài khoản.");
      setCode(""); setDevOtp(""); setStep("complete");
      setMessage("Tài khoản đã được xác thực. Bạn có thể đăng nhập và tham gia doanh nghiệp.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mã xác thực không hợp lệ."); }
    finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ challenge: string; dev_otp?: string; warning?: string }>("/api/v1/common/auth/resend-verification/", undefined, {
        method: "POST", body: JSON.stringify({ challenge }),
      });
      setChallenge(result.challenge); setCode(""); setDevOtp(result.dev_otp || "");
      setMessage(result.warning || "Đã gửi mã xác thực mới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi lại được mã."); }
    finally { setBusy(false); }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ challenge: string; dev_otp?: string }>("/api/v1/common/auth/change-registration-email/", undefined, {
        method: "POST", body: JSON.stringify({ challenge, email: newEmail }),
      });
      setChallenge(result.challenge); setEmail(newEmail); setNewEmail(""); setCode("");
      setDevOtp(result.dev_otp || ""); setMessage("Đã gửi mã đến email mới.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được email."); }
    finally { setBusy(false); }
  }

  return <main className="account-page">
    <div className="account-card">
      <Link to="/directory?directory=Kh%C3%A1ch+h%C3%A0ng">← Về ứng dụng</Link>
      <p className="account-eyebrow">TÀI KHOẢN</p>
      <h1>{step === "register" ? "Đăng ký" : step === "verify" ? "Xác thực email" : "Đăng ký thành công"}</h1>
      {step === "register" && <p>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>}
      {error && <p className="account-error" role="alert">{error}</p>}
      {message && <p className="account-message" role="status">{message}</p>}
      {step === "register" && <form onSubmit={register}>
        <label>Họ và tên<input value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" required /></label>
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Số điện thoại Việt Nam<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" placeholder="0912345678" required /></label>
        <label>Mật khẩu<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <label>Xác nhận mật khẩu<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
        <small>Mật khẩu cần 8–64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
        <label className="account-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} required /> Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật.</label>
        <button type="submit" disabled={busy}>Tạo tài khoản</button>
      </form>}
      {step === "verify" && <>
        <p>Nhập mã 6 số gửi đến <strong>{email}</strong>.</p>
        {devOtp && <p className="account-dev-code">Mã kiểm thử trên BE local: <strong>{devOtp}</strong></p>}
        <form onSubmit={verify}>
          <label>Mã xác thực<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required /></label>
          <button type="submit" disabled={busy}>Xác thực tài khoản</button>
        </form>
        <button type="button" className="account-text-button" onClick={resend} disabled={busy}>Gửi lại mã</button>
        <form className="account-change-email" onSubmit={changeEmail}>
          <label>Đổi email nhận mã<input type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></label>
          <button type="submit" disabled={busy}>Đổi email</button>
        </form>
      </>}
      {step === "complete" && <Link className="account-primary-link" to="/join">Đăng nhập và tham gia doanh nghiệp</Link>}
    </div>
  </main>;
}
