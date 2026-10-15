import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Package,
  Layers,
  Scale,
  Warehouse,
  Landmark,
  BookOpen,
  Tags,
  Hash,
  Percent,
  Calendar,
  CreditCard,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request, ApiError } from "./live-api";
import "./live-master-data.css";

export type CatalogKey =
  | "customers"
  | "vendors"
  | "employees"
  | "items"
  | "categories"
  | "uoms"
  | "warehouses"
  | "bank_accounts"
  | "accounts"
  | "expense_items"
  | "statistical_codes"
  | "tax_types"
  | "payment_terms"
  | "payment_methods";

interface CatalogDef {
  key: CatalogKey;
  uc: string;
  name: string;
  icon: any;
  endpoint: string;
  targetKey: string; // for import/export
  codeField: string;
  nameField: string;
}

const CATALOGS: CatalogDef[] = [
  { key: "customers", uc: "UC-MD-01", name: "Khách hàng", icon: Users, endpoint: "/api/v1/master-data/customers/", targetKey: "customers", codeField: "code", nameField: "name" },
  { key: "vendors", uc: "UC-MD-02", name: "Nhà cung cấp", icon: Building2, endpoint: "/api/v1/master-data/parties/", targetKey: "suppliers", codeField: "code", nameField: "name" },
  { key: "employees", uc: "UC-MD-03", name: "Nhân viên", icon: Users, endpoint: "/api/v1/organization/employees/", targetKey: "employees", codeField: "employee_code", nameField: "full_name" },
  { key: "items", uc: "UC-MD-04", name: "Vật tư, hàng hóa", icon: Package, endpoint: "/api/v1/master-data/items/", targetKey: "items", codeField: "code", nameField: "name" },
  { key: "categories", uc: "UC-MD-05", name: "Nhóm HHDV", icon: Layers, endpoint: "/api/v1/master-data/item-categories/", targetKey: "item-categories", codeField: "code", nameField: "name" },
  { key: "uoms", uc: "UC-MD-06", name: "Đơn vị tính", icon: Scale, endpoint: "/api/v1/master-data/units-of-measure/", targetKey: "units-of-measure", codeField: "code", nameField: "name" },
  { key: "warehouses", uc: "UC-MD-07", name: "Kho", icon: Warehouse, endpoint: "/api/v1/master-data/warehouses/", targetKey: "warehouses", codeField: "code", nameField: "name" },
  { key: "bank_accounts", uc: "UC-MD-08", name: "Tài khoản ngân hàng", icon: Landmark, endpoint: "/api/v1/master-data/company-bank-accounts/", targetKey: "company-bank-accounts", codeField: "code", nameField: "account_name" },
  { key: "accounts", uc: "UC-MD-09", name: "Hệ thống tài khoản", icon: BookOpen, endpoint: "/api/v1/master-data/accounts/", targetKey: "accounts", codeField: "code", nameField: "name" },
  { key: "expense_items", uc: "UC-MD-10", name: "Khoản mục chi phí", icon: Tags, endpoint: "/api/v1/master-data/expense-items/", targetKey: "expense-items", codeField: "code", nameField: "name" },
  { key: "statistical_codes", uc: "UC-MD-11", name: "Mã thống kê", icon: Hash, endpoint: "/api/v1/master-data/statistical-codes/", targetKey: "statistical-codes", codeField: "code", nameField: "name" },
  { key: "tax_types", uc: "UC-MD-12", name: "Loại thuế & thuế suất", icon: Percent, endpoint: "/api/v1/master-data/tax-types/", targetKey: "tax-types", codeField: "code", nameField: "name" },
  { key: "payment_terms", uc: "UC-MD-13", name: "Điều khoản thanh toán", icon: Calendar, endpoint: "/api/v1/master-data/payment-terms/", targetKey: "payment-terms", codeField: "code", nameField: "name" },
  { key: "payment_methods", uc: "UC-MD-14", name: "Phương thức thanh toán", icon: CreditCard, endpoint: "/api/v1/master-data/payment-methods/", targetKey: "payment-methods", codeField: "code", nameField: "name" },
];

