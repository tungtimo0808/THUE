import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import "./live-sales.css";

type TabKey =
  | "quotations"
  | "orders"
  | "goods-sales"
  | "service-sales"
  | "sales-returns"
  | "sales-allowances"
  | "sales-invoices"
  | "approvals"
  | "tracking"
  | "cogs"
  | "links"
  | "contracts"
  | "discount-invoices"
  | "commercial-invoices";

interface ReferenceData {
  branches: any[];
  customers: any[];
  paymentTerms: any[];
  currencies: any[];
  items: any[];
  accounts: any[];
  taxRates: any[];
  warehouses: any[];
  contracts: any[];
  orders: any[];
}

export default function LiveSales() {
  const { session } = useApiSession();
  const [activeTab, setActiveTab] = useState<TabKey>("quotations");
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

  // References
  const [refsLoaded, setRefsLoaded] = useState(false);
  const [refs, setRefs] = useState<ReferenceData>({
    branches: [],
    customers: [],
    paymentTerms: [],
    currencies: [],
    items: [],
    accounts: [],
    taxRates: [],
    warehouses: [],
    contracts: [],
    orders: [],
  });

  // Tab Data States
  const [quotations, setQuotations] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [goodsSales, setGoodsSales] = useState<any[]>([]);
  const [serviceSales, setServiceSales] = useState<any[]>([]);
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [salesAllowances, setSalesAllowances] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [trackingList, setTrackingList] = useState<any[]>([]);
  const [cogsList, setCogsList] = useState<any[]>([]);
  const [linksList, setLinksList] = useState<any[]>([]);
  const [contractsList, setContractsList] = useState<any[]>([]);
  const [discountInvoices, setDiscountInvoices] = useState<any[]>([]);
  const [commercialInvoices, setCommercialInvoices] = useState<any[]>([]);

  // Modals & Forms
  const [modalType, setModalType] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  // Fetch references
  const fetchRefs = useCallback(async () => {
    if (!companyId) return;
    try {
      const h = getHeaders();
      const [bRes, pRes, ptRes, curRes, itRes, aRes, trRes, whRes] = await Promise.all([
        fetch(`/api/v1/organization/branches/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/parties/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/payment-terms/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/currencies/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/items/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/accounts/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/tax-rates/?company_id=${companyId}`, { headers: h }),
        fetch(`/api/v1/master-data/warehouses/?company_id=${companyId}`, { headers: h }),
      ]);

      const [b, p, pt, cur, it, a, tr, wh] = await Promise.all([
        bRes.ok ? bRes.json() : [],
        pRes.ok ? pRes.json() : [],
        ptRes.ok ? ptRes.json() : [],
        curRes.ok ? curRes.json() : [],
        itRes.ok ? itRes.json() : [],
        aRes.ok ? aRes.json() : [],
        trRes.ok ? trRes.json() : [],
        whRes.ok ? whRes.json() : [],
      ]);

      setRefs({
        branches: Array.isArray(b) ? b : b.results || [],
        customers: Array.isArray(p) ? p : p.results || [],
        paymentTerms: Array.isArray(pt) ? pt : pt.results || [],
        currencies: Array.isArray(cur) ? cur : cur.results || [],
        items: Array.isArray(it) ? it : it.results || [],
        accounts: Array.isArray(a) ? a : a.results || [],
        taxRates: Array.isArray(tr) ? tr : tr.results || [],
        warehouses: Array.isArray(wh) ? wh : wh.results || [],
        contracts: [],
        orders: [],
      });
      setRefsLoaded(true);
    } catch (e) {
      console.error("Error loading Sales references:", e);
    }
  }, [companyId, getHeaders]);

  // Load Active Tab Data
  const loadTabData = useCallback(
    async (tab = activeTab) => {
      if (!companyId) return;
      setLoading(true);
      const h = getHeaders();

      try {
        if (tab === "quotations") {
          const res = await fetch(`/api/v1/sales/quotations/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setQuotations(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "orders") {
          const res = await fetch(`/api/v1/sales/orders/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setOrders(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "goods-sales") {
          const res = await fetch(`/api/v1/sales/goods-sales/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setGoodsSales(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "service-sales") {
          const res = await fetch(`/api/v1/sales/service-sales/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setServiceSales(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "sales-returns") {
          const [res, gsRes] = await Promise.all([
            fetch(`/api/v1/sales/sales-returns/?company_id=${companyId}`, { headers: h }),
            fetch(`/api/v1/sales/goods-sales/?company_id=${companyId}`, { headers: h }),
          ]);
          if (res.ok) {
            const data = await res.json();
            setSalesReturns(Array.isArray(data) ? data : data.results || []);
          }
          if (gsRes.ok) {
            const gsData = await gsRes.json();
            setGoodsSales(Array.isArray(gsData) ? gsData : gsData.results || []);
          }
        } else if (tab === "sales-allowances") {
          const [res, gsRes] = await Promise.all([
            fetch(`/api/v1/sales/sales-allowances/?company_id=${companyId}`, { headers: h }),
            fetch(`/api/v1/sales/goods-sales/?company_id=${companyId}`, { headers: h }),
          ]);
          if (res.ok) {
            const data = await res.json();
            setSalesAllowances(Array.isArray(data) ? data : data.results || []);
          }
          if (gsRes.ok) {
            const gsData = await gsRes.json();
            setGoodsSales(Array.isArray(gsData) ? gsData : gsData.results || []);
          }
        } else if (tab === "sales-invoices") {
          const res = await fetch(`/api/v1/sales/sales-invoices/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setSalesInvoices(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "approvals") {
          const res = await fetch(`/api/v1/sales/approvals/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setApprovals(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "tracking") {
          const res = await fetch(`/api/v1/sales/tracking/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setTrackingList(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "cogs") {
          const res = await fetch(`/api/v1/sales/cogs/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setCogsList(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "links") {
          const res = await fetch(`/api/v1/sales/links/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setLinksList(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "contracts") {
          const res = await fetch(`/api/v1/sales/contracts/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setContractsList(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "discount-invoices") {
          const res = await fetch(`/api/v1/sales/discount-invoices/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setDiscountInvoices(Array.isArray(data) ? data : data.results || []);
          }
        } else if (tab === "commercial-invoices") {
          const res = await fetch(`/api/v1/sales/commercial-invoices/?company_id=${companyId}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            setCommercialInvoices(Array.isArray(data) ? data : data.results || []);
          }
        }
      } catch (err: any) {
        setNotice({ type: "error", text: `Lỗi tải dữ liệu: ${err.message}` });
      } finally {
        setLoading(false);
      }
    },
    [activeTab, companyId, getHeaders]
  );

  useEffect(() => {
    if (companyId && token) {
      fetchRefs();
      loadTabData();
    }
  }, [companyId, token, fetchRefs, loadTabData]);

  // Action Handlers
  const handleDocAction = async (endpoint: string, id: string, action: string, extraBody = {}) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/sales/${endpoint}/${id}/${action}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(extraBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
      setNotice({ type: "success", text: `Thao tác [${action}] thành công!` });
      loadTabData();
    } catch (err: any) {
      console.error("handleDocAction ERROR:", endpoint, id, action, err.message);
      setNotice({ type: "error", text: `Thao tác thất bại: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (endpoint: string, payload: any) => {
    try {
      setLoading(true);
      console.log("PAYLOAD FOR", endpoint, JSON.stringify(payload));
      const res = await fetch(`/api/v1/sales/${endpoint}/?company_id=${companyId}`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data === "string" ? data : JSON.stringify(data));
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

  const handleCreateDiscountInvoice = async () => {
    try {
      setLoading(true);
      const url = `/api/v1/sales/discount-invoices/eligible-invoices/?company_id=${companyId}&customer=${defaultCustomer}&period_start=2026-01-01&period_end=2026-12-31`;
      const res = await fetch(url, { headers: getHeaders() });
      const eligibleData = await res.json();
      if (!res.ok) throw new Error(eligibleData.detail || JSON.stringify(eligibleData));

      if (!eligibleData.lines || eligibleData.lines.length === 0) {
        setNotice({
          type: "info",
          text: "Chưa có hóa đơn bán hàng đã phát hành nào trong kỳ để trích chiết khấu. Hãy phát hành hóa đơn đầu ra ở Tab 7 trước!",
        });
        return;
      }

      const targetLine = eligibleData.lines[0];
      const allocAmount = Math.min(100000, Number(targetLine.eligible_revenue || 100000));
      const payload = {
        company: companyId,
        branch: defaultBranch,
        customer: defaultCustomer,
        invoice_series: "1C26TBB",
        template_code: "1/001",
        invoice_date: new Date().toISOString().split("T")[0],
        discount_basis: "Chiết khấu doanh số sản phẩm kỳ 2026",
        period_start: "2026-01-01",
        period_end: "2026-12-31",
        calculation_method: "AMOUNT",
        currency: defaultCurrency,
        lines: [
          {
            original_invoice: targetLine.original_invoice_id,
            original_invoice_line: targetLine.original_invoice_line_id,
            item: targetLine.item_id || defaultGoodsItem?.id,
            description: "Chiết khấu thương mại kỳ",
            eligible_revenue: targetLine.eligible_revenue,
            allocated_discount_amount: allocAmount,
            tax_rate: targetLine.tax_rate_id || defaultTaxRate,
            tax_rate_percentage: targetLine.tax_rate_percentage || 10,
          },
        ],
      };

      await handleCreateDocument("discount-invoices", payload);
    } catch (err: any) {
      setNotice({ type: "error", text: `Lỗi lập hóa đơn chiết khấu: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  // Helper defaults
  const defaultCustomer = refs.customers.find((c) => c.code === "FE-DEMO-001")?.id || refs.customers[0]?.id || "";
  const defaultBranch = refs.branches[0]?.id || "";
  const defaultPaymentTerm = refs.paymentTerms[0]?.id || "";
  const defaultCurrency = refs.currencies[0]?.id || "";
  const defaultGoodsItem = refs.items.find((i) => i.item_type === "GOODS") || refs.items[0];
  const defaultServiceItem = refs.items.find((i) => i.item_type === "SERVICE") || refs.items[0];
  const defaultTaxRate = refs.taxRates[0]?.id || "";
  const defaultWarehouse = refs.warehouses[0]?.id || "";

  // Accounts
  const acc131 = refs.accounts.find((a) => a.code === "131")?.id || "";
  const acc5111 = refs.accounts.find((a) => a.code === "5111")?.id || "";
  const acc5112 = refs.accounts.find((a) => a.code === "5112")?.id || "";
  const acc33311 = refs.accounts.find((a) => a.code === "33311")?.id || "";
  const acc632 = refs.accounts.find((a) => a.code === "632")?.id || "";
  const acc1561 = refs.accounts.find((a) => a.code === "1561")?.id || "";

  return (
    <div className="live-sal-root">
      {/* Header */}
      <header className="live-sal-header">
        <div className="live-sal-title-box">
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <span style={{ fontSize: 13, color: "#8b949e", cursor: "pointer" }}>← Quay lại</span>
          </Link>
          <div className="live-sal-title">
            <span>Phân hệ Quản lý Bán hàng (Sales Management)</span>
            <span className="live-sal-badge">Live API (UC-SAL-01 → 17)</span>
          </div>
        </div>

        <div className="live-sal-company-info">
          <span>Doanh nghiệp:</span>
          <span className="live-sal-company-tag">{session?.company?.name || "Chưa chọn"}</span>
          <span>Phạm vi: {session?.branch?.name || "Toàn công ty"}</span>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="live-sal-nav">
        <button
          className={`live-sal-nav-btn ${activeTab === "quotations" ? "active" : ""}`}
          id="tab-sal-quotations"
          onClick={() => {
            setActiveTab("quotations");
            loadTabData("quotations");
          }}
        >
          1. Báo giá (SAL-01)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "orders" ? "active" : ""}`}
          id="tab-sal-orders"
          onClick={() => {
            setActiveTab("orders");
            loadTabData("orders");
          }}
        >
          2. Đơn bán hàng (SAL-02/17)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "goods-sales" ? "active" : ""}`}
          id="tab-sal-goods-sales"
          onClick={() => {
            setActiveTab("goods-sales");
            loadTabData("goods-sales");
          }}
        >
          3. Bán hàng hóa (SAL-03)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "service-sales" ? "active" : ""}`}
          id="tab-sal-service-sales"
          onClick={() => {
            setActiveTab("service-sales");
            loadTabData("service-sales");
          }}
        >
          4. Bán dịch vụ (SAL-04)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "sales-returns" ? "active" : ""}`}
          id="tab-sal-sales-returns"
          onClick={() => {
            setActiveTab("sales-returns");
            loadTabData("sales-returns");
          }}
        >
          5. Hàng bán trả lại (SAL-05)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "sales-allowances" ? "active" : ""}`}
          id="tab-sal-sales-allowances"
          onClick={() => {
            setActiveTab("sales-allowances");
            loadTabData("sales-allowances");
          }}
        >
          6. Giảm giá hàng bán (SAL-06)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "sales-invoices" ? "active" : ""}`}
          id="tab-sal-sales-invoices"
          onClick={() => {
            setActiveTab("sales-invoices");
            loadTabData("sales-invoices");
          }}
        >
          7. Hóa đơn đầu ra (SAL-07/15)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "approvals" ? "active" : ""}`}
          id="tab-sal-approvals"
          onClick={() => {
            setActiveTab("approvals");
            loadTabData("approvals");
          }}
        >
          8. Phê duyệt (SAL-08)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "tracking" ? "active" : ""}`}
          id="tab-sal-tracking"
          onClick={() => {
            setActiveTab("tracking");
            loadTabData("tracking");
          }}
        >
          9. Tiến độ đơn bán (SAL-09)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "cogs" ? "active" : ""}`}
          id="tab-sal-cogs"
          onClick={() => {
            setActiveTab("cogs");
            loadTabData("cogs");
          }}
        >
          10. Giá vốn (SAL-10)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "links" ? "active" : ""}`}
          id="tab-sal-links"
          onClick={() => {
            setActiveTab("links");
            loadTabData("links");
          }}
        >
          11. Liên kết chứng từ (SAL-11)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "contracts" ? "active" : ""}`}
          id="tab-sal-contracts"
          onClick={() => {
            setActiveTab("contracts");
            loadTabData("contracts");
          }}
        >
          12. Hợp đồng (SAL-12)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "discount-invoices" ? "active" : ""}`}
          id="tab-sal-discount-invoices"
          onClick={() => {
            setActiveTab("discount-invoices");
            loadTabData("discount-invoices");
          }}
        >
          13. HĐ Chiết khấu (SAL-13)
        </button>
        <button
          className={`live-sal-nav-btn ${activeTab === "commercial-invoices" ? "active" : ""}`}
          id="tab-sal-commercial-invoices"
          onClick={() => {
            setActiveTab("commercial-invoices");
            loadTabData("commercial-invoices");
          }}
        >
          14. HĐ Thương mại (SAL-14)
        </button>
      </nav>

      {/* Metrics Banner */}
      <div className="live-sal-metrics-grid">
        <div className="stat-card">
          <span className="stat-title">Báo giá đang mở</span>
          <span className="stat-value">{quotations.length}</span>
          <span className="stat-sub">Báo giá khách hàng</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Đơn bán hàng</span>
          <span className="stat-value">{orders.length}</span>
          <span className="stat-sub">Đơn hàng đã lập</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Chứng từ bán hàng hóa</span>
          <span className="stat-value">{goodsSales.length}</span>
          <span className="stat-sub">Hàng hóa xuất bán</span>
        </div>
        <div className="stat-card">
          <span className="stat-title">Hóa đơn phát hành</span>
          <span className="stat-value">{salesInvoices.length}</span>
          <span className="stat-sub">Hóa đơn điện tử</span>
        </div>
      </div>

      {/* Global Notice */}
      {notice && (
        <div className={`live-sal-notice ${notice.type}`}>
          {notice.text}
          <button
            onClick={() => setNotice(null)}
            style={{ float: "right", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB CONTENTS */}
      <main>
        {/* ======================================================== */}
        {/* TAB 1: UC-SAL-01 – Báo giá bán hàng                      */}
        {/* ======================================================== */}
        {activeTab === "quotations" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Quản lý quy trình lập, phát hành, duyệt và gửi báo giá cho khách hàng (UC-SAL-01).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-quotation"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      document_date: new Date().toISOString().split("T")[0],
                      valid_until: new Date(Date.now() + 86400000 * 15).toISOString().split("T")[0],
                      currency: defaultCurrency,
                      payment_term: defaultPaymentTerm,
                      lines: [
                        {
                          item: defaultGoodsItem?.id,
                          quantity: 5,
                          unit_price: 1500000,
                          tax_rate: defaultTaxRate,
                          discount_rate: 0,
                        },
                      ],
                    });
                    setModalType("create_quotation");
                  }}
                >
                  + Lập Báo giá mới
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("quotations")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Báo giá (UC-SAL-01)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {quotations.length} báo giá</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số báo giá</th>
                      <th>Ngày lập</th>
                      <th>Hạn hiệu lực</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có báo giá nào. Nhấn "+ Lập Báo giá mới" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      quotations.map((q) => (
                        <tr key={q.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{q.number || q.id.slice(0, 8)}</td>
                          <td>{q.document_date}</td>
                          <td>{q.valid_until}</td>
                          <td>{q.customer_name || q.customer?.name || "Khách hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(q.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(q.status || "").toLowerCase()}`}>{q.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {q.status === "DRAFT" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-accent"
                                  onClick={() => handleDocAction("quotations", q.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {q.status === "PENDING_APPROVAL" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("quotations", q.id, "approve")}
                                >
                                  Duyệt
                                </button>
                              )}
                              {q.status === "APPROVED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("quotations", q.id, "issue")}
                                >
                                  Phát hành
                                </button>
                              )}
                              {q.status === "ISSUED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-accent"
                                  onClick={() => handleDocAction("quotations", q.id, "accept-response")}
                                >
                                  Khách chấp nhận
                                </button>
                              )}
                              <button
                                className="live-sal-btn live-sal-btn-sm live-sal-btn-danger"
                                onClick={() => handleDocAction("quotations", q.id, "cancel")}
                              >
                                Hủy
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
        {/* TAB 2: UC-SAL-02 – Đơn bán hàng & UC-SAL-17 Tính giá bán  */}
        {/* ======================================================== */}
        {activeTab === "orders" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Tiếp nhận, xử lý đơn bán hàng, tự động tính giá và quản lý cam kết giao dịch (UC-SAL-02, UC-SAL-17).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-order"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      document_date: new Date().toISOString().split("T")[0],
                      requested_delivery_date: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
                      currency: defaultCurrency,
                      payment_term: defaultPaymentTerm,
                      delivery_address: "123 Đường Bán Hàng, Quận 1, TP.HCM",
                      default_warehouse: defaultWarehouse,
                      lines: [
                        {
                          item: defaultGoodsItem?.id,
                          warehouse: defaultWarehouse,
                          quantity: 10,
                          unit_price: 1500000,
                          tax_rate: defaultTaxRate,
                          discount_rate: 5,
                        },
                      ],
                    });
                    setModalType("create_order");
                  }}
                >
                  + Lập Đơn bán hàng (SO)
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("orders")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Đơn bán hàng (UC-SAL-02)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {orders.length} đơn</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số đơn hàng</th>
                      <th>Ngày đặt</th>
                      <th>Hạn giao</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Tiến độ giao</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có đơn hàng nào. Nhấn "+ Lập Đơn bán hàng (SO)" để tạo mới.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{o.number || o.id.slice(0, 8)}</td>
                          <td>{o.document_date}</td>
                          <td>{o.requested_delivery_date || "—"}</td>
                          <td>{o.customer_name || o.customer?.name || "Khách hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(o.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 60, height: 6, background: "#21262d", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${o.delivery_progress || 0}%`, height: "100%", background: "#3fb950" }} />
                              </div>
                              <span style={{ fontSize: 11 }}>{o.delivery_progress || 0}%</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${String(o.status || "").toLowerCase()}`}>{o.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {o.status === "DRAFT" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-accent"
                                  onClick={() => handleDocAction("orders", o.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {o.status === "PENDING_APPROVAL" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("orders", o.id, "approve")}
                                >
                                  Duyệt
                                </button>
                              )}
                              {o.status !== "CANCELLED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-danger"
                                  onClick={() => handleDocAction("orders", o.id, "cancel", { reason: "Người dùng hủy" })}
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
        {/* TAB 3: UC-SAL-03 – Ghi nhận bán hàng hóa                 */}
        {/* ======================================================== */}
        {activeTab === "goods-sales" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Ghi nhận bán hàng hóa, xuất kho kiêm ghi nhận doanh thu và công nợ phải thu (UC-SAL-03).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-goods-sale"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      currency: defaultCurrency,
                      payment_type: "UNPAID",
                      payment_term: defaultPaymentTerm,
                      inventory_handling: "ATTACH_ISSUE",
                      lines: [
                        {
                          line_no: 1,
                          item: defaultGoodsItem?.id,
                          uom: defaultGoodsItem?.base_uom || refs.items[0]?.base_uom,
                          warehouse: defaultWarehouse,
                          description: "Bán hàng hóa thành phẩm",
                          quantity: 2,
                          unit_price: 1500000,
                          tax_rate: defaultTaxRate,
                          receivable_or_payment_account: acc131,
                          revenue_account: acc5111,
                          tax_account: acc33311,
                          cogs_account: acc632,
                          inventory_account: acc1561,
                        },
                      ],
                    });
                    setModalType("create_goods_sale");
                  }}
                >
                  + Lập Chứng từ Bán hàng hóa
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("goods-sales")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Bán hàng hóa (UC-SAL-03)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {goodsSales.length} chứng từ</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày hạch toán</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goodsSales.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ bán hàng hóa nào.
                        </td>
                      </tr>
                    ) : (
                      goodsSales.map((gs) => (
                        <tr key={gs.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{gs.number || gs.id.slice(0, 8)}</td>
                          <td>{gs.posting_date}</td>
                          <td>{gs.customer_name || gs.customer?.name || "Khách hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(gs.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(gs.status || "").toLowerCase()}`}>{gs.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {gs.status === "DRAFT" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm"
                                  onClick={() => handleDocAction("goods-sales", gs.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {gs.status === "PENDING_APPROVAL" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("goods-sales", gs.id, "approve")}
                                >
                                  Duyệt
                                </button>
                              )}
                              {gs.status === "APPROVED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("goods-sales", gs.id, "post")}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {gs.status === "POSTED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm"
                                  onClick={() => handleDocAction("goods-sales", gs.id, "unpost")}
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
        {/* TAB 4: UC-SAL-04 – Ghi nhận bán dịch vụ                  */}
        {/* ======================================================== */}
        {activeTab === "service-sales" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Ghi nhận cung cấp dịch vụ hoàn thành, biên bản nghiệm thu và hạch toán doanh thu dịch vụ (UC-SAL-04).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-service-sale"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      currency: defaultCurrency,
                      payment_type: "UNPAID",
                      payment_term: defaultPaymentTerm,
                      lines: [
                        {
                          line_no: 1,
                          item: defaultServiceItem?.id,
                          uom: defaultServiceItem?.base_uom || refs.items[0]?.base_uom,
                          description: "Dịch vụ tư vấn triển khai kỹ thuật tháng 10/2026",
                          quantity: 1,
                          unit_price: 2000000,
                          tax_rate: defaultTaxRate,
                          receivable_or_payment_account: acc131,
                          revenue_account: acc5112,
                          tax_account: acc33311,
                        },
                      ],
                    });
                    setModalType("create_service_sale");
                  }}
                >
                  + Lập Chứng từ Bán dịch vụ
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("service-sales")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Bán dịch vụ (UC-SAL-04)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {serviceSales.length} chứng từ</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày hạch toán</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceSales.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ bán dịch vụ nào.
                        </td>
                      </tr>
                    ) : (
                      serviceSales.map((ss) => (
                        <tr key={ss.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{ss.number || ss.id.slice(0, 8)}</td>
                          <td>{ss.posting_date}</td>
                          <td>{ss.customer_name || ss.customer?.name || "Khách hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(ss.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(ss.status || "").toLowerCase()}`}>{ss.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {ss.status === "DRAFT" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm"
                                  onClick={() => handleDocAction("service-sales", ss.id, "submit")}
                                >
                                  Gửi duyệt
                                </button>
                              )}
                              {ss.status === "PENDING_APPROVAL" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("service-sales", ss.id, "approve")}
                                >
                                  Duyệt
                                </button>
                              )}
                              {ss.status === "APPROVED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("service-sales", ss.id, "post")}
                                >
                                  Ghi sổ
                                </button>
                              )}
                              {ss.status === "POSTED" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm"
                                  onClick={() => handleDocAction("service-sales", ss.id, "unpost")}
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
        {/* TAB 5: UC-SAL-05 – Hàng bán trả lại                      */}
        {/* ======================================================== */}
        {activeTab === "sales-returns" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Ghi nhận hàng bán bị trả lại từ khách hàng, điều chỉnh giảm doanh thu và nhập kho (UC-SAL-05).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-sales-return"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const targetSale = goodsSales.find((gs) => gs.status === "POSTED") || goodsSales[0];
                    const targetLine = targetSale?.lines?.[0];
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: targetSale?.customer || defaultCustomer,
                      goods_sale: targetSale?.id,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      return_reason: "Hàng lỗi kỹ thuật theo biên bản kiểm tra",
                      inventory_handling: "ATTACH_INWARD",
                      currency: defaultCurrency,
                      lines: targetLine
                        ? [
                            {
                              goods_sale_line_id: targetLine.id,
                              return_quantity: "1",
                              warehouse_id: targetLine.warehouse || defaultWarehouse,
                            },
                          ]
                        : [],
                    });
                    setModalType("create_sales_return");
                  }}
                >
                  + Lập Chứng từ Hàng bán trả lại
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("sales-returns")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hàng bán trả lại (UC-SAL-05)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {salesReturns.length} chứng từ</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Khách hàng</th>
                      <th>Lý do trả lại</th>
                      <th>Tổng tiền hoàn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesReturns.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ hàng bán trả lại nào.
                        </td>
                      </tr>
                    ) : (
                      salesReturns.map((sr) => (
                        <tr key={sr.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{sr.number || sr.id.slice(0, 8)}</td>
                          <td>{sr.document_date}</td>
                          <td>{sr.customer_name || sr.customer?.name || "Khách hàng"}</td>
                          <td>{sr.return_reason || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#f85149" }}>
                            {Number(sr.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(sr.status || "").toLowerCase()}`}>{sr.status}</span>
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
        {/* TAB 6: UC-SAL-06 – Giảm giá hàng bán                     */}
        {/* ======================================================== */}
        {activeTab === "sales-allowances" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Ghi nhận các khoản giảm giá hàng bán do thỏa thuận hoặc chất lượng không đạt yêu cầu (UC-SAL-06).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-sales-allowance"
                  disabled={!refsLoaded}
                  onClick={() => {
                    const targetSale = goodsSales.find((gs) => gs.status === "POSTED") || goodsSales[0];
                    const targetLine = targetSale?.lines?.[0];
                    const acc5213 = refs.accounts.find((a) => a.code === "5213")?.id || acc5111;
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: targetSale?.customer || defaultCustomer,
                      goods_sale: targetSale?.id,
                      document_date: new Date().toISOString().split("T")[0],
                      posting_date: new Date().toISOString().split("T")[0],
                      allowance_reason: "Giảm giá thỏa thuận do giao hàng trễ",
                      currency: defaultCurrency,
                      lines: targetLine
                        ? [
                            {
                              goods_sale_line: targetLine.id,
                              entry_method: "BY_AMOUNT",
                              allowance_amount: "200000",
                              revenue_deduction_account: acc5213,
                              tax_account: acc33311,
                              receivable_account: acc131,
                            },
                          ]
                        : [],
                    });
                    setModalType("create_sales_allowance");
                  }}
                >
                  + Lập Chứng từ Giảm giá
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("sales-allowances")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Giảm giá hàng bán (UC-SAL-06)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {salesAllowances.length} chứng từ</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Khách hàng</th>
                      <th>Lý do giảm giá</th>
                      <th>Tổng giảm giá</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesAllowances.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ giảm giá hàng bán nào.
                        </td>
                      </tr>
                    ) : (
                      salesAllowances.map((sa) => (
                        <tr key={sa.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{sa.number || sa.id.slice(0, 8)}</td>
                          <td>{sa.document_date}</td>
                          <td>{sa.customer_name || sa.customer?.name || "Khách hàng"}</td>
                          <td>{sa.allowance_reason || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#d29922" }}>
                            {Number(sa.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(sa.status || "").toLowerCase()}`}>{sa.status}</span>
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
        {/* TAB 7: UC-SAL-07 – Lập hóa đơn đầu ra & UC-SAL-15 Tự động*/}
        {/* ======================================================== */}
        {activeTab === "sales-invoices" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Phát hành hóa đơn điện tử đầu ra và tự động hạch toán doanh thu, thuế GTGT (UC-SAL-07, UC-SAL-15).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-sales-invoice"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      invoice_date: new Date().toISOString().split("T")[0],
                      currency: defaultCurrency,
                      buyer_name: "Công ty Cổ phần Khách Hàng Tiêu Biểu",
                      buyer_tax_code: "0109998888",
                      lines: [
                        {
                          item: defaultGoodsItem?.id,
                          uom: defaultGoodsItem?.base_uom || refs.items[0]?.base_uom,
                          description: "Hàng hóa tiêu biểu xuất bán",
                          quantity: 2,
                          unit_price: 1500000,
                          tax_rate: defaultTaxRate,
                        },
                      ],
                    });
                    setModalType("create_sales_invoice");
                  }}
                >
                  + Lập Hóa đơn đầu ra
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("sales-invoices")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hóa đơn đầu ra (UC-SAL-07)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {salesInvoices.length} hóa đơn</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số hóa đơn</th>
                      <th>Ngày hóa đơn</th>
                      <th>Khách hàng</th>
                      <th>Mã số thuế</th>
                      <th>Tổng thanh toán</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có hóa đơn nào được lập.
                        </td>
                      </tr>
                    ) : (
                      salesInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{inv.invoice_number || inv.number || inv.id.slice(0, 8)}</td>
                          <td>{inv.invoice_date}</td>
                          <td>{inv.customer_name || inv.buyer_name}</td>
                          <td>{inv.buyer_tax_code || "—"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(inv.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(inv.status || "").toLowerCase()}`}>{inv.status}</span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              {inv.status === "DRAFT" && (
                                <button
                                  className="live-sal-btn live-sal-btn-sm live-sal-btn-primary"
                                  onClick={() => handleDocAction("sales-invoices", inv.id, "issue")}
                                >
                                  Phát hành HĐ
                                </button>
                              )}
                              <button
                                className="live-sal-btn live-sal-btn-sm live-sal-btn-danger"
                                onClick={() => handleDocAction("sales-invoices", inv.id, "cancel")}
                              >
                                Hủy HĐ
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
        {/* TAB 8: UC-SAL-08 – Phê duyệt chứng từ bán hàng           */}
        {/* ======================================================== */}
        {activeTab === "approvals" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Trung tâm xử lý và giám sát quyết định phê duyệt chứng từ bán hàng (UC-SAL-08).
              </span>
              <button className="live-sal-btn" onClick={() => loadTabData("approvals")}>
                Làm mới
              </button>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Nhật ký Quyết định Phê duyệt (UC-SAL-08)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {approvals.length} quyết định</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Loại chứng từ</th>
                      <th>Mã chứng từ</th>
                      <th>Người duyệt</th>
                      <th>Quyết định</th>
                      <th>Ý kiến / Ghi chú</th>
                      <th>Thời gian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvals.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có sự kiện phê duyệt nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      approvals.map((ap) => (
                        <tr key={ap.id}>
                          <td>{ap.document_type || "Chứng từ bán hàng"}</td>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{String(ap.document_id).slice(0, 8)}</td>
                          <td>{ap.actor?.display_name || ap.actor?.email || "Người duyệt"}</td>
                          <td>
                            <span className={`status-pill ${String(ap.decision || "").toLowerCase()}`}>{ap.decision}</span>
                          </td>
                          <td>{ap.comment || "—"}</td>
                          <td>{ap.created_at ? new Date(ap.created_at).toLocaleString("vi-VN") : "—"}</td>
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
        {/* TAB 9: UC-SAL-09 – Theo dõi thực hiện đơn bán            */}
        {/* ======================================================== */}
        {activeTab === "tracking" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Bảng điều khiển theo dõi tiến độ tổng thể đơn bán: Đặt hàng → Giao nhận → Hóa đơn → Thu tiền (UC-SAL-09).
              </span>
              <button className="live-sal-btn" onClick={() => loadTabData("tracking")}>
                Làm mới
              </button>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Theo dõi Tiến độ Đơn bán hàng (UC-SAL-09)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {trackingList.length} đơn</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số đơn hàng</th>
                      <th>Khách hàng</th>
                      <th>Giá trị đơn</th>
                      <th>Giá trị đã giao</th>
                      <th>Giá trị đã xuất HĐ</th>
                      <th>Đã thu tiền</th>
                      <th>Trạng thái tổng hợp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có đơn hàng nào trong danh sách theo dõi.
                        </td>
                      </tr>
                    ) : (
                      trackingList.map((tr) => (
                        <tr key={tr.order_id || tr.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{tr.order_number || tr.number}</td>
                          <td>{tr.customer_name}</td>
                          <td style={{ fontWeight: 700 }}>{Number(tr.order_total || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#3fb950" }}>{Number(tr.delivered_value || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#58a6ff" }}>{Number(tr.invoiced_value || 0).toLocaleString("vi-VN")} đ</td>
                          <td style={{ color: "#d29922" }}>{Number(tr.collected_value || 0).toLocaleString("vi-VN")} đ</td>
                          <td>
                            <span className="status-pill approved">{tr.fulfillment_status || "Đang xử lý"}</span>
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
        {/* TAB 10: UC-SAL-10 – Ghi nhận giá vốn hàng bán (COGS)     */}
        {/* ======================================================== */}
        {activeTab === "cogs" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Ghi nhận và hạch toán giá vốn hàng bán tương ứng với doanh thu ghi nhận (UC-SAL-10).
              </span>
              <button className="live-sal-btn" onClick={() => loadTabData("cogs")}>
                Làm mới
              </button>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Chứng từ Giá vốn hàng bán (UC-SAL-10)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {cogsList.length} chứng từ</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày hạch toán</th>
                      <th>Kho xuất</th>
                      <th>Tổng giá vốn</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cogsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có chứng từ giá vốn hàng bán nào.
                        </td>
                      </tr>
                    ) : (
                      cogsList.map((cg) => (
                        <tr key={cg.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{cg.number || cg.id.slice(0, 8)}</td>
                          <td>{cg.posting_date}</td>
                          <td>{cg.warehouse_name || "Kho hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(cg.total_cogs_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(cg.status || "").toLowerCase()}`}>{cg.status}</span>
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
        {/* TAB 11: UC-SAL-11 – Liên kết chứng từ bán hàng           */}
        {/* ======================================================== */}
        {activeTab === "links" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Quản lý mối quan hệ liên kết và truy vết chuỗi chứng từ bán hàng (UC-SAL-11).
              </span>
              <button className="live-sal-btn" onClick={() => loadTabData("links")}>
                Làm mới
              </button>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Chuỗi Liên kết Chứng từ (UC-SAL-11)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {linksList.length} liên kết</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số liên kết</th>
                      <th>Chứng từ nguồn</th>
                      <th>Chứng từ đích</th>
                      <th>Mối quan hệ</th>
                      <th>Chế độ</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linksList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có liên kết chứng từ nào.
                        </td>
                      </tr>
                    ) : (
                      linksList.map((lk) => (
                        <tr key={lk.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{lk.link_number || lk.id.slice(0, 8)}</td>
                          <td>{lk.source_document_type} #{lk.source_document_number}</td>
                          <td>{lk.target_document_type} #{lk.target_document_number}</td>
                          <td>{lk.relation_type_display || lk.relation_type}</td>
                          <td>{lk.link_mode_display || lk.link_mode}</td>
                          <td>
                            <span className={`status-pill ${String(lk.status || "").toLowerCase()}`}>{lk.status}</span>
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
        {/* TAB 12: UC-SAL-12 – Quản lý hợp đồng bán hàng            */}
        {/* ======================================================== */}
        {activeTab === "contracts" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Quản lý hợp đồng bán hàng, phụ lục hợp đồng, ký kết và thanh lý (UC-SAL-12).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-contract"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      contract_number: `HDBH-2026-${Date.now().toString().slice(-4)}`,
                      title: "Hợp đồng cung cấp trang thiết bị và dịch vụ giải pháp",
                      customer_representative: "Nguyễn Văn Đại Diện",
                      customer_representative_position: "Giám đốc",
                      company_signer_name: "Trần Giám Đốc",
                      company_signer_position: "Tổng Giám Đốc",
                      start_date: new Date().toISOString().split("T")[0],
                      end_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
                      currency: defaultCurrency,
                      payment_term: defaultPaymentTerm,
                      payment_terms_text: "Thanh toán 100% trong vòng 30 ngày sau khi bàn giao",
                      delivery_terms: "Giao hàng và nghiệm thu tại kho bên mua",
                      lines: [
                        {
                          line_no: 1,
                          item: defaultGoodsItem?.id,
                          uom: defaultGoodsItem?.base_uom || refs.items[0]?.base_uom,
                          quantity: 20,
                          unit_price: 1500000,
                          tax_rate: defaultTaxRate,
                          expected_delivery_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                        },
                      ],
                    });
                    setModalType("create_contract");
                  }}
                >
                  + Lập Hợp đồng bán mới
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("contracts")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hợp đồng bán hàng (UC-SAL-12)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {contractsList.length} hợp đồng</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số hợp đồng</th>
                      <th>Tên hợp đồng</th>
                      <th>Khách hàng</th>
                      <th>Ngày ký</th>
                      <th>Tổng giá trị</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có hợp đồng nào. Nhấn "+ Lập Hợp đồng bán mới" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      contractsList.map((ct) => (
                        <tr key={ct.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{ct.contract_number}</td>
                          <td>{ct.contract_name}</td>
                          <td>{ct.customer_name || ct.customer?.name || "Khách hàng"}</td>
                          <td>{ct.signed_date}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(ct.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(ct.status || "").toLowerCase()}`}>{ct.status}</span>
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
        {/* TAB 13: UC-SAL-13 – Hóa đơn chiết khấu                   */}
        {/* ======================================================== */}
        {activeTab === "discount-invoices" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Lập hóa đơn điều chỉnh chiết khấu thương mại kỳ theo doanh số bán hàng (UC-SAL-13).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-discount-invoice"
                  disabled={!refsLoaded}
                  onClick={handleCreateDiscountInvoice}
                >
                  + Lập HĐ Chiết khấu (từ HĐ phát hành)
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("discount-invoices")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hóa đơn Chiết khấu (UC-SAL-13)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {discountInvoices.length} hóa đơn</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số chứng từ</th>
                      <th>Ngày lập</th>
                      <th>Khách hàng</th>
                      <th>Tổng chiết khấu</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discountInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có hóa đơn chiết khấu nào.
                        </td>
                      </tr>
                    ) : (
                      discountInvoices.map((di) => (
                        <tr key={di.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{di.number || di.id.slice(0, 8)}</td>
                          <td>{di.invoice_date}</td>
                          <td>{di.customer_name || "Khách hàng"}</td>
                          <td style={{ fontWeight: 700, color: "#d29922" }}>
                            {Number(di.total_discount_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(di.status || "").toLowerCase()}`}>{di.status}</span>
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
        {/* TAB 14: UC-SAL-14 – Hóa đơn thương mại                   */}
        {/* ======================================================== */}
        {activeTab === "commercial-invoices" && (
          <div>
            <div className="live-sal-toolbar">
              <span style={{ fontSize: 13, color: "#8b949e" }}>
                Lập hóa đơn thương mại (Commercial Invoice) phục vụ giao dịch xuất khẩu & thông quan (UC-SAL-14).
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="live-sal-btn live-sal-btn-primary"
                  id="btn-create-commercial-invoice"
                  disabled={!refsLoaded}
                  onClick={() => {
                    setFormData({
                      company: companyId,
                      branch: defaultBranch,
                      customer: defaultCustomer,
                      buyer_name: "Global Trading Partner Ltd.",
                      buyer_address: "100 Singapore Straits Blvd, Singapore",
                      buyer_country: "Singapore",
                      payment_terms: "T/T in advance within 30 days",
                      currency: defaultCurrency,
                      invoice_date: new Date().toISOString().split("T")[0],
                      lines: [
                        {
                          line_no: 1,
                          item_id: defaultGoodsItem?.id,
                          uom_id: defaultGoodsItem?.base_uom || refs.items[0]?.base_uom,
                          description: "High Quality Industrial Components Model A",
                          quantity: 10,
                          unit_price: 1500000,
                        },
                      ],
                    });
                    setModalType("create_commercial_invoice");
                  }}
                >
                  + Lập Hóa đơn Thương mại
                </button>
                <button className="live-sal-btn" onClick={() => loadTabData("commercial-invoices")}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="live-sal-card">
              <div className="live-sal-card-header">
                <span style={{ fontWeight: 600 }}>Danh sách Hóa đơn Thương mại (UC-SAL-14)</span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>Tổng: {commercialInvoices.length} hóa đơn</span>
              </div>
              <div className="live-sal-table-wrapper">
                <table className="live-sal-table">
                  <thead>
                    <tr>
                      <th>Số hóa đơn</th>
                      <th>Ngày lập</th>
                      <th>Bên mua (Buyer)</th>
                      <th>Quốc gia</th>
                      <th>Tổng tiền ngoại tệ/VND</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commercialInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#8b949e", padding: 24 }}>
                          Chưa có hóa đơn thương mại nào.
                        </td>
                      </tr>
                    ) : (
                      commercialInvoices.map((ci) => (
                        <tr key={ci.id}>
                          <td style={{ fontWeight: 600, color: "#58a6ff" }}>{ci.invoice_number || ci.number || ci.id.slice(0, 8)}</td>
                          <td>{ci.invoice_date}</td>
                          <td>{ci.buyer_name}</td>
                          <td>{ci.buyer_country}</td>
                          <td style={{ fontWeight: 700, color: "#f0f6fc" }}>
                            {Number(ci.total_amount || 0).toLocaleString("vi-VN")} đ
                          </td>
                          <td>
                            <span className={`status-pill ${String(ci.status || "").toLowerCase()}`}>{ci.status}</span>
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
      </main>

      {/* ======================================================== */}
      {/* MODAL: Lập Báo giá (UC-SAL-01)                           */}
      {/* ======================================================== */}
      {modalType === "create_quotation" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Báo giá Khách hàng (UC-SAL-01)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Khách hàng:</label>
                  <select
                    className="live-sal-select"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hạn hiệu lực báo giá:</label>
                  <input
                    type="date"
                    className="live-sal-input"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("quotations", formData)}
              >
                Lưu báo giá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Đơn bán hàng (UC-SAL-02)                      */}
      {/* ======================================================== */}
      {modalType === "create_order" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Đơn Bán Hàng (SO) (UC-SAL-02, 17)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Khách hàng:</label>
                  <select
                    className="live-sal-select"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày yêu cầu giao hàng:</label>
                  <input
                    type="date"
                    className="live-sal-input"
                    value={formData.requested_delivery_date}
                    onChange={(e) => setFormData({ ...formData, requested_delivery_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Địa chỉ giao hàng:</label>
                <input
                  type="text"
                  className="live-sal-input"
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                />
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("orders", formData)}
              >
                Lưu đơn hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Bán hàng hóa (UC-SAL-03)                      */}
      {/* ======================================================== */}
      {modalType === "create_goods_sale" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Ghi nhận Bán Hàng Hóa (UC-SAL-03)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Khách hàng:</label>
                  <select
                    className="live-sal-select"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày hạch toán:</label>
                  <input
                    type="date"
                    className="live-sal-input"
                    value={formData.posting_date}
                    onChange={(e) => setFormData({ ...formData, posting_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("goods-sales", formData)}
              >
                Lưu chứng từ bán hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Bán dịch vụ (UC-SAL-04)                       */}
      {/* ======================================================== */}
      {modalType === "create_service_sale" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Ghi nhận Bán Dịch Vụ (UC-SAL-04)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Khách hàng:</label>
                  <select
                    className="live-sal-select"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  >
                    {refs.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Ngày nghiệm thu dịch vụ:</label>
                  <input
                    type="date"
                    className="live-sal-input"
                    value={formData.document_date}
                    onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("service-sales", formData)}
              >
                Lưu chứng từ bán dịch vụ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Hàng bán trả lại (UC-SAL-05)                  */}
      {/* ======================================================== */}
      {modalType === "create_sales_return" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Hàng Bán Trả Lại (UC-SAL-05)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-group">
                <label>Lý do trả lại:</label>
                <input
                  type="text"
                  className="live-sal-input"
                  value={formData.return_reason}
                  onChange={(e) => setFormData({ ...formData, return_reason: e.target.value })}
                />
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("sales-returns", formData)}
              >
                Lưu hàng trả lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Giảm giá (UC-SAL-06)                          */}
      {/* ======================================================== */}
      {modalType === "create_sales_allowance" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Chứng từ Giảm Giá Hàng Bán (UC-SAL-06)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-group">
                <label>Lý do giảm giá:</label>
                <input
                  type="text"
                  className="live-sal-input"
                  value={formData.allowance_reason}
                  onChange={(e) => setFormData({ ...formData, allowance_reason: e.target.value })}
                />
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("sales-allowances", formData)}
              >
                Lưu giảm giá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Hóa đơn đầu ra (UC-SAL-07)                    */}
      {/* ======================================================== */}
      {modalType === "create_sales_invoice" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Hóa Đơn Điện Tử Đầu Ra (UC-SAL-07, 15)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Tên đơn vị mua hàng:</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mã số thuế bên mua:</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.buyer_tax_code}
                    onChange={(e) => setFormData({ ...formData, buyer_tax_code: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("sales-invoices", formData)}
              >
                Lưu hóa đơn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Hợp đồng bán hàng (UC-SAL-12)                 */}
      {/* ======================================================== */}
      {modalType === "create_contract" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Hợp Đồng Bán Hàng (UC-SAL-12)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Số hợp đồng:</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.contract_number}
                    onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tên hợp đồng:</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.contract_name}
                    onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("contracts", formData)}
              >
                Lưu hợp đồng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: Lập Hóa đơn thương mại (UC-SAL-14)                */}
      {/* ======================================================== */}
      {modalType === "create_commercial_invoice" && (
        <div className="live-sal-modal-backdrop">
          <div className="live-sal-modal">
            <div className="live-sal-modal-header">
              <span className="live-sal-modal-title">Lập Hóa Đơn Thương Mại (UC-SAL-14)</span>
              <button className="live-sal-btn live-sal-btn-sm" onClick={() => setModalType(null)}>✕</button>
            </div>
            <div className="live-sal-modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Bên mua (Buyer name):</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.buyer_name}
                    onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Quốc gia:</label>
                  <input
                    type="text"
                    className="live-sal-input"
                    value={formData.buyer_country}
                    onChange={(e) => setFormData({ ...formData, buyer_country: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Địa chỉ người mua:</label>
                <input
                  type="text"
                  className="live-sal-input"
                  value={formData.buyer_address}
                  onChange={(e) => setFormData({ ...formData, buyer_address: e.target.value })}
                />
              </div>
            </div>
            <div className="live-sal-modal-footer">
              <button className="live-sal-btn" onClick={() => setModalType(null)}>Hủy</button>
              <button
                className="live-sal-btn live-sal-btn-primary"
                onClick={() => handleCreateDocument("commercial-invoices", formData)}
              >
                Lưu hóa đơn thương mại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
