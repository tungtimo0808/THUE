import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  KeyRound,
  Bell,
  Search,
  CheckSquare,
  CheckCheck,
  Archive,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Clock,
  Building2,
  Landmark,
  Wallet,
  FileText,
  Calendar,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./live-account.css";
import "./common-hub.css";

type Page<T> = { results: T[]; count: number };

type Notification = {
  id: string;
  title: string;
  message: string;
  status: string;
  level?: string;
  source_module?: string;
  entity_type?: string;
  company_name?: string;
  created_at: string;
  read_at?: string | null;
  link?: string;
};

type WorkItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_type?: string;
  due_at?: string;
  reference_code?: string;
  link?: string;
  amount?: number;
  requester?: string;
  department?: string;
  sourceLabel?: string;
};

type SearchItem = {
  id: string;
  entity_type: string;
  code: string;
  name: string;
  date?: string | null;
  status?: string;
};

type SearchGroup = { count: number; items: SearchItem[]; has_more: boolean };
type Tab = "notifications" | "work" | "search";
type NotifCategoryFilter = "ALL" | "UNREAD" | "IMPORTANT" | "CASH_BANK" | "TAX_GL";

const GROUP_LABELS: Record<string, string> = {
  parties: "Đối tác (Khách hàng / Nhà cung cấp)",
  items: "Vật tư, Hàng hóa & Dịch vụ",
  purchase_orders: "Đơn mua hàng",
  sales_orders: "Đơn đặt hàng bán",
  journals: "Bút toán Sổ cái & Nhật ký chung",
  supplier_invoices: "Hóa đơn mua vào (Công nợ phải trả)",
  receivable_documents: "Chứng từ bán hàng & Công nợ phải thu",
  cash_transactions: "Phiếu thu / Phiếu chi Tiền mặt",
  bank_transactions: "Giao dịch Tiền gửi Ngân hàng",
  inventory_transactions: "Phiếu Nhập / Xuất / Chuyển kho",
  assets: "Hồ sơ Tài sản cố định & CCDC",
  tax_invoices: "Hóa đơn điện tử & Kê khai Thuế",
  reports: "Biểu mẫu Báo cáo Tài chính & Quản trị",
};

const MODULE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  CASH: { label: "Ngân quỹ & Tiền mặt", bg: "#ecfdf5", color: "#059669" },
  BANK: { label: "Tiền gửi Ngân hàng", bg: "#eff6ff", color: "var(--brand)" },
  TAX: { label: "Thuế & Hóa đơn", bg: "#fff7ed", color: "#ea580c" },
  GL: { label: "Sổ cái & BCTC", bg: "#f5f3ff", color: "#7c3aed" },
  PUR: { label: "Mua hàng & Công nợ", bg: "#fef2f2", color: "#dc2626" },
  SAL: { label: "Bán hàng & Phải thu", bg: "#f0fdfa", color: "#0d9488" },
  COM: { label: "Hệ thống & Phân quyền", bg: "#f1f5f9", color: "#475569" },
};

