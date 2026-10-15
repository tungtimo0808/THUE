import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { request } from "./live-api";
import "./live-account.css";

export default function LivePasswordReset() {
  const [step, setStep] = useState<"request" | "verify" | "change" | "done">("request");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ challenge: string; dev_otp?: string }>("/api/v1/common/auth/password-reset/request/", undefined, {
        method: "POST", body: JSON.stringify({ email: email.trim() }),
      });
      setChallenge(result.challenge); setDevOtp(result.dev_otp || ""); setStep("verify");
      setMessage("Nếu email đã được đăng ký, mã xác thực đã được gửi.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được mã."); }
    finally { setBusy(false); }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<{ valid: boolean; reset_token: string }>("/api/v1/common/auth/password-reset/verify-otp/", undefined, {
        method: "POST", body: JSON.stringify({ challenge, code }),
      });
      if (!result.valid || !result.reset_token) throw new Error("Không xác thực được mã.");
      setResetToken(result.reset_token); setCode(""); setDevOtp(""); setStep("change");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Mã xác thực không hợp lệ."); }
    finally { setBusy(false); }
  }

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) { setError("Mật khẩu xác nhận không khớp."); return; }
    setBusy(true); setError("");
    try {
      await request<{ reset: boolean }>("/api/v1/common/auth/password-reset/confirm/", undefined, {
        method: "POST", body: JSON.stringify({ reset_token: resetToken, new_password: password, new_password_confirm: confirm }),
      });
      setPassword(""); setConfirm(""); setResetToken(""); setStep("done");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đặt lại được mật khẩu."); }
    finally { setBusy(false); }
  }

  return <main className="account-page"><section className="account-card">
    <Link to="/login">← Đăng nhập</Link>
    <p className="account-eyebrow">COM-05</p>
    <h1>Đặt lại mật khẩu</h1>
    {error && <p className="account-error" role="alert">{error}</p>}
    {message && <p className="account-message" role="status">{message}</p>}
    {step === "request" && <form onSubmit={requestOtp}>
      <label>Email tài khoản<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
      <button type="submit" disabled={busy}>Gửi mã xác thực</button>
    </form>}
    {step === "verify" && <form onSubmit={verify}>
      <p>Nhập mã 6 số đã gửi đến email.</p>
      {devOtp && <p className="account-dev-code">Mã kiểm thử trên BE local: <strong>{devOtp}</strong></p>}
      <label>Mã xác thực<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required /></label>
      <button type="submit" disabled={busy}>Xác nhận mã</button>
    </form>}
    {step === "change" && <form onSubmit={change}>
      <label>Mật khẩu mới<input type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required /></label>
      <label>Xác nhận mật khẩu mới<input type="password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
      <button type="submit" disabled={busy}>Đặt lại mật khẩu</button>
    </form>}
    {step === "done" && <p>Đã đổi mật khẩu. <Link to="/login">Đăng nhập bằng mật khẩu mới</Link>.</p>}
  </section></main>;
}
