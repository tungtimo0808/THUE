import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { AuthField, AuthLayout, AuthSubmit } from "./AuthLayout";
import { request } from "./live-api";

const STEPS = ["Nhập email", "Kiểm tra email", "Mật khẩu mới"] as const;
const STEP_ORDER = ["request", "sent", "change", "done"];

export default function LivePasswordReset() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tokenFromUrl = (searchParams.get("token") || "").trim();

  const [step, setStep] = useState<"request" | "sent" | "change" | "done">(tokenFromUrl ? "change" : "request");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setStep("change");
      setError("");
      setMessage("");
    }
  }, [tokenFromUrl]);

  async function requestResetLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<{ challenge: string; detail?: string }>("/api/v1/common/auth/password-reset/request/", undefined, {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setChallenge(result.challenge || "");
      setStep("sent");
      setMessage(result.detail || "Nếu email đã được đăng ký, liên kết đặt lại mật khẩu đã được gửi đến hộp thư của bạn.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được liên kết đặt lại mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  async function resendResetLink() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<{ challenge: string }>("/api/v1/common/auth/password-reset/resend/", undefined, {
        method: "POST",
        body: JSON.stringify({ challenge, email: email.trim() }),
      });
      if (result.challenge) setChallenge(result.challenge);
      setMessage("Đã gửi lại liên kết đặt lại mật khẩu đến Gmail của bạn.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi lại được liên kết.");
    } finally {
      setBusy(false);
    }
  }

  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request<{ reset: boolean }>("/api/v1/common/auth/password-reset/confirm/", undefined, {
        method: "POST",
        body: JSON.stringify({ reset_token: resetToken, new_password: password, new_password_confirm: confirm }),
      });
      setPassword("");
      setConfirm("");
      setResetToken("");
      setStep("done");
      setMessage("Mật khẩu của bạn đã được đặt lại thành công.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không đặt lại được mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  function backToRequest() {
    setSearchParams({});
    setResetToken("");
    setChallenge("");
    setPassword("");
    setConfirm("");
    setError("");
    setMessage("");
    setStep("request");
  }

  const subtitle =
    step === "request"
      ? "Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu qua Gmail"
      : step === "change"
        ? "Nhập mật khẩu mới cho tài khoản của bạn"
        : undefined;

  return (
    <AuthLayout
      title={step === "done" ? "Đặt lại mật khẩu thành công" : "Đặt lại mật khẩu"}
      subtitle={subtitle}
      error={error}
      message={message}
      steps={STEPS}
      currentStep={Math.min(STEP_ORDER.indexOf(step), STEPS.length - 1)}
      footer={step === "done" ? undefined : <><span>Đã nhớ mật khẩu?</span><Link to="/login">Đăng nhập</Link></>}
    >
      {step === "request" && (
        <form onSubmit={requestResetLink} className="auth-form">
          <AuthField
            id="reset-email"
            label="Email tài khoản"
            icon={Mail}
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="name@gmail.com"
            autoComplete="email"
            required
            autoFocus
          />
          <AuthSubmit busy={busy} busyLabel="Đang gửi liên kết…">Gửi liên kết đặt lại mật khẩu</AuthSubmit>
        </form>
      )}
      {step === "sent" && (
        <>
          <p className="auth-note">
            Chúng tôi đã gửi liên kết đặt lại mật khẩu đến <strong>{email}</strong>. Vui lòng mở Gmail (kiểm tra cả mục Spam/Quảng cáo) và nhấn vào liên kết trong email để đặt mật khẩu mới.
          </p>
          <button type="button" className="auth-text-button" onClick={resendResetLink} disabled={busy || !challenge}>
            Gửi lại liên kết đặt lại mật khẩu
          </button>
          <button type="button" className="auth-text-button" onClick={backToRequest} disabled={busy}>
            Dùng email khác
          </button>
        </>
      )}
      {step === "change" && (
        <>
          <form onSubmit={change} className="auth-form">
            <AuthField
              id="reset-password"
              label="Mật khẩu mới"
              icon={Lock}
              type="password"
              minLength={8}
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              autoFocus
            />
            <AuthField
              id="reset-confirm"
              label="Xác nhận mật khẩu mới"
              icon={Lock}
              type="password"
              minLength={8}
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <small className="auth-hint">Mật khẩu cần 8–64 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>
            <AuthSubmit busy={busy} busyLabel="Đang đổi mật khẩu…">Đặt lại mật khẩu</AuthSubmit>
          </form>
          {error && (
            <button type="button" className="auth-text-button" onClick={backToRequest} disabled={busy}>
              Yêu cầu liên kết đặt lại mật khẩu mới
            </button>
          )}
        </>
      )}
      {step === "done" && (
        <Link className="auth-submit-btn" to="/login">Đăng nhập bằng mật khẩu mới</Link>
      )}
    </AuthLayout>
  );
}