function mapLinkToErpRoute(link?: string | null, sourceModule?: string, entityType?: string): string {
  const lower = `${link || ""} ${entityType || ""}`.toLowerCase();
  if (lower.includes("paymentrequest") || link === "/cash/payment-requests") {
    return "/cash/payment-requests?openDoc=ĐNC00010";
  }
  if (lower.includes("advancesettlement") || link === "/cash/advance-settlement-request" || link === "/cash/advance-settlement") {
    return "/cash/advance-settlement?openDoc=QT00003";
  }
  if (lower.includes("bankreconciliation") || link === "/bank/reconcile") {
    return "/bank/reconciliation";
  }
  if (!link) {
    if (sourceModule === "TAX") return "/tax/declarations";
    if (sourceModule === "BANK") return "/bank/transactions";
    if (sourceModule === "CASH") return "/cash/transactions";
    if (sourceModule === "GL") return "/ledger/transactions";
    return "/overview";
  }
  if (link === "/tax") return "/tax/declarations";
  if (link.startsWith("/cash/") || link.startsWith("/bank/") || link.startsWith("/tax") || link.startsWith("/reports") || link.startsWith("/sales") || link.startsWith("/purchases") || link.startsWith("/inventory") || link.startsWith("/assets") || link.startsWith("/ledger")) {
    return link;
  }
  if (lower.includes("cashtransaction") || lower.includes("cash_management")) return "/cash/transactions";
  if (lower.includes("banktransaction") || lower.includes("bank_management")) return "/bank/transactions";
  if (lower.includes("purchaseorder") || lower.includes("purchases")) return "/purchases/orders";
  if (lower.includes("supplierinvoice") || lower.includes("accounts_payable")) return "/purchases/transactions";
  if (lower.includes("salesorder") || lower.includes("sales")) return "/sales/orders";
  if (lower.includes("receivable") || lower.includes("accounts_receivable")) return "/sales/transactions";
  if (lower.includes("inventory")) return "/inventory/receipts";
  if (lower.includes("asset") || lower.includes("fixed_assets")) return "/assets";
  if (lower.includes("tax")) return "/tax/declarations";
  if (lower.includes("journal") || lower.includes("general_ledger")) return "/ledger/transactions";
  return "/overview";
}

