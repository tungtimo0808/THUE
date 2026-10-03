import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Download,
  Grip,
  Landmark,
  Lightbulb,
  Megaphone,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  companies,
  kinds,
  persistTransactions,
  readTransactions,
  type Kind,
  type Transaction,
} from "./data";
import { DocumentDetail, DocumentForm, Modal } from "./components";
import { TaxPage } from "./TaxPage";
import {
  referenceNav,
  referenceTabHierarchy,
  referenceTabs,
  settingsGroups,
} from "./reference-config";
import {
  ReferenceDashboard,
  ReferenceTransactions,
} from "./ReferencePages";
import {
  DirectoryWorkspace,
  IncomingInvoiceWorkspace,
} from "./DetailedWorkspaces";
import {
  SmartSearchResults,
  TabSettingsModal,
  WorkModeModal,
} from "./GlobalShellPanels";
import { SidebarNavigation } from "./SidebarNavigation";
import { NestedWorkspace } from "./NestedWorkspace";
import { AuditedProcessWorkspace } from "./AuditedProcessWorkspace";
import MisaCashWorkspace from "./MisaCashWorkspace";
import MisaBankWorkspace from "./MisaBankWorkspace";
import MisaPurchaseWorkspace from "./MisaPurchaseWorkspace";
import MisaSalesWorkspace from "./MisaSalesWorkspace";
import MisaInventoryWorkspace from "./MisaInventoryWorkspace";
import MisaToolsWorkspace from "./MisaToolsWorkspace";
import MisaAssetsWorkspace from "./MisaAssetsWorkspace";
import MisaPayrollWorkspace from "./MisaPayrollWorkspace";
import MisaTaxWorkspace from "./MisaTaxWorkspace";
import MisaCostWorkspace from "./MisaCostWorkspace";
import MisaLedgerWorkspace from "./MisaLedgerWorkspace";
import MisaBudgetWorkspace from "./MisaBudgetWorkspace";
import MisaReportCenterWorkspace from "./MisaReportCenterWorkspace";
import MisaFinancialAnalysisWorkspace from "./MisaFinancialAnalysisWorkspace";
import MisaOpeningBalanceWorkspace from "./MisaOpeningBalanceWorkspace";
import ErrorBoundary from "./ErrorBoundary";
import "./App.css";
import "./reference.css";
import "./detailed-workspaces.css";
import "./misa-cash.css";

export type ReferenceHref = (
  path: string,
  extra?: Record<string, string>,
) => string;

const quickCreateGroups: {
  title: string;
  items: { label: string; kind?: Kind }[];
}[] = [
    {
      title: "TIỀN MẶT",
      items: [
        { label: "Thu tiền mặt", kind: "receipt" },
        { label: "Chi tiền mặt", kind: "payment" },
      ],
    },
    {
      title: "TIỀN GỬI",
      items: [
        { label: "Thu tiền gửi", kind: "bank" },
        { label: "Chi tiền gửi", kind: "payment" },
      ],
    },
    {
      title: "KHO",
      items: [
        { label: "Nhập kho" },
        { label: "Xuất kho" },
        { label: "Chuyển kho" },
      ],
    },
    {
      title: "MUA HÀNG",
      items: [
        { label: "Mua hàng", kind: "purchase" },
        { label: "Mua dịch vụ", kind: "purchase" },
      ],
    },
    {
      title: "BÁN HÀNG",
      items: [
        { label: "Bán hàng", kind: "sale" },
        { label: "Bán dịch vụ", kind: "sale" },
      ],
    },
    {
      title: "TỔNG HỢP",
      items: [
        { label: "Chứng từ nghiệp vụ khác" },
        { label: "Quyết toán tạm ứng" },
      ],
    },
  ];

