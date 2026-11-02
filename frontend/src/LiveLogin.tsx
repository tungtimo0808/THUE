import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { useApiSession } from "./ApiSession";
import { AuthField, AuthLayout, AuthSubmit } from "./AuthLayout";

export default function LiveLogin() {
  const {
    token,
    signIn,
    restoring,
  } = useApiSession();

  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Form State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If user is already logged in, redirect straight to company selection
  useEffect(() => {
    if (!restoring && token) {
      const rawRedirect = params.get("redirect");
      const redirect = rawRedirect && !rawRedirect.startsWith("/join") ? rawRedirect : null;
      navigate(redirect ? `/select-company?redirect=${encodeURIComponent(redirect)}` : "/select-company", { replace: true });
    }
  }, [restoring, token, navigate, params]);

  // Handle Login Submit
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await signIn(identifier.trim(), password);
      // After successful login, proceed to the dedicated Company selection screen
      const rawRedirect = params.get("redirect");
      const redirect = rawRedirect && !rawRedirect.startsWith("/join") ? rawRedirect : null;
      navigate(redirect ? `/select-company?redirect=${encodeURIComponent(redirect)}` : "/select-company", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập hệ thống"
      subtitle="Nhập thông tin xác thực để bắt đầu phiên làm việc kế toán của bạn"
      error={error}
      footer={<><span>Chưa có tài khoản?</span><Link to="/account">Đăng ký tài khoản mới</Link></>}
    >
      <form onSubmit={handleLogin} className="auth-form">
        <AuthField
          id="auth-identifier"
          label="Email hoặc số điện thoại"
          icon={Mail}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="name@company.com hoặc 09xxxxxxxx"
          autoComplete="username"
          required
          autoFocus
        />
        <AuthField
          id="auth-password"
          label="Mật khẩu"
          icon={Lock}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <div className="auth-row-meta">
          <label className="auth-checkbox-label">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            <span>Ghi nhớ phiên đăng nhập</span>
          </label>
          <Link to="/reset-password" className="auth-forgot-link">Quên mật khẩu?</Link>
        </div>
        <AuthSubmit busy={busy} busyLabel="Đang xác thực…">Đăng nhập tiếp tục</AuthSubmit>
      </form>
    </AuthLayout>
  );
}