export default function LiveCommonHub() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialQueryParam = params.get("q") || "";
  const { token, companyId, companies, selectCompany } = useApiSession();
  const activeCompany = useMemo(
    () => companies.find((c) => c.id === companyId) || companies[0] || null,
    [companies, companyId]
  );

  const [tab, setTab] = useState<Tab>(
    params.get("tab") === "search" ? "search" : params.get("tab") === "work" ? "work" : "notifications"
  );
  const [notifCategory, setNotifCategory] = useState<NotifCategoryFilter>("ALL");
  const [notifSearch, setNotifSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [archived, setArchived] = useState(false);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationCount, setNotificationCount] = useState(0);

  const [work, setWork] = useState<WorkItem[]>([]);
  const [pendingVouchers, setPendingVouchers] = useState<WorkItem[]>([]);
  const [workPage, setWorkPage] = useState(1);
  const [workCount, setWorkCount] = useState(0);

  const [query, setQuery] = useState(initialQueryParam);
  const [groups, setGroups] = useState<Record<string, SearchGroup> | null>(null);

  // Load notifications + live pending vouchers
  useEffect(() => {
    if (!token) return;
    let active = true;
    setBusy(true);
    setError("");
    const compFilter = companyId ? `&company_id=${encodeURIComponent(companyId)}` : "";
    Promise.allSettled([
      request<Page<Notification>>(
        `/api/v1/common/notifications/?page=${notificationPage}&archived=${archived}${compFilter}`,
        token
      ),
      companyId
        ? request<any>(`/api/v1/cash/payment-requests/?company_id=${encodeURIComponent(companyId)}`, token)
        : Promise.resolve([]),
      companyId
        ? request<any>(`/api/v1/cash/advance-settlement-docs/?company_id=${encodeURIComponent(companyId)}`, token)
        : Promise.resolve([]),
      companyId
        ? request<Page<WorkItem>>(
            `/api/v1/common/work-items/?company_id=${encodeURIComponent(companyId)}&page=${workPage}`,
            token
          )
        : Promise.resolve({ results: [], count: 0 }),
    ])
      .then(([notifRes, prRes, asRes, workRes]) => {
        if (!active) return;
        if (notifRes.status === "fulfilled") {
          const val = notifRes.value;
          const list = Array.isArray(val) ? val : val.results || [];
          setNotifications(list);
          setNotificationCount(typeof val?.count === "number" ? val.count : list.length);
        }
        if ([notifRes, prRes, asRes, workRes].some((result) => result.status === "rejected")) {
          setError("Một số dữ liệu chưa tải được. Bấm Làm mới để thử lại.");
        }
        const voucherTasks: WorkItem[] = [];
        if (prRes.status === "fulfilled") {
          const prList = Array.isArray(prRes.value) ? prRes.value : prRes.value?.docs || prRes.value?.results || [];
          for (const pr of prList) {
            if (String(pr.status || "").toLowerCase() === "pending" || String(pr.status || "").toUpperCase() === "PENDING_APPROVAL") {
              const prCode = pr.code || pr.request_number || "ĐNC00010";
              voucherTasks.push({
                id: `pr-${pr.id}`,
                title: pr.purpose || pr.reason || pr.description || "Đề nghị chi tiền chờ phê duyệt",
                status: "PENDING",
                priority: Number(pr.amount || 0) >= 20000000 ? "URGENT" : "HIGH",
                task_type: "PAYMENT_REQUEST",
                reference_code: prCode,
                due_at: pr.payment_deadline || pr.request_date,
                link: `/cash/payment-requests?openDoc=${encodeURIComponent(prCode)}`,
                amount: Number(pr.amount || 0),
                requester: pr.requester || pr.requester_name || "Nhân viên",
                department: pr.dept || pr.department || "Phòng ban",
                sourceLabel: "Đề nghị chi tiền",
              });
            }
          }
        }
        if (asRes.status === "fulfilled") {
          const asList = Array.isArray(asRes.value) ? asRes.value : asRes.value?.docs || asRes.value?.results || [];
          for (const st of asList) {
            if (String(st.status || "").toLowerCase() === "pending" || String(st.status || "").toUpperCase() === "PENDING_APPROVAL") {
              const stCode = st.code || st.settlement_number || "QT00003";
              voucherTasks.push({
                id: `as-${st.id}`,
                title: st.reason || st.description || "Quyết toán tạm ứng chờ kiểm tra chứng từ",
                status: "PENDING",
                priority: "HIGH",
                task_type: "ADVANCE_SETTLEMENT",
                reference_code: stCode,
                due_at: st.settlement_date,
                link: `/cash/advance-settlement?openDoc=${encodeURIComponent(stCode)}`,
                amount: Number(st.spentAmount || st.spent_amount || st.advanceAmount || 0),
                requester: st.person || st.employee_name || "Nhân viên",
                department: st.dept || st.department || "Phòng ban",
                sourceLabel: "Quyết toán tạm ứng",
              });
            }
          }
        }
        setPendingVouchers(voucherTasks);

        if (workRes.status === "fulfilled") {
          const wVal = workRes.value;
          const wList = Array.isArray(wVal) ? wVal : wVal.results || [];
          setWork(wList);
          setWorkCount(typeof wVal?.count === "number" ? wVal.count : wList.length);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [token, companyId, archived, notificationPage, workPage, reloadTick]);

  // Auto-run search if query param is present
  useEffect(() => {
    const initialQuery = initialQueryParam.trim();
    if (!token || !companyId || tab !== "search" || !initialQuery || initialQuery.length < 2) return;
    let active = true;
    request<{ groups: Record<string, SearchGroup> }>(
      `/api/v1/common/search/?${new URLSearchParams({ company: companyId, q: initialQuery })}`,
      token
    )
      .then((result) => {
        if (active) setGroups(result.groups);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không tìm kiếm được.");
      });
    return () => {
      active = false;
    };
  }, [token, companyId, tab, initialQueryParam]);

  async function notificationAction(
    item: Notification,
    action: "read" | "unread" | "archive" | "unarchive" | "open"
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request<
        Notification | { notification: Notification; link: string | null; available: boolean }
      >(`/api/v1/common/notifications/${item.id}/${action}/`, token, {
        method: "POST",
        body: "{}",
      });
      if (action === "archive" || action === "unarchive") {
        setNotifications((current) => current.filter((row) => row.id !== item.id));
        setMessage(action === "archive" ? "Đã chuyển thông báo vào mục Lưu trữ." : "Đã khôi phục thông báo.");
      } else if (action === "open") {
        const opened = result as { notification: Notification; link: string | null; available: boolean };
        setNotifications((current) =>
          current.map((row) => (row.id === item.id ? opened.notification : row))
        );
        const targetRoute = mapLinkToErpRoute(opened.link || item.link, item.source_module, item.entity_type);
        navigate(targetRoute);
      } else {
        setNotifications((current) =>
          current.map((row) => (row.id === item.id ? (result as Notification) : row))
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xử lý được thông báo.");
    } finally {
      setBusy(false);
    }
  }

  async function readAll() {
    setBusy(true);
    setError("");
    try {
      const compQuery = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
      await request(`/api/v1/common/notifications/read-all/${compQuery}`, token, {
        method: "POST",
        body: "{}",
      });
      setNotifications((current) =>
        current.map((item) => ({ ...item, status: "READ", read_at: new Date().toISOString() }))
      );
      setMessage("✓ Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không cập nhật được thông báo.");
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(keyword: string) {
    if (!companyId || keyword.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<{ groups: Record<string, SearchGroup> }>(
        `/api/v1/common/search/?${new URLSearchParams({ company: companyId, q: keyword.trim() })}`,
        token
      );
      setGroups(result.groups);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tìm kiếm được.");
    } finally {
      setBusy(false);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch(query);
  }

  async function openSearch(item: SearchItem) {
    setBusy(true);
    setError("");
    try {
      const result = await request<{ link: string }>("/api/v1/common/search/open/", token, {
        method: "POST",
        body: JSON.stringify({
          company: companyId,
          entity_type: item.entity_type,
          entity_id: item.id,
        }),
      });
      navigate(mapLinkToErpRoute(result.link, undefined, item.entity_type));
    } catch {
      navigate(mapLinkToErpRoute(null, undefined, item.entity_type));
    } finally {
      setBusy(false);
    }
  }

  async function openWork(item: WorkItem) {
    if (item.link && item.link.startsWith("/")) {
      navigate(mapLinkToErpRoute(item.link, undefined, item.task_type));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request<{ link: string | null }>(
        `/api/v1/common/work-items/${item.id}/open/?company_id=${encodeURIComponent(companyId)}`,
        token,
        { method: "POST", body: "{}" }
      );
      navigate(mapLinkToErpRoute(result.link, undefined, item.task_type));
    } catch {
      navigate("/overview");
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status !== "READ" && !n.read_at).length,
    [notifications]
  );

  const combinedWorkItems = useMemo(() => [...pendingVouchers, ...work], [pendingVouchers, work]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isUnread = n.status !== "READ" && !n.read_at;
      if (notifCategory === "UNREAD" && !isUnread) return false;
      if (
        notifCategory === "IMPORTANT" &&
        n.level !== "IMPORTANT" &&
        n.level !== "WARNING"
      )
        return false;
      if (
        notifCategory === "CASH_BANK" &&
        n.source_module !== "CASH" &&
        n.source_module !== "BANK"
      )
        return false;
      if (
        notifCategory === "TAX_GL" &&
        n.source_module !== "TAX" &&
        n.source_module !== "GL"
      )
        return false;
      if (notifSearch.trim()) {
        const kw = notifSearch.trim().toLowerCase();
        const hay = `${n.title} ${n.message} ${n.company_name || ""} ${n.source_module || ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [notifications, notifCategory, notifSearch]);

  return (
    <div className="common-hub">
      {/* Top Enterprise Header Bar */}
      <header className="common-hub-header"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 30,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Link
            to="/overview"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 8,
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              color: "var(--brand)",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} />
            <span>Bàn làm việc</span>
          </Link>

          <div className="common-hub-title">
            <h1>Thông báo và công việc</h1>
            <p>Theo dõi thông báo, xử lý chứng từ và tra cứu dữ liệu.</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {companies.length > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "5px 12px",
              }}
            >
              <Building2 size={15} style={{ color: "var(--brand)" }} />
              <select
                aria-label="Chọn doanh nghiệp"
                value={companyId || activeCompany?.id || ""}
                onChange={(e) => selectCompany(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setReloadTick((v) => v + 1)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={14} />
            <span>Làm mới</span>
          </button>

          <Link
            to="/session"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              fontSize: 12.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <KeyRound size={14} />
            <span>Phiên làm việc</span>
          </Link>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="common-hub-main" style={{ maxWidth: 1320, width: "100%", margin: "0 auto", padding: "22px 28px 48px", boxSizing: "border-box", flex: 1 }}>
        {!token ? (
          <div style={{ background: "#ffffff", borderRadius: 12, padding: 32, textAlign: "center", border: "1px solid #e2e8f0" }}>
            <p style={{ fontSize: 15, color: "#475569" }}>
              Vui lòng <Link to="/login" style={{ color: "var(--brand)", fontWeight: 700 }}>đăng nhập</Link> để xem thông báo và công việc cần xử lý.
            </p>
          </div>
        ) : (
          <>
            {/* Main Navigation Tabs */}
            <div className="common-hub-panel"
              style={{
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <nav className="common-hub-tabs" aria-label="Chức năng dùng chung" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {(
                    [
                      ["notifications", "Thông báo", notificationCount],
                      ["work", "Việc cần xử lý", combinedWorkItems.length],
                      ["search", "Tra cứu", null],
                    ] as const
                  ).map(([id, label, badge]) => {
                    const active = tab === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          setTab(id);
                          setError("");
                          setMessage("");
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: active ? "1px solid var(--brand)" : "1px solid #cbd5e1",
                          background: active ? "var(--brand)" : "#ffffff",
                          color: active ? "#ffffff" : "#334155",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {id === "notifications" && <Bell size={15} />}
                        {id === "work" && <CheckSquare size={15} />}
                        {id === "search" && <Search size={15} />}
                        <span>{label}</span>
                        {badge !== null && (
                          <span
                            style={{
                              padding: "1px 7px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: active ? "rgba(255,255,255,0.22)" : "#e2e8f0",
                              color: active ? "#ffffff" : "#334155",
                            }}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                {tab === "notifications" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setArchived((v) => !v);
                        setNotificationPage(1);
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 13px",
                        borderRadius: 8,
                        border: archived ? "1px solid var(--brand)" : "1px solid #cbd5e1",
                        background: archived ? "#e0f2fe" : "#ffffff",
                        color: archived ? "var(--brand-hover)" : "#334155",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Archive size={14} />
                      <span>{archived ? "Về thông báo hiện tại" : "Đã lưu trữ"}</span>
                    </button>

                    {!archived && unreadCount > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={readAll}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 8,
                          border: "1px solid var(--brand)",
                          background: "var(--brand)",
                          color: "#ffffff",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <CheckCheck size={15} />
                        <span>Đánh dấu tất cả đã đọc ({unreadCount})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Status banners */}
              {error && (
                <div
                  role="alert"
                  style={{
                    margin: "16px 20px 0",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              )}
              {message && (
                <div
                  role="status"
                  style={{
                    margin: "16px 20px 0",
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#047857",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {message}
                </div>
              )}

              {/* TAB 1: NOTIFICATIONS */}
              {tab === "notifications" && (
                <div style={{ padding: "18px 20px" }}>
                  {/* Filter bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#64748b", marginRight: 4 }}>
                        <Filter size={13} /> Phân loại:
                      </span>
                      {(
                        [
                          ["ALL", "Tất cả"],
                          ["UNREAD", `Chưa đọc (${unreadCount})`],
                          ["IMPORTANT", "Quan trọng & Cảnh báo"],
                          ["CASH_BANK", "Tiền mặt & Ngân hàng"],
                          ["TAX_GL", "Thuế & Sổ cái"],
                        ] as const
                      ).map(([code, label]) => {
                        const active = notifCategory === code;
                        return (
                          <button
                            key={code}
                            aria-pressed={active}
                            type="button"
                            onClick={() => setNotifCategory(code)}
                            className="common-hub-filter"
                            style={{
                              padding: "5px 12px",
                              borderRadius: 999,
                              border: active ? "1px solid var(--brand)" : "1px solid #e2e8f0",
                              background: active ? "#e0f2fe" : "#f8fafc",
                              color: active ? "var(--brand-hover)" : "#475569",
                              fontSize: 12,
                              fontWeight: active ? 700 : 500,
                              cursor: "pointer",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: 8,
                        padding: "5px 12px",
                        minWidth: 260,
                      }}
                    >
                      <Search size={14} style={{ color: "#64748b" }} />
                      <input
                        type="text"
                        aria-label="Tìm thông báo"
                        placeholder="Tìm thông báo"
                        value={notifSearch}
                        onChange={(e) => setNotifSearch(e.target.value)}
                        style={{
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          fontSize: 12.5,
                          color: "#0f172a",
                          width: "100%",
                        }}
                      />
                    </div>
                  </div>

                  {/* Notification List */}
                  {filteredNotifications.length === 0 ? (
                    <div className="common-hub-empty" role="status">
                      <Bell size={28} aria-hidden="true" />
                      <h3>{busy ? "Đang tải thông báo…" : error ? "Chưa tải được thông báo" : notifSearch || notifCategory !== "ALL" ? "Không tìm thấy thông báo phù hợp" : archived ? "Chưa có thông báo lưu trữ" : "Chưa có thông báo"}</h3>
                      <p>{busy ? "Vui lòng chờ trong giây lát." : error ? "Bấm Làm mới để tải lại danh sách." : notifSearch || notifCategory !== "ALL" ? "Thử từ khóa khác hoặc xóa bộ lọc để xem danh sách." : "Thông báo của doanh nghiệp sẽ xuất hiện tại đây khi có cập nhật."}</p>
                      {!busy && (notifSearch || notifCategory !== "ALL") && <button type="button" onClick={() => { setNotifSearch(""); setNotifCategory("ALL"); }}>Xóa bộ lọc</button>}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {filteredNotifications.map((item) => {
                        const isUnread = item.status !== "READ" && !item.read_at;
                        const modInfo = MODULE_LABELS[item.source_module || "COM"] || MODULE_LABELS.COM;
                        const levelBadge =
                          item.level === "IMPORTANT"
                            ? { text: "Quan trọng", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
                            : item.level === "WARNING"
                              ? { text: "Cảnh báo", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" }
                              : item.level === "SUCCESS"
                                ? { text: "Hoàn tất", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" }
                                : { text: "Thông báo", bg: "#eff6ff", color: "var(--brand)", border: "#bae6fd" };

                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 16,
                              padding: "16px 18px",
                              borderRadius: 10,
                              background: isUnread ? "#f8fafc" : "#ffffff",
                              border: isUnread ? "1.5px solid #93c5fd" : "1px solid #e2e8f0",
                              boxShadow: isUnread ? "0 2px 6px rgba(2, 132, 199, 0.06)" : "none",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 280 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 10,
                                  background: modInfo.bg,
                                  color: modInfo.color,
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                  marginTop: 2,
                                }}
                              >
                                {item.source_module === "CASH" ? (
                                  <Wallet size={20} />
                                ) : item.source_module === "BANK" ? (
                                  <Landmark size={20} />
                                ) : item.source_module === "TAX" ? (
                                  <Calendar size={20} />
                                ) : item.level === "IMPORTANT" || item.level === "WARNING" ? (
                                  <ShieldAlert size={20} />
                                ) : (
                                  <FileText size={20} />
                                )}
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      background: modInfo.bg,
                                      color: modInfo.color,
                                    }}
                                  >
                                    {modInfo.label}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      background: levelBadge.bg,
                                      color: levelBadge.color,
                                      border: `1px solid ${levelBadge.border}`,
                                    }}
                                  >
                                    {levelBadge.text}
                                  </span>
                                  {isUnread && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--brand)",
                                      }}
                                    >
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand)" }} />
                                      Mới
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: 14.5, fontWeight: isUnread ? 800 : 700, color: "#0f172a", marginBottom: 4 }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, marginBottom: 8 }}>
                                  {item.message}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12, color: "#64748b", flexWrap: "wrap" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <Building2 size={13} />
                                    {item.company_name || activeCompany?.name || "Hệ thống"}
                                  </span>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    <Clock size={13} />
                                    {new Date(item.created_at).toLocaleString("vi-VN")}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, alignSelf: "center" }}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => notificationAction(item, "open")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "7px 14px",
                                  borderRadius: 8,
                                  border: "1px solid var(--brand)",
                                  background: "var(--brand)",
                                  color: "#ffffff",
                                  fontSize: 12.5,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                <span>Xem & Xử lý</span>
                                <ExternalLink size={13} />
                              </button>

                              {!archived && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    notificationAction(item, item.status === "READ" || item.read_at ? "unread" : "read")
                                  }
                                  style={{
                                    padding: "7px 12px",
                                    borderRadius: 8,
                                    border: "1px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#334155",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  {item.status === "READ" || item.read_at ? "Đánh dấu chưa đọc" : "Đã đọc"}
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => notificationAction(item, archived ? "unarchive" : "archive")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  padding: "7px 12px",
                                  borderRadius: 8,
                                  border: "1px solid #cbd5e1",
                                  background: "#ffffff",
                                  color: "#64748b",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                {archived ? <RotateCcw size={13} /> : <Archive size={13} />}
                                <span>{archived ? "Khôi phục" : "Lưu trữ"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Pagination page={notificationPage} count={notificationCount} onChange={setNotificationPage} />
                </div>
              )}

              {/* TAB 2: WORK ITEMS & PENDING APPROVALS */}
              {tab === "work" && (
                <div style={{ padding: "18px 20px" }}>
                  {combinedWorkItems.length === 0 ? (
                    <div
                      style={{
                        padding: "48px 24px",
                        textAlign: "center",
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px dashed #cbd5e1",
                      }}
                    >
                      <CheckCircle2 size={40} style={{ color: "#10b981", marginBottom: 8 }} />
                      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                        Không có chứng từ hoặc công việc nào đang chờ xử lý
                      </h3>
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                        Toàn bộ Đề nghị chi tiền, Quyết toán tạm ứng và Chứng từ trình ký trong đơn vị đã được phê duyệt.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {combinedWorkItems.map((item) => {
                        const isUrgent = item.priority === "URGENT";
                        const isHigh = item.priority === "HIGH";
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 16,
                              padding: "16px 18px",
                              borderRadius: 10,
                              background: "#ffffff",
                              border: "1px solid #e2e8f0",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 280 }}>
                              <div
                                style={{
                                  width: 42,
                                  height: 42,
                                  borderRadius: 10,
                                  background: isUrgent ? "#fef2f2" : "#ecfdf5",
                                  color: isUrgent ? "#dc2626" : "#059669",
                                  display: "grid",
                                  placeItems: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <CheckSquare size={20} />
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                  {item.reference_code && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 800,
                                        padding: "2px 8px",
                                        borderRadius: 6,
                                        background: "#e0f2fe",
                                        color: "var(--brand-hover)",
                                      }}
                                    >
                                      {item.reference_code}
                                    </span>
                                  )}
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      background: isUrgent ? "#fef2f2" : isHigh ? "#fff7ed" : "#f1f5f9",
                                      color: isUrgent ? "#dc2626" : isHigh ? "#ea580c" : "#475569",
                                    }}
                                  >
                                    {isUrgent ? "Ưu tiên Khẩn cấp" : isHigh ? "Ưu tiên Cao" : "Bình thường"}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      padding: "2px 8px",
                                      borderRadius: 6,
                                      background: "#fef3c7",
                                      color: "#b45309",
                                    }}
                                  >
                                    {item.sourceLabel || "Chờ phê duyệt"}
                                  </span>
                                </div>

                                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                                  {item.title}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: "#64748b", flexWrap: "wrap" }}>
                                  {item.requester && (
                                    <span>
                                      Người đề nghị: <strong style={{ color: "#334155" }}>{item.requester}</strong> ({item.department})
                                    </span>
                                  )}
                                  {typeof item.amount === "number" && item.amount > 0 && (
                                    <span>
                                      Số tiền: <strong style={{ color: "#dc2626" }}>{item.amount.toLocaleString("vi-VN")} đ</strong>
                                    </span>
                                  )}
                                  {item.due_at && (
                                    <span>
                                      Ngày / Hạn xử lý: <strong>{new Date(item.due_at).toLocaleDateString("vi-VN")}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openWork(item)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 16px",
                                borderRadius: 8,
                                border: "1px solid var(--brand)",
                                background: "var(--brand)",
                                color: "#ffffff",
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <span>Mở chứng từ xử lý</span>
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Pagination page={workPage} count={workCount} onChange={setWorkPage} />
                </div>
              )}

              {/* TAB 3: GLOBAL SEARCH */}
              {tab === "search" && (
                <div style={{ padding: "18px 20px" }}>
                  <form
                    onSubmit={search}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 280,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#f8fafc",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: 10,
                        padding: "9px 14px",
                      }}
                    >
                      <Search size={18} style={{ color: "var(--brand)" }} />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Nhập số chứng từ (PT, PC, UNC, ĐNC), mã số thuế, tên đối tác, tài khoản..."
                        minLength={2}
                        required
                        style={{
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          fontSize: 14,
                          color: "#0f172a",
                          width: "100%",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      style={{
                        padding: "10px 22px",
                        borderRadius: 10,
                        border: "none",
                        background: "var(--brand)",
                        color: "#ffffff",
                        fontSize: 13.5,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Tìm kiếm toàn hệ thống
                    </button>
                  </form>

                  {/* Quick Search Chips */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                    <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Gợi ý tra cứu nhanh:</span>
                    {["PT", "PC", "Vietcombank", "Công ty", "Hóa đơn", "1111", "1121", "Báo cáo"].map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => {
                          setQuery(kw);
                          void runSearch(kw);
                        }}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          color: "#334155",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {kw}
                      </button>
                    ))}
                  </div>

                  {groups && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {Object.entries(groups)
                        .filter(([, group]) => group.count > 0)
                        .map(([name, group]) => (
                          <section
                            key={name}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: 10,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                background: "#f8fafc",
                                padding: "10px 16px",
                                borderBottom: "1px solid #e2e8f0",
                                fontWeight: 700,
                                fontSize: 13.5,
                                color: "#0f172a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>{GROUP_LABELS[name] || name}</span>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  background: "#e0f2fe",
                                  color: "var(--brand-hover)",
                                }}
                              >
                                {group.count} kết quả
                              </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {group.items.map((item) => (
                                <div
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 16px",
                                    borderBottom: "1px solid #f1f5f9",
                                    gap: 12,
                                  }}
                                >
                                  <div>
                                    <strong style={{ color: "var(--brand)", fontSize: 13.5, marginRight: 8 }}>
                                      {item.code}
                                    </strong>
                                    <span style={{ color: "#0f172a", fontSize: 13.5, fontWeight: 600 }}>
                                      {item.name}
                                    </span>
                                    {item.date && (
                                      <span style={{ color: "#64748b", fontSize: 12, marginLeft: 10 }}>
                                        · Ngày: {item.date}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => openSearch(item)}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      padding: "6px 12px",
                                      borderRadius: 6,
                                      border: "1px solid #cbd5e1",
                                      background: "#ffffff",
                                      color: "var(--brand)",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span>Mở chi tiết</span>
                                    <ExternalLink size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      {Object.values(groups).every((g) => g.count === 0) && (
                        <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
                          Không tìm thấy dữ liệu nào khớp với từ khóa <strong>"{query}"</strong>.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Pagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (page: number) => void;
}) {
  if (count <= 20) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer" }}
      >
        ← Trang trước
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Trang {page}</span>
      <button
        type="button"
        disabled={page * 20 >= count}
        onClick={() => onChange(page + 1)}
        style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer" }}
      >
        Trang sau →
      </button>
    </div>
  );
}
