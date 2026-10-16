import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Briefcase,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

export default function LiveLogin() {
  const {
    token,
    companies,
    companyId,
    signIn,
    signOut,
    selectCompany,
    refreshCompanies,
    session,
  } = useApiSession();

  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Step state: 1 = Login, 2 = Choose Company
  const [step, setStep] = useState<1 | 2>(token ? 2 : 1);

  // Form State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status & Feedback
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(false);

  // Company Search & Creation
  const [companySearch, setCompanySearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newTaxCode, setNewTaxCode] = useState("");
  const [newRepresentative, setNewRepresentative] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Sync step if token changes
  useEffect(() => {
    if (token) {
      setStep(2);
    } else {
      setStep(1);
    }
  }, [token]);

  // Handle Login Submit
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      await signIn(identifier.trim(), password);
      // Move to Step 2: Company Selection
      setStep(2);
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

  // Handle selecting a company and entering the workspace
  async function handleSelectAndEnter(targetCompanyId: string) {
    setEntering(true);
    selectCompany(targetCompanyId);

    // Subtle transition animation before redirecting
    setTimeout(() => {
      const redirectTarget = params.get("redirect") || "/";
      navigate(redirectTarget);
    }, 450);
  }

  // 1-Click Demo Company Quick Bootstrap
  async function handleCreateDemoCompany() {
    setCreatingCompany(true);
    setError("");
    try {
      // Create or ensure company
      await request<any>("/api/v1/common/companies/create/", token, {
        method: "POST",
        body: JSON.stringify({
          code: "SOVIET_" + Math.floor(Math.random() * 900 + 100),
          name: "Công ty Cổ phần Giải pháp Sổ Việt",
          legal_name: "CÔNG TY CỔ PHẦN GIẢI PHÁP SỔ VIỆT",
          tax_code: "010" + Math.floor(1000000 + Math.random() * 9000000),
          business_type: "JOINT_STOCK",
          address: "Tầng 12, Tòa nhà Sổ Việt, Cầu Giấy, Hà Nội",
          province: "Hà Nội",
          legal_representative: "Nguyễn Văn Quản Trị",
          phone: "0988123456",
          email: "contact@soviet.vn",
          confirmed_authority: true,
          fiscal_year_start_month: 1,
        }),
      });

      await refreshCompanies();
      // Select the first company and enter
      setEntering(true);
      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (err: any) {
      console.warn("Could not bootstrap demo company via API:", err);
      // Fallback: reload companies
      await refreshCompanies();
    } finally {
      setCreatingCompany(false);
    }
  }

  // Handle custom company creation
  async function handleCreateCustomCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCompanyName.trim() || !newTaxCode.trim() || !newRepresentative.trim()) return;

    setCreatingCompany(true);
    setError("");

    try {
      const cleanTax = newTaxCode.replace(/\s/g, "");
      const res = await request<any>("/api/v1/common/companies/create/", token, {
        method: "POST",
        body: JSON.stringify({
          name: newCompanyName.trim(),
          legal_name: newCompanyName.trim(),
          tax_code: cleanTax,
          business_type: "LLC_ONE_MEMBER",
          address: "Trụ sở chính doanh nghiệp",
          province: "Hà Nội",
          legal_representative: newRepresentative.trim(),
          confirmed_authority: true,
          fiscal_year_start_month: 1,
        }),
      });

      await refreshCompanies();
      setShowCreateForm(false);
      setNewCompanyName("");
      setNewTaxCode("");
      setNewRepresentative("");

      if (res?.id) {
        handleSelectAndEnter(res.id);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể tạo mới doanh nghiệp."
      );
    } finally {
      setCreatingCompany(false);
    }
  }

  // Filtered company list
  const filteredCompanies = companies.filter((c) => {
    if (!companySearch.trim()) return true;
    const q = companySearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    );
  });

  // User display name
  const userEmail = session?.user?.email || identifier || "Quản trị viên";
  const userDisplayName =
    session?.user?.display_name || userEmail.split("@")[0] || "User";

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

      {/* 3-Step Progress Indicator */}
      <div className="auth-stepper">
        <div className={`auth-step-item ${step === 1 ? "active" : "completed"}`}>
          <span className="auth-step-num">
            {step > 1 ? <CheckCircle2 size={13} /> : "1"}
          </span>
          <span>Đăng nhập</span>
        </div>

        <div className="auth-step-separator" />

        <div
          className={`auth-step-item ${
            step === 2 ? "active" : step > 2 ? "completed" : ""
          }`}
        >
          <span className="auth-step-num">2</span>
          <span>Doanh nghiệp</span>
        </div>

        <div className="auth-step-separator" />

        <div className="auth-step-item">
          <span className="auth-step-num">3</span>
          <span>Không gian làm việc</span>
        </div>
      </div>

      {/* Main Card */}
      <section className={`account-card auth-login-card ${step === 2 ? "wide" : ""}`}>
        {/* Transition Loading Overlay */}
        {entering && (
          <div className="entering-workspace-overlay">
            <div className="entering-spinner" />
            <span className="entering-text">Đang kết nối không gian làm việc…</span>
            <span className="entering-sub">Hệ thống đang tải sổ sách và chứng từ kế toán</span>
          </div>
        )}

        {/* ================= STEP 1: LOGIN ================= */}
        {step === 1 && (
          <>
            <div className="account-card-header">
              <h1>Đăng nhập hệ thống</h1>
              <p>Nhập thông tin xác thực để bắt đầu phiên kế toán của bạn</p>
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
          </>
        )}

        {/* ================= STEP 2: CHOOSE COMPANY ================= */}
        {step === 2 && (
          <>
            {/* User Profile Badge */}
            <div className="user-profile-badge">
              <div className="user-profile-info">
                <div className="user-profile-avatar">
                  {userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="user-profile-name">
                    <span>{userDisplayName}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#e0f2fe",
                        color: "#0369a1",
                        fontWeight: 600,
                      }}
                    >
                      Xác thực thành công
                    </span>
                  </div>
                  <div className="user-profile-email">{userEmail}</div>
                </div>
              </div>

              <button
                type="button"
                className="signout-inline-btn"
                onClick={signOut}
                title="Đăng xuất khỏi tài khoản"
              >
                <LogOut size={14} />
                <span>Đổi tài khoản</span>
              </button>
            </div>

            <div className="account-card-header">
              <h1>Chọn Doanh nghiệp làm việc</h1>
              <p>
                Chọn đơn vị bạn muốn truy cập để bắt đầu ghi chép và kiểm soát
                sổ sách kế toán.
              </p>
            </div>

            {error && (
              <div className="account-error" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* If user has companies */}
            {companies.length > 0 ? (
              <>
                {/* Search box if more than 3 companies */}
                {companies.length > 3 && (
                  <div style={{ marginBottom: 14 }}>
                    <div className="auth-input-wrap">
                      <span className="auth-input-icon">
                        <Search size={16} />
                      </span>
                      <input
                        className="auth-input"
                        style={{ height: 40, fontSize: 13 }}
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Tìm theo tên công ty hoặc mã số thuế…"
                      />
                    </div>
                  </div>
                )}

                {/* List of Companies */}
                <div className="company-list-container">
                  {filteredCompanies.map((c) => {
                    const isSelected = companyId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`company-card-item ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => handleSelectAndEnter(c.id)}
                      >
                        <div className="company-card-left">
                          <div className="company-card-icon">
                            <Building2 size={22} />
                          </div>
                          <div className="company-card-details">
                            <div className="company-card-name" title={c.name}>
                              {c.name}
                            </div>
                            <div className="company-card-meta">
                              <span className="company-tax-badge">
                                MÃ: {c.code || "SOVIET"}
                              </span>
                              <span className="company-status-pill">
                                ● Hoạt động
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="company-card-cta">
                          <span>Vào làm việc</span>
                          <ArrowRight size={15} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Additional Actions */}
                <div className="company-actions-grid">
                  <button
                    type="button"
                    className="company-action-card-btn btn-create-new"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                  >
                    <Plus size={16} />
                    <span>Thêm doanh nghiệp mới</span>
                  </button>

                  <Link
                    to="/join"
                    className="company-action-card-btn btn-create-new"
                  >
                    <Briefcase size={16} />
                    <span>Gửi yêu cầu tham gia</span>
                  </Link>
                </div>
              </>
            ) : (
              /* Empty State when user has 0 companies */
              <div className="company-empty-card">
                <div className="company-empty-icon">
                  <Building2 size={26} />
                </div>
                <h3 className="company-empty-title">
                  Tài khoản chưa có doanh nghiệp nào
                </h3>
                <p className="company-empty-desc">
                  Để bắt đầu hạch toán và xuất hóa đơn, bạn có thể khởi tạo
                  doanh nghiệp mẫu ngay tức thì hoặc tự nhập thông tin công ty.
                </p>

                <div className="company-actions-grid">
                  <button
                    type="button"
                    className="company-action-card-btn btn-demo-quick"
                    onClick={handleCreateDemoCompany}
                    disabled={creatingCompany}
                  >
                    {creatingCompany ? (
                      <span className="auth-spinner" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    <span>Tạo Doanh nghiệp mẫu ngay (1-Click)</span>
                  </button>

                  <button
                    type="button"
                    className="company-action-card-btn btn-create-new"
                    onClick={() => setShowCreateForm(true)}
                  >
                    <Plus size={16} />
                    <span>Tạo mới theo MST</span>
                  </button>
                </div>
              </div>
            )}

            {/* Inline Custom Creation Form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateCustomCompany}
                className="inline-form-box"
              >
                <h3>
                  <span>Khởi tạo doanh nghiệp</span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                    onClick={() => setShowCreateForm(false)}
                  >
                    ✕
                  </button>
                </h3>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div className="auth-field">
                    <label className="auth-label">Tên doanh nghiệp</label>
                    <input
                      className="auth-input"
                      style={{ paddingLeft: 14, height: 42 }}
                      placeholder="VD: Công ty TNHH Thương mại Dịch vụ An Phú"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Mã số thuế (MST)</label>
                    <input
                      className="auth-input"
                      style={{ paddingLeft: 14, height: 42 }}
                      placeholder="VD: 0109887766"
                      value={newTaxCode}
                      onChange={(e) => setNewTaxCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Người đại diện pháp luật</label>
                    <input
                      className="auth-input"
                      style={{ paddingLeft: 14, height: 42 }}
                      placeholder="VD: Nguyễn Văn A"
                      value={newRepresentative}
                      onChange={(e) => setNewRepresentative(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    style={{ height: 42, flex: 1, margin: 0 }}
                    disabled={creatingCompany}
                  >
                    {creatingCompany ? "Đang tạo…" : "Lưu và vào làm việc →"}
                  </button>
                  <button
                    type="button"
                    className="company-action-card-btn btn-create-new"
                    style={{ height: 42, padding: "0 16px" }}
                    onClick={() => setShowCreateForm(false)}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}

            <div className="auth-card-footer">
              <button
                type="button"
                className="account-back-btn"
                style={{ margin: 0 }}
                onClick={() => setStep(1)}
              >
                ← Quay lại đăng nhập
              </button>

              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#0284c7",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12.5,
                  fontWeight: 600,
                }}
                onClick={() => refreshCompanies()}
              >
                <RefreshCw size={13} />
                <span>Làm mới danh sách</span>
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