export default function LiveMasterData({
  initialCatalog,
  onBack,
}: {
  initialCatalog?: string | null;
  onBack?: () => void;
}) {
  const { token, companyId, companies, selectCompany } = useApiSession();

  // Find matching catalog from initialName
  const getInitialKey = (): CatalogKey => {
    if (!initialCatalog) return "customers";
    const found = CATALOGS.find((c) =>
      c.name.toLowerCase().includes(initialCatalog.toLowerCase()) ||
      c.key.toLowerCase().includes(initialCatalog.toLowerCase())
    );
    return found ? found.key : "customers";
  };

  const [activeCatalog, setActiveCatalog] = useState<CatalogKey>(getInitialKey());
  const currentDef = CATALOGS.find((c) => c.key === activeCatalog) || CATALOGS[0];
  const detailedRoutes: Partial<Record<CatalogKey, string>> = {
    customers: "/customers", vendors: "/vendors", employees: "/employees", items: "/items", categories: "/item-categories", uoms: "/uoms", warehouses: "/warehouses", bank_accounts: "/company-bank-accounts", accounts: "/accounts", expense_items: "/expense-items", statistical_codes: "/statistical-codes", tax_types: "/tax-types", payment_terms: "/payment-terms", payment_methods: "/payment-methods",
  };

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  // Aux data for foreign keys
  const [branches, setBranches] = useState<any[]>([]);
  const [uoms, setUoms] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<any[]>([]);
  const [coas, setCoas] = useState<any[]>([]);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<any | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);

  // Form draft
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDupMode, setImportDupMode] = useState("SKIP");
  const [importErrorMode, setImportErrorMode] = useState("ATOMIC");
  const [importBatch, setImportBatch] = useState<any | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);

  // Export state
  const [exportEstimate, setExportEstimate] = useState<any | null>(null);

  // Load auxiliary data once
  useEffect(() => {
    if (!token || !companyId) return;
    async function loadAux() {
      try {
        const br = await request<any>(`/api/v1/organization/branches/?company_id=${companyId}`, token).catch(() => []);
        setBranches(Array.isArray(br) ? br : br.results || []);

        const u = await request<any>(`/api/v1/master-data/units-of-measure/?company_id=${companyId}`, token).catch(() => []);
        setUoms(Array.isArray(u) ? u : u.results || []);

        const b = await request<any>(`/api/v1/master-data/banks/?company_id=${companyId}`, token).catch(() => []);
        setBanks(Array.isArray(b) ? b : b.results || []);

        const curr = await request<any>(`/api/v1/master-data/currencies/?company_id=${companyId}`, token).catch(() => []);
        setCurrencies(Array.isArray(curr) ? curr : curr.results || []);

        const acc = await request<any>(`/api/v1/master-data/accounts/?company_id=${companyId}`, token).catch(() => []);
        setGlAccounts(Array.isArray(acc) ? acc : acc.results || []);

        const coaList = await request<any>(`/api/v1/master-data/charts-of-accounts/?company_id=${companyId}`, token).catch(() => []);
        setCoas(Array.isArray(coaList) ? coaList : coaList.results || []);
      } catch {}
    }
    loadAux();
  }, [token, companyId]);

  // Load catalog items whenever activeCatalog or companyId changes
  useEffect(() => {
    if (!token || !companyId) return;
    loadCatalogItems();
  }, [token, companyId, activeCatalog]);

  async function loadCatalogItems() {
    setLoading(true);
    setError("");
    try {
      let url = `${currentDef.endpoint}?company_id=${companyId}`;
      const res = await request<any>(url, token);
      const list = Array.isArray(res) ? res : res.results || [];
      setItems(list);
    } catch (err: any) {
      setError(err.message || `Không thể tải danh mục ${currentDef.name}`);
    } finally {
      setLoading(false);
    }
  }

  // Filter items
  const filtered = items.filter((item) => {
    const code = String(item[currentDef.codeField] || "").toLowerCase();
    const name = String(item[currentDef.nameField] || "").toLowerCase();
    const q = query.toLowerCase();
    return code.includes(q) || name.includes(q);
  });

  // Open Create Modal
  function handleOpenCreate() {
    setError("");
    setMessage("");
    // Defaults based on active catalog
    const base: Record<string, any> = {
      code: "",
      name: "",
      status: "ACTIVE",
    };
    if (activeCatalog === "employees") {
      base.employee_code = "";
      base.full_name = "";
      base.branch = branches[0]?.id || "";
    } else if (activeCatalog === "items") {
      base.item_type = "GOODS";
      base.base_uom = uoms[0]?.id || "";
    } else if (activeCatalog === "categories") {
      base.applicable_types = ["GOODS", "MATERIAL"];
    } else if (activeCatalog === "uoms") {
      base.measurement_type = "CUSTOM";
      base.symbol = "cái";
      base.decimal_places = 0;
      base.is_reference = false;
    } else if (activeCatalog === "warehouses") {
      base.warehouse_type = "PHYSICAL";
      base.warehouse_scope = "COMPANY_SHARED";
      base.allow_receipt = true;
      base.allow_issue = true;
      base.allow_transfer = true;
    } else if (activeCatalog === "bank_accounts") {
      base.account_number = "";
      base.account_name = "";
      base.bank = banks[0]?.id || "";
      base.currency = currencies[0]?.id || "";
      base.gl_account = glAccounts[0]?.id || "";
    } else if (activeCatalog === "accounts") {
      base.chart_of_accounts = coas[0]?.id || "";
      base.account_type = "ASSET";
      base.nature = "DEBIT";
    } else if (activeCatalog === "tax_types") {
      base.scope = "ALL";
      base.calculation_method = "PERCENTAGE";
    } else if (activeCatalog === "payment_terms") {
      base.due_days = 30;
      base.scope = "BOTH";
      base.due_base = "DOCUMENT";
      base.has_discount = false;
    } else if (activeCatalog === "payment_methods") {
      base.group = "CASH";
      base.scope = "BOTH";
      base.requires_reference = false;
      base.requires_bank_account = false;
      base.supports_auto_reconcile = false;
    }
    setFormData(base);
    setCreateModal(true);
  }

  // Handle Save Create
  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, any> = { ...formData, company: companyId };
      if (activeCatalog === "vendors") {
        payload.party_type = "ORGANIZATION";
      } else if (activeCatalog === "employees") {
        if (!payload.branch && branches.length > 0) payload.branch = branches[0].id;
      } else if (activeCatalog === "items") {
        if (!payload.base_uom && uoms.length > 0) payload.base_uom = uoms[0].id;
      } else if (activeCatalog === "bank_accounts") {
        if (!payload.bank && banks.length > 0) payload.bank = banks[0].id;
        if (!payload.currency && currencies.length > 0) payload.currency = currencies[0].id;
        if (!payload.gl_account && glAccounts.length > 0) payload.gl_account = glAccounts[0].id;
      } else if (activeCatalog === "accounts") {
        if (!payload.chart_of_accounts && coas.length > 0) payload.chart_of_accounts = coas[0].id;
      }
      await request(`${currentDef.endpoint}?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(`Đã tạo bản ghi ${currentDef.name} thành công (${currentDef.uc})`);
      setCreateModal(false);
      loadCatalogItems();
    } catch (err: any) {
      setError(err.message || "Không thể tạo bản ghi");
    } finally {
      setLoading(false);
    }
  }

  // Handle Edit
  function handleOpenEdit(item: any) {
    setError("");
    setMessage("");
    setEditModal(item);
    setFormData({
      ...item,
      name: item[currentDef.nameField] || "",
      code: item[currentDef.codeField] || "",
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editModal) return;
    setLoading(true);
    setError("");
    try {
      const payload: Record<string, any> = { ...formData };
      delete payload.id;
      delete payload.company;
      delete payload.created_at;
      delete payload.updated_at;
      await request(`${currentDef.endpoint}${editModal.id}/?company_id=${companyId}`, token, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage(`Đã cập nhật bản ghi thành công (${currentDef.uc})`);
      setEditModal(null);
      loadCatalogItems();
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật bản ghi");
    } finally {
      setLoading(false);
    }
  }

  // Handle Delete
  async function handleDelete(item: any) {
    const code = item[currentDef.codeField];
    if (!window.confirm(`Xác nhận xóa bản ghi [${code}] thuộc ${currentDef.name}?`)) return;
    setLoading(true);
    setError("");
    try {
      await request(`${currentDef.endpoint}${item.id}/?company_id=${companyId}`, token, {
        method: "DELETE",
      });
      setMessage(`Đã xóa bản ghi [${code}] thành công (${currentDef.uc})`);
      loadCatalogItems();
    } catch (err: any) {
      setError(err.message || "Không thể xóa bản ghi (đã có chứng từ liên kết)");
    } finally {
      setLoading(false);
    }
  }

  // UC-MD-15: Open Import Modal
  function handleOpenImport() {
    setError("");
    setMessage("");
    setImportFile(null);
    setImportBatch(null);
    setImportPreview(null);
    setImportModal(true);
  }

  // Download Template
  async function handleDownloadTemplate(format: "csv" | "xlsx" = "csv") {
    const url = `/api/v1/master-data/catalog-imports/template/?company_id=${companyId}&target=${currentDef.targetKey}&file_format=${format}`;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${currentDef.targetKey}-v1.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch (err: any) { setError(err.message || "Không tải được tệp mẫu"); }
  }

  // Upload Import File
  async function handleUploadImport(e: FormEvent) {
    e.preventDefault();
    if (!importFile) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", importFile);
      form.append("target", currentDef.targetKey);
      form.append("duplicate_mode", importDupMode);
      form.append("error_mode", importErrorMode);

      const res = await fetch(`/api/v1/master-data/catalog-imports/upload/?company_id=${companyId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.file || `Upload thất bại (HTTP ${res.status})`);
      }
      const data = await res.json();
      setImportBatch(data);
      setImportPreview(null);
      setMessage(`Đã tải lên ${data.total_rows} dòng. Xem trước để kiểm tra từng dòng.`);
    } catch (err: any) {
      setError(err.message || "Không thể upload tệp import");
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewImport() {
    if (!importBatch) return;
    setLoading(true); setError("");
    try {
      const preview = await request<any>(`/api/v1/master-data/catalog-imports/${importBatch.id}/preview/?company_id=${companyId}`, token, { method: "POST", body: JSON.stringify({}) });
      setImportPreview(preview);
      setMessage(`Đã kiểm tra: ${preview.valid_rows} hợp lệ, ${preview.error_rows} lỗi, ${preview.skipped_rows} bỏ qua.`);
    } catch (err: any) { setError(err.message || "Không xem trước được tệp"); }
    finally { setLoading(false); }
  }

  // Commit Import Batch
  async function handleCommitImport() {
    if (!importBatch || !importPreview || (importPreview.status !== "READY" && !(importPreview.status === "ERROR" && importErrorMode === "PARTIAL"))) return;
    setLoading(true);
    setError("");
    try {
      const res = await request<any>(`/api/v1/master-data/catalog-imports/${importBatch.id}/confirm/?company_id=${companyId}`, token, {
        method: "POST",
      });
      setMessage(`Import ${res.status}: tạo ${res.created_rows}, cập nhật ${res.updated_rows}, lỗi ${res.error_rows}.`);
      setImportModal(false);
      loadCatalogItems();
    } catch (err: any) {
      setError(err.message || "Không thể xác nhận import");
    } finally {
      setLoading(false);
    }
  }

  // UC-MD-16: Open Export Modal
  async function handleOpenExport() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const est = await request<any>(`/api/v1/master-data/catalog-exports/estimate/?company_id=${companyId}&target=${currentDef.targetKey}&export_scope=ALL`, token);
      setExportEstimate(est);
      setExportModal(true);
    } catch (err: any) {
      setError(err.message || "Không thể ước tính số lượng bản ghi export");
    } finally {
      setLoading(false);
    }
  }

  // Trigger Direct Export Download
  async function handleDownloadExport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/master-data/catalog-exports/export/?company_id=${companyId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target: currentDef.targetKey,
          export_scope: "ALL",
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Export thất bại (HTTP ${res.status})`);
      }
      if (res.status === 202) { const queued = await res.json(); setMessage(`Yêu cầu xuất đã được xếp hàng: ${queued.batch_id}.`); setExportModal(false); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentDef.targetKey}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 30000);

      setMessage(`Đã xuất dữ liệu danh mục ${currentDef.name} thành công (UC-MD-16)`);
      setExportModal(false);
    } catch (err: any) {
      setError(err.message || "Không thể xuất tệp dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="live-md-container" aria-label="Quản lý Danh mục Trực tiếp">
      {/* Header */}
      <header className="live-md-header">
        <div className="live-md-header-left">
          {onBack && (
            <button className="btn-secondary" onClick={onBack} title="Quay lại">
              <ArrowLeft size={16} /> Quay lại
            </button>
          )}
          <div>
            <h1>Quản lý Danh mục (Master Data)</h1>
            <p>Kết nối trực tiếp Backend Django • UC-MD-01 đến UC-MD-16</p>
          </div>
        </div>

        <div className="live-md-header-actions">
          <label style={{ fontSize: "0.85rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Doanh nghiệp:
            <select
              aria-label="Chọn doanh nghiệp"
              value={companyId}
              onChange={(e) => selectCompany(e.target.value)}
              style={{ padding: "0.35rem 0.65rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {/* Main Body */}
      <div className="live-md-body">
        {/* Sidebar Nav */}
        <aside className="live-md-sidebar">
          <div className="live-md-sidebar-title">Danh mục hệ thống (3.3)</div>
          {CATALOGS.map((cat) => {
            const Icon = cat.icon;
            const isActive = cat.key === activeCatalog;
            return (
              <button
                key={cat.key}
                className={`live-md-nav-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveCatalog(cat.key);
                  setQuery("");
                  setError("");
                  setMessage("");
                }}
              >
                <Icon size={18} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>{cat.name}</span>
                  <span style={{ fontSize: "0.7rem", color: isActive ? "#2563eb" : "#94a3b8" }}>{cat.uc}</span>
                </div>
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="live-md-content">
          {message && (
            <div className="alert-box alert-success">
              <CheckCircle size={16} /> {message}
            </div>
          )}
          {error && (
            <div className="alert-box alert-error">
              <XCircle size={16} /> {error}
            </div>
          )}

          {/* Catalog Toolbar */}
          <div className="live-md-toolbar">
            <Link to={detailedRoutes[activeCatalog] || "/master-data"} className="btn-primary">Quản lý đầy đủ {currentDef.name}</Link>
            <div className="live-md-search">
              <Search size={16} color="#64748b" />
              <input
                placeholder={`Tìm kiếm trong ${currentDef.name}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="live-md-actions">
              <button className="btn-secondary" onClick={loadCatalogItems} disabled={loading} title="Tải lại dữ liệu">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Tải lại
              </button>

              <button className="btn-secondary" onClick={handleOpenImport} title="Import Danh mục (UC-MD-15)">
                <Upload size={14} /> Import (MD-15)
              </button>

              <button className="btn-secondary" onClick={handleOpenExport} title="Export Danh mục (UC-MD-16)">
                <Download size={14} /> Export (MD-16)
              </button>

              <button className="btn-primary" onClick={handleOpenCreate} title={`Thêm mới ${currentDef.name}`}>
                <Plus size={15} /> Thêm mới
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="live-md-card">
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 600, fontSize: "0.9rem" }}>
              Danh sách {currentDef.name} ({filtered.length} bản ghi)
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="live-md-table">
                <thead>
                  <tr>
                    <th style={{ width: "15%" }}>Mã</th>
                    <th style={{ width: "35%" }}>Tên</th>
                    <th style={{ width: "20%" }}>Thông tin phụ</th>
                    <th style={{ width: "15%" }}>Trạng thái</th>
                    <th style={{ width: "15%", textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                        {loading ? "Đang tải dữ liệu..." : "Chưa có bản ghi nào. Bấm \"Thêm mới\" hoặc \"Import\"."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item[currentDef.codeField]}</td>
                        <td>{item[currentDef.nameField]}</td>
                        <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {item.tax_code ? `MST: ${item.tax_code}` : ""}
                          {item.measurement_type ? `Loại: ${item.measurement_type}` : ""}
                          {item.item_type ? `Loại: ${item.item_type}` : ""}
                          {item.account_type ? `Loại TK: ${item.account_type}` : ""}
                          {item.due_days ? `Hạn: ${item.due_days} ngày` : ""}
                          {item.email ? `Email: ${item.email}` : ""}
                        </td>
                        <td>
                          <span className={item.status === "ACTIVE" ? "badge-active" : "badge-inactive"}>
                            {item.status === "ACTIVE" ? "Hoạt động" : item.status || "Ngừng"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "0.25rem 0.5rem", marginRight: "0.35rem" }}
                            onClick={() => handleOpenEdit(item)}
                            title="Sửa bản ghi"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: "0.25rem 0.5rem" }}
                            onClick={() => handleDelete(item)}
                            title="Xóa bản ghi"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* CREATE MODAL */}
      {createModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Thêm {currentDef.name} ({currentDef.uc})</h2>
              <button className="btn-secondary" style={{ padding: "0.25rem" }} onClick={() => setCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {activeCatalog === "employees" ? (
                  <>
                    <div className="form-group">
                      <label>Mã nhân viên *</label>
                      <input
                        required
                        value={formData.employee_code || ""}
                        onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                        placeholder="NV001"
                      />
                    </div>
                    <div className="form-group">
                      <label>Họ và tên *</label>
                      <input
                        required
                        value={formData.full_name || ""}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                    <div className="form-group">
                      <label>Chi nhánh *</label>
                      <select
                        value={formData.branch || ""}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Điện thoại</label>
                      <input
                        value={formData.phone || ""}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Mã {currentDef.name} *</label>
                      <input
                        required
                        value={formData.code || ""}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="Mã danh mục"
                      />
                    </div>
                    <div className="form-group">
                      <label>Tên {currentDef.name} *</label>
                      <input
                        required
                        value={formData.name || formData.account_name || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            name: val,
                            account_name: val,
                          });
                        }}
                        placeholder="Tên danh mục"
                      />
                    </div>

                    {/* Specific fields */}
                    {activeCatalog === "items" && (
                      <>
                        <div className="form-group">
                          <label>Loại đối tượng</label>
                          <select
                            value={formData.item_type || "GOODS"}
                            onChange={(e) => setFormData({ ...formData, item_type: e.target.value })}
                          >
                            <option value="GOODS">Hàng hóa</option>
                            <option value="SERVICE">Dịch vụ</option>
                            <option value="MATERIAL">Nguyên vật liệu</option>
                            <option value="FINISHED_PRODUCT">Thành phẩm</option>
                            <option value="TOOL">Công cụ dụng cụ</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Đơn vị cơ sở (UOM) *</label>
                          <select
                            value={formData.base_uom || ""}
                            onChange={(e) => setFormData({ ...formData, base_uom: e.target.value })}
                          >
                            {uoms.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.symbol})
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {activeCatalog === "uoms" && (
                      <>
                        <div className="form-group">
                          <label>Ký hiệu *</label>
                          <input
                            required
                            value={formData.symbol || ""}
                            onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                            placeholder="cái, kg, m"
                          />
                        </div>
                        <div className="form-group">
                          <label>Nhóm đo lường</label>
                          <select
                            value={formData.measurement_type || "COUNT"}
                            onChange={(e) => setFormData({ ...formData, measurement_type: e.target.value })}
                          >
                            <option value="COUNT">Số lượng (COUNT)</option>
                            <option value="WEIGHT">Khối lượng (WEIGHT)</option>
                            <option value="LENGTH">Độ dài (LENGTH)</option>
                            <option value="VOLUME">Thể tích (VOLUME)</option>
                            <option value="TIME">Thời gian (TIME)</option>
                            <option value="SERVICE">Dịch vụ (SERVICE)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {activeCatalog === "bank_accounts" && (
                      <>
                        <div className="form-group">
                          <label>Số tài khoản *</label>
                          <input
                            required
                            value={formData.account_number || ""}
                            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                            placeholder="0123456789"
                          />
                        </div>
                        <div className="form-group">
                          <label>Ngân hàng *</label>
                          <select
                            value={formData.bank || ""}
                            onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                          >
                            {banks.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Tiền tệ *</label>
                          <select
                            value={formData.currency || ""}
                            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          >
                            {currencies.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Tài khoản kế toán liên kết (GL Account) *</label>
                          <select
                            value={formData.gl_account || ""}
                            onChange={(e) => setFormData({ ...formData, gl_account: e.target.value })}
                          >
                            {glAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {activeCatalog === "accounts" && (
                      <>
                        <div className="form-group">
                          <label>Hệ thống tài khoản (COA) *</label>
                          <select
                            value={formData.chart_of_accounts || ""}
                            onChange={(e) => setFormData({ ...formData, chart_of_accounts: e.target.value })}
                          >
                            {coas.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Loại tài khoản</label>
                          <select
                            value={formData.account_type || "ASSET"}
                            onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                          >
                            <option value="ASSET">Tài sản (ASSET)</option>
                            <option value="LIABILITY">Nợ phải trả (LIABILITY)</option>
                            <option value="EQUITY">Vốn chủ sở hữu (EQUITY)</option>
                            <option value="REVENUE">Doanh thu (REVENUE)</option>
                            <option value="EXPENSE">Chi phí (EXPENSE)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Tính chất số dư</label>
                          <select
                            value={formData.nature || "DEBIT"}
                            onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                          >
                            <option value="DEBIT">Dư Nợ (DEBIT)</option>
                            <option value="CREDIT">Dư Có (CREDIT)</option>
                            <option value="HERMAPHRODITE">Lưỡng tính (HERMAPHRODITE)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {activeCatalog === "payment_terms" && (
                      <div className="form-group">
                        <label>Số ngày được nợ (Due Days) *</label>
                        <input
                          type="number"
                          required
                          value={formData.due_days ?? 30}
                          onChange={(e) => setFormData({ ...formData, due_days: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCreateModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Đang lưu..." : "Lưu bản ghi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Cập nhật {currentDef.name} ({currentDef.uc})</h2>
              <button className="btn-secondary" style={{ padding: "0.25rem" }} onClick={() => setEditModal(null)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Mã {currentDef.name} (Không thể đổi)</label>
                  <input disabled value={formData.code || formData.employee_code || ""} />
                </div>
                <div className="form-group">
                  <label>Tên {currentDef.name} *</label>
                  <input
                    required
                    value={formData.name || formData.full_name || formData.account_name || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData({
                        ...formData,
                        name: val,
                        full_name: val,
                        account_name: val,
                      });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Trạng thái</label>
                  <select
                    value={formData.status || "ACTIVE"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE">Ngừng hoạt động (INACTIVE)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditModal(null)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT MODAL (UC-MD-15) */}
      {importModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Import danh mục: {currentDef.name} (UC-MD-15)</h2>
              <button className="btn-secondary" style={{ padding: "0.25rem" }} onClick={() => setImportModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleUploadImport}>
              <div className="modal-body">
                <div style={{ background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569" }}>
                    Tải tệp mẫu để chuẩn bị dữ liệu trước khi tải lên:
                  </p>
                  <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                    <button type="button" className="btn-secondary" onClick={() => handleDownloadTemplate("csv")}>
                      <FileSpreadsheet size={14} /> Tải mẫu CSV
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleDownloadTemplate("xlsx")}>
                      <FileSpreadsheet size={14} /> Tải mẫu Excel
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Chọn tệp CSV hoặc XLSX *</label>
                  <input
                    type="file"
                    accept=".csv, .xlsx"
                    required
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="form-group">
                  <label>Xử lý trùng mã (Duplicate Mode)</label>
                  <select value={importDupMode} onChange={(e) => setImportDupMode(e.target.value)}>
                    <option value="SKIP">Bỏ qua bản ghi trùng (SKIP)</option>
                    <option value="UPDATE">Cập nhật bản ghi trùng (UPDATE)</option>
                    <option value="ERROR">Báo lỗi dừng import (ERROR)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Xử lý lỗi (Error Mode)</label>
                  <select value={importErrorMode} onChange={(e) => setImportErrorMode(e.target.value)}>
                    <option value="ATOMIC">Rollback toàn bộ nếu có lỗi (ATOMIC)</option>
                    <option value="PARTIAL">Nhập các dòng hợp lệ, ghi nhận dòng lỗi (PARTIAL)</option>
                  </select>
                </div>

                {importBatch && (
                  <div className="alert-box alert-success">
                    <CheckCircle size={16} /> Đã tải lên {importBatch.total_rows} dòng. {importPreview ? `Hợp lệ: ${importPreview.valid_rows}, lỗi: ${importPreview.error_rows}, bỏ qua: ${importPreview.skipped_rows}.` : "Hãy xem trước trước khi xác nhận."}
                  </div>
                )}
                {importPreview && <div style={{ maxHeight: 200, overflow: "auto" }}><pre>{JSON.stringify(importPreview.rows, null, 2)}</pre></div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setImportModal(false)}>
                  Đóng
                </button>
                {!importBatch ? (
                  <button type="submit" className="btn-primary" disabled={loading || !importFile}>
                    {loading ? "Đang tải lên..." : "Tải lên & Xem trước"}
                  </button>
                ) : (
                  <><button type="button" className="btn-secondary" onClick={handlePreviewImport} disabled={loading}>Xem trước</button><button type="button" className="btn-primary" onClick={handleCommitImport} disabled={loading || !importPreview || (importPreview.status !== "READY" && !(importPreview.status === "ERROR" && importErrorMode === "PARTIAL"))}>{loading ? "Đang xử lý..." : "Xác nhận Import vào hệ thống"}</button></>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT MODAL (UC-MD-16) */}
      {exportModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2>Export dữ liệu: {currentDef.name} (UC-MD-16)</h2>
              <button className="btn-secondary" style={{ padding: "0.25rem" }} onClick={() => setExportModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                  <strong>Danh mục:</strong> {currentDef.name} ({currentDef.targetKey})
                </p>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                  <strong>Số lượng bản ghi ước tính:</strong> {exportEstimate?.estimated_count ?? items.length} bản ghi
                </p>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.9rem" }}>
                  <strong>Phương thức xuất:</strong> {exportEstimate?.mode || "DIRECT"} (Xuất trực tiếp tệp Excel)
                </p>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Tệp tải xuống sẽ tuân thủ định dạng chuẩn của phân hệ Master Data, bảo toàn ký tự số và chống mã độc công thức.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setExportModal(false)}>
                Hủy bỏ
              </button>
              <button type="button" className="btn-primary" onClick={handleDownloadExport} disabled={loading}>
                <Download size={14} /> {loading ? "Đang tạo tệp..." : "Tải tệp Excel về máy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
