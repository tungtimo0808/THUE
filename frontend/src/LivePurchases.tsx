import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-purchases.css";

interface ReferenceData {
  branches: Array<{ id: string; name: string; code: string }>;
  departments: Array<{ id: string; name: string; code: string }>;
  employees: Array<{ id: string; full_name: string; employee_code: string }>;
  suppliers: Array<{ id: string; name: string; code: string }>;
  items: Array<{ id: string; name: string; code: string; item_type?: string; base_uom?: string }>;
  warehouses: Array<{ id: string; name: string; code: string }>;
  uoms: Array<{ id: string; name: string; code: string }>;
  taxRates: Array<{ id: string; name: string; code: string; rate_percent: string }>;
  paymentTerms: Array<{ id: string; name: string; code: string }>;
  accounts: Array<{ id: string; name: string; code: string }>;
  currencies: Array<{ id: string; name: string; code: string }>;
}

export default function LivePurchases() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("requests");
  const [loading, setLoading] = useState<boolean>(false);
  const [refsLoaded, setRefsLoaded] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Reference options
  const [refs, setRefs] = useState<ReferenceData>({
    branches: [],
    departments: [],
    employees: [],
    suppliers: [],
    items: [],
    warehouses: [],
    uoms: [],
    taxRates: [],
    paymentTerms: [],
    accounts: [],
    currencies: [],
  });

  // Data collections
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [goods, setGoods] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [trackingItems, setTrackingItems] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionComment, setActionComment] = useState<string>("");

  // Form states for creation
  const [formData, setFormData] = useState<any>({});

  let sessionCtx: any = null;
  try {
    sessionCtx = useApiSession();
  } catch {}

  const token = sessionCtx?.token || session?.token || session?.access_token || "";
  const companyId = sessionCtx?.companyId || session?.companyId || session?.company?.id || "";

  // Initialize session fallback from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("erp_api_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        setSession(parsed);
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

  // Fetch References
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [bRes, dRes, eRes, pRes, iRes, wRes, uRes, tRes, ptRes, aRes, curRes] = await Promise.all([
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/departments/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/employees/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/items/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/warehouses/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/units-of-measure/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/tax-rates/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/payment-terms/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
      ]);

      const [b, d, e, p, i, w, u, t, pt, a, cur] = await Promise.all([
        bRes.ok ? bRes.json() : [],
        dRes.ok ? dRes.json() : [],
        eRes.ok ? eRes.json() : [],
        pRes.ok ? pRes.json() : [],
        iRes.ok ? iRes.json() : [],
        wRes.ok ? wRes.json() : [],
        uRes.ok ? uRes.json() : [],
        tRes.ok ? tRes.json() : [],
        ptRes.ok ? ptRes.json() : [],
        aRes.ok ? aRes.json() : [],
        curRes.ok ? curRes.json() : [],
      ]);

      console.log("REFS LOADED:", {
        branches: b?.length,
        departments: d?.length,
        employees: e?.length,
        items: i?.length,
        uoms: u?.length,
      });
      setRefs({
        branches: Array.isArray(b) ? b : b.results || [],
        departments: Array.isArray(d) ? d : d.results || [],
        employees: Array.isArray(e) ? e : e.results || [],
        suppliers: Array.isArray(p) ? p : p.results || [],
        items: Array.isArray(i) ? i : i.results || [],
        warehouses: Array.isArray(w) ? w : w.results || [],
        uoms: Array.isArray(u) ? u : u.results || [],
        taxRates: Array.isArray(t) ? t : t.results || [],
        paymentTerms: Array.isArray(pt) ? pt : pt.results || [],
        accounts: Array.isArray(a) ? a : a.results || [],
        currencies: Array.isArray(cur) ? cur : cur?.results || [],
      });
      setRefsLoaded(true);
    } catch (err) {
      console.error("Error loading references", err);
    }
  }, [companyId, getHeaders]);

  // Load Active Tab Data
  const loadTabData = useCallback(async (tab = activeTab) => {
    if (!companyId) return;
    setLoading(true);
    const h = getHeaders();

    try {
      if (tab === "requests") {
        const res = await fetch(`/api/v1/purchases/purchase-requests/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setRequests(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "orders") {
        const res = await fetch(`/api/v1/purchases/purchase-orders/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setOrders(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "goods") {
        const [gRes, sRes] = await Promise.all([
          fetch(`/api/v1/purchases/goods-purchases/?company_id=${companyId}`, { headers: h }),
          fetch(`/api/v1/purchases/service-purchases/?company_id=${companyId}`, { headers: h }),
        ]);
        if (gRes.ok) {
          const gd = await gRes.json();
          setGoods(Array.isArray(gd) ? gd : gd.results || []);
        }
        if (sRes.ok) {
          const sd = await sRes.json();
          setServices(Array.isArray(sd) ? sd : sd.results || []);
        }
      } else if (tab === "returns") {
        const [rRes, dRes] = await Promise.all([
          fetch(`/api/v1/purchases/purchase-returns/?company_id=${companyId}`, { headers: h }),
          fetch(`/api/v1/purchases/purchase-discounts/?company_id=${companyId}`, { headers: h }),
        ]);
        if (rRes.ok) {
          const rd = await rRes.json();
          setReturns(Array.isArray(rd) ? rd : rd.results || []);
        }
        if (dRes.ok) {
          const dd = await dRes.json();
          setDiscounts(Array.isArray(dd) ? dd : dd.results || []);
        }
      } else if (tab === "invoices") {
        const [iRes, recRes] = await Promise.all([
          fetch(`/api/v1/purchases/input-invoices/?company_id=${companyId}`, { headers: h }),
          fetch(`/api/v1/purchases/reconciliations/?company_id=${companyId}`, { headers: h }),
        ]);
        if (iRes.ok) {
          const idata = await iRes.json();
          setInvoices(Array.isArray(idata) ? idata : idata.results || []);
        }
        if (recRes.ok) {
          const recData = await recRes.json();
          setReconciliations(Array.isArray(recData) ? recData : recData.results || []);
        }
      } else if (tab === "approvals") {
        const res = await fetch(`/api/v1/purchases/approvals/pending/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPendingApprovals(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "tracking") {
        const res = await fetch(`/api/v1/purchases/tracking/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setTrackingItems(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "costs") {
        const res = await fetch(`/api/v1/purchases/purchase-costs/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setCosts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "contracts") {
        const res = await fetch(`/api/v1/purchases/purchase-contracts/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setContracts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (tab === "risk") {
        const res = await fetch(`/api/v1/purchases/supplier-risk/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setRisks(Array.isArray(d) ? d : d.results || []);
        }
      }
    } catch (err: any) {
      setNotice({ type: "error", text: `Lỗi tải dữ liệu: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, [companyId, activeTab, getHeaders]);

  useEffect(() => {
    if (companyId) {
      fetchRefs();
      loadTabData(activeTab);
    }
  }, [companyId, activeTab, fetchRefs, loadTabData]);

  // Generic document actions (submit, approve, post, unpost, cancel)
  const handleDocAction = async (endpoint: string, id: string, action: string, body: any = {}) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/purchases/${endpoint}/${id}/${action}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data));
      }
      setNotice({ type: "success", text: `Thao tác [${action}] thành công!` });
      loadTabData();
    } catch (err: any) {
      setNotice({ type: "error", text: `Thất bại: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Approval decision action (UC-PUR-09)
  const handleApprovalDecide = async (item: any, decision: "APPROVE" | "REJECT") => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/purchases/approvals/decide/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          company_id: companyId,
          document_type: item.document_type,
          document_id: item.document_id,
          action: decision,
          comment: actionComment || (decision === "APPROVE" ? "Đồng ý phê duyệt" : "Từ chối phê duyệt"),
          version: item.version || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : JSON.stringify(data));
      }
      setNotice({ type: "success", text: `Đã ${decision === "APPROVE" ? "phê duyệt" : "từ chối"} chứng từ!` });
      setModalType(null);
      setActionComment("");
      loadTabData("approvals");
    } catch (err: any) {
      setNotice({ type: "error", text: `Xử lý phê duyệt thất bại: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Supplier Risk check (UC-PUR-14)
  const handleRiskCheck = async (supplierId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/purchases/supplier-risk/check/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ supplier_id: supplierId, notes: "Kiểm tra rủi ro tự động" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setNotice({ type: "success", text: "Đã cập nhật đánh giá rủi ro nhà cung cấp!" });
      loadTabData("risk");
    } catch (err: any) {
      setNotice({ type: "error", text: `Kiểm tra rủi ro thất bại: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Supplier Risk override (UC-PUR-14)
  const handleRiskOverride = async (supplierId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/purchases/supplier-risk/override/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          supplier_id: supplierId,
          reason: "Được ban giám đốc phê duyệt giao dịch đặc cách.",
          document_type: "PURCHASE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setNotice({ type: "success", text: "Đã mở khóa giao dịch (override rủi ro) thành công!" });
      loadTabData("risk");
    } catch (err: any) {
      setNotice({ type: "error", text: `Override thất bại: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Creation Handler
  const handleCreateDocument = async (endpoint: string, payload: any) => {
    try {
      setLoading(true);
      console.log("PAYLOAD FOR", endpoint, JSON.stringify(payload));
      const res = await fetch(`/api/v1/purchases/${endpoint}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      setNotice({ type: "success", text: "Tạo mới chứng từ thành công!" });
      setModalType(null);
      setFormData({});
      loadTabData();
    } catch (err: any) {
      setNotice({ type: "error", text: `Lỗi tạo chứng từ: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="live-purchases-root">
      {/* Top Header */}
      <header className="live-pur-header">
        <div className="live-pur-title-box">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: 13, color: "#8b949e", cursor: "pointer" }}>← Quay lại</span>
          </Link>
          <div className="live-pur-title">
            <span>Phân hệ Mua hàng (Purchases)</span>
            <span className="live-pur-badge">Live API</span>
          </div>
        </div>

        <div className="live-pur-company-info">
          <span>Doanh nghiệp:</span>
          <span className="live-pur-company-tag">{session?.company?.name || "Chưa chọn"}</span>
          <span>Phạm vi: {session?.branch?.name || "Toàn công ty"}</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="live-pur-nav">
        <button
          className={`live-pur-nav-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
          id="tab-pur-requests"
        >
          <span className="live-pur-nav-tag">PUR-01</span> Yêu cầu mua
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
          id="tab-pur-orders"
        >
          <span className="live-pur-nav-tag">PUR-02</span> Đơn mua hàng
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "goods" ? "active" : ""}`}
          onClick={() => setActiveTab("goods")}
          id="tab-pur-goods"
        >
          <span className="live-pur-nav-tag">PUR-03 & 04</span> Mua hàng & Dịch vụ
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "returns" ? "active" : ""}`}
          onClick={() => setActiveTab("returns")}
          id="tab-pur-returns"
        >
          <span className="live-pur-nav-tag">PUR-05 & 06</span> Trả lại & Giảm giá
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "invoices" ? "active" : ""}`}
          onClick={() => setActiveTab("invoices")}
          id="tab-pur-invoices"
        >
          <span className="live-pur-nav-tag">PUR-07 & 08</span> Hóa đơn & Đối chiếu
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
          id="tab-pur-approvals"
        >
          <span className="live-pur-nav-tag">PUR-09</span> Phê duyệt chứng từ
          {pendingApprovals.length > 0 && (
            <span style={{ background: "#d29922", color: "#000", padding: "1px 5px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "tracking" ? "active" : ""}`}
          onClick={() => setActiveTab("tracking")}
          id="tab-pur-tracking"
        >
          <span className="live-pur-nav-tag">PUR-10</span> Theo dõi đơn mua
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "costs" ? "active" : ""}`}
          onClick={() => setActiveTab("costs")}
          id="tab-pur-costs"
        >
          <span className="live-pur-nav-tag">PUR-11 & 12</span> Chi phí mua hàng
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "contracts" ? "active" : ""}`}
          onClick={() => setActiveTab("contracts")}
          id="tab-pur-contracts"
        >
          <span className="live-pur-nav-tag">PUR-13</span> Hợp đồng mua hàng
        </button>
        <button
          className={`live-pur-nav-btn ${activeTab === "risk" ? "active" : ""}`}
          onClick={() => setActiveTab("risk")}
          id="tab-pur-risk"
        >
          <span className="live-pur-nav-tag">PUR-14</span> Rủi ro NCC
        </button>
      </nav>

      {/* Main Container */}
      <main className="live-pur-body">
        {notice && (
          <div className={`live-pur-notice ${notice.type}`}>
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: UC-PUR-01 – Yêu cầu mua hàng                      */}
        {/* ======================================================== */}
        {activeTab === "requests" && (
          <div>
            <div className="live-pur-toolbar">
              <div className="live-pur-search-wrap">
                <input
                  type="text"
                  placeholder="Tìm theo số yêu cầu, mục đích, phòng ban..."
                  className="live-pur-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-request"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      department: refs.departments[0]?.id || "",
                      requester: refs.employees[0]?.id || "",
                      document_date: new Date().toISOString().split("T")[0],
                      required_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                      purpose: "Mua sắm thiết bị văn phòng định kỳ",
                      receiving_location: "Kho văn phòng",
                      notes: "Đề xuất ưu tiên duyệt sớm",
                      item: refs.items[0]?.id || "",
                      uom: refs.uoms[0]?.id || "",
                      quantity: 10,
                      estimated_unit_price: 50000,
                    });
                    setModalType("create_request");
                  }}
                >
                  + Lập yêu cầu mua
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("requests")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Yêu cầu mua hàng (UC-PUR-01)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {requests.length} yêu cầu</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số yêu cầu</th>
                      <th>Ngày lập</th>
                      <th>Ngày cần</th>
                      <th>Mục đích</th>
                      <th>Tổng tiền dự kiến</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có yêu cầu mua hàng nào. Nhấn "+ Lập yêu cầu mua" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{r.number}</td>
                          <td>{r.document_date}</td>
                          <td>{r.required_date}</td>
                          <td>{r.purpose || "—"}</td>
                          <td>{Number(r.total_estimated_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(r.status || "").toLowerCase()}`}>{r.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {r.status === "DRAFT" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-accent"
                                  onClick={() => handleDocAction("purchase-requests", r.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {r.status !== "CANCELLED" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-danger"
                                  onClick={() => handleDocAction("purchase-requests", r.id, "cancel", { reason: "Người dùng hủy" })}
                                >
                                  Hủy
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: UC-PUR-02 – Quản lý đơn mua hàng                   */}
        {/* ======================================================== */}
        {activeTab === "orders" && (
          <div>
            <div className="live-pur-toolbar">
              <div className="live-pur-search-wrap">
                <input
                  type="text"
                  placeholder="Tìm theo số đơn mua, nhà cung cấp..."
                  className="live-pur-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-order"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      supplier: refs.suppliers[0]?.id || "",
                      document_date: new Date().toISOString().split("T")[0],
                      delivery_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                      receiving_warehouse: refs.warehouses[0]?.id || "",
                      item: refs.items[0]?.id || "",
                      uom: refs.uoms[0]?.id || "",
                      quantity: 5,
                      unit_price: 45000,
                      notes: "Đơn mua hàng thường niên",
                    });
                    setModalType("create_order");
                  }}
                >
                  + Lập đơn mua hàng
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("orders")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Đơn mua hàng (UC-PUR-02)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {orders.length} đơn</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số đơn mua</th>
                      <th>Ngày đặt</th>
                      <th>Ngày giao</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Tiến độ nhận</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có đơn mua nào. Nhấn "+ Lập đơn mua hàng" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{o.number}</td>
                          <td>{o.document_date}</td>
                          <td>{o.delivery_date || "—"}</td>
                          <td>{o.supplier_name || o.supplier?.name || "Nhà cung cấp"}</td>
                          <td>{Number(o.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(o.status || "").toLowerCase()}`}>{o.status}</span>
                          </td>
                          <td>
                            <span className="tracking-badge partial">{o.receiving_status || "Chưa nhận"}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {o.status === "DRAFT" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-accent"
                                  onClick={() => handleDocAction("purchase-orders", o.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {o.status !== "CANCELLED" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-danger"
                                  onClick={() => handleDocAction("purchase-orders", o.id, "cancel", { reason: "Hủy đơn mua" })}
                                >
                                  Hủy
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: UC-PUR-03 & 04 – Mua hàng hóa & Mua dịch vụ        */}
        {/* ======================================================== */}
        {activeTab === "goods" && (
          <div>
            <div className="live-pur-toolbar">
              <div className="live-pur-search-wrap">
                <input
                  type="text"
                  placeholder="Tìm theo số chứng từ mua hàng, mua dịch vụ..."
                  className="live-pur-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-goods"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const debitAcc = refs.accounts.find((a) => a.code.startsWith("156"))?.id || refs.accounts[0]?.id || "";
                    const creditAcc = refs.accounts.find((a) => a.code.startsWith("331"))?.id || refs.accounts[0]?.id || "";
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      supplier: refs.suppliers[0]?.id || "",
                      purchase_type: "WAREHOUSE",
                      receiving_warehouse: refs.warehouses[0]?.id || "",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      payment_type: "UNPAID",
                      item: refs.items[0]?.id || "",
                      uom: refs.uoms[0]?.id || "",
                      quantity: 2,
                      unit_price: 100000,
                      debit_account: debitAcc,
                      credit_account: creditAcc,
                    });
                    setModalType("create_goods");
                  }}
                >
                  + Mua hàng hóa (PUR-03)
                </button>
                <button
                  className="live-pur-btn live-pur-btn-accent"
                  id="btn-create-service"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const debitAcc = refs.accounts.find((a) => a.code.startsWith("642") || a.code.startsWith("641"))?.id || refs.accounts[0]?.id || "";
                    const creditAcc = refs.accounts.find((a) => a.code.startsWith("331"))?.id || refs.accounts[0]?.id || "";
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      supplier: refs.suppliers[0]?.id || "",
                      purchase_type: "SERVICE",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      payment_type: "UNPAID",
                      item: refs.items.find((i) => i.item_type === "SERVICE")?.id || refs.items[0]?.id || "",
                      uom: refs.uoms[0]?.id || "",
                      quantity: 1,
                      unit_price: 200000,
                      debit_account: debitAcc,
                      credit_account: creditAcc,
                    });
                    setModalType("create_service");
                  }}
                >
                  + Mua dịch vụ (PUR-04)
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("goods")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Chứng từ Mua hàng & Dịch vụ</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>
                  Hàng hóa: {goods.length} | Dịch vụ: {services.length}
                </span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Loại</th>
                      <th>Ngày hạch toán</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...goods.map((g) => ({ ...g, _kind: "goods" })), ...services.map((s) => ({ ...s, _kind: "service" }))].length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ mua hàng/dịch vụ nào.
                        </td>
                      </tr>
                    ) : (
                      [...goods.map((g) => ({ ...g, _kind: "goods" })), ...services.map((s) => ({ ...s, _kind: "service" }))].map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{item.number}</td>
                          <td>
                            <span className="live-pur-nav-tag">{item._kind === "goods" ? "Hàng hóa" : "Dịch vụ"}</span>
                          </td>
                          <td>{item.posting_date || item.document_date}</td>
                          <td>{item.supplier_name || item.supplier?.name || "Nhà cung cấp"}</td>
                          <td>{Number(item.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(item.status || "").toLowerCase()}`}>{item.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {item.status === "DRAFT" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-accent"
                                  onClick={() => handleDocAction(item._kind === "goods" ? "goods-purchases" : "service-purchases", item.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {item.status === "APPROVED" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-primary"
                                  onClick={() => handleDocAction(item._kind === "goods" ? "goods-purchases" : "service-purchases", item.id, "post", { version: item.version })}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {item.status === "POSTED" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-danger"
                                  onClick={() => handleDocAction(item._kind === "goods" ? "goods-purchases" : "service-purchases", item.id, "unpost", { version: item.version, reason: "Bỏ ghi sổ điều chỉnh" })}
                                >
                                  Bỏ ghi sổ
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: UC-PUR-05 & 06 – Hàng trả lại & Giảm giá           */}
        {/* ======================================================== */}
        {activeTab === "returns" && (
          <div>
            <div className="live-pur-toolbar">
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#8b949e", alignSelf: "center" }}>
                  Trả lại (PUR-05): {returns.length} | Giảm giá (PUR-06): {discounts.length}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="live-pur-btn" onClick={() => loadTabData("returns")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card" style={{ marginBottom: 20 }}>
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Hàng mua trả lại (UC-PUR-05)</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Chứng từ gốc</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng giá trị trả</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 16 }}>
                          Chưa có chứng từ hàng mua trả lại nào.
                        </td>
                      </tr>
                    ) : (
                      returns.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{r.number}</td>
                          <td>{r.document_date}</td>
                          <td>{r.original_purchase?.number || "—"}</td>
                          <td>{r.supplier?.name || "—"}</td>
                          <td>{Number(r.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(r.status || "").toLowerCase()}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Giảm giá hàng mua (UC-PUR-06)</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Chứng từ gốc</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng tiền giảm</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 16 }}>
                          Chưa có chứng từ giảm giá hàng mua nào.
                        </td>
                      </tr>
                    ) : (
                      discounts.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{d.number}</td>
                          <td>{d.document_date}</td>
                          <td>{d.original_purchase?.number || "—"}</td>
                          <td>{d.supplier?.name || "—"}</td>
                          <td>{Number(d.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(d.status || "").toLowerCase()}`}>{d.status}</span>
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

        {/* ======================================================== */}
        {/* TAB 5: UC-PUR-07 & 08 – Hóa đơn & Đối chiếu               */}
        {/* ======================================================== */}
        {activeTab === "invoices" && (
          <div>
            <div className="live-pur-toolbar">
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-invoice"
                  onClick={() => {
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      supplier: refs.suppliers[0]?.id || "",
                      invoice_number: `HD-IN-${Date.now().toString().slice(-4)}`,
                      invoice_series: "1C26TBB",
                      invoice_date: new Date().toISOString().split("T")[0],
                      total_amount: 110000,
                      pre_tax_amount: 100000,
                      vat_amount: 10000,
                      lines: [
                        {
                          line_no: 1,
                          item_name: "Thiết bị văn phòng phẩm",
                          quantity: 1,
                          unit_price: 100000,
                          pre_tax_amount: 100000,
                          vat_amount: 10000,
                        },
                      ],
                    });
                    setModalType("create_invoice");
                  }}
                >
                  + Tiếp nhận hóa đơn thủ công (PUR-07)
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("invoices")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card" style={{ marginBottom: 20 }}>
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Hóa đơn đầu vào tiếp nhận (UC-PUR-07)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {invoices.length}</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số hóa đơn</th>
                      <th>Ký hiệu</th>
                      <th>Ngày hóa đơn</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng thanh toán</th>
                      <th>Trạng thái hợp lệ</th>
                      <th>Trạng thái khớp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 16 }}>
                          Chưa có hóa đơn đầu vào nào. Nhấn "+ Tiếp nhận hóa đơn thủ công" để tạo.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{inv.invoice_number}</td>
                          <td>{inv.invoice_series || "—"}</td>
                          <td>{inv.invoice_date}</td>
                          <td>{inv.supplier_name || inv.supplier?.name || "—"}</td>
                          <td>{Number(inv.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className="status-pill approved">{inv.validation_status || "VALID"}</span>
                          </td>
                          <td>
                            <span className={`status-pill ${inv.match_status === "MATCHED" ? "matched" : "variance"}`}>
                              {inv.match_status || "UNMATCHED"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Đối chiếu chứng từ mua hàng (UC-PUR-08)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {reconciliations.length}</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Mã đối chiếu</th>
                      <th>Phương thức</th>
                      <th>Hóa đơn</th>
                      <th>Đơn mua / Chứng từ</th>
                      <th>Trạng thái</th>
                      <th>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 16 }}>
                          Chưa có dữ liệu đối chiếu nào.
                        </td>
                      </tr>
                    ) : (
                      reconciliations.map((rc) => (
                        <tr key={rc.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{rc.reconciliation_no || rc.id.slice(0, 8)}</td>
                          <td>{rc.matching_method}</td>
                          <td>{rc.invoice?.number || rc.invoice_number || "—"}</td>
                          <td>{rc.purchase_order?.number || rc.goods_purchase?.number || "—"}</td>
                          <td>
                            <span className={`status-pill ${String(rc.status || "").toLowerCase()}`}>{rc.status}</span>
                          </td>
                          <td>{Number(rc.variance_amount || 0).toLocaleString("vi-VN")} đ</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: UC-PUR-09 – Phê duyệt chứng từ mua hàng            */}
        {/* ======================================================== */}
        {activeTab === "approvals" && (
          <div>
            <div className="live-pur-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Hàng chờ phê duyệt chứng từ mua hàng (PUR-09). Hỗ trợ xét duyệt đa cấp, kiểm tra phân quyền & hạn mức.
              </span>
              <button className="live-pur-btn" onClick={() => loadTabData("approvals")}>
                Làm mới
              </button>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Chứng từ chờ phê duyệt</span>
                <span style={{ fontSize: 12, color: "#d29922", fontWeight: 700 }}>
                  {pendingApprovals.length} chứng từ cần xử lý
                </span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Loại chứng từ</th>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Người lập</th>
                      <th>Tổng tiền</th>
                      <th>Cấp duyệt</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 32 }}>
                          Hiện không có chứng từ nào chờ phê duyệt cho tài khoản của bạn.
                        </td>
                      </tr>
                    ) : (
                      pendingApprovals.map((p, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className="live-pur-nav-tag">{p.document_type_name || p.document_type}</span>
                          </td>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{p.number || p.document_id?.slice(0, 8)}</td>
                          <td>{p.document_date || "—"}</td>
                          <td>{p.creator_name || "—"}</td>
                          <td>{Number(p.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            Cấp {p.current_level} / {p.total_levels}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="live-pur-btn live-pur-btn-sm live-pur-btn-primary btn-decide-approve"
                                onClick={() => {
                                  setSelectedItem(p);
                                  handleApprovalDecide(p, "APPROVE");
                                }}
                              >
                                Duyệt
                              </button>
                              <button
                                className="live-pur-btn live-pur-btn-sm live-pur-btn-danger"
                                onClick={() => {
                                  setSelectedItem(p);
                                  setModalType("reject_modal");
                                }}
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

        {/* ======================================================== */}
        {/* TAB 7: UC-PUR-10 – Theo dõi thực hiện đơn mua             */}
        {/* ======================================================== */}
        {activeTab === "tracking" && (
          <div>
            <div className="live-pur-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Bảng tổng hợp tiến độ thực hiện đơn mua hàng (UC-PUR-10) theo thời gian thực.
              </span>
              <button className="live-pur-btn" onClick={() => loadTabData("tracking")}>
                Làm mới
              </button>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Ma trận Theo dõi Đơn mua (Fulfillment Tracking)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {trackingItems.length} đơn</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số đơn mua</th>
                      <th>Ngày đặt</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng giá trị</th>
                      <th>Tiến độ nhận hàng</th>
                      <th>Tiến độ hóa đơn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có đơn mua nào cần theo dõi thực hiện.
                        </td>
                      </tr>
                    ) : (
                      trackingItems.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{item.order_number || item.number}</td>
                          <td>{item.document_date || "—"}</td>
                          <td>{item.supplier_name || "—"}</td>
                          <td>{Number(item.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="tracking-badge partial">{item.receiving_status || "Chưa nhận"}</span>
                              <span>{item.received_percent || 0}%</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span className="tracking-badge partial">{item.invoicing_status || "Chưa xuất HĐ"}</span>
                              <span>{item.invoiced_percent || 0}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${String(item.status || "").toLowerCase()}`}>{item.status}</span>
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

        {/* ======================================================== */}
        {/* TAB 8: UC-PUR-11 & 12 – Chi phí mua hàng & Phân bổ        */}
        {/* ======================================================== */}
        {activeTab === "costs" && (
          <div>
            <div className="live-pur-toolbar">
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-cost"
                  onClick={() => {
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      supplier: refs.suppliers[0]?.id || "",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      allocation_method: "VALUE",
                      notes: "Chi phí vận chuyển bốc dỡ hàng nhập",
                      lines: [
                        {
                          line_no: 1,
                          cost_type: "FREIGHT",
                          amount: 50000,
                          description: "Cước vận tải đường bộ",
                        },
                      ],
                    });
                    setModalType("create_cost");
                  }}
                >
                  + Ghi nhận chi phí mua hàng
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("costs")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chi phí Mua hàng & Phân bổ (UC-PUR-11, 12)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {costs.length} chứng từ</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày hạch toán</th>
                      <th>Nhà cung cấp vận tải/dịch vụ</th>
                      <th>Tổng chi phí</th>
                      <th>Phương thức phân bổ</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chi phí mua hàng nào. Nhấn "+ Ghi nhận chi phí mua hàng" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      costs.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{c.number}</td>
                          <td>{c.posting_date || c.document_date}</td>
                          <td>{c.supplier_name || c.supplier?.name || "—"}</td>
                          <td>{Number(c.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{c.allocation_method === "VALUE" ? "Theo giá trị" : "Theo số lượng"}</td>
                          <td>
                            <span className={`status-pill ${String(c.status || "").toLowerCase()}`}>{c.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {c.status === "DRAFT" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-accent"
                                  onClick={() => handleDocAction("purchase-costs", c.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {c.status === "APPROVED" && (
                                <button
                                  className="live-pur-btn live-pur-btn-sm live-pur-btn-primary"
                                  onClick={() => handleDocAction("purchase-costs", c.id, "post")}
                                >
                                  Ghi sổ
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: UC-PUR-13 – Quản lý hợp đồng mua hàng              */}
        {/* ======================================================== */}
        {activeTab === "contracts" && (
          <div>
            <div className="live-pur-toolbar">
              <div className="live-pur-search-wrap">
                <input
                  type="text"
                  placeholder="Tìm theo số hợp đồng, tiêu đề, nhà cung cấp..."
                  className="live-pur-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-pur-btn live-pur-btn-primary"
                  id="btn-create-contract"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      branch: refs.branches[0]?.id || "",
                      department: refs.departments[0]?.id || "",
                      title: "Hợp đồng cung cấp vật tư Q4/2026",
                      supplier: refs.suppliers[0]?.id || "",
                      signed_date: new Date().toISOString().split("T")[0],
                      start_date: new Date().toISOString().split("T")[0],
                      end_date: new Date(Date.now() + 86400000 * 90).toISOString().split("T")[0],
                      exchange_rate: "1",
                      payment_term: refs.paymentTerms[0]?.id || "",
                      lines: [
                        {
                          item: refs.items[0]?.id || "",
                          uom: refs.uoms[0]?.id || "",
                          quantity: "20.0000",
                          unit_price: "45000.0000",
                          tax_rate: refs.taxRates[0]?.id || "",
                          expected_delivery_date: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
                          description: "Vật tư mua sắm tiêu chuẩn",
                        },
                      ],
                    });
                    setModalType("create_contract");
                  }}
                >
                  + Lập hợp đồng mua hàng
                </button>
                <button className="live-pur-btn" onClick={() => loadTabData("contracts")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-pur-card">
              <div className="live-pur-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hợp đồng mua hàng (UC-PUR-13)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {contracts.length} hợp đồng</span>
              </div>
              <div className="live-pur-table-wrapper">
                <table className="live-pur-table">
                  <thead>
                    <tr>
                      <th>Số hợp đồng</th>
                      <th>Tiêu đề</th>
                      <th>Nhà cung cấp</th>
                      <th>Ngày ký</th>
                      <th>Thời hạn</th>
                      <th>Giá trị hợp đồng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có hợp đồng mua hàng nào. Nhấn "+ Lập hợp đồng mua hàng" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      contracts.map((ct) => (
                        <tr key={ct.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{ct.number}</td>
                          <td>{ct.title}</td>
                          <td>{ct.supplier_name || "—"}</td>
                          <td>{ct.signed_date}</td>
                          <td>
                            {ct.start_date} ~ {ct.end_date}
                          </td>
                          <td>{Number(ct.total_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className={`status-pill ${String(ct.status || "").toLowerCase()}`}>{ct.status_display || ct.status}</span>
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

        {/* ======================================================== */}
        {/* TAB 10: UC-PUR-14 – Kiểm tra rủi ro nhà cung cấp          */}
        {/* ======================================================== */}
        {activeTab === "risk" && (
          <div>
            <div className="live-pur-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Đánh giá rủi ro pháp lý, thuế và lịch sử giao dịch của Nhà cung cấp (UC-PUR-14). Chặn tự động giao dịch rủi ro cao.
              </span>
              <button className="live-pur-btn" onClick={() => loadTabData("risk")}>
                Làm mới
              </button>
            </div>

            <div>
              {risks.length === 0 ? (
                <div className="live-pur-card" style={{ padding: 32, textAlign: "center", color: "#8b949e" }}>
                  Chưa có danh sách nhà cung cấp hoặc dữ liệu rủi ro.
                </div>
              ) : (
                risks.map((sup: any) => {
                  const sId = sup.supplier_id || sup.id;
                  const sName = sup.supplier_name || sup.name;
                  const sCode = sup.supplier_code || sup.code;
                  const rLevel = sup.latest_risk_level || sup.risk_level || "LOW";
                  const rScore = sup.latest_score ?? sup.risk_score ?? 10;
                  return (
                    <div
                      key={sId}
                      className={`risk-card ${
                        rLevel === "BLOCKED"
                          ? "risk-blocked"
                          : rLevel === "HIGH"
                          ? "risk-high"
                          : rLevel === "MEDIUM"
                          ? "risk-medium"
                          : "risk-low"
                      }`}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{sName}</span>
                          <span className="live-pur-nav-tag">{sCode}</span>
                          <span
                            className={`status-pill ${
                              rLevel === "LOW" ? "approved" : rLevel === "HIGH" ? "rejected" : "draft"
                            }`}
                          >
                            Mức rủi ro: {sup.latest_risk_level_display || rLevel}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>
                          Mã số thuế: {sup.tax_code || "Chưa có"} | Trạng thái: {sup.operating_status || sup.tax_status || "Bình thường"} | Điểm rủi ro: {rScore}/100
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="live-pur-btn live-pur-btn-sm live-pur-btn-accent"
                          onClick={() => handleRiskCheck(sId)}
                        >
                          Kiểm tra rủi ro
                        </button>
                        <button
                          className="live-pur-btn live-pur-btn-sm"
                          onClick={() => handleRiskOverride(sId)}
                        >
                          Mở khóa / Override
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: Lập Yêu cầu mua hàng (UC-PUR-01)                  */}
      {/* ======================================================== */}
      {modalType === "create_request" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal">
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Lập Yêu cầu mua hàng (UC-PUR-01)</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Chi nhánh</label>
                  <select
                    className="live-pur-select"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Phòng ban yêu cầu</label>
                  <select
                    className="live-pur-select"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    {refs.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Người đề xuất</label>
                  <select
                    className="live-pur-select"
                    value={formData.requester}
                    onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
                  >
                    {refs.employees.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.full_name} ({em.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Ngày lập chứng từ</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Ngày cần hàng</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.required_date}
                    onChange={(e) => setFormData({ ...formData, required_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="form-label">Mục đích mua sắm</label>
                <input
                  type="text"
                  className="live-pur-input"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#58a6ff" }}>Chi tiết hàng hóa yêu cầu:</span>
                <div className="form-grid-3" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label className="form-label">Hàng hóa/Vật tư</label>
                    <select
                      className="live-pur-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    >
                      {refs.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Đơn vị tính</label>
                    <select
                      className="live-pur-select"
                      value={formData.uom}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    >
                      {refs.uoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Số lượng</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Hủy bỏ
              </button>
              <button
                className="live-pur-btn live-pur-btn-primary"
                onClick={() => {
                  const reqItemId = formData.item || refs.items[0]?.id;
                  const reqItemObj = refs.items.find((i) => i.id === reqItemId);
                  const reqUom = reqItemObj?.base_uom || formData.uom || refs.uoms[0]?.id;
                  handleCreateDocument("purchase-requests", {
                    company: companyId,
                    branch: formData.branch || refs.branches[0]?.id,
                    department: formData.department || refs.departments[0]?.id,
                    requester: formData.requester || refs.employees[0]?.id,
                    document_date: formData.document_date || new Date().toISOString().split("T")[0],
                    required_date: formData.required_date || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                    purpose: formData.purpose || "Mua sắm thiết bị văn phòng định kỳ",
                    receiving_location: formData.receiving_location || "Kho văn phòng",
                    notes: formData.notes || "",
                    lines: [
                      {
                        line_no: 1,
                        item: reqItemId,
                        uom: reqUom,
                        quantity: String(formData.quantity || 10),
                        estimated_unit_price: String(formData.estimated_unit_price || 50000),
                        required_date: formData.required_date || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                        notes: "Hàng yêu cầu",
                      },
                    ],
                  });
                }}
              >
                Lưu yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Đơn mua hàng (UC-PUR-02)                       */}
      {/* ======================================================== */}
      {modalType === "create_order" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal">
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Lập Đơn mua hàng (UC-PUR-02)</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Chi nhánh</label>
                  <select
                    className="live-pur-select"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Nhà cung cấp</label>
                  <select
                    className="live-pur-select"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    {refs.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Kho nhận hàng</label>
                  <select
                    className="live-pur-select"
                    value={formData.receiving_warehouse}
                    onChange={(e) => setFormData({ ...formData, receiving_warehouse: e.target.value })}
                  >
                    {refs.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Ngày đơn hàng</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hạn giao hàng</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#58a6ff" }}>Hàng hóa đặt mua:</span>
                <div className="form-grid-3" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label className="form-label">Vật tư</label>
                    <select
                      className="live-pur-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    >
                      {refs.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Số lượng</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Đơn giá</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Hủy bỏ
              </button>
              <button
                className="live-pur-btn live-pur-btn-primary"
                onClick={() => {
                  const ordItemId = formData.item || refs.items[0]?.id;
                  const ordItemObj = refs.items.find((i) => i.id === ordItemId);
                  const ordUom = ordItemObj?.base_uom || formData.uom || refs.uoms[0]?.id;
                  handleCreateDocument("purchase-orders", {
                    company: companyId,
                    branch: formData.branch || refs.branches[0]?.id,
                    supplier: formData.supplier || refs.suppliers[0]?.id,
                    document_date: formData.document_date || new Date().toISOString().split("T")[0],
                    delivery_date: formData.delivery_date || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                    receiving_warehouse: formData.receiving_warehouse || refs.warehouses[0]?.id,
                    currency: formData.currency || refs.currencies[0]?.id || "ab59b5b1-8534-4408-99eb-c36914d42d1b",
                    exchange_rate: "1",
                    notes: formData.notes || "Đơn hàng thường niên",
                    lines: [
                      {
                        line_no: 1,
                        item: ordItemId,
                        uom: ordUom,
                        warehouse: formData.receiving_warehouse || refs.warehouses[0]?.id,
                        quantity: String(formData.quantity || 5),
                        unit_price: String(formData.unit_price || 45000),
                      },
                    ],
                  });
                }}
              >
                Lưu đơn mua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Mua hàng hóa (UC-PUR-03)                          */}
      {/* ======================================================== */}
      {modalType === "create_goods" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal">
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Ghi nhận Mua hàng hóa (UC-PUR-03)</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Chi nhánh</label>
                  <select
                    className="live-pur-select"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Nhà cung cấp</label>
                  <select
                    className="live-pur-select"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    {refs.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Kho nhận hàng</label>
                  <select
                    className="live-pur-select"
                    value={formData.receiving_warehouse}
                    onChange={(e) => setFormData({ ...formData, receiving_warehouse: e.target.value })}
                  >
                    {refs.warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Tài khoản Nợ (Kho 156)</label>
                  <select
                    className="live-pur-select"
                    value={formData.debit_account}
                    onChange={(e) => setFormData({ ...formData, debit_account: e.target.value })}
                  >
                    {refs.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Tài khoản Có (Phải trả 331)</label>
                  <select
                    className="live-pur-select"
                    value={formData.credit_account}
                    onChange={(e) => setFormData({ ...formData, credit_account: e.target.value })}
                  >
                    {refs.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#58a6ff" }}>Chi tiết hàng nhập kho:</span>
                <div className="form-grid-3" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label className="form-label">Vật tư</label>
                    <select
                      className="live-pur-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    >
                      {refs.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Số lượng</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Đơn giá</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Hủy bỏ
              </button>
              <button
                className="live-pur-btn live-pur-btn-primary"
                onClick={() => {
                  const debitAcc = refs.accounts.find((a) => a.code.startsWith("156"))?.id || refs.accounts[0]?.id || "";
                  const creditAcc = refs.accounts.find((a) => a.code.startsWith("331"))?.id || refs.accounts[0]?.id || "";
                  const gItem = refs.items.find((i) => i.item_type !== "SERVICE")?.id || refs.items[0]?.id || "";
                  const targetGoodsId = formData.item || gItem;
                  const targetGoodsObj = refs.items.find((i) => i.id === targetGoodsId);
                  const targetGoodsUom = targetGoodsObj?.base_uom || formData.uom || refs.uoms[0]?.id;
                  handleCreateDocument("goods-purchases", {
                    company: companyId,
                    branch: formData.branch || refs.branches[0]?.id,
                    supplier: formData.supplier || refs.suppliers[0]?.id,
                    document_date: formData.document_date || new Date().toISOString().split("T")[0],
                    posting_date: formData.posting_date || new Date().toISOString().split("T")[0],
                    purchase_type: "WAREHOUSE",
                    receiving_warehouse: formData.receiving_warehouse || refs.warehouses[0]?.id,
                    payment_type: "UNPAID",
                    lines: [
                      {
                        line_no: 1,
                        item: targetGoodsId,
                        uom: targetGoodsUom,
                        quantity: String(formData.quantity || 2),
                        unit_price: String(formData.unit_price || 100000),
                        discount_rate: "0",
                        debit_account: formData.debit_account || debitAcc,
                        credit_account: formData.credit_account || creditAcc,
                      },
                    ],
                  });
                }}
              >
                Lưu chứng từ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Mua dịch vụ (UC-PUR-04)                           */}
      {/* ======================================================== */}
      {modalType === "create_service" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal">
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Ghi nhận Mua dịch vụ (UC-PUR-04)</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Chi nhánh</label>
                  <select
                    className="live-pur-select"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Nhà cung cấp dịch vụ</label>
                  <select
                    className="live-pur-select"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    {refs.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Tài khoản Chi phí (Nợ 642/641)</label>
                  <select
                    className="live-pur-select"
                    value={formData.debit_account}
                    onChange={(e) => setFormData({ ...formData, debit_account: e.target.value })}
                  >
                    {refs.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Tài khoản Phải trả (Có 331)</label>
                  <select
                    className="live-pur-select"
                    value={formData.credit_account}
                    onChange={(e) => setFormData({ ...formData, credit_account: e.target.value })}
                  >
                    {refs.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 16, borderTop: "1px solid #30363d", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#58a6ff" }}>Chi tiết dịch vụ:</span>
                <div className="form-grid-3" style={{ marginTop: 10 }}>
                  <div className="form-field">
                    <label className="form-label">Khoản mục Dịch vụ</label>
                    <select
                      className="live-pur-select"
                      value={formData.item}
                      onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                    >
                      {(refs.items.filter((it) => it.item_type === "SERVICE").length > 0
                        ? refs.items.filter((it) => it.item_type === "SERVICE")
                        : refs.items
                      ).map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Số lượng</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Thành tiền</label>
                    <input
                      type="number"
                      className="live-pur-input"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Hủy bỏ
              </button>
              <button
                className="live-pur-btn live-pur-btn-primary"
                onClick={() => {
                  const debitAcc = refs.accounts.find((a) => a.code.startsWith("642") || a.code.startsWith("641"))?.id || refs.accounts[0]?.id || "";
                  const creditAcc = refs.accounts.find((a) => a.code.startsWith("331"))?.id || refs.accounts[0]?.id || "";
                  const sItem = refs.items.find((i) => i.item_type === "SERVICE")?.id || refs.items[0]?.id || "";
                  const targetItemId = formData.item || sItem;
                  const targetItemObj = refs.items.find((i) => i.id === targetItemId);
                  const targetUom = targetItemObj?.base_uom || formData.uom || refs.uoms[0]?.id;
                  handleCreateDocument("service-purchases", {
                    company: companyId,
                    branch: formData.branch || refs.branches[0]?.id,
                    supplier: formData.supplier || refs.suppliers[0]?.id,
                    document_date: formData.document_date || new Date().toISOString().split("T")[0],
                    posting_date: formData.posting_date || new Date().toISOString().split("T")[0],
                    purchase_type: "SERVICE",
                    payment_type: "UNPAID",
                    lines: [
                      {
                        line_no: 1,
                        item: targetItemId,
                        uom: targetUom,
                        quantity: String(formData.quantity || 1),
                        unit_price: String(formData.unit_price || 200000),
                        discount_rate: "0",
                        debit_account: formData.debit_account || debitAcc,
                        credit_account: formData.credit_account || creditAcc,
                      },
                    ],
                  });
                }}
              >
                Lưu chứng từ dịch vụ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Hợp đồng mua hàng (UC-PUR-13)                     */}
      {/* ======================================================== */}
      {modalType === "create_contract" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal">
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Lập Hợp đồng mua hàng (UC-PUR-13)</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-label">Tiêu đề hợp đồng</label>
                  <input
                    type="text"
                    className="live-pur-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Nhà cung cấp</label>
                  <select
                    className="live-pur-select"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  >
                    {refs.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-field">
                  <label className="form-label">Ngày ký</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.signed_date}
                    onChange={(e) => setFormData({ ...formData, signed_date: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Hiệu lực từ</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Đến ngày</label>
                  <input
                    type="date"
                    className="live-pur-input"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Hủy bỏ
              </button>
              <button
                className="live-pur-btn live-pur-btn-primary"
                onClick={() => {
                  handleCreateDocument("purchase-contracts", {
                    company: companyId,
                    branch: formData.branch || refs.branches[0]?.id,
                    department: formData.department || refs.departments[0]?.id,
                    title: formData.title || "Hợp đồng cung cấp vật tư Q4/2026",
                    supplier: formData.supplier || refs.suppliers[0]?.id,
                    signed_date: formData.signed_date || new Date().toISOString().split("T")[0],
                    start_date: formData.start_date || new Date().toISOString().split("T")[0],
                    end_date: formData.end_date || new Date(Date.now() + 86400000 * 90).toISOString().split("T")[0],
                    currency: formData.currency || refs.currencies[0]?.id || "ab59b5b1-8534-4408-99eb-c36914d42d1b",
                    exchange_rate: "1",
                    payment_term: formData.payment_term || refs.paymentTerms[0]?.id,
                    lines: formData.lines?.length
                      ? formData.lines
                      : [
                          {
                            item: refs.items[0]?.id,
                            uom: refs.uoms[0]?.id,
                            quantity: "20.0000",
                            unit_price: "45000.0000",
                            tax_rate: refs.taxRates[0]?.id,
                            expected_delivery_date: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
                            description: "Vật tư mua sắm tiêu chuẩn",
                          },
                        ],
                  });
                }}
              >
                Lưu hợp đồng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Reject comment modal                              */}
      {/* ======================================================== */}
      {modalType === "reject_modal" && (
        <div className="live-pur-modal-backdrop">
          <div className="live-pur-modal" style={{ maxWidth: 500 }}>
            <div className="live-pur-modal-header">
              <span className="live-pur-modal-title">Từ chối phê duyệt chứng từ</span>
              <button className="live-pur-btn live-pur-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-pur-modal-body">
              <label className="form-label">Nhập lý do từ chối:</label>
              <textarea
                className="live-pur-input"
                style={{ height: 100, marginTop: 8 }}
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder="Ví dụ: Thiếu báo giá so sánh hoặc đơn giá chưa phù hợp..."
              />
            </div>
            <div className="live-pur-modal-footer">
              <button className="live-pur-btn" onClick={() => setModalType(null)}>
                Đóng
              </button>
              <button
                className="live-pur-btn live-pur-btn-danger"
                onClick={() => handleApprovalDecide(selectedItem, "REJECT")}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
