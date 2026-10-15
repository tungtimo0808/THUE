import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-bank.css";

type TabKey =
  | "accounts"
  | "receipts"
  | "payments"
  | "transfers"
  | "statements"
  | "reconciliations"
  | "ledger"
  | "integrations"
  | "revaluations"
  | "approvals";

interface ReferenceData {
  masterBankAccounts: any[];
  currencies: any[];
  parties: any[];
  glAccounts: any[];
  bankProfiles: any[];
}

export default function LiveBank() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("accounts");
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
    masterBankAccounts: [],
    currencies: [],
    parties: [],
    glAccounts: [],
    bankProfiles: [],
  });

  // Tab Data States
  const [accounts, setAccounts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [revaluations, setRevaluations] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Sổ phụ ngân hàng (Ledger) state
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [ledgerData, setLedgerData] = useState<any>(null);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");

  // Fetch Master Data
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [baRes, curRes, partyRes, profRes] = await Promise.all([
        fetch(`/api/v1/master-data/company-bank-accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/bank/accounts/?company_id=${companyId}`, { headers: h }),
      ]);

      const baData = baRes.ok ? await baRes.json() : [];
      const curData = curRes.ok ? await curRes.json() : [];
      const partyData = partyRes.ok ? await partyRes.json() : [];
      const profData = profRes.ok ? await profRes.json() : [];

      const masterBankAccounts = Array.isArray(baData) ? baData : baData.results || [];
      const currencies = Array.isArray(curData) ? curData : curData.results || [];
      const parties = Array.isArray(partyData) ? partyData : partyData.results || [];
      const bankProfiles = Array.isArray(profData) ? profData : profData.results || [];

      setRefs({
        masterBankAccounts,
        currencies,
        parties,
        glAccounts: [],
        bankProfiles,
      });
      setAccounts(bankProfiles);
      if (bankProfiles.length > 0 && !selectedProfileId) {
        setSelectedProfileId(bankProfiles[0].id);
      }
      setRefsLoaded(true);
    } catch (e: any) {
      console.error("fetchRefs error", e);
    }
  }, [companyId, getHeaders, selectedProfileId]);

  // Tab Loaders
  const loadTabData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const h = getHeaders();

    try {
      if (activeTab === "accounts") {
        const res = await fetch(`/api/v1/bank/accounts/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          const items = Array.isArray(d) ? d : d.results || [];
          setAccounts(items);
          setRefs((prev) => ({ ...prev, bankProfiles: items }));
          if (items.length > 0 && !selectedProfileId) {
            setSelectedProfileId(items[0].id);
          }
        }
      } else if (activeTab === "receipts") {
        const res = await fetch(`/api/v1/bank/transactions/?company_id=${companyId}&transaction_type=RECEIPT`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setReceipts(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "payments") {
        const res = await fetch(`/api/v1/bank/transactions/?company_id=${companyId}&transaction_type=PAYMENT`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPayments(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "transfers") {
        const res = await fetch(`/api/v1/bank/transfers/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setTransfers(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "statements") {
        const res = await fetch(`/api/v1/bank/statements/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setStatements(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "reconciliations") {
        const [recRes, txRes, stmtRes] = await Promise.all([
          fetch(`/api/v1/bank/reconciliations/?company_id=${companyId}`, { headers: h }),
          fetch(`/api/v1/bank/transactions/?company_id=${companyId}`, { headers: h }),
          fetch(`/api/v1/bank/statements/?company_id=${companyId}`, { headers: h }),
        ]);
        if (recRes.ok) {
          const d = await recRes.json();
          setReconciliations(Array.isArray(d) ? d : d.results || []);
        }
        if (txRes.ok) {
          const td = await txRes.json();
          const txs = Array.isArray(td) ? td : td.results || [];
          setReceipts(txs.filter((t: any) => t.transaction_type === "RECEIPT"));
          setPayments(txs.filter((t: any) => t.transaction_type === "PAYMENT"));
        }
        if (stmtRes.ok) {
          const sd = await stmtRes.json();
          setStatements(Array.isArray(sd) ? sd : sd.results || []);
        }
      } else if (activeTab === "ledger") {
        if (selectedProfileId) {
          const res = await fetch(`/api/v1/bank/accounts/${selectedProfileId}/ledger/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const d = await res.json();
            setLedgerData(d);
          }
        }
      } else if (activeTab === "integrations") {
        const res = await fetch(`/api/v1/bank/integrations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setIntegrations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "revaluations") {
        const res = await fetch(`/api/v1/bank/revaluations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setRevaluations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "approvals") {
        const res = await fetch(`/api/v1/bank/approvals/?company_id=${companyId}`, { headers: h });
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
  }, [companyId, activeTab, selectedProfileId, getHeaders]);

  useEffect(() => {
    if (companyId && token) {
      if (!refsLoaded) {
        fetchRefs();
      }
      loadTabData();
    }
  }, [companyId, token, activeTab, selectedProfileId, fetchRefs, loadTabData, refsLoaded]);

  // Handlers for Transactions
  const handleTxAction = async (id: string, actionName: string, payload: any = {}) => {
    try {
      const h = getHeaders();
      const url = `/api/v1/bank/transactions/${id}/${actionName}/?company_id=${companyId}`;
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
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Handlers for Transfers
  const handleTransferConfirm = async (id: string) => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/bank/transfers/${id}/confirm/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Xác nhận chuyển khoản thất bại");
      }
      setNotice({ type: "success", text: "Xác nhận lệnh chuyển tiền thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Handlers for Integration Result
  const handleIntegrationResult = async (id: string, status: "SUCCESS" | "FAILED") => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/bank/integrations/${id}/result/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          status,
          reference_code: `GW-${Date.now()}`,
          response_payload: { message: "Simulated gateway webhook callback" },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Cập nhật kết quả tích hợp thất bại");
      }
      setNotice({ type: "success", text: `Đã ghi nhận kết quả ${status} từ ngân hàng điện tử!` });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Create Profile Handler
  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        company: companyId,
        account: formData.account,
        is_primary: formData.is_primary || false,
        allow_overdraft: formData.allow_overdraft || false,
        overdraft_limit: formData.overdraft_limit || "0",
        notes: formData.notes || "",
      };

      const res = await fetch("/api/v1/bank/accounts/", {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo hồ sơ tài khoản ngân hàng thành công!" });
      setModalType(null);
      fetchRefs();
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo hồ sơ TK: " + e.message });
    }
  };

  // Create Transaction Handler (Receipt/Payment)
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const selectedAcc = refs.bankProfiles.find((p) => p.id === formData.account) || accounts.find((p) => p.id === formData.account);
      const defaultVnd = refs.currencies.find((c) => c.code === "VND")?.id || "ab59b5b1-8534-4408-99eb-c36914d42d1b";
      const curId = selectedAcc?.currency_id || selectedAcc?.account?.currency?.id || selectedAcc?.account?.currency || defaultVnd;
      const targetAccId = formData.account || selectedAcc?.id || refs.bankProfiles[0]?.id || accounts[0]?.id;

      const payload: any = {
        company: companyId,
        account: targetAccId,
        number: formData.number || `${formData.transaction_type === "RECEIPT" ? "BC" : "UNC"}-${Date.now().toString().slice(-6)}`,
        business_type: formData.business_type || (formData.transaction_type === "RECEIPT" ? "THU_TIEN_KHACH_HANG" : "CHI_TIEN_NCC"),
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date,
        amount: formData.amount,
        currency: curId,
        exchange_rate: formData.exchange_rate || "1.00",
        party: formData.party || null,
        counterparty_name: formData.counterparty_name || "Đối tác giao dịch ngân hàng",
        counterparty_account: formData.counterparty_account || "",
        counterparty_bank: formData.counterparty_bank || "",
        bank_reference: formData.bank_reference || "",
        description: formData.description || "Giao dịch ngân hàng",
      };

      const res = await fetch("/api/v1/bank/transactions/", {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: `Lập giao dịch ${formData.transaction_type} thành công!` });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi lập giao dịch: " + e.message });
    }
  };

  // Create Bank Transfer Handler
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const amt = Number(formData.amount) || 0;
      const rate = Number(formData.exchange_rate || 1);
      const payload = {
        company: companyId,
        number: formData.number || `TRF-${Date.now().toString().slice(-6)}`,
        source_account: formData.source_account,
        destination_account: formData.destination_account,
        transfer_date: formData.transfer_date,
        source_amount: amt.toFixed(4),
        destination_amount: (amt * rate).toFixed(4),
        exchange_rate: rate.toFixed(4),
        description: formData.description || "Điều chuyển vốn nội bộ ngân hàng",
      };

      const res = await fetch("/api/v1/bank/transfers/", {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Lập lệnh chuyển tiền ngân hàng thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi chuyển tiền: " + e.message });
    }
  };

  // Create Statement Import Handler
  const handleCreateStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const acc = refs.bankProfiles.find((p) => p.id === formData.account);
      const curId = acc?.account?.currency?.id || acc?.account?.currency || refs.currencies[0]?.id;

      const payload = {
        company: companyId,
        account: formData.account,
        source: "MANUAL",
        source_reference: formData.source_reference,
        period_from: formData.period_from,
        period_to: formData.period_to,
        lines: [
          {
            external_id: `EXT-${Date.now().toString().slice(-6)}`,
            transaction_date: formData.period_from,
            direction: "CREDIT",
            amount: formData.line_amount,
            currency: curId,
            reference: formData.line_ref || "LINE-001",
            description: formData.line_desc || "Giao dịch sao kê điện tử",
            counterparty: formData.line_party_name || "Đối tác chuyển khoản",
          },
        ],
      };

      const res = await fetch("/api/v1/bank/statements/", {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Nhập sao kê ngân hàng thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi nhập sao kê: " + e.message });
    }
  };

  // Reconcile Match Handler
  const handleMatchReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const payload = {
        statement_line: formData.statement_line,
        transaction: formData.transaction,
        matched_amount: formData.matched_amount,
        note: formData.note || "Khớp tự động / đối chiếu ngân hàng",
      };

      const res = await fetch(`/api/v1/bank/reconciliations/match/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Thực hiện đối chiếu khớp thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi đối chiếu: " + e.message });
    }
  };

  // FX Revaluation Handler
  const handleCreateFx = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const usdAcc = refs.bankProfiles.find((p) => p.currency_code === "USD" || p.account_number?.includes("USD")) || accounts.find((p) => p.currency_code === "USD" || p.account_number?.includes("USD"));
      const targetAccId = formData.account || usdAcc?.id || refs.bankProfiles[0]?.id || accounts[0]?.id;
      const payload = {
        company: companyId,
        account: targetAccId,
        revaluation_date: formData.revaluation_date,
        old_rate: formData.old_rate || "25000.00",
        new_rate: formData.new_rate || formData.current_rate || "25450.00",
        gl_reference: `FX-${Date.now().toString().slice(-6)}`,
      };

      const res = await fetch("/api/v1/bank/revaluations/", {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Thực hiện đánh giá lại ngoại tệ thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi đánh giá ngoại tệ: " + e.message });
    }
  };

  // Helper format currency
  const formatMoney = (val: any) => {
    const num = Number(val) || 0;
    return num.toLocaleString("vi-VN");
  };

  // Get active statement lines for reconciliation matching
  const allStatementLines = statements.flatMap((s: any) =>
    (s.lines || []).map((l: any) => ({
      ...l,
      statement_source: s.source_reference,
    }))
  );

  return (
    <div className="live-bank-root">
      {/* Top Header */}
      <header className="live-bank-header">
        <div className="live-bank-title-box">
          <div className="live-bank-title">
            <span>🏛️</span>
            <span>Tiền Gửi Ngân Hàng (Live Bank Management)</span>
            <span className="live-bank-badge">UC-BANK-01 → UC-BANK-08</span>
          </div>
          <div className="live-bank-company-info">
            <span>Doanh nghiệp:</span>
            <span className="live-bank-company-tag">{companyId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="live-bank-btn-group">
          <Link to="/cash" className="live-bank-btn live-bank-btn-secondary">
            💵 Tiền mặt
          </Link>
          <Link to="/purchases" className="live-bank-btn live-bank-btn-secondary">
            🛒 Mua hàng
          </Link>
          <Link to="/sales" className="live-bank-btn live-bank-btn-secondary">
            📦 Bán hàng
          </Link>
          <Link to="/system" className="live-bank-btn live-bank-btn-secondary">
            ⚙️ Quản trị HT
          </Link>
          <button onClick={() => { fetchRefs(); loadTabData(); }} className="live-bank-btn live-bank-btn-primary">
            🔄 Làm mới
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="live-bank-nav">
        <button
          className={`live-bank-nav-btn ${activeTab === "accounts" ? "active" : ""}`}
          onClick={() => setActiveTab("accounts")}
        >
          🏦 Hồ sơ TK Ngân hàng <span className="live-bank-tag-pill">{accounts.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "receipts" ? "active" : ""}`}
          onClick={() => setActiveTab("receipts")}
        >
          📥 Báo Có (Thu tiền gửi) <span className="live-bank-tag-pill">{receipts.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "payments" ? "active" : ""}`}
          onClick={() => setActiveTab("payments")}
        >
          📤 Báo Nợ / UNC (Chi tiền gửi) <span className="live-bank-tag-pill">{payments.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "transfers" ? "active" : ""}`}
          onClick={() => setActiveTab("transfers")}
        >
          ↔️ Chuyển tiền nội bộ <span className="live-bank-tag-pill">{transfers.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "statements" ? "active" : ""}`}
          onClick={() => setActiveTab("statements")}
        >
          📑 Sao kê điện tử <span className="live-bank-tag-pill">{statements.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "reconciliations" ? "active" : ""}`}
          onClick={() => setActiveTab("reconciliations")}
        >
          ⚖️ Đối chiếu ngân hàng <span className="live-bank-tag-pill">{reconciliations.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "ledger" ? "active" : ""}`}
          onClick={() => setActiveTab("ledger")}
        >
          📖 Sổ phụ ngân hàng
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "integrations" ? "active" : ""}`}
          onClick={() => setActiveTab("integrations")}
        >
          🌐 Ngân hàng điện tử <span className="live-bank-tag-pill">{integrations.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "revaluations" ? "active" : ""}`}
          onClick={() => setActiveTab("revaluations")}
        >
          💱 Đánh giá ngoại tệ <span className="live-bank-tag-pill">{revaluations.length}</span>
        </button>
        <button
          className={`live-bank-nav-btn ${activeTab === "approvals" ? "active" : ""}`}
          onClick={() => setActiveTab("approvals")}
        >
          ✅ Nhật ký phê duyệt <span className="live-bank-tag-pill">{approvals.length}</span>
        </button>
      </nav>

      {/* Notice Banner */}
      {notice && (
        <div className={`live-bank-notice ${notice.type}`}>
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
      <main className="live-bank-body">
        {/* KPI Summary Cards */}
        <div className="live-bank-kpi-grid">
          <div className="live-bank-kpi-card">
            <span className="live-bank-kpi-label">Hồ sơ TK ngân hàng</span>
            <span className="live-bank-kpi-val">{accounts.length}</span>
          </div>
          <div className="live-bank-kpi-card">
            <span className="live-bank-kpi-label">Giao dịch Báo Có</span>
            <span className="live-bank-kpi-val" style={{ color: "#34d399" }}>
              {receipts.length}
            </span>
          </div>
          <div className="live-bank-kpi-card">
            <span className="live-bank-kpi-label">Giao dịch Báo Nợ / UNC</span>
            <span className="live-bank-kpi-val" style={{ color: "#38bdf8" }}>
              {payments.length}
            </span>
          </div>
          <div className="live-bank-kpi-card">
            <span className="live-bank-kpi-label">Lệnh chuyển khoản</span>
            <span className="live-bank-kpi-val" style={{ color: "#fbbf24" }}>
              {transfers.length}
            </span>
          </div>
        </div>

        {/* Action Controls Header */}
        <div className="live-bank-controls">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {activeTab === "accounts" && "Hồ Sơ Tài Khoản Ngân Hàng (UC-BANK-01)"}
              {activeTab === "receipts" && "Báo Có / Thu Tiền Gửi Ngân Hàng (UC-BANK-02)"}
              {activeTab === "payments" && "Báo Nợ / Ủy Nhiệm Chi (UC-BANK-03)"}
              {activeTab === "transfers" && "Lệnh Chuyển Tiền Nội Bộ Ngân Hàng (UC-BANK-04)"}
              {activeTab === "statements" && "Sao Kê Điện Tử Ngân Hàng (UC-BANK-05)"}
              {activeTab === "reconciliations" && "Đối Chiếu Ngân Hàng (UC-BANK-06)"}
              {activeTab === "ledger" && "Sổ Phụ Ngân Hàng & Giao Dịch Đã Ghi Sổ (UC-BANK-07)"}
              {activeTab === "integrations" && "Tích Hợp Open Banking & Cổng Ngân Hàng (UC-BANK-08)"}
              {activeTab === "revaluations" && "Đánh Giá Lại Số Dư Ngoại Tệ Ngân Hàng"}
              {activeTab === "approvals" && "Nhật Ký Phê Duyệt Giao Dịch Ngân Hàng"}
            </h2>
          </div>

          <div className="live-bank-btn-group">
            {activeTab === "accounts" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  setFormData({
                    account: refs.masterBankAccounts[0]?.id || "",
                    is_primary: false,
                    allow_overdraft: false,
                    overdraft_limit: "0",
                    notes: "",
                  });
                  setModalType("create_profile");
                }}
              >
                + Thêm hồ sơ TK
              </button>
            )}

            {activeTab === "receipts" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  setFormData({
                    account: refs.bankProfiles[0]?.id || "",
                    transaction_type: "RECEIPT",
                    transaction_date: new Date().toISOString().split("T")[0],
                    amount: "15000000",
                    exchange_rate: "1.00",
                    party: refs.parties[0]?.id || "",
                    counterparty_name: refs.parties[0]?.name || "Công ty TNHH Khách Hàng Demo",
                    counterparty_account: "0123456789",
                    counterparty_bank: "Vietcombank",
                    bank_reference: `BC-${Date.now().toString().slice(-6)}`,
                    description: "Thu tiền thanh toán qua tài khoản ngân hàng",
                  });
                  setModalType("create_receipt");
                }}
              >
                + Lập Báo Có
              </button>
            )}

            {activeTab === "payments" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  setFormData({
                    account: refs.bankProfiles[0]?.id || "",
                    transaction_type: "PAYMENT",
                    transaction_date: new Date().toISOString().split("T")[0],
                    amount: "8000000",
                    exchange_rate: "1.00",
                    party: refs.parties[0]?.id || "",
                    counterparty_name: refs.parties[0]?.name || "Nhà Cung Cấp Dịch Vụ Mẫu",
                    counterparty_account: "9876543210",
                    counterparty_bank: "BIDV",
                    bank_reference: `UNC-${Date.now().toString().slice(-6)}`,
                    description: "Ủy nhiệm chi thanh toán tiền hàng qua ngân hàng",
                  });
                  setModalType("create_payment");
                }}
              >
                + Lập Báo Nợ / UNC
              </button>
            )}

            {activeTab === "transfers" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  const profiles = refs.bankProfiles.length > 0 ? refs.bankProfiles : accounts;
                  const vndAccounts = profiles.filter(
                    (p) => (p.currency_code === "VND" || p.account?.currency?.code === "VND" || !p.account_number?.includes("USD"))
                  );
                  const src = vndAccounts.find((p) => Number(p.balance) >= 500000) || vndAccounts[0] || profiles[0];
                  const dst = vndAccounts.find((p) => p.id !== src?.id) || profiles.find((p) => p.id !== src?.id) || src;
                  setFormData({
                    source_account: src?.id || "",
                    destination_account: dst?.id || "",
                    transfer_date: new Date().toISOString().split("T")[0],
                    amount: "500000",
                    exchange_rate: "1.00",
                    transfer_fee: "1100",
                    description: "Điều chuyển vốn nội bộ giữa các tài khoản ngân hàng",
                  });
                  setModalType("create_transfer");
                }}
              >
                + Lập lệnh chuyển tiền
              </button>
            )}

            {activeTab === "statements" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    account: refs.bankProfiles[0]?.id || "",
                    statement_date: today,
                    period_from: today,
                    period_to: today,
                    opening_balance: "50000000",
                    closing_balance: "65000000",
                    source_reference: `STMT-VCB-${Date.now().toString().slice(-5)}`,
                    line_amount: "15000000",
                    line_ref: `REF-${Date.now().toString().slice(-5)}`,
                    line_desc: "Báo có nhận tiền từ đối tác",
                    line_party_name: "Khách hàng chuyển khoản",
                    line_party_acc: "0441000123456",
                  });
                  setModalType("create_statement");
                }}
              >
                + Nhập sao kê điện tử
              </button>
            )}

            {activeTab === "reconciliations" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  const availableLines = allStatementLines.filter((l) => l.match_status !== "MATCHED");
                  setFormData({
                    statement_line: availableLines[0]?.id || "",
                    transaction: receipts[0]?.id || payments[0]?.id || "",
                    matched_amount: availableLines[0]?.amount || "15000000",
                    note: "Khớp đối chiếu giao dịch ngân hàng và sao kê",
                  });
                  setModalType("create_reconciliation");
                }}
              >
                + Đối chiếu khớp
              </button>
            )}

            {activeTab === "revaluations" && (
              <button
                className="live-bank-btn live-bank-btn-primary"
                onClick={() => {
                  // Find USD account profile if any
                  const profiles = refs.bankProfiles.length > 0 ? refs.bankProfiles : accounts;
                  const usdAcc = profiles.find((p) => p.currency_code === "USD" || p.account_number?.includes("USD"));
                  const d = new Date();
                  d.setDate(d.getDate() - (revaluations.length + 1));
                  setFormData({
                    account: usdAcc?.id || profiles[0]?.id || "",
                    revaluation_date: d.toISOString().split("T")[0],
                    current_rate: "25450.00",
                    note: "Đánh giá lại tỷ giá tài khoản USD",
                  });
                  setModalType("create_fx");
                }}
              >
                + Đánh giá ngoại tệ
              </button>
            )}
          </div>
        </div>

        {/* Tab Content Tables */}
        {loading && <div style={{ padding: "20px", color: "#38bdf8" }}>Đang tải dữ liệu...</div>}

        {/* 1. ACCOUNTS */}
        {!loading && activeTab === "accounts" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Số tài khoản</th>
                  <th>Tên tài khoản</th>
                  <th>Ngân hàng</th>
                  <th>Loại tiền</th>
                  <th>Tài khoản GL</th>
                  <th>Thấu chi</th>
                  <th>Số dư hiện tại</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có hồ sơ tài khoản ngân hàng
                    </td>
                  </tr>
                ) : (
                  accounts.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {item.account?.account_number || "—"}
                      </td>
                      <td>{item.account?.account_name || "—"}</td>
                      <td>{item.account?.bank?.name || item.account?.bank_branch || "—"}</td>
                      <td>
                        <span className="live-bank-tag-pill">
                          {item.account?.currency?.code || "VND"}
                        </span>
                      </td>
                      <td>{item.account?.gl_account?.code || "1121"}</td>
                      <td>
                        {item.allow_overdraft ? (
                          <span style={{ color: "#34d399", fontSize: "12px" }}>
                            Hạn mức: {formatMoney(item.overdraft_limit)}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>Không</span>
                        )}
                      </td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>
                        {formatMoney(item.balance)} {item.account?.currency?.code || "VND"}
                      </td>
                      <td>
                        <button
                          className="live-bank-btn live-bank-btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => {
                            setSelectedProfileId(item.id);
                            setActiveTab("ledger");
                          }}
                        >
                          📖 Xem sổ phụ
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. RECEIPTS & 3. PAYMENTS */}
        {!loading && (activeTab === "receipts" || activeTab === "payments") && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Số chứng từ</th>
                  <th>Tài khoản NH</th>
                  <th>Ngày GD</th>
                  <th>Đối tượng</th>
                  <th>TK đối ứng / NH</th>
                  <th>Tham chiếu NH</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Tích hợp NH</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === "receipts" ? receipts : payments).length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có giao dịch {activeTab === "receipts" ? "Báo Có" : "Báo Nợ"} nào
                    </td>
                  </tr>
                ) : (
                  (activeTab === "receipts" ? receipts : payments).map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{tx.number}</td>
                      <td>{tx.account?.account?.account_number || "—"}</td>
                      <td>{tx.transaction_date}</td>
                      <td>{tx.counterparty_name || tx.party?.name || "—"}</td>
                      <td style={{ fontSize: "12px", color: "#94a3b8" }}>
                        {tx.counterparty_account ? `${tx.counterparty_account} (${tx.counterparty_bank || ""})` : "—"}
                      </td>
                      <td>
                        <span className="live-bank-tag-pill">{tx.bank_reference || "—"}</span>
                      </td>
                      <td
                        style={{
                          fontWeight: "700",
                          color: tx.transaction_type === "RECEIPT" ? "#34d399" : "#f87171",
                        }}
                      >
                        {formatMoney(tx.amount)} {tx.currency?.code || "VND"}
                      </td>
                      <td>
                        <span className={`live-bank-badge-status ${tx.status.toLowerCase()}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`live-bank-badge-status ${
                            tx.integration_status === "SUCCESS"
                              ? "success"
                              : tx.integration_status === "PENDING"
                              ? "pending_approval"
                              : "draft"
                          }`}
                        >
                          {tx.integration_status || "NOT_SENT"}
                        </span>
                      </td>
                      <td>
                        <div className="live-bank-btn-group">
                          {tx.status === "DRAFT" && (
                            <button
                              className="live-bank-btn live-bank-btn-primary"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => handleTxAction(tx.id, "submit", { workflow_snapshot: { allow_self_approval: true } })}
                            >
                              Gửi duyệt
                            </button>
                          )}
                          {tx.status === "PENDING_APPROVAL" && (
                            <>
                              <button
                                className="live-bank-btn live-bank-btn-success"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "approve")}
                              >
                                Duyệt
                              </button>
                              <button
                                className="live-bank-btn live-bank-btn-danger"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "reject")}
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {tx.status === "APPROVED" && (
                            <>
                              <button
                                className="live-bank-btn live-bank-btn-success"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "post")}
                              >
                                Ghi sổ
                              </button>
                              <button
                                className="live-bank-btn live-bank-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "send-bank")}
                              >
                                Gửi NH
                              </button>
                            </>
                          )}
                          {tx.status === "POSTED" && (
                            <>
                              <button
                                className="live-bank-btn live-bank-btn-danger"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "reverse")}
                              >
                                Đảo sổ
                              </button>
                              <button
                                className="live-bank-btn live-bank-btn-secondary"
                                style={{ padding: "3px 8px", fontSize: "11px" }}
                                onClick={() => handleTxAction(tx.id, "post-gl")}
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

        {/* 4. TRANSFERS */}
        {!loading && activeTab === "transfers" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Số lệnh</th>
                  <th>Ngày chuyển</th>
                  <th>Tài khoản nguồn</th>
                  <th>Tài khoản đích</th>
                  <th>Số tiền chuyển</th>
                  <th>Phí chuyển tiền</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có lệnh chuyển tiền nội bộ
                    </td>
                  </tr>
                ) : (
                  transfers.map((tf) => (
                    <tr key={tf.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{tf.number}</td>
                      <td>{tf.transfer_date}</td>
                      <td>{tf.source_account?.account?.account_number || "—"}</td>
                      <td>{tf.destination_account?.account?.account_number || "—"}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>
                        {formatMoney(tf.amount)}
                      </td>
                      <td style={{ color: "#94a3b8" }}>{formatMoney(tf.transfer_fee)}</td>
                      <td>
                        <span className={`live-bank-badge-status ${tf.status.toLowerCase()}`}>
                          {tf.status}
                        </span>
                      </td>
                      <td>
                        {tf.status === "DRAFT" && (
                          <button
                            className="live-bank-btn live-bank-btn-success"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleTransferConfirm(tf.id)}
                          >
                            Xác nhận chuyển
                          </button>
                        )}
                        {tf.status === "CONFIRMED" && (
                          <span style={{ fontSize: "12px", color: "#34d399" }}>Đã sinh giao dịch</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. STATEMENTS */}
        {!loading && activeTab === "statements" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Mã sao kê</th>
                  <th>Tài khoản</th>
                  <th>Kỳ sao kê</th>
                  <th>Số dư đầu</th>
                  <th>Số dư cuối</th>
                  <th>Số dòng GD</th>
                  <th>Ngày nhập</th>
                </tr>
              </thead>
              <tbody>
                {statements.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bản ghi sao kê điện tử
                    </td>
                  </tr>
                ) : (
                  statements.map((st) => (
                    <tr key={st.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{st.source_reference}</td>
                      <td>{st.account?.account?.account_number || "—"}</td>
                      <td>{`${st.period_from} → ${st.period_to}`}</td>
                      <td>{formatMoney(st.opening_balance)}</td>
                      <td style={{ fontWeight: "700", color: "#38bdf8" }}>
                        {formatMoney(st.closing_balance)}
                      </td>
                      <td>
                        <span className="live-bank-tag-pill">{st.lines?.length || 0} dòng</span>
                      </td>
                      <td>{st.created_at?.slice(0, 10) || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. RECONCILIATIONS */}
        {!loading && activeTab === "reconciliations" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Mã đối chiếu</th>
                  <th>Dòng sao kê</th>
                  <th>Giao dịch kế toán</th>
                  <th>Số tiền khớp</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                  <th>Ngày đối chiếu</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bản ghi đối chiếu ngân hàng nào
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((rc) => (
                    <tr key={rc.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{rc.id.slice(0, 8)}</td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#38bdf8" }}>
                          {rc.statement_line?.reference_number || rc.statement_line_id || "Dòng sao kê"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#f1f5f9" }}>
                          {rc.transaction?.number || rc.transaction_id || "GD ngân hàng"}
                        </span>
                      </td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>
                        {formatMoney(rc.matched_amount)}
                      </td>
                      <td>
                        <span className={`live-bank-badge-status ${rc.status?.toLowerCase() || "matched"}`}>
                          {rc.status || "MATCHED"}
                        </span>
                      </td>
                      <td>{rc.note || "—"}</td>
                      <td>{rc.reconciled_at?.slice(0, 10) || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. LEDGER */}
        {!loading && activeTab === "ledger" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ fontSize: "13px", fontWeight: "600", color: "#94a3b8" }}>
                Chọn tài khoản ngân hàng:
              </label>
              <select
                className="live-bank-select"
                style={{ width: "300px" }}
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
              >
                {accounts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.account?.account_number} - {p.account?.account_name} ({p.account?.currency?.code || "VND"})
                  </option>
                ))}
              </select>
            </div>

            {ledgerData && (
              <div className="live-bank-kpi-grid">
                <div className="live-bank-kpi-card">
                  <span className="live-bank-kpi-label">Tổng thu / Báo Có</span>
                  <span className="live-bank-kpi-val" style={{ color: "#34d399" }}>
                    {formatMoney(ledgerData.total_receipts)} {ledgerData.currency}
                  </span>
                </div>
                <div className="live-bank-kpi-card">
                  <span className="live-bank-kpi-label">Tổng chi / Báo Nợ</span>
                  <span className="live-bank-kpi-val" style={{ color: "#f87171" }}>
                    {formatMoney(ledgerData.total_payments)} {ledgerData.currency}
                  </span>
                </div>
                <div className="live-bank-kpi-card">
                  <span className="live-bank-kpi-label">Số dư hiện tại</span>
                  <span className="live-bank-kpi-val" style={{ color: "#38bdf8" }}>
                    {formatMoney(ledgerData.current_balance)} {ledgerData.currency}
                  </span>
                </div>
              </div>
            )}

            <div className="live-bank-table-card">
              <table className="live-bank-table">
                <thead>
                  <tr>
                    <th>Số chứng từ</th>
                    <th>Ngày giao dịch</th>
                    <th>Loại GD</th>
                    <th>Đối tác / Người nộp-nhận</th>
                    <th>Diễn giải</th>
                    <th>Báo Có (Thu)</th>
                    <th>Báo Nợ (Chi)</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {!ledgerData?.transactions || ledgerData.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                        Chưa có giao dịch ghi sổ (POSTED) cho tài khoản này
                      </td>
                    </tr>
                  ) : (
                    ledgerData.transactions.map((tx: any) => (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: "700", color: "#f8fafc" }}>{tx.number}</td>
                        <td>{tx.transaction_date}</td>
                        <td>
                          <span className="live-bank-tag-pill">{tx.transaction_type}</span>
                        </td>
                        <td>{tx.counterparty_name || "—"}</td>
                        <td>{tx.description}</td>
                        <td style={{ color: "#34d399", fontWeight: "700" }}>
                          {tx.transaction_type === "RECEIPT" || tx.transaction_type === "INTEREST"
                            ? formatMoney(tx.amount)
                            : "—"}
                        </td>
                        <td style={{ color: "#f87171", fontWeight: "700" }}>
                          {tx.transaction_type === "PAYMENT" || tx.transaction_type === "FEE"
                            ? formatMoney(tx.amount)
                            : "—"}
                        </td>
                        <td>
                          <span className="live-bank-badge-status posted">POSTED</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. INTEGRATIONS */}
        {!loading && activeTab === "integrations" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Tài khoản</th>
                  <th>Giao dịch liên quan</th>
                  <th>Cổng ngân hàng</th>
                  <th>Mã tham chiếu</th>
                  <th>Trạng thái</th>
                  <th>Thời gian gửi</th>
                  <th>Thao tác Gateway</th>
                </tr>
              </thead>
              <tbody>
                {integrations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có yêu cầu tích hợp Open Banking nào
                    </td>
                  </tr>
                ) : (
                  integrations.map((ig) => (
                    <tr key={ig.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{ig.id.slice(0, 8)}</td>
                      <td>{ig.account?.account?.account_number || "—"}</td>
                      <td>{ig.transaction?.number || "—"}</td>
                      <td>
                        <span className="live-bank-tag-pill">{ig.gateway || "VIETINBANK_OPEN_API"}</span>
                      </td>
                      <td>{ig.reference_code || "PENDING"}</td>
                      <td>
                        <span
                          className={`live-bank-badge-status ${
                            ig.status === "SUCCESS"
                              ? "success"
                              : ig.status === "FAILED"
                              ? "rejected"
                              : "pending_approval"
                          }`}
                        >
                          {ig.status}
                        </span>
                      </td>
                      <td>{ig.created_at?.slice(0, 16) || "—"}</td>
                      <td>
                        {ig.status === "PENDING" && (
                          <div className="live-bank-btn-group">
                            <button
                              className="live-bank-btn live-bank-btn-success"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => handleIntegrationResult(ig.id, "SUCCESS")}
                            >
                              Webhook Thành công
                            </button>
                            <button
                              className="live-bank-btn live-bank-btn-danger"
                              style={{ padding: "3px 8px", fontSize: "11px" }}
                              onClick={() => handleIntegrationResult(ig.id, "FAILED")}
                            >
                              Webhook Thất bại
                            </button>
                          </div>
                        )}
                        {ig.status !== "PENDING" && (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Đã phản hồi</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 9. REVALUATIONS */}
        {!loading && activeTab === "revaluations" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Mã định giá</th>
                  <th>Tài khoản ngoại tệ</th>
                  <th>Ngày đánh giá</th>
                  <th>Tỷ giá áp dụng</th>
                  <th>Chênh lệch (VND)</th>
                  <th>Chứng từ GL</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {revaluations.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bản ghi đánh giá lại ngoại tệ
                    </td>
                  </tr>
                ) : (
                  revaluations.map((rv) => (
                    <tr key={rv.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{rv.id.slice(0, 8)}</td>
                      <td>{rv.account?.account?.account_number || "—"}</td>
                      <td>{rv.revaluation_date}</td>
                      <td style={{ fontWeight: "700" }}>{formatMoney(rv.current_rate)}</td>
                      <td
                        style={{
                          fontWeight: "700",
                          color: Number(rv.difference) >= 0 ? "#34d399" : "#f87171",
                        }}
                      >
                        {formatMoney(rv.difference)} VND
                      </td>
                      <td>
                        <span className="live-bank-tag-pill">{rv.gl_reference || "GL-AUTO"}</span>
                      </td>
                      <td>{rv.note || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 10. APPROVALS */}
        {!loading && activeTab === "approvals" && (
          <div className="live-bank-table-card">
            <table className="live-bank-table">
              <thead>
                <tr>
                  <th>Mã phê duyệt</th>
                  <th>Giao dịch</th>
                  <th>Người quyết định</th>
                  <th>Quyết định</th>
                  <th>Lý do</th>
                  <th>Thời gian quyết định</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có lịch sử phê duyệt giao dịch nào
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
                          className={`live-bank-badge-status ${
                            ap.decision === "APPROVED" ? "approved" : "rejected"
                          }`}
                        >
                          {ap.decision}
                        </span>
                      </td>
                      <td>{ap.reason || "—"}</td>
                      <td>{ap.decided_at?.slice(0, 16) || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* MODALS */}

      {/* 1. Modal Create Account Profile */}
      {modalType === "create_profile" && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>Thêm hồ sơ tài khoản ngân hàng</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProfile}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-group">
                  <label>Chọn tài khoản danh mục (Master Bank Account):</label>
                  <select
                    className="live-bank-select"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    required
                  >
                    {refs.masterBankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_number} - {a.account_name} ({a.bank?.name || ""})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Tài khoản chính:</label>
                    <select
                      className="live-bank-select"
                      value={formData.is_primary ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, is_primary: e.target.value === "true" })}
                    >
                      <option value="false">Không</option>
                      <option value="true">Có</option>
                    </select>
                  </div>
                  <div className="live-bank-form-group">
                    <label>Cho phép thấu chi:</label>
                    <select
                      className="live-bank-select"
                      value={formData.allow_overdraft ? "true" : "false"}
                      onChange={(e) => setFormData({ ...formData, allow_overdraft: e.target.value === "true" })}
                    >
                      <option value="false">Không</option>
                      <option value="true">Cho phép</option>
                    </select>
                  </div>
                </div>
                {formData.allow_overdraft && (
                  <div className="live-bank-form-group">
                    <label>Hạn mức thấu chi (VND):</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.overdraft_limit}
                      onChange={(e) => setFormData({ ...formData, overdraft_limit: e.target.value })}
                    />
                  </div>
                )}
                <div className="live-bank-form-group">
                  <label>Ghi chú:</label>
                  <input
                    type="text"
                    className="live-bank-input"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Ghi chú hồ sơ tài khoản..."
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Lưu hồ sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Create Receipt / Payment */}
      {(modalType === "create_receipt" || modalType === "create_payment") && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>
                {modalType === "create_receipt" ? "Lập Báo Có (Thu tiền gửi)" : "Lập Báo Nợ / Ủy nhiệm chi (Chi tiền gửi)"}
              </span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTransaction}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-group">
                  <label>Tài khoản ngân hàng của doanh nghiệp:</label>
                  <select
                    className="live-bank-select"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    required
                  >
                    {refs.bankProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.account?.account_number} - {p.account?.account_name} (Số dư: {formatMoney(p.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Ngày giao dịch:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.transaction_date}
                      onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Số tiền:</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Đối tượng (Khách hàng / NCC):</label>
                    <select
                      className="live-bank-select"
                      value={formData.party}
                      onChange={(e) => {
                        const sel = refs.parties.find((p) => p.id === e.target.value);
                        setFormData({
                          ...formData,
                          party: e.target.value,
                          counterparty_name: sel?.name || formData.counterparty_name,
                        });
                      }}
                    >
                      <option value="">-- Chọn đối tượng (không bắt buộc) --</option>
                      {refs.parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-bank-form-group">
                    <label>Tên đơn vị đối tác:</label>
                    <input
                      type="text"
                      className="live-bank-input"
                      value={formData.counterparty_name}
                      onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Số tài khoản đối tác:</label>
                    <input
                      type="text"
                      className="live-bank-input"
                      value={formData.counterparty_account}
                      onChange={(e) => setFormData({ ...formData, counterparty_account: e.target.value })}
                      placeholder="Số tài khoản đối tác..."
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Ngân hàng đối tác:</label>
                    <input
                      type="text"
                      className="live-bank-input"
                      value={formData.counterparty_bank}
                      onChange={(e) => setFormData({ ...formData, counterparty_bank: e.target.value })}
                      placeholder="VD: Vietcombank, BIDV, Techcombank..."
                    />
                  </div>
                </div>

                <div className="live-bank-form-group">
                  <label>Số tham chiếu ngân hàng (Bank Ref):</label>
                  <input
                    type="text"
                    className="live-bank-input"
                    value={formData.bank_reference}
                    onChange={(e) => setFormData({ ...formData, bank_reference: e.target.value })}
                    placeholder="Mã điện chuyển tiền / số tham chiếu..."
                  />
                </div>

                <div className="live-bank-form-group">
                  <label>Diễn giải / Nội dung thanh toán:</label>
                  <textarea
                    className="live-bank-textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Lưu giao dịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Create Bank Transfer */}
      {modalType === "create_transfer" && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>Lập lệnh chuyển tiền nội bộ ngân hàng</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTransfer}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Tài khoản chuyển (Nguồn):</label>
                    <select
                      className="live-bank-select"
                      value={formData.source_account}
                      onChange={(e) => setFormData({ ...formData, source_account: e.target.value })}
                      required
                    >
                      {refs.bankProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.account?.account_number} - {p.account?.account_name} (Dư: {formatMoney(p.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-bank-form-group">
                    <label>Tài khoản nhận (Đích):</label>
                    <select
                      className="live-bank-select"
                      value={formData.destination_account}
                      onChange={(e) => setFormData({ ...formData, destination_account: e.target.value })}
                      required
                    >
                      {refs.bankProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.account?.account_number} - {p.account?.account_name} (Dư: {formatMoney(p.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Ngày chuyển khoản:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.transfer_date}
                      onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Số tiền chuyển:</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-group">
                  <label>Phí chuyển khoản (VND):</label>
                  <input
                    type="number"
                    className="live-bank-input"
                    value={formData.transfer_fee}
                    onChange={(e) => setFormData({ ...formData, transfer_fee: e.target.value })}
                  />
                </div>

                <div className="live-bank-form-group">
                  <label>Nội dung chuyển khoản:</label>
                  <textarea
                    className="live-bank-textarea"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Lập lệnh chuyển tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Create Statement Import */}
      {modalType === "create_statement" && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>Nhập sao kê ngân hàng điện tử</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateStatement}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-group">
                  <label>Tài khoản sao kê:</label>
                  <select
                    className="live-bank-select"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    required
                  >
                    {refs.bankProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.account?.account_number} - {p.account?.account_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Mã / Số file sao kê:</label>
                    <input
                      type="text"
                      className="live-bank-input"
                      value={formData.source_reference}
                      onChange={(e) => setFormData({ ...formData, source_reference: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Ngày lập sao kê:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.statement_date}
                      onChange={(e) => setFormData({ ...formData, statement_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Từ ngày:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.period_from}
                      onChange={(e) => setFormData({ ...formData, period_from: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Đến ngày:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.period_to}
                      onChange={(e) => setFormData({ ...formData, period_to: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Số dư đầu kỳ:</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.opening_balance}
                      onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Số dư cuối kỳ:</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.closing_balance}
                      onChange={(e) => setFormData({ ...formData, closing_balance: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #1f2937", paddingTop: "10px", marginTop: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#38bdf8" }}>
                    Dòng giao dịch mẫu trong sao kê:
                  </span>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Số tiền giao dịch:</label>
                    <input
                      type="number"
                      className="live-bank-input"
                      value={formData.line_amount}
                      onChange={(e) => setFormData({ ...formData, line_amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Mã tham chiếu dòng GD:</label>
                    <input
                      type="text"
                      className="live-bank-input"
                      value={formData.line_ref}
                      onChange={(e) => setFormData({ ...formData, line_ref: e.target.value })}
                    />
                  </div>
                </div>

                <div className="live-bank-form-group">
                  <label>Nội dung giao dịch sao kê:</label>
                  <input
                    type="text"
                    className="live-bank-input"
                    value={formData.line_desc}
                    onChange={(e) => setFormData({ ...formData, line_desc: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Nhập sao kê
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Create Reconciliation Match */}
      {modalType === "create_reconciliation" && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>Đối chiếu khớp giao dịch ngân hàng</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleMatchReconciliation}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-group">
                  <label>Chọn dòng sao kê (Statement Line):</label>
                  <select
                    className="live-bank-select"
                    value={formData.statement_line}
                    onChange={(e) => {
                      const sel = allStatementLines.find((l) => l.id === e.target.value);
                      setFormData({
                        ...formData,
                        statement_line: e.target.value,
                        matched_amount: sel ? sel.amount : formData.matched_amount,
                      });
                    }}
                    required
                  >
                    {allStatementLines.length === 0 ? (
                      <option value="">(Chưa có dòng sao kê nào, hãy nhập sao kê trước)</option>
                    ) : (
                      allStatementLines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.reference_number || l.id.slice(0, 8)} - {formatMoney(l.amount)} VND - {l.description}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="live-bank-form-group">
                  <label>Chọn chứng từ giao dịch kế toán ngân hàng:</label>
                  <select
                    className="live-bank-select"
                    value={formData.transaction}
                    onChange={(e) => setFormData({ ...formData, transaction: e.target.value })}
                    required
                  >
                    {[...receipts, ...payments].length === 0 ? (
                      <option value="">(Chưa có chứng từ ngân hàng)</option>
                    ) : (
                      [...receipts, ...payments].map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.number} ({t.transaction_type}) - {formatMoney(t.amount)} VND - {t.description}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="live-bank-form-group">
                  <label>Số tiền khớp (Matched Amount):</label>
                  <input
                    type="number"
                    className="live-bank-input"
                    value={formData.matched_amount}
                    onChange={(e) => setFormData({ ...formData, matched_amount: e.target.value })}
                    required
                  />
                </div>

                <div className="live-bank-form-group">
                  <label>Ghi chú đối chiếu:</label>
                  <input
                    type="text"
                    className="live-bank-input"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Khớp đối chiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal Create FX Revaluation */}
      {modalType === "create_fx" && (
        <div className="live-bank-modal-backdrop">
          <div className="live-bank-modal">
            <div className="live-bank-modal-header">
              <span>Đánh giá lại ngoại tệ tài khoản ngân hàng</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateFx}>
              <div className="live-bank-modal-body">
                <div className="live-bank-form-group">
                  <label>Chọn tài khoản ngoại tệ:</label>
                  <select
                    className="live-bank-select"
                    value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    required
                  >
                    {refs.bankProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.account?.account_number} - {p.account?.currency?.code || "VND"} (Số dư: {formatMoney(p.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-bank-form-row">
                  <div className="live-bank-form-group">
                    <label>Ngày đánh giá lại:</label>
                    <input
                      type="date"
                      className="live-bank-input"
                      value={formData.revaluation_date}
                      onChange={(e) => setFormData({ ...formData, revaluation_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-bank-form-group">
                    <label>Tỷ giá hiện tại (VND / Ngoại tệ):</label>
                    <input
                      type="number"
                      step="0.01"
                      className="live-bank-input"
                      value={formData.current_rate}
                      onChange={(e) => setFormData({ ...formData, current_rate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-bank-form-group">
                  <label>Ghi chú:</label>
                  <input
                    type="text"
                    className="live-bank-input"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-bank-modal-footer">
                <button
                  type="button"
                  className="live-bank-btn live-bank-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button type="submit" className="live-bank-btn live-bank-btn-primary">
                  Thực hiện đánh giá
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
