import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  LogOut,
  Sparkles,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Briefcase,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";

export default function LiveCompanySelect() {
  const {
    token,
    companies,
    companyId,
    signOut,
    selectCompany,
    refreshCompanies,
    session,
    restoring,
  } = useApiSession();

  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Status & Feedback
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(false);

  // Search & Filter
  const [companySearch, setCompanySearch] = useState("");

  // Create Company State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newTaxCode, setNewTaxCode] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);

  // If session is done restoring and user is NOT logged in, redirect to /login
  useEffect(() => {
    if (!restoring && !token) {
      const redirect = params.get("redirect");
      navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login", { replace: true });
    }
  }, [restoring, token, navigate, params]);

  // Handle selecting a company and entering workspace
  function handleSelectAndEnter(targetCompanyId: string) {
    setEntering(true);
    selectCompany(targetCompanyId);

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
      setEntering(true);
      setTimeout(() => {
        navigate(params.get("redirect") || "/");
      }, 500);
    } catch (err: any) {
      console.warn("Could not bootstrap demo company via API:", err);
      await refreshCompanies();
    } finally {
      setCreatingCompany(false);
    }
  }

  // Handle custom company creation
  async function handleCreateCustomCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCompanyName.trim() || !newTaxCode.trim()) return;

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
          confirmed_authority: true,
          fiscal_year_start_month: 1,
        }),
      });

      await refreshCompanies();
      setShowCreateForm(false);
      setNewCompanyName("");
      setNewTaxCode("");

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
      (c.code && c.code.toLowerCase().includes(q))
    );
  });

  // User display name & email
  const userEmail = session?.user?.email || "Quản trị viên";
  const userDisplayName =
    session?.user?.display_name || userEmail.split("@")[0] || "User";

  // While restoring session, show simple loading placeholder
  if (restoring) {
    return (
      <main className="company-portal-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="entering-spinner" />
      </main>
    );
  }

  return (
    <div className="company-portal-page">
      {/* Top Navbar */}
      <header className="company-portal-header">
        <Link to="/" className="auth-branding" style={{ margin: 0 }}>
          <div className="auth-logo-icon">
            <Building2 size={24} />
          </div>
          <div className="auth-branding-text">
            <span className="auth-branding-title">SỔ VIỆT ERP</span>
            <span className="auth-branding-sub">Kế toán & Thuế Doanh nghiệp</span>
          </div>
        </Link>

        {/* User Account Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="user-profile-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
              {userDisplayName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                <span>{userDisplayName}</span>
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#ecfdf5", color: "#059669", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <ShieldCheck size={11} /> Đã xác thực
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: "#64748b" }}>{userEmail}</span>
            </div>
          </div>

          <button
            type="button"
            className="signout-inline-btn"
            style={{ margin: 0, padding: "7px 12px" }}
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={14} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="company-portal-content">
        {/* Transition Loading Overlay */}
        {entering && (
          <div className="entering-workspace-overlay">
            <div className="entering-spinner" />
            <span className="entering-text">Đang kết nối không gian làm việc…</span>
            <span className="entering-sub">Hệ thống đang tải sổ sách và chứng từ kế toán</span>
          </div>
        )}

        <div className="company-portal-hero">
          <h1>Không gian làm việc Doanh nghiệp</h1>
          <p>
            Chọn đơn vị bạn muốn truy cập để bắt đầu ghi chép, lập báo cáo và quản lý hóa đơn.
          </p>
        </div>

        {error && (
          <div className="account-error" role="alert" style={{ marginBottom: 20 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="company-portal-toolbar">
          <div className="company-portal-search">
            <span style={{ position: "absolute", left: 14, color: "#94a3b8", display: "flex" }}>
              <Search size={16} />
            </span>
            <input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Tìm theo tên công ty hoặc mã số thuế…"
            />
          </div>

          <div className="company-portal-actions">
            <button
              type="button"
              className="auth-submit-btn"
              style={{ width: "auto", height: 42, padding: "0 18px", margin: 0 }}
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <Plus size={16} />
              <span>Thêm doanh nghiệp mới</span>
            </button>

            <button
              type="button"
              className="company-action-card-btn btn-demo-quick"
              style={{ height: 42, padding: "0 16px" }}
              onClick={handleCreateDemoCompany}
              disabled={creatingCompany}
            >
              {creatingCompany ? (
                <span className="auth-spinner" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>Tạo công ty mẫu (1-Click)</span>
            </button>

            <Link
              to="/join"
              className="company-action-card-btn btn-create-new"
              style={{ height: 42, padding: "0 14px" }}
            >
              <Briefcase size={16} />
              <span>Xin gia nhập</span>
            </Link>

            <button
              type="button"
              className="company-action-card-btn btn-create-new"
              style={{ height: 42, width: 42, padding: 0 }}
              onClick={() => refreshCompanies()}
              title="Làm mới danh sách doanh nghiệp"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Inline Create Form if toggled */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateCustomCompany}
            className="inline-form-box"
            style={{ maxWidth: 640, marginBottom: 28 }}
          >
            <h3>
              <span>Khởi tạo doanh nghiệp mới</span>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: 16,
                }}
                onClick={() => setShowCreateForm(false)}
              >
                ✕
              </button>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
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
                style={{ height: 42, padding: "0 18px" }}
                onClick={() => setShowCreateForm(false)}
              >
                Hủy
              </button>
            </div>
          </form>
        )}

        {/* Company Cards Grid */}
        {companies.length > 0 ? (
          filteredCompanies.length > 0 ? (
            <div className="company-portal-grid">
              {filteredCompanies.map((c) => {
                const isSelected = companyId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`company-portal-card ${isSelected ? "active-selected" : ""}`}
                    onClick={() => handleSelectAndEnter(c.id)}
                  >
                    <div>
                      <div className="company-portal-card-top">
                        <div className="company-portal-card-icon">
                          <Building2 size={24} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="company-portal-card-title" title={c.name}>
                            {c.name}
                          </div>
                          <div className="company-portal-card-badges">
                            <span className="company-tax-badge">
                              MÃ: {c.code || "SOVIET"}
                            </span>
                            <span className="company-status-pill">
                              ● Hoạt động
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="company-portal-card-body">
                        Trạng thái dữ liệu kế toán và hóa đơn trực tuyến đã sẵn sàng.
                      </div>
                    </div>

                    <div className="company-portal-card-footer">
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {isSelected ? "Doanh nghiệp hiện tại" : "Sẵn sàng làm việc"}
                      </span>
                      <button
                        type="button"
                        className="company-portal-enter-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAndEnter(c.id);
                        }}
                      >
                        <span>Vào làm việc</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
              <p style={{ fontSize: 15, margin: "0 0 14px 0" }}>
                Không tìm thấy doanh nghiệp nào khớp với "<strong>{companySearch}</strong>".
              </p>
              <button
                type="button"
                className="company-action-card-btn btn-create-new"
                style={{ display: "inline-flex", margin: "0 auto", padding: "8px 16px" }}
                onClick={() => setCompanySearch("")}
              >
                Xóa bộ lọc tìm kiếm
              </button>
            </div>
          )
        ) : (
          /* Empty state */
          <div className="company-empty-card" style={{ maxWidth: 600, margin: "40px auto", padding: "40px 24px" }}>
            <div className="company-empty-icon" style={{ width: 64, height: 64 }}>
              <Building2 size={32} />
            </div>
            <h3 className="company-empty-title" style={{ fontSize: 18 }}>
              Tài khoản chưa có doanh nghiệp nào
            </h3>
            <p className="company-empty-desc">
              Để bắt đầu hạch toán và xuất hóa đơn, bạn có thể khởi tạo doanh nghiệp
              mẫu ngay tức thì hoặc tự nhập thông tin công ty theo MST.
            </p>

            <div className="company-actions-grid" style={{ maxWidth: 540, width: "100%" }}>
              <button
                type="button"
                className="company-action-card-btn btn-demo-quick"
                style={{ whiteSpace: "nowrap" }}
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
                style={{ whiteSpace: "nowrap" }}
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={16} />
                <span>Tạo mới theo MST</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
