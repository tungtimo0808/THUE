import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-fa.css";

type TabKey =
  | "assets"
  | "categories"
  | "calculations"
  | "acquisitions"
  | "transfers"
  | "revaluations"
  | "disposals"
  | "transactions"
  | "periods"
  | "approvals";

interface ReferenceData {
  categories: any[];
  assets: any[];
  branches: any[];
  departments: any[];
  employees: any[];
}

export default function LiveFixedAssets() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("assets");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Auth & Session
  const [token, setToken] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token || parsed.access || "");
        setCompanyId(parsed.companyId || (parsed.companies && parsed.companies[0]?.id) || "");
      }
    } catch (e) {
      console.error("Failed to parse erp_api_session", e);
    }
  }, []);

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  // Master References
  const [refsLoaded, setRefsLoaded] = useState(false);
  const [refs, setRefs] = useState<ReferenceData>({
    categories: [],
    assets: [],
    branches: [],
    departments: [],
    employees: [],
  });

  // Tab Data States
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [calculations, setCalculations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Fetch Master Data
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [catRes, assetRes, branchRes, deptRes, empRes] = await Promise.all([
        fetch(`/api/v1/fixed-assets/categories/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/fixed-assets/assets/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/departments/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/employees/?company_id=${companyId}`, { headers: h }),
      ]);

      const catData = catRes.ok ? await catRes.json() : [];
      const assetData = assetRes.ok ? await assetRes.json() : [];
      const branchData = branchRes.ok ? await branchRes.json() : [];
      const deptData = deptRes.ok ? await deptRes.json() : [];
      const empData = empRes.ok ? await empRes.json() : [];

      setRefs({
        categories: Array.isArray(catData) ? catData : catData.results || [],
        assets: Array.isArray(assetData) ? assetData : assetData.results || [],
        branches: Array.isArray(branchData) ? branchData : branchData.results || [],
        departments: Array.isArray(deptData) ? deptData : deptData.results || [],
        employees: Array.isArray(empData) ? empData : empData.results || [],
      });
      setRefsLoaded(true);
    } catch (e: any) {
      console.error("fetchRefs error", e);
    }
  }, [companyId, getHeaders]);

  // Tab Loaders
  const loadTabData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const h = getHeaders();

    try {
      if (activeTab === "assets") {
        const res = await fetch(`/api/v1/fixed-assets/assets/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setAssets(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "categories") {
        const res = await fetch(`/api/v1/fixed-assets/categories/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setCategories(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "calculations") {
        const res = await fetch(`/api/v1/fixed-assets/calculations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setCalculations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (
        activeTab === "acquisitions" ||
        activeTab === "transfers" ||
        activeTab === "revaluations" ||
        activeTab === "disposals" ||
        activeTab === "transactions"
      ) {
        let url = `/api/v1/fixed-assets/transactions/?company_id=${companyId}`;
        if (activeTab === "acquisitions") url += "&transaction_type=ACQUISITION";
        else if (activeTab === "transfers") url += "&transaction_type=TRANSFER";
        else if (activeTab === "revaluations") url += "&transaction_type=VALUE_INCREASE";
        else if (activeTab === "disposals") url += "&transaction_type=DISPOSAL";

        const res = await fetch(url, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setTransactions(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "periods") {
        const res = await fetch(`/api/v1/fixed-assets/periods/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPeriods(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "approvals") {
        const res = await fetch(`/api/v1/fixed-assets/approvals/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setApprovals(Array.isArray(d) ? d : d.results || []);
        }
      }
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tải dữ liệu: " + e.message });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, getHeaders]);

  useEffect(() => {
    if (companyId && token) {
      if (!refsLoaded) {
        fetchRefs();
      }
      loadTabData();
    }
  }, [companyId, token, activeTab, fetchRefs, loadTabData, refsLoaded]);

  // Actions on Transactions
  const handleTxAction = async (id: string, actionName: string, payload: any = {}) => {
    try {
      const h = getHeaders();
      const url = `/api/v1/fixed-assets/transactions/${id}/${actionName}/?company_id=${companyId}`;
      const res = await fetch(url, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Thao tác thất bại");
      }

      setNotice({ type: "success", text: `Thực hiện ${actionName.toUpperCase()} thành công!` });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Actions on Calculations (Calculate & Post)
  const handleCalcAction = async (id: string, actionName: "calculate" | "post") => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/fixed-assets/calculations/${id}/${actionName}/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Thao tác thất bại");
      }

      setNotice({
        type: "success",
        text: actionName === "calculate" ? "Tính khấu hao/phân bổ thành công!" : "Ghi sổ bảng tính khấu hao thành công!",
      });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 1. Create Asset Record
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetCat =
        refs.categories.find((c) => c.id === formData.category) ||
        refs.categories.find((c) => c.asset_type === (formData.asset_type || "FIXED_ASSET")) ||
        refs.categories[0];
      const assetType = targetCat?.asset_type || formData.asset_type || "FIXED_ASSET";

      const payload = {
        company: companyId,
        code: formData.code || `TS-${Date.now().toString().slice(-6)}`,
        name: formData.name,
        asset_type: assetType,
        category: targetCat?.id,
        branch: formData.branch || refs.branches[0]?.id,
        department: formData.department || refs.departments[0]?.id || null,
        custodian: formData.custodian || refs.employees[0]?.id || null,
        acquisition_date: formData.acquisition_date || new Date().toISOString().slice(0, 10),
        in_service_date: formData.in_service_date || new Date().toISOString().slice(0, 10),
        original_cost: formData.original_cost || "60000000",
        salvage_value: formData.salvage_value || "0",
        useful_life_periods: Number(formData.useful_life_periods) || 36,
        method: formData.method || "STRAIGHT_LINE",
        status: "DRAFT",
      };

      const res = await fetch(`/api/v1/fixed-assets/assets/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo hồ sơ tài sản thành công!" });
      setModalType(null);
      await fetchRefs();
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo tài sản: " + e.message });
    }
  };

  // 2. Create Asset Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        company: companyId,
        code: formData.code || `CAT-${Date.now().toString().slice(-4)}`,
        name: formData.name,
        asset_type: formData.asset_type || "FIXED_ASSET",
        default_periods: Number(formData.default_periods) || 36,
        default_method: formData.default_method || "STRAIGHT_LINE",
        is_active: true,
      };

      const res = await fetch(`/api/v1/fixed-assets/categories/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo nhóm tài sản/CCDC thành công!" });
      setModalType(null);
      await fetchRefs();
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo nhóm tài sản: " + e.message });
    }
  };

  // 3. Create Calculation Run (Depreciation / Allocation)
  const handleCreateCalculation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        company: companyId,
        number: formData.number || `KH-${Date.now().toString().slice(-6)}`,
        calculation_type: formData.calculation_type || "DEPRECIATION",
        period_code: formData.period_code || "KY_2026_10",
        period_start: formData.period_start || "2026-10-01",
        period_end: formData.period_end || "2026-10-31",
      };

      const res = await fetch(`/api/v1/fixed-assets/calculations/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Lập bảng tính khấu hao/phân bổ thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo bảng tính: " + e.message });
    }
  };

  // 4. Create Transaction (Acquisition, Transfer, Revaluation, Disposal)
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      let targetAsset = refs.assets.find((a) => a.id === formData.asset);
      if (!targetAsset) {
        if (formData.transaction_type === "ACQUISITION") {
          targetAsset = refs.assets.find((a) => a.status === "DRAFT") || refs.assets[0];
        } else {
          targetAsset = refs.assets.find((a) => a.status === "ACTIVE") || refs.assets[0];
        }
      }

      const amount =
        formData.transaction_type === "ACQUISITION"
          ? targetAsset?.original_cost || formData.amount || "60000000"
          : formData.amount || "10000000";

      const payload: any = {
        company: companyId,
        asset: targetAsset?.id,
        number: formData.number || `TX-${Date.now().toString().slice(-6)}`,
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date || new Date().toISOString().slice(0, 10),
        amount: amount,
        reason: formData.reason || "Giao dịch phát sinh thông thường",
      };

      if (formData.transaction_type === "TRANSFER") {
        payload.target_branch = formData.target_branch || refs.branches[0]?.id;
        payload.target_department = formData.target_department || refs.departments[0]?.id || null;
        payload.target_custodian = formData.target_custodian || refs.employees[0]?.id || null;
      }

      const res = await fetch(`/api/v1/fixed-assets/transactions/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: `Lập chứng từ ${formData.transaction_type} thành công!` });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi lập chứng từ: " + e.message });
    }
  };

  // Helper format number
  const formatNum = (val: any) => {
    const num = Number(val) || 0;
    return num.toLocaleString("vi-VN");
  };

  // Metrics summary
  const totalCost = assets.reduce((sum, a) => sum + (Number(a.original_cost) || 0), 0);
  const totalProcessed = assets.reduce(
    (sum, a) => sum + (Number(a.accumulated_depreciation) || Number(a.allocated_value) || 0),
    0
  );
  const totalRemaining = totalCost - totalProcessed;

  return (
    <div className="live-fa-root">
      {/* Top Header */}
      <header className="live-fa-header">
        <div className="live-fa-title-box">
          <div className="live-fa-title">
            <span>🏛️</span>
            <span>Tài Sản Cố Định & CCDC (Fixed Assets & Tools)</span>
            <span className="live-fa-badge">UC-FA-01 → UC-FA-08</span>
          </div>
          <div className="live-fa-company-info">
            <span>Doanh nghiệp:</span>
            <span className="live-fa-company-tag">{companyId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="live-fa-btn-group">
          <Link to="/inventory" className="live-fa-btn live-fa-btn-secondary">
            📦 Kho hàng
          </Link>
          <Link to="/bank" className="live-fa-btn live-fa-btn-secondary">
            🏛️ Ngân hàng
          </Link>
          <Link to="/cash" className="live-fa-btn live-fa-btn-secondary">
            💵 Tiền mặt
          </Link>
          <Link to="/purchases" className="live-fa-btn live-fa-btn-secondary">
            🛒 Mua hàng
          </Link>
          <button
            onClick={() => {
              fetchRefs();
              loadTabData();
            }}
            className="live-fa-btn live-fa-btn-primary"
          >
            🔄 Làm mới
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="live-fa-nav">
        <button
          className={`live-fa-nav-btn ${activeTab === "assets" ? "active" : ""}`}
          onClick={() => setActiveTab("assets")}
        >
          🏛️ Hồ sơ tài sản <span className="live-fa-tag-pill">{assets.length}</span>
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          📁 Nhóm TSCĐ & CCDC <span className="live-fa-tag-pill">{categories.length}</span>
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "calculations" ? "active" : ""}`}
          onClick={() => setActiveTab("calculations")}
        >
          📈 Tính khấu hao & Phân bổ <span className="live-fa-tag-pill">{calculations.length}</span>
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "acquisitions" ? "active" : ""}`}
          onClick={() => setActiveTab("acquisitions")}
        >
          ➕ Ghi tăng tài sản
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "transfers" ? "active" : ""}`}
          onClick={() => setActiveTab("transfers")}
        >
          🔄 Điều chuyển bộ phận
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "revaluations" ? "active" : ""}`}
          onClick={() => setActiveTab("revaluations")}
        >
          ⚖️ Đánh giá lại / Tăng giảm
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "disposals" ? "active" : ""}`}
          onClick={() => setActiveTab("disposals")}
        >
          📉 Ghi giảm / Thanh lý
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          📝 Sổ giao dịch tài sản <span className="live-fa-tag-pill">{transactions.length}</span>
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "periods" ? "active" : ""}`}
          onClick={() => setActiveTab("periods")}
        >
          🔒 Kỳ tài sản <span className="live-fa-tag-pill">{periods.length}</span>
        </button>
        <button
          className={`live-fa-nav-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          🛡️ Nhật ký duyệt <span className="live-fa-tag-pill">{approvals.length}</span>
        </button>
      </nav>

      {/* Main Container */}
      <main className="live-fa-container">
        {/* Notice Alert */}
        {notice && (
          <div className={`live-fa-notice ${notice.type}`}>
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Banner */}
        <div className="live-fa-kpi-grid">
          <div className="live-fa-kpi-card">
            <span className="live-fa-kpi-label">Tổng nguyên giá TSCĐ & CCDC</span>
            <span className="live-fa-kpi-val highlight">{formatNum(totalCost)} VND</span>
          </div>
          <div className="live-fa-kpi-card">
            <span className="live-fa-kpi-label">Giá trị đã khấu hao / phân bổ</span>
            <span className="live-fa-kpi-val warning">{formatNum(totalProcessed)} VND</span>
          </div>
          <div className="live-fa-kpi-card">
            <span className="live-fa-kpi-label">Giá trị còn lại</span>
            <span className="live-fa-kpi-val success">{formatNum(totalRemaining)} VND</span>
          </div>
          <div className="live-fa-kpi-card">
            <span className="live-fa-kpi-label">Số lượng tài sản quản lý</span>
            <span className="live-fa-kpi-val">{assets.length} hồ sơ</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="live-fa-controls">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {activeTab === "assets" && "Danh Sách Hồ Sơ TSCĐ & CCDC (UC-FA-02)"}
              {activeTab === "categories" && "Danh Mục Nhóm TSCĐ & CCDC (UC-FA-01)"}
              {activeTab === "calculations" && "Tính Khấu Hao & Phân Bổ Định Kỳ (UC-FA-04)"}
              {activeTab === "acquisitions" && "Chứng Từ Ghi Tăng Tài Sản (UC-FA-03)"}
              {activeTab === "transfers" && "Chứng Từ Điều Chuyển Bộ Phận / Chi Nhánh (UC-FA-06)"}
              {activeTab === "revaluations" && "Đánh Giá Lại & Điều Chỉnh Nguyên Giá (UC-FA-05)"}
              {activeTab === "disposals" && "Chứng Từ Ghi Giảm / Thanh Lý Tài Sản (UC-FA-07)"}
              {activeTab === "transactions" && "Tất Cả Giao Dịch Tài Sản & Trạng Thái Duyệt (UC-FA-08)"}
              {activeTab === "periods" && "Quản Lý Kỳ Khấu Hao / Tài Sản (UC-FA-08)"}
              {activeTab === "approvals" && "Nhật Ký Phê Duyệt Nghiệp Vụ Tài Sản (UC-FA-08)"}
            </h2>
          </div>

          <div className="live-fa-btn-group">
            {activeTab === "assets" && (
              <button
                className="live-fa-btn live-fa-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    code: `TS-${Date.now().toString().slice(-6)}`,
                    name: "Máy móc thiết bị văn phòng",
                    asset_type: "FIXED_ASSET",
                    category: refs.categories[0]?.id || "",
                    branch: refs.branches[0]?.id || "",
                    department: refs.departments[0]?.id || "",
                    custodian: refs.employees[0]?.id || "",
                    acquisition_date: today,
                    in_service_date: today,
                    original_cost: "60000000",
                    salvage_value: "0",
                    useful_life_periods: 36,
                    method: "STRAIGHT_LINE",
                  });
                  setModalType("create_asset");
                }}
              >
                + Khai Báo Tài Sản Mới
              </button>
            )}

            {activeTab === "categories" && (
              <button
                className="live-fa-btn live-fa-btn-primary"
                onClick={() => {
                  setFormData({
                    code: `CAT-${Date.now().toString().slice(-4)}`,
                    name: "Phương tiện vận tải truyền dẫn",
                    asset_type: "FIXED_ASSET",
                    default_periods: 60,
                    default_method: "STRAIGHT_LINE",
                  });
                  setModalType("create_category");
                }}
              >
                + Thêm Nhóm Mới
              </button>
            )}

            {activeTab === "calculations" && (
              <button
                className="live-fa-btn live-fa-btn-primary"
                onClick={() => {
                  setFormData({
                    number: `KH-${Date.now().toString().slice(-6)}`,
                    calculation_type: "DEPRECIATION",
                    period_code: "KY_2026_10",
                    period_start: "2026-10-01",
                    period_end: "2026-10-31",
                  });
                  setModalType("create_calculation");
                }}
              >
                + Lập Bảng Tính Khấu Hao
              </button>
            )}

            {(activeTab === "acquisitions" ||
              activeTab === "transfers" ||
              activeTab === "revaluations" ||
              activeTab === "disposals") && (
              <button
                className="live-fa-btn live-fa-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  let type = "ACQUISITION";
                  let prefix = "GT";
                  if (activeTab === "transfers") {
                    type = "TRANSFER";
                    prefix = "DC";
                  } else if (activeTab === "revaluations") {
                    type = "VALUE_INCREASE";
                    prefix = "DG";
                  } else if (activeTab === "disposals") {
                    type = "DISPOSAL";
                    prefix = "GG";
                  }

                  setFormData({
                    number: `${prefix}-${Date.now().toString().slice(-6)}`,
                    transaction_type: type,
                    asset: refs.assets[0]?.id || "",
                    transaction_date: today,
                    amount: "10000000",
                    reason: `Nghiệp vụ ${type} tài sản`,
                    target_branch: refs.branches[0]?.id || "",
                    target_department: refs.departments[0]?.id || "",
                    target_custodian: refs.employees[0]?.id || "",
                  });
                  setModalType("create_transaction");
                }}
              >
                {activeTab === "acquisitions" && "+ Lập Phiếu Ghi Tăng"}
                {activeTab === "transfers" && "+ Lập Lệnh Điều Chuyển"}
                {activeTab === "revaluations" && "+ Lập Phiếu Đánh Giá Lại"}
                {activeTab === "disposals" && "+ Lập Chứng Từ Ghi Giảm"}
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            Đang tải dữ liệu từ hệ thống...
          </div>
        )}

        {/* 1. ASSETS TAB */}
        {!loading && activeTab === "assets" && (
          <div className="live-fa-table-card">
            <table className="live-fa-table">
              <thead>
                <tr>
                  <th>Mã tài sản</th>
                  <th>Tên tài sản</th>
                  <th>Loại</th>
                  <th>Nhóm</th>
                  <th>Đơn vị sử dụng</th>
                  <th>Ngày đưa vào SD</th>
                  <th>Nguyên giá (VND)</th>
                  <th>Đã KH/PB (VND)</th>
                  <th>Giá trị còn lại (VND)</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có hồ sơ tài sản cố định hoặc CCDC nào
                    </td>
                  </tr>
                ) : (
                  assets.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{a.code}</td>
                      <td>{a.name}</td>
                      <td>
                        <span className="live-fa-tag-pill">
                          {a.asset_type === "FIXED_ASSET" ? "TSCĐ" : "CCDC"}
                        </span>
                      </td>
                      <td>{a.category_name || a.category_code || "—"}</td>
                      <td>{a.department_name || a.branch_name || "—"}</td>
                      <td>{a.in_service_date}</td>
                      <td style={{ fontWeight: "700" }}>{formatNum(a.original_cost)}</td>
                      <td style={{ color: "#fbbf24" }}>{formatNum(a.accumulated_depreciation || a.allocated_value)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(a.remaining_value)}</td>
                      <td>
                        <span className={`live-fa-badge-status ${a.status?.toLowerCase() || "draft"}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. CATEGORIES TAB */}
        {!loading && activeTab === "categories" && (
          <div className="live-fa-table-card">
            <table className="live-fa-table">
              <thead>
                <tr>
                  <th>Mã nhóm</th>
                  <th>Tên nhóm</th>
                  <th>Loại tài sản</th>
                  <th>Số kỳ KH/PB ngầm định</th>
                  <th>Phương pháp</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có danh mục nhóm tài sản
                    </td>
                  </tr>
                ) : (
                  categories.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{c.code}</td>
                      <td>{c.name}</td>
                      <td>
                        <span className="live-fa-tag-pill">
                          {c.asset_type === "FIXED_ASSET" ? "Tài sản cố định" : "Công cụ dụng cụ"}
                        </span>
                      </td>
                      <td>{c.default_periods} kỳ</td>
                      <td>{c.default_method}</td>
                      <td>
                        <span className={`live-fa-badge-status ${c.is_active ? "active" : "draft"}`}>
                          {c.is_active ? "Đang dùng" : "Ngừng dùng"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. CALCULATIONS TAB */}
        {!loading && activeTab === "calculations" && (
          <div className="live-fa-table-card">
            <table className="live-fa-table">
              <thead>
                <tr>
                  <th>Số bảng tính</th>
                  <th>Loại tính toán</th>
                  <th>Kỳ tính</th>
                  <th>Thời gian</th>
                  <th>Tổng giá trị tính (VND)</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {calculations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bảng tính khấu hao hoặc phân bổ nào
                    </td>
                  </tr>
                ) : (
                  calculations.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{c.number}</td>
                      <td>
                        <span className="live-fa-tag-pill">
                          {c.calculation_type === "DEPRECIATION" ? "Khấu hao TSCĐ" : "Phân bổ CCDC"}
                        </span>
                      </td>
                      <td>{c.period_code}</td>
                      <td>{`${c.period_start} → ${c.period_end}`}</td>
                      <td style={{ fontWeight: "700", color: "#fbbf24" }}>{formatNum(c.total_amount)}</td>
                      <td>
                        <span className={`live-fa-badge-status ${c.status?.toLowerCase() || "draft"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {c.status === "DRAFT" && (
                            <button
                              className="live-fa-btn live-fa-btn-primary"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleCalcAction(c.id, "calculate")}
                            >
                              Chạy tính toán
                            </button>
                          )}
                          {c.status === "CALCULATED" && (
                            <button
                              className="live-fa-btn live-fa-btn-success"
                              style={{ padding: "4px 8px", fontSize: "11px" }}
                              onClick={() => handleCalcAction(c.id, "post")}
                            >
                              Ghi sổ hoàn thành
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. TRANSACTIONS TAB (Acquisitions, Transfers, Revaluations, Disposals, All) */}
        {!loading &&
          (activeTab === "acquisitions" ||
            activeTab === "transfers" ||
            activeTab === "revaluations" ||
            activeTab === "disposals" ||
            activeTab === "transactions") && (
            <div className="live-fa-table-card">
              <table className="live-fa-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Loại giao dịch</th>
                    <th>Mã & Tên tài sản</th>
                    <th>Ngày chứng từ</th>
                    <th>Số tiền (VND)</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                        Chưa có chứng từ tài sản nào
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: "700", color: "#f8fafc" }}>{tx.number}</td>
                        <td>
                          <span className="live-fa-tag-pill">{tx.transaction_type}</span>
                        </td>
                        <td>{tx.asset_name || tx.asset_code || tx.asset}</td>
                        <td>{tx.transaction_date}</td>
                        <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(tx.amount)}</td>
                        <td>{tx.reason || "—"}</td>
                        <td>
                          <span className={`live-fa-badge-status ${tx.status?.toLowerCase() || "draft"}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {tx.status === "DRAFT" && (
                              <button
                                className="live-fa-btn live-fa-btn-primary"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() =>
                                  handleTxAction(tx.id, "submit", { workflow_snapshot: { allow_self_approval: true } })
                                }
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {tx.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-fa-btn live-fa-btn-success"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "approve", { comment: "Duyệt giao dịch" })}
                              >
                                Phê duyệt
                              </button>
                            )}
                            {tx.status === "APPROVED" && !tx.asset_applied && (
                              <button
                                className="live-fa-btn live-fa-btn-success"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "post")}
                              >
                                Ghi nhận
                              </button>
                            )}
                            {tx.status === "POSTED" && (
                              <button
                                className="live-fa-btn live-fa-btn-danger"
                                style={{ padding: "4px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "reverse", { reason: "Đảo giao dịch" })}
                              >
                                Đảo chứng từ
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        {/* 5. PERIODS TAB */}
        {!loading && activeTab === "periods" && (
          <div className="live-fa-table-card">
            <table className="live-fa-table">
              <thead>
                <tr>
                  <th>Mã kỳ</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Trạng thái kỳ</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có kỳ tài sản nào
                    </td>
                  </tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{p.code}</td>
                      <td>{p.start_date}</td>
                      <td>{p.end_date}</td>
                      <td>
                        <span className={`live-fa-badge-status ${p.status === "OPEN" ? "active" : "draft"}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. APPROVALS TAB */}
        {!loading && activeTab === "approvals" && (
          <div className="live-fa-table-card">
            <table className="live-fa-table">
              <thead>
                <tr>
                  <th>Mã chứng từ</th>
                  <th>Cấp duyệt</th>
                  <th>Quyết định</th>
                  <th>Người thực hiện</th>
                  <th>Ý kiến</th>
                  <th>Thời gian quyết định</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có lịch sử phê duyệt tài sản nào
                    </td>
                  </tr>
                ) : (
                  approvals.map((ap) => (
                    <tr key={ap.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{ap.transaction_number || ap.transaction}</td>
                      <td>Cấp {ap.level}</td>
                      <td>
                        <span className={`live-fa-badge-status ${ap.decision?.toLowerCase() || "draft"}`}>
                          {ap.decision}
                        </span>
                      </td>
                      <td>{ap.actor_name || ap.actor}</td>
                      <td>{ap.comment || "—"}</td>
                      <td>{ap.decided_at?.slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal 1: Create Asset Record */}
      {modalType === "create_asset" && (
        <div className="live-fa-modal-backdrop">
          <div className="live-fa-modal">
            <div className="live-fa-modal-header">
              <span>Khai báo hồ sơ tài sản / CCDC mới</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAsset}>
              <div className="live-fa-modal-body">
                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Mã tài sản:</label>
                    <input
                      type="text"
                      className="live-fa-input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Loại tài sản:</label>
                    <select
                      className="live-fa-select"
                      value={formData.asset_type}
                      onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                    >
                      <option value="FIXED_ASSET">Tài sản cố định (TSCĐ)</option>
                      <option value="TOOL">Công cụ dụng cụ (CCDC)</option>
                    </select>
                  </div>
                </div>

                <div className="live-fa-form-group">
                  <label>Tên tài sản / CCDC:</label>
                  <input
                    type="text"
                    className="live-fa-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Nhóm tài sản:</label>
                    <select
                      className="live-fa-select"
                      value={formData.category}
                      onChange={(e) => {
                        const sel = refs.categories.find((c) => c.id === e.target.value);
                        setFormData({
                          ...formData,
                          category: e.target.value,
                          asset_type: sel ? sel.asset_type : formData.asset_type,
                        });
                      }}
                      required
                    >
                      {refs.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} - {c.name} ({c.asset_type === "FIXED_ASSET" ? "TSCĐ" : "CCDC"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-fa-form-group">
                    <label>Chi nhánh quản lý:</label>
                    <select
                      className="live-fa-select"
                      value={formData.branch}
                      onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      required
                    >
                      {refs.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} - {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Nguyên giá (VND):</label>
                    <input
                      type="number"
                      className="live-fa-input"
                      value={formData.original_cost}
                      onChange={(e) => setFormData({ ...formData, original_cost: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Số kỳ sử dụng (Tháng):</label>
                    <input
                      type="number"
                      className="live-fa-input"
                      value={formData.useful_life_periods}
                      onChange={(e) => setFormData({ ...formData, useful_life_periods: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Ngày mua:</label>
                    <input
                      type="date"
                      className="live-fa-input"
                      value={formData.acquisition_date}
                      onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Ngày đưa vào sử dụng:</label>
                    <input
                      type="date"
                      className="live-fa-input"
                      value={formData.in_service_date}
                      onChange={(e) => setFormData({ ...formData, in_service_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="live-fa-modal-footer">
                <button
                  type="button"
                  className="live-fa-btn live-fa-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-fa-btn live-fa-btn-primary">
                  Lưu hồ sơ tài sản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Category */}
      {modalType === "create_category" && (
        <div className="live-fa-modal-backdrop">
          <div className="live-fa-modal">
            <div className="live-fa-modal-header">
              <span>Thêm nhóm tài sản / CCDC</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="live-fa-modal-body">
                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Mã nhóm:</label>
                    <input
                      type="text"
                      className="live-fa-input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Loại tài sản:</label>
                    <select
                      className="live-fa-select"
                      value={formData.asset_type}
                      onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                    >
                      <option value="FIXED_ASSET">Tài sản cố định (TSCĐ)</option>
                      <option value="TOOL">Công cụ dụng cụ (CCDC)</option>
                    </select>
                  </div>
                </div>

                <div className="live-fa-form-group">
                  <label>Tên nhóm tài sản:</label>
                  <input
                    type="text"
                    className="live-fa-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="live-fa-form-group">
                  <label>Số kỳ khấu hao ngầm định (tháng):</label>
                  <input
                    type="number"
                    className="live-fa-input"
                    value={formData.default_periods}
                    onChange={(e) => setFormData({ ...formData, default_periods: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="live-fa-modal-footer">
                <button
                  type="button"
                  className="live-fa-btn live-fa-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-fa-btn live-fa-btn-primary">
                  Lưu nhóm tài sản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Calculation Run */}
      {modalType === "create_calculation" && (
        <div className="live-fa-modal-backdrop">
          <div className="live-fa-modal">
            <div className="live-fa-modal-header">
              <span>Lập bảng tính khấu hao / phân bổ</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateCalculation}>
              <div className="live-fa-modal-body">
                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Số bảng tính:</label>
                    <input
                      type="text"
                      className="live-fa-input"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Loại tính toán:</label>
                    <select
                      className="live-fa-select"
                      value={formData.calculation_type}
                      onChange={(e) => setFormData({ ...formData, calculation_type: e.target.value })}
                    >
                      <option value="DEPRECIATION">Khấu hao TSCĐ</option>
                      <option value="ALLOCATION">Phân bổ CCDC</option>
                    </select>
                  </div>
                </div>

                <div className="live-fa-form-group">
                  <label>Mã kỳ tài sản:</label>
                  <input
                    type="text"
                    className="live-fa-input"
                    value={formData.period_code}
                    onChange={(e) => setFormData({ ...formData, period_code: e.target.value })}
                    required
                  />
                </div>

                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Từ ngày:</label>
                    <input
                      type="date"
                      className="live-fa-input"
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Đến ngày:</label>
                    <input
                      type="date"
                      className="live-fa-input"
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="live-fa-modal-footer">
                <button
                  type="button"
                  className="live-fa-btn live-fa-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-fa-btn live-fa-btn-primary">
                  Tạo bảng tính
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Transaction */}
      {modalType === "create_transaction" && (
        <div className="live-fa-modal-backdrop">
          <div className="live-fa-modal">
            <div className="live-fa-modal-header">
              <span>Lập chứng từ giao dịch tài sản ({formData.transaction_type})</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTransaction}>
              <div className="live-fa-modal-body">
                <div className="live-fa-form-group">
                  <label>Chọn tài sản:</label>
                  <select
                    className="live-fa-select"
                    value={formData.asset}
                    onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                    required
                  >
                    {refs.assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({a.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-fa-form-row">
                  <div className="live-fa-form-group">
                    <label>Số chứng từ:</label>
                    <input
                      type="text"
                      className="live-fa-input"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-fa-form-group">
                    <label>Ngày chứng từ:</label>
                    <input
                      type="date"
                      className="live-fa-input"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-fa-form-group">
                  <label>Số tiền / Giá trị:</label>
                  <input
                    type="number"
                    className="live-fa-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                {formData.transaction_type === "TRANSFER" && (
                  <div className="live-fa-form-row">
                    <div className="live-fa-form-group">
                      <label>Đơn vị / Chi nhánh nhận:</label>
                      <select
                        className="live-fa-select"
                        value={formData.target_branch}
                        onChange={(e) => setFormData({ ...formData, target_branch: e.target.value })}
                      >
                        {refs.branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} - {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="live-fa-form-group">
                      <label>Bộ phận nhận:</label>
                      <select
                        className="live-fa-select"
                        value={formData.target_department}
                        onChange={(e) => setFormData({ ...formData, target_department: e.target.value })}
                      >
                        {refs.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code} - {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="live-fa-form-group">
                  <label>Lý do nghiệp vụ:</label>
                  <textarea
                    className="live-fa-textarea"
                    rows={2}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="live-fa-modal-footer">
                <button
                  type="button"
                  className="live-fa-btn live-fa-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-fa-btn live-fa-btn-primary">
                  Lưu chứng từ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
