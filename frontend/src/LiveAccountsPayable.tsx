import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-accounts-payable.css";

type TabKey =
  | "documents"
  | "tracking"
  | "requests"
  | "payments"
  | "allocations"
  | "offsets"
  | "adjustments"
  | "reconciliations"
  | "due"
  | "reports";

interface ReferenceData {
  branches: any[];
  departments: any[];
  suppliers: any[];
  paymentTerms: any[];
  accounts: any[];
  currencies: any[];
  taxRates: any[];
  bankAccounts: any[];
  cashFunds: any[];
  payables: any[];
  users: any[];
}

export default function LiveAccountsPayable() {
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
    departments: [],
    suppliers: [],
    paymentTerms: [],
    accounts: [],
    currencies: [],
    taxRates: [],
    bankAccounts: [],
    cashFunds: [],
    payables: [],
    users: [],
  });

  // Tab Data States
  const [documents, setDocuments] = useState<any[]>([]);
  const [payables, setPayables] = useState<any[]>([]);
  const [trackingSummary, setTrackingSummary] = useState<any[]>([]);
  const [trackingDetail, setTrackingDetail] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [offsets, setOffsets] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [duePayables, setDuePayables] = useState<any[]>([]);
  const [agingSummary, setAgingSummary] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [reportType, setReportType] = useState<string>("ledger");

  // Modals & Forms
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [actionComment, setActionComment] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Tracking Filters
  const [trackingFromDate, setTrackingFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [trackingToDate, setTrackingToDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch references
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [bRes, dRes, pRes, ptRes, aRes, curRes, trRes, pbRes, cfRes, baRes, uRes] = await Promise.all([
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/departments/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/payment-terms/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/tax-rates/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/accounts-payable/payables/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/cash/funds/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/company-bank-accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/iam/memberships/?company_id=${companyId}`, { headers: h }),
      ]);

      const [b, d, p, pt, a, cur, tr, pb, cf, ba, u] = await Promise.all([
        bRes.ok ? bRes.json() : [],
        dRes.ok ? dRes.json() : [],
        pRes.ok ? pRes.json() : [],
        ptRes.ok ? ptRes.json() : [],
        aRes.ok ? aRes.json() : [],
        curRes.ok ? curRes.json() : [],
        trRes.ok ? trRes.json() : [],
        pbRes.ok ? pbRes.json() : [],
        cfRes.ok ? cfRes.json() : [],
        baRes.ok ? baRes.json() : [],
        uRes.ok ? uRes.json() : [],
      ]);

      setRefs({
        branches: Array.isArray(b) ? b : b.results || [],
        departments: Array.isArray(d) ? d : d.results || [],
        suppliers: Array.isArray(p) ? p : p.results || [],
        paymentTerms: Array.isArray(pt) ? pt : pt.results || [],
        accounts: Array.isArray(a) ? a : a.results || [],
        currencies: Array.isArray(cur) ? cur : cur.results || [],
        taxRates: Array.isArray(tr) ? tr : tr.results || [],
        bankAccounts: Array.isArray(ba) ? ba : ba.results || [],
        cashFunds: Array.isArray(cf) ? cf : cf.results || [],
        payables: Array.isArray(pb) ? pb : pb.results || [],
        users: Array.isArray(u) ? u : u.results || [],
      });
      setRefsLoaded(true);
    } catch (e) {
      console.error("Error loading AP references:", e);
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
          const [dRes, pRes] = await Promise.all([
            fetch(`/api/v1/accounts-payable/documents/?company_id=${companyId}`, { headers: h }),
            fetch(`/api/v1/accounts-payable/payables/?company_id=${companyId}`, { headers: h }),
          ]);
          if (dRes.ok) {
            const data = await dRes.json();
            setDocuments(Array.isArray(data) ? data : data.results || []);
          }
          if (pRes.ok) {
            const data = await pRes.json();
            setPayables(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "tracking") {
          const res = await fetch(
            `/api/v1/accounts-payable/tracking/summary/?company_id=${companyId}&from_date=${trackingFromDate}&to_date=${trackingToDate}`,
            { headers: h }
          );
          if (res.ok) {
            const data = await res.json();
            setTrackingSummary(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "requests") {
          const res = await fetch(`/api/v1/accounts-payable/payment-requests/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setPaymentRequests(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "payments") {
          const res = await fetch(`/api/v1/accounts-payable/payments/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setPayments(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "allocations") {
          const res = await fetch(`/api/v1/accounts-payable/payment-allocations/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setAllocations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "offsets") {
          const res = await fetch(`/api/v1/accounts-payable/debt-offsets/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setOffsets(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "adjustments") {
          const res = await fetch(`/api/v1/accounts-payable/adjustment-vouchers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setAdjustments(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "reconciliations") {
          const res = await fetch(`/api/v1/accounts-payable/supplier-reconciliations/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setReconciliations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "due") {
          const res = await fetch(`/api/v1/accounts-payable/due-payables/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setDuePayables(Array.isArray(data) ? data : (data.rows || data.results || []));
            setAgingSummary(data.totals || data);
          }
        } else if (tab === "reports") {
          const rType = reportType === "detail" ? "DETAIL" : "SUMMARY";
          const res = await fetch(`/api/v1/accounts-payable/reports/?company_id=${companyId}&report_type=${rType}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setReportData(data);
          }
        }
      } catch (err: any) {
        setNotice({ type: "error", text: `Lỗi tải dữ liệu: ${err.message}` });
      } finally {
        setLoading(false);
      }
    },
    [companyId, activeTab, getHeaders, trackingFromDate, trackingToDate, reportType]
  );

  useEffect(() => {
    if (companyId) {
      fetchRefs();
      loadTabData(activeTab);
    }
  }, [companyId, activeTab, fetchRefs, loadTabData]);

  // Generic document actions
  const handleDocAction = async (endpoint: string, id: string, action: string, body: any = {}) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/accounts-payable/${endpoint}/${id}/${action}/?company_id=${companyId}`, {
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

  // Creation Handler
  const handleCreateDocument = async (endpoint: string, payload: any) => {
    try {
      setLoading(true);
      console.log("PAYLOAD FOR", endpoint, JSON.stringify(payload));
      const res = await fetch(`/api/v1/accounts-payable/${endpoint}/?company_id=${companyId}`, {
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

  // Helper defaults
  const defaultSupplier = refs.suppliers[0]?.id || "";
  const defaultBranch = refs.branches[0]?.id || "";
  const defaultPaymentTerm = refs.paymentTerms[0]?.id || "";
  const defaultCurrency = refs.currencies[0]?.id || "";
  const defaultPayableAcc = refs.accounts.find((a) => a.code === "331")?.id || refs.accounts[0]?.id || "";
  const defaultTaxAcc = refs.accounts.find((a) => a.code === "1331")?.id || refs.accounts[0]?.id || "";
  const defaultDebitAcc = refs.accounts.find((a) => a.code === "642")?.id || refs.accounts[0]?.id || "";
  const defaultTaxRate = refs.taxRates[0]?.id || "";

  return (
    <div className="live-ap-root">
      {/* Top Header */}
      <header className="live-ap-header">
        <div className="live-ap-title-box">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: 13, color: "#8b949e", cursor: "pointer" }}>← Quay lại</span>
          </Link>
          <div className="live-ap-title">
            <span>Phân hệ Công nợ phải trả (Accounts Payable)</span>
            <span className="live-ap-badge">Live API</span>
          </div>
        </div>

        <div className="live-ap-company-info">
          <span>Doanh nghiệp:</span>
          <span className="live-ap-company-tag">{session?.company?.name || "Chưa chọn"}</span>
          <span>Phạm vi: {session?.branch?.name || "Toàn công ty"}</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="live-ap-nav">
        <button
          className={`live-ap-nav-btn ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
          id="tab-ap-documents"
        >
          <span className="live-ap-nav-tag">AP-01</span> Chứng từ công nợ (CNPT)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "tracking" ? "active" : ""}`}
          onClick={() => setActiveTab("tracking")}
          id="tab-ap-tracking"
        >
          <span className="live-ap-nav-tag">AP-02</span> Theo dõi công nợ NCC
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
          id="tab-ap-requests"
        >
          <span className="live-ap-nav-tag">AP-03</span> Đề nghị thanh toán (DNTT)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
          id="tab-ap-payments"
        >
          <span className="live-ap-nav-tag">AP-04</span> Thanh toán công nợ (UNC/PC)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "allocations" ? "active" : ""}`}
          onClick={() => setActiveTab("allocations")}
          id="tab-ap-allocations"
        >
          <span className="live-ap-nav-tag">AP-05</span> Phân bổ thanh toán (PBCN)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "offsets" ? "active" : ""}`}
          onClick={() => setActiveTab("offsets")}
          id="tab-ap-offsets"
        >
          <span className="live-ap-nav-tag">AP-06</span> Bù trừ công nợ (BTCN)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "adjustments" ? "active" : ""}`}
          onClick={() => setActiveTab("adjustments")}
          id="tab-ap-adjustments"
        >
          <span className="live-ap-nav-tag">AP-07</span> Điều chỉnh công nợ (DCPT)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "reconciliations" ? "active" : ""}`}
          onClick={() => setActiveTab("reconciliations")}
          id="tab-ap-reconciliations"
        >
          <span className="live-ap-nav-tag">AP-08</span> Đối chiếu công nợ (DCNCC)
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "due" ? "active" : ""}`}
          onClick={() => setActiveTab("due")}
          id="tab-ap-due"
        >
          <span className="live-ap-nav-tag">AP-09</span> Công nợ đến hạn
        </button>
        <button
          className={`live-ap-nav-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
          id="tab-ap-reports"
        >
          <span className="live-ap-nav-tag">AP-10</span> Báo cáo công nợ
        </button>
      </nav>

      {/* Main Content */}
      <main className="live-ap-main">
        {/* Notice alert */}
        {notice && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: 16,
              borderRadius: 6,
              backgroundColor:
                notice.type === "success"
                  ? "rgba(35, 134, 54, 0.2)"
                  : notice.type === "error"
                  ? "rgba(218, 54, 51, 0.2)"
                  : "rgba(88, 166, 255, 0.2)",
              color: notice.type === "success" ? "#3fb950" : notice.type === "error" ? "#f85149" : "#58a6ff",
              border: `1px solid ${
                notice.type === "success"
                  ? "rgba(35, 134, 54, 0.4)"
                  : notice.type === "error"
                  ? "rgba(218, 54, 51, 0.4)"
                  : "rgba(88, 166, 255, 0.4)"
              }`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: UC-AP-01 – Ghi nhận công nợ phải trả               */}
        {/* ======================================================== */}
        {activeTab === "documents" && (
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Tổng chứng từ công nợ</span>
                <span className="stat-value">{documents.length}</span>
                <span className="stat-hint">Ghi nhận công nợ gốc (UC-AP-01)</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Tổng nợ phải trả</span>
                <span className="stat-value">
                  {documents
                    .reduce((acc, d) => acc + Number(d.total_amount || 0), 0)
                    .toLocaleString("vi-VN")}{" "}
                  đ
                </span>
                <span className="stat-hint">Bao gồm tiền hàng & thuế GTGT</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Số khoản nợ (Payables)</span>
                <span className="stat-value">{payables.length}</span>
                <span className="stat-hint">Theo dõi số dư & hạn thanh toán</span>
              </div>
            </div>

            <div className="live-ap-toolbar">
              <div className="live-ap-search-wrap">
                <input
                  type="text"
                  placeholder="Tìm theo số chứng từ, nhà cung cấp, diễn giải..."
                  className="live-ap-input"
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-document"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      branch: defaultBranch,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      due_date: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
                      supplier: defaultSupplier,
                      payment_term: defaultPaymentTerm,
                      payable_account: defaultPayableAcc,
                      tax_account: defaultTaxAcc,
                      currency: defaultCurrency,
                      exchange_rate: "1",
                      source_type: "OTHER",
                      description: "Ghi nhận công nợ chi phí dịch vụ tháng 10/2026",
                      action: "SAVE_DRAFT",
                      lines: [
                        {
                          line_no: 1,
                          description: "Chi phí thuê văn phòng & tiện ích",
                          debit_account: defaultDebitAcc,
                          amount: "10000000",
                          tax_rate: defaultTaxRate,
                          tax_rate_percent: "10",
                          tax_amount: "1000000",
                        },
                      ],
                    });
                    setModalType("create_document");
                  }}
                >
                  + Lập chứng từ công nợ (CNPT)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("documents")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ công nợ phải trả (UC-AP-01)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {documents.length} chứng từ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Ngày hạch toán</th>
                      <th>Hạn thanh toán</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng tiền hàng</th>
                      <th>Tiền thuế</th>
                      <th>Tổng công nợ</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ công nợ nào. Nhấn "+ Lập chứng từ công nợ (CNPT)" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      documents.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{d.number}</td>
                          <td>{d.document_date}</td>
                          <td>{d.posting_date}</td>
                          <td>{d.due_date || "—"}</td>
                          <td>{d.supplier_name || "—"}</td>
                          <td>{Number(d.subtotal || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{Number(d.tax_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(d.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(d.status || "").toLowerCase()}`}>{d.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {d.status === "DRAFT" && (
                                <>
                                  <button
                                    className="live-ap-btn live-ap-btn-sm live-ap-btn-accent"
                                    onClick={() => handleDocAction("documents", d.id, "submit")}
                                  >
                                    Gửi duyệt
                                  </button>
                                  <button
                                    className="live-ap-btn live-ap-btn-sm live-ap-btn-primary"
                                    onClick={() => handleDocAction("documents", d.id, "approve")}
                                  >
                                    Duyệt
                                  </button>
                                </>
                              )}
                              {d.status === "APPROVED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-primary"
                                  onClick={() => handleDocAction("documents", d.id, "post")}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {d.status === "POSTED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm"
                                  onClick={() => handleDocAction("documents", d.id, "unpost")}
                                >
                                  Bỏ ghi sổ
                                </button>
                              )}
                              {d.status !== "CANCELLED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-danger"
                                  onClick={() => handleDocAction("documents", d.id, "cancel", { reason: "Người dùng hủy" })}
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

            {/* Sổ chi tiết các khoản nợ phải trả (Payables) */}
            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Sổ theo dõi các Khoản nợ Phải trả (Payables)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {payables.length} khoản nợ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Mã khoản nợ</th>
                      <th>Nhà cung cấp</th>
                      <th>Hạn thanh toán</th>
                      <th>Gốc nợ</th>
                      <th>Đã trả</th>
                      <th>Còn phải trả</th>
                      <th>Tuổi nợ (ngày)</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có khoản nợ phải trả nào.
                        </td>
                      </tr>
                    ) : (
                      payables.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{p.id.slice(0, 8)}</td>
                          <td>{p.supplier_name || p.supplier?.name || "—"}</td>
                          <td>{p.due_date || "—"}</td>
                          <td>{Number(p.original_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{Number(p.paid_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ fontWeight: 700, color: "#d29922" }}>
                            {Number(p.balance || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>{p.age_days ?? "—"}</td>
                          <td>
                            <span className={`status-pill ${String(p.status || "").toLowerCase()}`}>{p.status}</span>
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
        {/* TAB 2: UC-AP-02 – Theo dõi công nợ nhà cung cấp           */}
        {/* ======================================================== */}
        {activeTab === "tracking" && (
          <div>
            <div className="live-ap-toolbar">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Từ ngày:</span>
                <input
                  type="date"
                  className="live-ap-input"
                  value={trackingFromDate}
                  onChange={(e) => setTrackingFromDate(e.target.value)}
                />
                <span style={{ fontSize: 12, color: "#8b949e" }}>Đến ngày:</span>
                <input
                  type="date"
                  className="live-ap-input"
                  value={trackingToDate}
                  onChange={(e) => setTrackingToDate(e.target.value)}
                />
                <button className="live-ap-btn live-ap-btn-primary" onClick={() => loadTabData("tracking")}>
                  Tra cứu
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={`/api/v1/accounts-payable/tracking/export-excel/?company_id=${companyId}&from_date=${trackingFromDate}&to_date=${trackingToDate}`}
                  className="live-ap-btn"
                  target="_blank"
                  rel="noreferrer"
                >
                  📥 Xuất Excel
                </a>
                <button className="live-ap-btn" onClick={() => loadTabData("tracking")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Bảng Tổng hợp Công nợ Nhà cung cấp (UC-AP-02)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Số NCC có phát sinh: {trackingSummary.length}</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Mã NCC</th>
                      <th>Tên nhà cung cấp</th>
                      <th>Dư nợ đầu kỳ</th>
                      <th>Phát sinh tăng</th>
                      <th>Phát sinh giảm</th>
                      <th>Dư nợ cuối kỳ</th>
                      <th>Nợ quá hạn</th>
                      <th>Số ngày quá hạn</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingSummary.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", color: "#8b949e", padding: 32 }}>
                          Không có dữ liệu công nợ trong khoảng thời gian đã chọn.
                        </td>
                      </tr>
                    ) : (
                      trackingSummary.map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{r.supplier_code}</td>
                          <td style={{ fontWeight: 600 }}>{r.supplier_name}</td>
                          <td>{Number(r.opening_payable_balance || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#f85149" }}>+{Number(r.period_increase || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#3fb950" }}>-{Number(r.period_decrease || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(r.closing_payable_balance || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td style={{ color: Number(r.overdue_amount || 0) > 0 ? "#f85149" : "inherit" }}>
                            {Number(r.overdue_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>{r.max_overdue_days || 0} ngày</td>
                          <td>
                            <button
                              className="live-ap-btn live-ap-btn-sm"
                              onClick={async () => {
                                const res = await fetch(
                                  `/api/v1/accounts-payable/tracking/detail/?company_id=${companyId}&supplier_id=${r.supplier_id}`,
                                  { headers: getHeaders() }
                                );
                                if (res.ok) {
                                  const d = await res.json();
                                  setTrackingDetail(d.results || d || []);
                                  setModalType("view_tracking_detail");
                                }
                              }}
                            >
                              Chi tiết
                            </button>
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
        {/* TAB 3: UC-AP-03 – Lập đề nghị thanh toán                   */}
        {/* ======================================================== */}
        {activeTab === "requests" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Quản lý các Đề nghị thanh toán (DNTT) gửi lãnh đạo phê duyệt trước khi chi tiền (UC-AP-03).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-payment-request"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const firstPayable = refs.payables[0];
                    const firstBank = refs.bankAccounts[0];
                    const approverMembership = refs.users.find((m: any) => m.user?.auth_user?.email === "approver@example.local" || m.user?.email === "approver@example.local");
                    const approverId = approverMembership?.user?.id || (refs.users.find((m: any) => m.user?.id !== session?.user?.id)?.user?.id) || "88c02901-e7d7-4922-adf5-92f586890834";
                    setFormData({
                      action: "SAVE_DRAFT",
                      request_type: "DEBT_PAYMENT",
                      supplier: firstPayable?.supplier_id || defaultSupplier,
                      requested_date: new Date().toISOString().split("T")[0],
                      planned_payment_date: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
                      payment_method: "BANK_TRANSFER",
                      company_bank_account: firstBank?.id || "d50f0b7b-0a82-4df6-b5c8-5a1efc9fc046",
                      beneficiary_name: "Công ty Cung ứng Đối tác",
                      beneficiary_account_number: "0123456789",
                      beneficiary_bank_name: "Vietcombank",
                      payment_content: "Thanh toán công nợ mua hàng định kỳ",
                      approver: approverId,
                      attachments: [
                        { file_name: "ho_so_thanh_toan.pdf", file_size: 1024, file_url: "https://example.com/doc.pdf" }
                      ],
                      lines: [
                        {
                          payable: firstPayable?.id || "",
                          amount: firstPayable ? Math.min(Number(firstPayable.balance || 1000000), 1000000) : 1000000,
                        },
                      ],
                    });
                    setModalType("create_payment_request");
                  }}
                >
                  + Lập đề nghị thanh toán (DNTT)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("requests")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Đề nghị thanh toán (UC-AP-03)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {paymentRequests.length} đề nghị</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số DNTT</th>
                      <th>Ngày đề nghị</th>
                      <th>Ngày dự kiến TT</th>
                      <th>Nhà cung cấp</th>
                      <th>Phương thức</th>
                      <th>Tổng số tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRequests.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có đề nghị thanh toán nào. Nhấn "+ Lập đề nghị thanh toán (DNTT)" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      paymentRequests.map((req) => (
                        <tr key={req.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{req.number}</td>
                          <td>{req.requested_date}</td>
                          <td>{req.planned_payment_date}</td>
                          <td>{req.supplier_name || "—"}</td>
                          <td>{req.payment_method_display || req.payment_method}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(req.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(req.status || "").toLowerCase()}`}>{req.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {req.status === "DRAFT" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-accent"
                                  onClick={() => handleDocAction("payment-requests", req.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {req.status === "PENDING_APPROVAL" && (
                                <>
                                  <button
                                    className="live-ap-btn live-ap-btn-sm live-ap-btn-primary"
                                    onClick={() => handleDocAction("payment-requests", req.id, "approve")}
                                  >
                                    Phê duyệt
                                  </button>
                                  <button
                                    className="live-ap-btn live-ap-btn-sm live-ap-btn-danger"
                                    onClick={() => handleDocAction("payment-requests", req.id, "reject", { reason: "Từ chối" })}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              )}
                              {req.status !== "CANCELLED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm"
                                  onClick={() => handleDocAction("payment-requests", req.id, "cancel", { reason: "Người dùng hủy" })}
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
        {/* TAB 4: UC-AP-04 – Thanh toán công nợ nhà cung cấp         */}
        {/* ======================================================== */}
        {activeTab === "payments" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Chứng từ thanh toán công nợ (Ủy nhiệm chi / Phiếu chi) xuất quỹ hoặc ngân hàng (UC-AP-04).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-payment"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      supplier: defaultSupplier,
                      payment_date: new Date().toISOString().split("T")[0],
                      amount: "5000000",
                      currency: defaultCurrency,
                      external_type: "BANK",
                      external_reference: `UNC-${Date.now().toString().slice(-6)}`,
                      description: "Thanh toán tiền hàng qua ngân hàng",
                    });
                    setModalType("create_payment");
                  }}
                >
                  + Lập phiếu thanh toán (UNC/PC)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("payments")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Thanh toán (UC-AP-04)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {payments.length} phiếu</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày thanh toán</th>
                      <th>Nhà cung cấp</th>
                      <th>Số tiền</th>
                      <th>Đã phân bổ</th>
                      <th>Còn lại</th>
                      <th>Phương thức</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có phiếu thanh toán nào. Nhấn "+ Lập phiếu thanh toán (UNC/PC)" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{p.number || p.id.slice(0, 8)}</td>
                          <td>{p.payment_date}</td>
                          <td>{p.supplier_name || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(p.amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>{Number(p.allocated_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#d29922" }}>
                            {Number(p.unallocated_amount || Number(p.amount) - Number(p.allocated_amount)).toLocaleString("vi-VN")} đ
                          </td>
                          <td>{p.external_type || "Chuyển khoản"}</td>
                          <td>
                            <span className={`status-pill ${String(p.status || "").toLowerCase()}`}>{p.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {p.status === "DRAFT" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-primary"
                                  onClick={() => handleDocAction("payments", p.id, "post")}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {p.status === "POSTED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm"
                                  onClick={() => handleDocAction("payments", p.id, "unpost")}
                                >
                                  Bỏ ghi sổ
                                </button>
                              )}
                              {p.status !== "CANCELLED" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-danger"
                                  onClick={() => handleDocAction("payments", p.id, "cancel", { reason: "Người dùng hủy" })}
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
        {/* TAB 5: UC-AP-05 – Phân bổ thanh toán                      */}
        {/* ======================================================== */}
        {activeTab === "allocations" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Phân bổ khoản tiền đã trả vào các hóa đơn / khoản nợ chi tiết của nhà cung cấp (UC-AP-05).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-allocation"
                  disabled={!refsLoaded || payments.length === 0}
                  onClick={() => {
                    const firstPayment = payments.find((p) => Number(p.amount) > Number(p.allocated_amount)) || payments[0];
                    const firstPayable = refs.payables[0];
                    setFormData({
                      payment: firstPayment?.id || "",
                      allocation_date: new Date().toISOString().split("T")[0],
                      lines: [
                        {
                          payable: firstPayable?.id || "",
                          allocated_amount: "2000000",
                        },
                      ],
                    });
                    setModalType("create_allocation");
                  }}
                >
                  + Tạo phân bổ thanh toán (PBCN)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("allocations")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Phân bổ Thanh toán (UC-AP-05)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {allocations.length} chứng từ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số PBCN</th>
                      <th>Ngày phân bổ</th>
                      <th>Phiếu thanh toán</th>
                      <th>Nhà cung cấp</th>
                      <th>Tổng phân bổ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ phân bổ nào. Nhấn "+ Tạo phân bổ thanh toán" để thực hiện.
                        </td>
                      </tr>
                    ) : (
                      allocations.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{a.number}</td>
                          <td>{a.allocation_date}</td>
                          <td>{a.payment_number || "—"}</td>
                          <td>{a.supplier_name || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#3fb950" }}>
                            {Number(a.allocated_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(a.status || "").toLowerCase()}`}>{a.status}</span>
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
        {/* TAB 6: UC-AP-06 – Bù trừ công nợ phải trả                 */}
        {/* ======================================================== */}
        {activeTab === "offsets" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Bù trừ giữa công nợ phải trả (331) và công nợ phải thu (131) cho cùng một đối tác (UC-AP-06).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-offset"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const firstPayable = refs.payables[0];
                    setFormData({
                      partner: defaultSupplier,
                      offset_date: new Date().toISOString().split("T")[0],
                      basis: "Biên bản thỏa thuận bù trừ công nợ hai bên",
                      payable_lines: [
                        {
                          payable: firstPayable?.id || "",
                          amount: "1000000",
                          expected_balance: firstPayable?.balance || "1000000",
                        },
                      ],
                      receivable_lines: [],
                    });
                    setModalType("create_offset");
                  }}
                >
                  + Lập chứng từ bù trừ (BTCN)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("offsets")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Bù trừ Công nợ (UC-AP-06)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {offsets.length} chứng từ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày bù trừ</th>
                      <th>Đối tác bù trừ</th>
                      <th>Số tiền bù trừ</th>
                      <th>Căn cứ</th>
                      <th>Bút toán GL</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offsets.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ bù trừ công nợ nào.
                        </td>
                      </tr>
                    ) : (
                      offsets.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{o.number}</td>
                          <td>{o.offset_date}</td>
                          <td>{o.partner_name || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#58a6ff" }}>
                            {Number(o.offset_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>{o.basis || "—"}</td>
                          <td>{o.journal_entry_number || "—"}</td>
                          <td>
                            <span className={`status-pill ${String(o.status || "").toLowerCase()}`}>{o.status}</span>
                          </td>
                          <td>
                            {o.status === "POSTED" && (
                              <button
                                className="live-ap-btn live-ap-btn-sm live-ap-btn-danger"
                                onClick={() => handleDocAction("debt-offsets", o.id, "cancel", { reason: "Hủy theo yêu cầu" })}
                              >
                                Hủy bù trừ
                              </button>
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

        {/* ======================================================== */}
        {/* TAB 7: UC-AP-07 – Điều chỉnh công nợ phải trả             */}
        {/* ======================================================== */}
        {activeTab === "adjustments" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Điều chỉnh tăng hoặc giảm công nợ phải trả do chênh lệch hóa đơn, chiết khấu hoặc thỏa thuận (UC-AP-07).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-adjustment"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const firstPayable = refs.payables[0];
                    setFormData({
                      supplier: firstPayable?.supplier_id || defaultSupplier,
                      payable: firstPayable?.id || "",
                      kind: "INCREASE",
                      adjustment_date: new Date().toISOString().split("T")[0],
                      reason: "RECONCILIATION",
                      basis: "Biên bản điều chỉnh công nợ số 01",
                      description: "Điều chỉnh tăng công nợ theo biên bản đối chiếu",
                      amount: "500000",
                      counter_account: defaultDebitAcc,
                      expected_balance: firstPayable?.balance != null ? String(firstPayable.balance) : undefined,
                    });
                    setModalType("create_adjustment");
                  }}
                >
                  + Lập điều chỉnh công nợ (DCPT)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("adjustments")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Điều chỉnh Công nợ (UC-AP-07)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {adjustments.length} chứng từ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày điều chỉnh</th>
                      <th>Nhà cung cấp</th>
                      <th>Loại điều chỉnh</th>
                      <th>Số tiền</th>
                      <th>TK Đối ứng</th>
                      <th>Số dư trước/sau</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ điều chỉnh công nợ nào.
                        </td>
                      </tr>
                    ) : (
                      adjustments.map((adj) => (
                        <tr key={adj.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{adj.number}</td>
                          <td>{adj.adjustment_date}</td>
                          <td>{adj.supplier_name || "—"}</td>
                          <td>
                            <span
                              className={`status-pill ${
                                adj.kind === "INCREASE" ? "partially_paid" : "approved"
                              }`}
                            >
                              {adj.kind === "INCREASE" ? "TĂNG NỢ" : "GIẢM NỢ"}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{Number(adj.amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{adj.counter_account_code || "642"}</td>
                          <td>
                            {Number(adj.balance_before || 0).toLocaleString("vi-VN")} đ →{" "}
                            {Number(adj.balance_after || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(adj.status || "").toLowerCase()}`}>{adj.status}</span>
                          </td>
                          <td>
                            {adj.status === "POSTED" && (
                              <button
                                className="live-ap-btn live-ap-btn-sm live-ap-btn-danger"
                                onClick={() => handleDocAction("adjustment-vouchers", adj.id, "cancel", { reason: "Hủy theo yêu cầu" })}
                              >
                                Hủy điều chỉnh
                              </button>
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

        {/* ======================================================== */}
        {/* TAB 8: UC-AP-08 – Đối chiếu công nợ nhà cung cấp          */}
        {/* ======================================================== */}
        {activeTab === "reconciliations" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Lập và theo dõi biên bản đối chiếu số liệu công nợ định kỳ với nhà cung cấp (UC-AP-08).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-ap-btn live-ap-btn-primary"
                  id="btn-create-reconciliation"
                  disabled={!refsLoaded}
                  onClick={async () => {
                    const pStart = new Date(Date.now() - 86400000 * 30).toISOString().split("T")[0];
                    const pEnd = new Date().toISOString().split("T")[0];
                    // Fetch preview snapshot token
                    const pUrl = `/api/v1/accounts-payable/supplier-reconciliations/preview/?company_id=${companyId}&company=${companyId}&supplier=${defaultSupplier}&currency=${defaultCurrency}&period_start=${pStart}&period_end=${pEnd}`;
                    const res = await fetch(pUrl, { headers: getHeaders() });
                    if (res.ok) {
                      const prevData = await res.json();
                      setFormData({
                        company: companyId,
                        company_id: companyId,
                        supplier: defaultSupplier,
                        currency: defaultCurrency,
                        period_start: pStart,
                        period_end: pEnd,
                        snapshot_token: prevData.snapshot_token,
                      });
                      setModalType("create_reconciliation");
                    } else {
                      setNotice({ type: "error", text: "Không thể lấy bản xem trước đối chiếu." });
                    }
                  }}
                >
                  + Lập biên bản đối chiếu (DCNCC)
                </button>
                <button className="live-ap-btn" onClick={() => loadTabData("reconciliations")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Biên bản Đối chiếu Công nợ NCC (UC-AP-08)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {reconciliations.length} biên bản</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số biên bản</th>
                      <th>Nhà cung cấp</th>
                      <th>Kỳ đối chiếu</th>
                      <th>Dư đầu kỳ</th>
                      <th>Tăng trong kỳ</th>
                      <th>Giảm trong kỳ</th>
                      <th>Dư cuối kỳ</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có biên bản đối chiếu công nợ nào.
                        </td>
                      </tr>
                    ) : (
                      reconciliations.map((rc) => (
                        <tr key={rc.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{rc.number}</td>
                          <td>{rc.supplier_name || "—"}</td>
                          <td>
                            {rc.period_start} ~ {rc.period_end}
                          </td>
                          <td>{Number(rc.opening_balance || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{Number(rc.period_increase || 0).toLocaleString("vi-VN")} đ</td>
                          <td>{Number(rc.period_decrease || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(rc.closing_balance || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(rc.status || "").toLowerCase()}`}>{rc.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {rc.status === "DRAFT" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-primary"
                                  onClick={() => handleDocAction("supplier-reconciliations", rc.id, "send_reconciliation")}
                                >
                                  Gửi NCC
                                </button>
                              )}
                              {rc.status === "SENT" && (
                                <button
                                  className="live-ap-btn live-ap-btn-sm live-ap-btn-accent"
                                  onClick={() =>
                                    handleDocAction("supplier-reconciliations", rc.id, "confirm_reconciliation", {
                                      result: "MATCHED",
                                    })
                                  }
                                >
                                  Xác nhận khớp
                                </button>
                              )}
                              {rc.status === "CONFIRMED" && (
                                <span style={{ color: "#3fb950", fontSize: 11, fontWeight: 700 }}>✓ ĐÃ KHỚP</span>
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
        {/* TAB 9: UC-AP-09 – Theo dõi công nợ đến hạn                */}
        {/* ======================================================== */}
        {activeTab === "due" && (
          <div>
            <div className="live-ap-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Phân tích độ tuổi và cảnh báo các khoản nợ sắp đến hạn, quá hạn thanh toán (UC-AP-09).
              </span>
              <button className="live-ap-btn" onClick={() => loadTabData("due")}>
                Làm mới
              </button>
            </div>

            {/* Aging Summary Matrix */}
            <div className="aging-grid">
              <div className="aging-card">
                <div className="aging-title">Chưa đến hạn</div>
                <div className="aging-amount">
                  {Number(agingSummary?.total_not_due || agingSummary?.not_due || 0).toLocaleString("vi-VN")} đ
                </div>
                <div className="aging-count">{duePayables.filter((d: any) => d.due_group === "NOT_DUE").length} khoản nợ</div>
              </div>
              <div className="aging-card warning">
                <div className="aging-title">Sắp đến hạn</div>
                <div className="aging-amount" style={{ color: "#d29922" }}>
                  {Number(agingSummary?.total_due_soon || agingSummary?.due_soon || 0).toLocaleString("vi-VN")} đ
                </div>
                <div className="aging-count">{duePayables.filter((d: any) => d.due_group === "DUE_SOON").length} khoản nợ</div>
              </div>
              <div className="aging-card danger">
                <div className="aging-title">Đến hạn hôm nay</div>
                <div className="aging-amount" style={{ color: "#f85149" }}>
                  {Number(agingSummary?.total_due_today || agingSummary?.due_today || 0).toLocaleString("vi-VN")} đ
                </div>
                <div className="aging-count">{duePayables.filter((d: any) => d.due_group === "DUE_TODAY").length} khoản nợ</div>
              </div>
              <div className="aging-card danger">
                <div className="aging-title">Quá hạn</div>
                <div className="aging-amount" style={{ color: "#f85149" }}>
                  {Number(agingSummary?.total_overdue || agingSummary?.overdue || 0).toLocaleString("vi-VN")} đ
                </div>
                <div className="aging-count">{duePayables.filter((d: any) => d.due_group === "OVERDUE").length} khoản nợ</div>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Khoản nợ Đến hạn & Quá hạn (UC-AP-09)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {duePayables.length} khoản nợ</span>
              </div>
              <div className="live-ap-table-wrapper">
                <table className="live-ap-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Nhà cung cấp</th>
                      <th>Hạn thanh toán</th>
                      <th>Gốc nợ</th>
                      <th>Còn phải trả</th>
                      <th>Số ngày quá hạn</th>
                      <th>Trạng thái hạn nợ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duePayables.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Không có khoản nợ nào sắp đến hạn hoặc quá hạn.
                        </td>
                      </tr>
                    ) : (
                      duePayables.map((dp, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{dp.source_number || dp.id?.slice(0, 8)}</td>
                          <td>{dp.supplier_name}</td>
                          <td>{dp.due_date}</td>
                          <td>{Number(dp.original_amount || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(dp.balance || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td style={{ color: dp.overdue_days > 0 ? "#f85149" : "inherit" }}>
                            {dp.overdue_days > 0 ? `${dp.overdue_days} ngày` : "Chưa quá hạn"}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                dp.overdue_days > 0 ? "overdue" : "approved"
                              }`}
                            >
                              {dp.overdue_days > 0 ? "QUÁ HẠN" : "TRONG HẠN"}
                            </span>
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
        {/* TAB 10: UC-AP-10 – Xem báo cáo công nợ phải trả           */}
        {/* ======================================================== */}
        {activeTab === "reports" && (
          <div>
            <div className="live-ap-toolbar">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Loại báo cáo:</span>
                <select
                  className="live-ap-select"
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value);
                  }}
                >
                  <option value="ledger">Sổ chi tiết công nợ phải trả</option>
                  <option value="aging">Báo cáo tuổi nợ nhà cung cấp</option>
                  <option value="summary">Báo cáo tổng hợp công nợ NCC</option>
                </select>
                <button className="live-ap-btn live-ap-btn-primary" onClick={() => loadTabData("reports")}>
                  Xem báo cáo
                </button>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={`/api/v1/accounts-payable/reports/${
                    reportType === "aging" ? "aging-report" : reportType === "summary" ? "debt-summary" : "payable-ledger"
                  }/export-pdf/?company_id=${companyId}`}
                  className="live-ap-btn"
                  target="_blank"
                  rel="noreferrer"
                >
                  📄 Xuất PDF
                </a>
                <button className="live-ap-btn" onClick={() => loadTabData("reports")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-ap-card">
              <div className="live-ap-card-header">
                <span style={{ fontWeight: 600 }}>
                  {reportType === "aging"
                    ? "Báo cáo Tuổi nợ Nhà cung cấp (UC-AP-10)"
                    : reportType === "summary"
                    ? "Báo cáo Tổng hợp Công nợ Nhà cung cấp (UC-AP-10)"
                    : "Sổ Chi tiết Công nợ Phải trả (UC-AP-10)"}
                </span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Dữ liệu thời gian thực</span>
              </div>
              <div className="live-ap-table-wrapper" style={{ padding: 16 }}>
                {!reportData ? (
                  <div style={{ textAlign: "center", color: "#8b949e", padding: 32 }}>
                    Đang tải dữ liệu báo cáo...
                  </div>
                ) : (
                  <pre
                    style={{
                      background: "#0d1117",
                      padding: 16,
                      borderRadius: 8,
                      border: "1px solid #30363d",
                      fontSize: 12,
                      overflowX: "auto",
                      color: "#58a6ff",
                    }}
                  >
                    {JSON.stringify(reportData, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL: Lập chứng từ công nợ (UC-AP-01)                   */}
      {/* ======================================================== */}
      {modalType === "create_document" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Chứng từ Công nợ Phải trả (UC-AP-01)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Chi nhánh / Đơn vị:</label>
                  <select
                    className="live-ap-select"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  >
                    {refs.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Nhà cung cấp:</label>
                  <select
                    className="live-ap-select"
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
                <div className="form-group">
                  <label>Ngày chứng từ:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ngày hạch toán:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.posting_date}
                    onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Hạn thanh toán:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Điều khoản thanh toán:</label>
                  <select
                    className="live-ap-select"
                    value={formData.payment_term}
                    onChange={(e) => setFormData({ ...formData, payment_term: e.target.value })}
                  >
                    {refs.paymentTerms.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name} ({pt.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Diễn giải chứng từ:</label>
                <input
                  type="text"
                  className="live-ap-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ borderTop: "1px solid #30363d", paddingTop: 14 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Chi tiết dòng chứng từ (Nợ 642, Có 331):</span>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label>Số tiền (trước thuế):</label>
                    <input
                      type="number"
                      className="live-ap-input"
                      value={formData.lines?.[0]?.amount || 10000000}
                      onChange={(e) => {
                        const amt = e.target.value;
                        const tax = Number(amt) * 0.1;
                        const newLines = [...(formData.lines || [])];
                        newLines[0] = { ...newLines[0], amount: amt, tax_amount: String(tax) };
                        setFormData({ ...formData, lines: newLines });
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Thuế suất VAT:</label>
                    <select
                      className="live-ap-select"
                      value={formData.lines?.[0]?.tax_rate || defaultTaxRate}
                      onChange={(e) => {
                        const newLines = [...(formData.lines || [])];
                        newLines[0] = { ...newLines[0], tax_rate: e.target.value };
                        setFormData({ ...formData, lines: newLines });
                      }}
                    >
                      {refs.taxRates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.rate_percent}%)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() => handleCreateDocument("documents", { ...formData, company: companyId })}
              >
                Lưu chứng từ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập đề nghị thanh toán (UC-AP-03)                  */}
      {/* ======================================================== */}
      {modalType === "create_payment_request" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Đề nghị Thanh toán (UC-AP-03)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhà cung cấp thụ hưởng:</label>
                  <select
                    className="live-ap-select"
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
                <div className="form-group">
                  <label>Phương thức thanh toán:</label>
                  <select
                    className="live-ap-select"
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  >
                    <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                    <option value="CASH">Tiền mặt</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày đề nghị:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.requested_date}
                    onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ngày dự kiến thanh toán:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.planned_payment_date}
                    onChange={(e) => setFormData({ ...formData, planned_payment_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nội dung thanh toán:</label>
                <input
                  type="text"
                  className="live-ap-input"
                  value={formData.payment_content}
                  onChange={(e) => setFormData({ ...formData, payment_content: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Tên đơn vị thụ hưởng:</label>
                  <input
                    type="text"
                    className="live-ap-input"
                    value={formData.beneficiary_name}
                    onChange={(e) => setFormData({ ...formData, beneficiary_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Số tài khoản thụ hưởng:</label>
                  <input
                    type="text"
                    className="live-ap-input"
                    value={formData.beneficiary_account_number}
                    onChange={(e) => setFormData({ ...formData, beneficiary_account_number: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("payment-requests", {
                    ...formData,
                    company: companyId,
                    lines: formData.lines || [],
                    attachments: formData.attachments?.length
                      ? formData.attachments
                      : [{ file_name: "ho_so_thanh_toan.pdf", file_size: 1024, file_url: "https://example.com/doc.pdf" }],
                  })
                }
              >
                Lưu đề nghị
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập phiếu thanh toán (UC-AP-04)                    */}
      {/* ======================================================== */}
      {modalType === "create_payment" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Phiếu Thanh toán Công nợ (UC-AP-04)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhà cung cấp:</label>
                  <select
                    className="live-ap-select"
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
                <div className="form-group">
                  <label>Số tiền thanh toán:</label>
                  <input
                    type="number"
                    className="live-ap-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ngày thanh toán:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phương thức thanh toán:</label>
                  <select
                    className="live-ap-select"
                    value={formData.external_type}
                    onChange={(e) => setFormData({ ...formData, external_type: e.target.value })}
                  >
                    <option value="BANK">Ủy nhiệm chi (Ngân hàng)</option>
                    <option value="CASH">Phiếu chi (Tiền mặt)</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Diễn giải:</label>
                <input
                  type="text"
                  className="live-ap-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("payments", {
                    ...formData,
                    company: companyId,
                  })
                }
              >
                Lưu phiếu thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Tạo phân bổ thanh toán (UC-AP-05)                  */}
      {/* ======================================================== */}
      {modalType === "create_allocation" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Phân bổ Thanh toán vào Khoản nợ (UC-AP-05)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Chọn phiếu thanh toán (có số dư chưa phân bổ):</label>
                  <select
                    className="live-ap-select"
                    value={formData.payment}
                    onChange={(e) => setFormData({ ...formData, payment: e.target.value })}
                  >
                    {payments.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number || p.id.slice(0, 8)} - {Number(p.amount).toLocaleString("vi-VN")} đ ({p.supplier_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày phân bổ:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.allocation_date}
                    onChange={(e) => setFormData({ ...formData, allocation_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Khoản nợ được phân bổ:</label>
                <select
                  className="live-ap-select"
                  value={formData.lines?.[0]?.payable || ""}
                  onChange={(e) => {
                    const newLines = [...(formData.lines || [])];
                    newLines[0] = { ...newLines[0], payable: e.target.value };
                    setFormData({ ...formData, lines: newLines });
                  }}
                >
                  {refs.payables.map((pb) => (
                    <option key={pb.id} value={pb.id}>
                      Mã {pb.id.slice(0, 8)} - Số dư: {Number(pb.balance || 0).toLocaleString("vi-VN")} đ
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Số tiền phân bổ:</label>
                <input
                  type="number"
                  className="live-ap-input"
                  value={formData.lines?.[0]?.allocated_amount || 2000000}
                  onChange={(e) => {
                    const newLines = [...(formData.lines || [])];
                    newLines[0] = { ...newLines[0], allocated_amount: e.target.value };
                    setFormData({ ...formData, lines: newLines });
                  }}
                />
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("payment-allocations", {
                    ...formData,
                    company: companyId,
                  })
                }
              >
                Lưu phân bổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập chứng từ bù trừ (UC-AP-06)                     */}
      {/* ======================================================== */}
      {modalType === "create_offset" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Chứng từ Bù trừ Công nợ (UC-AP-06)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Đối tác bù trừ (vừa là NCC vừa là Khách hàng):</label>
                  <select
                    className="live-ap-select"
                    value={formData.partner}
                    onChange={(e) => setFormData({ ...formData, partner: e.target.value })}
                  >
                    {refs.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày bù trừ:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.offset_date}
                    onChange={(e) => setFormData({ ...formData, offset_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Căn cứ bù trừ:</label>
                <input
                  type="text"
                  className="live-ap-input"
                  value={formData.basis}
                  onChange={(e) => setFormData({ ...formData, basis: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Số tiền bù trừ:</label>
                <input
                  type="number"
                  className="live-ap-input"
                  value={formData.payable_lines?.[0]?.amount || 1000000}
                  onChange={(e) => {
                    const amt = e.target.value;
                    const pLines = [{ ...(formData.payable_lines?.[0] || {}), amount: amt }];
                    setFormData({ ...formData, payable_lines: pLines });
                  }}
                />
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("debt-offsets", {
                    ...formData,
                    company: companyId,
                  })
                }
              >
                Lưu chứng từ bù trừ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập điều chỉnh công nợ (UC-AP-07)                  */}
      {/* ======================================================== */}
      {modalType === "create_adjustment" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Điều chỉnh Công nợ Phải trả (UC-AP-07)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhà cung cấp:</label>
                  <select
                    className="live-ap-select"
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
                <div className="form-group">
                  <label>Loại điều chỉnh:</label>
                  <select
                    className="live-ap-select"
                    value={formData.kind}
                    onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                  >
                    <option value="INCREASE">Tăng công nợ</option>
                    <option value="DECREASE">Giảm công nợ</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Số tiền điều chỉnh:</label>
                  <input
                    type="number"
                    className="live-ap-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ngày điều chỉnh:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.adjustment_date}
                    onChange={(e) => setFormData({ ...formData, adjustment_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Căn cứ điều chỉnh:</label>
                <input
                  type="text"
                  className="live-ap-input"
                  value={formData.basis}
                  onChange={(e) => setFormData({ ...formData, basis: e.target.value })}
                />
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("adjustment-vouchers", {
                    ...formData,
                    company: companyId,
                    description: formData.description || "Điều chỉnh công nợ phải trả theo biên bản",
                  })
                }
              >
                Lưu điều chỉnh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập biên bản đối chiếu (UC-AP-08)                 */}
      {/* ======================================================== */}
      {modalType === "create_reconciliation" && (
        <div className="live-ap-modal-backdrop">
          <div className="live-ap-modal">
            <div className="live-ap-modal-header">
              <span className="live-ap-modal-title">Lập Biên bản Đối chiếu Công nợ NCC (UC-AP-08)</span>
              <button className="live-ap-btn live-ap-btn-sm" onClick={() => setModalType(null)}>
                ✕
              </button>
            </div>
            <div className="live-ap-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Nhà cung cấp:</label>
                  <select
                    className="live-ap-select"
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
                <div className="form-group">
                  <label>Tiền tệ:</label>
                  <select
                    className="live-ap-select"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    {refs.currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Từ ngày:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.period_start}
                    onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Đến ngày:</label>
                  <input
                    type="date"
                    className="live-ap-input"
                    value={formData.period_end}
                    onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ color: "#3fb950", fontSize: 12 }}>
                ✓ Bản đối chiếu snapshot đã được tính toán tự động từ sổ cái và chứng từ.
              </div>
            </div>
            <div className="live-ap-modal-footer">
              <button className="live-ap-btn" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-ap-btn live-ap-btn-primary"
                onClick={() =>
                  handleCreateDocument("supplier-reconciliations", {
                    ...formData,
                    company: companyId,
                  })
                }
              >
                Tạo biên bản đối chiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
