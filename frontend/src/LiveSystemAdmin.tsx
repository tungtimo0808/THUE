import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  Users,
  GitPullRequest,
  Sliders,
  FileText,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  UserX,
  Copy,
  Eye,
  Shield,
  Layers,
  Calendar,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request, ApiError } from "./live-api";
import "./live-system.css";

type Tab = "company" | "users" | "workflows" | "config" | "audit";

export default function LiveSystemAdmin() {
  const [params, setParams] = useSearchParams();
  const { token, companyId, companies, selectCompany } = useApiSession();

  const activeTab: Tab = (params.get("tab") as Tab) || "company";
  const setTab = (t: Tab) => {
    setParams({ tab: t });
    setError("");
    setMessage("");
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // SYS-02: Company Information
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [editCompanyModal, setEditCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "",
    legal_name: "",
    business_type: "LLC_ONE_MEMBER",
    address: "",
    province: "",
    legal_representative: "",
    phone: "",
    email: "",
  });

  // SYS-03: Org Units
  const [orgUnits, setOrgUnits] = useState<any[]>([]);
  const [createUnitModal, setCreateUnitModal] = useState(false);
  const [unitForm, setUnitForm] = useState({ code: "", name: "", unit_type: "BRANCH" });

  // SYS-04: Join Requests
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [decideModal, setDecideModal] = useState<{ id: string; decision: "APPROVED" | "REJECTED" } | null>(null);
  const [decideReason, setDecideReason] = useState("");

  // SYS-05, 06, 07, 08, 09, 17, 18: Users, Roles, Scopes
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [dataScopes, setDataScopes] = useState<any[]>([]);
  const [userActionModal, setUserActionModal] = useState<{ user: any; action: "lock" | "unlock" | "terminate" } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [createRoleModal, setCreateRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({ code: "", name: "", description: "" });
  const [cloneRoleModal, setCloneRoleModal] = useState<any>(null);
  const [cloneForm, setCloneForm] = useState({ new_code: "", new_name: "" });

  // SYS-10, 11: Workflows & Tasks
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<any[]>([]);

  // SYS-12, 13, 14, 15: Config
  const [modules, setModules] = useState<any[]>([]);
  const [numberingRules, setNumberingRules] = useState<any[]>([]);
  const [numberPreview, setNumberPreview] = useState<string>("");
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);
  const [fiscalPeriods, setFiscalPeriods] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);

  // SYS-16: Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState({ module: "", query: "" });

  // Fetch data based on tab
  useEffect(() => {
    if (!token || !companyId) return;

    if (activeTab === "company") {
      loadCompanyData();
    } else if (activeTab === "users") {
      loadUsersAndRoles();
    } else if (activeTab === "workflows") {
      loadWorkflowsAndTasks();
    } else if (activeTab === "config") {
      loadConfigData();
    } else if (activeTab === "audit") {
      loadAuditLogs();
    }
  }, [token, companyId, activeTab]);

  async function loadCompanyData() {
    setLoading(true);
    try {
      const info = await request<any>(`/api/v1/organization/companies/${companyId}/information/?company_id=${companyId}`, token);
      setCompanyInfo(info.company || info);
      if (info.company) {
        setCompanyForm({
          name: info.company.name || "",
          legal_name: info.company.legal_name || "",
          business_type: info.company.business_type || "LLC_ONE_MEMBER",
          address: info.company.address || "",
          province: info.company.province || "",
          legal_representative: info.company.legal_representative || "",
          phone: info.company.phone || "",
          email: info.company.email || "",
        });
      }

      const units = await request<any>(`/api/v1/organization/structure/units/?company_id=${companyId}`, token);
      setOrgUnits(Array.isArray(units) ? units : units.results || []);

      const requests = await request<any>(`/api/v1/common/company-join-requests/?company_id=${companyId}`, token);
      setJoinRequests(Array.isArray(requests) ? requests : requests.results || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải thông tin doanh nghiệp");
    } finally {
      setLoading(false);
    }
  }

  async function loadUsersAndRoles() {
    setLoading(true);
    try {
      const u = await request<any>(`/api/v1/iam/users/?company_id=${companyId}`, token);
      setUsers(Array.isArray(u) ? u : u.results || []);

      const r = await request<any>(`/api/v1/iam/roles/?company_id=${companyId}`, token);
      setRoles(Array.isArray(r) ? r : r.results || []);

      const ds = await request<any>(`/api/v1/iam/data-scopes/?company_id=${companyId}`, token);
      setDataScopes(Array.isArray(ds) ? ds : ds.results || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách người dùng và vai trò");
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkflowsAndTasks() {
    setLoading(true);
    try {
      const wf = await request<any>(`/api/v1/approval-workflows/workflows/?company_id=${companyId}`, token);
      setWorkflows(Array.isArray(wf) ? wf : wf.results || []);

      const tasks = await request<any>(`/api/v1/approval-workflows/tasks/?company_id=${companyId}`, token);
      setApprovalTasks(Array.isArray(tasks) ? tasks : tasks.results || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu quy trình phê duyệt");
    } finally {
      setLoading(false);
    }
  }

  async function loadConfigData() {
    setLoading(true);
    try {
      const mods = await request<any>(`/api/v1/common/modules/?company_id=${companyId}`, token);
      setModules(Array.isArray(mods) ? mods : mods.results || []);

      const num = await request<any>(`/api/v1/common/numbering-rules/?company_id=${companyId}`, token);
      setNumberingRules(Array.isArray(num) ? num : num.results || []);

      const fy = await request<any>(`/api/v1/common/fiscal-years/?company_id=${companyId}`, token);
      setFiscalYears(Array.isArray(fy) ? fy : fy.results || []);

      const fp = await request<any>(`/api/v1/common/fiscal-periods/?company_id=${companyId}`, token);
      setFiscalPeriods(Array.isArray(fp) ? fp : fp.results || []);

      const pol = await request<any>(`/api/v1/common/accounting-policies/?company_id=${companyId}`, token);
      setPolicies(Array.isArray(pol) ? pol : pol.results || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải cấu hình hệ thống");
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    setLoading(true);
    try {
      const query = new URLSearchParams({ company_id: companyId! });
      if (auditFilter.module) query.set("module", auditFilter.module);
      if (auditFilter.query) query.set("q", auditFilter.query);
      const logs = await request<any>(`/api/v1/audit/logs/?${query}`, token);
      setAuditLogs(Array.isArray(logs) ? logs : logs.results || []);
    } catch (err: any) {
      setError(err.message || "Không thể tải nhật ký kiểm toán");
    } finally {
      setLoading(false);
    }
  }

  // SYS-02: Save Company Info
  async function handleUpdateCompany(e: FormEvent) {
    e.preventDefault();
    if (!companyInfo?.version) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await request(`/api/v1/organization/companies/${companyId}/information/?company_id=${companyId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ ...companyForm, version: companyInfo.version }),
      });
      setMessage("Cập nhật thông tin doanh nghiệp thành công (SYS-02)");
      setEditCompanyModal(false);
      loadCompanyData();
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật thông tin doanh nghiệp");
    } finally {
      setLoading(false);
    }
  }

  // SYS-03: Create Unit
  async function handleCreateUnit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const rootUnit = orgUnits.find(u => !u.parent) || orgUnits[0];
      const today = new Date().toISOString().slice(0, 10);
      await request(`/api/v1/organization/structure/units/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          ...unitForm,
          parent: rootUnit ? rootUnit.id : undefined,
          start_date: today,
        }),
      });
      setMessage(`Đã tạo đơn vị ${unitForm.name} thành công (SYS-03)`);
      setCreateUnitModal(false);
      setUnitForm({ code: "", name: "", unit_type: "BRANCH" });
      loadCompanyData();
    } catch (err: any) {
      setError(err.message || "Không thể tạo đơn vị cơ cấu");
    } finally {
      setLoading(false);
    }
  }

  // SYS-03: Deactivate / Reactivate Unit
  async function handleToggleUnitStatus(unit: any) {
    setLoading(true);
    try {
      const isDeactivating = unit.status === "ACTIVE";
      const action = isDeactivating ? "deactivate" : "reactivate";
      await request(`/api/v1/organization/structure/units/${unit.id}/${action}/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({ reason: isDeactivating ? "Tạm ngưng hoạt động" : "Kích hoạt lại đơn vị" }),
      });
      setMessage(`Đã cập nhật trạng thái đơn vị ${unit.name} (SYS-03)`);
      loadCompanyData();
    } catch (err: any) {
      setError(err.message || "Không thể đổi trạng thái đơn vị");
    } finally {
      setLoading(false);
    }
  }

  // SYS-04: Decide Join Request
  async function handleDecideJoinRequest(e: FormEvent) {
    e.preventDefault();
    if (!decideModal) return;
    setLoading(true);
    try {
      await request(`/api/v1/common/company-join-requests/${decideModal.id}/decide/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({ decision: decideModal.decision, reason: decideReason }),
      });
      setMessage(`Đã ${decideModal.decision === "APPROVED" ? "phê duyệt" : "từ chối"} yêu cầu tham gia (SYS-04)`);
      setDecideModal(null);
      setDecideReason("");
      loadCompanyData();
    } catch (err: any) {
      setError(err.message || "Không thể xử lý yêu cầu tham gia");
    } finally {
      setLoading(false);
    }
  }

  // SYS-06: Create Role
  async function handleCreateRole(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await request(`/api/v1/iam/roles/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          code: roleForm.code.trim(),
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
        }),
      });
      setMessage(`Đã tạo vai trò ${roleForm.name} thành công (SYS-06)`);
      setCreateRoleModal(false);
      setRoleForm({ code: "", name: "", description: "" });
      loadUsersAndRoles();
    } catch (err: any) {
      setError(err.message || "Không thể tạo vai trò");
    } finally {
      setLoading(false);
    }
  }

  // SYS-06: Clone Role
  async function handleCloneRole(e: FormEvent) {
    e.preventDefault();
    if (!cloneRoleModal) return;
    setLoading(true);
    try {
      await request(`/api/v1/iam/roles/${cloneRoleModal.id}/clone/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          code: cloneForm.new_code.trim(),
          name: cloneForm.new_name.trim(),
          description: cloneRoleModal.description || "",
          version: cloneRoleModal.version || cloneRoleModal.updated_at,
        }),
      });
      setMessage(`Đã nhân bản vai trò thành công (SYS-06)`);
      setCloneRoleModal(null);
      setCloneForm({ new_code: "", new_name: "" });
      loadUsersAndRoles();
    } catch (err: any) {
      setError(err.message || "Không thể nhân bản vai trò");
    } finally {
      setLoading(false);
    }
  }

  // SYS-17 & SYS-18: User Lock/Unlock/Terminate
  async function handleUserAction(e: FormEvent) {
    e.preventDefault();
    if (!userActionModal) return;
    setLoading(true);
    const { user, action } = userActionModal;
    try {
      if (action === "lock") {
        await request(`/api/v1/iam/users/${user.id}/lock/?company_id=${companyId}`, token, {
          method: "POST",
          body: JSON.stringify({ reason: actionReason || "Khóa tài khoản theo yêu cầu quản trị" }),
        });
        setMessage(`Đã khóa người dùng ${user.username || user.display_name} (SYS-17)`);
      } else if (action === "unlock") {
        await request(`/api/v1/iam/users/${user.id}/unlock/?company_id=${companyId}`, token, {
          method: "POST",
          body: JSON.stringify({ reason: actionReason || "Mở khóa tài khoản" }),
        });
        setMessage(`Đã mở khóa người dùng ${user.username || user.display_name} (SYS-17)`);
      } else if (action === "terminate") {
        await request(`/api/v1/iam/users/${user.id}/terminate-membership/?company_id=${companyId}`, token, {
          method: "POST",
          body: JSON.stringify({ reason: actionReason || "Ngừng quyền tham gia doanh nghiệp" }),
        });
        setMessage(`Đã ngừng quyền tham gia của ${user.username || user.display_name} (SYS-18)`);
      }
      setUserActionModal(null);
      setActionReason("");
      loadUsersAndRoles();
    } catch (err: any) {
      setError(err.message || `Thao tác ${action} thất bại`);
    } finally {
      setLoading(false);
    }
  }

  // SYS-11: Decide Approval Task
  async function handleDecideTask(task: any, decision: "APPROVE" | "REJECT") {
    setLoading(true);
    try {
      await request(`/api/v1/approval-workflows/tasks/${task.id}/decision/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({ decision, comment: `Đã ${decision === "APPROVE" ? "duyệt" : "từ chối"} từ giao diện quản trị` }),
      });
      setMessage(`Đã xử lý nhiệm vụ phê duyệt (SYS-11)`);
      loadWorkflowsAndTasks();
    } catch (err: any) {
      setError(err.message || "Không thể xử lý phê duyệt");
    } finally {
      setLoading(false);
    }
  }

  // SYS-12: Toggle Module
  async function handleToggleModule(module: any) {
    setLoading(true);
    try {
      const isEnabled = module.is_enabled;
      const action = isEnabled ? "disable" : "enable";
      await request(`/api/v1/common/modules/${module.code}/${action}/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify(isEnabled ? { reason: "Tạm tắt phân hệ" } : {}),
      });
      setMessage(`Đã ${isEnabled ? "tắt" : "bật"} phân hệ ${module.name} (SYS-12)`);
      loadConfigData();
    } catch (err: any) {
      setError(err.message || "Không thể thay đổi trạng thái phân hệ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="system-page">
      <div className="system-container">
        {/* Top Header */}
        <div className="system-topbar">
          <div className="system-topbar-left">
            <Link to="/" className="system-back-link">
              <ArrowLeft size={16} /> Màn hình chính
            </Link>
            <h1 className="system-title">Quản trị hệ thống (SYS-01..18)</h1>
            {companyInfo && (
              <span className="system-company-badge">
                {companyInfo.code} - {companyInfo.name}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Link to="/company-setup" className="system-btn system-btn-primary">
              <Plus size={14} /> Khởi tạo doanh nghiệp mới (SYS-01)
            </Link>
            <button className="system-btn" onClick={() => window.location.reload()} disabled={loading}>
              <RefreshCw size={14} /> Tải lại
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {error && <div className="system-alert system-alert-error">{error}</div>}
        {message && <div className="system-alert system-alert-success">{message}</div>}

        {/* Navigation Tabs */}
        <div className="system-tabs">
          <button
            className={`system-tab-btn ${activeTab === "company" ? "active" : ""}`}
            onClick={() => setTab("company")}
          >
            <Building2 size={16} /> Doanh nghiệp & Cơ cấu (SYS-01..04)
          </button>
          <button
            className={`system-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setTab("users")}
          >
            <Users size={16} /> Người dùng & Phân quyền (SYS-05..09, 17, 18)
          </button>
          <button
            className={`system-tab-btn ${activeTab === "workflows" ? "active" : ""}`}
            onClick={() => setTab("workflows")}
          >
            <GitPullRequest size={16} /> Quy trình phê duyệt (SYS-10..11)
          </button>
          <button
            className={`system-tab-btn ${activeTab === "config" ? "active" : ""}`}
            onClick={() => setTab("config")}
          >
            <Sliders size={16} /> Cấu hình hệ thống (SYS-12..15)
          </button>
          <button
            className={`system-tab-btn ${activeTab === "audit" ? "active" : ""}`}
            onClick={() => setTab("audit")}
          >
            <FileText size={16} /> Nhật ký Audit Log (SYS-16)
          </button>
        </div>

        {/* TAB 1: Doanh nghiệp & Cơ cấu */}
        {activeTab === "company" && (
          <div>
            {/* SYS-02: Company Profile */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Building2 size={18} /> UC-SYS-02: Thông tin doanh nghiệp
                </h2>
                <button
                  className="system-btn system-btn-primary"
                  onClick={() => setEditCompanyModal(true)}
                  disabled={loading}
                >
                  Chỉnh sửa thông tin
                </button>
              </div>
              {companyInfo ? (
                <div className="system-grid-2">
                  <div>
                    <p><strong>Mã doanh nghiệp:</strong> {companyInfo.code}</p>
                    <p><strong>Tên hiển thị:</strong> {companyInfo.name}</p>
                    <p><strong>Tên pháp lý:</strong> {companyInfo.legal_name || "—"}</p>
                    <p><strong>Mã số thuế:</strong> {companyInfo.tax_code || "—"}</p>
                  </div>
                  <div>
                    <p><strong>Địa chỉ:</strong> {companyInfo.address || "—"}</p>
                    <p><strong>Tỉnh / Thành phố:</strong> {companyInfo.province || "—"}</p>
                    <p><strong>Người đại diện:</strong> {companyInfo.legal_representative || "—"}</p>
                    <p><strong>Email / SĐT:</strong> {companyInfo.email || "—"} / {companyInfo.phone || "—"}</p>
                  </div>
                </div>
              ) : (
                <p>Đang tải thông tin doanh nghiệp...</p>
              )}
            </div>

            {/* SYS-03: Org Units */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Layers size={18} /> UC-SYS-03: Cơ cấu tổ chức
                </h2>
                <button
                  className="system-btn system-btn-primary"
                  onClick={() => setCreateUnitModal(true)}
                  disabled={loading}
                >
                  <Plus size={14} /> Thêm đơn vị cơ cấu
                </button>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Mã đơn vị</th>
                      <th>Tên đơn vị</th>
                      <th>Loại đơn vị</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUnits.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                          Chưa có đơn vị cơ cấu tổ chức nào.
                        </td>
                      </tr>
                    ) : (
                      orgUnits.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.code}</strong></td>
                          <td>{u.name}</td>
                          <td>{u.unit_type === "BRANCH" ? "Chi nhánh" : "Phòng ban"}</td>
                          <td>
                            <span className={`system-badge ${u.status === "ACTIVE" ? "system-badge-active" : "system-badge-inactive"}`}>
                              {u.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="system-btn system-btn-sm"
                              onClick={() => handleToggleUnitStatus(u)}
                              disabled={loading}
                            >
                              {u.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt lại"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SYS-04: Join Requests */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Users size={18} /> UC-SYS-04: Yêu cầu tham gia doanh nghiệp
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Người yêu cầu</th>
                      <th>Email / SĐT</th>
                      <th>Lời nhắn</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                      <th>Xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                          Không có yêu cầu tham gia nào.
                        </td>
                      </tr>
                    ) : (
                      joinRequests.map((req) => (
                        <tr key={req.id}>
                          <td><strong>{req.requester?.display_name || req.requester?.username || "—"}</strong></td>
                          <td>{req.requester?.email || req.requester?.phone || "—"}</td>
                          <td>{req.note || "—"}</td>
                          <td>{new Date(req.created_at).toLocaleString("vi-VN")}</td>
                          <td>
                            <span className={`system-badge ${req.status === "APPROVED" ? "system-badge-active" : req.status === "PENDING" ? "system-badge-pending" : "system-badge-locked"}`}>
                              {req.status}
                            </span>
                          </td>
                          <td>
                            {req.status === "PENDING" && (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  className="system-btn system-btn-sm system-btn-primary"
                                  onClick={() => setDecideModal({ id: req.id, decision: "APPROVED" })}
                                >
                                  Duyệt
                                </button>
                                <button
                                  className="system-btn system-btn-sm system-btn-danger"
                                  onClick={() => setDecideModal({ id: req.id, decision: "REJECTED" })}
                                >
                                  Từ chối
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Người dùng & Phân quyền */}
        {activeTab === "users" && (
          <div>
            {/* SYS-05, 17, 18: Users */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Users size={18} /> UC-SYS-05, 17, 18: Quản lý người dùng doanh nghiệp
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Tên đăng nhập</th>
                      <th>Tên hiển thị</th>
                      <th>Email / SĐT</th>
                      <th>Trạng thái</th>
                      <th>Thao tác quản trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isLocked = u.membership_status === "LOCKED" || u.status === "LOCKED";
                      const isTerminated = u.membership_status === "TERMINATED";
                      return (
                        <tr key={u.id}>
                          <td><strong>{u.username || u.auth_user?.username || u.id.slice(0, 8)}</strong></td>
                          <td>{u.display_name || u.auth_user?.first_name || "—"}</td>
                          <td>{u.email || u.auth_user?.email || "—"}</td>
                          <td>
                            <span className={`system-badge ${isLocked ? "system-badge-locked" : isTerminated ? "system-badge-inactive" : "system-badge-active"}`}>
                              {u.membership_status || u.status || "ACTIVE"}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              {!isLocked ? (
                                <button
                                  className="system-btn system-btn-sm"
                                  onClick={() => setUserActionModal({ user: u, action: "lock" })}
                                  title="Khóa User (SYS-17)"
                                >
                                  <Lock size={12} /> Khóa
                                </button>
                              ) : (
                                <button
                                  className="system-btn system-btn-sm system-btn-primary"
                                  onClick={() => setUserActionModal({ user: u, action: "unlock" })}
                                  title="Mở khóa User (SYS-17)"
                                >
                                  <Unlock size={12} /> Mở khóa
                                </button>
                              )}
                              {!isTerminated && (
                                <button
                                  className="system-btn system-btn-sm system-btn-danger"
                                  onClick={() => setUserActionModal({ user: u, action: "terminate" })}
                                  title="Ngừng quyền tham gia (SYS-18)"
                                >
                                  <UserX size={12} /> Ngừng tham gia
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SYS-06 & 07: Roles */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Shield size={18} /> UC-SYS-06 & 07: Vai trò và Phân quyền
                </h2>
                <button
                  className="system-btn system-btn-primary"
                  onClick={() => setCreateRoleModal(true)}
                  disabled={loading}
                >
                  <Plus size={14} /> Thêm vai trò mới (SYS-06)
                </button>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Mã vai trò</th>
                      <th>Tên vai trò</th>
                      <th>Mô tả</th>
                      <th>Quản trị hệ thống</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.code}</strong></td>
                        <td>{r.name}</td>
                        <td>{r.description || "—"}</td>
                        <td>{r.is_system_admin ? "✅ Có" : "—"}</td>
                        <td>
                          <span className={`system-badge ${r.status === "ACTIVE" ? "system-badge-active" : "system-badge-inactive"}`}>
                            {r.status || "ACTIVE"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="system-btn system-btn-sm"
                            onClick={() => {
                              setCloneRoleModal(r);
                              setCloneForm({ new_code: `${r.code}_COPY`, new_name: `${r.name} (Bản sao)` });
                            }}
                            title="Nhân bản vai trò (SYS-06)"
                          >
                            <Copy size={12} /> Nhân bản
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SYS-08: Data Scopes */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Layers size={18} /> UC-SYS-08: Thiết lập Data Scope
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Mã phạm vi</th>
                      <th>Tên phạm vi dữ liệu</th>
                      <th>Phạm vi áp dụng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataScopes.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                          Toàn bộ dữ liệu doanh nghiệp (mặc định)
                        </td>
                      </tr>
                    ) : (
                      dataScopes.map((ds) => (
                        <tr key={ds.id}>
                          <td><strong>{ds.code}</strong></td>
                          <td>{ds.name}</td>
                          <td>{ds.scope_type || "ALL"}</td>
                          <td>
                            <span className="system-badge system-badge-active">{ds.status || "ACTIVE"}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Quy trình & Phê duyệt */}
        {activeTab === "workflows" && (
          <div>
            {/* SYS-10: Workflows */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <GitPullRequest size={18} /> UC-SYS-10: Quản lý Workflow phê duyệt
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Mã quy trình</th>
                      <th>Tên quy trình</th>
                      <th>Loại chứng từ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                          Chưa có quy trình phê duyệt tùy chỉnh nào.
                        </td>
                      </tr>
                    ) : (
                      workflows.map((wf) => (
                        <tr key={wf.id}>
                          <td><strong>{wf.code}</strong></td>
                          <td>{wf.name}</td>
                          <td>{wf.document_type || "—"}</td>
                          <td>
                            <span className={`system-badge ${wf.is_active ? "system-badge-active" : "system-badge-inactive"}`}>
                              {wf.is_active ? "Đang áp dụng" : "Ngưng"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SYS-11: Tasks */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <CheckCircle size={18} /> UC-SYS-11: Xử lý yêu cầu phê duyệt
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Tiêu đề yêu cầu</th>
                      <th>Bước duyệt</th>
                      <th>Hạn xử lý</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalTasks.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                          Không có yêu cầu phê duyệt nào đang chờ xử lý.
                        </td>
                      </tr>
                    ) : (
                      approvalTasks.map((task) => (
                        <tr key={task.id}>
                          <td><strong>{task.title || `Yêu cầu #${task.id.slice(0, 8)}`}</strong></td>
                          <td>Bước {task.step_order || 1}</td>
                          <td>{task.due_at ? new Date(task.due_at).toLocaleDateString("vi-VN") : "—"}</td>
                          <td>
                            <span className="system-badge system-badge-pending">{task.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="system-btn system-btn-sm system-btn-primary"
                                onClick={() => handleDecideTask(task, "APPROVE")}
                                disabled={loading}
                              >
                                Duyệt
                              </button>
                              <button
                                className="system-btn system-btn-sm system-btn-danger"
                                onClick={() => handleDecideTask(task, "REJECT")}
                                disabled={loading}
                              >
                                Từ chối
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Cấu hình hệ thống */}
        {activeTab === "config" && (
          <div>
            {/* SYS-12: Modules */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <Sliders size={18} /> UC-SYS-12: Cấu hình phân hệ sử dụng
                </h2>
              </div>
              <div className="system-grid-2">
                {modules.map((m) => (
                  <div
                    key={m.code}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: m.is_enabled ? "#f8fafc" : "#ffffff",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>{m.name || m.code}</strong>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        Mã: {m.code}
                      </div>
                    </div>
                    <button
                      className={`system-btn system-btn-sm ${m.is_enabled ? "system-btn-danger" : "system-btn-primary"}`}
                      onClick={() => handleToggleModule(m)}
                      disabled={loading}
                    >
                      {m.is_enabled ? "Tắt phân hệ" : "Bật phân hệ"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SYS-13: Numbering Rules */}
            <div className="system-card">
              <div className="system-card-header">
                <h2 className="system-card-title">
                  <FileText size={18} /> UC-SYS-13: Cấu hình đánh số chứng từ
                </h2>
              </div>
              <div className="system-table-wrap">
                <table className="system-table">
                  <thead>
                    <tr>
                      <th>Loại chứng từ</th>
                      <th>Tiền tố (Prefix)</th>
                      <th>Độ dài số</th>
                      <th>Mẫu số</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {numberingRules.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                          Đang sử dụng quy tắc đánh số tiêu chuẩn hệ thống.
                        </td>
                      </tr>
                    ) : (
                      numberingRules.map((rule) => (
                        <tr key={rule.id}>
                          <td><strong>{rule.document_type}</strong></td>
                          <td>{rule.prefix || "—"}</td>
                          <td>{rule.number_length || 6}</td>
                          <td>{rule.sample || `${rule.prefix || "CT"}000001`}</td>
                          <td>
                            <span className="system-badge system-badge-active">{rule.status || "ACTIVE"}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SYS-14 & 15: Fiscal Period & Policies */}
            <div className="system-grid-2">
              <div className="system-card">
                <h2 className="system-card-title" style={{ marginBottom: "16px" }}>
                  <Calendar size={18} /> UC-SYS-14: Kỳ kế toán
                </h2>
                <p>Năm tài chính hiện tại: <strong>2026</strong></p>
                <p>Tháng bắt đầu: <strong>Tháng 1</strong></p>
                <p>Trạng thái kỳ: <span className="system-badge system-badge-active">ĐANG MỞ</span></p>
              </div>

              <div className="system-card">
                <h2 className="system-card-title" style={{ marginBottom: "16px" }}>
                  <Settings size={18} /> UC-SYS-15: Chính sách kế toán
                </h2>
                <p>Chế độ kế toán: <strong>Thông tư 200/2014/TT-BTC</strong></p>
                <p>Phương pháp tính giá xuất kho: <strong>Bình quân gia quyền</strong></p>
                <p>Phương pháp khấu hao TSCĐ: <strong>Đường thẳng</strong></p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Audit Log */}
        {activeTab === "audit" && (
          <div className="system-card">
            <div className="system-card-header">
              <h2 className="system-card-title">
                <FileText size={18} /> UC-SYS-16: Nhật ký Audit Log
              </h2>
              <button className="system-btn" onClick={loadAuditLogs} disabled={loading}>
                <RefreshCw size={14} /> Làm mới
              </button>
            </div>
            <div className="system-table-wrap">
              <table className="system-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Phân hệ</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                        Chưa có bản ghi nhật ký kiểm toán nào.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(log.created_at || log.timestamp).toLocaleString("vi-VN")}
                        </td>
                        <td><strong>{log.actor_email || log.actor_username || "Hệ thống"}</strong></td>
                        <td>
                          <span className="system-badge system-badge-pending">
                            {log.module_code || "SYS"}
                          </span>
                        </td>
                        <td><code>{log.action_code || log.action}</code></td>
                        <td>{log.entity_type || log.entity_name || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: Chỉnh sửa công ty (SYS-02) */}
        {editCompanyModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>Chỉnh sửa thông tin doanh nghiệp (SYS-02)</h3>
                <button className="system-btn system-btn-sm" onClick={() => setEditCompanyModal(false)}>✕</button>
              </div>
              <form onSubmit={handleUpdateCompany}>
                <div className="system-form-group">
                  <label>
                    Tên hiển thị
                    <input
                      className="system-input"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Tên pháp lý
                    <input
                      className="system-input"
                      value={companyForm.legal_name}
                      onChange={(e) => setCompanyForm({ ...companyForm, legal_name: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Địa chỉ trụ sở
                    <input
                      className="system-input"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Tỉnh / Thành phố
                    <input
                      className="system-input"
                      value={companyForm.province}
                      onChange={(e) => setCompanyForm({ ...companyForm, province: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Người đại diện theo pháp luật
                    <input
                      className="system-input"
                      value={companyForm.legal_representative}
                      onChange={(e) => setCompanyForm({ ...companyForm, legal_representative: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-grid-2">
                  <div className="system-form-group">
                    <label>
                      Số điện thoại
                      <input
                        className="system-input"
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="system-form-group">
                    <label>
                      Email
                      <input
                        className="system-input"
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setEditCompanyModal(false)}>Hủy</button>
                  <button type="submit" className="system-btn system-btn-primary" disabled={loading}>Lưu thông tin</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Thêm đơn vị cơ cấu (SYS-03) */}
        {createUnitModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>Thêm đơn vị cơ cấu tổ chức (SYS-03)</h3>
                <button className="system-btn system-btn-sm" onClick={() => setCreateUnitModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateUnit}>
                <div className="system-form-group">
                  <label>
                    Mã đơn vị
                    <input
                      className="system-input"
                      value={unitForm.code}
                      onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Tên đơn vị
                    <input
                      className="system-input"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Loại đơn vị
                    <select
                      className="system-select"
                      value={unitForm.unit_type}
                      onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
                    >
                      <option value="BRANCH">Chi nhánh</option>
                      <option value="DEPARTMENT">Phòng ban</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setCreateUnitModal(false)}>Hủy</button>
                  <button type="submit" className="system-btn system-btn-primary" disabled={loading}>Tạo đơn vị</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Duyệt/Từ chối tham gia (SYS-04) */}
        {decideModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>
                  {decideModal.decision === "APPROVED" ? "Phê duyệt" : "Từ chối"} yêu cầu tham gia (SYS-04)
                </h3>
                <button className="system-btn system-btn-sm" onClick={() => setDecideModal(null)}>✕</button>
              </div>
              <form onSubmit={handleDecideJoinRequest}>
                <div className="system-form-group">
                  <label>
                    Lý do / Ghi chú
                    <textarea
                      className="system-textarea"
                      rows={3}
                      value={decideReason}
                      onChange={(e) => setDecideReason(e.target.value)}
                      placeholder="Nhập lý do hoặc ghi chú quyết định..."
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setDecideModal(null)}>Hủy</button>
                  <button
                    type="submit"
                    className={`system-btn ${decideModal.decision === "APPROVED" ? "system-btn-primary" : "system-btn-danger"}`}
                    disabled={loading}
                  >
                    Xác nhận {decideModal.decision === "APPROVED" ? "phê duyệt" : "từ chối"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Thêm vai trò mới (SYS-06) */}
        {createRoleModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>Thêm vai trò mới (SYS-06)</h3>
                <button className="system-btn system-btn-sm" onClick={() => setCreateRoleModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateRole}>
                <div className="system-form-group">
                  <label>
                    Mã vai trò
                    <input
                      className="system-input"
                      value={roleForm.code}
                      onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Tên vai trò
                    <input
                      className="system-input"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Mô tả
                    <textarea
                      className="system-textarea"
                      rows={3}
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setCreateRoleModal(false)}>Hủy</button>
                  <button type="submit" className="system-btn system-btn-primary" disabled={loading}>Tạo vai trò</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Clone Role (SYS-06) */}
        {cloneRoleModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>Nhân bản vai trò {cloneRoleModal.name} (SYS-06)</h3>
                <button className="system-btn system-btn-sm" onClick={() => setCloneRoleModal(null)}>✕</button>
              </div>
              <form onSubmit={handleCloneRole}>
                <div className="system-form-group">
                  <label>
                    Mã vai trò mới
                    <input
                      className="system-input"
                      value={cloneForm.new_code}
                      onChange={(e) => setCloneForm({ ...cloneForm, new_code: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="system-form-group">
                  <label>
                    Tên vai trò mới
                    <input
                      className="system-input"
                      value={cloneForm.new_name}
                      onChange={(e) => setCloneForm({ ...cloneForm, new_name: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setCloneRoleModal(null)}>Hủy</button>
                  <button type="submit" className="system-btn system-btn-primary" disabled={loading}>Nhân bản</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: User Action (SYS-17 & SYS-18) */}
        {userActionModal && (
          <div className="system-modal-backdrop">
            <div className="system-modal">
              <div className="system-modal-header">
                <h3>
                  {userActionModal.action === "lock"
                    ? "Khóa tài khoản người dùng (SYS-17)"
                    : userActionModal.action === "unlock"
                    ? "Mở khóa tài khoản người dùng (SYS-17)"
                    : "Ngừng quyền tham gia doanh nghiệp (SYS-18)"}
                </h3>
                <button className="system-btn system-btn-sm" onClick={() => setUserActionModal(null)}>✕</button>
              </div>
              <p style={{ margin: "0 0 14px", fontSize: "14px", color: "#475569" }}>
                Người dùng: <strong>{userActionModal.user.username || userActionModal.user.display_name}</strong>
              </p>
              <form onSubmit={handleUserAction}>
                <div className="system-form-group">
                  <label>
                    Lý do thực hiện
                    <textarea
                      className="system-textarea"
                      rows={3}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      required
                      placeholder="Nhập lý do bắt buộc..."
                    />
                  </label>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
                  <button type="button" className="system-btn" onClick={() => setUserActionModal(null)}>Hủy</button>
                  <button
                    type="submit"
                    className={`system-btn ${userActionModal.action === "unlock" ? "system-btn-primary" : "system-btn-danger"}`}
                    disabled={loading}
                  >
                    Xác nhận
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
