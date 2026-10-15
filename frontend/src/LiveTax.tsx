import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-tax.css";

type TabKey =
  | "invoices"
  | "summaries"
  | "filings"
  | "obligations"
  | "reconciliations"
  | "links"
  | "periods"
  | "exports";

interface ReferenceData {
  periods: any[];
  parties: any[];
  branches: any[];
  currencies: any[];
  items: any[];
}

export default function LiveTax() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("invoices");
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
    periods: [],
    parties: [],
    branches: [],
    currencies: [],
    items: [],
  });

  // Tab Data States
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [filings, setFilings] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [documentLinks, setDocumentLinks] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [exportsList, setExportsList] = useState<any[]>([]);

  // Modals & Action States
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Fetch Master Data
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [perRes, partyRes, branchRes, currRes, itemRes] = await Promise.all([
        fetch(`/api/v1/tax/periods/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/items/?company_id=${companyId}`, { headers: h }),
      ]);

      const perData = perRes.ok ? await perRes.json() : [];
      const partyData = partyRes.ok ? await partyRes.json() : [];
      const branchData = branchRes.ok ? await branchRes.json() : [];
      const currData = currRes.ok ? await currRes.json() : [];
      const itemData = itemRes.ok ? await itemRes.json() : [];

      const periodList = Array.isArray(perData) ? perData : perData.results || [];
      setPeriods(periodList);
      setRefs({
        periods: periodList,
        parties: Array.isArray(partyData) ? partyData : partyData.results || [],
        branches: Array.isArray(branchData) ? branchData : branchData.results || [],
        currencies: Array.isArray(currData) ? currData : currData.results || [],
        items: Array.isArray(itemData) ? itemData : itemData.results || [],
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
      if (activeTab === "invoices") {
        const res = await fetch(`/api/v1/tax/invoices/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setInvoices(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "summaries") {
        const res = await fetch(`/api/v1/tax/summaries/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setSummaries(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "filings") {
        const res = await fetch(`/api/v1/tax/filings/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setFilings(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "obligations") {
        const res = await fetch(`/api/v1/tax/obligations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setObligations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "reconciliations") {
        const res = await fetch(`/api/v1/tax/reconciliations/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setReconciliations(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "links") {
        const res = await fetch(`/api/v1/tax/document-links/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setDocumentLinks(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "periods") {
        const res = await fetch(`/api/v1/tax/periods/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setPeriods(Array.isArray(d) ? d : d.results || []);
        }
      } else if (activeTab === "exports") {
        const res = await fetch(`/api/v1/tax/exports/?company_id=${companyId}`, { headers: h });
        if (res.ok) {
          const d = await res.json();
          setExportsList(Array.isArray(d) ? d : d.results || []);
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

  // Actions on Invoice
  const handleValidateInvoice = async (id: string) => {
    try {
      const h = getHeaders();
      const res = await fetch(`/api/v1/tax/invoices/${id}/validate/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Kiểm tra hóa đơn thất bại");
      }

      setNotice({ type: "success", text: "Kiểm tra tính hợp lệ của hóa đơn thành công!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 1. Create Tax Invoice (INPUT or OUTPUT)
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetParty = refs.parties.find((p) => p.id === formData.party) || refs.parties[0];
      const targetCurrency = refs.currencies.find((c) => c.code === "VND") || refs.currencies[0];
      const targetItem = refs.items[0];

      const payload = {
        company: companyId,
        branch: formData.branch || refs.branches[0]?.id,
        direction: formData.direction || "INPUT",
        invoice_type: formData.invoice_type || "ORIGINAL",
        invoice_series: formData.invoice_series || "1C26TBB",
        invoice_number: formData.invoice_number || `HD-${Date.now().toString().slice(-6)}`,
        invoice_date: formData.invoice_date || new Date().toISOString().slice(0, 10),
        seller_name: formData.seller_name || targetParty?.name || "Công ty Cổ phần Cung ứng Toàn Cầu",
        seller_tax_code: formData.seller_tax_code || targetParty?.tax_code || "0101234567",
        buyer_name: formData.buyer_name || "Công ty Mua Hàng Test",
        buyer_tax_code: formData.buyer_tax_code || "0312345678",
        party: targetParty?.id || null,
        currency: targetCurrency?.id,
        exchange_rate: 1,
        source: "MANUAL",
        tax_eligible: true,
        lines: [
          {
            line_no: 1,
            item: targetItem?.id || null,
            description: formData.line_description || "Vật tư thiết bị công nghệ thông tin",
            quantity: Number(formData.quantity) || 5,
            unit_price: Number(formData.unit_price) || 2000000,
            discount_amount: 0,
            tax_rate: Number(formData.tax_rate) || 10,
          },
        ],
      };

      const res = await fetch(`/api/v1/tax/invoices/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(err));
      }

      setNotice({ type: "success", text: "Tạo hóa đơn thuế thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: "Lỗi tạo hóa đơn: " + e.message });
    }
  };

  // 2. Build Summary (Tổng hợp thuế kỳ)
  const handleBuildSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
      };

      const res = await fetch(`/api/v1/tax/summaries/build/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Tổng hợp dữ liệu thuế thất bại");
      }

      setNotice({ type: "success", text: "Tổng hợp dữ liệu thuế kỳ thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 3. Create Filing (Tờ khai thuế)
  const handleCreateFiling = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];
      const targetSummary = summaries.find((s) => s.period === targetPeriod?.id) || summaries[0];

      if (!targetSummary) {
        throw new Error("Cần có Bảng tổng hợp thuế trước khi lập tờ khai.");
      }

      const selectedType = formData.filing_type || "VAT_RETURN";
      const existingSameType = filings.filter((f) => f.period === targetPeriod?.id && f.filing_type === selectedType);
      const nextVersion = existingSameType.length > 0
        ? Math.max(...existingSameType.map((f) => Number(f.version) || 1)) + 1
        : 1;

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        summary: targetSummary.id,
        filing_type: selectedType,
        version: nextVersion,
      };

      const res = await fetch(`/api/v1/tax/filings/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Lập tờ khai thuế thất bại");
      }

      setNotice({ type: "success", text: "Lập tờ khai thuế thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Action on Filing: Submission Result
  const handleFilingSubmissionResult = async (id: string) => {
    try {
      const h = getHeaders();
      const payload = {
        status: "ACCEPTED",
        reference: `TCT-ACK-${Date.now().toString().slice(-6)}`,
      };

      const res = await fetch(`/api/v1/tax/filings/${id}/submission-result/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Cập nhật kết quả nộp thất bại");
      }

      setNotice({ type: "success", text: "Xác nhận cơ quan thuế đã chấp nhận tờ khai!" });
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 4. Create Obligation (Khai báo nghĩa vụ thuế)
  const handleCreateObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        tax_type: formData.tax_type || "VAT",
        due_date: formData.due_date || new Date().toISOString().slice(0, 10),
        assessed_amount: formData.assessed_amount || "15000000",
        reason: formData.reason || "Nghĩa vụ thuế GTGT phát sinh theo tờ khai",
      };

      const res = await fetch(`/api/v1/tax/obligations/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Tạo nghĩa vụ thuế thất bại");
      }

      setNotice({ type: "success", text: "Ghi nhận nghĩa vụ thuế thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 5. Run Reconciliation (Đối chiếu thuế & sổ sách)
  const handleRunReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
      };

      const res = await fetch(`/api/v1/tax/reconciliations/run/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Chạy đối chiếu thất bại");
      }

      setNotice({ type: "success", text: "Chạy đối chiếu thuế và sổ sách thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // 6. Export Tax Data (XML HTKK)
  const handleExportData = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const h = getHeaders();
      const targetPeriod = refs.periods.find((p) => p.id === formData.period) || refs.periods[0];
      const targetFiling = filings.find((f) => f.period === targetPeriod?.id) || filings[0];

      const payload = {
        company: companyId,
        period: targetPeriod?.id,
        filing: targetFiling?.id || null,
        format_code: formData.format_code || "XML_HTKK",
        format_version: formData.format_version || "2.0",
      };

      const res = await fetch(`/api/v1/tax/exports/?company_id=${companyId}`, {
        method: "POST",
        headers: h,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Kết xuất tệp thuế thất bại");
      }

      setNotice({ type: "success", text: "Kết xuất tệp XML/HTKK thành công!" });
      setModalType(null);
      loadTabData();
    } catch (e: any) {
      setNotice({ type: "error", text: e.message });
    }
  };

  // Helper format number
  const formatNum = (val: any) => {
    const num = Number(val) || 0;
    return num.toLocaleString("vi-VN");
  };

  // Metrics summary
  const outputTax = invoices
    .filter((i) => i.direction === "OUTPUT")
    .reduce((sum, i) => sum + (Number(i.tax_amount) || 0), 0);
  const inputTax = invoices
    .filter((i) => i.direction === "INPUT")
    .reduce((sum, i) => sum + (Number(i.tax_amount) || 0), 0);
  const taxPayable = Math.max(outputTax - inputTax, 0);

  return (
    <div className="live-tax-root">
      {/* Top Header */}
      <header className="live-tax-header">
        <div className="live-tax-title-box">
          <div className="live-tax-title">
            <span>🏛️</span>
            <span>Thuế & Tờ Khai Thuế GTGT/TNCN/TNDN (Live Tax Management)</span>
            <span className="live-tax-badge">UC-TAX-01 → UC-TAX-08</span>
          </div>
          <div className="live-tax-company-info">
            <span>Doanh nghiệp:</span>
            <span className="live-tax-company-tag">{companyId.slice(0, 8)}...</span>
          </div>
        </div>

        <div className="live-tax-btn-group">
          <Link to="/assets" className="live-fa-btn live-fa-btn-secondary">
            🏛️ Tài sản
          </Link>
          <Link to="/inventory" className="live-fa-btn live-fa-btn-secondary">
            📦 Kho hàng
          </Link>
          <Link to="/purchases" className="live-fa-btn live-fa-btn-secondary">
            🛒 Mua hàng
          </Link>
          <Link to="/sales" className="live-fa-btn live-fa-btn-secondary">
            🏷️ Bán hàng
          </Link>
          <button
            onClick={() => {
              fetchRefs();
              loadTabData();
            }}
            className="live-tax-btn live-tax-btn-primary"
          >
            🔄 Làm mới
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="live-tax-nav">
        <button
          data-testid="tab-invoices"
          className={`live-tax-nav-btn ${activeTab === "invoices" ? "active" : ""}`}
          onClick={() => setActiveTab("invoices")}
        >
          📄 Hóa đơn thuế <span className="live-tax-tag-pill">{invoices.length}</span>
        </button>
        <button
          data-testid="tab-summaries"
          className={`live-tax-nav-btn ${activeTab === "summaries" ? "active" : ""}`}
          onClick={() => setActiveTab("summaries")}
        >
          📊 Tổng hợp thuế kỳ <span className="live-tax-tag-pill">{summaries.length}</span>
        </button>
        <button
          data-testid="tab-filings"
          className={`live-tax-nav-btn ${activeTab === "filings" ? "active" : ""}`}
          onClick={() => setActiveTab("filings")}
        >
          📑 Tờ khai thuế <span className="live-tax-tag-pill">{filings.length}</span>
        </button>
        <button
          data-testid="tab-obligations"
          className={`live-tax-nav-btn ${activeTab === "obligations" ? "active" : ""}`}
          onClick={() => setActiveTab("obligations")}
        >
          💳 Nghĩa vụ & Nộp thuế <span className="live-tax-tag-pill">{obligations.length}</span>
        </button>
        <button
          data-testid="tab-reconciliations"
          className={`live-tax-nav-btn ${activeTab === "reconciliations" ? "active" : ""}`}
          onClick={() => setActiveTab("reconciliations")}
        >
          🔍 Đối chiếu thuế <span className="live-tax-tag-pill">{reconciliations.length}</span>
        </button>
        <button
          data-testid="tab-links"
          className={`live-tax-nav-btn ${activeTab === "links" ? "active" : ""}`}
          onClick={() => setActiveTab("links")}
        >
          🔗 Liên kết chứng từ <span className="live-tax-tag-pill">{documentLinks.length}</span>
        </button>
        <button
          data-testid="tab-periods"
          className={`live-tax-nav-btn ${activeTab === "periods" ? "active" : ""}`}
          onClick={() => setActiveTab("periods")}
        >
          🔒 Kỳ tính thuế <span className="live-tax-tag-pill">{periods.length}</span>
        </button>
        <button
          data-testid="tab-exports"
          className={`live-tax-nav-btn ${activeTab === "exports" ? "active" : ""}`}
          onClick={() => setActiveTab("exports")}
        >
          📤 Kết xuất XML/HTKK <span className="live-tax-tag-pill">{exportsList.length}</span>
        </button>
      </nav>

      {/* Main Container */}
      <main className="live-tax-container">
        {/* Notice Alert */}
        {notice && (
          <div className={`live-tax-notice ${notice.type}`}>
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
        <div className="live-tax-kpi-grid">
          <div className="live-tax-kpi-card">
            <span className="live-tax-kpi-label">Thuế GTGT đầu ra</span>
            <span className="live-tax-kpi-val highlight">{formatNum(outputTax)} VND</span>
          </div>
          <div className="live-tax-kpi-card">
            <span className="live-tax-kpi-label">Thuế GTGT đầu vào được khấu trừ</span>
            <span className="live-tax-kpi-val info">{formatNum(inputTax)} VND</span>
          </div>
          <div className="live-tax-kpi-card">
            <span className="live-tax-kpi-label">Thuế GTGT còn phải nộp</span>
            <span className="live-tax-kpi-val warning">{formatNum(taxPayable)} VND</span>
          </div>
          <div className="live-tax-kpi-card">
            <span className="live-tax-kpi-label">Tổng hóa đơn thuế</span>
            <span className="live-tax-kpi-val success">{invoices.length} hóa đơn</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="live-tax-controls">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", margin: 0 }}>
              {activeTab === "invoices" && "Hóa Đơn Thuế GTGT Đầu Vào & Đầu Ra (UC-TAX-01)"}
              {activeTab === "summaries" && "Bảng Tổng Hợp Dữ Liệu Thuế Định Kỳ (UC-TAX-04)"}
              {activeTab === "filings" && "Tờ Khai Thuế GTGT, TNCN, TNDN (UC-TAX-05)"}
              {activeTab === "obligations" && "Theo Dõi Nghĩa Vụ Nộp Ngân Sách Nhà Nước (UC-TAX-06)"}
              {activeTab === "reconciliations" && "Đối Chiếu Dữ Liệu Sổ Sách & Thuế (UC-TAX-07)"}
              {activeTab === "links" && "Liên Kết Hóa Đơn Thuế Với Chứng Từ Mua / Bán (UC-TAX-02)"}
              {activeTab === "periods" && "Quản Lý Kỳ Kê Khai Thuế (UC-TAX-03)"}
              {activeTab === "exports" && "Kết Xuất Tệp Thuế Điện Tử XML / HTKK (UC-TAX-08)"}
            </h2>
          </div>

          <div className="live-tax-btn-group">
            {activeTab === "invoices" && (
              <button
                data-testid="btn-create-invoice"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    direction: "INPUT",
                    invoice_type: "ORIGINAL",
                    invoice_series: "1C26TBB",
                    invoice_number: `HD-${Date.now().toString().slice(-6)}`,
                    invoice_date: today,
                    seller_name: "Công ty Cổ phần Cung ứng Toàn Cầu",
                    seller_tax_code: "0101234567",
                    buyer_name: "Công ty Mua Hàng Test",
                    buyer_tax_code: "0312345678",
                    branch: refs.branches[0]?.id || "",
                    party: refs.parties[0]?.id || "",
                    quantity: "5",
                    unit_price: "2000000",
                    tax_rate: "10",
                    line_description: "Vật tư thiết bị công nghệ thông tin",
                  });
                  setModalType("create_invoice");
                }}
              >
                + Lập Hóa Đơn Thuế
              </button>
            )}

            {activeTab === "summaries" && (
              <button
                data-testid="btn-build-summary"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  setFormData({
                    period: refs.periods[0]?.id || "",
                  });
                  setModalType("build_summary");
                }}
              >
                + Tổng Hợp Thuế Kỳ Này
              </button>
            )}

            {activeTab === "filings" && (
              <button
                data-testid="btn-create-filing"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  setFormData({
                    period: refs.periods[0]?.id || "",
                    filing_type: "VAT_RETURN",
                  });
                  setModalType("create_filing");
                }}
              >
                + Lập Tờ Khai Thuế
              </button>
            )}

            {activeTab === "obligations" && (
              <button
                data-testid="btn-create-obligation"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFormData({
                    period: refs.periods[0]?.id || "",
                    tax_type: "VAT",
                    due_date: today,
                    assessed_amount: "15000000",
                    reason: "Nghĩa vụ nộp thuế GTGT kỳ hiện tại",
                  });
                  setModalType("create_obligation");
                }}
              >
                + Khai Báo Nghĩa Vụ Thuế
              </button>
            )}

            {activeTab === "reconciliations" && (
              <button
                data-testid="btn-run-reconciliation"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  setFormData({
                    period: refs.periods[0]?.id || "",
                  });
                  setModalType("run_reconciliation");
                }}
              >
                + Chạy Đối Chiếu Thuế
              </button>
            )}

            {activeTab === "exports" && (
              <button
                data-testid="btn-export-data"
                className="live-tax-btn live-tax-btn-primary"
                onClick={() => {
                  setFormData({
                    period: refs.periods[0]?.id || "",
                    format_code: "XML_HTKK",
                    format_version: "2.0",
                  });
                  setModalType("export_data");
                }}
              >
                + Kết Xuất Tệp XML HTKK
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
            Đang tải dữ liệu từ cơ sở dữ liệu...
          </div>
        )}

        {/* 1. INVOICES TAB */}
        {!loading && activeTab === "invoices" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Ký hiệu & Số HĐ</th>
                  <th>Chiều HĐ</th>
                  <th>Loại HĐ</th>
                  <th>Ngày hóa đơn</th>
                  <th>Người bán / MST</th>
                  <th>Người mua / MST</th>
                  <th>Tổng tiền chưa thuế</th>
                  <th>Tiền thuế GTGT</th>
                  <th>Tổng cộng thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có hóa đơn thuế nào
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {inv.invoice_series} - {inv.invoice_number}
                      </td>
                      <td>
                        <span className={`live-tax-tag-pill ${inv.direction === "OUTPUT" ? "output" : "input"}`}>
                          {inv.direction === "OUTPUT" ? "Đầu ra (Bán)" : "Đầu vào (Mua)"}
                        </span>
                      </td>
                      <td>{inv.invoice_type}</td>
                      <td>{inv.invoice_date}</td>
                      <td>
                        <div>{inv.seller_name}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>MST: {inv.seller_tax_code}</div>
                      </td>
                      <td>
                        <div>{inv.buyer_name}</div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>MST: {inv.buyer_tax_code || "—"}</div>
                      </td>
                      <td style={{ fontWeight: "700" }}>{formatNum(inv.subtotal)}</td>
                      <td style={{ fontWeight: "700", color: "#f87171" }}>{formatNum(inv.tax_amount)}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(inv.total_amount)}</td>
                      <td>
                        <span className={`live-tax-badge-status ${inv.status?.toLowerCase() || "draft"}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.status !== "VALIDATED" && inv.status !== "ISSUED" && (
                          <button
                            className="live-tax-btn live-tax-btn-success"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleValidateInvoice(inv.id)}
                          >
                            Kiểm tra HĐ
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

        {/* 2. SUMMARIES TAB */}
        {!loading && activeTab === "summaries" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Kỳ tính thuế</th>
                  <th>Phiên bản</th>
                  <th>Doanh thu chịu thuế (Vào)</th>
                  <th>Thuế GTGT đầu vào</th>
                  <th>Doanh thu chịu thuế (Ra)</th>
                  <th>Thuế GTGT đầu ra</th>
                  <th>Chênh lệch thuế (Phải nộp)</th>
                  <th>Số ngoại lệ</th>
                  <th>Thời gian tổng hợp</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có bảng tổng hợp thuế định kỳ
                    </td>
                  </tr>
                ) : (
                  summaries.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{s.period_code || s.period}</td>
                      <td>v{s.version}</td>
                      <td>{formatNum(s.input_taxable_amount)}</td>
                      <td style={{ color: "#60a5fa" }}>{formatNum(s.input_tax_amount)}</td>
                      <td>{formatNum(s.output_taxable_amount)}</td>
                      <td style={{ color: "#f87171" }}>{formatNum(s.output_tax_amount)}</td>
                      <td style={{ fontWeight: "700", color: "#fbbf24" }}>{formatNum(s.tax_difference)}</td>
                      <td>{s.exception_count}</td>
                      <td>{s.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. FILINGS TAB */}
        {!loading && activeTab === "filings" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Kỳ thuế</th>
                  <th>Loại tờ khai</th>
                  <th>Phiên bản</th>
                  <th>Thuế phải nộp</th>
                  <th>Mã tham chiếu TCT</th>
                  <th>Trạng thái nộp</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filings.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có tờ khai thuế nào
                    </td>
                  </tr>
                ) : (
                  filings.map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{f.period_code || f.period}</td>
                      <td>
                        <span className="live-tax-tag-pill">{f.filing_type}</span>
                      </td>
                      <td>v{f.version}</td>
                      <td style={{ fontWeight: "700", color: "#fbbf24" }}>
                        {formatNum(f.indicators?.tax_payable || 0)} VND
                      </td>
                      <td>{f.submission_reference || "—"}</td>
                      <td>
                        <span className={`live-tax-badge-status ${f.status?.toLowerCase() || "draft"}`}>
                          {f.status}
                        </span>
                      </td>
                      <td>
                        {f.status !== "ACCEPTED" && (
                          <button
                            className="live-tax-btn live-tax-btn-success"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            onClick={() => handleFilingSubmissionResult(f.id)}
                          >
                            Xác nhận nộp TCT
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

        {/* 4. OBLIGATIONS TAB */}
        {!loading && activeTab === "obligations" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Kỳ thuế</th>
                  <th>Loại thuế</th>
                  <th>Hạn nộp</th>
                  <th>Số thuế phải nộp (VND)</th>
                  <th>Đã nộp (VND)</th>
                  <th>Còn phải nộp (VND)</th>
                  <th>Lý do</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {obligations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có nghĩa vụ thuế nào
                    </td>
                  </tr>
                ) : (
                  obligations.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{o.period_code || o.period}</td>
                      <td>
                        <span className="live-tax-tag-pill">{o.tax_type}</span>
                      </td>
                      <td>{o.due_date}</td>
                      <td style={{ fontWeight: "700" }}>{formatNum(o.assessed_amount)}</td>
                      <td style={{ color: "#34d399" }}>{formatNum(o.paid_amount)}</td>
                      <td style={{ fontWeight: "700", color: "#fbbf24" }}>{formatNum(o.outstanding_amount)}</td>
                      <td>{o.reason || "—"}</td>
                      <td>
                        <span className={`live-tax-badge-status ${o.status?.toLowerCase() || "open"}`}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. RECONCILIATIONS TAB */}
        {!loading && activeTab === "reconciliations" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Kỳ đối chiếu</th>
                  <th>Số chênh lệch phát hiện</th>
                  <th>Trạng thái</th>
                  <th>Thời gian đối chiếu</th>
                </tr>
              </thead>
              <tbody>
                {reconciliations.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có phiên đối chiếu dữ liệu thuế
                    </td>
                  </tr>
                ) : (
                  reconciliations.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{r.period_code || r.period}</td>
                      <td style={{ fontWeight: "700", color: r.discrepancy_count > 0 ? "#f87171" : "#34d399" }}>
                        {r.discrepancy_count} chênh lệch
                      </td>
                      <td>
                        <span className="live-tax-badge-status posted">{r.status}</span>
                      </td>
                      <td>{r.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. LINKS TAB */}
        {!loading && activeTab === "links" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Mã HĐ</th>
                  <th>Module gốc</th>
                  <th>Loại chứng từ</th>
                  <th>Số chứng từ</th>
                  <th>Số tiền liên kết</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {documentLinks.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có liên kết chứng từ hóa đơn thuế nào
                    </td>
                  </tr>
                ) : (
                  documentLinks.map((l) => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{l.invoice?.slice(0, 8)}...</td>
                      <td>
                        <span className="live-tax-tag-pill">{l.module_code}</span>
                      </td>
                      <td>{l.entity_type}</td>
                      <td>{l.document_number || "—"}</td>
                      <td style={{ fontWeight: "700", color: "#34d399" }}>{formatNum(l.linked_amount)}</td>
                      <td>{l.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. PERIODS TAB */}
        {!loading && activeTab === "periods" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Mã kỳ kê khai</th>
                  <th>Loại thuế</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có kỳ kê khai thuế nào
                    </td>
                  </tr>
                ) : (
                  periods.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{p.code}</td>
                      <td>{p.tax_type}</td>
                      <td>{p.start_date}</td>
                      <td>{p.end_date}</td>
                      <td>
                        <span className={`live-tax-badge-status ${p.status === "OPEN" ? "active" : "draft"}`}>
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

        {/* 8. EXPORTS TAB */}
        {!loading && activeTab === "exports" && (
          <div className="live-tax-table-card">
            <table className="live-tax-table">
              <thead>
                <tr>
                  <th>Kỳ xuất</th>
                  <th>Định dạng</th>
                  <th>Phiên bản</th>
                  <th>Trạng thái nộp</th>
                  <th>Thời gian xuất</th>
                </tr>
              </thead>
              <tbody>
                {exportsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                      Chưa có tệp kết xuất thuế điện tử nào
                    </td>
                  </tr>
                ) : (
                  exportsList.map((ex) => (
                    <tr key={ex.id}>
                      <td style={{ fontWeight: "700", color: "#f8fafc" }}>{ex.period}</td>
                      <td>
                        <span className="live-tax-tag-pill">{ex.format_code}</span>
                      </td>
                      <td>v{ex.format_version}</td>
                      <td>
                        <span className="live-tax-badge-status posted">{ex.submission_status}</span>
                      </td>
                      <td>{ex.exported_at?.slice(0, 16)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal 1: Create Invoice */}
      {modalType === "create_invoice" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Lập hóa đơn thuế GTGT</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Chiều hóa đơn:</label>
                    <select
                      className="live-tax-select"
                      value={formData.direction}
                      onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    >
                      <option value="INPUT">Đầu vào (Mua hàng)</option>
                      <option value="OUTPUT">Đầu ra (Bán hàng)</option>
                    </select>
                  </div>
                  <div className="live-tax-form-group">
                    <label>Ngày hóa đơn:</label>
                    <input
                      type="date"
                      className="live-tax-input"
                      value={formData.invoice_date}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Ký hiệu mẫu số (Series):</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.invoice_series}
                      onChange={(e) => setFormData({ ...formData, invoice_series: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>Số hóa đơn:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.invoice_number}
                      onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Người bán:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.seller_name}
                      onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>MST Người bán:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.seller_tax_code}
                      onChange={(e) => setFormData({ ...formData, seller_tax_code: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Người mua:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.buyer_name}
                      onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>MST Người mua:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.buyer_tax_code}
                      onChange={(e) => setFormData({ ...formData, buyer_tax_code: e.target.value })}
                    />
                  </div>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Số lượng:</label>
                    <input
                      type="number"
                      className="live-tax-input"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>Đơn giá (chưa thuế):</label>
                    <input
                      type="number"
                      className="live-tax-input"
                      value={formData.unit_price}
                      onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-tax-form-group">
                  <label>Thuế suất GTGT (%):</label>
                  <select
                    className="live-tax-select"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="8">8%</option>
                    <option value="10">10%</option>
                  </select>
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Lưu hóa đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Build Summary */}
      {modalType === "build_summary" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Tổng hợp dữ liệu thuế định kỳ</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleBuildSummary}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-group">
                  <label>Chọn kỳ tính thuế:</label>
                  <select
                    className="live-tax-select"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    required
                  >
                    {refs.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} ({p.start_date} → {p.end_date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Chạy tổng hợp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Create Filing */}
      {modalType === "create_filing" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Lập tờ khai thuế GTGT / TNCN / TNDN</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateFiling}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-group">
                  <label>Chọn kỳ kê khai:</label>
                  <select
                    className="live-tax-select"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    required
                  >
                    {refs.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} ({p.start_date} → {p.end_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-tax-form-group">
                  <label>Loại tờ khai:</label>
                  <select
                    className="live-tax-select"
                    value={formData.filing_type}
                    onChange={(e) => setFormData({ ...formData, filing_type: e.target.value })}
                  >
                    <option value="VAT_RETURN">Tờ khai thuế GTGT (Mẫu 01/GTGT)</option>
                    <option value="PIT_RETURN">Tờ khai thuế TNCN (Mẫu 05/KK-TNCN)</option>
                    <option value="CIT_RETURN">Tờ khai thuế TNDN tạm tính (Mẫu 01/TNDN)</option>
                  </select>
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Tạo tờ khai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Create Obligation */}
      {modalType === "create_obligation" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Khai báo nghĩa vụ thuế NSNN</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateObligation}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Kỳ thuế:</label>
                    <select
                      className="live-tax-select"
                      value={formData.period}
                      onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                      required
                    >
                      {refs.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="live-tax-form-group">
                    <label>Loại thuế:</label>
                    <select
                      className="live-tax-select"
                      value={formData.tax_type}
                      onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                    >
                      <option value="VAT">Thuế GTGT</option>
                      <option value="PIT">Thuế TNCN</option>
                      <option value="CIT">Thuế TNDN</option>
                    </select>
                  </div>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Hạn nộp tiền thuế:</label>
                    <input
                      type="date"
                      className="live-tax-input"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>Số thuế phải nộp (VND):</label>
                    <input
                      type="number"
                      className="live-tax-input"
                      value={formData.assessed_amount}
                      onChange={(e) => setFormData({ ...formData, assessed_amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="live-tax-form-group">
                  <label>Diễn giải / Lý do:</label>
                  <textarea
                    className="live-tax-textarea"
                    rows={2}
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Lưu nghĩa vụ thuế
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Run Reconciliation */}
      {modalType === "run_reconciliation" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Chạy đối chiếu thuế và sổ sách</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRunReconciliation}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-group">
                  <label>Chọn kỳ thuế cần đối chiếu:</label>
                  <select
                    className="live-tax-select"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    required
                  >
                    {refs.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} ({p.start_date} → {p.end_date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Bắt đầu đối chiếu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Export Data */}
      {modalType === "export_data" && (
        <div className="live-tax-modal-backdrop">
          <div className="live-tax-modal">
            <div className="live-tax-modal-header">
              <span>Kết xuất tệp XML kê khai thuế HTKK</span>
              <button
                onClick={() => setModalType(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleExportData}>
              <div className="live-tax-modal-body">
                <div className="live-tax-form-group">
                  <label>Kỳ thuế kết xuất:</label>
                  <select
                    className="live-tax-select"
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    required
                  >
                    {refs.periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} ({p.start_date} → {p.end_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="live-tax-form-row">
                  <div className="live-tax-form-group">
                    <label>Định dạng tệp:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.format_code}
                      onChange={(e) => setFormData({ ...formData, format_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="live-tax-form-group">
                    <label>Phiên bản định dạng:</label>
                    <input
                      type="text"
                      className="live-tax-input"
                      value={formData.format_version}
                      onChange={(e) => setFormData({ ...formData, format_version: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="live-tax-modal-footer">
                <button
                  type="button"
                  className="live-tax-btn live-tax-btn-secondary"
                  onClick={() => setModalType(null)}
                >
                  Hủy
                </button>
                <button data-testid="modal-submit-btn" type="submit" className="live-tax-btn live-tax-btn-primary">
                  Tải tệp kết xuất
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
