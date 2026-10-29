import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ChevronDown,
  ChevronRight,
  Search,
  LayoutGrid,
  List,
  Crown,
  UserX,
  Briefcase,
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
  admin?: { id: string; display_name: string; email: string; phone: string } | null;
  created_at: string;
  updated_at: string;
}

interface PlatformUserRole {
  code: string;
  name: string;
  is_admin?: boolean;
}

interface PlatformUserMembership {
  company_id: string;
  company_code?: string;
  company_name: string;
  company_status?: string;
  status: string;
  roles?: PlatformUserRole[];
  is_company_admin?: boolean;
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
  memberships: PlatformUserMembership[];
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
  const navigate = useNavigate();
  const { token, session, restoring, selectCompany } = useApiSession();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [_loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
  const [userViewMode, setUserViewMode] = useState<"by_company" | "flat">("by_company");
  const [selectedUserGroup, setSelectedUserGroup] = useState<string>("ALL_COMPANIES");
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | "SUPER" | "COMPANY_ADMIN" | "STAFF" | "LOCKED">("ALL");
  const [sidebarCompanySearch, setSidebarCompanySearch] = useState<string>("");
  const [collapsedCompanyIds, setCollapsedCompanyIds] = useState<Record<string, boolean>>({});
  const [showEmptyCompanies, setShowEmptyCompanies] = useState<boolean>(false);

  // Assign Admin Modal
  const [showAssignAdminModal, setShowAssignAdminModal] = useState<boolean>(false);
  const [assignAdminCompany, setAssignAdminCompany] = useState<PlatformCompany | null>(null);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>("");

  // Create Company Modal
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState<boolean>(false);
  const [companyForm, setCompanyForm] = useState({
    code: "",
    name: "",
    tax_code: "",
    legal_representative: "",
    accounting_regime: "TT99",
    address: "",
    admin_user_id: "",
  });

  // Password Reset Modal
  const [resetUser, setResetUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");

  const resolveToken = () => {
    if (token) return token;
    const direct = localStorage.getItem("erp_token");
    if (direct) return direct;
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.token || parsed.access || "";
      }
    } catch {}
    return "";
  };

