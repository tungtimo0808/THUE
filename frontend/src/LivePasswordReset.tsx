import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, Mail } from "lucide-react";
import { AuthField, AuthLayout, AuthSubmit } from "./AuthLayout";
import { request } from "./live-api";

const STEPS = ["Nhập email", "Xác thực mã", "Mật khẩu mới"] as const;
const STEP_ORDER = ["request", "verify", "change", "done"];

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

  async function resendOtp() {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<{ challenge: string; dev_otp?: string }>("/api/v1/common/auth/password-reset/resend/", undefined, {
        method: "POST", body: JSON.stringify({ challenge, email: email.trim() }),
      });
      if (result.challenge) setChallenge(result.challenge);
      if (result.dev_otp) setDevOtp(result.dev_otp);
      setMessage("Đã gửi lại mã xác thực đặt lại mật khẩu.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi lại được mã.");
    } finally { setBusy(false); }
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

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      subtitle={step === "request" ? "Nhập email đã đăng ký để nhận mã xác thực" : undefined}
      error={error}
      message={message}
      steps={STEPS}
      currentStep={STEP_ORDER.indexOf(step)}
      footer={<><span>Đã nhớ mật khẩu?</span><Link to="/login">Đăng nhập</Link></>}
    >
      {step === "request" && (
        <form onSubmit={requestOtp} className="auth-form">
          <AuthField id="reset-email" label="Email tài khoản" icon={Mail} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" required autoFocus />
          <AuthSubmit busy={busy} busyLabel="Đang gửi mã…">Gửi mã xác thực</AuthSubmit>
        </form>
      )}
      {step === "verify" && (
        <>
          <p className="auth-note">Nhập mã 6 số đã gửi đến email.</p>
          {devOtp && <p className="account-dev-code">Mã xác thực hệ thống cấp tự động: <strong>{devOtp}</strong></p>}
          <form onSubmit={verify} className="auth-form">
            <AuthField id="reset-code" label="Mã xác thực" icon={KeyRound} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required autoFocus />
            <AuthSubmit busy={busy} busyLabel="Đang xác nhận…">Xác nhận mã</AuthSubmit>
          </form>
          <button type="button" className="auth-text-button" onClick={resendOtp} disabled={busy}>Gửi lại mã xác thực</button>
        </>
      )}
      {step === "change" && (
        <form onSubmit={change} className="auth-form">
          <AuthField id="reset-password" label="Mật khẩu mới" icon={Lock} type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" required autoFocus />
          <AuthField id="reset-confirm" label="Xác nhận mật khẩu mới" icon={Lock} type="password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="••••••••" autoComplete="new-password" required />
          <AuthSubmit busy={busy} busyLabel="Đang đổi mật khẩu…">Đặt lại mật khẩu</AuthSubmit>
        </form>
      )}
      {step === "done" && <p className="auth-note">Đã đổi mật khẩu. <Link to="/login">Đăng nhập bằng mật khẩu mới</Link>.</p>}
    </AuthLayout>
  );
}
