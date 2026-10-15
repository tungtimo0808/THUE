import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-accounts-receivable.css";

type TabKey =
  | "documents"
  | "receivables"
  | "receipts"
  | "allocations"
  | "nettings"
  | "adjustments"
  | "reconciliations"
  | "due-debts"
  | "payment-reminders"
  | "credit-policies"
  | "reports";

interface ReferenceData {
  branches: any[];
  customers: any[];
  suppliers: any[];
  paymentTerms: any[];
  accounts: any[];
  currencies: any[];
  bankAccounts: any[];
  cashFunds: any[];
}

export default function LiveAccountsReceivable() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
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

  // References state
  const [refsLoaded, setRefsLoaded] = useState(false);
  const [refs, setRefs] = useState<ReferenceData>({
    branches: [],
    customers: [],
    suppliers: [],
    paymentTerms: [],
    accounts: [],
    currencies: [],
    bankAccounts: [],
    cashFunds: [],
  });

  // Tab Data States
  const [documents, setDocuments] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [receivableSummary, setReceivableSummary] = useState<any>(null);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [nettings, setNettings] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [dueReport, setDueReport] = useState<any>(null);
  const [paymentReminders, setPaymentReminders] = useState<any[]>([]);
  const [creditPolicies, setCreditPolicies] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any>(null);

  // Filters & Sub-states
  const [reportFromDate, setReportFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [reportToDate, setReportToDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [creditCheckResult, setCreditCheckResult] = useState<any>(null);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [actionReason, setActionReason] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Fetch references
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [bRes, pRes, ptRes, aRes, curRes, cfRes, baRes] = await Promise.all([
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/payment-terms/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/cash/funds/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/company-bank-accounts/?company_id=${companyId}`, { headers: h }),
      ]);

      const [b, p, pt, a, cur, cf, ba] = await Promise.all([
        bRes.ok ? bRes.json() : [],
        pRes.ok ? pRes.json() : [],
        ptRes.ok ? ptRes.json() : [],
        aRes.ok ? aRes.json() : [],
        curRes.ok ? curRes.json() : [],
        cfRes.ok ? cfRes.json() : [],
        baRes.ok ? baRes.json() : [],
      ]);

      const parties = Array.isArray(p) ? p : p.results || [];
      const customers = parties.filter((x: any) =>
        (x.roles && x.roles.some((r: any) => r.role_type === "CUSTOMER")) || x.party_type === "CUSTOMER"
      );
      const suppliers = parties.filter((x: any) =>
        (x.roles && x.roles.some((r: any) => r.role_type === "SUPPLIER")) || x.party_type === "SUPPLIER"
      );

      setRefs({
        branches: Array.isArray(b) ? b : b.results || [],
        customers: customers.length ? customers : parties,
        suppliers: suppliers.length ? suppliers : parties,
        paymentTerms: Array.isArray(pt) ? pt : pt.results || [],
        accounts: Array.isArray(a) ? a : a.results || [],
        currencies: Array.isArray(cur) ? cur : cur.results || [],
        cashFunds: Array.isArray(cf) ? cf : cf.results || [],
        bankAccounts: Array.isArray(ba) ? ba : ba.results || [],
      });
      setRefsLoaded(true);
    } catch (e) {
      console.error("Error loading AR references:", e);
    }
  }, [companyId, getHeaders]);

  // Load Active Tab Data
  const loadTabData = useCallback(
    async (tab = activeTab) => {
      if (!companyId) return;
      setLoading(true);
      const h = getHeaders();

      try {
        if (tab === "documents") {
          const res = await fetch(`/api/v1/accounts-receivable/documents/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setDocuments(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "receivables") {
          const [rRes, sRes] = await Promise.all([
            fetch(`/api/v1/accounts-receivable/receivables/?company_id=${companyId}`, { headers: h }),
            fetch(`/api/v1/accounts-receivable/receivables/summary/?company_id=${companyId}`, { headers: h }),
          ]);
          if (rRes.ok) {
            const data = await rRes.json();
            setReceivables(Array.isArray(data) ? data : data.results || []);
          }
          if (sRes.ok) {
            setReceivableSummary(await sRes.json());
          }
        } else if (tab === "receipts") {
          const res = await fetch(`/api/v1/accounts-receivable/customer-receipt-vouchers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setReceipts(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "allocations") {
          const res = await fetch(`/api/v1/accounts-receivable/allocation-vouchers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setAllocations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "nettings") {
          const res = await fetch(`/api/v1/accounts-receivable/debt-netting-vouchers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setNettings(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "adjustments") {
          const res = await fetch(`/api/v1/accounts-receivable/debt-adjustment-vouchers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setAdjustments(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "reconciliations") {
          const res = await fetch(`/api/v1/accounts-receivable/customer-debt-reconciliations/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setReconciliations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "due-debts") {
          const res = await fetch(`/api/v1/accounts-receivable/customer-due-debts/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setDueReport(data);
          }
        } else if (tab === "payment-reminders") {
          const res = await fetch(`/api/v1/accounts-receivable/customer-payment-reminders/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setPaymentReminders(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "credit-policies") {
          const res = await fetch(`/api/v1/accounts-receivable/credit-policies/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setCreditPolicies(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "reports") {
          const res = await fetch(
            `/api/v1/accounts-receivable/receivables/customer-debts/?company_id=${companyId}&from_date=${reportFromDate}&to_date=${reportToDate}`,
            { headers: h }
          );
          if (res.ok) {
            setReportData(await res.json());
          }
        }
      } catch (e: any) {
        setNotice({ type: "error", text: "Lỗi tải dữ liệu: " + e.message });
      } finally {
        setLoading(false);
      }
    },
    [companyId, activeTab, getHeaders, reportFromDate, reportToDate]
  );

  useEffect(() => {
    if (companyId) {
      fetchRefs();
      loadTabData(activeTab);
    }
  }, [companyId, activeTab, fetchRefs, loadTabData]);

  // Execute Action on item
  const handleItemAction = async (endpoint: string, id: string, action: string, payload: any = {}) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounts-receivable/${endpoint}/${id}/${action}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Thao tác thất bại");
      }
      setNotice({ type: "success", text: `Thực hiện ${action} thành công!` });
      setModalType(null);
      loadTabData(activeTab);
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Submit Create form
  const handleCreateSubmit = async (endpoint: string, data: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/accounts-receivable/${endpoint}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Tạo mới thất bại");
      }
      setNotice({ type: "success", text: "Tạo mới thành công!" });
      setModalType(null);
      setFormData({});
      loadTabData(activeTab);
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val: any) => {
    if (val === null || val === undefined) return "0";
    return Number(val).toLocaleString("vi-VN");
  };

  return (
    <div className="live-ar-root">
      {/* Top Header */}
      <header className="live-ar-header">
        <div className="live-ar-title-box">
          <Link to="/common" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            ← Dùng chung
          </Link>
          <div className="live-ar-title">
            <span>Phân hệ Quản lý Công nợ phải thu (Accounts Receivable)</span>
            <span className="live-ar-badge">UC-AR-01 → UC-AR-11</span>
          </div>
        </div>
        <div className="live-ar-company-info">
          <span>Doanh nghiệp:</span>
          <span className="live-ar-company-tag">{companyId ? `ID: ${companyId.slice(0, 8)}...` : "Chưa chọn"}</span>
          <Link to="/sales" className="live-ar-btn live-ar-btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }}>
            Bán hàng (SAL)
          </Link>
          <Link to="/accounts-payable" className="live-ar-btn live-ar-btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }}>
            Phải trả (AP)
          </Link>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="live-ar-nav">
        {[
          { key: "documents", label: "Chứng từ công nợ", tag: "AR-01" },
          { key: "receivables", label: "Theo dõi & Lịch thu", tag: "AR-02" },
          { key: "receipts", label: "Phiếu thu tiền KH", tag: "AR-03" },
          { key: "allocations", label: "Phân bổ thu nợ", tag: "AR-04" },
          { key: "nettings", label: "Bù trừ công nợ", tag: "AR-05" },
          { key: "adjustments", label: "Điều chỉnh công nợ", tag: "AR-06" },
          { key: "reconciliations", label: "Đối chiếu công nợ", tag: "AR-07" },
          { key: "due-debts", label: "Tuổi nợ & Đến hạn", tag: "AR-08" },
          { key: "payment-reminders", label: "Nhắc nợ KH", tag: "AR-09" },
          { key: "credit-policies", label: "Hạn mức tín dụng", tag: "AR-10" },
          { key: "reports", label: "Báo cáo công nợ", tag: "AR-11" },
        ].map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            className={`live-ar-nav-btn ${activeTab === t.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(t.key as TabKey);
              setNotice(null);
            }}
          >
            <span>{t.label}</span>
            <span className="live-ar-nav-tag">{t.tag}</span>
          </button>
        ))}
      </nav>

      {/* Notice Message */}
      {notice && (
        <div className={`live-ar-notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Content Area */}
      <main className="live-ar-content">
        {/* TAB 1: DOCUMENTS (UC-AR-01) */}
        {activeTab === "documents" && (
          <div id="section-documents">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-01: Ghi nhận chứng từ công nợ phải thu (Receivable Documents)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Tạo lập, phê duyệt và ghi sổ chứng từ công nợ từ hóa đơn/chứng từ bán hàng
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-document"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      document_type: "SALES_DOCUMENT",
                      number: `AR-DOC-${Date.now().toString().slice(-6)}`,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                      amount: "5000000",
                      source_reference: "SO-REF-001",
                      description: "Công nợ bán hàng dịch vụ",
                    });
                    setModalType("create-document");
                  }}
                >
                  + Lập chứng từ công nợ
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("documents")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày CT</th>
                    <th>Hạn nợ</th>
                    <th>Khách hàng</th>
                    <th>Số tiền</th>
                    <th>Mã tham chiếu</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có chứng từ công nợ nào. Nhấn "+ Lập chứng từ công nợ" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    documents.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{d.number}</td>
                        <td>{d.document_date}</td>
                        <td>{d.due_date || "—"}</td>
                        <td>{d.customer_name || d.customer?.name || d.customer}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(d.amount)}</td>
                        <td>{d.source_reference || "—"}</td>
                        <td>
                          <span className={`live-ar-status-badge ${d.status?.toLowerCase()}`}>{d.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {d.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("documents", d.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {d.status === "PENDING_APPROVAL" && (
                              <>
                                <button
                                  className="live-ar-btn live-ar-btn-primary"
                                  style={{ padding: "3px 8px", fontSize: 11 }}
                                  onClick={() => handleItemAction("documents", d.id, "approve")}
                                >
                                  Duyệt
                                </button>
                                <button
                                  className="live-ar-btn live-ar-btn-danger"
                                  style={{ padding: "3px 8px", fontSize: 11 }}
                                  onClick={() => handleItemAction("documents", d.id, "reject")}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {(d.status === "APPROVED" || d.status === "DRAFT") && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("documents", d.id, "post")}
                              >
                                Ghi sổ
                              </button>
                            )}
                            {d.status === "POSTED" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("documents", d.id, "reverse")}
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
        )}

        {/* TAB 2: RECEIVABLES (UC-AR-02) */}
        {activeTab === "receivables" && (
          <div id="section-receivables">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-02: Theo dõi chi tiết công nợ phải thu & Lịch thu tiền (Receivables & Schedules)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Quản lý số dư, tuổi nợ, lịch thanh toán theo từng kỳ hạn và đảo khoản phải thu
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-recognize-ar"
                  className="live-ar-btn live-ar-btn-primary"
                  onClick={async () => {
                    const res = await fetch(
                      `/api/v1/accounts-receivable/receivables/unrecognized-sources/?company_id=${companyId}`,
                      { headers: getHeaders() }
                    );
                    const sources = res.ok ? await res.json() : [];
                    if (sources && sources.length > 0) {
                      const src = sources[0];
                      await handleCreateSubmit("receivables/recognize", {
                        company: companyId,
                        source_document_type: src.source_document_type,
                        source_document_id: src.source_document_id,
                        source_line_id: src.source_line_id || "",
                        code: `REC-${Date.now().toString().slice(-6)}`,
                        description: "Ghi nhận công nợ tự động",
                      });
                    } else {
                      setNotice({ type: "info", text: "Hiện chưa có nguồn chứng từ bán chưa ghi nhận công nợ." });
                    }
                  }}
                >
                  ⚡ Ghi nhận từ nguồn bán hàng
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("receivables")}>
                  Làm mới
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            {receivableSummary && (
              <div className="live-ar-stats-grid">
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Tổng phát sinh ban đầu</div>
                  <div className="live-ar-stat-value" style={{ color: "#38bdf8" }}>
                    {formatMoney(receivableSummary.original)} đ
                  </div>
                  <div className="live-ar-stat-desc">Tổng công nợ ghi nhận</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Đã thu tiền</div>
                  <div className="live-ar-stat-value" style={{ color: "#34d399" }}>
                    {formatMoney(receivableSummary.collected)} đ
                  </div>
                  <div className="live-ar-stat-desc">Đã thực thu qua phiếu thu / ngân hàng</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Đã bù trừ / Điều chỉnh</div>
                  <div className="live-ar-stat-value" style={{ color: "#fbbf24" }}>
                    {formatMoney(Number(receivableSummary.netted || 0) + Number(receivableSummary.adjustments || 0))} đ
                  </div>
                  <div className="live-ar-stat-desc">Bù trừ đối ứng hoặc xử lý nợ</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Số dư còn phải thu</div>
                  <div className="live-ar-stat-value" style={{ color: "#f87171" }}>
                    {formatMoney(receivableSummary.balance)} đ
                  </div>
                  <div className="live-ar-stat-desc">Dư nợ mở hiện tại của khách hàng</div>
                </div>
              </div>
            )}

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Mã công nợ</th>
                    <th>Khách hàng</th>
                    <th>Tài khoản</th>
                    <th>Hạn nợ</th>
                    <th>Gốc</th>
                    <th>Đã thu</th>
                    <th>Còn lại</th>
                    <th>Tình trạng hạn</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có khoản phải thu nào. Các khoản phải thu tự động sinh khi chứng từ bán/hóa đơn ghi sổ.
                      </td>
                    </tr>
                  ) : (
                    receivables.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{r.code}</td>
                        <td>{r.customer_name || r.customer_code || r.customer}</td>
                        <td>{r.account_code || "131"}</td>
                        <td>{r.due_date || "—"}</td>
                        <td>{formatMoney(r.original_amount)}</td>
                        <td style={{ color: "#34d399" }}>{formatMoney(r.collected_amount)}</td>
                        <td style={{ fontWeight: 700, color: "#f87171" }}>{formatMoney(r.balance)}</td>
                        <td>
                          <span
                            className={`live-ar-status-badge ${
                              r.due_state === "OVERDUE" ? "overdue" : r.due_state === "DUE" ? "pending" : "draft"
                            }`}
                          >
                            {r.due_state === "OVERDUE" ? "Quá hạn" : r.due_state === "DUE" ? "Đến hạn" : "Chưa đến hạn"}
                          </span>
                        </td>
                        <td>
                          <span className={`live-ar-status-badge ${r.status?.toLowerCase()}`}>{r.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            <button
                              className="live-ar-btn live-ar-btn-secondary"
                              style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => {
                                setSelectedItem(r);
                                setFormData({
                                  reason: "Gia hạn lịch thanh toán theo thỏa thuận",
                                  schedules: [
                                    {
                                      installment_no: 1,
                                      amount: r.balance,
                                      due_date: new Date(Date.now() + 45 * 86400000).toISOString().split("T")[0],
                                      notes: "Kỳ 1 gia hạn",
                                    },
                                  ],
                                });
                                setModalType("update-schedule");
                              }}
                            >
                              Đổi lịch
                            </button>
                            {r.status !== "REVERSED" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(r);
                                  setActionReason("Đảo khoản phải thu sai sót");
                                  setModalType("reverse-receivable");
                                }}
                              >
                                Đảo nợ
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
        )}

        {/* TAB 3: CUSTOMER RECEIPTS (UC-AR-03) */}
        {activeTab === "receipts" && (
          <div id="section-receipts">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-03: Phiếu thu tiền khách hàng (Customer Receipt Vouchers)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Lập phiếu thu tiền mặt hoặc thu tiền gửi ngân hàng thanh toán nợ cho khách hàng
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-receipt"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const cashAcc = refs.accounts.find((a) => a.code === "1111" || a.code?.startsWith("111"))?.id || "";
                    const arAcc = refs.accounts.find((a) => a.code === "131" || a.code?.startsWith("131"))?.id || "";
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      receipt_type: "CASH",
                      method: "CASH",
                      purpose: "DEBT",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      amount: "3000000",
                      debit_account: cashAcc || refs.accounts[0]?.id || "",
                      credit_account: arAcc || refs.accounts[1]?.id || "",
                      cash_fund: refs.cashFunds[0]?.id || null,
                      description: "Thu tiền khách hàng thanh toán nợ đợt 1",
                      lines: [],
                    });
                    setModalType("create-receipt");
                  }}
                >
                  + Lập phiếu thu tiền KH
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("receipts")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số phiếu thu</th>
                    <th>Ngày thu</th>
                    <th>Hình thức</th>
                    <th>Khách hàng</th>
                    <th>Số tiền</th>
                    <th>TK Nợ / Có</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có phiếu thu tiền khách hàng nào. Nhấn "+ Lập phiếu thu tiền KH" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    receipts.map((rc) => (
                      <tr key={rc.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{rc.number}</td>
                        <td>{rc.document_date}</td>
                        <td>
                          <span className="live-ar-status-badge draft">
                            {rc.method === "BANK" ? "Tiền gửi NH" : "Tiền mặt"}
                          </span>
                        </td>
                        <td>{rc.customer_name || rc.customer?.name || rc.customer}</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>{formatMoney(rc.amount)}</td>
                        <td>
                          {rc.debit_account_code || "1111"} / {rc.credit_account_code || "131"}
                        </td>
                        <td>
                          <span className={`live-ar-status-badge ${rc.status?.toLowerCase()}`}>{rc.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {rc.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("customer-receipt-vouchers", rc.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {rc.status === "PENDING_APPROVAL" && (
                              <>
                                <button
                                  className="live-ar-btn live-ar-btn-primary"
                                  style={{ padding: "3px 8px", fontSize: 11 }}
                                  onClick={() => handleItemAction("customer-receipt-vouchers", rc.id, "approve")}
                                >
                                  Duyệt
                                </button>
                                <button
                                  className="live-ar-btn live-ar-btn-danger"
                                  style={{ padding: "3px 8px", fontSize: 11 }}
                                  onClick={() => handleItemAction("customer-receipt-vouchers", rc.id, "reject")}
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {(rc.status === "APPROVED" || rc.status === "DRAFT") && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("customer-receipt-vouchers", rc.id, "post")}
                              >
                                Ghi sổ
                              </button>
                            )}
                            {rc.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("customer-receipt-vouchers", rc.id, "cancel")}
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
        )}

        {/* TAB 4: ALLOCATIONS (UC-AR-04) */}
        {activeTab === "allocations" && (
          <div id="section-allocations">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-04: Chứng từ phân bổ tiền thu (Receipt Allocation Vouchers)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Phân bổ số tiền từ khoản thu chưa đối trừ vào các chứng từ công nợ cụ thể
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("allocations")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày phân bổ</th>
                    <th>Khách hàng</th>
                    <th>Tiền thu khả dụng</th>
                    <th>Đã phân bổ</th>
                    <th>Còn lại</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có chứng từ phân bổ nào. Chứng từ phân bổ quản lý việc gán khoản thu vào từng hóa đơn.
                      </td>
                    </tr>
                  ) : (
                    allocations.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{a.number}</td>
                        <td>{a.allocation_date}</td>
                        <td>{a.customer_name || a.customer}</td>
                        <td>{formatMoney(a.available_amount)}</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>{formatMoney(a.allocated_amount)}</td>
                        <td>{formatMoney(a.remaining_amount)}</td>
                        <td>
                          <span className={`live-ar-status-badge ${a.status?.toLowerCase()}`}>{a.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {a.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("allocation-vouchers", a.id, "post")}
                              >
                                Ghi sổ
                              </button>
                            )}
                            {a.status === "POSTED" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("allocation-vouchers", a.id, "unpost")}
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
        )}

        {/* TAB 5: NETTINGS (UC-AR-05) */}
        {activeTab === "nettings" && (
          <div id="section-nettings">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-05: Bù trừ công nợ giữa cùng đối tượng (Debt Netting Vouchers)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Bù trừ hai chiều giữa công nợ phải thu (TK 131) và công nợ phải trả (TK 331)
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-netting"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const arAcc = refs.accounts.find((a) => a.code === "131" || a.code?.startsWith("131"))?.id || "";
                    const apAcc = refs.accounts.find((a) => a.code === "331" || a.code?.startsWith("331"))?.id || "";
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      supplier: refs.customers[0]?.id || refs.suppliers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      receivable_account: arAcc || refs.accounts[0]?.id || "",
                      payable_account: apAcc || refs.accounts[1]?.id || "",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      description: "Bù trừ công nợ mua bán đối ứng tháng hiện tại",
                      lines: [],
                    });
                    setModalType("create-netting");
                  }}
                >
                  + Lập chứng từ bù trừ
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("nettings")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày bù trừ</th>
                    <th>Khách hàng</th>
                    <th>Đối tác phải trả</th>
                    <th>Tổng tiền bù trừ</th>
                    <th>TK Phải thu / Trả</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {nettings.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có chứng từ bù trừ công nợ nào. Nhấn "+ Lập chứng từ bù trừ" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    nettings.map((n) => (
                      <tr key={n.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{n.number}</td>
                        <td>{n.document_date}</td>
                        <td>{n.customer_name || n.customer}</td>
                        <td>{n.supplier_name || n.customer_name || "Đối ứng"}</td>
                        <td style={{ fontWeight: 700, color: "#fbbf24" }}>{formatMoney(n.total_amount)}</td>
                        <td>
                          {n.receivable_account_code || "131"} / {n.payable_account_code || "331"}
                        </td>
                        <td>
                          <span className={`live-ar-status-badge ${n.status?.toLowerCase()}`}>{n.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {n.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-netting-vouchers", n.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {n.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-netting-vouchers", n.id, "approve")}
                              >
                                Duyệt
                              </button>
                            )}
                            {(n.status === "APPROVED" || n.status === "DRAFT") && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-netting-vouchers", n.id, "post")}
                              >
                                Ghi sổ
                              </button>
                            )}
                            {n.status === "POSTED" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-netting-vouchers", n.id, "unpost")}
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
        )}

        {/* TAB 6: ADJUSTMENTS (UC-AR-06) */}
        {activeTab === "adjustments" && (
          <div id="section-adjustments">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-06: Điều chỉnh công nợ phải thu (Debt Adjustment Vouchers)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Tăng/giảm công nợ, chiết khấu thanh toán bổ sung, xóa nợ khó đòi
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-adjustment"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const arAcc = refs.accounts.find((a) => a.code === "131" || a.code?.startsWith("131"))?.id || "";
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      receivable_account: arAcc || refs.accounts[0]?.id || "",
                      adjustment_type: "DECREASE",
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      document_basis: "BB-THOA-THUAN-CKTM",
                      adjustment_reason: "Chiết khấu thương mại thanh toán đúng hạn",
                      description: "Điều chỉnh giảm công nợ khách hàng",
                      lines: [],
                    });
                    setModalType("create-adjustment");
                  }}
                >
                  + Lập điều chỉnh công nợ
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("adjustments")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày điều chỉnh</th>
                    <th>Khách hàng</th>
                    <th>Loại điều chỉnh</th>
                    <th>Tổng tiền</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có chứng từ điều chỉnh nào. Nhấn "+ Lập điều chỉnh công nợ" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((ad) => (
                      <tr key={ad.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{ad.number}</td>
                        <td>{ad.document_date}</td>
                        <td>{ad.customer_name || ad.customer}</td>
                        <td>
                          <span className="live-ar-status-badge draft">{ad.adjustment_type}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(ad.total_amount)}</td>
                        <td>{ad.adjustment_reason || ad.description}</td>
                        <td>
                          <span className={`live-ar-status-badge ${ad.status?.toLowerCase()}`}>{ad.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {ad.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-adjustment-vouchers", ad.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {ad.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-adjustment-vouchers", ad.id, "approve")}
                              >
                                Duyệt
                              </button>
                            )}
                            {(ad.status === "APPROVED" || ad.status === "DRAFT") && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-adjustment-vouchers", ad.id, "post")}
                              >
                                Ghi sổ
                              </button>
                            )}
                            {ad.status === "POSTED" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("debt-adjustment-vouchers", ad.id, "unpost")}
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
        )}

        {/* TAB 7: RECONCILIATIONS (UC-AR-07) */}
        {activeTab === "reconciliations" && (
          <div id="section-reconciliations">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-07: Biên bản đối chiếu & xác nhận công nợ (Customer Debt Reconciliations)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Trích xuất phát sinh nợ tự động, gửi biên bản cho khách hàng và xác nhận phản hồi
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-reconciliation"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const arAcc = refs.accounts.find((a) => a.code === "131" || a.code?.startsWith("131"))?.id || "";
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      receivable_account: arAcc || refs.accounts[0]?.id || "",
                      statement_date: new Date().toISOString().split("T")[0],
                      from_date: reportFromDate,
                      to_date: reportToDate,
                      contact_person: "Trưởng phòng Kế toán",
                      note: "Đối chiếu công nợ định kỳ",
                      lines: [],
                    });
                    setModalType("create-reconciliation");
                  }}
                >
                  + Lập biên bản đối chiếu
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("reconciliations")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số biên bản</th>
                    <th>Ngày lập</th>
                    <th>Kỳ đối chiếu</th>
                    <th>Khách hàng</th>
                    <th>Đầu kỳ</th>
                    <th>Tăng</th>
                    <th>Giảm</th>
                    <th>Cuối kỳ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có biên bản đối chiếu nào. Nhấn "+ Lập biên bản đối chiếu" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    reconciliations.map((rc) => (
                      <tr key={rc.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{rc.number}</td>
                        <td>{rc.statement_date}</td>
                        <td>
                          {rc.from_date} → {rc.to_date}
                        </td>
                        <td>{rc.customer_name || rc.customer}</td>
                        <td>{formatMoney(rc.opening_balance)}</td>
                        <td style={{ color: "#38bdf8" }}>{formatMoney(rc.period_increase)}</td>
                        <td style={{ color: "#34d399" }}>{formatMoney(rc.period_decrease)}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(rc.closing_balance)}</td>
                        <td>
                          <span className={`live-ar-status-badge ${rc.status?.toLowerCase()}`}>{rc.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {rc.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() =>
                                  handleItemAction("customer-debt-reconciliations", rc.id, "record-sent", {
                                    sent_channel: "EMAIL",
                                    sent_note: "Gửi qua email kế toán khách hàng",
                                  })
                                }
                              >
                                Đã gửi
                              </button>
                            )}
                            {rc.status === "SENT" && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() =>
                                  handleItemAction("customer-debt-reconciliations", rc.id, "record-response", {
                                    response_status: "CONFIRMED",
                                    customer_confirmer_name: "Đại diện kế toán",
                                    response_comment: "Khách hàng xác nhận khớp đúng 100%",
                                  })
                                }
                              >
                                Xác nhận khớp
                              </button>
                            )}
                            <button
                              className="live-ar-btn live-ar-btn-secondary"
                              style={{ padding: "3px 8px", fontSize: 11 }}
                              onClick={() => handleItemAction("customer-debt-reconciliations", rc.id, "refresh-data")}
                            >
                              Tải lại số liệu
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
        )}

        {/* TAB 8: DUE DEBTS & AGING (UC-AR-08) */}
        {activeTab === "due-debts" && (
          <div id="section-due-debts">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-08: Theo dõi công nợ đến hạn, quá hạn & Phân tích tuổi nợ (Due Debts & Aging)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Phân nhóm nợ theo thời gian quá hạn, cảnh báo rủi ro tín dụng và hỗ trợ thu nợ
                </span>
              </div>
              <div className="live-ar-btn-group">
                <a
                  className="live-ar-btn live-ar-btn-secondary"
                  href={`/api/v1/accounts-receivable/customer-due-debts/export/?company_id=${companyId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📥 Xuất Excel tuổi nợ
                </a>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("due-debts")}>
                  Làm mới
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {dueReport?.base_summary && (
              <div className="live-ar-stats-grid">
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Tổng nợ theo dõi</div>
                  <div className="live-ar-stat-value" style={{ color: "#38bdf8" }}>
                    {formatMoney(dueReport.base_summary.base_total_remaining_balance)} đ
                  </div>
                  <div className="live-ar-stat-desc">{dueReport.base_summary.total_count} khoản nợ</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Nợ quá hạn</div>
                  <div className="live-ar-stat-value" style={{ color: "#f87171" }}>
                    {formatMoney(dueReport.base_summary.base_overdue_balance)} đ
                  </div>
                  <div className="live-ar-stat-desc">{dueReport.base_summary.overdue_count} khoản quá hạn</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Đến hạn hôm nay</div>
                  <div className="live-ar-stat-value" style={{ color: "#fbbf24" }}>
                    {formatMoney(dueReport.base_summary.base_due_today_balance)} đ
                  </div>
                  <div className="live-ar-stat-desc">{dueReport.base_summary.due_today_count} khoản</div>
                </div>
                <div className="live-ar-stat-card">
                  <div className="live-ar-stat-label">Sắp đến hạn (1-30 ngày)</div>
                  <div className="live-ar-stat-value" style={{ color: "#34d399" }}>
                    {formatMoney(dueReport.base_summary.base_upcoming_balance)} đ
                  </div>
                  <div className="live-ar-stat-desc">{dueReport.base_summary.upcoming_count} khoản</div>
                </div>
              </div>
            )}

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Mã công nợ</th>
                    <th>Khách hàng</th>
                    <th>Chứng từ nguồn</th>
                    <th>Hạn thanh toán</th>
                    <th>Số ngày quá hạn</th>
                    <th>Dư nợ còn lại</th>
                    <th>Phân nhóm hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {!dueReport?.items || dueReport.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có dữ liệu công nợ đến hạn/quá hạn.
                      </td>
                    </tr>
                  ) : (
                    dueReport.items.map((it: any) => (
                      <tr key={it.receivable_id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{it.receivable_code}</td>
                        <td>{it.customer_name}</td>
                        <td>{it.document_number}</td>
                        <td>{it.due_date || "—"}</td>
                        <td style={{ color: it.days_overdue > 0 ? "#f87171" : "#94a3b8", fontWeight: 600 }}>
                          {it.days_overdue > 0 ? `${it.days_overdue} ngày` : "Chưa quá hạn"}
                        </td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(it.remaining_balance)}</td>
                        <td>
                          <span
                            className={`live-ar-status-badge ${
                              it.due_category === "OVERDUE"
                                ? "overdue"
                                : it.due_category === "DUE_TODAY"
                                ? "pending"
                                : "approved"
                            }`}
                          >
                            {it.due_category_label || it.due_category}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 9: PAYMENT REMINDERS (UC-AR-09) */}
        {activeTab === "payment-reminders" && (
          <div id="section-payment-reminders">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-09: Quản lý thông báo và nhắc nợ khách hàng (Customer Payment Reminders)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Tạo văn bản thông báo nợ, ghi nhận kênh gửi (email/sms/văn bản) và theo dõi phản hồi
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-reminder"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const arAcc = refs.accounts.find((a) => a.code === "131" || a.code?.startsWith("131"))?.id || "";
                    const recItem = receivables.find((r) => r.balance > 0) || receivables[0];
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      receivable_account: arAcc || refs.accounts[0]?.id || "",
                      payment_method: "BANK_TRANSFER",
                      company_bank_account: refs.bankAccounts[0]?.id || null,
                      notice_date: new Date().toISOString().split("T")[0],
                      requested_due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
                      title: "Thông báo đề nghị thanh toán công nợ đến hạn",
                      recipient_name: "Phòng Tài chính Khách hàng",
                      recipient_email: "accountant@customer.example.com",
                      signer_name: "Nguyễn Văn Giám Đốc",
                      signer_title: "Giám đốc Tài chính",
                      lines: recItem ? [{ receivable: recItem.id, requested_amount: recItem.balance }] : [],
                    });
                    setModalType("create-reminder");
                  }}
                >
                  + Lập thông báo nhắc nợ
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("payment-reminders")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Số thông báo</th>
                    <th>Ngày thông báo</th>
                    <th>Hạn yêu cầu</th>
                    <th>Khách hàng</th>
                    <th>Tiêu đề</th>
                    <th>Tổng tiền nhắc</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentReminders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có thông báo nhắc nợ nào. Nhấn "+ Lập thông báo nhắc nợ" để tạo mới.
                      </td>
                    </tr>
                  ) : (
                    paymentReminders.map((pr) => (
                      <tr key={pr.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{pr.notice_number}</td>
                        <td>{pr.notice_date}</td>
                        <td>{pr.requested_due_date}</td>
                        <td>{pr.customer_name || pr.customer}</td>
                        <td>{pr.title}</td>
                        <td style={{ fontWeight: 700, color: "#f87171" }}>{formatMoney(pr.total_requested_amount)}</td>
                        <td>
                          <span className={`live-ar-status-badge ${pr.status?.toLowerCase()}`}>{pr.status}</span>
                        </td>
                        <td>
                          <div className="live-ar-btn-group">
                            {pr.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() =>
                                  handleItemAction("customer-payment-reminders", pr.id, "record-sent", {
                                    sent_channel: "EMAIL",
                                    actual_recipient: pr.recipient_email || "customer@example.com",
                                    note: "Gửi qua email tự động",
                                  })
                                }
                              >
                                Đã gửi
                              </button>
                            )}
                            {pr.status === "SENT" && (
                              <button
                                className="live-ar-btn live-ar-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("customer-payment-reminders", pr.id, "re-notice")}
                              >
                                Nhắc lại
                              </button>
                            )}
                            {pr.status === "DRAFT" && (
                              <button
                                className="live-ar-btn live-ar-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("customer-payment-reminders", pr.id, "cancel")}
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
        )}

        {/* TAB 10: CREDIT POLICIES (UC-AR-10) */}
        {activeTab === "credit-policies" && (
          <div id="section-credit-policies">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-10: Thiết lập chính sách tín dụng & Hạn mức nợ (Credit Policies)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Cài đặt hạn mức nợ tối đa, điều khoản thanh toán và kiểm tra tính hợp lệ khi duyệt đơn hàng
                </span>
              </div>
              <div className="live-ar-btn-group">
                <button
                  id="btn-create-credit-policy"
                  className="live-ar-btn live-ar-btn-primary"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      customer: refs.customers[0]?.id || "",
                      currency: refs.currencies[0]?.id || "",
                      credit_limit: "50000000",
                      payment_term: refs.paymentTerms[0]?.id || null,
                      effective_from: new Date().toISOString().split("T")[0],
                      reason: "Cấp hạn mức bán chịu theo đánh giá tín dụng",
                      is_active: true,
                    });
                    setModalType("create-credit-policy");
                  }}
                >
                  + Thiết lập hạn mức tín dụng
                </button>
                <button className="live-ar-btn live-ar-btn-secondary" onClick={() => loadTabData("credit-policies")}>
                  Làm mới
                </button>
              </div>
            </div>

            {/* Credit Limit Checker Widget */}
            <div style={{ background: "#131b2e", border: "1px solid #1e293b", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "#38bdf8" }}>
                🔍 Kiểm tra hạn mức tín dụng tức thời:
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  id="credit-check-customer"
                  className="live-ar-form-select"
                  style={{ width: 240 }}
                  value={formData.checkCustomer || refs.customers[0]?.id || ""}
                  onChange={(e) => setFormData({ ...formData, checkCustomer: e.target.value })}
                >
                  {refs.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <input
                  id="credit-check-amount"
                  className="live-ar-form-input"
                  style={{ width: 160 }}
                  type="number"
                  placeholder="Số tiền cần kiểm tra"
                  defaultValue="10000000"
                  onChange={(e) => setFormData({ ...formData, checkAmount: e.target.value })}
                />
                <button
                  id="btn-evaluate-credit"
                  className="live-ar-btn live-ar-btn-primary"
                  onClick={async () => {
                    const cust = formData.checkCustomer || refs.customers[0]?.id;
                    const amt = formData.checkAmount || 10000000;
                    try {
                      const res = await fetch(`/api/v1/accounts-receivable/credit-policies/check/?company_id=${companyId}`, {
                        method: "POST",
                        headers: getHeaders(),
                        body: JSON.stringify({
                          company: companyId,
                          customer: cust,
                          amount: amt,
                        }),
                      });
                      if (res.ok) {
                        setCreditCheckResult(await res.json());
                      } else {
                        throw new Error("Lỗi đánh giá hạn mức");
                      }
                    } catch (e: any) {
                      setNotice({ type: "error", text: e.message });
                    }
                  }}
                >
                  Kiểm tra hạn mức
                </button>
              </div>

              {creditCheckResult && (
                <div style={{ marginTop: 12, padding: 10, background: "#0f172a", borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 20 }}>
                    <span>
                      Kết quả:{" "}
                      <strong style={{ color: creditCheckResult.allowed ? "#34d399" : "#f87171" }}>
                        {creditCheckResult.allowed ? "HỢP LỆ (Trong hạn mức)" : "VƯỢT HẠN MỨC"}
                      </strong>
                    </span>
                    <span>Hạn mức: <strong>{formatMoney(creditCheckResult.credit_limit)} đ</strong></span>
                    <span>Đã dùng: <strong>{formatMoney(creditCheckResult.current_balance)} đ</strong></span>
                    <span>Còn lại: <strong>{formatMoney(creditCheckResult.available_limit)} đ</strong></span>
                  </div>
                </div>
              )}
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Hạn mức nợ</th>
                    <th>Đã dùng</th>
                    <th>Còn khả dụng</th>
                    <th>Nợ quá hạn</th>
                    <th>Hiệu lực từ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {creditPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa thiết lập chính sách tín dụng nào. Nhấn "+ Thiết lập hạn mức tín dụng" để tạo.
                      </td>
                    </tr>
                  ) : (
                    creditPolicies.map((cp) => (
                      <tr key={cp.id}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{cp.customer_name || cp.customer}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(cp.credit_limit)}</td>
                        <td style={{ color: "#fbbf24" }}>{formatMoney(cp.used_limit)}</td>
                        <td style={{ color: "#34d399" }}>{formatMoney(cp.available_limit)}</td>
                        <td style={{ color: "#f87171" }}>{formatMoney(cp.overdue_balance)}</td>
                        <td>{cp.effective_from}</td>
                        <td>
                          <span className={`live-ar-status-badge ${cp.is_active ? "approved" : "cancelled"}`}>
                            {cp.is_active ? "Đang áp dụng" : "Ngưng"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 11: REPORTS (UC-AR-11) */}
        {activeTab === "reports" && (
          <div id="section-reports">
            <div className="live-ar-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-AR-11: Báo cáo tổng hợp/chi tiết công nợ phải thu (Customer Debts Report)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Sổ tổng hợp công nợ khách hàng, đối soát số dư đầu kỳ, phát sinh tăng giảm và số dư cuối kỳ
                </span>
              </div>
              <div className="live-ar-btn-group">
                <input
                  type="date"
                  className="live-ar-form-input"
                  style={{ width: 140 }}
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                />
                <input
                  type="date"
                  className="live-ar-form-input"
                  style={{ width: 140 }}
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                />
                <button className="live-ar-btn live-ar-btn-primary" onClick={() => loadTabData("reports")}>
                  Xem báo cáo
                </button>
                <a
                  className="live-ar-btn live-ar-btn-secondary"
                  href={`/api/v1/accounts-receivable/receivables/customer-debts/export/?company_id=${companyId}&from_date=${reportFromDate}&to_date=${reportToDate}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  📥 Xuất Excel
                </a>
                <a
                  className="live-ar-btn live-ar-btn-secondary"
                  href={`/api/v1/accounts-receivable/receivables/customer-debts/print/?company_id=${companyId}&from_date=${reportFromDate}&to_date=${reportToDate}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  🖨️ Bản in
                </a>
              </div>
            </div>

            <div className="live-ar-table-box">
              <table className="live-ar-table">
                <thead>
                  <tr>
                    <th>Mã KH</th>
                    <th>Tên khách hàng</th>
                    <th>Đầu kỳ</th>
                    <th>Tăng trong kỳ</th>
                    <th>Giảm trừ</th>
                    <th>Thanh toán</th>
                    <th>Bù trừ</th>
                    <th>Cuối kỳ</th>
                    <th>Quá hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {!reportData?.rows || reportData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: 24, color: "#64748b" }}>
                        Chưa có dữ liệu báo cáo cho khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    reportData.rows.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: "#38bdf8" }}>{row.customer_code}</td>
                        <td>{row.customer_name}</td>
                        <td>{formatMoney(row.opening)}</td>
                        <td style={{ color: "#38bdf8" }}>{formatMoney(row.increase)}</td>
                        <td>{formatMoney(row.reduction)}</td>
                        <td style={{ color: "#34d399" }}>{formatMoney(row.payment)}</td>
                        <td style={{ color: "#fbbf24" }}>{formatMoney(row.netting)}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(row.closing)}</td>
                        <td style={{ color: "#f87171" }}>{formatMoney(row.overdue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {modalType === "create-document" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập chứng từ công nợ (UC-AR-01)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Số chứng từ</label>
                <input
                  className="live-ar-form-input"
                  value={formData.number || ""}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                />
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Khách hàng</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.customer || ""}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Chi nhánh</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.branch || ""}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Ngày chứng từ</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.document_date || ""}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Hạn thanh toán</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.due_date || ""}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Số tiền</label>
                  <input
                    type="number"
                    className="live-ar-form-input"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Mã tham chiếu nguồn</label>
                  <input
                    className="live-ar-form-input"
                    value={formData.source_reference || ""}
                    onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Mô tả / Diễn giải</label>
                <input
                  className="live-ar-form-input"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-document"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("documents", formData)}
              >
                Lưu chứng từ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RECEIPT MODAL (UC-AR-03) */}
      {modalType === "create-receipt" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập phiếu thu tiền khách hàng (UC-AR-03)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Hình thức thu</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.method || "CASH"}
                    onChange={(e) => {
                      const method = e.target.value;
                      const cashAcc = refs.accounts.find((a) => a.code === "1111" || a.code?.startsWith("111"))?.id || "";
                      const bankAcc = refs.accounts.find((a) => a.code === "1121" || a.code?.startsWith("112"))?.id || "";
                      setFormData({
                        ...formData,
                        method,
                        debit_account: method === "BANK" ? bankAcc : cashAcc,
                        bank_account: method === "BANK" ? refs.bankAccounts[0]?.id || null : null,
                        cash_fund: method === "CASH" ? refs.cashFunds[0]?.id || null : null,
                      });
                    }}
                  >
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK">Tiền gửi ngân hàng</option>
                  </select>
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Khách hàng</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.customer || ""}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Ngày thu</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.document_date || ""}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value, posting_date: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Số tiền thu</label>
                  <input
                    type="number"
                    className="live-ar-form-input"
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Lý do thu / Diễn giải</label>
                <input
                  className="live-ar-form-input"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-receipt"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("customer-receipt-vouchers", formData)}
              >
                Lưu phiếu thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NETTING MODAL (UC-AR-05) */}
      {modalType === "create-netting" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập chứng từ bù trừ công nợ (UC-AR-05)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Khách hàng</label>
                <select
                  className="live-ar-form-select"
                  value={formData.customer || ""}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                >
                  {refs.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Ngày chứng từ</label>
                <input
                  type="date"
                  className="live-ar-form-input"
                  value={formData.document_date || ""}
                  onChange={(e) => setFormData({ ...formData, document_date: e.target.value, posting_date: e.target.value })}
                />
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Nội dung bù trừ</label>
                <input
                  className="live-ar-form-input"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-netting"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("debt-netting-vouchers", formData)}
              >
                Lưu chứng từ bù trừ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ADJUSTMENT MODAL (UC-AR-06) */}
      {modalType === "create-adjustment" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập điều chỉnh công nợ (UC-AR-06)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Loại điều chỉnh</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.adjustment_type || "DECREASE"}
                    onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value })}
                  >
                    <option value="INCREASE">Tăng công nợ</option>
                    <option value="DECREASE">Giảm công nợ</option>
                    <option value="DISCOUNT">Chiết khấu bổ sung</option>
                    <option value="BAD_DEBT">Xử lý nợ xấu</option>
                    <option value="WRITE_OFF">Xóa sổ nợ</option>
                  </select>
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Khách hàng</label>
                  <select
                    className="live-ar-form-select"
                    value={formData.customer || ""}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Lý do điều chỉnh</label>
                <input
                  className="live-ar-form-input"
                  value={formData.adjustment_reason || ""}
                  onChange={(e) => setFormData({ ...formData, adjustment_reason: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-adjustment"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("debt-adjustment-vouchers", formData)}
              >
                Lưu điều chỉnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RECONCILIATION MODAL (UC-AR-07) */}
      {modalType === "create-reconciliation" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập biên bản đối chiếu công nợ (UC-AR-07)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Khách hàng</label>
                <select
                  className="live-ar-form-select"
                  value={formData.customer || ""}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                >
                  {refs.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Từ ngày</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.from_date || ""}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Đến ngày</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.to_date || ""}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Người đại diện liên hệ</label>
                <input
                  className="live-ar-form-input"
                  value={formData.contact_person || ""}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-reconciliation"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("customer-debt-reconciliations", formData)}
              >
                Lưu biên bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE REMINDER MODAL (UC-AR-09) */}
      {modalType === "create-reminder" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Lập thông báo nhắc nợ khách hàng (UC-AR-09)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Khách hàng</label>
                <select
                  className="live-ar-form-select"
                  value={formData.customer || ""}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                >
                  {refs.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Tiêu đề thông báo</label>
                <input
                  className="live-ar-form-input"
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Người nhận</label>
                  <input
                    className="live-ar-form-input"
                    value={formData.recipient_name || ""}
                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Email nhận</label>
                  <input
                    className="live-ar-form-input"
                    value={formData.recipient_email || ""}
                    onChange={(e) => setFormData({ ...formData, recipient_email: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-reminder"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("customer-payment-reminders", formData)}
              >
                Lưu thông báo nhắc nợ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CREDIT POLICY MODAL (UC-AR-10) */}
      {modalType === "create-credit-policy" && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Thiết lập hạn mức tín dụng (UC-AR-10)</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Khách hàng</label>
                <select
                  className="live-ar-form-select"
                  value={formData.customer || ""}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                >
                  {refs.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="live-ar-grid-2">
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Hạn mức tối đa (VNĐ)</label>
                  <input
                    type="number"
                    className="live-ar-form-input"
                    value={formData.credit_limit || ""}
                    onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  />
                </div>
                <div className="live-ar-form-group">
                  <label className="live-ar-form-label">Hiệu lực từ</label>
                  <input
                    type="date"
                    className="live-ar-form-input"
                    value={formData.effective_from || ""}
                    onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Lý do cấp hạn mức</label>
                <input
                  className="live-ar-form-input"
                  value={formData.reason || ""}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-credit-policy"
                className="live-ar-btn live-ar-btn-primary"
                onClick={() => handleCreateSubmit("credit-policies", formData)}
              >
                Lưu chính sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE SCHEDULE MODAL */}
      {modalType === "update-schedule" && selectedItem && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Cập nhật lịch thanh toán ({selectedItem.code})</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Lý do thay đổi</label>
                <input
                  className="live-ar-form-input"
                  value={formData.reason || ""}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Hạn nợ mới</label>
                <input
                  type="date"
                  className="live-ar-form-input"
                  value={formData.schedules[0]?.due_date || ""}
                  onChange={(e) => {
                    const sch = [...formData.schedules];
                    sch[0].due_date = e.target.value;
                    setFormData({ ...formData, schedules: sch });
                  }}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ar-btn live-ar-btn-primary"
                onClick={() =>
                  handleItemAction("receivables", selectedItem.id, "update-schedule", {
                    reason: formData.reason,
                    schedules: formData.schedules,
                  })
                }
              >
                Cập nhật lịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVERSE RECEIVABLE MODAL */}
      {modalType === "reverse-receivable" && selectedItem && (
        <div className="live-ar-modal-backdrop">
          <div className="live-ar-modal">
            <div className="live-ar-modal-header">
              <span className="live-ar-modal-title">Đảo khoản phải thu ({selectedItem.code})</span>
              <button className="live-ar-modal-close" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ar-modal-body">
              <div className="live-ar-form-group">
                <label className="live-ar-form-label">Lý do đảo nợ</label>
                <input
                  className="live-ar-form-input"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="live-ar-modal-footer">
              <button className="live-ar-btn live-ar-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ar-btn live-ar-btn-danger"
                onClick={() =>
                  handleItemAction("receivables", selectedItem.id, "reverse", {
                    reason: actionReason,
                  })
                }
              >
                Xác nhận đảo nợ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