function ReferenceWorkspace() {
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const pathParts = location.pathname.split("/");
  const moduleId = pathParts[1] || "overview",
    tabs = referenceTabs[moduleId] || [["transactions", "Danh sách"]];
  const requestedTab = pathParts[2];
  const tab = tabs.some(([id]) => id === requestedTab)
    ? requestedTab
    : tabs[0][0],
    childTab = pathParts[3],
    module = referenceNav.find((m) => m.id === moduleId);
  const activeTabNode = referenceTabHierarchy[moduleId]?.find(
    (item) => item.id === tab,
  );
  const company =
    companies.find((c) => c.id === params.get("company")) || companies[0];
  const period = ["2026-09", "2026-08", "2026"].includes(
    params.get("period") || "",
  )
    ? params.get("period")!
    : "2026-09";
  const [items, setItems] = useState(readTransactions);
  const scoped = items.filter(
    (t) => t.company === company.id && t.date.startsWith(period),
  );
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("ref_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("ref_sidebar_collapsed", String(next));
      } catch { }
      return next;
    });
  };
  const [panel, setPanel] = useState<
    | "quick"
    | "settings"
    | "notifications"
    | "help"
    | "module"
    | "mode"
    | "tabs"
    | null
  >(null);
  const [createKind, setCreateKind] = useState<Kind | null>(null),
    [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState(""),
    [info, setInfo] = useState(""),
    [query, setQuery] = useState(""),
    [workMode, setWorkMode] = useState("Kế toán");
  const href: ReferenceHref = (path, extra) =>
    `${path}?${new URLSearchParams({ company: company.id, period, ...extra })}`;
  const detail = items.find((t) => t.id === detailId),
    pending = scoped.filter((t) => t.status === "pending");

  const [notifFilter, setNotifFilter] = useState<"all" | "pending" | "system">("all");
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());
  const [payrollOtherOpen, setPayrollOtherOpen] = useState(false);
  const [payrollOptionOpen, setPayrollOptionOpen] = useState(false);
  const [payrollOption, setPayrollOption] = useState("Tiền lương AMIS Kế toán");

  const systemAlerts = [
    {
      id: "sys-cashflow",
      category: "system" as const,
      code: "Cảnh báo quỹ",
      kindLabel: "Dự báo dòng tiền",
      kind: "alert" as const,
      description: "Dự kiến số dư quỹ tiền mặt giảm dưới ngưỡng an toàn (25.000.000 đ) vào ngày 28/09. Đề xuất gửi nhắc nợ đối tác sớm.",
      partner: "MISA AVA AI",
      amount: 18250000,
      date: "25/09/2026 14:15",
      actionUrl: "/cash/cashflow",
    },
    {
      id: "sys-tax",
      category: "system" as const,
      code: "Hạn nộp thuế Q3",
      kindLabel: "Thuế & Tờ khai",
      kind: "tax" as const,
      description: "Hạn nộp Tờ khai thuế GTGT và Báo cáo tình hình sử dụng hóa đơn Quý 3/2026 (Hạn cuối: 31/10/2026).",
      partner: "Cơ quan Thuế",
      amount: 0,
      date: "24/09/2026 09:00",
      actionUrl: "/tax",
    },
    {
      id: "sys-tt99",
      category: "system" as const,
      code: "Thông tư 99/2025",
      kindLabel: "Chế độ kế toán",
      kind: "info" as const,
      description: "Hệ thống đã cập nhật đầy đủ sổ quỹ S07-DN, S07a-DN và báo cáo B03-DN theo Thông tư 99/2025/TT-BTC áp dụng từ 01/01/2026.",
      partner: "Bộ Tài chính",
      amount: 0,
      date: "20/09/2026 08:30",
      actionUrl: "/cash/reports",
    },
  ];

  const voucherNotifs = pending.map((t) => ({
    id: t.id,
    category: "pending" as const,
    code: t.code,
    kindLabel: kinds[t.kind] || "Chứng từ",
    kind: t.kind,
    description: t.description,
    partner: t.partner,
    amount: t.amount,
    date: `${t.date.split("-").reverse().join("/")} 09:30`,
    actionUrl: "",
    isVoucher: true,
  }));

  const allNotifs = [...voucherNotifs, ...systemAlerts];
  const displayedNotifs =
    notifFilter === "pending"
      ? voucherNotifs
      : notifFilter === "system"
        ? systemAlerts
        : allNotifs;
  const unreadCount = allNotifs.filter((n) => !readNotifIds.has(n.id)).length;

  useEffect(() => {
    document.title = `${module?.label || "Kế toán"} | Sổ Việt`;
  }, [module?.label]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("reference-search")?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
      if (e.key === "Escape") {
        setMobileOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const context = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.delete("page");
    setParams(next);
  };
  const create = (kind: Kind) => {
    setPanel(null);
    setCreateKind(kind);
  };
  const save = (item: Transaction, another: boolean) => {
    const next = [item, ...items];
    try {
      persistTransactions(next);
      setItems(next);
      if (!another) setCreateKind(null);
      setNotice(`Đã lưu ${item.code} trên trình duyệt.`);
      return true;
    } catch {
      return false;
    }
  };
  const submit = (id: string) => {
    const next = items.map((t) =>
      t.id === id && t.status === "draft"
        ? { ...t, status: "pending" as const }
        : t,
    );
    try {
      persistTransactions(next);
      setItems(next);
      setNotice("Đã chuyển sang chờ duyệt trong bản trải nghiệm.");
    } catch {
      setNotice("Không thể lưu. Vui lòng kiểm tra dung lượng trình duyệt.");
    }
  };
  const infoAction = (name: string) => {
    setPanel(null);
    setInfo(name);
  };
  return (
    <div className={`reference-app ${collapsed ? "ref-collapsed" : ""}`}>
      <a href="#reference-main" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="ref-header">
        <button
          className="ref-icon ref-mobile-trigger"
          aria-label="Mở điều hướng"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu size={20} />
        </button>
        <button
          className="ref-icon ref-sidebar-toggle"
          title={
            collapsed
              ? "Mở rộng thanh tác vụ bên trái (Ctrl+B)"
              : "Thu nhỏ thanh tác vụ bên trái (Ctrl+B)"
          }
          aria-label={
            collapsed
              ? "Mở rộng thanh tác vụ bên trái"
              : "Thu nhỏ thanh tác vụ bên trái"
          }
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <Link to={href("/overview")} className="ref-brand">
          <Grip size={17} />
          <span className="ref-logo">
            <span />
          </span>
          <strong>KẾ TOÁN</strong>
        </Link>
        <label className="ref-company">
          <span className="sr-only">Doanh nghiệp</span>
          <select
            aria-label="Doanh nghiệp"
            value={company.id}
            onChange={(e) => context("company", e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="ref-dataset">
          <span className="sr-only">Dữ liệu kế toán</span>
          <select aria-label="Dữ liệu kế toán" defaultValue="accounting-2026">
            <option value="accounting-2026">Dữ liệu kế toán 2026</option>
            <option value="management-2026">Dữ liệu quản trị 2026</option>
          </select>
        </label>
        <label className="ref-branch">
          <span className="sr-only">Chi nhánh, đơn vị</span>
          <select aria-label="Chi nhánh, đơn vị" defaultValue="head-office">
            <option value="head-office">Trụ sở chính</option>
            <option value="hcm">Chi nhánh TP. Hồ Chí Minh</option>
          </select>
        </label>
        <label className="ref-period">
          <span className="ref-dot" />
          <select
            aria-label="Kỳ kế toán"
            value={period}
            onChange={(e) => context("period", e.target.value)}
          >
            <option value="2026-09">K9.2026</option>
            <option value="2026-08">K8.2026</option>
            <option value="2026">Năm 2026</option>
          </select>
        </label>
        <div className="ref-header-tools">
          <div className="ref-search-shell">
            <form
              className="ref-global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(href("/ledger/transactions", { q: query }));
                setQuery("");
              }}
            >
              <Search size={13} />
              <input
                id="reference-search"
                aria-label="Tìm kiếm thông minh"
                placeholder="Tìm kiếm thông minh…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span>AI</span>
            </form>
            <SmartSearchResults
              query={query}
              onSelect={(label) => {
                setQuery("");
                setNotice(`Đã mở ${label}.`);
              }}
            />
          </div>
          <button
            className="ref-work-mode"
            aria-label={`Chế độ làm việc: ${workMode}`}
            onClick={() => setPanel("mode")}
          >
            {workMode} <ChevronDown size={13} />
          </button>
          <button className="ref-help" onClick={() => setPanel("help")}>
            <span className="ref-help-icon">
              <Play size={8} fill="currentColor" strokeWidth={0} style={{ marginLeft: 1.5 }} />
            </span>
            Hướng dẫn
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tải dữ liệu"
            onClick={() => navigate(href("/reports"))}
          >
            <Download size={18} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tính năng mới"
            onClick={() => infoAction("Tính năng mới")}
          >
            <Megaphone size={18} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Quản lý người dùng"
            onClick={() => infoAction("Quản lý người dùng và phân quyền")}
          >
            <UserRoundPlus size={18} />
          </button>
          <button
            className="ref-icon"
            aria-label="Các tiện ích và thiết lập"
            onClick={() => setPanel("settings")}
          >
            <Settings size={18} />
          </button>
          <button
            className="ref-icon ref-bell"
            aria-label="Thông báo"
            onClick={() => setPanel("notifications")}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Trợ giúp"
            onClick={() => setPanel("help")}
          >
            <CircleHelp size={18} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tiện ích khác"
            onClick={() => setPanel("settings")}
          >
            <MoreHorizontal size={18} />
          </button>
          <span className="ref-demo">Dữ liệu mẫu</span>
        </div>
      </header>
      {mobileOpen && (
        <button
          className="ref-mobile-shade"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`ref-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="ref-quick">
          <button
            onClick={() => setPanel("quick")}
            aria-label="Thêm nhanh"
            title="Thêm nhanh chứng từ (+)"
          >
            <span className="ref-nav-icon">
              <Plus size={16} strokeWidth={2.5} />
            </span>
            <span className="ref-nav-label">Thêm nhanh</span>
          </button>
        </div>

        <SidebarNavigation
          moduleId={moduleId}
          href={href}
          onNavigate={() => setMobileOpen(false)}
          onOpenAI={() => {
            navigate(href("/cash/transactions"));
            setNotice("Trợ lý AVA Kế toán đã sẵn sàng.");
          }}
          onExchangeRate={() => {
            navigate(href("/cash/transactions"));
            setNotice("Tính năng Tính tỷ giá xuất quỹ ngoại tệ (USD, EUR) theo phương pháp Bình quân gia quyền.");
          }}
        />

        <div className="ref-sidebar-footer">
          <button
            className="ref-sidebar-footer-btn"
            onClick={() => infoAction("Thiết lập phân hệ")}
            title="Thiết lập phân hệ"
            aria-label="Thiết lập phân hệ"
          >
            <span className="ref-nav-icon">
              <Pencil size={15} />
            </span>
            <span className="ref-nav-label">Thiết lập phân hệ</span>
          </button>
          <button
            className="ref-collapse ref-sidebar-footer-btn"
            onClick={toggleCollapsed}
            title={
              collapsed
                ? "Mở rộng thanh bên (Ctrl+B)"
                : "Thu nhỏ thanh bên (Ctrl+B)"
            }
            aria-label={
              collapsed
                ? "Mở rộng thanh bên"
                : "Thu nhỏ thanh bên"
            }
          >
            <span className="ref-nav-icon">
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </span>
            <span className="ref-nav-label">{collapsed ? "Mở rộng" : "Thu nhỏ"}</span>
          </button>
        </div>
      </aside>
      <main id="reference-main" className="ref-main" tabIndex={-1}>
        <span className="sr-only">
          Phân hệ {module?.label || "Không tìm thấy"}
        </span>
        {!["reports", "analysis", "opening"].includes(moduleId) && (
        <div className="ref-module-bar">
          <nav aria-label="Chức năng phân hệ">
            {moduleId === "payroll" ? (
              [
                ["process", "Quy trình"],
                ["attendance", "Chấm công"],
                ["attendance-summary", "Tổng hợp chấm công"],
                ["calculation", "Tính lương"],
                ["posting", "Hạch toán chi phí"],
                ["tax-deduction", "Khấu trừ thuế TNCN"],
                ["reports", "Báo cáo"],
              ].map(([id, label]) => (
                <Link
                  className={tab === id ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                </Link>
              ))
            ) : moduleId === "tax" ? (
              [
                ["declarations", "Khai thuế"],
                ["payment-orders", "Giấy nộp tiền"],
                ["risk-suppliers", "Danh sách NCC có rủi ro"],
                ["reports", "Báo cáo"],
              ].map(([id, label]) => (
                <Link
                  className={(tab === id || (!tab && id === "declarations")) ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                </Link>
              ))
            ) : moduleId === "cost" ? (
              [
                ["process", "Quy trình"],
                ["continuous-simple", "Sản xuất liên tục - Giản đơn"],
                ["continuous-coefficient", "Sản xuất liên tục - Hệ số, tỷ lệ"],
                ["continuous-step", "Sản xuất liên tục - Phân bước"],
                ["projects", "Công trình"],
                ["orders", "Đơn hàng"],
                ["contracts", "Hợp đồng"],
                ["reports", "Báo cáo"],
              ].map(([id, label]) => (
                <Link
                  className={(tab === id || (!tab && id === "process")) ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                </Link>
              ))
            ) : moduleId === "ledger" ? (
              [
                ["process", "Quy trình"],
                ["advance-settlement-request", "Đề nghị quyết toán tạm ứng"],
                ["transactions", "Chứng từ nghiệp vụ khác"],
                ["closing-entry", "Kết chuyển lãi lỗ"],
                ["reports", "Báo cáo"],
                ["statements", "Lập báo cáo tài chính"],
              ].map(([id, label]) => (
                <Link
                  className={(tab === id || (!tab && id === "process")) ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                </Link>
              ))
            ) : (
              tabs.map(([id, label]) => (
                <Link
                  className={tab === id ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                  {(id === "news" || (moduleId === "purchases" && id === "invoice-processing") || (moduleId === "sales" && id === "auto-posting")) && <small style={{ marginLeft: 4 }}>Mới</small>}
                </Link>
              ))
            )}
          </nav>
          <div className="ref-tab-tools">
            {moduleId === "ledger" ? (
              <button
                type="button"
                onClick={() => setNotice("Hướng dẫn quy trình Tổng hợp, kết chuyển lãi lỗ và lập Báo cáo tài chính chuẩn TT 200 / TT 133 / TT 99")}
                title="Xem hướng dẫn Tổng hợp"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#00a862",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.3)",
                }}
              >
                <Lightbulb size={18} />
              </button>
            ) : moduleId === "payroll" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", position: "relative" }}>
                <span style={{ fontSize: 13, color: "#475569" }}>Tùy chọn:</span>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setPayrollOptionOpen(!payrollOptionOpen)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontWeight: 700,
                      color: "#111827",
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 6px",
                      borderRadius: 4,
                    }}
                  >
                    <span>{payrollOption}</span>
                    <ChevronDown size={14} />
                  </button>

                  {payrollOptionOpen && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                        width: 220,
                        zIndex: 200,
                        padding: "6px 0",
                      }}
                    >
                      <div
                        onClick={() => {
                          setPayrollOption("Tiền lương AMIS Kế toán");
                          setPayrollOptionOpen(false);
                        }}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          color: payrollOption === "Tiền lương AMIS Kế toán" ? "#00a862" : "#334155",
                          fontWeight: payrollOption === "Tiền lương AMIS Kế toán" ? 600 : 400,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Tiền lương AMIS Kế toán</span>
                        {payrollOption === "Tiền lương AMIS Kế toán" && <Check size={14} />}
                      </div>
                      <div
                        onClick={() => {
                          setPayrollOption("AMIS Tiền lương");
                          setPayrollOptionOpen(false);
                          setNotice("Đã chuyển kết nối với dịch vụ đám mây AMIS Tiền lương");
                        }}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          color: payrollOption === "AMIS Tiền lương" ? "#00a862" : "#334155",
                          fontWeight: payrollOption === "AMIS Tiền lương" ? 600 : 400,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>AMIS Tiền lương</span>
                        {payrollOption === "AMIS Tiền lương" && <Check size={14} />}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  className="ref-icon"
                  aria-label="Tùy chọn hiển thị"
                  onClick={() => setPanel("tabs")}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    padding: 4,
                  }}
                  title="Thiết lập tùy chọn tiền lương"
                >
                  <SlidersHorizontal size={17} />
                </button>
              </div>
            ) : moduleId === "tax" ? (
              <button
                type="button"
                onClick={() => setNotice("Kiến thức và chính sách thuế mới nhất 2026")}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#00a862",
                  border: "none",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#ffffff",
                  boxShadow: "0 2px 4px rgba(0, 168, 98, 0.25)",
                }}
                title="Gợi ý & Hướng dẫn chính sách thuế"
              >
                <Lightbulb size={14} color="#ffffff" />
              </button>
            ) : moduleId === "budget" ? null : (
              <>
                <button
                  className="ref-icon"
                  aria-label="Tùy chọn hiển thị"
                  onClick={() => setPanel("tabs")}
                >
                  <SlidersHorizontal size={17} />
                </button>
                {moduleId === "bank" && (
                  <button
                    type="button"
                    className="misa-ebank-header-btn"
                    onClick={() => setNotice("Mở kết nối Ngân hàng điện tử MISA eBanking...")}
                  >
                    <span className="misa-ebank-badge-dot" />
                    <div style={{ display: "flex", flexDirection: "column", textAlign: "left", lineHeight: 1.15 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff" }}>Ngân hàng điện tử</span>
                      <span style={{ fontSize: 10, color: "#e0f2fe" }}>Kết nối ngay</span>
                    </div>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        )}
        {moduleId === "overview" && tab === "overview" ? (
          <ReferenceDashboard
            items={scoped}
            company={company.name}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "purchases" && tab === "invoice-processing" ? (
          <IncomingInvoiceWorkspace notify={setNotice} />
        ) : moduleId === "purchases" ? (
          <MisaPurchaseWorkspace
            key={`purchases-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "reports" ? (
          <MisaReportCenterWorkspace notify={setNotice} />
        ) : moduleId === "directory" ? (
          <DirectoryWorkspace notify={setNotice} />
        ) : moduleId === "opening" ? (
          <MisaOpeningBalanceWorkspace notify={setNotice} />
        ) : moduleId === "cash" ? (
          <MisaCashWorkspace
            key={`cash-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "bank" ? (
          <MisaBankWorkspace
            key={`bank-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "sales" ? (
          <MisaSalesWorkspace
            key={`sales-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "inventory" ? (
          <MisaInventoryWorkspace
            key={`inventory-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "tools" ? (
          <MisaToolsWorkspace
            key={`tools-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "assets" ? (
          <MisaAssetsWorkspace
            key={`assets-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "payroll" ? (
          <MisaPayrollWorkspace
            key={`payroll-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "cost" ? (
          <MisaCostWorkspace
            key={`cost-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab || "process"}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "ledger" ? (
          <MisaLedgerWorkspace
            key={`ledger-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab || "process"}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "budget" ? (
          <MisaBudgetWorkspace
            key={`budget-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab || "charts"}
            href={href}
            notify={setNotice}
          />
        ) : tab === "process" ? (
          <AuditedProcessWorkspace
            moduleId={moduleId}
            moduleLabel={module?.label || "Kế toán"}
            notify={setNotice}
          />
        ) : tab === "transactions" &&
          ["cash", "bank", "sales"].includes(
            moduleId,
          ) ? (
          <ReferenceTransactions
            key={`${moduleId}-${company.id}-${period}-${tab}`}
            moduleId={moduleId}
            items={scoped}
            create={create}
            onDetail={(t) => setDetailId(t.id)}
            notify={setNotice}
            onInfo={infoAction}
          />
        ) : moduleId === "tax" ? (
          <MisaTaxWorkspace
            key={`tax-${company.id}-${period}-${tab}`}
            company={company}
            period={period}
            tab={tab || "declarations"}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "analysis" ? (
          <MisaFinancialAnalysisWorkspace notify={setNotice} />
        ) : (
          <NestedWorkspace
            moduleId={moduleId}
            moduleLabel={module?.label || "Phân hệ"}
            tab={
              activeTabNode || {
                id: tab,
                label:
                  tabs.find((item) => item[0] === tab)?.[1] ||
                  module?.label ||
                  "Danh sách nghiệp vụ",
              }
            }
            childId={childTab}
            href={href}
            notify={setNotice}
          />
        )}
      </main>
      {panel === "settings" && (
        <Modal
          title="Các tiện ích và thiết lập"
          onClose={() => setPanel(null)}
          wide
        >
          <div className="ref-mega-menu">
            {settingsGroups.map((g, i) => (
              <section
                className={`ref-settings-group group-${i}`}
                key={g.title}
              >
                <h3>{g.title}</h3>
                {g.items.map((label) => (
                  <button key={label} onClick={() => infoAction(label)}>
                    {label}
                  </button>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
      {panel === "mode" && (
        <WorkModeModal
          current={workMode}
          onChange={setWorkMode}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "tabs" && (
        <TabSettingsModal
          moduleName={module?.label || "Kế toán"}
          tabs={tabs}
          onClose={() => setPanel(null)}
        />
      )}
      {panel && !["settings", "mode", "tabs"].includes(panel) && (
        <Modal
          title={
            panel === "quick"
              ? "Thêm nhanh chứng từ"
              : panel === "help"
                ? "Hướng dẫn sử dụng"
                : panel === "module"
                  ? `${module?.label || "Phân hệ"} — truy cập nhanh`
                  : "Thông báo"
          }
          className={panel === "notifications" ? "misa-notif-modal" : ""}
          onClose={() => setPanel(null)}
        >
          <div className="modal-body">
            {panel === "quick" ? (
              <div className="quick-create-groups">
                {quickCreateGroups.map((group) => (
                  <section key={group.title}>
                    <h3>{group.title}</h3>
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        onClick={() =>
                          item.kind ? create(item.kind) : infoAction(item.label)
                        }
                      >
                        <Plus size={15} />
                        {item.label}
                      </button>
                    ))}
                  </section>
                ))}
              </div>
            ) : panel === "help" ? (
              <>
                <p>
                  Chọn phân hệ bên trái, sau đó chọn Quy trình hoặc danh sách
                  giao dịch trên thanh tab.
                </p>
                <ol className="help-list">
                  <li>Nhấn Thu tiền hoặc Chi tiền để mở các nghiệp vụ.</li>
                  <li>
                    Dùng bộ lọc để tìm chứng từ theo trạng thái và thời gian.
                  </li>
                  <li>Chọn một chứng từ để xem chi tiết phía dưới bảng.</li>
                </ol>
                <p className="info-note">
                  Bản trải nghiệm lưu nháp trên trình duyệt. Chưa kết nối API kế
                  toán, phân quyền và thuế.
                </p>
              </>
            ) : panel === "module" ? (
              <div className="module-quick-menu">
                <section>
                  <h3>NGHIỆP VỤ</h3>
                  {tabs.slice(0, 6).map(([, label]) => (
                    <button key={label} onClick={() => infoAction(label)}>
                      {label}
                    </button>
                  ))}
                </section>
                <section>
                  <h3>TIỆN ÍCH</h3>
                  <button onClick={() => infoAction("Kiểm tra đối chiếu")}>
                    Kiểm tra đối chiếu
                  </button>
                  <button onClick={() => infoAction("Nhập dữ liệu")}>
                    Nhập dữ liệu
                  </button>
                </section>
                <section>
                  <h3>BÁO CÁO</h3>
                  <button onClick={() => navigate(href("/reports"))}>
                    Mở trung tâm báo cáo
                  </button>
                </section>
              </div>
            ) : panel === "notifications" ? (
              <div className="misa-notif-container">
                {/* 1. Top filter & Mark as read */}
                <div className="misa-notif-topbar">
                  <div className="misa-notif-tabs">
                    <button
                      type="button"
                      className={`misa-notif-tab ${notifFilter === "all" ? "active" : ""}`}
                      onClick={() => setNotifFilter("all")}
                    >
                      <span>Tất cả</span>
                      <span className="misa-notif-badge-pill">{allNotifs.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`misa-notif-tab ${notifFilter === "pending" ? "active" : ""}`}
                      onClick={() => setNotifFilter("pending")}
                    >
                      <span>Chờ duyệt</span>
                      <span className="misa-notif-badge-pill">{voucherNotifs.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`misa-notif-tab ${notifFilter === "system" ? "active" : ""}`}
                      onClick={() => setNotifFilter("system")}
                    >
                      <span>Cảnh báo & Nhắc việc</span>
                      <span className="misa-notif-badge-pill">{systemAlerts.length}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="misa-notif-mark-read"
                    onClick={() => {
                      setReadNotifIds(new Set(allNotifs.map((n) => n.id)));
                      setNotice("Đã đánh dấu đọc tất cả thông báo.");
                    }}
                  >
                    <CheckCheck size={14} />
                    <span>Đánh dấu đã đọc</span>
                  </button>
                </div>

                {/* 2. Notification Cards List */}
                <div className="misa-notif-list">
                  {displayedNotifs.length === 0 ? (
                    <div className="misa-notif-empty">
                      <CheckCheck size={36} style={{ color: "#10b981" }} />
                      <h4>Không có thông báo nào</h4>
                      <p>Mọi chứng từ và cảnh báo trong mục này đã được xử lý xong.</p>
                    </div>
                  ) : (
                    displayedNotifs.map((n) => {
                      const isUnread = !readNotifIds.has(n.id);
                      return (
                        <div
                          key={n.id}
                          className={`misa-notif-card ${isUnread ? "unread" : ""}`}
                          onClick={() => {
                            setReadNotifIds((prev) => new Set([...prev, n.id]));
                            if ("isVoucher" in n && n.isVoucher) {
                              setPanel(null);
                              setDetailId(n.id);
                            } else if ("actionUrl" in n && n.actionUrl) {
                              setPanel(null);
                              navigate(href(n.actionUrl));
                            }
                          }}
                        >
                          <div
                            className="misa-notif-card-icon"
                            style={{
                              background:
                                n.kind === "receipt"
                                  ? "#ecfdf5"
                                  : n.kind === "payment"
                                    ? "#fef2f2"
                                    : n.kind === "bank"
                                      ? "#eff6ff"
                                      : n.kind === "alert"
                                        ? "#fff7ed"
                                        : n.kind === "tax"
                                          ? "#f0fdfa"
                                          : "#f5f3ff",
                              color:
                                n.kind === "receipt"
                                  ? "#059669"
                                  : n.kind === "payment"
                                    ? "#dc2626"
                                    : n.kind === "bank"
                                      ? "#0284c7"
                                      : n.kind === "alert"
                                        ? "#ea580c"
                                        : n.kind === "tax"
                                          ? "#0d9488"
                                          : "#7c3aed",
                            }}
                          >
                            {n.kind === "receipt" ? (
                              <ArrowDownLeft size={18} />
                            ) : n.kind === "payment" ? (
                              <ArrowUpRight size={18} />
                            ) : n.kind === "bank" ? (
                              <Landmark size={18} />
                            ) : n.kind === "alert" ? (
                              <AlertTriangle size={18} />
                            ) : n.kind === "tax" ? (
                              <Calendar size={18} />
                            ) : (
                              <Sparkles size={18} />
                            )}
                          </div>

                          <div className="misa-notif-card-body">
                            <div className="misa-notif-card-header">
                              <div className="misa-notif-code-group">
                                <span className="misa-notif-code">{n.code}</span>
                                <span
                                  className="misa-notif-type-tag"
                                  style={{
                                    background:
                                      n.kind === "receipt"
                                        ? "#ecfdf5"
                                        : n.kind === "payment"
                                          ? "#fef2f2"
                                          : n.kind === "bank"
                                            ? "#eff6ff"
                                            : "#f1f5f9",
                                    color:
                                      n.kind === "receipt"
                                        ? "#059669"
                                        : n.kind === "payment"
                                          ? "#dc2626"
                                          : n.kind === "bank"
                                            ? "#0284c7"
                                            : "#475569",
                                  }}
                                >
                                  {n.kindLabel}
                                </span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {n.amount > 0 && (
                                  <span
                                    className="misa-notif-amount"
                                    style={{
                                      color: n.kind === "payment" ? "#dc2626" : "#059669",
                                    }}
                                  >
                                    {n.kind === "payment" ? "-" : "+"}
                                    {n.amount.toLocaleString("vi-VN")} đ
                                  </span>
                                )}
                                {isUnread && <span className="misa-notif-dot" />}
                              </div>
                            </div>

                            <p className="misa-notif-desc">{n.description}</p>

                            <div className="misa-notif-partner">
                              {n.category === "pending"
                                ? `Đối tác: ${n.partner}`
                                : `Nguồn: ${n.partner}`}
                            </div>

                            <div className="misa-notif-card-footer">
                              <div className="misa-notif-date">
                                <Clock size={12} />
                                <span>{n.date}</span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {n.category === "pending" ? (
                                  <span className="misa-notif-status-pill">Chờ duyệt</span>
                                ) : (
                                  <span
                                    className="misa-notif-status-pill"
                                    style={{ background: "#e0f2fe", color: "#0369a1" }}
                                  >
                                    Hệ thống
                                  </span>
                                )}
                                <span className="misa-notif-action-hint">
                                  Xem {n.category === "pending" ? "chứng từ" : "chi tiết"} →
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 3. Bottom bar */}
                <div className="misa-notif-bottom-bar">
                  <span className="misa-notif-summary">
                    {unreadCount > 0
                      ? `Còn ${unreadCount} thông báo chưa đọc`
                      : "Đã đọc tất cả thông báo"}
                  </span>
                  <button
                    type="button"
                    className="misa-btn-secondary"
                    style={{ height: 30, fontSize: 12.5, padding: "0 14px" }}
                    onClick={() => setPanel(null)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <p>Không có dữ liệu hiển thị.</p>
            )}
          </div>
        </Modal>
      )}
      {info && (
        <Modal title={info} onClose={() => setInfo("")}>
          <div className="modal-body">
            <p className="info-note">
              Chức năng “{info}” chưa kết nối dữ liệu nghiệp vụ. Bản giao diện
              hiện hỗ trợ tạo nháp, xem chứng từ, tìm kiếm, lọc và xuất CSV.
            </p>
          </div>
        </Modal>
      )}
      {createKind && (
        <DocumentForm
          kind={createKind}
          company={company.id}
          period={period}
          onSave={save}
          onClose={() => setCreateKind(null)}
        />
      )}
      {detail && (
        <DocumentDetail
          item={detail}
          onClose={() => setDetailId(null)}
          onSubmit={submit}
        />
      )}
      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={16} />
            <span>{notice}</span>
            <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ReferenceWorkspace />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
