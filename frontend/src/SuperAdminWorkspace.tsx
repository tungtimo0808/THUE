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
  Crown,
  UserX,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { humanizeErrorMessage, showGlobalPopup } from "./global-popup";
import MisaDropdownSelect from "./MisaDropdownSelect";
import { BrandMark } from "./components/BrandMark";
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
  const { restoring, selectCompany } = useApiSession();

  // Dedicated Super Admin Step-Up Auth State (isolated from regular user session)
  const [superAdminToken, setSuperAdminToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem("erp_superadmin_token") || "";
    } catch {
      return "";
    }
  });
  const [superAdminUser, setSuperAdminUser] = useState<{ username?: string; display_name?: string; email?: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem("erp_superadmin_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginIdentity, setLoginIdentity] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [_loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setRawAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const setAlertMsg = (val: { type: "success" | "error"; text: string } | null) => {
    if (!val) {
      setRawAlertMsg(null);
      return;
    }
    const cleanText = humanizeErrorMessage(val.text);
    setRawAlertMsg({ type: val.type, text: cleanText });
    showGlobalPopup({
      type: val.type,
      title: val.type === "error" ? "Thông báo lỗi" : "Thực hiện thành công",
      message: cleanText,
    });
  };

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
  const [showEmptyCompanies] = useState<boolean>(false);

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

  const resolveToken = () => superAdminToken;

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentity.trim() || !loginPassword) return;
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/v1/iam/platform/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginIdentity.trim(),
          identity: loginIdentity.trim(),
          password: loginPassword,
        }),
      });
      const res: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(res.detail || res.message || "Tài khoản hoặc mật khẩu Super Admin không chính xác.");
      }
      const tok = res.access || res.token || "";
      if (!tok) {
        throw new Error("Không nhận được token xác thực Super Admin.");
      }
      sessionStorage.setItem("erp_superadmin_token", tok);
      sessionStorage.setItem("erp_superadmin_user", JSON.stringify(res.user || { username: "admin", display_name: "Platform Super Admin" }));
      setSuperAdminToken(tok);
      setSuperAdminUser(res.user || { username: "admin", display_name: "Platform Super Admin" });
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err.message || "Tài khoản hoặc mật khẩu Super Admin không chính xác.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSuperAdminLogout = () => {
    sessionStorage.removeItem("erp_superadmin_token");
    sessionStorage.removeItem("erp_superadmin_user");
    setSuperAdminToken("");
    setSuperAdminUser(null);
    setMetrics(null);
    setCompanies([]);
    setUsers([]);
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
    if (!t) return;
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
        const errMsg = statsRes.reason?.message || "";
        if (errMsg.includes("401") || errMsg.includes("403") || errMsg.toLowerCase().includes("superuser") || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("xác thực")) {
          handleSuperAdminLogout();
          setLoginError("Phiên Super Admin đã hết hạn hoặc tài khoản không có quyền Super Admin. Vui lòng đăng nhập bằng tài khoản 'admin'.");
          return;
        }
        setAlertMsg({
          type: "error",
          text: errMsg || "Không thể tải dữ liệu Nền tảng Super Admin.",
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
  }, [superAdminToken, restoring]);

  // Set Company Status
  const handleSetCompanyStatus = async (companyId: string, newStatus: string) => {
    const t = resolveToken();
    if (!t) return;
    try {
      const res: any = await request(`/api/v1/iam/platform/companies/${companyId}/set-status/`, t, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
      const statusVn =
        newStatus === "ACTIVE"
          ? "Đang hoạt động"
          : newStatus === "SUSPENDED"
          ? "Tạm khóa"
          : newStatus === "PENDING_SETUP"
          ? "Chờ thiết lập"
          : "Ngừng hoạt động";
      setAlertMsg({ type: "success", text: res.message || `Đã chuyển trạng thái doanh nghiệp sang '${statusVn}'.` });
      loadCompanies();
      loadPlatformStats();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể đổi trạng thái doanh nghiệp." });
    }
  };

  const enterCompanyAsSuperAdmin = (targetCompanyId: string, destination: "/" | "/admin") => {
    const t = resolveToken();
    if (t) {
      const mappedCompanies = companies.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        tax_code: c.tax_code,
        status: c.status,
        accounting_regime: c.accounting_regime || "TT99",
        legal_representative: c.legal_representative || "",
        is_company_admin: true,
        is_platform_admin: true,
        role_codes: ["ROLE_ADMIN"],
        role_names: ["Quản trị doanh nghiệp"],
      }));
      const activeComp = mappedCompanies.find((c) => c.id === targetCompanyId) || mappedCompanies[0] || null;
      const sessionObj = {
        token: t,
        access: t,
        access_token: t,
        refresh: "",
        companyId: targetCompanyId,
        companies: mappedCompanies,
        company: activeComp,
        user: {
          username: "admin",
          email: "admin@soviet.vn",
          display_name: "Super Admin Hệ Thống",
          is_superuser: true,
        },
      };
      try {
        localStorage.setItem("erp_token", t);
        localStorage.setItem("erp_company_id", targetCompanyId);
        localStorage.setItem("erp_api_session", JSON.stringify(sessionObj));
        window.dispatchEvent(new CustomEvent("erp_api_token_changed", { detail: sessionObj }));
      } catch {}
    }
    if (selectCompany) selectCompany(targetCompanyId);
    navigate(destination);
  };

  const formatAuditActionLabel = (action: string) => {
    const map: Record<string, string> = {
      COMPANY_SETUP_COMPLETE: "Hoàn tất thiết lập doanh nghiệp",
      COMPANY_STATUS_CHANGE: "Thay đổi trạng thái doanh nghiệp",
      CREATE_COMPANY: "Khởi tạo doanh nghiệp mới",
      SCOPE_SWITCH: "Chuyển đổi phạm vi làm việc",
      USER_MEMBERSHIP_UPDATE: "Cập nhật hồ sơ thành viên",
      ROLE_CREATE: "Tạo vai trò mới",
      ROLE_EDIT: "Cập nhật vai trò",
      ROLE_CLONE: "Sao chép vai trò",
      ROLE_ASSIGN: "Phân công vai trò",
      ROLE_REVOKE: "Thu hồi vai trò",
      APPROVED: "Phê duyệt yêu cầu gia nhập",
      REJECTED: "Từ chối yêu cầu gia nhập",
      JOIN_REQUEST_EXPIRED: "Yêu cầu gia nhập hết hạn",
      LOGIN: "Đăng nhập hệ thống",
      LOGOUT: "Đăng xuất hệ thống",
      CREATE: "Tạo mới dữ liệu",
      UPDATE: "Cập nhật dữ liệu",
      DELETE: "Xóa dữ liệu",
    };
    return map[String(action || "").toUpperCase()] || action;
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

  const getUserInitials = (name: string) => {
    const parts = (name || "U").trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (restoring) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        <span style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải trung tâm điều hành nền tảng...</span>
        <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!superAdminToken) {
    return (
      <div className="admin-workspace">
        <div className="admin-topbar">
          <Link to="/" className="admin-topbar-brand">
            <BrandMark compact />
            <div className="admin-topbar-brand-text">
              <strong>SỔ VIỆT ERP</strong>
              <span>Kế toán & Thuế doanh nghiệp • Trung tâm Điều hành Nền tảng</span>
            </div>
          </Link>
          <div className="admin-topbar-right">
            <Link to="/select-company" className="admin-btn admin-btn-light admin-btn-sm">
              <Building2 size={14} /> Chọn doanh nghiệp
            </Link>
            <Link to="/" className="admin-btn admin-btn-light admin-btn-sm">
              ← Quay lại ứng dụng
            </Link>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 20px 56px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 448,
              background: "#ffffff",
              borderRadius: "var(--panel-radius, 12px)",
              border: "1px solid var(--border, #e1e8f3)",
              borderTop: "3px solid var(--brand, #2448d8)",
              boxShadow: "0 16px 36px -10px rgba(15, 23, 42, 0.1), 0 4px 12px -4px rgba(15, 23, 42, 0.05)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "26px 28px 20px",
                borderBottom: "1px solid var(--border, #e1e8f3)",
                background: "linear-gradient(180deg, #ffffff 0%, #f8faff 100%)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <BrandMark />
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--brand-ink, #172e94)",
                      background: "var(--brand-soft, #eef3ff)",
                      border: "1px solid var(--brand-border, #c2d3ff)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      marginBottom: 4,
                    }}
                  >
                    <ShieldCheck size={12} /> STEP-UP SECURITY • PLATFORM SUPERUSER
                  </span>
                  <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "#0f172a" }}>
                    Xác thực Super Admin Nền tảng
                  </h2>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                Khu vực điều hành toàn hệ thống yêu cầu xác thực độc lập bằng tài khoản quản trị tối cao (<strong>admin</strong>).
              </p>
            </div>

            <form onSubmit={handleSuperAdminLogin} style={{ padding: "24px 28px 26px" }}>
              {loginError && (
                <div
                  role="alert"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 14px",
                    background: "var(--danger-soft, #fff1f2)",
                    border: "1px solid #fecdd3",
                    borderRadius: 8,
                    color: "var(--danger, #be123c)",
                    fontSize: 12.5,
                    fontWeight: 500,
                    marginBottom: 18,
                    lineHeight: 1.45,
                  }}
                >
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{loginError}</span>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Tài khoản Super Admin
                </label>
                <input
                  type="text"
                  className="admin-input"
                  value={loginIdentity}
                  onChange={(e) => setLoginIdentity(e.target.value)}
                  placeholder="Nhập tài khoản Super Admin (admin)"
                  autoFocus
                  required
                  style={{ width: "100%", height: 42 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Mật khẩu Super Admin
                </label>
                <input
                  type="password"
                  className="admin-input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Nhập mật khẩu xác thực"
                  required
                  style={{ width: "100%", height: 42 }}
                />
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="admin-btn admin-btn-primary"
                style={{
                  width: "100%",
                  height: 44,
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              >
                <KeyRound size={16} />
                <span>{loggingIn ? "Đang xác thực quyền tối cao..." : "Đăng nhập Trung tâm Super Admin"}</span>
              </button>

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <span>Phiên độc lập với tài khoản Doanh nghiệp</span>
                <Link
                  to="/"
                  style={{
                    color: "var(--brand)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  ← Quay lại ứng dụng
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-workspace">
      {/* Outer-Web Unified Top Brand Bar */}
      <div className="admin-topbar">
        <Link to="/" className="admin-topbar-brand">
          <BrandMark compact />
          <div className="admin-topbar-brand-text">
            <strong>SỔ VIỆT ERP</strong>
            <span>Điều hành Nền tảng Đa Doanh nghiệp (Platform Console)</span>
          </div>
        </Link>
        <div className="admin-topbar-right">
          <span className="admin-badge admin-badge-active" style={{ textTransform: "none" }}>
            <CheckCircle2 size={12} /> Hệ thống Online • {companies.length} DN / {users.length} User
          </span>
          <Link to="/admin" className="admin-btn admin-btn-light admin-btn-sm">
            <Building2 size={14} /> Quản trị DN
          </Link>
          <Link to="/" className="admin-btn admin-btn-primary admin-btn-sm">
            <ExternalLink size={14} /> Bàn làm việc Kế toán
          </Link>
        </div>
      </div>

      {/* Super Admin Hero Strip */}
      <header className="admin-header admin-header-super">
        <div className="admin-header-content">
          <div>
            <div className="admin-header-title">
              <Globe size={22} />
              <h1>Trung tâm Điều hành Nền tảng (Platform Super Admin)</h1>
              <span className="admin-badge admin-badge-super">
                <ShieldCheck size={12} /> Superuser Tối cao
              </span>
            </div>
            <div className="admin-header-subtitle">
              <span>Trạng thái: <strong>HỆ THỐNG ONLINE 100%</strong></span>
              <span>Thời gian Server: <strong>{serverTime ? new Date(serverTime).toLocaleTimeString("vi-VN") : "Đồng bộ thực"}</strong></span>
              <span>Quản trị viên: <strong>{superAdminUser?.username || "admin"}</strong></span>
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
            <button
              type="button"
              onClick={handleSuperAdminLogout}
              className="admin-btn admin-btn-light"
              style={{ color: "var(--danger, #be123c)", borderColor: "#fecdd3" }}
              title="Đăng xuất khỏi phiên Super Admin"
            >
              <Lock size={15} /> Đăng xuất Super Admin
            </button>
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
                              {comp.status === "ACTIVE"
                                ? "Đang hoạt động"
                                : comp.status === "PENDING_SETUP"
                                ? "Chờ thiết lập"
                                : comp.status === "SUSPENDED"
                                ? "Tạm đình chỉ"
                                : "Ngừng hoạt động"}
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
                          fontSize: "13.1px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <strong>{formatAuditActionLabel(log.action)}</strong>
                          <span style={{ color: "var(--admin-text-muted)", fontSize: "12px" }}>
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
                    <MisaDropdownSelect
                      value={companyStatusFilter}
                      onChange={(val) => setCompanyStatusFilter(val)}
                      minWidth={195}
                      searchable={false}
                      options={[
                        { value: "", label: "Tất cả trạng thái" },
                        { value: "ACTIVE", label: "Đang hoạt động", badge: "Online", badgeBg: "#dcfce7", badgeColor: "#166534" },
                        { value: "PENDING_SETUP", label: "Chờ thiết lập", badge: "Chờ", badgeBg: "#fef3c7", badgeColor: "#92400e" },
                        { value: "SUSPENDED", label: "Tạm đình chỉ", badge: "Khóa", badgeBg: "#fee2e2", badgeColor: "#991b1b" },
                        { value: "INACTIVE", label: "Ngừng hoạt động", badge: "Ngừng", badgeBg: "#f1f5f9", badgeColor: "#475569" },
                      ]}
                    />
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
                              <strong style={{ color: "var(--brand-hover)" }}>{c.admin.display_name}</strong>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>{c.admin.email || c.admin.phone}</div>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "13.1px" }}>Chưa chỉ định</span>
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
                            {c.status === "ACTIVE"
                              ? "Đang hoạt động"
                              : c.status === "PENDING_SETUP"
                              ? "Chờ thiết lập"
                              : c.status === "SUSPENDED"
                              ? "Tạm đình chỉ"
                              : "Ngừng hoạt động"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <button
                              className="admin-btn admin-btn-primary admin-btn-sm"
                              onClick={() => enterCompanyAsSuperAdmin(c.id, "/")}
                              title="Vào không gian làm việc kế toán của doanh nghiệp này"
                            >
                              <ExternalLink size={13} /> Vào Workspace
                            </button>
                            <button
                              className="admin-btn admin-btn-secondary admin-btn-sm"
                              onClick={() => enterCompanyAsSuperAdmin(c.id, "/admin")}
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

        {/* ================= TAB 3: USERS (CLEAN MINIMALIST COMPANY DIRECTORY) ================= */}
        {activeTab === "users" && (
          <div className="admin-users-layout">
            {/* LEFT SIDEBAR: CLEAN DIRECTORY */}
            <aside className="admin-users-sidebar">
              <div className="admin-users-sidebar-header">
                <span className="admin-users-sidebar-title">
                  <Building2 size={16} style={{ color: "#2563eb" }} /> Danh mục Đơn vị
                </span>
                <span style={{ fontSize: "11.8px", color: "#64748b", fontWeight: 600 }}>
                  {companies.length} công ty
                </span>
              </div>
              <div className="admin-users-sidebar-search">
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, color: "#94a3b8" }} />
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: "100%", paddingLeft: 30, fontSize: "12.8px", background: "#f8fafc" }}
                    placeholder="Tìm công ty..."
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
                <div className="admin-users-sidebar-section-label">Tổng quan</div>
                <button
                  type="button"
                  className={`admin-users-nav-item ${selectedUserGroup === "ALL_COMPANIES" ? "active" : ""}`}
                  onClick={() => setSelectedUserGroup("ALL_COMPANIES")}
                >
                  <div className="admin-users-nav-item-main">
                    <LayoutGrid size={15} />
                    <span className="admin-users-nav-name">Tất cả theo Công ty</span>
                  </div>
                  <span className="admin-users-nav-count">{userFilterCounts.all}</span>
                </button>
                <button
                  type="button"
                  className={`admin-users-nav-item ${selectedUserGroup === "SUPER_ADMINS" ? "active" : ""}`}
                  onClick={() => setSelectedUserGroup("SUPER_ADMINS")}
                >
                  <div className="admin-users-nav-item-main">
                    <ShieldCheck size={15} />
                    <span className="admin-users-nav-name">Quản trị viên Hệ thống</span>
                  </div>
                  <span className="admin-users-nav-count">{userFilterCounts.superCount}</span>
                </button>
                {userFilterCounts.unassignedCount > 0 && (
                  <button
                    type="button"
                    className={`admin-users-nav-item ${selectedUserGroup === "UNASSIGNED" ? "active" : ""}`}
                    onClick={() => setSelectedUserGroup("UNASSIGNED")}
                  >
                    <div className="admin-users-nav-item-main">
                      <UserX size={15} />
                      <span className="admin-users-nav-name">Chưa thuộc công ty</span>
                    </div>
                    <span className="admin-users-nav-count">{userFilterCounts.unassignedCount}</span>
                  </button>
                )}

                <div className="admin-users-sidebar-section-label" style={{ marginTop: "0.35rem" }}>
                  Theo từng Doanh nghiệp
                </div>
                {sidebarCompanies
                  .filter((c) => sidebarCompanySearch.trim() || c.actualUserCount > 0)
                  .map((comp) => {
                    const isSelected = selectedUserGroup === comp.id;
                    return (
                      <button
                        key={comp.id}
                        type="button"
                        className={`admin-users-nav-item ${isSelected ? "active" : ""}`}
                        onClick={() => setSelectedUserGroup(isSelected ? "ALL_COMPANIES" : comp.id)}
                        title={`${comp.name} (${comp.code})`}
                      >
                        <div className="admin-users-nav-company-info">
                          <span className="admin-users-nav-name">{comp.name}</span>
                          <span className="admin-users-nav-meta">
                            Mã: {comp.code}
                            {comp.tax_code ? ` · MST: ${comp.tax_code}` : ""}
                          </span>
                        </div>
                        <span className="admin-users-nav-count">{comp.actualUserCount}</span>
                      </button>
                    );
                  })}
              </div>
            </aside>

            {/* RIGHT MAIN CONTENT */}
            <div>
              {/* SINGLE UNIFIED CLEAN TOOLBAR */}
              <div className="admin-users-toolbar">
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedUserGroup === "ALL_COMPANIES"
                      ? "Danh sách Nhân sự theo Doanh nghiệp"
                      : selectedUserGroup === "SUPER_ADMINS"
                      ? "Quản trị viên Hệ thống (Super Admin)"
                      : selectedUserGroup === "UNASSIGNED"
                      ? "Tài khoản Chưa thuộc Doanh nghiệp"
                      : companyById[selectedUserGroup]?.name || "Doanh nghiệp"}
                  </h3>
                  {selectedUserGroup !== "ALL_COMPANIES" && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary admin-btn-sm"
                      onClick={() => setSelectedUserGroup("ALL_COMPANIES")}
                    >
                      <X size={12} /> Xem tất cả công ty
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <div style={{ position: "relative", width: "260px" }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                    <input
                      type="text"
                      className="admin-input"
                      style={{ width: "100%", paddingLeft: 30 }}
                      placeholder="Tìm tên, username, email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                  </div>

                  <MisaDropdownSelect
                    value={userRoleFilter}
                    onChange={(val) => setUserRoleFilter(val as any)}
                    minWidth={225}
                    searchable={false}
                    options={[
                      { value: "ALL", label: `Tất cả vai trò (${userFilterCounts.all})` },
                      { value: "COMPANY_ADMIN", label: `Chủ sở hữu / Admin DN (${userFilterCounts.companyAdminCount})` },
                      { value: "STAFF", label: `Nhân sự Kế toán (${userFilterCounts.staffCount})` },
                      { value: "SUPER", label: `Super Admin (${userFilterCounts.superCount})` },
                      ...(userFilterCounts.lockedCount > 0
                        ? [{ value: "LOCKED", label: `Tài khoản bị khóa (${userFilterCounts.lockedCount})` }]
                        : []),
                    ]}
                  />

                  <MisaDropdownSelect
                    value={userViewMode}
                    onChange={(val) => setUserViewMode(val as "by_company" | "flat")}
                    minWidth={195}
                    searchable={false}
                    options={[
                      { value: "by_company", label: "Hiển thị: Theo Công ty" },
                      { value: "flat", label: "Hiển thị: Danh sách phẳng" },
                    ]}
                  />

                  <button type="button" className="admin-btn admin-btn-secondary" onClick={loadUsers} title="Làm mới">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* VIEW MODE 1: GROUPED BY COMPANY (CLEAN ACCORDION CARDS) */}
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
                    .map(({ company: comp, members }, groupIdx) => {
                      const defaultCollapsed =
                        selectedUserGroup === "ALL_COMPANIES" && !userSearch.trim() && groupIdx >= 2;
                      const isCollapsed =
                        comp.id in collapsedCompanyIds ? Boolean(collapsedCompanyIds[comp.id]) : defaultCollapsed;
                      return (
                        <div key={comp.id} className="admin-company-group-card">
                          <div
                            className={`admin-company-group-header ${isCollapsed ? "is-collapsed" : ""}`}
                            onClick={() =>
                              setCollapsedCompanyIds((prev) => ({
                                ...prev,
                                [comp.id]: !isCollapsed,
                              }))
                            }
                          >
                            <div className="admin-company-group-title-wrap">
                              <span style={{ color: "#64748b", display: "inline-flex" }}>
                                {isCollapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                              </span>
                              <div className="admin-company-group-icon">
                                <Building2 size={16} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <h4 className="admin-company-group-name">{comp.name}</h4>
                                <div className="admin-company-group-sub">
                                  <span>Mã: <strong>{comp.code}</strong></span>
                                  {comp.tax_code && <span>· MST: {comp.tax_code}</span>}
                                  {comp.admin && <span>· Quản trị: {comp.admin.display_name}</span>}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="admin-soft-pill admin-soft-pill-role">
                                {members.length} thành viên
                              </span>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                onClick={() => enterCompanyAsSuperAdmin(comp.id, "/admin")}
                              >
                                Quản trị DN
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                onClick={() => enterCompanyAsSuperAdmin(comp.id, "/")}
                              >
                                Mở Sổ kế toán
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="admin-table-container">
                              <table className="admin-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: "30%" }}>Nhân sự</th>
                                    <th style={{ width: "24%" }}>Liên hệ</th>
                                    <th style={{ width: "20%" }}>Vai trò & Quyền hạn</th>
                                    <th style={{ width: "12%" }}>Trạng thái</th>
                                    <th style={{ textAlign: "right", width: "14%" }}>Thao tác</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map(({ user: u, membership: m }) => {
                                    const otherCount = u.memberships.length - 1;
                                    const roles = (m.roles || []).filter((r) => !r.is_admin);
                                    return (
                                      <tr key={`${comp.id}-${u.id}`}>
                                        <td>
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                                            <span
                                              className={`admin-user-avatar ${
                                                u.is_superuser ? "is-super" : m.is_company_admin ? "is-owner" : ""
                                              }`}
                                            >
                                              {getUserInitials(u.display_name)}
                                            </span>
                                            <div>
                                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.display_name}</div>
                                              <div style={{ fontSize: "11.8px", color: "#64748b" }}>
                                                @{u.username}
                                                {otherCount > 0 && (
                                                  <span
                                                    title={u.memberships
                                                      .filter((om) => om.company_id !== comp.id)
                                                      .map((om) => `${om.company_code} - ${om.company_name}`)
                                                      .join("\n")}
                                                    style={{ color: "#94a3b8", cursor: "help" }}
                                                  >
                                                    {" "}· +{otherCount} DN khác
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                        <td>
                                          <div style={{ color: "#334155" }}>{u.email || "—"}</div>
                                          {u.phone && u.phone !== u.username && (
                                            <div style={{ fontSize: "11.8px", color: "#94a3b8" }}>{u.phone}</div>
                                          )}
                                        </td>
                                        <td>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                            {m.is_company_admin && (
                                              <span className="admin-soft-pill admin-soft-pill-owner">
                                                <Crown size={11} /> Quản trị viên DN
                                              </span>
                                            )}
                                            {roles.map((r) => (
                                              <span key={r.code} className="admin-soft-pill admin-soft-pill-role">
                                                {r.name}
                                              </span>
                                            ))}
                                            {!m.is_company_admin && roles.length === 0 && !u.is_superuser && (
                                              <span className="admin-soft-pill admin-soft-pill-role">
                                                Thành viên
                                              </span>
                                            )}
                                            {u.is_superuser && (
                                              <span className="admin-soft-pill admin-soft-pill-super">
                                                Super Admin
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td>
                                          <span className="admin-status-indicator">
                                            <span className={`admin-status-dot ${u.is_active ? "" : "is-locked"}`} />
                                            {u.is_active ? "Hoạt động" : "Đã khóa"}
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
                                              {u.is_superuser ? "Hạ quyền" : "Lên Super"}
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
                                              Đổi MK
                                            </button>
                                            <button
                                              type="button"
                                              className="admin-btn admin-btn-secondary admin-btn-sm"
                                              onClick={() => handleToggleActive(u)}
                                              title={u.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                                            >
                                              {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                /* VIEW MODE 2: CLEAN FLAT GLOBAL TABLE */
                <div className="admin-card">
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Nhân sự</th>
                          <th>Liên hệ</th>
                          <th>Doanh nghiệp trực thuộc</th>
                          <th>Quyền Hệ thống</th>
                          <th>Trạng thái</th>
                          <th style={{ textAlign: "right" }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                                <span className={`admin-user-avatar ${u.is_superuser ? "is-super" : ""}`}>
                                  {getUserInitials(u.display_name)}
                                </span>
                                <div>
                                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{u.display_name}</div>
                                  <div style={{ fontSize: "11.8px", color: "#64748b" }}>@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ color: "#334155" }}>{u.email || "—"}</div>
                              {u.phone && u.phone !== u.username && (
                                <div style={{ fontSize: "11.8px", color: "#94a3b8" }}>{u.phone}</div>
                              )}
                            </td>
                            <td>
                              {u.memberships.length > 0 ? (
                                <div>
                                  <div style={{ fontWeight: 500, color: "#1e293b" }}>
                                    {u.memberships[0].company_name}
                                  </div>
                                  {u.memberships.length > 1 && (
                                    <div
                                      style={{ fontSize: "11.8px", color: "#64748b", cursor: "help" }}
                                      title={u.memberships.map((m) => `${m.company_code} - ${m.company_name}`).join("\n")}
                                    >
                                      và +{u.memberships.length - 1} doanh nghiệp khác
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>Chưa thuộc công ty</span>
                              )}
                            </td>
                            <td>
                              {u.is_superuser ? (
                                <span className="admin-soft-pill admin-soft-pill-super">Super Admin</span>
                              ) : (
                                <span className="admin-soft-pill admin-soft-pill-role">Người dùng thường</span>
                              )}
                            </td>
                            <td>
                              <span className="admin-status-indicator">
                                <span className={`admin-status-dot ${u.is_active ? "" : "is-locked"}`} />
                                {u.is_active ? "Hoạt động" : "Đã khóa"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                              <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => handleToggleSuperuser(u)}
                                >
                                  {u.is_superuser ? "Hạ quyền" : "Lên Super"}
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => {
                                    setResetUser(u);
                                    setNewPassword("");
                                  }}
                                >
                                  Đổi MK
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  onClick={() => handleToggleActive(u)}
                                >
                                  {u.is_active ? <Lock size={13} /> : <Unlock size={13} />}
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
                          <span className="admin-badge admin-badge-active">{formatAuditActionLabel(log.action)}</span>
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
                  <MisaDropdownSelect
                    fullWidth
                    searchable={false}
                    value={companyForm.accounting_regime}
                    onChange={(val) => setCompanyForm({ ...companyForm, accounting_regime: val })}
                    options={[
                      { value: "TT99", label: "Thông tư 99/2025/TT-BTC (Chuẩn mực mới - 21 Vai trò)", badge: "21 Vai trò", badgeBg: "#fffbeb", badgeColor: "#b45309" },
                      { value: "TT200", label: "Thông tư 200/2014/TT-BTC (Doanh nghiệp vừa & lớn - 14 Vai trò)", badge: "14 Vai trò", badgeBg: "#f5f3ff", badgeColor: "#7c3aed" },
                      { value: "TT133", label: "Thông tư 133/2016/TT-BTC (Doanh nghiệp nhỏ & vừa SME - 8 Vai trò)", badge: "8 Vai trò", badgeBg: "#f0f9ff", badgeColor: "var(--brand)" },
                      { value: "TT58", label: "Thông tư 58/2026/TT-BTC (Doanh nghiệp siêu nhỏ - 3 Vai trò)", badge: "3 Vai trò", badgeBg: "#ecfdf5", badgeColor: "#047857" },
                      { value: "TT88", label: "Thông tư 88/2021/TT-BTC (Hộ kinh doanh cá thể)", badge: "HKD", badgeBg: "#f1f5f9", badgeColor: "#475569" },
                    ]}
                  />
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
                  <MisaDropdownSelect
                    fullWidth
                    value={companyForm.admin_user_id}
                    onChange={(val) => setCompanyForm({ ...companyForm, admin_user_id: val })}
                    searchPlaceholder="Tìm người dùng theo tên, email..."
                    options={[
                      { value: "", label: "-- Mặc định (Tài khoản Super Admin hiện tại) --" },
                      ...users.map((u) => ({
                        value: u.id,
                        label: `${u.display_name} (${u.email || u.username})`,
                      })),
                    ]}
                  />
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
              <p style={{ fontSize: "13.6px", color: "var(--admin-text-muted)", marginBottom: "1rem" }}>
                Doanh nghiệp: <strong>{assignAdminCompany.name} ({assignAdminCompany.code})</strong>
              </p>
              <div className="admin-form-group">
                <label>Chọn người dùng làm Quản trị viên (Chủ sở hữu Workspace) (*)</label>
                <MisaDropdownSelect
                  fullWidth
                  value={selectedAdminUserId}
                  onChange={(val) => setSelectedAdminUserId(val)}
                  searchPlaceholder="Tìm người dùng theo tên, email..."
                  options={[
                    { value: "", label: "-- Chọn người dùng --" },
                    ...users.map((u) => ({
                      value: u.id,
                      label: `${u.display_name} (${u.email || u.username})`,
                    })),
                  ]}
                />
                <small style={{ color: "var(--admin-text-muted)", marginTop: "0.4rem", display: "block" }}>
                  Người dùng được chọn sẽ được gán quyền Quản trị viên doanh nghiệp và sở hữu toàn quyền không gian làm việc này.
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
