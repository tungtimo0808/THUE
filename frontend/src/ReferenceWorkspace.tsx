import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
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
  Building2,
  Calendar,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Database,
  Download,
  Landmark,
  Lightbulb,
  LogIn,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
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
import {
  referenceNav,
  referenceTabHierarchy,
  referenceTabs,
  settingsGroups,
} from "./reference-config";
import {
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
import MisaDirectoryWorkspace from './MisaDirectoryWorkspace';
import TaxInvoiceSyncPanel from './TaxInvoiceSyncPanel';

// Code-split heavy workspace modules for instant initial load (sub-second cold start)
const MisaCashWorkspace = lazy(() => import("./MisaCashWorkspace"));
const MisaBankWorkspace = lazy(() => import("./MisaBankWorkspace"));
const MisaPurchaseWorkspace = lazy(() => import("./MisaPurchaseWorkspace"));
const MisaSupplierRiskWorkspace = lazy(() => import("./MisaSupplierRiskWorkspace"));
const MisaSalesWorkspace = lazy(() => import("./MisaSalesWorkspace"));
const MisaInventoryWorkspace = lazy(() => import("./MisaInventoryWorkspace"));
const MisaToolsWorkspace = lazy(() => import("./MisaToolsWorkspace"));
const MisaAssetsWorkspace = lazy(() => import("./MisaAssetsWorkspace"));
const MisaPayrollWorkspace = lazy(() => import("./MisaPayrollWorkspace"));
const MisaTaxWorkspace = lazy(() => import("./MisaTaxWorkspace"));
const MisaCostWorkspace = lazy(() => import("./MisaCostWorkspace"));
const MisaLedgerWorkspace = lazy(() => import("./MisaLedgerWorkspace"));
const MisaBudgetWorkspace = lazy(() => import("./MisaBudgetWorkspace"));
const MisaReportCenterWorkspace = lazy(() => import("./MisaReportCenterWorkspace"));
const MisaFinancialAnalysisWorkspace = lazy(() => import("./MisaFinancialAnalysisWorkspace"));
const MisaOpeningBalanceWorkspace = lazy(() => import("./MisaOpeningBalanceWorkspace"));
const MisaDashboardOverview = lazy(() => import("./MisaDashboardOverview"));
const MisaInvoiceWorkspace = lazy(() => import("./MisaInvoiceWorkspace"));
const InvoiceLookupWorkspace = lazy(() => import("./InvoiceLookupWorkspace"));
const CompanyAdminWorkspace = lazy(() => import("./CompanyAdminWorkspace"));
const SuperAdminWorkspace = lazy(() => import("./SuperAdminWorkspace"));

const WorkspaceLoader = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 12, width: "100%" }}>
    <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải dữ liệu phân hệ...</span>
    <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);
