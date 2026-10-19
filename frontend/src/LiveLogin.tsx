import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import "./live-account.css";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If user is already logged in, redirect straight to company selection
  useEffect(() => {
    if (!restoring && token) {
      const redirect = params.get("redirect");
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
      const redirect = params.get("redirect");
      navigate(redirect ? `/select-company?redirect=${encodeURIComponent(redirect)}` : "/select-company");
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
    <main className="account-page">
      {/* Brand Header */}
      <Link to="/" className="auth-branding">
        <div className="auth-logo-icon">
          <Building2 size={24} />
        </div>
        <div className="auth-branding-text">
          <span className="auth-branding-title">SỔ VIỆT ERP</span>
          <span className="auth-branding-sub">Kế toán & Thuế Doanh nghiệp</span>
        </div>
      </Link>

      {/* Main Login Card */}
      <section className="account-card auth-login-card">
        <div className="account-card-header">
          <h1>Đăng nhập hệ thống</h1>
          <p>Nhập thông tin xác thực để bắt đầu phiên làm việc kế toán của bạn</p>
        </div>

        {error && (
          <div className="account-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-identifier">
              Email hoặc số điện thoại
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <Mail size={18} />
              </span>
              <input
                id="auth-identifier"
                className="auth-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@company.com hoặc 09xxxxxxxx"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Mật khẩu
            </label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <Lock size={18} />
              </span>
              <input
                id="auth-password"
                className="auth-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-input-suffix"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-row-meta">
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Ghi nhớ phiên đăng nhập</span>
            </label>
            <Link to="/reset-password" className="auth-forgot-link">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={busy}
          >
            {busy ? (
              <>
                <span className="auth-spinner" />
                <span>Đang xác thực…</span>
              </>
            ) : (
              <>
                <span>Đăng nhập tiếp tục</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>Chưa có tài khoản?</span>
          <Link to="/account">Đăng ký tài khoản mới</Link>
        </div>
      </section>
    </main>
  );
}
