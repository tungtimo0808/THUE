import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Globe,
  Building2,
  Users,
  ShieldCheck,
  Server,
  Activity,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  ExternalLink,
  X,
  Check,
  Power,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./admin-workspaces.css";

type TabKey = "overview" | "companies" | "users" | "audit";

interface PlatformMetrics {
  total_companies: number;
  active_companies: number;
  pending_companies: number;
  suspended_companies: number;
  total_users: number;
  active_users: number;
  superusers: number;
  total_memberships: number;
  total_audit_logs: number;
}

interface PlatformCompany {
  id: string;
  code: string;
  name: string;
  legal_name?: string;
  tax_code: string;
  status: string;
  legal_representative: string;
  representative_title?: string;
  address?: string;
  accounting_regime?: string;
  members_count: number;
  branches_count: number;
  employees_count: number;
  created_at: string;
  updated_at: string;
}

interface PlatformUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  phone: string;
  is_active: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  memberships: { company_id: string; company_name: string; status: string }[];
}

interface RecentLog {
  id: string;
  action: string;
  module: string;
  actor: string;
  company_name: string;
  occurred_at: string;
}

export default function SuperAdminWorkspace() {
  const { token, session, restoring } = useApiSession();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [_loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (restoring) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        <span style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải trung tâm điều hành nền tảng...</span>
        <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Stats
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [serverTime, setServerTime] = useState<string>("");

  // Companies & Users
  const [companies, setCompanies] = useState<PlatformCompany[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);

  // Search & Filters
  const [companySearch, setCompanySearch] = useState<string>("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");

  // Create Company Modal
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState<boolean>(false);
  const [companyForm, setCompanyForm] = useState({
    code: "",
    name: "",
    tax_code: "",
    legal_representative: "",
    accounting_regime: "TT99",
    address: "",
  });

  // Password Reset Modal
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");

  // Load Platform Stats
  // Load Platform Stats
  const loadPlatformStats = async () => {
    const t = token || localStorage.getItem("erp_token") || "";
    if (!t) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      const statsRes: any = await request("/api/v1/iam/platform/stats/", t);
      setMetrics(statsRes.metrics);
      setRecentLogs(statsRes.recent_logs || []);
      setServerTime(statsRes.server_time || "");
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể tải dữ liệu Nền tảng Super Admin." });
    } finally {
      setLoading(false);
    }
  };

  // Load Companies
  const loadCompanies = async () => {
    const t = token || localStorage.getItem("erp_token") || "";
    if (!t) return;
    try {
      const res: any = await request("/api/v1/iam/platform/companies/", t);
      setCompanies(Array.isArray(res) ? res : res.results || []);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không tải được danh sách doanh nghiệp." });
    }
  };

  // Load Users
  const loadUsers = async () => {
    const t = token || localStorage.getItem("erp_token") || "";
    if (!t) return;
    try {
      const res: any = await request("/api/v1/iam/platform/users/", t);
      setUsers(Array.isArray(res) ? res : res.results || []);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không tải được danh sách người dùng toàn cục." });
    }
  };

  useEffect(() => {
    loadPlatformStats();
    loadCompanies();
    loadUsers();
  }, [token]);

  // Set Company Status
  const handleSetCompanyStatus = async (companyId: string, newStatus: string) => {
    if (!token) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/companies/${companyId}/set-status/`, token, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      setAlertMsg({ type: "success", text: res.message || `Đã chuyển trạng thái doanh nghiệp thành ${newStatus}.` });
      loadCompanies();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể đổi trạng thái doanh nghiệp." });
    }
  };

  // Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res: any = await request("/api/v1/iam/platform/companies/create-company/", token, {
        method: "POST",
        body: JSON.stringify(companyForm),
      });
      setAlertMsg({ type: "success", text: res.message || "Tạo doanh nghiệp mới thành công." });
      setShowCreateCompanyModal(false);
      setCompanyForm({ code: "", name: "", tax_code: "", legal_representative: "", accounting_regime: "TT99", address: "" });
      loadCompanies();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Lỗi khi tạo doanh nghiệp mới." });
    }
  };

  // Toggle Superuser
  const handleToggleSuperuser = async (user: PlatformUser) => {
    if (!token) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${user.id}/toggle-superuser/`, token, {
        method: "POST",
      });
      setAlertMsg({ type: "success", text: res.message || "Đã cập nhật quyền Super Admin." });
      loadUsers();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể thay đổi quyền Super Admin." });
    }
  };

  // Toggle Active/Lock
  const handleToggleActive = async (user: PlatformUser) => {
    if (!token) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${user.id}/toggle-active/`, token, {
        method: "POST",
      });
      setAlertMsg({ type: "success", text: res.message || "Đã cập nhật trạng thái tài khoản." });
      loadUsers();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể khóa/mở khóa tài khoản." });
    }
  };

  // Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !resetUser) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${resetUser.id}/reset-password/`, token, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword.trim() }),
      });
      setAlertMsg({ type: "success", text: res.message || "Đã đổi mật khẩu thành công." });
      setResetUser(null);
      setNewPassword("");
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể đặt lại mật khẩu." });
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = companySearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.tax_code && c.tax_code.toLowerCase().includes(q)) ||
        (c.legal_representative && c.legal_representative.toLowerCase().includes(q));
      const matchStatus = !companyStatusFilter || c.status === companyStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [companies, companySearch, companyStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    return users.filter((u) => {
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        u.phone.includes(q)
      );
    });
  }, [users, userSearch]);

  return (
    <div className="admin-workspace">
      {/* Super Admin Top Header */}
      <header className="admin-header admin-header-super">
        <div className="admin-header-content">
          <div>
            <div className="admin-header-title">
              <Globe size={24} />
              <h1>Trung tâm Điều hành Nền tảng (Platform Super Admin)</h1>
              <span className="admin-badge admin-badge-super">
                <ShieldCheck size={12} /> Tối cao (Superuser)
              </span>
            </div>
            <div className="admin-header-subtitle">
              <span>Trạng thái: <strong>HỆ THỐNG ONLINE 100%</strong></span>
              <span>Thời gian Server: <strong>{serverTime ? new Date(serverTime).toLocaleTimeString("vi-VN") : "Bình thường"}</strong></span>
              <span>Quản trị viên: <strong>{(session as any)?.username || (session as any)?.user?.username || "Super Admin"}</strong></span>
            </div>
          </div>
          <div className="admin-header-actions">
            <a
              href={`${window.location.protocol}//${window.location.hostname}:8080/admin/`}
              target="_blank"
              rel="noreferrer"
              className="admin-btn admin-btn-light"
              title="Mở bảng điều khiển Django Admin Panel chính thức"
            >
              <Database size={15} /> Django Admin Panel <ArrowUpRight size={14} />
            </a>
            <Link to="/" className="admin-btn admin-btn-light">
              <ExternalLink size={15} /> Về Ứng dụng Kế toán
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs Bar */}
      <nav className="admin-nav-bar">
        <button
          className={`admin-nav-tab admin-nav-tab-super ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Activity size={16} /> 1. Giám sát Nền tảng
        </button>
        <button
          className={`admin-nav-tab admin-nav-tab-super ${activeTab === "companies" ? "active" : ""}`}
          onClick={() => setActiveTab("companies")}
        >
          <Building2 size={16} /> 2. Quản lý Doanh nghiệp ({companies.length})
        </button>
        <button
          className={`admin-nav-tab admin-nav-tab-super ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          <Users size={16} /> 3. Người dùng Toàn cục ({users.length})
        </button>
        <button
          className={`admin-nav-tab admin-nav-tab-super ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <ShieldAlert size={16} /> 4. Nhật ký Toàn hệ thống
        </button>
      </nav>

      {/* Main Body */}
      <div className="admin-container">
        {alertMsg && (
          <div className={`admin-alert ${alertMsg.type === "success" ? "admin-alert-success" : "admin-alert-error"}`}>
            <span>{alertMsg.text}</span>
            <button
              onClick={() => setAlertMsg(null)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div>
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-blue">
                  <Building2 size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Tổng doanh nghiệp</h4>
                  <p>{metrics?.total_companies ?? "—"}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-green">
                  <CheckCircle2 size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Đang hoạt động</h4>
                  <p>{metrics?.active_companies ?? "—"}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-amber">
                  <AlertTriangle size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Chờ thiết lập</h4>
                  <p>{metrics?.pending_companies ?? "—"}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-purple">
                  <Users size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Tổng người dùng</h4>
                  <p>{metrics?.total_users ?? "—"}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-red">
                  <ShieldCheck size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Super Admins</h4>
                  <p>{metrics?.superusers ?? "—"}</p>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem" }}>
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <Building2 size={18} /> Doanh nghiệp Đăng ký Mới nhất
                  </h3>
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setActiveTab("companies")}>
                    Xem tất cả ({companies.length})
                  </button>
                </div>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Mã</th>
                        <th>Tên Doanh nghiệp</th>
                        <th>MST</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.slice(0, 5).map((comp) => (
                        <tr key={comp.id}>
                          <td><strong>{comp.code}</strong></td>
                          <td><strong>{comp.name}</strong></td>
                          <td>{comp.tax_code || "—"}</td>
                          <td>
                            <span
                              className={`admin-badge ${
                                comp.status === "ACTIVE"
                                  ? "admin-badge-active"
                                  : comp.status === "PENDING_SETUP"
                                  ? "admin-badge-pending"
                                  : "admin-badge-suspended"
                              }`}
                            >
                              {comp.status}
                            </span>
                          </td>
                          <td>
                            {comp.status !== "ACTIVE" && (
                              <button
                                className="admin-btn admin-btn-success admin-btn-sm"
                                onClick={() => handleSetCompanyStatus(comp.id, "ACTIVE")}
                              >
                                Kích hoạt
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <Server size={18} /> Hoạt động Nền tảng Gần đây
                  </h3>
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadPlatformStats}>
                    <RefreshCw size={12} /> Làm mới
                  </button>
                </div>
                <div className="admin-card-body" style={{ maxHeight: "380px", overflowY: "auto", padding: "0.75rem" }}>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {recentLogs.map((log) => (
                      <li
                        key={log.id}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          fontSize: "0.82rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <strong>{log.action}</strong>
                          <span style={{ color: "var(--admin-text-muted)", fontSize: "0.75rem" }}>
                            {new Date(log.occurred_at).toLocaleTimeString("vi-VN")}
                          </span>
                        </div>
                        <div style={{ color: "var(--admin-text-muted)", marginTop: "0.2rem" }}>
                          {log.actor} · <em>{log.company_name}</em>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: COMPANIES ================= */}
        {activeTab === "companies" && (
          <div>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>
                  <Building2 size={18} /> Danh sách Toàn bộ Doanh nghiệp (Tenants)
                </h3>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <div className="admin-search-bar">
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Tìm theo Tên, Mã, MST..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                    />
                    <select
                      className="admin-select"
                      value={companyStatusFilter}
                      onChange={(e) => setCompanyStatusFilter(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="ACTIVE">ACTIVE (Đang hoạt động)</option>
                      <option value="PENDING_SETUP">PENDING_SETUP (Chờ thiết lập)</option>
                      <option value="SUSPENDED">SUSPENDED (Tạm đình chỉ)</option>
                      <option value="INACTIVE">INACTIVE (Ngừng hoạt động)</option>
                    </select>
                  </div>
                  <button className="admin-btn admin-btn-primary" onClick={() => setShowCreateCompanyModal(true)}>
                    <Plus size={15} /> Thêm doanh nghiệp mới
                  </button>
                </div>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên Doanh nghiệp</th>
                      <th>Mã số thuế</th>
                      <th>Đại diện pháp luật</th>
                      <th>Thành viên</th>
                      <th>Chi nhánh</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.code}</strong></td>
                        <td><strong>{c.name}</strong></td>
                        <td>{c.tax_code || "—"}</td>
                        <td>{c.legal_representative || "—"}</td>
                        <td>{c.members_count} người</td>
                        <td>{c.branches_count} chi nhánh</td>
                        <td>
                          <span
                            className={`admin-badge ${
                              c.status === "ACTIVE"
                                ? "admin-badge-active"
                                : c.status === "PENDING_SETUP"
                                ? "admin-badge-pending"
                                : "admin-badge-suspended"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                            {c.status !== "ACTIVE" && (
                              <button
                                className="admin-btn admin-btn-success admin-btn-sm"
                                onClick={() => handleSetCompanyStatus(c.id, "ACTIVE")}
                                title="Kích hoạt hoạt động"
                              >
                                <Check size={13} /> Mở
                              </button>
                            )}
                            {c.status === "ACTIVE" && (
                              <button
                                className="admin-btn admin-btn-danger admin-btn-sm"
                                onClick={() => handleSetCompanyStatus(c.id, "SUSPENDED")}
                                title="Tạm đình chỉ doanh nghiệp"
                              >
                                <Power size={13} /> Khóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: USERS ================= */}
        {activeTab === "users" && (
          <div>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>
                  <Users size={18} /> Danh sách Người dùng Toàn cục (Global Users)
                </h3>
                <div className="admin-search-bar">
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Tìm theo Username, Email, Tên..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadUsers}>
                    <RefreshCw size={13} /> Làm mới
                  </button>
                </div>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tên hiển thị</th>
                      <th>Username / SĐT</th>
                      <th>Email</th>
                      <th>Quyền Super Admin</th>
                      <th>Trạng thái</th>
                      <th>Doanh nghiệp tham gia</th>
                      <th style={{ textAlign: "right" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.display_name}</strong></td>
                        <td><code>{u.username}</code></td>
                        <td>{u.email || "—"}</td>
                        <td>
                          {u.is_superuser ? (
                            <span className="admin-badge admin-badge-super" style={{ backgroundColor: "#7c3aed" }}>
                              Super Admin
                            </span>
                          ) : (
                            <span style={{ color: "var(--admin-text-muted)" }}>Người dùng thường</span>
                          )}
                        </td>
                        <td>
                          <span className={`admin-badge ${u.is_active ? "admin-badge-active" : "admin-badge-suspended"}`}>
                            {u.is_active ? "Đang mở" : "Bị khóa"}
                          </span>
                        </td>
                        <td>
                          {u.memberships.length > 0
                            ? u.memberships.map((m) => m.company_name).join(", ")
                            : "Chưa tham gia công ty"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => handleToggleSuperuser(u)}
                              title={u.is_superuser ? "Gỡ quyền Super Admin" : "Cấp quyền Super Admin"}
                            >
                              <ShieldCheck size={13} /> {u.is_superuser ? "Hạ quyền" : "Lên Super"}
                            </button>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => handleToggleActive(u)}
                              title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                            >
                              {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => {
                                setResetUser(u);
                                setNewPassword("");
                              }}
                              title="Đặt lại mật khẩu"
                            >
                              <KeyRound size={13} /> Đổi mật khẩu
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: AUDIT ================= */}
        {activeTab === "audit" && (
          <div>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>
                  <ShieldAlert size={18} /> Nhật ký Kiểm toán Hoạt động Toàn hệ thống
                </h3>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadPlatformStats}>
                  <RefreshCw size={13} /> Làm mới
                </button>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Người thực hiện</th>
                      <th>Doanh nghiệp</th>
                      <th>Phân hệ</th>
                      <th>Mã hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.occurred_at).toLocaleString("vi-VN")}</td>
                        <td><strong>{log.actor}</strong></td>
                        <td>{log.company_name}</td>
                        <td><code>{log.module}</code></td>
                        <td>
                          <span className="admin-badge admin-badge-active">{log.action}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Tạo doanh nghiệp mới */}
      {showCreateCompanyModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Tạo Doanh nghiệp Mới trên Nền tảng</h3>
              <button className="admin-modal-close" onClick={() => setShowCreateCompanyModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCompany}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Mã Doanh nghiệp (IN HOA) (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: CTY_XYZ, TECHVINA..."
                    required
                    value={companyForm.code}
                    onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Tên Doanh nghiệp (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: Công ty TNHH Giải pháp Công nghệ..."
                    required
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Mã số thuế</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="0109988776"
                    value={companyForm.tax_code}
                    onChange={(e) => setCompanyForm({ ...companyForm, tax_code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Người đại diện pháp luật</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Nguyễn Văn A"
                    value={companyForm.legal_representative}
                    onChange={(e) => setCompanyForm({ ...companyForm, legal_representative: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Chế độ kế toán áp dụng</label>
                  <select
                    className="admin-select"
                    value={companyForm.accounting_regime}
                    onChange={(e) => setCompanyForm({ ...companyForm, accounting_regime: e.target.value })}
                  >
                    <option value="TT99">Thông tư 99/2025/TT-BTC (Chính thức áp dụng từ 01/01/2026 - Chuẩn mực mới)</option>
                    <option value="TT200">Thông tư 200/2014/TT-BTC (Doanh nghiệp vừa và lớn)</option>
                    <option value="TT133">Thông tư 133/2016/TT-BTC (Doanh nghiệp vừa và nhỏ)</option>
                    <option value="TT88">Thông tư 88/2021/TT-BTC (Hộ kinh doanh)</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Địa chỉ trụ sở</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowCreateCompanyModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Tạo doanh nghiệp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Đổi mật khẩu người dùng */}
      {resetUser && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Đặt lại Mật khẩu cho {resetUser.username}</h3>
              <button className="admin-modal-close" onClick={() => setResetUser(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Mật khẩu mới (tối thiểu 6 ký tự) (*)</label>
                  <input
                    type="password"
                    className="admin-input"
                    placeholder="Nhập mật khẩu mới..."
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setResetUser(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
