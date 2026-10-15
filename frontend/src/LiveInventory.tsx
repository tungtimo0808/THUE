import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-inventory.css";

type TabKey =
  | "policies"
  | "receipts"
  | "issues"
  | "transfers"
  | "balances"
  | "movements"
  | "lot_serials"
  | "counts"
  | "assemblies"
  | "valuations"
  | "periods"
  | "approvals";

interface ReferenceData {
  warehouses: any[];
  items: any[];
  uoms: any[];
  parties: any[];
}

export default function LiveInventory() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("balances");
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
    warehouses: [],
    items: [],
    uoms: [],
    parties: [],
  });

  // Tab Data States
  const [policies, setPolicies] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [lotSerials, setLotSerials] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [assemblies, setAssemblies] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
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
      const [whRes, itemRes, uomRes, partyRes] = await Promise.all([
        fetch(`/api/v1/master-data/warehouses/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/items/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/units-of-measure/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
      ]);

      const whData = whRes.ok ? await whRes.json() : [];
      const itemData = itemRes.ok ? await itemRes.json() : [];
      const uomData = uomRes.ok ? await uomRes.json() : [];
      const partyData = partyRes.ok ? await partyRes.json() : [];

      setRefs({
        warehouses: Array.isArray(whData) ? whData : whData.results || [],
        items: Array.isArray(itemData) ? itemData : itemData.results || [],
        uoms: Array.isArray(uomData) ? uomData : uomData.results || [],
        parties: Array.isArray(partyData) ? partyData : partyData.results || [],
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
      if (activeTab === "policies") {
        const res = await fetch(`/api/v1/inventory/policies/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPolicies(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "receipts") {
        const res = await fetch(`/api/v1/inventory/transactions/?company_id=${companyId}&transaction_type=RECEIPT`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setReceipts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "issues") {
        const res = await fetch(`/api/v1/inventory/transactions/?company_id=${companyId}&transaction_type=ISSUE`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setIssues(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "transfers") {
        const res = await fetch(`/api/v1/inventory/transactions/?company_id=${companyId}&transaction_type=TRANSFER`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setTransfers(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "balances") {
        const res = await fetch(`/api/v1/inventory/balances/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setBalances(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "movements") {
        const res = await fetch(`/api/v1/inventory/movements/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setMovements(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "lot_serials") {
        const res = await fetch(`/api/v1/inventory/lot-serials/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setLotSerials(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "counts") {
        const res = await fetch(`/api/v1/inventory/counts/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setCounts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "assemblies") {
        const res = await fetch(`/api/v1/inventory/assemblies/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setAssemblies(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "valuations") {
        const res = await fetch(`/api/v1/inventory/valuations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setValuations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "periods") {
        const res = await fetch(`/api/v1/inventory/periods/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPeriods(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "approvals") {
        const res = await fetch(`/api/v1/inventory/approvals/?company_id=${companyId}`, { headers: h });
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
      const url = `/api/v1/inventory/transactions/${id}/${actionName}/?company_id=${companyId}`;
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

  // Action on Stock Count: create_adjustment
  const handleCountAdjustment = async (id: string) => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/inventory/counts/${id}/create-adjustment/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Lập phiếu điều chỉnh thất bại");
      }

      setNotice({ type: "success", text: "Lập phiếu điều chỉnh kiểm kê kho thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Action on Assembly: post
  const handleAssemblyPost = async (id: string) => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/inventory/assemblies/${id}/post/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Ghi sổ lệnh lắp ráp thất bại");
      }

      setNotice({ type: "success", text: "Ghi nhận lắp ráp/tháo dỡ thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Handlers for Creating Records

  // 1. Create Policy
  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const selectedItem = refs.items.find((i) => i.id === formData.item) || refs.items[0];
      const payload = {
        company: companyId,
        warehouse: formData.warehouse || refs.warehouses[0]?.id,
        item: selectedItem?.id,
        base_uom: selectedItem?.base_uom?.id || selectedItem?.base_uom || refs.uoms[0]?.id,
        valuation_method: formData.valuation_method || "MOVING_AVERAGE",
        allow_negative: formData.allow_negative || false,
        track_lot: formData.track_lot || false,
        track_serial: formData.track_serial || false,
        minimum_quantity: formData.minimum_quantity || "0",
        maximum_quantity: formData.maximum_quantity ? formData.maximum_quantity : null,
      };

      const res = await fetch(`/api/v1/inventory/policies/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo chính sách kho thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo chính sách: " + e.message });
    }
  };

  // 2. Create Transaction (Receipt / Issue / Transfer)
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const selectedItem = refs.items.find((i) => i.id === formData.item) || refs.items[0];
      const selectedUom = selectedItem?.base_uom?.id || selectedItem?.base_uom || refs.uoms[0]?.id;

      const payload: any = {
        company: companyId,
        number: formData.number || `${formData.transaction_type === "RECEIPT" ? "PNK" : formData.transaction_type === "ISSUE" ? "PXK" : "PCK"}-${Date.now().toString().slice(-6)}`,
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date,
        reason: formData.reason || "Nghiệp vụ kho thông thường",
        lines: [
          {
            line_no: 1,
            item: selectedItem?.id,
            uom: selectedUom,
            quantity: formData.quantity || "10",
            unit_cost: formData.unit_cost || "50000",
            notes: formData.notes || "",
          },
        ],
      };

      if (formData.transaction_type === "RECEIPT") {
        payload.destination_warehouse = formData.destination_warehouse || refs.warehouses[0]?.id;
      } else if (formData.transaction_type === "ISSUE") {
        payload.source_warehouse = formData.source_warehouse || refs.warehouses[0]?.id;
      } else if (formData.transaction_type === "TRANSFER") {
        payload.source_warehouse = formData.source_warehouse || refs.warehouses[0]?.id;
        payload.destination_warehouse = formData.destination_warehouse || refs.warehouses[1]?.id;
      }

      const res = await fetch(`/api/v1/inventory/transactions/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: `Lập phiếu ${formData.transaction_type} thành công!` });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi lập phiếu: " + e.message });
    }
  };

  // 3. Create Lot / Serial
  const handleCreateLotSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        company: companyId,
        item: formData.item || refs.items[0]?.id,
        code: formData.code || `LOT-${Date.now().toString().slice(-6)}`,
        tracking_type: formData.tracking_type || "LOT",
        manufacture_date: formData.manufacture_date || null,
        expiry_date: formData.expiry_date || null,
        status: "ACTIVE",
      };

      const res = await fetch(`/api/v1/inventory/lot-serials/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo Lô/Serial thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo Lot/Serial: " + e.message });
    }
  };

  // 4. Create Stock Count
  const handleCreateStockCount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetItem = refs.items[0];
      const payload = {
        company: companyId,
        warehouse: formData.warehouse || refs.warehouses[0]?.id,
        number: formData.number || `KK-${Date.now().toString().slice(-6)}`,
        count_date: formData.count_date,
        snapshot_at: new Date().toISOString(),
        notes: formData.notes || "Kiểm kê định kỳ",
        lines: [
          {
            item: targetItem?.id,
            actual_quantity: formData.actual_quantity || "25",
            notes: "Kiểm đếm thực tế",
          },
        ],
      };

      const res = await fetch(`/api/v1/inventory/counts/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo phiên kiểm kê kho thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi kiểm kê: " + e.message });
    }
  };

  // 5. Create Assembly Order
  const handleCreateAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const compItem = refs.items[0];
      const outItem = refs.items[1] || refs.items[0];
      const payload = {
        company: companyId,
        warehouse: formData.warehouse || refs.warehouses[0]?.id,
        number: formData.number || `LR-${Date.now().toString().slice(-6)}`,
        operation: formData.operation || "ASSEMBLE",
        assembly_date: formData.assembly_date,
        lines: [
          {
            line_no: 1,
            role: "COMPONENT",
            item: compItem?.id,
            quantity: "2",
            unit_cost: "1000",
          },
          {
            line_no: 2,
            role: "OUTPUT",
            item: outItem?.id,
            quantity: "1",
            unit_cost: "2000",
          },
        ],
      };

      const res = await fetch(`/api/v1/inventory/assemblies/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Lập lệnh lắp ráp/tháo dỡ thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi lắp ráp: " + e.message });
    }
  };

  // 6. Run Valuation
  const handleRunValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        company: companyId,
        warehouse: formData.warehouse || refs.warehouses[0]?.id,
        valuation_date: formData.valuation_date || new Date().toISOString().slice(0, 10),
        method: formData.method || "MOVING_AVERAGE",
      };

      const res = await fetch(`/api/v1/inventory/valuations/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Chạy tính giá vốn kho thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tính giá vốn: " + e.message });
    }
  };

  // Helper format number
  const formatNum = (val: any) => {
    const num = Number(val) || 0;
    return num.toLocaleString("vi-VN");
  };

  return (
    <div className="live-inv-root">
      {/* Top Header */}
      <header className="live-inv-header">
        <div className="live-inv-title-box">
          <div className="live-inv-title">
            <span>📦</span>
            <span>Quản Lý Kho Hàng (Live Inventory Management)</span>
            <span className="live-inv-badge">UC-INV-01 → UC-INV-10</span>
          </div>
          <div className="live-inv-company-info">
            <span>Doanh nghiệp:</span>
            <span className="live-inv-company-tag">{companyId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="live-inv-btn-group">
          <Link to="/bank" className="live-inv-btn live-inv-btn-secondary">
            🏛️ Ngân hàng
          </Link>
          <Link to="/cash" className="live-inv-btn live-inv-btn-secondary">
            💵 Tiền mặt
          </Link>
          <Link to="/purchases" className="live-inv-btn live-inv-btn-secondary">
            🛒 Mua hàng
          </Link>
          <Link to="/sales" className="live-inv-btn live-inv-btn-secondary">
            🏷️ Bán hàng
          </Link>
          <button onClick={() => { fetchRefs(); loadTabData(); }} className="live-inv-btn live-inv-btn-primary">
            🔄 Làm mới
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="live-inv-nav">
        <button
          className={`live-inv-nav-btn ${activeTab === "balances" ? "active" : ""}`}
          onClick={() => setActiveTab("balances")}
        >
          📊 Tồn kho tức thời <span className="live-inv-tag-pill">{balances.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "receipts" ? "active" : ""}`}
          onClick={() => setActiveTab("receipts")}
        >
          📥 Phiếu nhập kho <span className="live-inv-tag-pill">{receipts.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "issues" ? "active" : ""}`}
          onClick={() => setActiveTab("issues")}
        >
          📤 Phiếu xuất kho <span className="live-inv-tag-pill">{issues.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "transfers" ? "active" : ""}`}
          onClick={() => setActiveTab("transfers")}
        >
          ↔️ Điều chuyển kho <span className="live-inv-tag-pill">{transfers.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "movements" ? "active" : ""}`}
          onClick={() => setActiveTab("movements")}
        >
          📈 Thẻ kho / Biến động <span className="live-inv-tag-pill">{movements.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "lot_serials" ? "active" : ""}`}
          onClick={() => setActiveTab("lot_serials")}
        >
          🏷️ Quản lý Lô & HSD <span className="live-inv-tag-pill">{lotSerials.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "counts" ? "active" : ""}`}
          onClick={() => setActiveTab("counts")}
        >
          📝 Kiểm kê kho <span className="live-inv-tag-pill">{counts.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "assemblies" ? "active" : ""}`}
          onClick={() => setActiveTab("assemblies")}
        >
          🔧 Lắp ráp / Tháo dỡ <span className="live-inv-tag-pill">{assemblies.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "valuations" ? "active" : ""}`}
          onClick={() => setActiveTab("valuations")}
        >
          💰 Tính giá vốn <span className="live-inv-tag-pill">{valuations.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "policies" ? "active" : ""}`}
          onClick={() => setActiveTab("policies")}
        >
          ⚙️ Chính sách kho <span className="live-inv-tag-pill">{policies.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "periods" ? "active" : ""}`}
          onClick={() => setActiveTab("periods")}
        >
          🔒 Kỳ kho <span className="live-inv-tag-pill">{periods.length}</span>
        </button>
        <button
          className={`live-inv-nav-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          ✅ Nhật ký duyệt <span className="live-inv-tag-pill">{approvals.length}</span>
        </button>
      </nav>

      {/* Notice Banner */}
      {notice && (
        <div className={`live-inv-notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="live-inv-body">
        {/* KPI Cards */}
        <div className="live-inv-kpi-grid">
          <div className="live-inv-kpi-card">
            <span className="live-inv-kpi-label">Mặt hàng có số dư tồn</span>
            <span className="live-inv-kpi-val" style={{ color: "#34d399" }}>
              {balances.length}
            </span>
          </div>
          <div className="live-inv-kpi-card">
            <span className="live-inv-kpi-label">Phiếu Nhập Kho</span>
            <span className="live-inv-kpi-val" style={{ color: "#38bdf8" }}>
              {receipts.length}
            </span>
          </div>
          <div className="live-inv-kpi-card">
            <span className="live-inv-kpi-label">Phiếu Xuất Kho</span>
            <span className="live-inv-kpi-val" style={{ color: "#f87171" }}>
              {issues.length}
            </span>
          </div>
          <div className="live-inv-kpi-card">
            <span className="live-inv-kpi-label">Phiếu Điều Chuyển</span>
            <span className="live-inv-kpi-val" style={{ color: "#fbbf24" }}>
              {transfers.length}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="live-inv-controls">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {activeTab === "balances" && "Theo Dõi Tồn Kho Tức Thời (UC-INV-05)"}
              {activeTab === "receipts" && "Phiếu Nhập Kho (UC-INV-02)"}
              {activeTab === "issues" && "Phiếu Xuất Kho (UC-INV-03)"}
              {activeTab === "transfers" && "Điều Chuyển Kho Nội Bộ (UC-INV-04)"}
              {activeTab === "movements" && "Sổ Chi Tiết Vật Tư / Thẻ Kho (UC-INV-05)"}
              {activeTab === "lot_serials" && "Quản Lý Lô & Hạn Sử Dụng (UC-INV-06)"}
              {activeTab === "counts" && "Kiểm Kê Kho & Xử Lý Chênh Lệch (UC-INV-07)"}
              {activeTab === "assemblies" && "Lắp Ráp & Tháo Dỡ Hàng Hóa (UC-INV-08)"}
              {activeTab === "valuations" && "Tính Giá Vốn Tồn Kho Định Kỳ (UC-INV-09)"}
              {activeTab === "policies" && "Chính Sách Kho & Định Giá Vốn (UC-INV-01)"}
              {activeTab === "periods" && "Khóa Sổ / Mở Sổ Kỳ Kho (UC-INV-10)"}
              {activeTab === "approvals" && "Nhật Ký Phê Duyệt Nghiệp Vụ Kho (UC-INV-10)"}
            </h2>
          </div>

          <div className="live-inv-btn-group">
            {activeTab === "receipts" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    transaction_type: "RECEIPT",
                    destination_warehouse: refs.warehouses[0]?.id || "",
                    transaction_date: today,
                    item: refs.items[0]?.id || "",
                    quantity: "20",
                    unit_cost: "50000",
                    reason: "Nhập mua hàng về nhập kho",
                  });
                  setModalType("create_receipt");
                }}
              >
                + Lập Phiếu Nhập Kho
              </button>
            )}

            {activeTab === "issues" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    transaction_type: "ISSUE",
                    source_warehouse: refs.warehouses[0]?.id || "",
                    transaction_date: today,
                    item: refs.items[0]?.id || "",
                    quantity: "5",
                    unit_cost: "50000",
                    reason: "Xuất kho bán hàng",
                  });
                  setModalType("create_issue");
                }}
              >
                + Lập Phiếu Xuất Kho
              </button>
            )}

            {activeTab === "transfers" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    transaction_type: "TRANSFER",
                    source_warehouse: refs.warehouses[0]?.id || "",
                    destination_warehouse: refs.warehouses[1]?.id || refs.warehouses[0]?.id,
                    transaction_date: today,
                    item: refs.items[0]?.id || "",
                    quantity: "5",
                    unit_cost: "50000",
                    reason: "Điều chuyển hàng giữa các kho",
                  });
                  setModalType("create_transfer");
                }}
              >
                + Lập Lệnh Điều Chuyển
              </button>
            )}

            {activeTab === "lot_serials" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  const exp = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
                  setFormData({
                    item: refs.items[0]?.id || "",
                    code: `L-${Date.now().toString().slice(-6)}`,
                    tracking_type: "LOT",
                    manufacture_date: today,
                    expiry_date: exp,
                  });
                  setModalType("create_lot");
                }}
              >
                + Thêm Lô / Serial
              </button>
            )}

            {activeTab === "counts" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    warehouse: refs.warehouses[0]?.id || "",
                    count_date: today,
                    actual_quantity: "25",
                    notes: "Kiểm kê định kỳ cuối tháng",
                  });
                  setModalType("create_count");
                }}
              >
                + Tạo Phiên Kiểm Kê
              </button>
            )}

            {activeTab === "assemblies" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    warehouse: refs.warehouses[0]?.id || "",
                    operation: "ASSEMBLE",
                    assembly_date: today,
                  });
                  setModalType("create_assembly");
                }}
              >
                + Lập Lệnh Lắp Ráp
              </button>
            )}

            {activeTab === "valuations" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    warehouse: refs.warehouses[0]?.id || "",
                    valuation_date: today,
                    method: "MOVING_AVERAGE",
                  });
                  setModalType("create_valuation");
                }}
              >
                + Tính Giá Vốn Kho
              </button>
            )}

            {activeTab === "policies" && (
              <button
                className="live-inv-btn live-inv-btn-primary"
                onClick={() => {
                  setFormData({
                    warehouse: refs.warehouses[0]?.id || "",
                    item: refs.items[0]?.id || "",
                    valuation_method: "MOVING_AVERAGE",
                    allow_negative: true,
                    track_lot: false,
                    track_serial: false,
                    minimum_quantity: "0",
                    maximum_quantity: "1000",
                  });
                  setModalType("create_policy");
                }}
              >
                + Thêm Chính Sách Kho
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Tables */}
        {loading && <div style={{ padding: "20px", color: "#34d399" }}>Đang tải dữ liệu kho...</div>}

        {/* 1. BALANCES (Tồn kho tức thời) */}
        {!loading && activeTab === "balances" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Mã kho</th>
                  <th>Tên kho</th>
                  <th>Mã vật tư/hàng hóa</th>
                  <th>Tên hàng hóa</th>
                  <th>ĐVT</th>
                  <th>Số lượng tồn</th>
                  <th>Tồn khả dụng</th>
                  <th>Giá trị tồn kho (VND)</th>
                  <th>Giá vốn BQ (VND)</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có dữ liệu tồn kho tức thời
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {b.warehouse_code || b.warehouse?.code || "—"}
                      </td>
                      <td>{b.warehouse_name || b.warehouse?.name || "—"}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>
                        {b.item_code || b.item?.code || "—"}
                      </td>
                      <td>{b.item_name || b.item?.name || "—"}</td>
                      <td>
                        <span className="live-inv-tag-pill">{b.uom_name || "Cái"}</span>
                      </td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(b.quantity)}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>{formatNum(b.available_quantity)}</td>
                      <td style={{ fontWeight: "700" }}>{formatNum(b.inventory_value)}</td>
                      <td style={{ color: "#94a3b8" }}>{formatNum(b.average_cost)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. RECEIPTS, 3. ISSUES, 4. TRANSFERS */}
        {!loading && (activeTab === "receipts" || activeTab === "issues" || activeTab === "transfers") && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Số chứng từ</th>
                  <th>Loại nghiệp vụ</th>
                  <th>Ngày hạch toán</th>
                  <th>Kho nguồn</th>
                  <th>Kho đích</th>
                  <th>Lý do</th>
                  <th>Tổng giá trị (VND)</th>
                  <th>Trạng thái</th>
                  <th>Sổ cái (GL)</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "receipts" ? receipts : activeTab === "issues" ? issues : transfers).length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có phiếu kho nào
                    </td>
                  </tr>
                ) : (
                  (activeTab === "receipts" ? receipts : activeTab === "issues" ? issues : transfers).map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{tx.number}</td>
                      <td>
                        <span className="live-inv-tag-pill">{tx.transaction_type}</span>
                      </td>
                      <td>{tx.transaction_date}</td>
                      <td>{tx.source_warehouse_code || tx.source_warehouse?.code || "—"}</td>
                      <td>{tx.destination_warehouse_code || tx.destination_warehouse?.code || "—"}</td>
                      <td style={{ fontSize: "12px", color: "#94a3b8" }}>{tx.reason || "—"}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(tx.total_value)}</td>
                      <td>
                        <span className={`live-inv-badge-status ${tx.status?.toLowerCase() || "draft"}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>
                        <span className={`live-inv-badge-status ${tx.gl_status === "POSTED" ? "posted" : "draft"}`}>
                          {tx.gl_status || "PENDING"}
                        </span>
                      </td>
                      <td>
                        <div className="live-inv-btn-group">
                          {tx.status === "DRAFT" && (
                            <button
                              className="live-inv-btn live-inv-btn-primary"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => handleTxAction(tx.id, "submit", { workflow_snapshot: { allow_self_approval: true } })}
                            >
                              Gửi duyệt
                            </button>
                          )}
                          {tx.status === "PENDING_APPROVAL" && (
                            <>
                              <button
                                className="live-inv-btn live-inv-btn-success"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "approve")}
                              >
                                Duyệt
                              </button>
                              <button
                                className="live-inv-btn live-inv-btn-danger"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "reject")}
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {tx.status === "APPROVED" && (
                            <button
                              className="live-inv-btn live-inv-btn-success"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => handleTxAction(tx.id, "post")}
                            >
                              Ghi sổ kho
                            </button>
                          )}
                          {tx.status === "POSTED" && (
                            <>
                              <button
                                className="live-inv-btn live-inv-btn-danger"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "reverse")}
                              >
                                Đảo sổ
                              </button>
                              <button
                                className="live-inv-btn live-inv-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "post_gl")}
                              >
                                GL
                              </button>
                            </>
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

        {/* 5. MOVEMENTS (Thẻ kho) */}
        {!loading && activeTab === "movements" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Ngày phát sinh</th>
                  <th>Số chứng từ</th>
                  <th>Mã kho</th>
                  <th>Mã vật tư</th>
                  <th>Biến động số lượng</th>
                  <th>Biến động giá trị (VND)</th>
                  <th>Số dư tồn tức thời</th>
                  <th>Giá trị tồn tức thời</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có biến động thẻ kho nào
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id}>
                      <td>{m.movement_date}</td>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {m.transaction?.number || m.transaction_id?.slice(0, 8)}
                      </td>
                      <td>{m.warehouse?.code || "—"}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>{m.item?.code || "—"}</td>
                      <td
                        style={{
                          fontWeight: "700",
                          color: Number(m.quantity_delta) >= 0 ? "#34d399" : "#f87171",
                        }}
                      >
                        {Number(m.quantity_delta) >= 0 ? `+${formatNum(m.quantity_delta)}` : formatNum(m.quantity_delta)}
                      </td>
                      <td style={{ fontWeight: "700" }}>{formatNum(m.value_delta)}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>{formatNum(m.balance_quantity)}</td>
                      <td>{formatNum(m.balance_value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. LOT / SERIAL */}
        {!loading && activeTab === "lot_serials" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Mã Lô / Số Serial</th>
                  <th>Mã hàng hóa</th>
                  <th>Loại theo dõi</th>
                  <th>Ngày sản xuất</th>
                  <th>Hạn sử dụng</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {lotSerials.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có Lô/Serial nào
                    </td>
                  </tr>
                ) : (
                  lotSerials.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{l.code}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>{l.item?.code || "—"}</td>
                      <td>
                        <span className="live-inv-tag-pill">{l.tracking_type}</span>
                      </td>
                      <td>{l.manufacture_date || "—"}</td>
                      <td>{l.expiry_date || "—"}</td>
                      <td>
                        <span className={`live-inv-badge-status ${l.status === "ACTIVE" ? "active" : "draft"}`}>
                          {l.status}
                        </span>
                      </td>
                      <td>{l.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. COUNTS */}
        {!loading && activeTab === "counts" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Số phiếu kiểm kê</th>
                  <th>Mã kho</th>
                  <th>Ngày kiểm kê</th>
                  <th>Ghi chú</th>
                  <th>Trạng thái</th>
                  <th>Chứng từ điều chỉnh</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {counts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có phiên kiểm kê kho nào
                    </td>
                  </tr>
                ) : (
                  counts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{c.number}</td>
                      <td>{c.warehouse_code || c.warehouse?.code || "—"}</td>
                      <td>{c.count_date}</td>
                      <td>{c.notes || "—"}</td>
                      <td>
                        <span className={`live-inv-badge-status ${c.status?.toLowerCase() || "draft"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td>
                        {c.adjustment_transaction ? (
                          <span className="live-inv-tag-pill">Đã sinh phiếu điều chỉnh</span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Chưa xử lý</span>
                        )}
                      </td>
                      <td>
                        {!c.adjustment_transaction && (
                          <button
                            className="live-inv-btn live-inv-btn-primary"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleCountAdjustment(c.id)}
                          >
                            Xử lý chênh lệch
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 8. ASSEMBLIES */}
        {!loading && activeTab === "assemblies" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Số lệnh</th>
                  <th>Kho thực hiện</th>
                  <th>Loại lệnh</th>
                  <th>Ngày lắp ráp/tháo dỡ</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {assemblies.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có lệnh lắp ráp/tháo dỡ nào
                    </td>
                  </tr>
                ) : (
                  assemblies.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{a.number}</td>
                      <td>{a.warehouse_code || a.warehouse?.code || "—"}</td>
                      <td>
                        <span className="live-inv-tag-pill">{a.operation || a.order_type}</span>
                      </td>
                      <td>{a.assembly_date}</td>
                      <td>
                        <span className={`live-inv-badge-status ${a.status?.toLowerCase() || "draft"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        {a.status === "DRAFT" && (
                          <button
                            className="live-inv-btn live-inv-btn-success"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleAssemblyPost(a.id)}
                          >
                            Ghi sổ hoàn thành
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 9. VALUATIONS */}
        {!loading && activeTab === "valuations" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Mã kỳ định giá</th>
                  <th>Kho tính giá</th>
                  <th>Ngày tính giá</th>
                  <th>Phương pháp</th>
                  <th>Tổng số lượng</th>
                  <th>Tổng giá trị (VND)</th>
                  <th>Trạng thái</th>
                  <th>Thời gian chạy</th>
                </tr>
              </thead>
              <tbody>
                {valuations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có phiên tính giá vốn kho
                    </td>
                  </tr>
                ) : (
                  valuations.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{v.id.slice(0, 8)}</td>
                      <td>{v.warehouse?.code || "—"}</td>
                      <td>{v.valuation_date || `${v.period_from} → ${v.period_to}`}</td>
                      <td>
                        <span className="live-inv-tag-pill">{v.method}</span>
                      </td>
                      <td style={{ fontWeight: "700" }}>{formatNum(v.total_quantity)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(v.total_value)}</td>
                      <td>
                        <span className="live-inv-badge-status posted">{v.status}</span>
                      </td>
                      <td>{v.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 10. POLICIES */}
        {!loading && activeTab === "policies" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Kho hàng</th>
                  <th>Mã vật tư/hàng hóa</th>
                  <th>Tên hàng hóa</th>
                  <th>ĐVT cơ sở</th>
                  <th>Phương pháp định giá</th>
                  <th>Cho phép xuất âm</th>
                  <th>Quản lý Lô/Serial</th>
                  <th>Tồn tối thiểu</th>
                  <th>Tồn tối đa</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có chính sách kho nào được thiết lập
                    </td>
                  </tr>
                ) : (
                  policies.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {p.warehouse_code || p.warehouse?.code || "—"}
                      </td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>
                        {p.item_code || p.item?.code || "—"}
                      </td>
                      <td>{p.item_name || p.item?.name || "—"}</td>
                      <td>
                        <span className="live-inv-tag-pill">{p.uom_name || "Cái"}</span>
                      </td>
                      <td>
                        <span className="live-inv-tag-pill">{p.valuation_method}</span>
                      </td>
                      <td>
                        {p.allow_negative ? (
                          <span style={{ color: "#34d399", fontWeight: "600" }}>Có</span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Không</span>
                        )}
                      </td>
                      <td>
                        {p.track_lot ? "Lô " : ""}
                        {p.track_serial ? "Serial" : ""}
                        {!p.track_lot && !p.track_serial && "Không"}
                      </td>
                      <td>{formatNum(p.minimum_quantity)}</td>
                      <td>{p.maximum_quantity ? formatNum(p.maximum_quantity) : "—"}</td>
                      <td>
                        <span className={`live-inv-badge-status ${p.is_active ? "active" : "draft"}`}>
                          {p.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 11. PERIODS */}
        {!loading && activeTab === "periods" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Mã kỳ kho</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Trạng thái</th>
                  <th>Người khóa</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có kỳ kho nào
                    </td>
                  </tr>
                ) : (
                  periods.map((pe) => (
                    <tr key={pe.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{pe.id.slice(0, 8)}</td>
                      <td>{pe.start_date}</td>
                      <td>{pe.end_date}</td>
                      <td>
                        <span className={`live-inv-badge-status ${pe.status === "CLOSED" ? "closed" : "open"}`}>
                          {pe.status}
                        </span>
                      </td>
                      <td>{pe.closed_by?.email || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 12. APPROVALS */}
        {!loading && activeTab === "approvals" && (
          <div className="live-inv-table-card">
            <table className="live-inv-table">
              <thead>
                <tr>
                  <th>Mã quyết định</th>
                  <th>Chứng từ giao dịch</th>
                  <th>Người quyết định</th>
                  <th>Quyết định</th>
                  <th>Ý kiến</th>
                  <th>Thời gian quyết định</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có lịch sử phê duyệt nghiệp vụ kho
                    </td>
                  </tr>
                ) : (
                  approvals.map((ap) => (
                    <tr key={ap.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{ap.id.slice(0, 8)}</td>
                      <td>{ap.transaction?.number || ap.transaction_id}</td>
                      <td>{ap.actor?.email || ap.actor?.username || "Admin"}</td>
                      <td>
                        <span
                          className={`live-inv-badge-status ${
                            ap.decision === "APPROVED" ? "approved" : "rejected"
                          }`}
                        >
                          {ap.decision}
                        </span>
                      </td>
                      <td>{ap.comment || "—"}</td>
                      <td>{ap.decided_at?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* Modal 1: Create Receipt / Issue / Transfer */}
      {(modalType === "create_receipt" || modalType === "create_issue" || modalType === "create_transfer") && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>
                {modalType === "create_receipt" && "Lập Phiếu Nhập Kho"}
                {modalType === "create_issue" && "Lập Phiếu Xuất Kho"}
                {modalType === "create_transfer" && "Lập Lệnh Điều Chuyển Kho Nội Bộ"}
              </span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTransaction}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-row">
                  {modalType !== "create_receipt" && (
                    <div className="live-inv-form-group">
                      <label>Kho nguồn (Xuất từ kho):</label>
                      <select
                        className="live-inv-select"
                        value={formData.source_warehouse}
                        onChange={(e) => setFormData({ ...formData, source_warehouse: e.target.value })}
                        required
                      >
                        {refs.warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} - {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {modalType !== "create_issue" && (
                    <div className="live-inv-form-group">
                      <label>Kho đích (Nhập vào kho):</label>
                      <select
                        className="live-inv-select"
                        value={formData.destination_warehouse}
                        onChange={(e) => setFormData({ ...formData, destination_warehouse: e.target.value })}
                        required
                      >
                        {refs.warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.code} - {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Ngày giao dịch:</label>
                    <input
                      type="date"
                      className="live-inv-input"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-inv-form-group">
                    <label>Mặt hàng:</label>
                    <select
                      className="live-inv-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                      required
                    >
                      {refs.items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Số lượng:</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="live-inv-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-inv-form-group">
                    <label>Đơn giá (VND):</label>
                    <input
                      type="number"
                      className="live-inv-input"
                      value={formData.unit_cost}
                      onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-inv-form-group">
                  <label>Lý do / Diễn giải:</label>
                  <textarea
                    className="live-inv-textarea"
                    rows={2}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Lưu phiếu kho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Lot/Serial */}
      {modalType === "create_lot" && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>Thêm mới Lô hàng / Số Serial</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateLotSerial}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-group">
                  <label>Chọn mặt hàng:</label>
                  <select
                    className="live-inv-select"
                    value={formData.item}
                    onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    required
                  >
                    {refs.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code} - {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Mã Lô / Serial:</label>
                    <input
                      type="text"
                      className="live-inv-input"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-inv-form-group">
                    <label>Hình thức theo dõi:</label>
                    <select
                      className="live-inv-select"
                      value={formData.tracking_type}
                      onChange={(e) => setFormData({ ...formData, tracking_type: e.target.value })}
                    >
                      <option value="LOT">Lô (Lot)</option>
                      <option value="SERIAL">Số Serial</option>
                    </select>
                  </div>
                </div>
                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Ngày sản xuất:</label>
                    <input
                      type="date"
                      className="live-inv-input"
                      value={formData.manufacture_date}
                      onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
                    />
                  </div>
                  <div className="live-inv-form-group">
                    <label>Hạn sử dụng:</label>
                    <input
                      type="date"
                      className="live-inv-input"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Lưu Lô/Serial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Stock Count */}
      {modalType === "create_count" && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>Tạo phiên kiểm kê kho</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateStockCount}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Kho kiểm kê:</label>
                    <select
                      className="live-inv-select"
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                      required
                    >
                      {refs.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-inv-form-group">
                    <label>Ngày kiểm kê:</label>
                    <input
                      type="date"
                      className="live-inv-input"
                      value={formData.count_date}
                      onChange={(e) => setFormData({ ...formData, count_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="live-inv-form-group">
                  <label>Số lượng thực tế kiểm đếm:</label>
                  <input
                    type="number"
                    className="live-inv-input"
                    value={formData.actual_quantity}
                    onChange={(e) => setFormData({ ...formData, actual_quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="live-inv-form-group">
                  <label>Ghi chú kiểm kê:</label>
                  <textarea
                    className="live-inv-textarea"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Tạo phiên kiểm kê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Assembly Order */}
      {modalType === "create_assembly" && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>Lập lệnh lắp ráp / tháo dỡ</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAssembly}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Kho thực hiện:</label>
                    <select
                      className="live-inv-select"
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                      required
                    >
                      {refs.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-inv-form-group">
                    <label>Ngày thực hiện:</label>
                    <input
                      type="date"
                      className="live-inv-input"
                      value={formData.assembly_date}
                      onChange={(e) => setFormData({ ...formData, assembly_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="live-inv-form-group">
                  <label>Loại lệnh:</label>
                  <select
                    className="live-inv-select"
                    value={formData.operation}
                    onChange={(e) => setFormData({ ...formData, operation: e.target.value })}
                  >
                    <option value="ASSEMBLE">Lắp ráp (Assemble)</option>
                    <option value="DISASSEMBLE">Tháo dỡ (Disassemble)</option>
                  </select>
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Lưu lệnh lắp ráp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Run Valuation */}
      {modalType === "create_valuation" && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>Tính giá vốn kho định kỳ</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRunValuation}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-group">
                  <label>Chọn kho cần tính giá vốn:</label>
                  <select
                    className="live-inv-select"
                    value={formData.warehouse}
                    onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                    required
                  >
                    {refs.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-inv-form-group">
                  <label>Ngày tính giá vốn:</label>
                  <input
                    type="date"
                    className="live-inv-input"
                    value={formData.valuation_date}
                    onChange={(e) => setFormData({ ...formData, valuation_date: e.target.value })}
                    required
                  />
                </div>
                <div className="live-inv-form-group">
                  <label>Phương pháp tính giá:</label>
                  <select
                    className="live-inv-select"
                    value={formData.method}
                    onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                  >
                    <option value="MOVING_AVERAGE">Bình quân liên hoàn</option>
                    <option value="FIFO">Nhập trước xuất trước (FIFO)</option>
                    <option value="SPECIFIC">Đích danh</option>
                  </select>
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Chạy tính giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Create Policy */}
      {modalType === "create_policy" && (
        <div className="live-inv-modal-backdrop">
          <div className="live-inv-modal">
            <div className="live-inv-modal-header">
              <span>Thêm mới chính sách kho</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePolicy}>
              <div className="live-inv-modal-body">
                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Kho áp dụng:</label>
                    <select
                      className="live-inv-select"
                      value={formData.warehouse}
                      onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
                      required
                    >
                      {refs.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} - {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-inv-form-group">
                    <label>Mặt hàng:</label>
                    <select
                      className="live-inv-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                      required
                    >
                      {refs.items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.code} - {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-inv-form-row">
                  <div className="live-inv-form-group">
                    <label>Phương pháp tính giá vốn:</label>
                    <select
                      className="live-inv-select"
                      value={formData.valuation_method}
                      onChange={(e) => setFormData({ ...formData, valuation_method: e.target.value })}
                    >
                      <option value="MOVING_AVERAGE">Bình quân liên hoàn</option>
                      <option value="FIFO">Nhập trước xuất trước (FIFO)</option>
                      <option value="SPECIFIC">Đích danh</option>
                    </select>
                  </div>
                  <div className="live-inv-form-group">
                    <label>Cho phép xuất âm:</label>
                    <select
                      className="live-inv-select"
                      value={formData.allow_negative ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, allow_negative: e.target.value === "true" })}
                    >
                      <option value="false">Không</option>
                      <option value="true">Cho phép</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="live-inv-modal-footer">
                <button
                  type="button"
                  className="live-inv-btn live-inv-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-inv-btn live-inv-btn-primary">
                  Lưu chính sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
