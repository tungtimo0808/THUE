import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-cash.css";

type TabKey =
  | "funds"
  | "receipts"
  | "payments"
  | "ledger"
  | "transfers"
  | "advances"
  | "settlements"
  | "counts"
  | "revaluations"
  | "approvals";

interface ReferenceData {
  branches: any[];
  currencies: any[];
  employees: any[];
  accounts: any[];
  parties: any[];
  bankAccounts: any[];
}

export default function LiveCash() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("funds");
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
    branches: [],
    currencies: [],
    employees: [],
    accounts: [],
    parties: [],
    bankAccounts: [],
  });

  // Tab Data States
  const [funds, setFunds] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [revaluations, setRevaluations] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Sổ quỹ (Ledger) state
  const [selectedFundId, setSelectedFundId] = useState<string>("");
  const [ledgerDateFrom, setLedgerDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [ledgerDateTo, setLedgerDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [ledgerData, setLedgerData] = useState<any>(null);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");
  const [glRefInput, setGlRefInput] = useState("");

  // Fetch Master Data
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [bRes, cRes, eRes, aRes, pRes, baRes] = await Promise.all([
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/employees/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/company-bank-accounts/?company_id=${companyId}`, { headers: h }),
      ]);

      const [b, c, e, a, p, ba] = await Promise.all([
        bRes.ok ? bRes.json() : [],
        cRes.ok ? cRes.json() : [],
        eRes.ok ? eRes.json() : [],
        aRes.ok ? aRes.json() : [],
        pRes.ok ? pRes.json() : [],
        baRes.ok ? baRes.json() : [],
      ]);

      setRefs({
        branches: Array.isArray(b) ? b : b.results || [],
        currencies: Array.isArray(c) ? c : c.results || [],
        employees: Array.isArray(e) ? e : e.results || [],
        accounts: Array.isArray(a) ? a : a.results || [],
        parties: Array.isArray(p) ? p : p.results || [],
        bankAccounts: Array.isArray(ba) ? ba : ba.results || [],
      });
      setRefsLoaded(true);
    } catch (err) {
      console.error("Error loading Cash references:", err);
    }
  }, [companyId, getHeaders]);

  // Load Active Tab Data
  const loadTabData = useCallback(
    async (tab = activeTab) => {
      if (!companyId) return;
      setLoading(true);
      const h = getHeaders();

      try {
        if (tab === "funds") {
          const res = await fetch(`/api/v1/cash/funds/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : data.results || [];
            setFunds(list);
            if (list.length > 0 && !selectedFundId) {
              setSelectedFundId(list[0].id);
            }
          }
        } else if (tab === "receipts") {
          const res = await fetch(
            `/api/v1/cash/transactions/?company_id=${companyId}&transaction_type=RECEIPT`,
            { headers: h }
          );
          if (res.ok) {
            const data = await res.json();
            setReceipts(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "payments") {
          const res = await fetch(
            `/api/v1/cash/transactions/?company_id=${companyId}&transaction_type=PAYMENT`,
            { headers: h }
          );
          if (res.ok) {
            const data = await res.json();
            setPayments(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "transfers") {
          const res = await fetch(`/api/v1/cash/transfers/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setTransfers(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "advances") {
          const res = await fetch(`/api/v1/cash/advances/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setAdvances(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "settlements") {
          const res = await fetch(`/api/v1/cash/settlements/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setSettlements(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "counts") {
          const res = await fetch(`/api/v1/cash/counts/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setCounts(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "revaluations") {
          const res = await fetch(`/api/v1/cash/revaluations/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setRevaluations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "approvals") {
          const res = await fetch(`/api/v1/cash/approvals/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setApprovals(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "ledger") {
          if (selectedFundId) {
            const res = await fetch(
              `/api/v1/cash/funds/${selectedFundId}/ledger/?company_id=${companyId}&date_from=${ledgerDateFrom}&date_to=${ledgerDateTo}`,
              { headers: h }
            );
            if (res.ok) {
              setLedgerData(await res.json());
            }
          }
        }
      } catch (e: any) {
        setNotice({ type: "error", text: "Lỗi tải dữ liệu: " + e.message });
      } finally {
        setLoading(false);
      }
    },
    [companyId, activeTab, getHeaders, selectedFundId, ledgerDateFrom, ledgerDateTo]
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
      const res = await fetch(`/api/v1/cash/${endpoint}/${id}/${action}/?company_id=${companyId}`, {
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
      const payload = { ...data, company: data.company || companyId };
      if (endpoint === "funds") {
        payload.branch = payload.branch || refs.branches[0]?.id;
        payload.currency = payload.currency || refs.currencies[0]?.id;
        payload.gl_account =
          payload.gl_account ||
          refs.accounts.find((a) => a.code?.startsWith("111"))?.id ||
          refs.accounts[0]?.id;
      } else if (endpoint === "transactions") {
        payload.fund = payload.fund || funds[0]?.id;
        const curFund = funds.find((f) => f.id === payload.fund) || funds[0];
        payload.currency = curFund?.currency_id || curFund?.currency || refs.currencies[0]?.id;
      } else if (endpoint === "transfers") {
        payload.source_fund = payload.source_fund || funds[0]?.id;
        payload.destination_fund = payload.destination_fund || funds[1]?.id || funds[0]?.id;
      } else if (endpoint === "advances") {
        payload.fund = payload.fund || funds[0]?.id;
        payload.recipient = payload.recipient || refs.employees[0]?.id;
      } else if (endpoint === "counts") {
        payload.fund = payload.fund || funds[0]?.id;
      } else if (endpoint === "revaluations") {
        payload.fund = payload.fund || funds[0]?.id;
      }

      const res = await fetch(`/api/v1/cash/${endpoint}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
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
    <div className="live-cash-root">
      {/* Top Header */}
      <header className="live-cash-header">
        <div className="live-cash-title-box">
          <Link to="/common" style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            ← Dùng chung
          </Link>
          <div className="live-cash-title">
            <span>Phân hệ Quản lý Tiền mặt (Cash Management)</span>
            <span className="live-cash-badge">UC-CASH-01 → UC-CASH-10</span>
          </div>
        </div>
        <div className="live-cash-company-info">
          <span>Doanh nghiệp:</span>
          <span className="live-cash-company-tag">{companyId ? `ID: ${companyId.slice(0, 8)}...` : "Chưa chọn"}</span>
          <Link to="/accounts-receivable" className="live-cash-btn live-cash-btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }}>
            Phải thu (AR)
          </Link>
          <Link to="/accounts-payable" className="live-cash-btn live-cash-btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }}>
            Phải trả (AP)
          </Link>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="live-cash-nav">
        {[
          { key: "funds", label: "Quỹ tiền mặt", tag: "CASH-01" },
          { key: "receipts", label: "Phiếu thu tiền mặt", tag: "CASH-02" },
          { key: "payments", label: "Phiếu chi tiền mặt", tag: "CASH-03" },
          { key: "ledger", label: "Sổ quỹ tiền mặt", tag: "CASH-04" },
          { key: "transfers", label: "Điều chuyển quỹ", tag: "CASH-05" },
          { key: "advances", label: "Tạm ứng tiền mặt", tag: "CASH-06" },
          { key: "settlements", label: "Quyết toán hoàn ứng", tag: "CASH-07" },
          { key: "counts", label: "Kiểm kê quỹ", tag: "CASH-08/09" },
          { key: "revaluations", label: "Đánh giá ngoại tệ", tag: "CASH-10" },
          { key: "approvals", label: "Lịch sử phê duyệt", tag: "LOG" },
        ].map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            className={`live-cash-nav-btn ${activeTab === t.key ? "active" : ""}`}
            onClick={() => {
              setActiveTab(t.key as TabKey);
              setNotice(null);
            }}
          >
            <span>{t.label}</span>
            <span className="live-cash-tag-pill">{t.tag}</span>
          </button>
        ))}
      </nav>

      {/* Notice Banner */}
      {notice && (
        <div className={`live-cash-notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button
            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer" }}
            onClick={() => setNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body */}
      <main className="live-cash-body">
        {/* TAB 1: FUNDS (UC-CASH-01) */}
        {activeTab === "funds" && (
          <div id="section-funds">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-01: Quản lý Quỹ tiền mặt (Cash Funds)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Thiết lập danh mục quỹ tiền mặt theo chi nhánh, tiền tệ, thủ quỹ và tài khoản hạch toán GL (1111, 1112)
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-fund"
                  disabled={!refsLoaded}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: refs.branches[0]?.id || "",
                      code: `Q_${Date.now().toString().slice(-4)}`,
                      name: "Quỹ tiền mặt chi nhánh",
                      currency: refs.currencies[0]?.id || "",
                      keeper: refs.employees[0]?.id || null,
                      gl_account: refs.accounts.find((a) => a.code?.startsWith("111"))?.id || refs.accounts[0]?.id || "",
                      balance: 0,
                      allow_negative: false,
                      status: "ACTIVE",
                    });
                    setModalType("create-fund");
                  }}
                >
                  + Thêm Quỹ tiền mặt
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Mã quỹ</th>
                    <th>Tên quỹ</th>
                    <th>Chi nhánh</th>
                    <th>Loại tiền</th>
                    <th>Thủ quỹ phụ trách</th>
                    <th>Tài khoản GL</th>
                    <th>Số dư hiện tại</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {funds.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có dữ liệu quỹ tiền mặt
                      </td>
                    </tr>
                  ) : (
                    funds.map((f) => (
                      <tr key={f.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{f.code}</td>
                        <td>{f.name}</td>
                        <td>{f.branch_name || f.branch?.name || f.branch}</td>
                        <td>{f.currency_code || f.currency?.code || f.currency}</td>
                        <td>{f.keeper_name || f.keeper?.full_name || "—"}</td>
                        <td>{f.gl_account_code || f.gl_account?.code || f.gl_account}</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>{formatMoney(f.balance)}</td>
                        <td>
                          <span className={`live-cash-badge-status ${f.status?.toLowerCase()}`}>{f.status}</span>
                        </td>
                        <td>
                          <button
                            className="live-cash-btn live-cash-btn-secondary"
                            style={{ padding: "3px 8px", fontSize: 11 }}
                            onClick={() => {
                              setSelectedFundId(f.id);
                              setActiveTab("ledger");
                            }}
                          >
                            Xem sổ quỹ
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RECEIPTS (UC-CASH-02) */}
        {activeTab === "receipts" && (
          <div id="section-receipts">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-02: Lập & Quản lý Phiếu thu tiền mặt (Cash Receipts)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Quản lý thu tiền khách hàng, hoàn tạm ứng, thu khác bằng tiền mặt; luồng duyệt và thủ quỹ xác nhận thu
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-receipt"
                  disabled={!refsLoaded || funds.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setFormData({
                      company: companyId,
                      fund: funds[0]?.id || "",
                      number: `PT-${Date.now().toString().slice(-6)}`,
                      transaction_type: "RECEIPT",
                      business_type: "OTHER",
                      transaction_date: todayStr,
                      payer_payee: "Khách hàng nộp tiền mặt",
                      party: refs.parties[0]?.id || null,
                      currency: refs.currencies[0]?.id || "",
                      amount: 500000,
                      exchange_rate: 1,
                      description: "Thu tiền bán hàng / thu khác bằng tiền mặt",
                    });
                    setModalType("create-receipt");
                  }}
                >
                  + Lập Phiếu thu
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số phiếu</th>
                    <th>Ngày thu</th>
                    <th>Quỹ nhận</th>
                    <th>Người nộp / Đối tượng</th>
                    <th>Số tiền</th>
                    <th>Diễn giải</th>
                    <th>Trạng thái duyệt</th>
                    <th>Hạch toán GL</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có phiếu thu tiền mặt
                      </td>
                    </tr>
                  ) : (
                    receipts.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{t.number}</td>
                        <td>{t.transaction_date}</td>
                        <td>{t.fund_code || t.fund?.code || t.fund}</td>
                        <td>{t.payer_payee}</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>{formatMoney(t.amount)}</td>
                        <td>{t.description}</td>
                        <td>
                          <span className={`live-cash-badge-status ${t.status?.toLowerCase()}`}>{t.status}</span>
                        </td>
                        <td>
                          <span className={`live-cash-badge-status ${t.gl_status?.toLowerCase()}`}>{t.gl_status}</span>
                        </td>
                        <td>
                          <div className="live-cash-btn-group">
                            {t.status === "DRAFT" && (
                              <button
                                className="live-cash-btn live-cash-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {t.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "approve", { comment: "Duyệt thu tiền" })}
                              >
                                Duyệt
                              </button>
                            )}
                            {t.status === "APPROVED" && (
                              <button
                                className="live-cash-btn live-cash-btn-success"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "confirm")}
                              >
                                Xác nhận thu quỹ
                              </button>
                            )}
                            {t.status === "POSTED" && t.gl_status !== "POSTED" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(t);
                                  setGlRefInput(`GL-${t.number}`);
                                  setModalType("post-gl");
                                }}
                              >
                                Hạch toán GL
                              </button>
                            )}
                            {t.status === "POSTED" && (
                              <button
                                className="live-cash-btn live-cash-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(t);
                                  setActionReason("Đảo phiếu thu tiền mặt do sai sót");
                                  setModalType("reverse-transaction");
                                }}
                              >
                                Đảo phiếu
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

        {/* TAB 3: PAYMENTS (UC-CASH-03) */}
        {activeTab === "payments" && (
          <div id="section-payments">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-03: Lập & Quản lý Phiếu chi tiền mặt (Cash Payments)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Chi thanh toán nhà cung cấp, chi tiếp khách, mua văn phòng phẩm và chi hoạt động khác bằng tiền mặt
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-payment"
                  disabled={!refsLoaded || funds.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setFormData({
                      company: companyId,
                      fund: funds[0]?.id || "",
                      number: `PC-${Date.now().toString().slice(-6)}`,
                      transaction_type: "PAYMENT",
                      business_type: "OTHER",
                      transaction_date: todayStr,
                      payer_payee: "Chi tiền tiếp khách / mua sắm",
                      party: refs.parties[0]?.id || null,
                      currency: refs.currencies[0]?.id || "",
                      amount: 300000,
                      exchange_rate: 1,
                      description: "Chi phí mua đồ văn phòng bằng tiền mặt",
                    });
                    setModalType("create-payment");
                  }}
                >
                  + Lập Phiếu chi
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số phiếu</th>
                    <th>Ngày chi</th>
                    <th>Quỹ xuất</th>
                    <th>Người nhận / Đối tượng</th>
                    <th>Số tiền</th>
                    <th>Diễn giải</th>
                    <th>Trạng thái duyệt</th>
                    <th>Hạch toán GL</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có phiếu chi tiền mặt
                      </td>
                    </tr>
                  ) : (
                    payments.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{t.number}</td>
                        <td>{t.transaction_date}</td>
                        <td>{t.fund_code || t.fund?.code || t.fund}</td>
                        <td>{t.payer_payee}</td>
                        <td style={{ fontWeight: 700, color: "#f87171" }}>{formatMoney(t.amount)}</td>
                        <td>{t.description}</td>
                        <td>
                          <span className={`live-cash-badge-status ${t.status?.toLowerCase()}`}>{t.status}</span>
                        </td>
                        <td>
                          <span className={`live-cash-badge-status ${t.gl_status?.toLowerCase()}`}>{t.gl_status}</span>
                        </td>
                        <td>
                          <div className="live-cash-btn-group">
                            {t.status === "DRAFT" && (
                              <button
                                className="live-cash-btn live-cash-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {t.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "approve", { comment: "Duyệt chi tiền" })}
                              >
                                Duyệt
                              </button>
                            )}
                            {t.status === "APPROVED" && (
                              <button
                                className="live-cash-btn live-cash-btn-success"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transactions", t.id, "confirm")}
                              >
                                Thủ quỹ chi tiền
                              </button>
                            )}
                            {t.status === "POSTED" && t.gl_status !== "POSTED" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(t);
                                  setGlRefInput(`GL-${t.number}`);
                                  setModalType("post-gl");
                                }}
                              >
                                Hạch toán GL
                              </button>
                            )}
                            {t.status === "POSTED" && (
                              <button
                                className="live-cash-btn live-cash-btn-danger"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(t);
                                  setActionReason("Đảo phiếu chi tiền mặt");
                                  setModalType("reverse-transaction");
                                }}
                              >
                                Đảo phiếu
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

        {/* TAB 4: LEDGER (UC-CASH-04) */}
        {activeTab === "ledger" && (
          <div id="section-ledger">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-04: Sổ quỹ tiền mặt & Sổ chi tiết tiền mặt (Cash / Fund Ledger)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Theo dõi biến động thu, chi, và số dư tồn quỹ tiền mặt theo thời gian thực
                </span>
              </div>
              <div className="live-cash-btn-group">
                <select
                  id="select-ledger-fund"
                  className="live-cash-select"
                  value={selectedFundId}
                  onChange={(e) => setSelectedFundId(e.target.value)}
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.code} - {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  className="live-cash-input"
                  value={ledgerDateFrom}
                  onChange={(e) => setLedgerDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  className="live-cash-input"
                  value={ledgerDateTo}
                  onChange={(e) => setLedgerDateTo(e.target.value)}
                />
                <button
                  id="btn-refresh-ledger"
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => loadTabData("ledger")}
                >
                  Xem Sổ quỹ
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="live-cash-kpi-grid">
              <div className="live-cash-kpi-card">
                <span className="live-cash-kpi-label">Tổng thu trong kỳ</span>
                <span className="live-cash-kpi-val" style={{ color: "#34d399" }}>
                  {formatMoney(ledgerData?.total_receipts)} {ledgerData?.currency || "VND"}
                </span>
              </div>
              <div className="live-cash-kpi-card">
                <span className="live-cash-kpi-label">Tổng chi trong kỳ</span>
                <span className="live-cash-kpi-val" style={{ color: "#f87171" }}>
                  {formatMoney(ledgerData?.total_payments)} {ledgerData?.currency || "VND"}
                </span>
              </div>
              <div className="live-cash-kpi-card">
                <span className="live-cash-kpi-label">Số dư tồn quỹ hiện tại</span>
                <span className="live-cash-kpi-val" style={{ color: "#38bdf8" }}>
                  {formatMoney(ledgerData?.current_balance)} {ledgerData?.currency || "VND"}
                </span>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày hạch toán</th>
                    <th>Loại phát sinh</th>
                    <th>Đối tượng giao dịch</th>
                    <th>Diễn giải</th>
                    <th>Thu tiền (+)</th>
                    <th>Chi tiền (-)</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {!ledgerData?.transactions || ledgerData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có phát sinh trong khoảng thời gian đã chọn
                      </td>
                    </tr>
                  ) : (
                    ledgerData.transactions.map((tx: any) => {
                      const isInc = ["RECEIPT", "ADVANCE_RETURN", "ADJUSTMENT_IN"].includes(tx.transaction_type);
                      return (
                        <tr key={tx.id}>
                          <td style={{ fontWeight: 700, color: "#38bdf8" }}>{tx.number}</td>
                          <td>{tx.transaction_date}</td>
                          <td>{tx.transaction_type}</td>
                          <td>{tx.payer_payee}</td>
                          <td>{tx.description}</td>
                          <td style={{ fontWeight: 700, color: "#34d399" }}>
                            {isInc ? formatMoney(tx.amount) : "—"}
                          </td>
                          <td style={{ fontWeight: 700, color: "#f87171" }}>
                            {!isInc ? formatMoney(tx.amount) : "—"}
                          </td>
                          <td>
                            <span className={`live-cash-badge-status ${tx.status?.toLowerCase()}`}>{tx.status}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: TRANSFERS (UC-CASH-05) */}
        {activeTab === "transfers" && (
          <div id="section-transfers">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-05: Chuyển tiền nội bộ & Điều chuyển quỹ (Cash Transfers)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Điều chuyển giữa các quỹ tiền mặt, nộp tiền mặt vào ngân hàng hoặc rút tiền gửi về nhập quỹ
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-transfer"
                  disabled={!refsLoaded || funds.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setFormData({
                      company: companyId,
                      number: `DC-${Date.now().toString().slice(-6)}`,
                      transfer_type: "FUND_TO_FUND",
                      source_fund: funds[0]?.id || "",
                      destination_fund: funds[1]?.id || funds[0]?.id || "",
                      bank_account: refs.bankAccounts[0]?.id || null,
                      transfer_date: todayStr,
                      amount: 200000,
                      exchange_rate: 1,
                      description: "Điều chuyển quỹ nội bộ",
                    });
                    setModalType("create-transfer");
                  }}
                >
                  + Lập Lệnh điều chuyển
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số lệnh</th>
                    <th>Ngày chuyển</th>
                    <th>Hình thức chuyển</th>
                    <th>Nguồn</th>
                    <th>Đích</th>
                    <th>Số tiền</th>
                    <th>Diễn giải</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có lệnh điều chuyển tiền mặt
                      </td>
                    </tr>
                  ) : (
                    transfers.map((tr) => (
                      <tr key={tr.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{tr.number}</td>
                        <td>{tr.transfer_date}</td>
                        <td>{tr.transfer_type}</td>
                        <td>{tr.source_fund_code || tr.source_fund?.code || tr.source_fund || "—"}</td>
                        <td>{tr.destination_fund_code || tr.destination_fund?.code || tr.bank_account || "—"}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(tr.amount)}</td>
                        <td>{tr.description}</td>
                        <td>
                          <span className={`live-cash-badge-status ${tr.status?.toLowerCase()}`}>{tr.status}</span>
                        </td>
                        <td>
                          <div className="live-cash-btn-group">
                            {tr.status === "DRAFT" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transfers", tr.id, "dispatch")}
                              >
                                Xuất quỹ chuyển
                              </button>
                            )}
                            {tr.status === "IN_TRANSIT" && (
                              <button
                                className="live-cash-btn live-cash-btn-success"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("transfers", tr.id, "receive")}
                              >
                                Xác nhận nhập quỹ
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

        {/* TAB 6: ADVANCES (UC-CASH-06) */}
        {activeTab === "advances" && (
          <div id="section-advances">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-06: Đề nghị & Lập phiếu tạm ứng tiền mặt (Cash Advances)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Tạm ứng tiền mặt cho cán bộ nhân viên đi công tác, mua hàng; theo dõi hoàn ứng và quyết toán
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-advance"
                  disabled={!refsLoaded || funds.length === 0 || refs.employees.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const today = new Date();
                    const due = new Date();
                    due.setDate(due.getDate() + 15);
                    setFormData({
                      company: companyId,
                      fund: funds[0]?.id || "",
                      number: `TU-${Date.now().toString().slice(-6)}`,
                      recipient: refs.employees[0]?.id || "",
                      purpose: "Tạm ứng công tác phí Hà Nội - TP.HCM",
                      request_date: today.toISOString().split("T")[0],
                      due_date: due.toISOString().split("T")[0],
                      amount: 500000,
                    });
                    setModalType("create-advance");
                  }}
                >
                  + Lập Giấy đề nghị tạm ứng
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số đề nghị</th>
                    <th>Ngày yêu cầu</th>
                    <th>Quỹ tạm ứng</th>
                    <th>Nhân viên nhận</th>
                    <th>Mục đích</th>
                    <th>Số tiền tạm ứng</th>
                    <th>Còn lại</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có đề nghị tạm ứng tiền mặt
                      </td>
                    </tr>
                  ) : (
                    advances.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{a.number}</td>
                        <td>{a.request_date}</td>
                        <td>{a.fund_code || a.fund?.code || a.fund}</td>
                        <td>{a.recipient_name || a.recipient?.full_name || a.recipient}</td>
                        <td>{a.purpose}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(a.amount)}</td>
                        <td style={{ fontWeight: 700, color: "#fbbf24" }}>{formatMoney(a.remaining_amount)}</td>
                        <td>
                          <span className={`live-cash-badge-status ${a.status?.toLowerCase()}`}>{a.status}</span>
                        </td>
                        <td>
                          <div className="live-cash-btn-group">
                            {a.status === "DRAFT" && (
                              <button
                                className="live-cash-btn live-cash-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("advances", a.id, "submit")}
                              >
                                Gửi duyệt
                              </button>
                            )}
                            {a.status === "PENDING_APPROVAL" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("advances", a.id, "approve")}
                              >
                                Duyệt
                              </button>
                            )}
                            {a.status === "APPROVED" && (
                              <button
                                className="live-cash-btn live-cash-btn-success"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("advances", a.id, "disburse")}
                              >
                                Chi tiền tạm ứng
                              </button>
                            )}
                            {(a.status === "ACTIVE" || a.status === "PARTIAL") && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => {
                                  setSelectedItem(a);
                                  const rem = Number(a.remaining_amount || a.amount);
                                  setFormData({
                                    settlement_date: new Date().toISOString().split("T")[0],
                                    accepted_expense: Math.min(rem, 400000),
                                    returned_cash: Math.max(0, rem - 400000),
                                    additional_cash: 0,
                                    note: "Quyết toán hoàn ứng chi phí công tác",
                                  });
                                  setModalType("settle-advance");
                                }}
                              >
                                Quyết toán / Hoàn ứng
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

        {/* TAB 7: SETTLEMENTS (UC-CASH-07) */}
        {activeTab === "settlements" && (
          <div id="section-settlements">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-07: Lịch sử Quyết toán & Hoàn ứng tạm ứng (Advance Settlements)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Bảng kê chi phí được chấp nhận duyệt, tiền mặt hoàn trả lại quỹ và phần chi vượt bổ sung
                </span>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Ngày quyết toán</th>
                    <th>Khoản tạm ứng</th>
                    <th>Chi phí hợp lệ</th>
                    <th>Tiền nộp lại quỹ</th>
                    <th>Chi vượt bổ sung</th>
                    <th>Ghi chú</th>
                    <th>Người lập</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có lịch sử quyết toán hoàn ứng
                      </td>
                    </tr>
                  ) : (
                    settlements.map((s) => (
                      <tr key={s.id}>
                        <td>{s.settlement_date}</td>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{s.advance_number || s.advance}</td>
                        <td style={{ fontWeight: 700, color: "#34d399" }}>{formatMoney(s.accepted_expense)}</td>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{formatMoney(s.returned_cash)}</td>
                        <td style={{ fontWeight: 700, color: "#f87171" }}>{formatMoney(s.additional_cash)}</td>
                        <td>{s.note}</td>
                        <td>{s.created_by_name || s.created_by}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: COUNTS (UC-CASH-08 & UC-CASH-09) */}
        {activeTab === "counts" && (
          <div id="section-counts">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-08 & 09: Kiểm kê quỹ tiền mặt & Xử lý chênh lệch (Cash Counts & Adjustments)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Biên bản kiểm kê định kỳ/đột xuất; đối chiếu số dư thực tế vs sổ sách và tự động sinh phiếu điều chỉnh
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-count"
                  disabled={!refsLoaded || funds.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const fund = funds[0];
                    const curBal = fund ? Number(fund.balance) : 0;
                    setFormData({
                      company: companyId,
                      fund: fund?.id || "",
                      number: `KK-${Date.now().toString().slice(-6)}`,
                      counted_at: new Date().toISOString(),
                      actual_balance: curBal + 10000,
                      reason: "Thừa tiền mặt kiểm kê định kỳ",
                      conclusion: "Đề nghị ghi nhận tăng thu khác",
                    });
                    setModalType("create-count");
                  }}
                >
                  + Lập Biên bản kiểm kê
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Số biên bản</th>
                    <th>Thời điểm kiểm kê</th>
                    <th>Quỹ kiểm kê</th>
                    <th>Số dư sổ sách</th>
                    <th>Thực tế kiểm kê</th>
                    <th>Chênh lệch</th>
                    <th>Nguyên nhân & Kết luận</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có biên bản kiểm kê quỹ
                      </td>
                    </tr>
                  ) : (
                    counts.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{c.number}</td>
                        <td>{c.counted_at?.replace("T", " ").slice(0, 19)}</td>
                        <td>{c.fund_code || c.fund?.code || c.fund}</td>
                        <td>{formatMoney(c.book_balance)}</td>
                        <td style={{ fontWeight: 700, color: "#f8fafc" }}>{formatMoney(c.actual_balance)}</td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: Number(c.difference) > 0 ? "#34d399" : Number(c.difference) < 0 ? "#f87171" : "#cbd5e1",
                          }}
                        >
                          {Number(c.difference) > 0 ? `+${formatMoney(c.difference)}` : formatMoney(c.difference)}
                        </td>
                        <td>
                          {c.reason && <div>{c.reason}</div>}
                          {c.conclusion && <small style={{ color: "#94a3b8" }}>{c.conclusion}</small>}
                        </td>
                        <td>
                          <span className={`live-cash-badge-status ${c.status?.toLowerCase()}`}>{c.status}</span>
                        </td>
                        <td>
                          <div className="live-cash-btn-group">
                            {c.status === "DRAFT" && (
                              <button
                                className="live-cash-btn live-cash-btn-primary"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("counts", c.id, "confirm")}
                              >
                                Xác nhận kiểm kê
                              </button>
                            )}
                            {c.status === "CONFIRMED" && Number(c.difference) !== 0 && (
                              <button
                                className="live-cash-btn live-cash-btn-success"
                                style={{ padding: "3px 8px", fontSize: 11 }}
                                onClick={() => handleItemAction("counts", c.id, "adjust")}
                              >
                                Xử lý chênh lệch
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

        {/* TAB 9: REVALUATIONS (UC-CASH-10) */}
        {activeTab === "revaluations" && (
          <div id="section-revaluations">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  UC-CASH-10: Đánh giá lại ngoại tệ quỹ tiền mặt cuối kỳ (Fx Revaluations)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Tự động tính chênh lệch tỷ giá theo số dư ngoại tệ tồn quỹ và kết chuyển hạch toán Sổ cái
                </span>
              </div>
              <div className="live-cash-btn-group">
                <button
                  id="btn-create-revaluation"
                  disabled={!refsLoaded || funds.length === 0}
                  className="live-cash-btn live-cash-btn-primary"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    setFormData({
                      company: companyId,
                      fund: funds[0]?.id || "",
                      revaluation_date: todayStr,
                      old_rate: 24500,
                      new_rate: 25000,
                      gl_reference: `FX-${Date.now().toString().slice(-4)}`,
                    });
                    setModalType("create-revaluation");
                  }}
                >
                  + Đánh giá lại ngoại tệ
                </button>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Ngày đánh giá</th>
                    <th>Quỹ ngoại tệ</th>
                    <th>Tỷ giá cũ</th>
                    <th>Tỷ giá mới</th>
                    <th>Số dư ngoại tệ</th>
                    <th>Chênh lệch tỷ giá</th>
                    <th>Bút toán GL</th>
                  </tr>
                </thead>
                <tbody>
                  {revaluations.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có lịch sử đánh giá lại ngoại tệ quỹ
                      </td>
                    </tr>
                  ) : (
                    revaluations.map((r) => (
                      <tr key={r.id}>
                        <td>{r.revaluation_date}</td>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{r.fund_code || r.fund}</td>
                        <td>{formatMoney(r.old_rate)}</td>
                        <td>{formatMoney(r.new_rate)}</td>
                        <td>{formatMoney(r.foreign_balance)}</td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: Number(r.difference) >= 0 ? "#34d399" : "#f87171",
                          }}
                        >
                          {formatMoney(r.difference)}
                        </td>
                        <td>{r.gl_reference || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 10: APPROVALS */}
        {activeTab === "approvals" && (
          <div id="section-approvals">
            <div className="live-cash-controls">
              <div>
                <h2 style={{ fontSize: 16, margin: "0 0 4px 0", color: "#f8fafc" }}>
                  Lịch sử Phê duyệt Nghiệp vụ Tiền mặt (Cash Approvals Log)
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Nhật ký chi tiết các quyết định phê duyệt/từ chối từ cấp quản lý
                </span>
              </div>
            </div>

            <div className="live-cash-table-card">
              <table className="live-cash-table">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Mã giao dịch</th>
                    <th>Cấp duyệt</th>
                    <th>Quyết định</th>
                    <th>Người duyệt</th>
                    <th>Ý kiến / Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        Chưa có nhật ký phê duyệt
                      </td>
                    </tr>
                  ) : (
                    approvals.map((ap) => (
                      <tr key={ap.id}>
                        <td>{ap.decided_at?.replace("T", " ").slice(0, 19)}</td>
                        <td style={{ fontWeight: 700, color: "#38bdf8" }}>{ap.transaction_number || ap.transaction}</td>
                        <td>Cấp {ap.level}</td>
                        <td>
                          <span
                            className={`live-cash-badge-status ${
                              ap.decision === "APPROVED" ? "posted" : ap.decision === "REJECTED" ? "rejected" : "draft"
                            }`}
                          >
                            {ap.decision}
                          </span>
                        </td>
                        <td>{ap.actor_name || ap.actor}</td>
                        <td>{ap.comment || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: CREATE FUND */}
      {modalType === "create-fund" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Tạo mới Quỹ tiền mặt (UC-CASH-01)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Mã quỹ *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.code || ""}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Chi nhánh *</label>
                  <select
                    className="live-cash-select"
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
              <div className="live-cash-form-group">
                <label>Tên quỹ *</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Loại tiền *</label>
                  <select
                    className="live-cash-select"
                    value={formData.currency || ""}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    {refs.currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-cash-form-group">
                  <label>Thủ quỹ phụ trách</label>
                  <select
                    className="live-cash-select"
                    value={formData.keeper || ""}
                    onChange={(e) => setFormData({ ...formData, keeper: e.target.value || null })}
                  >
                    <option value="">-- Chưa chỉ định --</option>
                    {refs.employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_code} - {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Tài khoản kế toán GL *</label>
                <select
                  className="live-cash-select"
                  value={formData.gl_account || ""}
                  onChange={(e) => setFormData({ ...formData, gl_account: e.target.value })}
                >
                  {refs.accounts
                    .filter((a) => a.code?.startsWith("111"))
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-fund"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("funds", formData)}
              >
                Lưu Quỹ tiền mặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE RECEIPT */}
      {modalType === "create-receipt" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Lập Phiếu thu tiền mặt (UC-CASH-02)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số phiếu thu *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Quỹ thu tiền *</label>
                  <select
                    className="live-cash-select"
                    value={formData.fund || ""}
                    onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Ngày thu tiền *</label>
                  <input
                    type="date"
                    className="live-cash-input"
                    value={formData.transaction_date || ""}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Số tiền thu *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.amount || 0}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Người nộp tiền *</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.payer_payee || ""}
                  onChange={(e) => setFormData({ ...formData, payer_payee: e.target.value })}
                />
              </div>
              <div className="live-cash-form-group">
                <label>Lý do / Diễn giải thu tiền *</label>
                <textarea
                  className="live-cash-textarea"
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-receipt"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("transactions", formData)}
              >
                Lưu Phiếu thu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PAYMENT */}
      {modalType === "create-payment" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Lập Phiếu chi tiền mặt (UC-CASH-03)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số phiếu chi *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Quỹ xuất tiền *</label>
                  <select
                    className="live-cash-select"
                    value={formData.fund || ""}
                    onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Ngày chi tiền *</label>
                  <input
                    type="date"
                    className="live-cash-input"
                    value={formData.transaction_date || ""}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Số tiền chi *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.amount || 0}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Người nhận tiền *</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.payer_payee || ""}
                  onChange={(e) => setFormData({ ...formData, payer_payee: e.target.value })}
                />
              </div>
              <div className="live-cash-form-group">
                <label>Lý do / Diễn giải chi tiền *</label>
                <textarea
                  className="live-cash-textarea"
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-payment"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("transactions", formData)}
              >
                Lưu Phiếu chi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE TRANSFER */}
      {modalType === "create-transfer" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Lập Lệnh điều chuyển quỹ (UC-CASH-05)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số lệnh *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Hình thức điều chuyển *</label>
                  <select
                    className="live-cash-select"
                    value={formData.transfer_type || "FUND_TO_FUND"}
                    onChange={(e) => setFormData({ ...formData, transfer_type: e.target.value })}
                  >
                    <option value="FUND_TO_FUND">Giữa các quỹ tiền mặt</option>
                    <option value="CASH_TO_BANK">Nộp tiền mặt vào ngân hàng</option>
                    <option value="BANK_TO_CASH">Rút tiền gửi về nhập quỹ</option>
                  </select>
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Quỹ nguồn (nếu có)</label>
                  <select
                    className="live-cash-select"
                    value={formData.source_fund || ""}
                    onChange={(e) => setFormData({ ...formData, source_fund: e.target.value || null })}
                  >
                    <option value="">-- Không --</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-cash-form-group">
                  <label>Quỹ đích (nếu có)</label>
                  <select
                    className="live-cash-select"
                    value={formData.destination_fund || ""}
                    onChange={(e) => setFormData({ ...formData, destination_fund: e.target.value || null })}
                  >
                    <option value="">-- Không --</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số tiền chuyển *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.amount || 0}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Ngày điều chuyển *</label>
                  <input
                    type="date"
                    className="live-cash-input"
                    value={formData.transfer_date || ""}
                    onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Diễn giải *</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-transfer"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("transfers", formData)}
              >
                Lưu Lệnh điều chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ADVANCE */}
      {modalType === "create-advance" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Lập Giấy đề nghị tạm ứng (UC-CASH-06)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số đề nghị *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Quỹ xuất tạm ứng *</label>
                  <select
                    className="live-cash-select"
                    value={formData.fund || ""}
                    onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Nhân viên tạm ứng *</label>
                  <select
                    className="live-cash-select"
                    value={formData.recipient || ""}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                  >
                    {refs.employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employee_code} - {emp.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-cash-form-group">
                  <label>Số tiền tạm ứng *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.amount || 0}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Mục đích tạm ứng *</label>
                <textarea
                  className="live-cash-textarea"
                  rows={2}
                  value={formData.purpose || ""}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-advance"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("advances", formData)}
              >
                Lưu Đề nghị tạm ứng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SETTLE ADVANCE */}
      {modalType === "settle-advance" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Quyết toán / Hoàn ứng tạm ứng (UC-CASH-07)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div style={{ padding: "8px 12px", background: "#1e293b", borderRadius: 6, fontSize: 13 }}>
                Đề nghị: <b>{selectedItem?.number}</b> | Số tiền còn lại: <b>{formatMoney(selectedItem?.remaining_amount)}</b>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Chi phí hợp lý chấp nhận duyệt *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.accepted_expense || 0}
                    onChange={(e) => setFormData({ ...formData, accepted_expense: Number(e.target.value) })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Tiền mặt nộp lại quỹ</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.returned_cash || 0}
                    onChange={(e) => setFormData({ ...formData, returned_cash: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Ghi chú quyết toán</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.note || ""}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-settle"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleItemAction("advances", selectedItem.id, "settle", formData)}
              >
                Xác nhận Quyết toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE COUNT */}
      {modalType === "create-count" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Lập Biên bản kiểm kê quỹ (UC-CASH-08)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Số biên bản *</label>
                  <input
                    type="text"
                    className="live-cash-input"
                    value={formData.number || ""}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Quỹ kiểm kê *</label>
                  <select
                    className="live-cash-select"
                    value={formData.fund || ""}
                    onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name} (Sổ: {formatMoney(f.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Số tiền thực tế kiểm kê được *</label>
                <input
                  type="number"
                  className="live-cash-input"
                  value={formData.actual_balance || 0}
                  onChange={(e) => setFormData({ ...formData, actual_balance: Number(e.target.value) })}
                />
              </div>
              <div className="live-cash-form-group">
                <label>Nguyên nhân chênh lệch (nếu có)</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.reason || ""}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
              <div className="live-cash-form-group">
                <label>Kết luận xử lý</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.conclusion || ""}
                  onChange={(e) => setFormData({ ...formData, conclusion: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-count"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("counts", formData)}
              >
                Lưu Biên bản kiểm kê
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE REVALUATION */}
      {modalType === "create-revaluation" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal">
            <div className="live-cash-modal-header">
              <span>Đánh giá lại ngoại tệ quỹ tiền mặt (UC-CASH-10)</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Quỹ ngoại tệ *</label>
                  <select
                    className="live-cash-select"
                    value={formData.fund || ""}
                    onChange={(e) => setFormData({ ...formData, fund: e.target.value })}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.code} - {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-cash-form-group">
                  <label>Ngày đánh giá *</label>
                  <input
                    type="date"
                    className="live-cash-input"
                    value={formData.revaluation_date || ""}
                    onChange={(e) => setFormData({ ...formData, revaluation_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-cash-form-row">
                <div className="live-cash-form-group">
                  <label>Tỷ giá ghi sổ cũ *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.old_rate || 0}
                    onChange={(e) => setFormData({ ...formData, old_rate: Number(e.target.value) })}
                  />
                </div>
                <div className="live-cash-form-group">
                  <label>Tỷ giá đánh giá mới *</label>
                  <input
                    type="number"
                    className="live-cash-input"
                    value={formData.new_rate || 0}
                    onChange={(e) => setFormData({ ...formData, new_rate: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="live-cash-form-group">
                <label>Mã tham chiếu GL</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={formData.gl_reference || ""}
                  onChange={(e) => setFormData({ ...formData, gl_reference: e.target.value })}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                id="btn-submit-revaluation"
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleCreateSubmit("revaluations", formData)}
              >
                Xác nhận Đánh giá lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POST GL */}
      {modalType === "post-gl" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal" style={{ maxWidth: 440 }}>
            <div className="live-cash-modal-header">
              <span>Hạch toán Sổ cái GL</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-group">
                <label>Mã bút toán GL *</label>
                <input
                  type="text"
                  className="live-cash-input"
                  value={glRefInput}
                  onChange={(e) => setGlRefInput(e.target.value)}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-cash-btn live-cash-btn-primary"
                onClick={() => handleItemAction("transactions", selectedItem.id, "post_gl", { gl_reference: glRefInput })}
              >
                Xác nhận Hạch toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REVERSE TRANSACTION */}
      {modalType === "reverse-transaction" && (
        <div className="live-cash-modal-backdrop">
          <div className="live-cash-modal" style={{ maxWidth: 460 }}>
            <div className="live-cash-modal-header">
              <span>Đảo phiếu tiền mặt</span>
              <button
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="live-cash-modal-body">
              <div className="live-cash-form-group">
                <label>Lý do đảo phiếu *</label>
                <textarea
                  className="live-cash-textarea"
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="live-cash-modal-footer">
              <button className="live-cash-btn live-cash-btn-secondary" onClick={() => setModalType(null)}>
                Hủy
              </button>
              <button
                className="live-cash-btn live-cash-btn-danger"
                onClick={() => handleItemAction("transactions", selectedItem.id, "reverse", { reason: actionReason })}
              >
                Xác nhận Đảo phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
