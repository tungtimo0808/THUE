import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Lock, Mail, Phone, User } from "lucide-react";
import { AuthField, AuthLayout, AuthSubmit, LegalPolicyModal, type LegalDocTab } from "./AuthLayout";
import { request } from "./live-api";

const STEPS = ["Thông tin", "Xác thực email", "Hoàn tất"] as const;
const TITLES = { register: "Đăng ký tài khoản", verify: "Xác thực email", complete: "Đăng ký thành công" };

type RegistrationResponse = { challenge: string; verification_required: boolean; dev_otp?: string; warning?: string };
type VerificationResponse = { verified: boolean; access: string; refresh: string };

export default function LiveAccount() {
  const [step, setStep] = useState<"register" | "verify" | "complete">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalDocTab | null>(null);
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
    if (!acceptedTerms) { setError("Bạn cần đồng ý với Điều khoản sử dụng hệ thống."); return; }
    if (!acceptedPrivacy) { setError("Bạn cần đồng ý cho phép xử lý dữ liệu cá nhân theo Chính sách bảo vệ dữ liệu cá nhân (Luật 91/2025/QH15)."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request<RegistrationResponse>("/api/v1/common/auth/register/", undefined, {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          password_confirm: confirmPassword,
          terms_accepted: acceptedTerms && acceptedPrivacy,
          privacy_accepted: acceptedPrivacy,
          terms_version: "2026.1-ToS",
          privacy_version: "2026.1-PDPL-91/2025",
        }),
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
      setMessage("Tài khoản đã được xác thực thành công. Bạn có thể đăng nhập vào hệ thống.");
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

  return (
    <AuthLayout
      title={TITLES[step]}
      subtitle={step === "register" ? "Tạo tài khoản để bắt đầu sử dụng hệ thống kế toán của bạn" : undefined}
      error={error}
      message={message}
      steps={STEPS}
      currentStep={["register", "verify", "complete"].indexOf(step)}
      footer={step === "complete" ? undefined : <><span>Đã có tài khoản?</span><Link to="/login">Đăng nhập</Link></>}
    >
      {step === "register" && (
        <form onSubmit={register} className="auth-form">
          <AuthField id="reg-name" label="Họ và tên" icon={User} value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" required autoFocus />
          <AuthField id="reg-email" label="Email" icon={Mail} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" autoComplete="email" required />
          <AuthField id="reg-phone" label="Số điện thoại Việt Nam" icon={Phone} type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" placeholder="0912345678" required />
          <AuthField id="reg-password" label="Mật khẩu" icon={Lock} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" minLength={8} required />
          <AuthField id="reg-confirm" label="Xác nhận mật khẩu" icon={Lock} type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="••••••••" autoComplete="new-password" minLength={8} required />
          <small className="auth-hint">Mật khẩu cần 8–64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
          <label className="auth-checkbox-label">
            <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} required />
            <span>
              Tôi đã đọc và đồng ý với{" "}
              <button
                type="button"
                onClick={() => setLegalTab("terms")}
                style={{
                  display: "inline",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#0284c7",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  textAlign: "left",
                }}
              >
                Điều khoản sử dụng hệ thống
              </button>.
            </span>
          </label>
          <label className="auth-checkbox-label">
            <input type="checkbox" checked={acceptedPrivacy} onChange={event => setAcceptedPrivacy(event.target.checked)} required />
            <span>
              Tôi đồng ý cho phép thu thập, xử lý dữ liệu cá nhân theo{" "}
              <button
                type="button"
                onClick={() => setLegalTab("privacy")}
                style={{
                  display: "inline",
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "#0284c7",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  textAlign: "left",
                }}
              >
                Chính sách bảo vệ dữ liệu cá nhân (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP)
              </button>.
            </span>
          </label>
          <AuthSubmit busy={busy} busyLabel="Đang tạo tài khoản…">Tạo tài khoản</AuthSubmit>
        </form>
      )}
      {step === "verify" && (
        <>
          <p className="auth-note">Nhập mã 6 số gửi đến <strong>{email}</strong>.</p>
          {devOtp && <p className="account-dev-code">Mã xác thực hệ thống cấp tự động: <strong>{devOtp}</strong></p>}
          <form onSubmit={verify} className="auth-form">
            <AuthField id="reg-code" label="Mã xác thực" icon={KeyRound} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value)} autoComplete="one-time-code" required autoFocus />
            <AuthSubmit busy={busy} busyLabel="Đang xác thực…">Xác thực tài khoản</AuthSubmit>
          </form>
          <button type="button" className="auth-text-button" onClick={resend} disabled={busy}>Gửi lại mã</button>
          <form className="auth-form auth-form-section" onSubmit={changeEmail}>
            <AuthField id="reg-new-email" label="Đổi email nhận mã" icon={Mail} type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required />
            <AuthSubmit busy={busy} busyLabel="Đang đổi email…">Đổi email</AuthSubmit>
          </form>
        </>
      )}
      {step === "complete" && <Link className="auth-submit-btn" to="/login">Đăng nhập vào hệ thống</Link>}
      <LegalPolicyModal openTab={legalTab} onClose={() => setLegalTab(null)} onSwitchTab={setLegalTab} />
    </AuthLayout>
  );
}
