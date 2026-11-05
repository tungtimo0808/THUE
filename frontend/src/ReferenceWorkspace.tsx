import { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback, lazy, Suspense, useTransition, memo, type ReactNode } from "react";
import { GlobalFeedbackPopupHost, showGlobalPopup, classifyNoticeType, humanizeErrorMessage } from "./global-popup";
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
  KeyRound,
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
import { MisaSystemUtilitiesModal } from "./MisaSystemUtilitiesModal";
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
  getRoleWorkspaceSpec,
} from "./GlobalShellPanels";
import { SidebarNavigation } from "./SidebarNavigation";
import { NestedWorkspace } from "./NestedWorkspace";
import { AuditedProcessWorkspace } from "./AuditedProcessWorkspace";
import MisaDirectoryWorkspace from './MisaDirectoryWorkspace';
import TaxInvoiceSyncPanel from './TaxInvoiceSyncPanel';
import { preloadWorkspace, setupIdlePreloading } from "./workspace-preloader";
import type { ComponentType } from "react";

function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = "sv_chunk_reload_ts";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      throw err;
    })
  );
}

const CompanyAdminWorkspace = lazyWithRetry(() => import("./CompanyAdminWorkspace"));
const SuperAdminWorkspace = lazyWithRetry(() => import("./SuperAdminWorkspace"));

// Code-split heavy workspace modules for instant initial load (sub-second cold start)
const MisaCashWorkspace = lazyWithRetry(() => import("./MisaCashWorkspace"));
const MisaBankWorkspace = lazyWithRetry(() => import("./MisaBankWorkspace"));
const MisaPurchaseWorkspace = lazyWithRetry(() => import("./MisaPurchaseWorkspace"));
const MisaSupplierRiskWorkspace = lazyWithRetry(() => import("./MisaSupplierRiskWorkspace"));
const MisaSalesWorkspace = lazyWithRetry(() => import("./MisaSalesWorkspace"));
const MisaInventoryWorkspace = lazyWithRetry(() => import("./MisaInventoryWorkspace"));
const MisaToolsWorkspace = lazyWithRetry(() => import("./MisaToolsWorkspace"));
const MisaAssetsWorkspace = lazyWithRetry(() => import("./MisaAssetsWorkspace"));
const MisaPayrollWorkspace = lazyWithRetry(() => import("./MisaPayrollWorkspace"));
const MisaTaxWorkspace = lazyWithRetry(() => import("./MisaTaxWorkspace"));
const MisaCostWorkspace = lazyWithRetry(() => import("./MisaCostWorkspace"));
const MisaLedgerWorkspace = lazyWithRetry(() => import("./MisaLedgerWorkspace"));
const MisaBudgetWorkspace = lazyWithRetry(() => import("./MisaBudgetWorkspace"));
const MisaReportCenterWorkspace = lazyWithRetry(() => import("./MisaReportCenterWorkspace"));
const MisaFinancialAnalysisWorkspace = lazyWithRetry(() => import("./MisaFinancialAnalysisWorkspace"));
const MisaOpeningBalanceWorkspace = lazyWithRetry(() => import("./MisaOpeningBalanceWorkspace"));
const MisaDashboardOverview = lazyWithRetry(() => import("./MisaDashboardOverview"));
const MisaInvoiceWorkspace = lazyWithRetry(() => import("./MisaInvoiceWorkspace"));
const InvoiceLookupWorkspace = lazyWithRetry(() => import("./InvoiceLookupWorkspace"));
const CashPaymentLimitWarningWorkspace = lazyWithRetry(() => import("./CashPaymentLimitWarningWorkspace"));

