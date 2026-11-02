import { useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Building2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import "./live-account.css";

type AuthLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  error?: string;
  message?: string;
  steps?: readonly string[];
  currentStep?: number;
  footer?: ReactNode;
  children: ReactNode;
};

/** The page, brand and card shared by every sign-in, registration and recovery screen. */
export function AuthLayout({ title, subtitle, error, message, steps, currentStep = 0, footer, children }: AuthLayoutProps) {
  return (
    <main className="account-page">
      <Link to="/" className="auth-branding">
        <div className="auth-logo-icon"><Building2 size={24} /></div>
        <div className="auth-branding-text">
          <span className="auth-branding-title">SỔ VIỆT ERP</span>
          <span className="auth-branding-sub">Kế toán & Thuế Doanh nghiệp</span>
        </div>
      </Link>
      {steps && (
        <ol className="auth-stepper">
          {steps.map((label, index) => (
            <li key={label} className={`auth-step-item${index === currentStep ? " active" : index < currentStep ? " completed" : ""}`}>
              <span className="auth-step-num">{index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      )}
      <section className="account-card auth-login-card">
        <div className="account-card-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {error && <div className="account-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
        {message && <div className="account-message" role="status"><CheckCircle2 size={18} /><span>{message}</span></div>}
        {children}
        {footer && <div className="auth-card-footer">{footer}</div>}
      </section>
    </main>
  );
}

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

export function AuthField({ id, label, icon: Icon, type, ...input }: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon"><Icon size={18} /></span>
        <input id={id} className="auth-input" type={isPassword && revealed ? "text" : type} {...input} />
        {isPassword && (
          <button
            type="button"
            className="auth-input-suffix"
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthSubmit({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: ReactNode }) {
  return (
    <button type="submit" className="auth-submit-btn" disabled={busy}>
      {busy ? <><span className="auth-spinner" /><span>{busyLabel}</span></> : <><span>{children}</span><ArrowRight size={18} /></>}
    </button>
  );
}