  // Load Platform Stats
  const loadPlatformStats = async () => {
    const t = resolveToken();
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
    const t = resolveToken();
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
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request("/api/v1/iam/platform/users/", t);
      setUsers(Array.isArray(res) ? res : res.results || []);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không tải được danh sách người dùng toàn cục." });
    }
  };

  useEffect(() => {
    if (restoring) return;
    const t = resolveToken();
    if (!t) {
      navigate("/login?next=/super-admin");
      return;
    }
    let active = true;
    setLoading(true);
    setAlertMsg(null);
    void Promise.allSettled([
      request<any>("/api/v1/iam/platform/stats/", t),
      request<any>("/api/v1/iam/platform/companies/", t),
      request<any>("/api/v1/iam/platform/users/", t),
    ]).then(([statsRes, compRes, userRes]) => {
      if (!active) return;
      if (statsRes.status === "fulfilled") {
        setMetrics(statsRes.value.metrics);
        setRecentLogs(statsRes.value.recent_logs || []);
        setServerTime(statsRes.value.server_time || "");
      } else {
        setAlertMsg({
          type: "error",
          text: statsRes.reason?.message || "Không thể tải dữ liệu Nền tảng Super Admin.",
        });
      }
      if (compRes.status === "fulfilled") {
        const val = compRes.value;
        setCompanies(Array.isArray(val) ? val : val.results || []);
      }
      if (userRes.status === "fulfilled") {
        const val = userRes.value;
        setUsers(Array.isArray(val) ? val : val.results || []);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token, restoring]);

  // Set Company Status
  const handleSetCompanyStatus = async (companyId: string, newStatus: string) => {
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/companies/${companyId}/set-status/`, t, {
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

  // Assign Company Admin / Owner
  const handleAssignAdminSubmit = async () => {
    const t = resolveToken();
    if (!t || !assignAdminCompany || !selectedAdminUserId) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/companies/${assignAdminCompany.id}/assign-company-admin/`, t, {
        method: "POST",
        body: JSON.stringify({ user_id: selectedAdminUserId }),
      });
      setAlertMsg({ type: "success", text: res.message || "Đã phân công Quản trị viên Doanh nghiệp thành công." });
      setShowAssignAdminModal(false);
      setAssignAdminCompany(null);
      setSelectedAdminUserId("");
      loadCompanies();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể phân công Quản trị viên." });
    }
  };

  // Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request("/api/v1/iam/platform/companies/create-company/", t, {
        method: "POST",
        body: JSON.stringify(companyForm),
      });
      setAlertMsg({ type: "success", text: res.message || "Tạo doanh nghiệp mới thành công." });
      setShowCreateCompanyModal(false);
      setCompanyForm({ code: "", name: "", tax_code: "", legal_representative: "", accounting_regime: "TT99", address: "", admin_user_id: "" });
      loadCompanies();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Lỗi khi tạo doanh nghiệp mới." });
    }
  };

  // Toggle Superuser
  const handleToggleSuperuser = async (user: PlatformUser) => {
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${user.id}/toggle-superuser/`, t, {
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
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${user.id}/toggle-active/`, t, {
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
    const t = resolveToken();
    if (!t || !resetUser) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/users/${resetUser.id}/reset-password/`, t, {
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

  const companyById = useMemo(() => {
    const map: Record<string, PlatformCompany> = {};
    for (const c of companies) {
      map[c.id] = c;
    }
    return map;
  }, [companies]);

  const normalizedUsers = useMemo(() => {
    return users.map((u) => {
      const dedupMap = new Map<string, PlatformUserMembership>();
      for (const m of u.memberships || []) {
        const comp = companyById[m.company_id];
        const code = m.company_code || comp?.code || "";
        const existing = dedupMap.get(m.company_id);
        const isCompAdmin =
          Boolean(m.is_company_admin) ||
          Boolean(comp?.admin && (comp.admin.email === u.email || comp.admin.display_name === u.display_name));
        if (!existing) {
          dedupMap.set(m.company_id, {
            ...m,
            company_code: code,
            company_name: m.company_name || comp?.name || "Doanh nghiệp",
            company_status: m.company_status || comp?.status || "ACTIVE",
            roles: m.roles || [],
            is_company_admin: isCompAdmin,
          });
        } else {
          if (isCompAdmin) existing.is_company_admin = true;
          const existingCodes = new Set((existing.roles || []).map((r) => r.code));
          for (const r of m.roles || []) {
            if (!existingCodes.has(r.code)) {
              existing.roles = [...(existing.roles || []), r];
            }
          }
        }
      }
      return {
        ...u,
        memberships: Array.from(dedupMap.values()),
      };
    });
  }, [users, companyById]);

  const userFilterCounts = useMemo(() => {
    let superCount = 0;
    let companyAdminCount = 0;
    let staffCount = 0;
    let lockedCount = 0;
    let unassignedCount = 0;
    for (const u of normalizedUsers) {
      if (u.is_superuser) superCount++;
      if (!u.is_active) lockedCount++;
      if (u.memberships.length === 0) unassignedCount++;
      const hasAdminRole = u.memberships.some((m) => m.is_company_admin);
      if (hasAdminRole) companyAdminCount++;
      if (u.memberships.length > 0 && !u.is_superuser) staffCount++;
    }
    return {
      all: normalizedUsers.length,
      superCount,
      companyAdminCount,
      staffCount,
      lockedCount,
      unassignedCount,
    };
  }, [normalizedUsers]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    return normalizedUsers.filter((u) => {
      if (userRoleFilter === "SUPER" && !u.is_superuser) return false;
      if (userRoleFilter === "COMPANY_ADMIN" && !u.memberships.some((m) => m.is_company_admin)) return false;
      if (userRoleFilter === "STAFF" && (u.memberships.length === 0 || u.is_superuser)) return false;
      if (userRoleFilter === "LOCKED" && u.is_active) return false;

      if (selectedUserGroup === "SUPER_ADMINS" && !u.is_superuser) return false;
      if (selectedUserGroup === "UNASSIGNED" && u.memberships.length > 0) return false;
      if (
        selectedUserGroup !== "ALL_COMPANIES" &&
        selectedUserGroup !== "SUPER_ADMINS" &&
        selectedUserGroup !== "UNASSIGNED"
      ) {
        if (!u.memberships.some((m) => m.company_id === selectedUserGroup)) return false;
      }

      if (!q) return true;
      const matchBasic =
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.display_name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q));
      if (matchBasic) return true;
      return u.memberships.some(
        (m) =>
          m.company_name.toLowerCase().includes(q) ||
          (m.company_code && m.company_code.toLowerCase().includes(q)) ||
          (m.roles || []).some((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
      );
    });
  }, [normalizedUsers, userSearch, userRoleFilter, selectedUserGroup]);

  const companyUserGroups = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        company: PlatformCompany;
        members: { user: PlatformUser; membership: PlatformUserMembership }[];
      }
    >();

    for (const c of companies) {
      groupsMap.set(c.id, { company: c, members: [] });
    }

    for (const u of filteredUsers) {
      for (const m of u.memberships) {
        let group = groupsMap.get(m.company_id);
        if (!group) {
          const fallbackCompany: PlatformCompany = {
            id: m.company_id,
            code: m.company_code || "DN",
            name: m.company_name,
            tax_code: "",
            status: m.company_status || "ACTIVE",
            legal_representative: "",
            members_count: 1,
            branches_count: 1,
            employees_count: 0,
            created_at: "",
            updated_at: "",
          };
          group = { company: fallbackCompany, members: [] };
          groupsMap.set(m.company_id, group);
        }
        group.members.push({ user: u, membership: m });
      }
    }

    const allGroups = Array.from(groupsMap.values());
    for (const g of allGroups) {
      g.members.sort((a, b) => {
        const aOwner = a.membership.is_company_admin ? 1 : 0;
        const bOwner = b.membership.is_company_admin ? 1 : 0;
        if (aOwner !== bOwner) return bOwner - aOwner;
        const aSuper = a.user.is_superuser ? 1 : 0;
        const bSuper = b.user.is_superuser ? 1 : 0;
        if (aSuper !== bSuper) return bSuper - aSuper;
        return a.user.display_name.localeCompare(b.user.display_name, "vi");
      });
    }

    allGroups.sort((a, b) => {
      if (b.members.length !== a.members.length) {
        return b.members.length - a.members.length;
      }
      return a.company.code.localeCompare(b.company.code, "vi");
    });

    return allGroups;
  }, [companies, filteredUsers]);

  const sidebarCompanies = useMemo(() => {
    const q = sidebarCompanySearch.toLowerCase().trim();
    const countsByCompany: Record<string, number> = {};
    for (const u of normalizedUsers) {
      for (const m of u.memberships) {
        countsByCompany[m.company_id] = (countsByCompany[m.company_id] || 0) + 1;
      }
    }
    return [...companies]
      .map((c) => ({
        ...c,
        actualUserCount: countsByCompany[c.id] || 0,
      }))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.tax_code && c.tax_code.includes(q)))
      .sort((a, b) => {
        if (b.actualUserCount !== a.actualUserCount) return b.actualUserCount - a.actualUserCount;
        return a.code.localeCompare(b.code, "vi");
      });
  }, [companies, normalizedUsers, sidebarCompanySearch]);

  const unassignedFilteredUsers = useMemo(() => {
    return filteredUsers.filter((u) => u.memberships.length === 0);
  }, [filteredUsers]);

  const getUserInitials = (name: string) => {
    const parts = (name || "U").trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const toggleCompanyCollapse = (companyId: string) => {
    setCollapsedCompanyIds((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const setAllCompaniesCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of companyUserGroups) {
      next[g.company.id] = collapsed;
    }
    next["__UNASSIGNED__"] = collapsed;
    setCollapsedCompanyIds(next);
  };

  if (restoring) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        <span style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải trung tâm điều hành nền tảng...</span>
        <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
                      <th>Chủ sở hữu (Admin)</th>
                      <th>Thành viên</th>
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
                        <td>
                          {c.admin ? (
                            <div>
                              <strong style={{ color: "#0369a1" }}>{c.admin.display_name}</strong>
                              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.admin.email || c.admin.phone}</div>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Chưa chỉ định</span>
                          )}
                        </td>
                        <td>{c.members_count} người</td>
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
                          <div style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              className="admin-btn admin-btn-primary admin-btn-sm"
                              onClick={() => {
                                if (selectCompany) selectCompany(c.id);
                                navigate("/");
                              }}
                              title="Vào không gian làm việc kế toán của doanh nghiệp này"
                            >
                              <ExternalLink size={13} /> Vào Workspace
                            </button>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => {
                                if (selectCompany) selectCompany(c.id);
                                navigate("/admin");
                              }}
                              title="Quản trị phân quyền doanh nghiệp này"
                            >
                              <ShieldCheck size={13} /> Quản trị
                            </button>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => {
                                setAssignAdminCompany(c);
                                setSelectedAdminUserId(c.admin?.id || "");
                                setShowAssignAdminModal(true);
                              }}
                              title="Chỉ định Chủ sở hữu (Company Admin)"
                            >
                              <Users size={13} /> Đổi Admin
                            </button>
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

        {/* ================= TAB 3: USERS (SMART COMPANY-GROUPED DIRECTORY) ================= */}
        {activeTab === "users" && (
          <div className="admin-users-layout">
            {/* LEFT SIDEBAR: COMPANY & GROUP DIRECTORY */}
            <aside className="admin-users-sidebar">
              <div className="admin-users-sidebar-header">
                <span className="admin-users-sidebar-title">
                  <Building2 size={15} /> Phân nhóm theo Công ty
                </span>
                <span className="admin-badge admin-badge-purple" style={{ fontSize: "0.7rem", padding: "2px 8px" }}>
                  {companies.length} DN
                </span>
              </div>
              <div className="admin-users-sidebar-search">
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, color: "#94a3b8" }} />
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: "100%", paddingLeft: 30, fontSize: "0.8rem" }}
                    placeholder="Lọc nhanh mã hoặc tên công ty..."
                    value={sidebarCompanySearch}
                    onChange={(e) => setSidebarCompanySearch(e.target.value)}
                  />
                  {sidebarCompanySearch && (
                    <button
                      type="button"
                      onClick={() => setSidebarCompanySearch("")}
                      style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-users-sidebar-list admin-custom-scroll">
                <div className="admin-users-sidebar-section-label">Nhóm tổng hợp</div>
                <button
                  type="button"
                  className={`admin-users-nav-item ${selectedUserGroup === "ALL_COMPANIES" ? "active" : ""}`}
                  onClick={() => setSelectedUserGroup("ALL_COMPANIES")}
                >
                  <div className="admin-users-nav-item-main">
                    <LayoutGrid size={15} />
                    <span className="admin-users-nav-name">Tất cả theo nhóm Công ty</span>
                  </div>
                  <span className="admin-users-nav-count">{userFilterCounts.all}</span>
                </button>
                <button
                  type="button"
                  className={`admin-users-nav-item ${selectedUserGroup === "SUPER_ADMINS" ? "active" : ""}`}
                  onClick={() => setSelectedUserGroup("SUPER_ADMINS")}
                >
                  <div className="admin-users-nav-item-main">
                    <ShieldCheck size={15} style={{ color: "#7c3aed" }} />
                    <span className="admin-users-nav-name">Ban Quản trị (Super Admin)</span>
                  </div>
                  <span className="admin-users-nav-count">{userFilterCounts.superCount}</span>
                </button>
                <button
                  type="button"
                  className={`admin-users-nav-item ${selectedUserGroup === "UNASSIGNED" ? "active" : ""}`}
                  onClick={() => setSelectedUserGroup("UNASSIGNED")}
                >
                  <div className="admin-users-nav-item-main">
                    <UserX size={15} style={{ color: "#d97706" }} />
                    <span className="admin-users-nav-name">Chưa tham gia Công ty</span>
                  </div>
                  <span className="admin-users-nav-count">{userFilterCounts.unassignedCount}</span>
                </button>

                <div className="admin-users-sidebar-section-label" style={{ marginTop: "0.4rem" }}>
                  Doanh nghiệp ({sidebarCompanies.length})
                </div>
                {sidebarCompanies.map((comp) => {
                  const isSelected = selectedUserGroup === comp.id;
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      className={`admin-users-nav-item ${isSelected ? "active" : ""}`}
                      onClick={() => setSelectedUserGroup(isSelected ? "ALL_COMPANIES" : comp.id)}
                      title={`${comp.code} - ${comp.name} (${comp.actualUserCount} thành viên)`}
                    >
                      <div className="admin-users-nav-item-main">
                        <span className="admin-users-nav-code">{comp.code}</span>
                        <span className="admin-users-nav-name">{comp.name}</span>
                      </div>
                      <span className="admin-users-nav-count">{comp.actualUserCount}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* RIGHT MAIN CONTENT */}
            <div>
              {/* SMART TOOLBAR */}
              <div className="admin-users-toolbar">
                <div className="admin-users-toolbar-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Users size={18} style={{ color: "#6d28d9" }} />
                      {selectedUserGroup === "ALL_COMPANIES"
                        ? "Nhân sự Phân bổ theo Doanh nghiệp"
                        : selectedUserGroup === "SUPER_ADMINS"
                        ? "Danh sách Quản trị viên Tối cao (Super Admin)"
                        : selectedUserGroup === "UNASSIGNED"
                        ? "Tài khoản Chưa phân vào Doanh nghiệp"
                        : `Nhân sự: ${companyById[selectedUserGroup]?.name || "Doanh nghiệp"}`}
                    </h3>
                    {selectedUserGroup !== "ALL_COMPANIES" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                        onClick={() => setSelectedUserGroup("ALL_COMPANIES")}
                      >
                        <X size={12} /> Bỏ lọc đơn vị
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div className="admin-segmented-control">
                      <button
                        type="button"
                        className={`admin-segmented-btn ${userViewMode === "by_company" ? "active" : ""}`}
                        onClick={() => setUserViewMode("by_company")}
                      >
                        <LayoutGrid size={14} /> Nhóm theo Công ty
                      </button>
                      <button
                        type="button"
                        className={`admin-segmented-btn ${userViewMode === "flat" ? "active" : ""}`}
                        onClick={() => setUserViewMode("flat")}
                      >
                        <List size={14} /> Bảng phẳng ({filteredUsers.length})
                      </button>
                    </div>

                    {userViewMode === "by_company" && selectedUserGroup === "ALL_COMPANIES" && (
                      <>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => setAllCompaniesCollapsed(false)}
                          title="Mở rộng tất cả các nhóm công ty"
                        >
                          Mở hết
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => setAllCompaniesCollapsed(true)}
                          title="Thu gọn tất cả các nhóm công ty"
                        >
                          Thu gọn
                        </button>
                      </>
                    )}

                    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={loadUsers}>
                      <RefreshCw size={13} /> Làm mới
                    </button>
                  </div>
                </div>

                <div className="admin-users-toolbar-row">
                  <div className="admin-filter-pills">
                    <button
                      type="button"
                      className={`admin-filter-pill ${userRoleFilter === "ALL" ? "active" : ""}`}
                      onClick={() => setUserRoleFilter("ALL")}
                    >
                      Tất cả ({userFilterCounts.all})
                    </button>
                    <button
                      type="button"
                      className={`admin-filter-pill ${userRoleFilter === "COMPANY_ADMIN" ? "active" : ""}`}
                      onClick={() => setUserRoleFilter("COMPANY_ADMIN")}
                    >
                      <Crown size={12} /> Chủ sở hữu / Admin DN ({userFilterCounts.companyAdminCount})
                    </button>
                    <button
                      type="button"
                      className={`admin-filter-pill ${userRoleFilter === "STAFF" ? "active" : ""}`}
                      onClick={() => setUserRoleFilter("STAFF")}
                    >
                      <Briefcase size={12} /> Nhân sự Kế toán ({userFilterCounts.staffCount})
                    </button>
                    <button
                      type="button"
                      className={`admin-filter-pill ${userRoleFilter === "SUPER" ? "active" : ""}`}
                      onClick={() => setUserRoleFilter("SUPER")}
                    >
                      <ShieldCheck size={12} /> Super Admin ({userFilterCounts.superCount})
                    </button>
                    {userFilterCounts.lockedCount > 0 && (
                      <button
                        type="button"
                        className={`admin-filter-pill ${userRoleFilter === "LOCKED" ? "active" : ""}`}
                        onClick={() => setUserRoleFilter("LOCKED")}
                      >
                        <Lock size={12} /> Đang khóa ({userFilterCounts.lockedCount})
                      </button>
                    )}
                  </div>

                  <div style={{ position: "relative", minWidth: "290px", flex: "0 1 340px" }}>
                    <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                      type="text"
                      className="admin-input"
                      style={{ width: "100%", paddingLeft: 32 }}
                      placeholder="Tìm theo Tên, Username/SĐT, Email, Vai trò..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                    {userSearch && (
                      <button
                        type="button"
                        onClick={() => setUserSearch("")}
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* VIEW MODE 1: GROUPED BY COMPANY */}
              {userViewMode === "by_company" && selectedUserGroup !== "SUPER_ADMINS" && selectedUserGroup !== "UNASSIGNED" ? (
                <div>
                  {companyUserGroups
                    .filter((g) => {
                      if (selectedUserGroup !== "ALL_COMPANIES") {
                        return g.company.id === selectedUserGroup;
                      }
                      if (userSearch.trim() || userRoleFilter !== "ALL") {
                        return g.members.length > 0;
                      }
                      return showEmptyCompanies || g.members.length > 0;
                    })
                    .map(({ company: comp, members }) => {
                      const isCollapsed = Boolean(collapsedCompanyIds[comp.id]);
                      return (
                        <div key={comp.id} className="admin-company-group-card">
                          <div
                            className={`admin-company-group-header ${isCollapsed ? "is-collapsed" : ""}`}
                            onClick={() => toggleCompanyCollapse(comp.id)}
                          >
                            <div className="admin-company-group-title-wrap">
                              <span style={{ color: "#64748b", display: "inline-flex" }}>
                                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                              </span>
                              <div className="admin-company-group-icon">
                                <Building2 size={17} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <span className="admin-company-group-code">{comp.code}</span>
                                  <h4 className="admin-company-group-name">{comp.name}</h4>
                                  <span
                                    className={`admin-badge ${
                                      comp.status === "ACTIVE"
                                        ? "admin-badge-active"
                                        : comp.status === "PENDING_SETUP"
                                        ? "admin-badge-pending"
                                        : "admin-badge-suspended"
                                    }`}
                                    style={{ fontSize: "0.68rem", padding: "1px 7px" }}
                                  >
                                    {comp.status}
                                  </span>
                                </div>
                                <div className="admin-company-group-sub">
                                  {comp.tax_code && <span>MST: <strong>{comp.tax_code}</strong></span>}
                                  <span>
                                    Chủ sở hữu:{" "}
                                    <strong>{comp.admin ? comp.admin.display_name : "Chưa chỉ định"}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="admin-badge admin-badge-blue" style={{ textTransform: "none" }}>
                                <Users size={12} /> {members.length} nhân sự
                              </span>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                onClick={() => {
                                  if (selectCompany) selectCompany(comp.id);
                                  navigate("/admin");
                                }}
                                title="Mở trang Quản trị & Phân quyền của doanh nghiệp này"
                              >
                                <ShieldCheck size={13} /> Quản trị DN
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-primary admin-btn-sm"
                                onClick={() => {
                                  if (selectCompany) selectCompany(comp.id);
                                  navigate("/");
                                }}
                                title="Vào Sổ kế toán của doanh nghiệp này"
                              >
                                <ExternalLink size={13} /> Sổ kế toán
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="admin-table-container">
                              {members.length === 0 ? (
                                <div style={{ padding: "1.25rem", textAlign: "center", color: "#64748b", fontSize: "0.84rem" }}>
                                  Doanh nghiệp này hiện chưa có nhân sự nào khớp bộ lọc.
                                </div>
                              ) : (
                                <table className="admin-table">
                                  <thead>
                                    <tr>
                                      <th>Nhân sự & Tài khoản</th>
                                      <th>Email liên hệ</th>
                                      <th>Vai trò tại {comp.code}</th>
                                      <th>Kiêm nhiệm DN khác</th>
                                      <th>Trạng thái</th>
                                      <th style={{ textAlign: "right" }}>Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {members.map(({ user: u, membership: m }) => {
                                      const otherMemberships = u.memberships.filter((om) => om.company_id !== comp.id);
                                      const roles = m.roles || [];
                                      return (
                                        <tr key={`${comp.id}-${u.id}`}>
                                          <td style={{ whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                                              <span
                                                className={`admin-user-avatar ${
                                                  u.is_superuser ? "is-super" : m.is_company_admin ? "is-owner" : ""
                                                }`}
                                              >
                                                {getUserInitials(u.display_name)}
                                              </span>
                                              <div>
                                                <div style={{ fontWeight: 700, color: "#0f172a" }}>{u.display_name}</div>
                                                <div style={{ fontSize: "0.74rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                                  <code>{u.username}</code>
                                                  {u.phone && u.phone !== u.username && <span>· {u.phone}</span>}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td>{u.email || "—"}</td>
                                          <td>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                                              {m.is_company_admin && (
                                                <span className="admin-badge admin-badge-gold" style={{ textTransform: "none", fontSize: "0.72rem" }}>
                                                  <Crown size={11} /> Quản trị viên DN
                                                </span>
                                              )}
                                              {roles
                                                .filter((r) => !r.is_admin)
                                                .map((r) => (
                                                  <span key={r.code} className="admin-badge-role">
                                                    {r.name}
                                                  </span>
                                                ))}
                                              {!m.is_company_admin && roles.length === 0 && (
                                                <span className="admin-badge-role" style={{ color: "#64748b" }}>
                                                  Thành viên
                                                </span>
                                              )}
                                              {u.is_superuser && (
                                                <span
                                                  className="admin-badge admin-badge-super"
                                                  style={{ backgroundColor: "#7c3aed", fontSize: "0.68rem", padding: "2px 7px" }}
                                                >
                                                  Super Admin
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td>
                                            {otherMemberships.length === 0 ? (
                                              <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>Chỉ thuộc DN này</span>
                                            ) : (
                                              <div
                                                style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", alignItems: "center" }}
                                                title={otherMemberships.map((om) => `${om.company_code || ""} - ${om.company_name}`).join("\n")}
                                              >
                                                {otherMemberships.slice(0, 2).map((om) => (
                                                  <span key={om.company_id} className="admin-company-chip">
                                                    <span className="admin-company-chip-code">{om.company_code || "DN"}</span>
                                                    <span style={{ maxWidth: 105, overflow: "hidden", textOverflow: "ellipsis" }}>
                                                      {om.company_name}
                                                    </span>
                                                  </span>
                                                ))}
                                                {otherMemberships.length > 2 && (
                                                  <span className="admin-badge admin-badge-purple" style={{ textTransform: "none", fontSize: "0.7rem" }}>
                                                    +{otherMemberships.length - 2} DN khác
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ whiteSpace: "nowrap" }}>
                                            <span className={`admin-badge ${u.is_active ? "admin-badge-active" : "admin-badge-suspended"}`}>
                                              {u.is_active ? "Đang mở" : "Bị khóa"}
                                            </span>
                                          </td>
                                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                                              <button
                                                type="button"
                                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                                onClick={() => handleToggleSuperuser(u)}
                                                title={u.is_superuser ? "Gỡ quyền Super Admin" : "Cấp quyền Super Admin"}
                                              >
                                                <ShieldCheck size={13} /> {u.is_superuser ? "Hạ quyền" : "Lên Super"}
                                              </button>
                                              <button
                                                type="button"
                                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                                onClick={() => handleToggleActive(u)}
                                                title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                              >
                                                {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                                              </button>
                                              <button
                                                type="button"
                                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                                onClick={() => {
                                                  setResetUser(u);
                                                  setNewPassword("");
                                                }}
                                                title="Đặt lại mật khẩu"
                                              >
                                                <KeyRound size={13} /> Đổi MK
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* UNASSIGNED USERS CARD AT BOTTOM OF GROUPED VIEW */}
                  {selectedUserGroup === "ALL_COMPANIES" && unassignedFilteredUsers.length > 0 && (
                    <div className="admin-company-group-card" style={{ borderColor: "#fde68a" }}>
                      <div
                        className={`admin-company-group-header ${collapsedCompanyIds["__UNASSIGNED__"] ? "is-collapsed" : ""}`}
                        style={{ background: "linear-gradient(90deg, #fffbeb 0%, #ffffff 100%)" }}
                        onClick={() => toggleCompanyCollapse("__UNASSIGNED__")}
                      >
                        <div className="admin-company-group-title-wrap">
                          <span style={{ color: "#b45309", display: "inline-flex" }}>
                            {collapsedCompanyIds["__UNASSIGNED__"] ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                          </span>
                          <div className="admin-company-group-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                            <UserX size={17} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className="admin-company-group-code" style={{ background: "#b45309" }}>CHƯA GÁN DN</span>
                              <h4 className="admin-company-group-name">Tài khoản Độc lập / Chưa tham gia Doanh nghiệp</h4>
                            </div>
                            <div className="admin-company-group-sub">
                              Các tài khoản hệ thống chưa được liên kết với bất kỳ công ty nào
                            </div>
                          </div>
                        </div>
                        <span className="admin-badge admin-badge-pending" style={{ textTransform: "none" }}>
                          {unassignedFilteredUsers.length} tài khoản
                        </span>
                      </div>
                      {!collapsedCompanyIds["__UNASSIGNED__"] && (
                        <div className="admin-table-container">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Tên hiển thị</th>
                                <th>Username / SĐT</th>
                                <th>Email</th>
                                <th>Quyền Hệ thống</th>
                                <th>Trạng thái</th>
                                <th style={{ textAlign: "right" }}>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unassignedFilteredUsers.map((u) => (
                                <tr key={u.id}>
                                  <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                                      <span className={`admin-user-avatar ${u.is_superuser ? "is-super" : ""}`}>
                                        {getUserInitials(u.display_name)}
                                      </span>
                                      <strong>{u.display_name}</strong>
                                    </div>
                                  </td>
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
                                  <td style={{ textAlign: "right" }}>
                                    <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-secondary admin-btn-sm"
                                        onClick={() => handleToggleSuperuser(u)}
                                      >
                                        <ShieldCheck size={13} /> {u.is_superuser ? "Hạ quyền" : "Lên Super"}
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-secondary admin-btn-sm"
                                        onClick={() => handleToggleActive(u)}
                                      >
                                        {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                                      </button>
                                      <button
                                        type="button"
                                        className="admin-btn admin-btn-secondary admin-btn-sm"
                                        onClick={() => {
                                          setResetUser(u);
                                          setNewPassword("");
                                        }}
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
                      )}
                    </div>
                  )}

                  {/* TOGGLE FOR EMPTY COMPANIES */}
                  {selectedUserGroup === "ALL_COMPANIES" &&
                    !userSearch.trim() &&
                    userRoleFilter === "ALL" &&
                    companyUserGroups.some((g) => g.members.length === 0) && (
                      <div style={{ textAlign: "center", marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => setShowEmptyCompanies((prev) => !prev)}
                        >
                          {showEmptyCompanies
                            ? "Ẩn các doanh nghiệp chưa có nhân sự"
                            : `Hiện thêm ${companyUserGroups.filter((g) => g.members.length === 0).length} doanh nghiệp chưa có nhân sự`}
                        </button>
                      </div>
                    )}
                </div>
              ) : (
                /* VIEW MODE 2: FLAT GLOBAL TABLE (OR SUPER_ADMINS / UNASSIGNED FILTER) */
                <div className="admin-card">
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Nhân sự</th>
                          <th>Username / SĐT</th>
                          <th>Email</th>
                          <th>Quyền Hệ thống</th>
                          <th>Trạng thái</th>
                          <th>Doanh nghiệp & Vai trò tham gia (Đã khử trùng lặp)</th>
                          <th style={{ textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                                <span className={`admin-user-avatar ${u.is_superuser ? "is-super" : ""}`}>
                                  {getUserInitials(u.display_name)}
                                </span>
                                <strong>{u.display_name}</strong>
                              </div>
                            </td>
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
                              {u.memberships.length > 0 ? (
                                <div
                                  style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}
                                  title={u.memberships
                                    .map((m) => `${m.company_code || "DN"} - ${m.company_name}`)
                                    .join("\n")}
                                >
                                  {u.memberships.slice(0, 3).map((m) => (
                                    <span key={m.company_id} className="admin-company-chip">
                                      <span className="admin-company-chip-code">{m.company_code || "DN"}</span>
                                      <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {m.company_name}
                                      </span>
                                      {m.is_company_admin && <Crown size={11} style={{ color: "#ca8a04" }} />}
                                    </span>
                                  ))}
                                  {u.memberships.length > 3 && (
                                    <span className="admin-badge admin-badge-purple" style={{ textTransform: "none", fontSize: "0.72rem" }}>
                                      +{u.memberships.length - 3} DN khác
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Chưa tham gia công ty</span>
                              )}
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => handleToggleSuperuser(u)}
                                  title={u.is_superuser ? "Gỡ quyền Super Admin" : "Cấp quyền Super Admin"}
                                >
                                  <ShieldCheck size={13} /> {u.is_superuser ? "Hạ quyền" : "Lên Super"}
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => handleToggleActive(u)}
                                  title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                >
                                  {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                                </button>
                                <button
                                  type="button"
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
              )}
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
                <div className="admin-form-group">
                  <label>Chỉ định Quản trị viên (Chủ sở hữu Workspace)</label>
                  <select
                    className="admin-select"
                    value={companyForm.admin_user_id}
                    onChange={(e) => setCompanyForm({ ...companyForm, admin_user_id: e.target.value })}
                  >
                    <option value="">-- Mặc định (Tài khoản Super Admin hiện tại) --</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.username} - {u.email || "Chưa có email"})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: "var(--admin-text-muted)", marginTop: "0.25rem", display: "block" }}>
                    Người dùng được chọn sẽ được gán vai trò Chủ sở hữu và toàn quyền quản trị workspace này.
                  </small>
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

      {/* MODAL: Chỉ định Quản trị viên Doanh nghiệp */}
      {showAssignAdminModal && assignAdminCompany && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Chỉ định Quản trị viên / Chủ sở hữu Doanh nghiệp</h3>
              <button className="admin-modal-close" onClick={() => setShowAssignAdminModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", marginBottom: "1rem" }}>
                Doanh nghiệp: <strong>{assignAdminCompany.name} ({assignAdminCompany.code})</strong>
              </p>
              <div className="admin-form-group">
                <label>Chọn người dùng làm Quản trị viên (Chủ sở hữu Workspace) (*)</label>
                <select
                  className="admin-select"
                  value={selectedAdminUserId}
                  onChange={(e) => setSelectedAdminUserId(e.target.value)}
                >
                  <option value="">-- Chọn người dùng --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} ({u.username} - {u.email || "Chưa có email"})
                    </option>
                  ))}
                </select>
                <small style={{ color: "var(--admin-text-muted)", marginTop: "0.4rem", display: "block" }}>
                  Người dùng được chọn sẽ được gán quyền Quản trị viên doanh nghiệp (COMPANY_ADMIN) và sở hữu toàn quyền không gian làm việc này.
                </small>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowAssignAdminModal(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={!selectedAdminUserId}
                onClick={handleAssignAdminSubmit}
              >
                Xác nhận gán Admin
              </button>
            </div>
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