import ErrorBoundary from "./ErrorBoundary";
import { ApiSessionProvider, useApiSession } from "./ApiSession";
import LiveAccount from "./LiveAccount";
import LiveJoin from "./LiveJoin";
import LiveLogin from "./LiveLogin";
import LiveCompanySelect from "./LiveCompanySelect";
import LivePasswordReset from "./LivePasswordReset";
import LiveProfile from "./LiveProfile";
import LiveScope from "./LiveScope";
import LiveCommonHub from "./LiveCommonHub";
import LiveCompanyBootstrap from "./LiveCompanyBootstrap";
import LiveCompanyProfile from "./LiveCompanyProfile";
import LiveOrgStructure from "./LiveOrgStructure";
import LiveJoinAdmin from "./LiveJoinAdmin";
import LiveCompanyUsers from "./LiveCompanyUsers";
import LiveRoles from "./LiveRoles";
import LivePermissions from "./LivePermissions";
import LiveDataScopes from "./LiveDataScopes";
import LiveOrgAssignments from "./LiveOrgAssignments";
import LiveWorkflows from "./LiveWorkflows";
import LiveApprovalTasks from "./LiveApprovalTasks";
import LiveModules from "./LiveModules";
import LiveNumberingRules from "./LiveNumberingRules";
import LiveFiscalPeriods from "./LiveFiscalPeriods";
import LiveAccountingPolicies from "./LiveAccountingPolicies";
import LiveAuditLogs from "./LiveAuditLogs";
import LiveUserAccess from "./LiveUserAccess";
import LiveCustomerDetails from "./LiveCustomerDetails";
import LiveVendors from "./LiveVendors";
import LiveEmployees from "./LiveEmployees";
import LiveItems from "./LiveItems";
import LiveVendorDetails from "./LiveVendorDetails";
import LiveItemCategories from "./LiveItemCategories";
import LiveUoms from "./LiveUoms";
import LiveWarehouses from "./LiveWarehouses";
import LiveCompanyBankAccounts from "./LiveCompanyBankAccounts";
import LiveAccounts from "./LiveAccounts";
import LiveCatalogExtensions from "./LiveCatalogExtensions";
import { MisaModuleApiExtensionPanel, MODULE_EXTENDED_APIS } from "./MisaModuleApiExtensionDrawer";
import { request } from "./live-api";
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
  const {
    restoring: apiRestoring,
    token: apiToken,
    signOut: apiSignOut,
    companies: apiCompanies,
    companyId: apiCompanyId,
    selectCompany: apiSelectCompany,
    session: apiSession,
  } = useApiSession();
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [activeClusterMenu, setActiveClusterMenu] = useState<"company" | "dataset" | "branch" | "period" | null>(null);
  const clusterRef = useRef<HTMLDivElement>(null);

  const [tabOptionsOpen, setTabOptionsOpen] = useState(false);
  const [tabMoreOpen, setTabMoreOpen] = useState(false);
  const tabOptionsRef = useRef<HTMLDivElement>(null);
  const tabMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (userDropdownRef.current && !userDropdownRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (clusterRef.current && !clusterRef.current.contains(target)) {
        setActiveClusterMenu(null);
      }
      if (tabOptionsRef.current && !tabOptionsRef.current.contains(target)) {
        setTabOptionsOpen(false);
      }
      if (tabMoreRef.current && !tabMoreRef.current.contains(target)) {
        setTabMoreOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserDropdownOpen(false);
        setActiveClusterMenu(null);
        setTabOptionsOpen(false);
        setTabMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setTabOptionsOpen(false);
    setTabMoreOpen(false);
  }, [location.pathname]);

  const userEmail = apiSession?.user?.email || "";
  const rawDisplayName =
    apiSession?.user?.display_name ||
    apiSession?.user?.username ||
    (userEmail ? userEmail.split("@")[0] : "Admin");
  const userDisplayName = rawDisplayName.replace(/\s*\((?:Super\s*)?Admin\)/gi, "").trim();
  const userInitial = (userDisplayName || "A").charAt(0).toUpperCase();

  // Enforce flow: If not logged in, navigate to /login; if logged in but no company, navigate to /select-company
  useEffect(() => {
    if (!apiRestoring && !apiToken) {
      navigate("/login");
    } else if (!apiRestoring && apiToken && apiCompanies.length === 0) {
      navigate("/select-company");
    }
  }, [apiRestoring, apiToken, apiCompanies.length, navigate]);

  const pathParts = location.pathname.split("/");
  const moduleId = pathParts[1] || "overview",
    tabs = referenceTabs[moduleId] || [["transactions", "Danh sách"]];
  const requestedTab = pathParts[2];
  const tab = moduleId === "invoices" && requestedTab === "errors"
    ? "adjustments"
    : tabs.some(([id]) => id === requestedTab)
      ? requestedTab
      : tabs[0][0],
    childTab = pathParts[3],
    module = referenceNav.find((m) => m.id === moduleId);
  const activeTabNode = referenceTabHierarchy[moduleId]?.find(
    (item) => item.id === tab,
  );

  const [configuredTabs, setConfiguredTabs] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem("ref_visible_tabs_map_v2");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const getVisibleTabIds = (modId: string, allTabs: [string, string][]): string[] => {
    if (configuredTabs[modId] && Array.isArray(configuredTabs[modId]) && configuredTabs[modId].length > 0) {
      const valid = configuredTabs[modId].filter(id => allTabs.some(([tId]) => tId === id));
      if (valid.length > 0) return valid;
    }
    return allTabs.map(([id]) => id);
  };

  const rawVisibleTabIds = getVisibleTabIds(moduleId, tabs);

  // Ordered candidate tabs that the user wants on the taskbar (all tabs by default)
  const candidateTabs = useMemo(() => {
    const tabMap = new Map(tabs);
    return rawVisibleTabIds
      .map((id) => (tabMap.has(id) ? ([id, tabMap.get(id)!] as [string, string]) : null))
      .filter((item): item is [string, string] => item !== null);
  }, [tabs, rawVisibleTabIds]);

  // Tabs explicitly unchecked by the user in TabSettingsModal
  const explicitHiddenTabs = useMemo(() => {
    const candidateSet = new Set(rawVisibleTabIds);
    return tabs.filter(([id]) => !candidateSet.has(id));
  }, [tabs, rawVisibleTabIds]);

  const moduleBarRef = useRef<HTMLDivElement>(null);
  const measureBarRef = useRef<HTMLDivElement>(null);
  const measureMoreBaseRef = useRef<HTMLSpanElement>(null);
  const measureMoreActiveRef = useRef<HTMLSpanElement>(null);
  const tabToolsRef = useRef<HTMLDivElement>(null);
  const [fittingCount, setFittingCount] = useState<number>(() => candidateTabs.length);
  const [moreDropdownAlignRight, setMoreDropdownAlignRight] = useState(false);

  const activeTabLabel = useMemo(() => {
    const found = tabs.find(([id]) => id === tab);
    return found ? found[1] : "";
  }, [tabs, tab]);

  const recalculateFittingTabs = useCallback(() => {
    const barEl = moduleBarRef.current;
    const measureEl = measureBarRef.current;
    const toolsEl = tabToolsRef.current;
    const n = candidateTabs.length;
    if (n === 0) {
      setFittingCount(0);
      return;
    }
    if (!barEl || !measureEl) {
      setFittingCount(n);
      return;
    }

    const barStyle = window.getComputedStyle(barEl);
    const padLeft = parseFloat(barStyle.paddingLeft) || 0;
    const padRight = parseFloat(barStyle.paddingRight) || 0;
    const innerWidth = barEl.clientWidth - padLeft - padRight;
    const toolsWidth = toolsEl ? toolsEl.offsetWidth : 0;
    // Leave a safe 8px buffer before the right-hand tools
    const availableWidth = Math.max(0, innerWidth - toolsWidth - 8);

    const tabNodes = Array.from(measureEl.querySelectorAll<HTMLElement>("[data-measure-tab]"));
    const tabWidths = tabNodes.map((el) => Math.ceil(el.getBoundingClientRect().width));
    const moreBaseWidth = Math.ceil(measureMoreBaseRef.current?.getBoundingClientRect().width || 68);
    const moreActiveWidth = Math.ceil(measureMoreActiveRef.current?.getBoundingClientRect().width || 140);

    const navGap = 2; // gap between tabs inside <nav>
    const barGap = 4; // gap between <nav> and .ref-tab-more-wrap

    let bestK = 1;
    for (let k = n; k >= 1; k--) {
      let navWidth = 0;
      for (let i = 0; i < k; i++) {
        navWidth += (tabWidths[i] || 0) + (i > 0 ? navGap : 0);
      }
      const overflowCount = (n - k) + explicitHiddenTabs.length;
      let requiredWidth = navWidth;
      if (overflowCount > 0) {
        const activeInVisible = candidateTabs.slice(0, k).some(([id]) => id === tab);
        const activeInOverflow =
          !activeInVisible &&
          (candidateTabs.slice(k).some(([id]) => id === tab) ||
            explicitHiddenTabs.some(([id]) => id === tab));
        const moreWidth = activeInOverflow ? moreActiveWidth : moreBaseWidth;
        requiredWidth = navWidth + barGap + moreWidth;
      }
      if (requiredWidth <= availableWidth) {
        bestK = k;
        break;
      }
    }
    setFittingCount((prev) => (prev === bestK ? prev : bestK));
  }, [candidateTabs, explicitHiddenTabs, tab]);

  const primaryVisibleTabs = useMemo(() => {
    const count = Math.min(Math.max(1, fittingCount), candidateTabs.length);
    return candidateTabs.slice(0, count);
  }, [candidateTabs, fittingCount]);

  const secondaryTabs = useMemo(() => {
    const count = Math.min(Math.max(1, fittingCount), candidateTabs.length);
    const overflowedCandidates = candidateTabs.slice(count);
    return [...overflowedCandidates, ...explicitHiddenTabs];
  }, [candidateTabs, fittingCount, explicitHiddenTabs]);

  const activeSecondaryTab = useMemo(() => {
    return secondaryTabs.find(([id]) => id === tab);
  }, [secondaryTabs, tab]);

  const handleSaveTabs = (newVisible: string[]) => {
    const nextMap = { ...configuredTabs, [moduleId]: newVisible };
    setConfiguredTabs(nextMap);
    try {
      localStorage.setItem("ref_visible_tabs_map_v2", JSON.stringify(nextMap));
    } catch {}
    setNotice(`✓ Đã lưu thiết lập thanh tác vụ cho phân hệ ${module?.label || ""}`);
  };

  const handleResetTabs = () => {
    const nextMap = { ...configuredTabs };
    delete nextMap[moduleId];
    setConfiguredTabs(nextMap);
    try {
      localStorage.setItem("ref_visible_tabs_map_v2", JSON.stringify(nextMap));
    } catch {}
    setNotice(`✓ Đã đặt lại thanh tác vụ mặc định cho phân hệ ${module?.label || ""}`);
  };
  const matchedApiCompany =
    apiCompanies.find((c) => c.id === params.get("company")) ||
    apiCompanies.find((c) => c.id === apiCompanyId) ||
    apiCompanies[0];
  const company = matchedApiCompany || companies[0];
  const period = ["2026-12", "2026-09", "2026-08", "2026"].includes(
    params.get("period") || "",
  )
    ? params.get("period")!
    : "2026-09";
  const [dataset, setDataset] = useState(() => {
    try {
      return localStorage.getItem("ref_dataset") || "accounting-2026";
    } catch {
      return "accounting-2026";
    }
  });
  const [branch, setBranch] = useState(() => {
    try {
      return localStorage.getItem("ref_branch") || "head-office";
    } catch {
      return "head-office";
    }
  });
  const [recentlyChangedCluster, setRecentlyChangedCluster] = useState<string | null>(null);
  const [isSwitchingContext, setIsSwitchingContext] = useState(false);

  // Sync dashboard summary KPIs from backend /api/v1/common/dashboard/ when on overview
  useEffect(() => {
    if (!apiToken || !company.id || moduleId !== "overview") return;
    void request(`/api/v1/common/dashboard/?company_id=${encodeURIComponent(company.id)}`, apiToken).catch(() => {});
  }, [apiToken, company.id, moduleId]);

  const triggerSwitchFeedback = (type: string, message: string) => {
    setRecentlyChangedCluster(type);
    setIsSwitchingContext(true);
    setNotice(message);
    setTimeout(() => setRecentlyChangedCluster(null), 1200);
    setTimeout(() => setIsSwitchingContext(false), 280);
  };

  const datasetLabel = dataset === "accounting-2026" ? "Dữ liệu kế toán 2026" : "Dữ liệu quản trị 2026";
  const branchLabel = branch === "head-office" ? "Trụ sở chính" : "Chi nhánh TP. HCM";
  const periodLabel = period === "2026-09" ? "K9.2026" : period === "2026-08" ? "K8.2026" : "Năm 2026";
  const [items, setItems] = useState(readTransactions);
  const scoped = useMemo(
    () => items.filter((t) => t.company === company.id && (period === "2026" ? t.date.startsWith("2026") : t.date.startsWith(period))),
    [items, company.id, period]
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

  useLayoutEffect(() => {
    recalculateFittingTabs();
  }, [recalculateFittingTabs, moduleId, collapsed]);

  useEffect(() => {
    recalculateFittingTabs();
    const barEl = moduleBarRef.current;
    const toolsEl = tabToolsRef.current;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        recalculateFittingTabs();
      });
      if (barEl) ro.observe(barEl);
      if (toolsEl) ro.observe(toolsEl);
    }
    const handleResize = () => recalculateFittingTabs();
    window.addEventListener("resize", handleResize);
    // Recalculate after sidebar CSS transition (220ms) finishes and after fonts load
    const timer = window.setTimeout(recalculateFittingTabs, 240);
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => recalculateFittingTabs()).catch(() => {});
    }
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(timer);
    };
  }, [recalculateFittingTabs, moduleId, collapsed]);
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
  const [payrollOptionOpen, setPayrollOptionOpen] = useState(false);
  const [payrollOption, setPayrollOption] = useState("Tiền lương Sổ Việt ERP");

  const systemAlerts = [
    {
      id: "sys-cashflow",
      category: "system" as const,
      code: "Cảnh báo quỹ",
      kindLabel: "Dự báo dòng tiền",
      kind: "alert" as const,
      description: "Dự kiến số dư quỹ tiền mặt giảm dưới ngưỡng an toàn (25.000.000 đ) vào ngày 28/09. Đề xuất gửi nhắc nợ đối tác sớm.",
      partner: "Sổ Việt AI",
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
    if (name === "Thông tin công ty" || name === "Quản lý người dùng và phân quyền" || name === "Quản lý dữ liệu") {
      navigate("/admin");
      return;
    }
    if (name === "Nhật ký truy cập") {
      navigate("/audit-logs");
      return;
    }
    if (name === "Tùy chọn") {
      navigate("/admin?tab=config");
      return;
    }
    setInfo(name);
  };
  return (
    <div className={`reference-app ${collapsed ? "ref-collapsed" : ""}`}>
      <a href="#reference-main" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="ref-header">
        {isSwitchingContext && <div className="ref-top-progress-bar" />}
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
        <Link to={href("/overview")} className="ref-brand" title="Sổ Việt ERP">
          <div className="ref-brand-logo-icon">
            <Building2 size={18} />
          </div>
          <div className="ref-brand-text">
            <strong className="ref-brand-name">SỔ VIỆT ERP</strong>
            <span className="ref-brand-sub">KẾ TOÁN & THUẾ</span>
          </div>
        </Link>
        <div className="ref-options-cluster" ref={clusterRef}>
          {/* 1. Doanh nghiệp */}
          <div className={`ref-cluster-item ref-cluster-item-company ${activeClusterMenu === "company" ? "open" : ""} ${recentlyChangedCluster === "company" ? "recently-changed" : ""}`}>
            <button
              type="button"
              className="ref-cluster-trigger"
              onClick={() => setActiveClusterMenu(activeClusterMenu === "company" ? null : "company")}
              title="Doanh nghiệp làm việc"
            >
              <Building2 size={13} className="ref-cluster-icon" />
              <span className="ref-cluster-label ref-cluster-company-label">{company.name}</span>
              <ChevronDown size={11} className={`ref-cluster-caret ${activeClusterMenu === "company" ? "rotated" : ""}`} />
            </button>
            {activeClusterMenu === "company" && (
              <div className="ref-cluster-popover ref-cluster-popover-company">
                <div className="ref-cluster-popover-header">Doanh nghiệp làm việc</div>
                <div className="ref-cluster-popover-list">
                  {(apiCompanies.length > 0 ? apiCompanies : companies).map((c) => {
                    const isSelected = c.id === company.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`ref-cluster-popover-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          if (apiCompanies.some((ac) => ac.id === c.id)) {
                            apiSelectCompany(c.id);
                          }
                          context("company", c.id);
                          setActiveClusterMenu(null);
                          triggerSwitchFeedback("company", `✓ Đã chuyển sang làm việc tại: ${c.name}`);
                        }}
                      >
                        <span className="ref-cluster-item-name">{c.name}</span>
                        {isSelected && <Check size={14} className="ref-cluster-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="ref-cluster-divider ref-cluster-divider-dataset" />

          {/* 2. Dữ liệu kế toán */}
          <div className={`ref-cluster-item ref-cluster-item-dataset ${activeClusterMenu === "dataset" ? "open" : ""} ${recentlyChangedCluster === "dataset" ? "recently-changed" : ""}`}>
            <button
              type="button"
              className="ref-cluster-trigger"
              onClick={() => setActiveClusterMenu(activeClusterMenu === "dataset" ? null : "dataset")}
              title="Dữ liệu kế toán"
            >
              <Database size={13} className="ref-cluster-icon" />
              <span className="ref-cluster-label ref-cluster-dataset-label">{datasetLabel}</span>
              <ChevronDown size={11} className={`ref-cluster-caret ${activeClusterMenu === "dataset" ? "rotated" : ""}`} />
            </button>
            {activeClusterMenu === "dataset" && (
              <div className="ref-cluster-popover">
                <div className="ref-cluster-popover-header">Dữ liệu kế toán</div>
                <div className="ref-cluster-popover-list">
                  {[
                    { id: "accounting-2026", label: "Dữ liệu kế toán 2026" },
                    { id: "management-2026", label: "Dữ liệu quản trị 2026" },
                  ].map((item) => {
                    const isSelected = dataset === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`ref-cluster-popover-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          setDataset(item.id);
                          try {
                            localStorage.setItem("ref_dataset", item.id);
                          } catch {}
                          setActiveClusterMenu(null);
                          triggerSwitchFeedback("dataset", `✓ Đã chuyển sang: ${item.label}`);
                        }}
                      >
                        <span className="ref-cluster-item-name">{item.label}</span>
                        {isSelected && <Check size={14} className="ref-cluster-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="ref-cluster-divider ref-cluster-divider-branch" />

          {/* 3. Chi nhánh */}
          <div className={`ref-cluster-item ref-cluster-item-branch ${activeClusterMenu === "branch" ? "open" : ""} ${recentlyChangedCluster === "branch" ? "recently-changed" : ""}`}>
            <button
              type="button"
              className="ref-cluster-trigger"
              onClick={() => setActiveClusterMenu(activeClusterMenu === "branch" ? null : "branch")}
              title="Chi nhánh, đơn vị"
            >
              <MapPin size={13} className="ref-cluster-icon" />
              <span className="ref-cluster-label ref-cluster-branch-label">{branchLabel}</span>
              <ChevronDown size={11} className={`ref-cluster-caret ${activeClusterMenu === "branch" ? "rotated" : ""}`} />
            </button>
            {activeClusterMenu === "branch" && (
              <div className="ref-cluster-popover">
                <div className="ref-cluster-popover-header">Chi nhánh, đơn vị</div>
                <div className="ref-cluster-popover-list">
                  {[
                    { id: "head-office", label: "Trụ sở chính" },
                    { id: "hcm", label: "Chi nhánh TP. HCM" },
                  ].map((item) => {
                    const isSelected = branch === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`ref-cluster-popover-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          setBranch(item.id);
                          try {
                            localStorage.setItem("ref_branch", item.id);
                          } catch {}
                          setActiveClusterMenu(null);
                          triggerSwitchFeedback("branch", `✓ Đã chuyển sang: ${item.label}`);
                        }}
                      >
                        <span className="ref-cluster-item-name">{item.label}</span>
                        {isSelected && <Check size={14} className="ref-cluster-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="ref-cluster-divider ref-cluster-divider-period" />

          {/* 4. Kỳ kế toán */}
          <div className={`ref-cluster-item ref-cluster-item-period ${activeClusterMenu === "period" ? "open" : ""} ${recentlyChangedCluster === "period" ? "recently-changed" : ""}`}>
            <button
              type="button"
              className="ref-cluster-trigger"
              onClick={() => setActiveClusterMenu(activeClusterMenu === "period" ? null : "period")}
              title="Kỳ kế toán"
            >
              <Calendar size={13} className="ref-cluster-icon" />
              <span className="ref-cluster-label ref-cluster-period-label">{periodLabel}</span>
              <ChevronDown size={11} className={`ref-cluster-caret ${activeClusterMenu === "period" ? "rotated" : ""}`} />
            </button>
            {activeClusterMenu === "period" && (
              <div className="ref-cluster-popover">
                <div className="ref-cluster-popover-header">Kỳ làm việc</div>
                <div className="ref-cluster-popover-list">
                  {[
                    { id: "2026-09", label: "K9.2026 (Tháng 09/2026)" },
                    { id: "2026-08", label: "K8.2026 (Tháng 08/2026)" },
                    { id: "2026", label: "Năm 2026 (Cả năm)" },
                  ].map((item) => {
                    const isSelected = period === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`ref-cluster-popover-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          context("period", item.id);
                          setActiveClusterMenu(null);
                          triggerSwitchFeedback("period", `✓ Đã chọn kỳ kế toán: ${item.label}`);
                        }}
                      >
                        <span className="ref-cluster-item-name">{item.label}</span>
                        {isSelected && <Check size={14} className="ref-cluster-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="ref-header-tools">
          <div className="ref-search-shell">
            <form
              className="ref-global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(apiToken ? `/common?tab=search&q=${encodeURIComponent(query)}` : href("/ledger/transactions", { q: query }));
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
            {!apiToken && <SmartSearchResults
              query={query}
              onSelect={(label) => {
                setQuery("");
                setNotice(`Đã mở ${label}.`);
              }}
            />}
          </div>
          <button
            className="ref-work-mode"
            aria-label={`Chế độ làm việc: ${workMode}`}
            onClick={() => setPanel("mode")}
          >
            {workMode} <ChevronDown size={13} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tải dữ liệu"
            title="Tải báo cáo, dữ liệu"
            onClick={() => navigate(href("/reports"))}
          >
            <Download size={18} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Tính năng mới"
            title="Tính năng mới"
            onClick={() => infoAction("Tính năng mới")}
          >
            <Megaphone size={18} />
          </button>
          <button
            className="ref-icon"
            aria-label="Các tiện ích và thiết lập"
            title="Thiết lập hệ thống"
            onClick={() => setPanel("settings")}
          >
            <Settings size={18} />
          </button>
          <button
            className="ref-icon ref-bell"
            aria-label="Thông báo"
            title="Thông báo"
            onClick={() => navigate("/common")}
          >
            <Bell size={18} />
          </button>
          <button
            className="ref-icon secondary-tool"
            aria-label="Hướng dẫn & Trợ giúp"
            title="Hướng dẫn & Trợ giúp (F1)"
            onClick={() => setPanel("help")}
          >
            <CircleHelp size={18} />
          </button>

          <div className="ref-header-divider" />

          {/* User profile & Action menu */}
          {apiToken ? (
            <div className="ref-user-menu-wrap" ref={userDropdownRef}>
              <button
                type="button"
                className="ref-user-badge-btn"
                onClick={() => {
                  setUserDropdownOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setTabOptionsOpen(false);
                      setTabMoreOpen(false);
                    }
                    return next;
                  });
                }}
                title={`Tài khoản: ${userDisplayName} (bấm để xem cài đặt và đăng xuất)`}
              >
                <div className="ref-user-avatar">
                  {userInitial}
                </div>
                <span className="ref-user-name">{userDisplayName}</span>
                <ChevronDown size={13} color="#64748b" />
              </button>

              {userDropdownOpen && (
                <div className="ref-user-dropdown">
                  <div className="ref-user-dropdown-header">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div className="ref-user-dropdown-title">{userDisplayName}</div>
                      {Boolean(apiSession?.user?.is_superuser) ? (
                        <span style={{ background: "#7c3aed", color: "#ffffff", padding: "2.5px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                          👑 SUPER ADMIN
                        </span>
                      ) : userEmail === "tungtimo0808@gmail.com" ? (
                        <span style={{ background: "#f59e0b", color: "#ffffff", padding: "2.5px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                          👑 ADMIN DOANH NGHIỆP
                        </span>
                      ) : (
                        <span style={{ background: "#0284c7", color: "#ffffff", padding: "2.5px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
                          👤 NHÂN SỰ
                        </span>
                      )}
                    </div>
                    {userEmail && <div className="ref-user-dropdown-email">{userEmail}</div>}
                    <div className="ref-user-dropdown-company">
                      🏢 {apiCompanies.find(item => item.id === apiCompanyId)?.name || company.name || "Doanh nghiệp"}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="ref-user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate("/select-company");
                    }}
                  >
                    <Building2 size={15} />
                    <span>Đổi / Quản lý doanh nghiệp</span>
                  </button>

                  {(Boolean(apiSession?.user?.is_superuser) || userEmail === "tungtimo0808@gmail.com") && (
                    <button
                      type="button"
                      className="ref-user-dropdown-item"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate("/admin");
                      }}
                    >
                      <Building2 size={15} color="#0052cc" />
                      <span><strong>Quản trị doanh nghiệp</strong></span>
                    </button>
                  )}

                  {Boolean(apiSession?.user?.is_superuser) && (
                    <button
                      type="button"
                      className="ref-user-dropdown-item"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        navigate("/super-admin");
                      }}
                    >
                      <ShieldCheck size={15} color="#7c3aed" />
                      <span><strong>Quản trị nền tảng (Super Admin)</strong></span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="ref-user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setPanel("settings");
                    }}
                  >
                    <Settings size={15} />
                    <span>Tiện ích & Thiết lập khác</span>
                  </button>

                  <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0" }} />

                  <button
                    type="button"
                    className="ref-user-dropdown-item danger"
                    onClick={async () => {
                      setUserDropdownOpen(false);
                      await apiSignOut();
                      navigate("/login");
                    }}
                  >
                    <LogOut size={15} />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="ref-login-header-btn"
              onClick={() => navigate("/login")}
            >
              <LogIn size={14} />
              <span>Đăng nhập</span>
            </button>
          )}
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
            setNotice("Trợ lý Sổ Việt AI đã sẵn sàng.");
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
      <main id="reference-main" className={`ref-main ${isSwitchingContext ? "ref-switching-context" : ""}`} tabIndex={-1}>
        <span className="sr-only">
          Phân hệ {module?.label || "Không tìm thấy"}
        </span>
        {!["reports", "analysis", "opening"].includes(moduleId) && (
        <div className="ref-module-bar" ref={moduleBarRef}>
          {/* Hidden measurement row to accurately compute how many tabs fit the current width */}
          <div className="ref-module-bar-measure" ref={measureBarRef} aria-hidden="true">
            {candidateTabs.map(([id, label]) => (
              <span key={id} data-measure-tab={id} className="ref-measure-tab">
                {label}
              </span>
            ))}
            <span ref={measureMoreBaseRef} className="ref-tab-more-btn">
              <span>Khác</span>
              <ChevronDown size={13} />
            </span>
            <span ref={measureMoreActiveRef} className="ref-tab-more-btn active">
              <span>{activeTabLabel ? `Khác: ${activeTabLabel}` : "Khác"}</span>
              <ChevronDown size={13} />
            </span>
          </div>

          <nav aria-label="Chức năng phân hệ">
            {primaryVisibleTabs.map(([id, label]) => {
              const isActive = tab === id || (!tab && id === tabs[0][0]);
              return (
                <Link
                  className={isActive ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {secondaryTabs.length > 0 && (
            <div className="ref-tab-more-wrap" ref={tabMoreRef}>
              <button
                type="button"
                className={`ref-tab-more-btn ${tabMoreOpen ? "open" : ""} ${activeSecondaryTab ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!tabMoreOpen && tabMoreRef.current) {
                    const rect = tabMoreRef.current.getBoundingClientRect();
                    setMoreDropdownAlignRight(rect.left + 260 > window.innerWidth);
                  }
                  setTabMoreOpen((prev) => !prev);
                }}
                title="Xem thêm các tab chức năng khác"
              >
                <span>{activeSecondaryTab ? `Khác: ${activeSecondaryTab[1]}` : "Khác"}</span>
                <ChevronDown size={13} className={`ref-tab-more-caret ${tabMoreOpen ? "rotated" : ""}`} />
              </button>
              {tabMoreOpen && (
                <div className={`ref-tab-more-dropdown ${moreDropdownAlignRight ? "align-right" : ""}`}>
                  <div style={{ padding: "4px 8px 6px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Chức năng khác ({secondaryTabs.length})
                  </div>
                  {secondaryTabs.map(([id, label]) => {
                    const isActive = tab === id;
                    return (
                      <Link
                        key={id}
                        to={href(`/${moduleId}/${id}`)}
                        className={`ref-tab-more-item ${isActive ? "active" : ""}`}
                        onClick={() => setTabMoreOpen(false)}
                      >
                        <span>{label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {isActive && <Check size={13} />}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="ref-tab-tools" ref={tabToolsRef}>
            {moduleId === "ledger" ? (
              <button
                type="button"
                onClick={() => setNotice("Hướng dẫn quy trình Tổng hợp, kết chuyển lãi lỗ và lập Báo cáo tài chính chuẩn Thông tư 99/2025/TT-BTC")}
                title="Xem hướng dẫn Tổng hợp"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#0284c7",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(2, 132, 199, 0.3)",
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
                          setPayrollOption("Tiền lương Sổ Việt ERP");
                          setPayrollOptionOpen(false);
                        }}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          color: payrollOption === "Tiền lương Sổ Việt ERP" ? "#0284c7" : "#334155",
                          fontWeight: payrollOption === "Tiền lương Sổ Việt ERP" ? 600 : 400,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Tiền lương Sổ Việt ERP</span>
                        {payrollOption === "Tiền lương Sổ Việt ERP" && <Check size={14} />}
                      </div>
                      <div
                        onClick={() => {
                          setPayrollOption("Sổ Việt Tiền lương");
                          setPayrollOptionOpen(false);
                          setNotice("Đã chuyển kết nối với dịch vụ đám mây Sổ Việt Tiền lương");
                        }}
                        style={{
                          padding: "8px 14px",
                          fontSize: 13,
                          color: payrollOption === "Sổ Việt Tiền lương" ? "#0284c7" : "#334155",
                          fontWeight: payrollOption === "Sổ Việt Tiền lương" ? 600 : 400,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Sổ Việt Tiền lương</span>
                        {payrollOption === "Sổ Việt Tiền lương" && <Check size={14} />}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : moduleId === "tax" ? (
              <button
                type="button"
                onClick={() => setNotice("Kiến thức và chính sách thuế mới nhất 2026")}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#0284c7",
                  border: "none",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#ffffff",
                  boxShadow: "0 2px 4px rgba(2, 132, 199, 0.25)",
                }}
                title="Gợi ý & Hướng dẫn chính sách thuế"
              >
                <Lightbulb size={14} color="#ffffff" />
              </button>
            ) : null}

            {moduleId === "bank" && (
              <button
                type="button"
                className="misa-ebank-header-btn"
                onClick={() => setNotice("Mở kết nối Ngân hàng điện tử Sổ Việt eBanking...")}
                title="Kết nối Ngân hàng điện tử"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  borderRadius: 6,
                  height: 30,
                  marginRight: 6,
                  flexShrink: 0,
                }}
              >
                <span className="misa-ebank-badge-dot" />
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, lineHeight: 1 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap" }}>
                    Ngân hàng điện tử
                  </span>
                  <span style={{ fontSize: 10.5, color: "#bae6fd", whiteSpace: "nowrap" }}>· Kết nối ngay</span>
                </div>
              </button>
            )}

            {moduleId !== "budget" && (
              <div className="ref-tab-tools-wrap" ref={tabOptionsRef}>
                <button
                  className={`ref-icon ${tabOptionsOpen ? "active" : ""}`}
                  aria-label="Tùy chọn hiển thị các tab"
                  title="Tùy chọn hiển thị các tab chức năng"
                  onClick={() => setTabOptionsOpen(!tabOptionsOpen)}
                >
                  <SlidersHorizontal size={17} />
                </button>

                {tabOptionsOpen && (
                  <div className="ref-tab-options-popover">
                    <div className="ref-tab-options-header">
                      <div className="ref-tab-options-title">
                        Tùy chọn chức năng — {module?.label || "Kế toán"}
                      </div>
                      <div className="ref-tab-options-sub">
                        Chọn tab để mở nhanh hoặc tùy biến thanh 1 dòng
                      </div>
                    </div>

                    <div className="ref-tab-options-list">
                      {tabs.map(([id, label]) => {
                        const isActive = tab === id || (!tab && id === tabs[0][0]);
                        const isPinned = primaryVisibleTabs.some(([pId]) => pId === id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`ref-tab-option-item ${isActive ? "active" : ""}`}
                            onClick={() => {
                              navigate(href(`/${moduleId}/${id}`));
                              setTabOptionsOpen(false);
                            }}
                          >
                            <span className="ref-tab-option-name">{label}</span>
                            <div className="ref-tab-option-badges">
                              {isPinned ? (
                                <span className="ref-tab-badge-pinned" title="Đang hiển thị trên thanh tác vụ">Đã ghim</span>
                              ) : null}
                              {isActive && <Check size={14} className="ref-tab-active-check" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="ref-tab-options-footer">
                      <button
                        type="button"
                        className="ref-tab-customize-btn"
                        onClick={() => {
                          setTabOptionsOpen(false);
                          setPanel("tabs");
                        }}
                      >
                        <SlidersHorizontal size={13} />
                        <span>Tùy biến hiển thị trên thanh tác vụ...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}
        <Suspense fallback={<WorkspaceLoader />}>
        {tab === "extended-apis" && moduleId in MODULE_EXTENDED_APIS ? (
          <div style={{ padding: 16 }}>
            <MisaModuleApiExtensionPanel
              moduleKey={moduleId as keyof typeof MODULE_EXTENDED_APIS}
              companyId={company.id}
              notify={setNotice}
            />
          </div>
        ) : moduleId === "overview" && tab === "overview" ? (
          <MisaDashboardOverview
            items={scoped}
            companyName={company.name}
            period={period}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === 'invoices' && tab === 'adjustments' ? (
          <><MisaInvoiceWorkspace tab={tab} href={href} notify={setNotice}/><InvoiceLookupWorkspace mode="errors" href={href}/></>
        ) : moduleId === 'invoices' && ['process','meinvoice','error-guide'].includes(tab) ? (
          <MisaInvoiceWorkspace tab={tab} href={href} notify={setNotice} company={company}/>
        ) : moduleId === 'invoices' && tab === 'sync' ? (
          <TaxInvoiceSyncPanel companyId={company.id} token={apiToken} href={href}/>
        ) : moduleId === "invoices" && tab === "incoming" && (!childTab || childTab === "inbox") ? (
          <IncomingInvoiceWorkspace notify={setNotice} />
        ) : moduleId === "invoices" && ["outgoing", "pending", "lookup", "issuance", "unposted"].includes(tab) ? (
          <InvoiceLookupWorkspace mode={tab as "outgoing" | "pending" | "lookup" | "issuance" | "unposted"} href={href}/>
        ) : moduleId === "purchases" && tab === "invoice-processing" && childTab === "supplier-risk" ? (
          <MisaSupplierRiskWorkspace companyId={company.id} notify={setNotice} />
        ) : moduleId === "purchases" && tab === "invoice-processing" ? (
          <IncomingInvoiceWorkspace notify={setNotice} />
        ) : moduleId === "purchases" ? (
          <MisaPurchaseWorkspace
            key={`purchases-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "reports" ? (
          <MisaReportCenterWorkspace notify={setNotice} />
        ) : moduleId === "directory" ? (
          <MisaDirectoryWorkspace key={params.get("directory") || "menu"} initialName={params.get("directory")} notify={setNotice} legacy={<DirectoryWorkspace notify={setNotice}/>}/>
        ) : moduleId === "opening" ? (
          <MisaOpeningBalanceWorkspace notify={setNotice} />
        ) : moduleId === "cash" ? (
          <MisaCashWorkspace
            key={`cash-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "bank" ? (
          <MisaBankWorkspace
            key={`bank-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "sales" ? (
          <MisaSalesWorkspace
            key={`sales-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "inventory" ? (
          <MisaInventoryWorkspace
            key={`inventory-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "tools" ? (
          <MisaToolsWorkspace
            key={`tools-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "assets" ? (
          <MisaAssetsWorkspace
            key={`assets-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "payroll" ? (
          <MisaPayrollWorkspace
            key={`payroll-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "cost" ? (
          <MisaCostWorkspace
            key={`cost-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab || "process"}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "ledger" ? (
          <MisaLedgerWorkspace
            key={`ledger-${company.id}-${period}`}
            company={company}
            period={period}
            tab={tab || "process"}
            href={href}
            notify={setNotice}
          />
        ) : moduleId === "budget" ? (
          <MisaBudgetWorkspace
            key={`budget-${company.id}-${period}`}
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
            key={`${moduleId}-${company.id}-${period}`}
            moduleId={moduleId}
            items={scoped}
            create={create}
            onDetail={(t) => setDetailId(t.id)}
            notify={setNotice}
            onInfo={infoAction}
          />
        ) : moduleId === "tax" ? (
          <MisaTaxWorkspace
            key={`tax-${company.id}-${period}`}
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
        </Suspense>
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
          visibleTabIds={rawVisibleTabIds}
          onSave={handleSaveTabs}
          onResetDefault={handleResetTabs}
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
function AppRoute() {
  const location = useLocation();
  if (location.pathname === "/admin" || location.pathname === "/company-admin") return <Suspense fallback={<WorkspaceLoader />}><CompanyAdminWorkspace /></Suspense>;
  if (location.pathname === "/super-admin" || location.pathname === "/platform-admin") return <Suspense fallback={<WorkspaceLoader />}><SuperAdminWorkspace /></Suspense>;
  if (location.pathname === "/account") return <LiveAccount />;
  if (location.pathname === "/join") return <LiveJoin />;
  if (location.pathname === "/login" || location.pathname === "/login/") return <LiveLogin />;
  if (location.pathname === "/select-company" || location.pathname === "/select-company/") return <LiveCompanySelect />;
  if (location.pathname === "/reset-password") return <LivePasswordReset />;
  if (location.pathname === "/profile") return <LiveProfile />;
  if (location.pathname === "/scope") return <LiveScope />;
  if (location.pathname === "/common") return <LiveCommonHub />;
  if (location.pathname === "/company-setup") return <LiveCompanyBootstrap />;
  if (location.pathname === "/company-profile") return <LiveCompanyProfile />;
  if (location.pathname === "/organization-structure") return <LiveOrgStructure />;
  if (location.pathname === "/join-requests-admin") return <LiveJoinAdmin />;
  if (location.pathname === "/company-users") return <LiveCompanyUsers />;
  if (location.pathname === "/roles") return <LiveRoles />;
  if (location.pathname === "/permissions") return <LivePermissions />;
  if (location.pathname === "/data-scopes") return <LiveDataScopes />;
  if (location.pathname === "/organization-assignments") return <LiveOrgAssignments />;
  if (location.pathname === "/workflows") return <LiveWorkflows />;
  if (location.pathname === "/approval-tasks") return <LiveApprovalTasks />;
  if (location.pathname === "/modules") return <LiveModules />;
  if (location.pathname === "/numbering-rules") return <LiveNumberingRules />;
  if (location.pathname === "/fiscal-periods") return <LiveFiscalPeriods />;
  if (location.pathname === "/accounting-policies") return <LiveAccountingPolicies />;
  if (location.pathname === "/audit-logs") return <LiveAuditLogs />;
  if (location.pathname === "/user-access") return <LiveUserAccess />;
  if (location.pathname.startsWith("/customers/")) return <LiveCustomerDetails id={location.pathname.split("/")[2]} />;
  if (location.pathname === "/vendors") return <LiveVendors />;
  if (location.pathname.startsWith("/vendors/")) return <LiveVendorDetails id={location.pathname.split("/")[2]} />;
  if (location.pathname === "/employees") return <LiveEmployees />;
  if (location.pathname === "/items") return <LiveItems />;
  if (location.pathname === "/item-categories") return <LiveItemCategories />;
  if (location.pathname === "/uoms") return <LiveUoms />;
  if (location.pathname === "/warehouses") return <LiveWarehouses />;
  if (location.pathname === "/company-bank-accounts") return <LiveCompanyBankAccounts />;
  if (location.pathname === "/accounts") return <LiveAccounts />;
  if (location.pathname === "/expense-items") return <LiveCatalogExtensions kind="expense" />;
  if (location.pathname === "/statistical-codes") return <LiveCatalogExtensions kind="stat" />;
  if (location.pathname === "/tax-types") return <LiveCatalogExtensions kind="tax" />;
  if (location.pathname === "/payment-terms") return <LiveCatalogExtensions kind="term" />;
  if (location.pathname === "/payment-methods") return <LiveCatalogExtensions kind="method" />;
  const legacyModules: Record<string, string> = {
    "/system": "/overview", "/settings": "/overview",
    "/master-data": "/directory", "/catalogs": "/directory",
    "/live-purchases": "/purchases", "/accounts-payable": "/purchases", "/payables": "/purchases",
    "/live-accounts-payable": "/purchases", "/live-sales": "/sales",
    "/accounts-receivable": "/sales", "/receivables": "/sales", "/live-accounts-receivable": "/sales",
    "/live-cash": "/cash", "/live-bank": "/bank", "/live-inventory": "/inventory",
    "/fixed-assets": "/assets", "/live-fixed-assets": "/assets", "/live-tax": "/tax",
    "/gl": "/ledger", "/general-ledger": "/ledger", "/live-gl": "/ledger",
  };
  if (legacyModules[location.pathname]) {
    return <Navigate to={`${legacyModules[location.pathname]}${location.search}`} replace />;
  }
  return <ReferenceWorkspace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ApiSessionProvider>
        <ErrorBoundary>
          <AppRoute />
        </ErrorBoundary>
      </ApiSessionProvider>
    </BrowserRouter>
  );
}