const WorkspaceLoader = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, gap: 12, width: "100%" }}>
    <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải dữ liệu phân hệ...</span>
    <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const KeepAliveModuleSlot = memo(
  function KeepAliveModuleSlot({
    isCurrent,
    renderContent,
  }: {
    mId: string;
    isCurrent: boolean;
    activeTab: string;
    companyId: string;
    period: string;
    childTab: string | null;
    directoryParam: string | null;
    payrollOption: string;
    renderContent: () => ReactNode;
  }) {
    return (
      <div
        style={
          isCurrent
            ? { display: "contents" }
            : { display: "none", contentVisibility: "hidden", contain: "layout style paint" }
        }
        aria-hidden={!isCurrent}
      >
        <Suspense fallback={<WorkspaceLoader />}>{renderContent()}</Suspense>
      </div>
    );
  },
  (prev, next) => {
    if (!prev.isCurrent && !next.isCurrent) {
      return prev.companyId === next.companyId && prev.period === next.period;
    }
    return (
      prev.isCurrent === next.isCurrent &&
      prev.activeTab === next.activeTab &&
      prev.companyId === next.companyId &&
      prev.period === next.period &&
      prev.childTab === next.childTab &&
      prev.directoryParam === next.directoryParam &&
      prev.payrollOption === next.payrollOption
    );
  },
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
import LiveSession from "./LiveSession";
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
import LiveAccounts from "./AccountCatalogWorkspace";
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
  items: { label: string; kind?: Kind; path: string }[];
}[] = [
    {
      title: "TIỀN MẶT",
      items: [
        { label: "Thu tiền mặt", kind: "receipt", path: "/cash/transactions" },
        { label: "Chi tiền mặt", kind: "payment", path: "/cash/transactions" },
      ],
    },
    {
      title: "TIỀN GỬI",
      items: [
        { label: "Thu tiền gửi", kind: "bank", path: "/bank/transactions" },
        { label: "Chi tiền gửi", kind: "payment", path: "/bank/transactions" },
      ],
    },
    {
      title: "KHO",
      items: [
        { label: "Nhập kho", path: "/inventory/receipts" },
        { label: "Xuất kho", path: "/inventory/issues" },
        { label: "Chuyển kho", path: "/inventory/transfers" },
      ],
    },
    {
      title: "MUA HÀNG",
      items: [
        { label: "Mua hàng", kind: "purchase", path: "/purchases/transactions" },
        { label: "Mua dịch vụ", kind: "purchase", path: "/purchases/service-purchases" },
      ],
    },
    {
      title: "BÁN HÀNG",
      items: [
        { label: "Bán hàng", kind: "sale", path: "/sales/transactions" },
        { label: "Bán dịch vụ", kind: "sale", path: "/sales/invoices" },
      ],
    },
    {
      title: "TỔNG HỢP",
      items: [
        { label: "Chứng từ nghiệp vụ khác", path: "/ledger/transactions" },
        { label: "Quyết toán tạm ứng", path: "/ledger/advance-settlement-request" },
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

  const [isNavPending, startNavTransition] = useTransition();
  const [optimisticTab, setOptimisticTab] = useState<string | null>(null);

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

  const normalizedPathname = location.pathname.replace(/^\/reference(?=\/|$)/, "") || "/";
  const pathParts = normalizedPathname.split("/");
  const moduleId = (params.get("module") || pathParts[1] || "overview"),
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

  const isProcessTab = (optimisticTab || tab) === "process";

  useEffect(() => {
    if (isProcessTab) {
      document.body.classList.add("ref-process-scroll-lock");
      document.documentElement.classList.add("ref-process-scroll-lock");
    } else {
      document.body.classList.remove("ref-process-scroll-lock");
      document.documentElement.classList.remove("ref-process-scroll-lock");
    }
    return () => {
      document.body.classList.remove("ref-process-scroll-lock");
      document.documentElement.classList.remove("ref-process-scroll-lock");
    };
  }, [isProcessTab]);

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
        requiredWidth = navWidth + barGap + moreBaseWidth;
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
  const rawUrlPeriod = params.get("period") || "";
  const period = /^(20\d{2}(-\d{2})?|20\d{2}-Q[1-4])$/.test(rawUrlPeriod)
    ? rawUrlPeriod
    : "2026-12";
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

  // High-performance Keep-Alive LRU cache for instant tab/workspace switching
  const [visitedModules, setVisitedModules] = useState<string[]>(() => [moduleId]);
  const MAX_KEPT_MODULES = 4;

  useEffect(() => {
    setupIdlePreloading();
  }, []);

  useEffect(() => {
    if (optimisticTab && tab === optimisticTab) {
      setOptimisticTab(null);
    }
  }, [tab, optimisticTab]);

  useEffect(() => {
    setVisitedModules((prev) => {
      const filtered = prev.filter((id) => id !== moduleId);
      const updated = [...filtered, moduleId];
      if (updated.length > MAX_KEPT_MODULES) {
        return updated.slice(updated.length - MAX_KEPT_MODULES);
      }
      return updated;
    });
  }, [moduleId]);

  useEffect(() => {
    setVisitedModules([moduleId]);
  }, [company.id]);

  const displayModules = useMemo(() => {
    if (!visitedModules.includes(moduleId)) {
      return [...visitedModules, moduleId];
    }
    return visitedModules;
  }, [visitedModules, moduleId]);

  const triggerSwitchFeedback = (type: string, message: string) => {
    setRecentlyChangedCluster(type);
    setIsSwitchingContext(true);
    setNotice(message);
    setTimeout(() => setRecentlyChangedCluster(null), 1200);
    setTimeout(() => setIsSwitchingContext(false), 280);
  };

  const activeCompanyRegime = useMemo(() => {
    const raw = String((company as any)?.accounting_regime || "TT99").toUpperCase();
    if (raw.includes("58")) return "TT58";
    if (raw.includes("133")) return "TT133";
    if (raw.includes("200")) return "TT200";
    return "TT99";
  }, [company]);
  const activeRegimeShortBadge =
    activeCompanyRegime === "TT58"
      ? "TT58/2026 (Siêu nhỏ)"
      : activeCompanyRegime === "TT133"
      ? "TT133/2016 (SME)"
      : activeCompanyRegime === "TT200"
      ? "TT200/2014"
      : "TT99/2025";
  const datasetLabel = `${dataset === "accounting-2026" ? "Dữ liệu kế toán 2026" : "Dữ liệu quản trị 2026"} · ${activeRegimeShortBadge}`;
  const branchLabel = branch === "head-office" ? "Trụ sở chính" : "Chi nhánh TP. HCM";
  const periodLabel = period.startsWith("2026-") ? `K${Number(period.slice(5))}.2026` : "Năm 2026";
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
  const [notice, setRawNotice] = useState(""),
    [info, setInfo] = useState(""),
    [settingsSearch, setSettingsSearch] = useState(""),
    [query, setQuery] = useState(""),
    [workMode, setWorkMode] = useState("ROLE_CHIEF_ACCOUNTANT"),
    [assignedRoleCodes, setAssignedRoleCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!apiToken || !company?.id) return;
    let active = true;
    request<any>(`/api/v1/iam/memberships/?company_id=${encodeURIComponent(company.id)}`, apiToken)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : res?.results || [];
        const myEmail = String(apiSession?.user?.email || "").toLowerCase();
        const me = list.find((m: any) => String(m.email || "").toLowerCase() === myEmail);
        if (me && Array.isArray(me.role_assignments) && me.role_assignments.length > 0) {
          const codes = me.role_assignments.map((ra: any) => String(ra.role_code || "")).filter(Boolean);
          setAssignedRoleCodes(codes);
          if (codes.length > 0) {
            const spec = getRoleWorkspaceSpec(codes[0]);
            setWorkMode(spec.code);
          }
        } else {
          setAssignedRoleCodes(["ROLE_CHIEF_ACCOUNTANT"]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiToken, company?.id, apiSession?.user?.email]);

  const activeRoleSpec = useMemo(() => getRoleWorkspaceSpec(workMode), [workMode]);
  const setNotice = useCallback((msg: string) => {
    const cleaned = msg ? humanizeErrorMessage(msg) : "";
    setRawNotice(cleaned);
    if (cleaned) {
      const pType = classifyNoticeType(cleaned);
      showGlobalPopup({
        type: pType,
        title: pType === "error" ? "Thông báo lỗi" : pType === "warning" ? "Cảnh báo kiểm tra" : "Lưu dữ liệu thành công",
        message: cleaned,
      });
    }
  }, []);
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
      code:
        activeCompanyRegime === "TT58"
          ? "Thông tư 58/2026"
          : activeCompanyRegime === "TT133"
          ? "Thông tư 133/2016"
          : activeCompanyRegime === "TT200"
          ? "Thông tư 200/2014"
          : "Thông tư 99/2025",
      kindLabel: "Chế độ kế toán",
      kind: "info" as const,
      description:
        activeCompanyRegime === "TT58"
          ? "Doanh nghiệp đang áp dụng Chế độ kế toán Doanh nghiệp siêu nhỏ theo Thông tư 58/2026/TT-BTC (20 TK rút gọn cốt lõi, 3 Role tinh gọn mặc định, Bộ BCTC B01-DNSN, B02-DNSN)."
          : activeCompanyRegime === "TT133"
          ? "Doanh nghiệp đang áp dụng Chế độ kế toán Doanh nghiệp nhỏ và vừa theo Thông tư 133/2016/TT-BTC (101 TK, 8 Role cốt lõi, Bộ BCTC B01a/B01b-DNN, B02-DNN, B03-DNN, B09-DNN)."
          : activeCompanyRegime === "TT200"
          ? "Doanh nghiệp đang áp dụng Chế độ kế toán Doanh nghiệp theo Thông tư 200/2014/TT-BTC (135 TK, 14 Role chuyên môn, Bộ BCTC B01/B02/B03/B09-DN)."
          : "Hệ thống đã cập nhật đầy đủ Hệ thống 138 TK, 21 Role chuẩn, sổ quỹ S07-DN, S07a-DN và bộ BCTC B01/B02/B03/B09-DN theo Thông tư 99/2025/TT-BTC áp dụng từ 01/01/2026.",
      partner: "Bộ Tài chính",
      amount: 0,
      date: "20/09/2026 08:30",
      actionUrl: "/reports",
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
  const quickAccessRoutes: Record<string, string> = {
    "Quản lý danh mục": href("/directory"),
    "Nhập số dư ban đầu": href("/opening"),
    "Cập nhật số dư dữ liệu năm trước": href("/opening"),
    "Nhập dữ liệu": href("/opening"),
    "Kiểm tra & cảnh báo nhà cung cấp rủi ro thuế": href("/purchases/invoice-processing/supplier-risk"),
    "Đối chiếu hóa đơn với dữ liệu Tổng cục Thuế": href("/invoices/sync"),
    "Kiểm soát hồ sơ và hạch toán": href("/invoices/unposted"),
    "Nhật ký truy cập": "/audit-logs",
    "Thông tin công ty": "/admin?tab=overview",
    "Quản lý người dùng và phân quyền": "/admin?tab=personnel",
    "Quản lý dữ liệu": "/fiscal-periods",
    "Tùy chọn": "/admin?tab=config",
    "Ngày hạch toán": "/fiscal-periods",
    "Thiết lập kết nối Ngân hàng điện tử (mBank)": href("/bank/ebanking"),
    "Thiết lập ký số từ xa (SmartCA / eSign)": href("/invoices/sync"),
    "Nhập kho": href("/inventory/receipts"),
    "Xuất kho": href("/inventory/issues"),
    "Chuyển kho": href("/inventory/transfers"),
    "Chứng từ nghiệp vụ khác": href("/ledger/transactions"),
    "Quyết toán tạm ứng": href("/ledger/advance-settlement-request"),
    "Kiểm tra đối chiếu": href("/ledger/process"),
  };

  const infoAction = (name: string) => {
    setPanel(null);
    if (name === "Thiết lập màu sắc và hiển thị") {
      setPanel("mode");
      return;
    }
    if (name === "Gợi ý, nhắc nhở thông minh") {
      setPanel("notifications");
      return;
    }
    if (name === "Trợ lý AI Sổ Việt AI: Cấu hình gợi ý hạch toán") {
      setNotice("Trợ lý Sổ Việt AI đã sẵn sàng.");
      return;
    }
    const targetRoute = quickAccessRoutes[name];
    if (targetRoute) {
      navigate(targetRoute);
      return;
    }
    setInfo(name);
  };

  const renderWorkspaceContentForModule = (targetModuleId: string, targetTab?: string) => {
    const activeTab = targetTab || (referenceTabs[targetModuleId]?.[0]?.[0] || "transactions");

    if (
      activeRoleSpec.allowedModules.length > 0 &&
      !activeRoleSpec.allowedModules.includes(targetModuleId)
    ) {
      const targetModInfo = referenceNav.find((m) => m.id === targetModuleId);
      const fallbackModId = activeRoleSpec.allowedModules.find((id) => id !== "overview") || "overview";
      const fallbackModInfo = referenceNav.find((m) => m.id === fallbackModId);
      return (
        <div style={{ padding: "32px 24px", maxWidth: 680, margin: "24px auto" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #fde68a",
              borderRadius: 12,
              padding: "24px 28px",
              boxShadow: "0 4px 16px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#b45309", fontWeight: 700, fontSize: 16 }}>
              <ShieldCheck size={22} />
              <span>Giới hạn phân hệ theo Vai trò: {activeRoleSpec.name}</span>
            </div>
            <p style={{ margin: "10px 0 14px", fontSize: 13.5, color: "#334155", lineHeight: 1.5 }}>
              Phân hệ <strong>{targetModInfo?.label || targetModuleId}</strong> không nằm trong phạm vi nghiệp vụ của vai trò{" "}
              <strong>{activeRoleSpec.name}</strong> ({activeRoleSpec.groupVi}).
            </p>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: "#475569", marginBottom: 16 }}>
              <div><strong>Trách nhiệm & Quyền hạn của {activeRoleSpec.name}:</strong></div>
              <div style={{ marginTop: 4 }}>{activeRoleSpec.capabilitiesSummary}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => navigate(href(`/${fallbackModId}`))}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#00a862",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Mở phân hệ {fallbackModInfo?.label || "Tổng quan"} →
              </button>
              <button
                type="button"
                onClick={() => setPanel("mode")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#1e293b",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Chuyển đổi Vai trò làm việc (21 Role)
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "extended-apis" && targetModuleId in MODULE_EXTENDED_APIS) {
      return (
        <div style={{ padding: 16 }}>
          <MisaModuleApiExtensionPanel
            moduleKey={targetModuleId as keyof typeof MODULE_EXTENDED_APIS}
            companyId={company.id}
            notify={setNotice}
          />
        </div>
      );
    }

    if (targetModuleId === "overview" && activeTab === "overview") {
      return (
        <MisaDashboardOverview
          items={scoped}
          companyId={matchedApiCompany?.id || apiCompanyId}
          companyName={company.name}
          period={period}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "invoices") {
      if (activeTab === "adjustments") {
        return <InvoiceLookupWorkspace mode="errors" href={href} />;
      }
      if (["process", "error-guide"].includes(activeTab)) {
        return <MisaInvoiceWorkspace tab={activeTab} href={href} notify={setNotice} company={company} />;
      }
      if (activeTab === "sync") {
        return <TaxInvoiceSyncPanel companyId={company.id} token={apiToken} href={href} />;
      }
      if (activeTab === "incoming") {
        return <IncomingInvoiceWorkspace notify={setNotice} childTab={childTab} />;
      }
      if (["outgoing", "pending", "lookup", "issuance", "unposted"].includes(activeTab)) {
        return <InvoiceLookupWorkspace mode={activeTab as "outgoing" | "pending" | "lookup" | "issuance" | "unposted"} href={href} />;
      }
      if (activeTab === "risk-warning") {
        if (childTab === "xml-errors") {
          return <InvoiceLookupWorkspace mode="errors" href={href} />;
        }
        if (childTab === "cash-limit") {
          return <CashPaymentLimitWarningWorkspace companyId={company.id} notify={setNotice} href={href} />;
        }
        return <MisaSupplierRiskWorkspace companyId={company.id} notify={setNotice} />;
      }
      if (activeTab === "reports") {
        return <MisaReportCenterWorkspace initialCategory="tax" notify={setNotice} />;
      }
    }

    if (targetModuleId === "purchases") {
      if (activeTab === "invoice-processing" && childTab === "supplier-risk") {
        return <MisaSupplierRiskWorkspace companyId={company.id} notify={setNotice} />;
      }
      if (activeTab === "invoice-processing") {
        return <IncomingInvoiceWorkspace notify={setNotice} />;
      }
      return (
        <MisaPurchaseWorkspace
          key={`purchases-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "reports") {
      return <MisaReportCenterWorkspace notify={setNotice} />;
    }

    if (targetModuleId === "directory") {
      return (
        <MisaDirectoryWorkspace
          key={params.get("directory") || "menu"}
          initialName={params.get("directory")}
          notify={setNotice}
          legacy={<DirectoryWorkspace notify={setNotice} />}
        />
      );
    }

    if (targetModuleId === "opening") {
      return <MisaOpeningBalanceWorkspace notify={setNotice} />;
    }

    if (targetModuleId === "cash") {
      return (
        <MisaCashWorkspace
          key={`cash-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "bank") {
      return (
        <MisaBankWorkspace
          key={`bank-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "sales") {
      return (
        <MisaSalesWorkspace
          key={`sales-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "inventory") {
      return (
        <MisaInventoryWorkspace
          key={`inventory-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "tools") {
      return (
        <MisaToolsWorkspace
          key={`tools-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "assets") {
      return (
        <MisaAssetsWorkspace
          key={`assets-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "payroll") {
      return (
        <MisaPayrollWorkspace
          key={`payroll-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "cost") {
      return (
        <MisaCostWorkspace
          key={`cost-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab || "process"}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "ledger") {
      return (
        <MisaLedgerWorkspace
          key={`ledger-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab || "process"}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "budget") {
      return (
        <MisaBudgetWorkspace
          key={`budget-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab || "charts"}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "tax") {
      return (
        <MisaTaxWorkspace
          key={`tax-${company.id}-${period}`}
          company={company}
          period={period}
          tab={activeTab || "declarations"}
          href={href}
          notify={setNotice}
        />
      );
    }

    if (targetModuleId === "analysis") {
      return <MisaFinancialAnalysisWorkspace notify={setNotice} />;
    }

    if (activeTab === "process") {
      return (
        <AuditedProcessWorkspace
          moduleId={targetModuleId}
          moduleLabel={referenceNav.find((m) => m.id === targetModuleId)?.label || "Kế toán"}
          notify={setNotice}
        />
      );
    }

    if (activeTab === "transactions" && ["cash", "bank", "sales"].includes(targetModuleId)) {
      return (
        <ReferenceTransactions
          key={`${targetModuleId}-${company.id}-${period}`}
          moduleId={targetModuleId}
          items={scoped}
          create={create}
          onDetail={(t) => setDetailId(t.id)}
          notify={setNotice}
          onInfo={infoAction}
        />
      );
    }

    const modTarget = referenceNav.find((m) => m.id === targetModuleId);
    const modTabs = referenceTabs[targetModuleId] || [["transactions", "Danh sách"]];
    const nodeTarget = referenceTabHierarchy[targetModuleId]?.find((item) => item.id === activeTab);

    return (
      <NestedWorkspace
        moduleId={targetModuleId}
        moduleLabel={modTarget?.label || "Phân hệ"}
        tab={
          nodeTarget || {
            id: activeTab,
            label: modTabs.find((item) => item[0] === activeTab)?.[1] || modTarget?.label || "Danh sách nghiệp vụ",
          }
        }
        childId={childTab}
        href={href}
        notify={setNotice}
      />
    );
  };

  if (apiRestoring || !apiToken) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <WorkspaceLoader />
      </div>
    );
  }

  return (
    <div className={`reference-app ${collapsed ? "ref-collapsed" : ""} ${isProcessTab ? "ref-process-locked" : ""}`}>
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
                    const rawReg = String((c as any).accounting_regime || "TT99").toUpperCase();
                    const cReg = rawReg.includes("58")
                      ? "TT58"
                      : rawReg.includes("133")
                      ? "TT133"
                      : rawReg.includes("200")
                      ? "TT200"
                      : "TT99";
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`ref-cluster-popover-item ${isSelected ? "active" : ""}`}
                        onClick={() => {
                          if (apiCompanies.some((ac) => ac.id === c.id)) {
                            apiSelectCompany(c.id);
                            if (apiToken) {
                              void request("/api/v1/common/companies/switch/", apiToken, {
                                method: "POST",
                                body: JSON.stringify({ company: c.id, company_id: c.id, all_branches: true }),
                              }).catch(() => {});
                            }
                          }
                          context("company", c.id);
                          setActiveClusterMenu(null);
                          triggerSwitchFeedback("company", `✓ Đã chuyển sang làm việc tại: ${c.name} (${cReg})`);
                        }}
                      >
                        <span className="ref-cluster-item-name" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span>{c.name}</span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: cReg === "TT133" ? "#fef3c7" : cReg === "TT200" ? "#e0e7ff" : "#dcfce7",
                              color: cReg === "TT133" ? "#b45309" : cReg === "TT200" ? "#1d4ed8" : "#047857",
                            }}
                          >
                            {cReg}
                          </span>
                        </span>
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
                    { id: "2026-12", label: "K12.2026 (Tháng 12/2026)" },
                    { id: "2026-11", label: "K11.2026 (Tháng 11/2026)" },
                    { id: "2026-10", label: "K10.2026 (Tháng 10/2026)" },
                    { id: "2026-09", label: "K9.2026 (Tháng 09/2026)" },
                    { id: "2026-08", label: "K8.2026 (Tháng 08/2026)" },
                    { id: "2026-07", label: "K7.2026 (Tháng 07/2026)" },
                    { id: "2026-06", label: "K6.2026 (Tháng 06/2026)" },
                    { id: "2026-05", label: "K5.2026 (Tháng 05/2026)" },
                    { id: "2026-04", label: "K4.2026 (Tháng 04/2026)" },
                    { id: "2026-03", label: "K3.2026 (Tháng 03/2026)" },
                    { id: "2026-02", label: "K2.2026 (Tháng 02/2026)" },
                    { id: "2026-01", label: "K1.2026 (Tháng 01/2026)" },
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
            aria-label={`Chế độ làm việc: ${activeRoleSpec.shortLabel}`}
            title={`${activeRoleSpec.name} (${activeRoleSpec.code}): ${activeRoleSpec.capabilitiesSummary}`}
            onClick={() => setPanel("mode")}
          >
            {activeRoleSpec.shortLabel} <ChevronDown size={13} />
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
                      {(Boolean((apiCompanies.find(item => item.id === apiCompanyId) as any)?.is_company_admin) || Boolean((apiSession?.user as any)?.is_company_admin) || userEmail === "tungtimo0808@gmail.com") ? (
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

                  <button
                    type="button"
                    className="ref-user-dropdown-item"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate("/session");
                    }}
                  >
                    <KeyRound size={15} />
                    <span>Phiên làm việc hiện tại</span>
                  </button>

                  {(Boolean(apiSession?.user?.is_superuser) || Boolean((apiCompanies.find(item => item.id === apiCompanyId) as any)?.is_company_admin) || Boolean((apiSession?.user as any)?.is_company_admin) || userEmail === "tungtimo0808@gmail.com") && (
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
          allowedModules={activeRoleSpec.allowedModules}
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
      <main id="reference-main" className={`ref-main ${isSwitchingContext ? "ref-switching-context" : ""} ${isProcessTab ? "ref-process-fixed" : ""}`} tabIndex={-1}>
        <span className="sr-only">
          Phân hệ {module?.label || "Không tìm thấy"}
        </span>
        {!["reports", "analysis", "opening"].includes(moduleId) && (
        <div className="ref-module-bar" ref={moduleBarRef}>
          {isNavPending && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2.5,
                background: "linear-gradient(90deg, #00b06b 0%, #0284c7 50%, #00b06b 100%)",
                backgroundSize: "200% 100%",
                animation: "sv-progress-flow 0.8s linear infinite",
                zIndex: 9999,
              }}
            />
          )}
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
              <span>Khác</span>
              <ChevronDown size={13} />
            </span>
          </div>

          <nav aria-label="Chức năng phân hệ">
            {primaryVisibleTabs.map(([id, label]) => {
              const effectiveTab = optimisticTab || tab;
              const isActive = effectiveTab === id || (!effectiveTab && id === tabs[0][0]);
              return (
                <Link
                  className={isActive ? "active" : ""}
                  to={href(`/${moduleId}/${id}`)}
                  key={id}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    setOptimisticTab(id);
                    startNavTransition(() => {
                      navigate(href(`/${moduleId}/${id}`));
                    });
                  }}
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
                <span>Khác</span>
                <ChevronDown size={13} className={`ref-tab-more-caret ${tabMoreOpen ? "rotated" : ""}`} />
              </button>
              {tabMoreOpen && (
                <div className={`ref-tab-more-dropdown ${moreDropdownAlignRight ? "align-right" : ""}`}>
                  <div style={{ padding: "4px 8px 6px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                    Chức năng khác ({secondaryTabs.length})
                  </div>
                  {secondaryTabs.map(([id, label]) => {
                    const effectiveTab = optimisticTab || tab;
                    const isActive = effectiveTab === id;
                    return (
                      <Link
                        key={id}
                        to={href(`/${moduleId}/${id}`)}
                        className={`ref-tab-more-item ${isActive ? "active" : ""}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          setTabMoreOpen(false);
                          setOptimisticTab(id);
                          startNavTransition(() => {
                            navigate(href(`/${moduleId}/${id}`));
                          });
                        }}
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
        {displayModules.map((mId) => {
          const isCurrent = mId === moduleId;
          const activeTabForSlot = isCurrent
            ? optimisticTab || tab
            : referenceTabs[mId]?.[0]?.[0] || "process";
          return (
            <KeepAliveModuleSlot
              key={`keepalive-${mId}-${company.id}`}
              mId={mId}
              isCurrent={isCurrent}
              activeTab={activeTabForSlot}
              companyId={company.id}
              period={period}
              childTab={isCurrent ? childTab : null}
              directoryParam={isCurrent ? params.get("directory") : null}
              payrollOption={payrollOption}
              renderContent={() => renderWorkspaceContentForModule(mId, activeTabForSlot)}
            />
          );
        })}
      </main>
      {panel === "settings" && (
        <Modal
          title="Các tiện ích và thiết lập (Truy cập nhanh)"
          onClose={() => {
            setPanel(null);
            setSettingsSearch("");
          }}
          wide
        >
          <div style={{ padding: "12px 20px 0 20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                padding: "7px 12px",
              }}
            >
              <Search size={15} style={{ color: "#64748b" }} />
              <input
                type="search"
                placeholder="Tìm nhanh tiện ích, danh mục, số dư đầu kỳ, thiết lập..."
                value={settingsSearch}
                onChange={(e) => setSettingsSearch(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  fontSize: 13,
                  color: "#0f172a",
                }}
              />
            </div>
          </div>
          <div className="ref-mega-menu">
            {settingsGroups.map((g, i) => {
              const filteredItems = g.items.filter(
                (label) =>
                  !settingsSearch.trim() ||
                  label.toLowerCase().includes(settingsSearch.trim().toLowerCase())
              );
              return (
                <section
                  className={`ref-settings-group group-${i}`}
                  key={g.title}
                >
                  <h3>{g.title}</h3>
                  {filteredItems.map((label) => {
                    const isQuickRoute =
                      Boolean(quickAccessRoutes[label]) ||
                      label === "Thiết lập màu sắc và hiển thị" ||
                      label === "Gợi ý, nhắc nhở thông minh" ||
                      label === "Trợ lý AI Sổ Việt AI: Cấu hình gợi ý hạch toán";
                    return (
                      <button
                        key={label}
                        onClick={() => infoAction(label)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          width: "100%",
                        }}
                      >
                        <span>{label}</span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isQuickRoute ? "#e0f2fe" : "#dcfce7",
                            color: isQuickRoute ? "#0369a1" : "#15803d",
                            flexShrink: 0,
                          }}
                        >
                          {isQuickRoute ? "Mở →" : "API"}
                        </span>
                      </button>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </Modal>
      )}
      {panel === "mode" && (
        <WorkModeModal
          current={workMode}
          activeRegime={activeCompanyRegime}
          assignedRoleCodes={assignedRoleCodes}
          onChange={(nextRoleCode) => {
            const spec = getRoleWorkspaceSpec(nextRoleCode);
            setWorkMode(spec.code);
            setNotice(`✓ Đã chuyển sang Vai trò làm việc: ${spec.name} (Mở ${spec.allowedModules.length} phân hệ)`);
            if (!spec.allowedModules.includes(moduleId)) {
              navigate(href(`/${spec.allowedModules[0] || "overview"}`));
            }
          }}
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
              activeRoleSpec.allowedQuickCreateTitles.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "#475569", fontSize: 13.5 }}>
                  Vai trò hiện tại (<strong>{activeRoleSpec.name}</strong>) thuộc nhóm{" "}
                  <strong>{activeRoleSpec.groupVi}</strong> (chỉ xem báo cáo, kiểm soát hoặc phê duyệt), không trực tiếp lập chứng từ hạch toán mới.
                </div>
              ) : (
                <div className="quick-create-groups">
                  {quickCreateGroups
                    .filter((group) => activeRoleSpec.allowedQuickCreateTitles.includes(group.title))
                    .map((group) => (
                      <section key={group.title}>
                        <h3>{group.title}</h3>
                        {group.items.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => {
                              setPanel(null);
                              navigate(href(item.path));
                            }}
                          >
                            <Plus size={15} />
                            {item.label}
                          </button>
                        ))}
                      </section>
                    ))}
                </div>
              )
            ) : panel === "help" ? (
              <>
                <p>
                  Chọn phân hệ bên trái, sau đó chọn Quy trình hoặc danh sách
                  giao dịch trên thanh tab để thao tác trực tiếp với dữ liệu kế toán.
                </p>
                <ol className="help-list">
                  <li>Nhấn vào các nút trên sơ đồ Quy trình để chuyển nhanh đến màn hình nghiệp vụ tương ứng.</li>
                  <li>
                    Mở <strong>Các tiện ích và thiết lập</strong> (biểu tượng bánh răng) để truy cập nhanh Danh mục, Số dư ban đầu, Ghi sổ theo lô, Bảo trì dữ liệu và Thiết lập hệ thống.
                  </li>
                  <li>Sử dụng phím tắt <code>Ctrl + K</code> để tìm kiếm nhanh chứng từ trên toàn hệ thống.</li>
                </ol>
              </>
            ) : panel === "module" ? (
              <div className="module-quick-menu">
                <section>
                  <h3>NGHIỆP VỤ ({module?.label?.toUpperCase()})</h3>
                  {tabs.slice(0, 8).map(([tabId, label]) => (
                    <button
                      key={tabId}
                      onClick={() => {
                        setPanel(null);
                        navigate(href(`/${moduleId}/${tabId}`));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </section>
                <section>
                  <h3>TIỆN ÍCH TRUY CẬP NHANH</h3>
                  <button onClick={() => infoAction("Kiểm tra đối chiếu chứng từ, sổ sách")}>
                    Kiểm tra đối chiếu sổ sách
                  </button>
                  <button onClick={() => infoAction("Nhập số dư ban đầu")}>
                    Nhập số dư ban đầu
                  </button>
                  <button onClick={() => infoAction("Quản lý danh mục")}>
                    Quản lý danh mục
                  </button>
                  <button onClick={() => infoAction("Ghi sổ/Bỏ ghi theo lô")}>
                    Ghi sổ / Bỏ ghi theo lô
                  </button>
                </section>
                <section>
                  <h3>BÁO CÁO</h3>
                  <button
                    onClick={() => {
                      setPanel(null);
                      navigate(href("/reports"));
                    }}
                  >
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
        <MisaSystemUtilitiesModal
          utilityName={info}
          companyId={company.id}
          companyName={company.name}
          token={apiToken}
          onClose={() => setInfo("")}
          onNavigate={(url) => navigate(url)}
          notify={setNotice}
        />
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
  if (location.pathname === "/session" || location.pathname === "/session/") return <LiveSession />;
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
  useEffect(() => {
    const origAlert = window.alert;
    window.alert = (msg?: any) => {
      const text = String(msg ?? "").trim();
      if (!text) return;
      const pType = classifyNoticeType(text);
      showGlobalPopup({
        type: pType,
        title: pType === "error" ? "Thông báo lỗi" : pType === "warning" ? "Cảnh báo kiểm tra" : "Thông báo hệ thống",
        message: humanizeErrorMessage(text),
      });
    };
    return () => {
      window.alert = origAlert;
    };
  }, []);

  return (
    <BrowserRouter>
      <ApiSessionProvider>
        <ErrorBoundary>
          <AppRoute />
          <GlobalFeedbackPopupHost />
        </ErrorBoundary>
      </ApiSessionProvider>
    </BrowserRouter>
  );
}
