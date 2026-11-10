import { BrandMark } from "./components/BrandMark";
import { useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, FileText, ShieldCheck, X } from "lucide-react";
import "./live-account.css";

export type LegalDocTab = "privacy" | "terms";

export function LegalPolicyModal({
  openTab,
  onClose,
  onSwitchTab,
}: {
  openTab: LegalDocTab | null;
  onClose: () => void;
  onSwitchTab?: (tab: LegalDocTab) => void;
}) {
  if (!openTab) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        openTab === "privacy"
          ? "Chính sách bảo vệ dữ liệu cá nhân"
          : "Điều khoản sử dụng hệ thống"
      }
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "740px",
          maxHeight: "86vh",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldCheck size={20} color="var(--brand)" />
            <strong style={{ fontSize: "15px", color: "#0f172a" }}>
              Pháp lý & Bảo vệ dữ liệu cá nhân — SỔ VIỆT ERP
            </strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748b",
              padding: "4px",
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "10px 22px",
            borderBottom: "1px solid #f1f5f9",
            background: "#ffffff",
          }}
        >
          <button
            type="button"
            onClick={() => onSwitchTab?.("privacy")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: openTab === "privacy" ? "1px solid var(--brand)" : "1px solid #e2e8f0",
              background: openTab === "privacy" ? "#e0f2fe" : "#ffffff",
              color: openTab === "privacy" ? "var(--brand-hover)" : "#475569",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <ShieldCheck size={15} />
            Chính sách Bảo vệ Dữ liệu Cá nhân (Luật 91/2025)
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab?.("terms")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: openTab === "terms" ? "1px solid var(--brand)" : "1px solid #e2e8f0",
              background: openTab === "terms" ? "#e0f2fe" : "#ffffff",
              color: openTab === "terms" ? "var(--brand-hover)" : "#475569",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FileText size={15} />
            Điều khoản sử dụng hệ thống
          </button>
        </div>

        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            fontSize: "13.5px",
            lineHeight: 1.65,
            color: "#334155",
          }}
        >
          {openTab === "privacy" ? (
            <div>
              <h3 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "15px" }}>
                Chính sách Bảo vệ Dữ liệu Cá nhân (Phiên bản 2026.1)
              </h3>
              <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "12.5px" }}>
                Áp dụng theo <strong>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</strong> (hiệu lực 01/01/2026),{" "}
                <strong>Nghị định 356/2025/NĐ-CP</strong> và <strong>Luật An ninh mạng số 116/2025/QH15</strong>.
              </p>

              <p><strong>1. Phân loại dữ liệu cá nhân được thu thập & xử lý:</strong></p>
              <ul style={{ margin: "6px 0 12px 18px", padding: 0 }}>
                <li>
                  <strong>Dữ liệu cá nhân cơ bản:</strong> Họ và tên, địa chỉ email công việc, số điện thoại liên hệ, chức danh/vai trò trong doanh nghiệp, lịch sử phiên đăng nhập và nhật ký thao tác kiểm toán (Audit Log).
                </li>
                <li>
                  <strong>Dữ liệu cá nhân nhạy cảm (theo Nghị định 356/2025/NĐ-CP):</strong> Thông tin tài khoản ngân hàng phục vụ chi trả/đối soát, dữ liệu tiền lương, bảo hiểm bắt buộc và mã số thuế thu nhập cá nhân (TNCN) của người lao động do doanh nghiệp khai báo trong phân hệ Tiền lương & Thuế.
                </li>
              </ul>

              <p><strong>2. Mục đích xử lý dữ liệu:</strong></p>
              <ul style={{ margin: "6px 0 12px 18px", padding: 0 }}>
                <li>Xác thực định danh tài khoản người dùng (OTP, JWT), kiểm soát phân quyền theo 21 vai trò chuẩn (RBAC) và cô lập dữ liệu đa doanh nghiệp.</li>
                <li>Lập chứng từ kế toán, sổ cái, bảng lương, tờ khai thuế và báo cáo tài chính theo Thông tư 99/2025/TT-BTC, Thông tư 200/2014/TT-BTC, Thông tư 133/2016/TT-BTC và Thông tư 58/2026/TT-BTC.</li>
                <li>Lưu vết thông điệp dữ liệu và nhật ký kiểm toán bất biến (SHA-256) theo Luật Giao dịch điện tử 20/2023/QH15 và Luật Kế toán 88/2015/QH13.</li>
              </ul>

              <p><strong>3. Lưu trữ, bảo mật & bên thứ ba:</strong></p>
              <ul style={{ margin: "6px 0 12px 18px", padding: 0 }}>
                <li>Hệ thống <strong>không sử dụng</strong> cookie quảng cáo hay script theo dõi hành vi bên thứ ba (Google Analytics, Facebook Pixel, TikTok Pixel).</li>
                <li>Hệ thống cam kết <strong>không mua bán, trao đổi trái phép dữ liệu cá nhân</strong> dưới mọi hình thức (Điều 7 Luật 91/2025/QH15).</li>
                <li>Các trường nhạy cảm (mật khẩu, mã OTP, token, khóa bí mật) được tự động lọc và che dấu (<code>[REDACTED]</code>) trong nhật ký hệ thống.</li>
                <li>Thời hạn lưu trữ: Nhật ký hệ thống lưu tối thiểu 12 tháng (Nghị định 333/2026/NĐ-CP); tài liệu, sổ sách kế toán điện tử lưu trữ tối thiểu 10 năm theo Luật Kế toán.</li>
              </ul>

              <p><strong>4. Quyền của Chủ thể dữ liệu & Thời hạn phản hồi (Điều 4 Luật 91/2025 & Điều 5 NĐ 356/2025):</strong></p>
              <ul style={{ margin: "6px 0 12px 18px", padding: 0 }}>
                <li>Chủ thể dữ liệu có quyền được biết, đồng ý hoặc rút lại sự đồng ý, xem, chỉnh sửa, yêu cầu cung cấp bản sao, hạn chế xử lý, xóa dữ liệu (trừ dữ liệu kế toán - thuế bắt buộc phải lưu trữ theo luật định) và khiếu nại.</li>
                <li><strong>Cam kết thời hạn xử lý yêu cầu (Điều 5 Nghị định 356/2025/NĐ-CP):</strong>
                  <ul>
                    <li>Phản hồi xác nhận đã tiếp nhận yêu cầu: chậm nhất <strong>02 ngày làm việc</strong>.</li>
                    <li>Cung cấp hoặc chỉnh sửa dữ liệu cá nhân: trong vòng <strong>10 ngày</strong>.</li>
                    <li>Rút lại sự đồng ý, hạn chế hoặc phản đối xử lý dữ liệu: trong vòng <strong>15 ngày</strong>.</li>
                    <li>Xóa dữ liệu cá nhân (đối với dữ liệu ngoài phạm vi lưu trữ bắt buộc của Luật Kế toán): trong vòng <strong>20 ngày</strong>.</li>
                  </ul>
                </li>
                <li><strong>Kênh liên hệ Bộ phận Bảo vệ Dữ liệu Cá nhân (DPO):</strong> Email <code>dpo@soviet-erp.vn</code> hoặc gửi yêu cầu trực tiếp tại mục <em>Hồ sơ cá nhân → Quyền dữ liệu cá nhân</em>.</li>
              </ul>
            </div>
          ) : (
            <div>
              <h3 style={{ margin: "0 0 8px", color: "#0f172a", fontSize: "15px" }}>
                Điều khoản Sử dụng Hệ thống SỔ VIỆT ERP (Phiên bản 2026.1)
              </h3>
              <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "12.5px" }}>
                Áp dụng theo <strong>Luật Giao dịch điện tử số 20/2023/QH15</strong>, <strong>Nghị định 23/2025/NĐ-CP</strong> và pháp luật kế toán - thuế Việt Nam hiện hành.
              </p>
              <ul style={{ margin: "6px 0 12px 18px", padding: 0 }}>
                <li><strong>Trách nhiệm tài khoản & phân quyền:</strong> Người dùng có trách nhiệm bảo mật thông tin xác thực (mật khẩu, mã OTP) và chỉ thao tác trong đúng phạm vi vai trò, chi nhánh, phòng ban được Quản trị viên doanh nghiệp phân công.</li>
                <li><strong>Giá trị pháp lý của chứng từ điện tử & chữ ký số:</strong> Các thao tác lập, trình duyệt, phê duyệt, ký số và ghi sổ cái trên hệ thống được ghi nhận vào Nhật ký kiểm toán bất biến (Append-only Audit Log) kèm mã băm SHA-256 làm căn cứ đối chiếu nội bộ và kiểm toán.</li>
                <li><strong>Trách nhiệm kiểm soát chứng từ:</strong> Kế toán viên và người có thẩm quyền phê duyệt chịu trách nhiệm kiểm tra, đối chiếu chứng từ gốc trước khi ghi sổ hoặc kê khai thuế.</li>
                <li><strong>Bản quyền & giới hạn sử dụng:</strong> Nghiêm cấm mọi hành vi can thiệp trái phép vào cơ chế phân quyền, giả mạo chứng từ, hoặc trích xuất dữ liệu của doanh nghiệp khác.</li>
              </ul>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "none",
              background: "var(--brand)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Đã hiểu & Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [legalTab, setLegalTab] = useState<LegalDocTab | null>(null);
  return (
    <main className="account-page sv-auth-page">
      <Link to="/login" className="auth-branding">
        <BrandMark />
        <div className="auth-branding-text">
          <span className="auth-branding-title">SỔ VIỆT ERP</span>
          <span className="auth-branding-sub">Kế toán & Thuế doanh nghiệp</span>
        </div>
      </Link>
      <div className="auth-workspace">
        <div className="auth-form-panel">
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
        </div>
      </div>
      <footer className="auth-legal-footer">
        <button
          type="button"
          onClick={() => setLegalTab("privacy")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--brand-hover)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "12.5px",
            fontFamily: "inherit",
          }}
        >
          Chính sách bảo vệ dữ liệu cá nhân (Luật 91/2025)
        </button>
        <span>·</span>
        <button
          type="button"
          onClick={() => setLegalTab("terms")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--brand-hover)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "12.5px",
            fontFamily: "inherit",
          }}
        >
          Điều khoản sử dụng
        </button>
        <span>·</span>
        <span>Liên hệ DPO: dpo@soviet-erp.vn</span>
      </footer>
      <LegalPolicyModal openTab={legalTab} onClose={() => setLegalTab(null)} onSwitchTab={setLegalTab} />
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
        <span className="auth-input-icon" aria-hidden="true"><Icon size={18} /></span>
        <input id={id} className="auth-input" type={isPassword && revealed ? "text" : type} {...input} />
        {isPassword && (
          <button
            type="button"
            className="auth-input-suffix"
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={revealed}
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
