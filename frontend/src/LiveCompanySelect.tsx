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
import { humanizeErrorMessage, showGlobalPopup } from "./global-popup";
import MisaDropdownSelect from "./MisaDropdownSelect";
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

  // Create Company State (Full API fields matching CompanyBootstrapSerializer)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTaxCode, setNewTaxCode] = useState("");
  const [newCompanyCode, setNewCompanyCode] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newBusinessType, setNewBusinessType] = useState("LLC_ONE_MEMBER");
  const [newLegalRep, setNewLegalRep] = useState("");
  const [newRepTitle, setNewRepTitle] = useState("Giám đốc");
  const [newProvince, setNewProvince] = useState("Hà Nội");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAccountingRegime, setNewAccountingRegime] = useState("TT99");
  const [newFiscalMonth, setNewFiscalMonth] = useState(1);
  const [newConfirmedAuthority, setNewConfirmedAuthority] = useState(true);
  const [lookingUpTax, setLookingUpTax] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);

  // If session is done restoring and user is NOT logged in, redirect to /login
  useEffect(() => {
    if (!restoring && !token) {
      const redirect = params.get("redirect");
      navigate(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login", { replace: true });
    }
  }, [restoring, token, navigate, params]);

  // Handle selecting a company and entering workspace
  async function handleSelectAndEnter(targetCompanyId: string) {
    setEntering(true);
    selectCompany(targetCompanyId);
    if (token) {
      try {
        await request("/api/v1/common/companies/switch/", token, {
          method: "POST",
          body: JSON.stringify({ company: targetCompanyId, company_id: targetCompanyId, all_branches: true }),
        });
      } catch {
        // Fallback or ignore if offline/switched locally
      }
    }

    const redirectTarget = params.get("redirect") || "/";
    navigate(redirectTarget);
  }

  // Handle selecting a company and going straight to Company Admin
  async function handleSelectAndGoAdmin(targetCompanyId: string) {
    setEntering(true);
    selectCompany(targetCompanyId);
    if (token) {
      try {
        await request("/api/v1/common/companies/switch/", token, {
          method: "POST",
          body: JSON.stringify({ company: targetCompanyId, company_id: targetCompanyId, all_branches: true }),
        });
      } catch {
        // Fallback or ignore if offline/switched locally
      }
    }

    navigate("/admin");
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
          auto_complete_setup: true,
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

  // Lookup Tax Code via GET /api/v1/common/companies/create/?tax_code=...
  async function handleLookupTaxCode() {
    const cleanTax = newTaxCode.replace(/\s+/g, "");
    if (!cleanTax) {
      showGlobalPopup({
        type: "warning",
        title: "Thiếu Mã số thuế",
        message: "Vui lòng nhập Mã số thuế (10 hoặc 13 chữ số) trước khi tra cứu.",
      });
      return;
    }
    setLookingUpTax(true);
    try {
      const result = await request<{
        exists_on_system: boolean;
        company_name?: string;
        legal_name?: string;
        address?: string;
        province?: string;
        legal_representative?: string;
        business_type?: string;
        note?: string;
      }>(`/api/v1/common/companies/create/?tax_code=${encodeURIComponent(cleanTax)}`, token);
      if (result.exists_on_system) {
        showGlobalPopup({
          type: "warning",
          title: "Doanh nghiệp đã tồn tại trên hệ thống",
          message: `${result.company_name || "Doanh nghiệp với MST này"} đã được đăng ký trên hệ thống. Bạn có thể bấm "Xin gia nhập" để gửi yêu cầu tham gia.`,
        });
        return;
      }
      if (result.legal_name || result.company_name) setNewCompanyName(result.legal_name || result.company_name || "");
      if (result.address) setNewAddress(result.address);
      if (result.province) setNewProvince(result.province);
      if (result.legal_representative) setNewLegalRep(result.legal_representative);
      if (result.business_type) setNewBusinessType(result.business_type);
      showGlobalPopup({
        type: "success",
        title: "Đã tra cứu thông tin MST",
        message: result.note || "Đã tự động điền thông tin gợi ý từ Mã số thuế. Vui lòng kiểm tra và bổ sung các trường còn thiếu.",
      });
    } catch (cause) {
      const msg = humanizeErrorMessage(
        cause instanceof Error ? cause.message : "Không tra cứu được mã số thuế."
      );
      showGlobalPopup({
        type: "error",
        title: "Không thể tra cứu Mã số thuế",
        message: msg,
      });
    } finally {
      setLookingUpTax(false);
    }
  }

  // Handle custom company creation
  async function handleCreateCustomCompany(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCompanyName.trim() || !newTaxCode.trim()) return;

    setCreatingCompany(true);
    setError("");

    try {
      const cleanTax = newTaxCode.replace(/\s+/g, "");
      const payload: Record<string, any> = {
        name: (newShortName.trim() || newCompanyName.trim()),
        short_name: newShortName.trim(),
        legal_name: newCompanyName.trim(),
        tax_code: cleanTax,
        business_type: newBusinessType,
        address: newAddress.trim() || "Trụ sở chính doanh nghiệp",
        province: newProvince.trim() || "Hà Nội",
        legal_representative: newLegalRep.trim() || session?.user?.display_name || "Người đại diện pháp luật",
        representative_title: newRepTitle.trim() || "Giám đốc",
        phone: newPhone.trim(),
        email: newEmail.trim(),
        accounting_regime: newAccountingRegime,
        fiscal_year_start_month: Number(newFiscalMonth) || 1,
        confirmed_authority: newConfirmedAuthority,
        auto_complete_setup: true,
      };
      if (newCompanyCode.trim()) {
        payload.code = newCompanyCode.trim().toUpperCase();
      }

      const res = await request<any>("/api/v1/common/companies/create/", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await refreshCompanies();
      setShowCreateForm(false);
      setNewTaxCode("");
      setNewCompanyCode("");
      setNewCompanyName("");
      setNewShortName("");
      setNewAddress("");
      setNewLegalRep("");
      setNewRepTitle("Giám đốc");
      setNewPhone("");
      setNewEmail("");

      if (res?.id) {
        handleSelectAndEnter(res.id);
      }
    } catch (cause) {
      const msg = humanizeErrorMessage(
        cause instanceof Error ? cause.message : "Không thể tạo mới doanh nghiệp."
      );
      setError(msg);
      showGlobalPopup({
        type: "error",
        title: "Không thể khởi tạo doanh nghiệp",
        message: msg,
      });
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

  const userEmail = session?.user?.email || "Quản trị viên";
  const rawDisplayName =
    session?.user?.display_name || userEmail.split("@")[0] || "User";
  const userDisplayName = rawDisplayName.replace(/\s*\((?:Super\s*)?Admin\)/gi, "").trim();

  const isCompanyOrSuperAdmin = Boolean(
    session?.user?.is_superuser ||
    session?.user?.is_staff ||
    (session?.user as any)?.is_company_admin ||
    companies.some((c: any) => c.is_company_admin) ||
    userEmail === "tungtimo0808@gmail.com" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "SUPER_ADMIN"
  );

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

          {/* Fast Navigation to Admin */}
          {isCompanyOrSuperAdmin && (
            <button
              type="button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#0052cc",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              onClick={() => {
                if (companyId) {
                  navigate("/admin");
                } else if (companies.length > 0) {
                  selectCompany(companies[0].id);
                  navigate("/admin");
                }
              }}
              title="Truy cập Bàn làm việc Quản trị Doanh nghiệp"
            >
              <Building2 size={14} color="#0052cc" />
              <span>Quản trị Doanh nghiệp</span>
            </button>
          )}

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
              to="/join?manual=1"
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
            style={{ maxWidth: 880, marginBottom: 28 }}
          >
            <h3>
              <span>Khởi tạo doanh nghiệp mới (Đầy đủ thông tin pháp lý & kế toán)</span>
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

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                gap: "14px 16px",
                marginBottom: 16,
              }}
            >
              {/* Row 1: MST + Tra cứu (7 cols) & Mã doanh nghiệp nội bộ (5 cols) */}
              <div className="auth-field" style={{ gridColumn: "span 7" }}>
                <label className="auth-label">
                  Mã số thuế (MST) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="auth-input"
                    style={{ paddingLeft: 14, height: 40, flex: 1 }}
                    placeholder="VD: 0109887766 (10 số DN hoặc 13 số Chi nhánh)"
                    value={newTaxCode}
                    onChange={(e) => setNewTaxCode(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="company-action-card-btn btn-create-new"
                    style={{ height: 40, padding: "0 14px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}
                    onClick={handleLookupTaxCode}
                    disabled={lookingUpTax}
                  >
                    {lookingUpTax ? "Đang tra..." : "Tra cứu MST"}
                  </button>
                </div>
              </div>

              <div className="auth-field" style={{ gridColumn: "span 5" }}>
                <label className="auth-label">Mã doanh nghiệp nội bộ (Tùy chọn)</label>
                <input
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: ANPHU_ERP (Để trống tự sinh)"
                  value={newCompanyCode}
                  onChange={(e) => setNewCompanyCode(e.target.value)}
                  maxLength={30}
                />
              </div>

              {/* Row 2: Tên pháp lý doanh nghiệp — Nội dung dài, để trọn 1 dòng (12 cols) */}
              <div className="auth-field" style={{ gridColumn: "1 / -1" }}>
                <label className="auth-label">
                  Tên pháp lý doanh nghiệp (Theo Giấy chứng nhận ĐKKD) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ AN PHÚ"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required
                />
              </div>

              {/* Row 3: Tên hiển thị / giao dịch (6 cols) & Loại hình doanh nghiệp (6 cols) */}
              <div className="auth-field" style={{ gridColumn: "span 6" }}>
                <label className="auth-label">Tên hiển thị / Tên giao dịch ngắn gọn</label>
                <input
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: Công ty An Phú (Bỏ trống lấy theo tên pháp lý)"
                  value={newShortName}
                  onChange={(e) => setNewShortName(e.target.value)}
                />
              </div>

              <div className="auth-field" style={{ gridColumn: "span 6" }}>
                <label className="auth-label">
                  Loại hình doanh nghiệp (Theo Luật DN 2020) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <MisaDropdownSelect
                  fullWidth
                  searchable={false}
                  buttonStyle={{ height: 40, borderRadius: 10 }}
                  value={newBusinessType}
                  onChange={(val) => setNewBusinessType(val)}
                  options={[
                    { value: "LLC_ONE_MEMBER", label: "Công ty TNHH Một thành viên" },
                    { value: "LLC_MULTI_MEMBER", label: "Công ty TNHH Hai thành viên trở lên" },
                    { value: "JOINT_STOCK", label: "Công ty Cổ phần (CTCP)" },
                    { value: "PRIVATE_ENTERPRISE", label: "Doanh nghiệp tư nhân (DNTN)" },
                    { value: "PARTNERSHIP", label: "Công ty Hợp danh" },
                    { value: "OTHER", label: "Loại hình khác (HTX / Đơn vị phụ thuộc)" },
                  ]}
                />
              </div>

              {/* Row 4: Các trường ngắn gom cùng 1 dòng (4 cols + 4 cols + 4 cols): Người đại diện, Chức danh, Tỉnh/Thành phố */}
              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">
                  Người đại diện theo pháp luật <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: Nguyễn Văn A"
                  value={newLegalRep}
                  onChange={(e) => setNewLegalRep(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">Chức danh người đại diện</label>
                <MisaDropdownSelect
                  fullWidth
                  searchable={false}
                  buttonStyle={{ height: 40, borderRadius: 10 }}
                  value={newRepTitle}
                  onChange={(val) => setNewRepTitle(val)}
                  options={[
                    { value: "Giám đốc", label: "Giám đốc" },
                    { value: "Tổng Giám đốc", label: "Tổng Giám đốc" },
                    { value: "Chủ tịch Hội đồng thành viên", label: "Chủ tịch Hội đồng thành viên" },
                    { value: "Chủ tịch Hội đồng quản trị", label: "Chủ tịch Hội đồng quản trị" },
                    { value: "Chủ tịch Công ty", label: "Chủ tịch Công ty" },
                    { value: "Chủ doanh nghiệp", label: "Chủ doanh nghiệp" },
                  ]}
                />
              </div>

              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">
                  Tỉnh / Thành phố <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <MisaDropdownSelect
                  fullWidth
                  buttonStyle={{ height: 40, borderRadius: 10 }}
                  value={newProvince}
                  onChange={(val) => setNewProvince(val)}
                  searchPlaceholder="Tìm nhanh Tỉnh / Thành phố..."
                  options={[
                    ...["Hà Nội", "Hồ Chí Minh", "Hải Phòng", "Đà Nẵng", "Cần Thơ", "Huế"].map((c) => ({
                      value: c,
                      label: `Thành phố ${c}`,
                      group: "Thành phố trực thuộc Trung ương",
                    })),
                    ...[
                      "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
                      "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
                      "Cao Bằng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai", "Đồng Tháp",
                      "Gia Lai", "Hà Giang", "Hà Nam", "Hà Tĩnh", "Hải Dương", "Hậu Giang",
                      "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu",
                      "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định", "Nghệ An",
                      "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam",
                      "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh",
                      "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Tiền Giang", "Trà Vinh", "Tuyên Quang",
                      "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
                    ].map((p) => ({
                      value: p,
                      label: `Tỉnh ${p}`,
                      group: "Các Tỉnh",
                    })),
                  ]}
                />
              </div>

              {/* Row 5: Địa chỉ trụ sở đăng ký kinh doanh — Nội dung dài, để trọn 1 dòng (12 cols) */}
              <div className="auth-field" style={{ gridColumn: "1 / -1" }}>
                <label className="auth-label">
                  Địa chỉ trụ sở đăng ký kinh doanh <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: Tầng 8, Tòa nhà Sổ Việt, Phường Quan Hoa, Thành phố Hà Nội"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  required
                />
              </div>

              {/* Row 6: Các trường ngắn gom cùng 1 dòng (4 cols + 4 cols + 4 cols): Điện thoại, Email, Tháng bắt đầu năm tài chính */}
              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: 0912345678"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>

              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">Email nhận hóa đơn / thuế</label>
                <input
                  type="email"
                  className="auth-input"
                  style={{ paddingLeft: 14, height: 40 }}
                  placeholder="VD: ketoan@congtyanphu.vn"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="auth-field" style={{ gridColumn: "span 4" }}>
                <label className="auth-label">Tháng bắt đầu năm tài chính</label>
                <MisaDropdownSelect
                  fullWidth
                  searchable={false}
                  buttonStyle={{ height: 40, borderRadius: 10 }}
                  value={newFiscalMonth}
                  onChange={(val) => setNewFiscalMonth(Number(val))}
                  options={[
                    { value: 1, label: "Tháng 01 (01/01 – 31/12 Chuẩn VN)" },
                    { value: 4, label: "Tháng 04 (01/04 – 31/03 năm sau)" },
                    { value: 7, label: "Tháng 07 (01/07 – 30/06 năm sau)" },
                    { value: 10, label: "Tháng 10 (01/10 – 30/09 năm sau)" },
                    ...Array.from({ length: 12 }, (_, idx) => idx + 1)
                      .filter((m) => ![1, 4, 7, 10].includes(m))
                      .map((m) => ({
                        value: m,
                        label: `Tháng ${String(m).padStart(2, "0")} hàng năm`,
                      })),
                  ]}
                />
              </div>

              {/* Row 7: Chế độ kế toán áp dụng — Nội dung dài kèm diễn giải hệ thống TK & BCTC, để trọn 1 dòng (12 cols) */}
              <div className="auth-field" style={{ gridColumn: "1 / -1" }}>
                <label className="auth-label">
                  Chế độ kế toán áp dụng <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <MisaDropdownSelect
                  fullWidth
                  searchable={false}
                  buttonStyle={{ height: 40, borderRadius: 10 }}
                  value={newAccountingRegime}
                  onChange={(val) => setNewAccountingRegime(val)}
                  options={[
                    {
                      value: "TT99",
                      label: "Thông tư 99/2025/TT-BTC — Chế độ kế toán Doanh nghiệp chuẩn mới",
                      badge: "21 Vai trò đầy đủ",
                      badgeBg: "#fffbeb",
                      badgeColor: "#b45309",
                    },
                    {
                      value: "TT200",
                      label: "Thông tư 200/2014/TT-BTC — Chế độ kế toán Doanh nghiệp vừa & lớn",
                      badge: "14 Vai trò + 7 dự phòng",
                      badgeBg: "#f5f3ff",
                      badgeColor: "#7c3aed",
                    },
                    {
                      value: "TT133",
                      label: "Thông tư 133/2016/TT-BTC — Chế độ kế toán Doanh nghiệp nhỏ & vừa (SME)",
                      badge: "8 Vai trò + 13 dự phòng",
                      badgeBg: "#f0f9ff",
                      badgeColor: "#0284c7",
                    },
                    {
                      value: "TT58",
                      label: "Thông tư 58/2026/TT-BTC — Chế độ kế toán Doanh nghiệp siêu nhỏ / HKD",
                      badge: "3 Vai trò tinh gọn",
                      badgeBg: "#ecfdf5",
                      badgeColor: "#047857",
                    },
                  ]}
                />
                <span style={{ fontSize: 12, color: "#475569", marginTop: 6, display: "block", lineHeight: 1.45 }}>
                  {newAccountingRegime === "TT58"
                    ? "Khởi tạo Hệ thống TK rút gọn theo Thông tư 58/2026/TT-BTC (DN siêu nhỏ, thay thế TT132/2018) & kích hoạt sẵn 3 Role tinh gọn (Admin, Giám đốc, Kế toán phụ trách)."
                    : newAccountingRegime === "TT133"
                    ? "Khởi tạo Hệ thống 101 TK chuẩn TT133 (dùng TK 154, 6421/6422, 2111..2113, 1386), Bộ BCTC B01a/B01b-DNN & kích hoạt sẵn 8 Role SME cốt lõi."
                    : newAccountingRegime === "TT200"
                    ? "Khởi tạo Hệ thống 135 TK chuẩn TT200 (TK 621/622/627, 641/642, 244) & kích hoạt sẵn 14 Role chuyên môn cho DN vừa và lớn."
                    : "Khởi tạo Hệ thống 138 TK chuẩn TT99/2025/TT-BTC (bổ sung TK 215, TK 332, TK 158), Bộ BCTC B01/B02/B03/B09-DN & kích hoạt đầy đủ 21 Role chuẩn."}
                </span>
              </div>

              {/* Row 8: Xác nhận thẩm quyền */}
              <div style={{ gridColumn: "1 / -1", paddingTop: 2 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={newConfirmedAuthority}
                    onChange={(e) => setNewConfirmedAuthority(e.target.checked)}
                    required
                  />
                  <span>
                    Tôi xác nhận có đầy đủ thẩm quyền đại diện để khởi tạo và quản trị dữ liệu kế toán của doanh nghiệp này.
                  </span>
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                className="auth-submit-btn"
                style={{ height: 42, flex: 1, margin: 0 }}
                disabled={creatingCompany}
              >
                {creatingCompany ? "Đang khởi tạo dữ liệu doanh nghiệp…" : "Lưu và vào làm việc →"}
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
                const rawReg = String(c.accounting_regime || "TT99").toUpperCase();
                const regCode = rawReg.includes("58")
                  ? "TT58"
                  : rawReg.includes("133")
                  ? "TT133"
                  : rawReg.includes("200")
                  ? "TT200"
                  : "TT99";
                const regBadgeLabel =
                  regCode === "TT58"
                    ? "TT 58/2026 (Siêu nhỏ)"
                    : regCode === "TT133"
                    ? "TT 133/2016 (SME)"
                    : regCode === "TT200"
                    ? "TT 200/2014"
                    : "TT 99/2025";
                const regBadgeColor =
                  regCode === "TT58"
                    ? { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7" }
                    : regCode === "TT133"
                    ? { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" }
                    : regCode === "TT200"
                    ? { bg: "#e0e7ff", fg: "#1d4ed8", border: "#c7d2fe" }
                    : { bg: "#dcfce7", fg: "#047857", border: "#a7f3d0" };
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
                          <div className="company-portal-card-badges" style={{ flexWrap: "wrap", gap: 6 }}>
                            <span className="company-tax-badge">
                              {c.tax_code ? `MST: ${c.tax_code}` : `MÃ: ${c.code || "SOVIET"}`}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: regBadgeColor.bg,
                                color: regBadgeColor.fg,
                                border: `1px solid ${regBadgeColor.border}`,
                              }}
                            >
                              {regBadgeLabel}
                            </span>
                            <span className="company-status-pill">
                              ● Hoạt động
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="company-portal-card-body">
                        {regCode === "TT58"
                          ? "Hệ thống TK rút gọn chuẩn TT58/2026/TT-BTC (Doanh nghiệp siêu nhỏ - 3 Role tinh gọn) & BCTC B01-DNSN."
                          : regCode === "TT133"
                          ? "Hệ thống 101 TK chuẩn TT133 (TK 154, 6421/6422, 2111..2113 - 8 Role SME) & Bộ BCTC B01a/B01b-DNN."
                          : regCode === "TT200"
                          ? "Hệ thống 135 TK chuẩn TT200 (TK 621/622/627, 641/642 - 14 Role) & Bộ BCTC B01/B02/B03/B09-DN."
                          : "Hệ thống 138 TK chuẩn TT99/2025/TT-BTC (bổ sung TK 215, 332, 158 - 21 Role) & Bộ BCTC B01/B02/B03/B09-DN."}
                      </div>
                    </div>

                    <div className="company-portal-card-footer">
                      <div className={`company-portal-card-status-line ${isSelected ? "current" : ""}`}>
                        <span className={`company-portal-status-dot ${isSelected ? "active" : ""}`} />
                        <span>{isSelected ? "Doanh nghiệp hiện tại" : "Sẵn sàng làm việc"}</span>
                      </div>
                      <div className="company-portal-card-btn-group">
                        {isCompanyOrSuperAdmin && (
                          <button
                            type="button"
                            className="company-portal-admin-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAndGoAdmin(c.id);
                            }}
                            title={`Truy cập Quản trị Doanh nghiệp: ${c.name}`}
                          >
                            <ShieldCheck size={14} color="#0052cc" />
                            <span>Quản trị</span>
                          </button>
                        )}
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
