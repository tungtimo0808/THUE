import React, { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Filter,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { money, kinds, type Transaction } from "./data";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import MisaDropdownSelect from "./MisaDropdownSelect";
import {
  createApiWriter,
  fetchDashboardConfigUcRpt01,
  fetchDashboardOverviewUcRpt01,
  refreshDashboardUcRpt01,
  fetchDashboardMetricDetailsUcRpt01,
} from "./misa-api-writes";

export type DashboardHref = (path: string, extra?: Record<string, string>) => string;

interface MisaDashboardOverviewProps {
  items: Transaction[];
  companyId?: string;
  companyName?: string;
  period?: string;
  href: DashboardHref;
  notify?: (text: string) => void;
  onSelectTransaction?: (t: Transaction) => void;
}

function fmtMoney(val: unknown): string {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return "0 ₫";
  return money(n);
}

function fmtPct(val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function MisaDashboardOverview({
  items,
  companyId: propCompanyId,
  companyName = "Doanh nghiệp",
  period: propPeriod,
  href,
  notify,
}: MisaDashboardOverviewProps) {
  const { token, companyId, companies: sessionCompanies } = useApiSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const effectiveToken = useMemo(() => {
    if (token) return token;
    try {
      const rawSession = localStorage.getItem("erp_api_session");
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (parsed?.token || parsed?.access) return String(parsed.token || parsed.access);
      }
      return localStorage.getItem("erp_token") || "";
    } catch {
      return "";
    }
  }, [token]);

  const effectiveCompanyId = useMemo(() => {
    const isUuid = (v?: string | null) =>
      Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()));
    if (isUuid(propCompanyId)) return propCompanyId!.trim();
    if (isUuid(companyId)) return companyId.trim();
    const urlComp = searchParams.get("company");
    if (isUuid(urlComp)) return urlComp!.trim();
    if (sessionCompanies?.length && isUuid(sessionCompanies[0]?.id)) {
      return sessionCompanies[0].id.trim();
    }
    try {
      const storedComp = localStorage.getItem("erp_company_id");
      if (isUuid(storedComp)) return storedComp!.trim();
      const rawSession = localStorage.getItem("erp_api_session");
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        if (isUuid(parsed?.companyId)) return String(parsed.companyId).trim();
        if (Array.isArray(parsed?.companies) && isUuid(parsed.companies[0]?.id)) {
          return String(parsed.companies[0].id).trim();
        }
      }
    } catch {
      // ignore
    }
    return "";
  }, [propCompanyId, companyId, searchParams, sessionCompanies]);

  const activeAccountingRegime = useMemo(() => {
    const found = (sessionCompanies || []).find((c: any) => c.id === effectiveCompanyId);
    if (found?.accounting_regime) return String(found.accounting_regime);
    try {
      const rawSession = localStorage.getItem("erp_api_session");
      if (rawSession) {
        const parsed = JSON.parse(rawSession);
        const match = (parsed?.companies || []).find((c: any) => c.id === effectiveCompanyId);
        if (match?.accounting_regime) return String(match.accounting_regime);
      }
    } catch {
      // ignore
    }
    return "TT99";
  }, [sessionCompanies, effectiveCompanyId]);

  const circularFullLabel =
    activeAccountingRegime === "TT133"
      ? "Thông tư 133/2016/TT-BTC (DNNVV)"
      : activeAccountingRegime === "TT200"
      ? "Thông tư 200/2014/TT-BTC"
      : "Thông tư 99/2025/TT-BTC";

  const dash06RegimeSubtitle =
    activeAccountingRegime === "TT133"
      ? "Tổng hợp từ Sổ cái TK loại 5, 6 (632, 6421, 6422), 7, 8 theo Thông tư 133/2016/TT-BTC (DNNVV)"
      : activeAccountingRegime === "TT200"
      ? "Tổng hợp từ Sổ cái TK loại 5, 6 (632, 641, 642), 7, 8 theo Thông tư 200/2014/TT-BTC"
      : "Tổng hợp từ Sổ cái TK loại 5, 6 (632, 641, 642), 7, 8 theo Thông tư 99/2025/TT-BTC";

  const urlPeriod = searchParams.get("period") || propPeriod || "2026-12";
  const [selectedPeriod, setSelectedPeriod] = useState<string>(urlPeriod);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(searchParams.get("branch_id") || "");
  const [comparisonMode, setComparisonMode] = useState<string>("PREVIOUS_PERIOD");
  const [revenueBasis, setRevenueBasis] = useState<string>("GL");
  const [recentModuleFilter, setRecentModuleFilter] = useState<string>("");
  const [recentStatusFilter, setRecentStatusFilter] = useState<string>("");

  const [configData, setConfigData] = useState<any>(null);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string>("");

  // Drill-down modal state (MF-06, AF-06..AF-08, BR-RPT-DASH-60..63)
  const [drilldownMetric, setDrilldownMetric] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<any>(null);
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);
  const [drilldownError, setDrilldownError] = useState<string>("");

  // Race condition guard for rapid period/filter switching (EF-29)
  const requestIdRef = useRef<number>(0);

  useEffect(() => {
    if (urlPeriod && urlPeriod !== selectedPeriod) {
      setSelectedPeriod(urlPeriod);
    }
  }, [urlPeriod]);

  const writer = useMemo(() => {
    if (!effectiveToken || !effectiveCompanyId) return null;
    return createApiWriter(effectiveCompanyId, (path, init) => request(path, effectiveToken, init));
  }, [effectiveToken, effectiveCompanyId]);

  // Load config (periods, branches, widget catalog) when company changes
  useEffect(() => {
    if (!writer) return;
    let active = true;
    fetchDashboardConfigUcRpt01(writer)
      .then((res) => {
        if (!active) return;
        setConfigData(res);
        const rawList = Array.isArray(res?.available_periods)
          ? res.available_periods
          : Array.isArray(res?.periods)
            ? res.periods
            : [];
        if (rawList.length > 0 && selectedPeriod !== "2026") {
          const exists = rawList.some((p: any) => (p.code || p.period_code) === selectedPeriod);
          if (!exists) {
            const fallback = res.default_period_code || rawList[0].code || rawList[0].period_code;
            if (fallback) setSelectedPeriod(String(fallback));
          }
        }
      })
      .catch(() => {
        // Non-fatal; overview endpoint still resolves context
      });
    return () => {
      active = false;
    };
  }, [writer]);

  // Load overview data with EF-29 race-condition protection
  const loadDashboardOverview = async (opts?: { forceRefresh?: boolean }) => {
    if (!writer) return;
    const currentReqId = ++requestIdRef.current;
    if (opts?.forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setGlobalError("");

    try {
      const payload = opts?.forceRefresh
        ? await refreshDashboardUcRpt01(writer, {
            period: selectedPeriod,
            branchId: selectedBranchId || undefined,
            comparisonMode,
            basis: revenueBasis,
          })
        : await fetchDashboardOverviewUcRpt01(writer, {
            period: selectedPeriod,
            branchId: selectedBranchId || undefined,
            comparisonMode,
            basis: revenueBasis,
          });

      // EF-29: Ignore stale response if a newer request was fired
      if (currentReqId !== requestIdRef.current) return;
      setOverviewData(payload);
      if (opts?.forceRefresh && notify) {
        notify("Đã làm mới số liệu Dashboard tổng quan từ Sổ cái và các phân hệ nghiệp vụ.");
      }
    } catch (err: any) {
      if (currentReqId !== requestIdRef.current) return;
      const msg = err instanceof Error ? err.message : String(err || "Không thể tải dữ liệu Dashboard.");
      setGlobalError(msg);
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!writer) return;
    void loadDashboardOverview();
  }, [writer, selectedPeriod, selectedBranchId, comparisonMode, revenueBasis]);

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    const next = new URLSearchParams(searchParams);
    next.set("period", newPeriod);
    setSearchParams(next, { replace: true });
  };

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    const next = new URLSearchParams(searchParams);
    if (newBranchId) next.set("branch_id", newBranchId);
    else next.delete("branch_id");
    setSearchParams(next, { replace: true });
  };

  const openMetricDrilldown = async (metricCode: string) => {
    setDrilldownMetric(metricCode);
    setDrilldownData(null);
    setDrilldownError("");
    if (!writer) return;
    setDrilldownLoading(true);
    try {
      const res = await fetchDashboardMetricDetailsUcRpt01(writer, metricCode, {
        period: selectedPeriod,
        branchId: selectedBranchId || undefined,
        basis: revenueBasis,
      });
      setDrilldownData(res);
    } catch (err: any) {
      setDrilldownError(err instanceof Error ? err.message : String(err));
    } finally {
      setDrilldownLoading(false);
    }
  };

  const periodsList = useMemo(() => {
    const formatPeriodName = (code: string, rawName?: string): string => {
      const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(code);
      if (m) return `Tháng ${m[2]}/${m[1]}`;
      const q = /^(\d{4})-Q([1-4])$/i.exec(code);
      if (q) return `Quý ${q[2]}/${q[1]}`;
      if (/^\d{4}$/.test(code)) return `Năm tài chính ${code}`;
      return rawName || `Kỳ ${code}`;
    };

    const rawPeriods: any[] = configData?.available_periods || configData?.periods || [];
    const normalized = rawPeriods.map((p) => {
      const code = String(p.code || p.period_code || "").trim();
      return {
        period_code: code,
        name: formatPeriodName(code, p.name),
        status: String(p.status || "OPEN"),
      };
    });
    const defaults = [
      { period_code: "2026-12", name: "Tháng 12/2026", status: "OPEN" },
      { period_code: "2026-11", name: "Tháng 11/2026", status: "OPEN" },
      { period_code: "2026-10", name: "Tháng 10/2026", status: "OPEN" },
      { period_code: "2026-09", name: "Tháng 09/2026", status: "OPEN" },
      { period_code: "2026-08", name: "Tháng 08/2026", status: "OPEN" },
      { period_code: "2026-07", name: "Tháng 07/2026", status: "OPEN" },
      { period_code: "2026-06", name: "Tháng 06/2026", status: "OPEN" },
      { period_code: "2026-05", name: "Tháng 05/2026", status: "OPEN" },
      { period_code: "2026-04", name: "Tháng 04/2026", status: "OPEN" },
      { period_code: "2026-03", name: "Tháng 03/2026", status: "OPEN" },
      { period_code: "2026-02", name: "Tháng 02/2026", status: "OPEN" },
      { period_code: "2026-01", name: "Tháng 01/2026", status: "OPEN" },
      { period_code: "2026", name: "Năm tài chính 2026", status: "OPEN" },
    ];
    const map = new Map<string, { period_code: string; name: string; status: string }>();
    for (const p of normalized) {
      if (p.period_code) map.set(p.period_code, p);
    }
    for (const d of defaults) {
      if (!map.has(d.period_code)) map.set(d.period_code, d);
    }
    if (selectedPeriod && !map.has(selectedPeriod)) {
      map.set(selectedPeriod, {
        period_code: selectedPeriod,
        name: formatPeriodName(selectedPeriod),
        status: "OPEN",
      });
    }
    return Array.from(map.values());
  }, [configData, selectedPeriod]);

  const branchesList: Array<{ id: string; code: string; name: string }> =
    configData?.available_branches || configData?.branches || [];

  const widgets = overviewData?.widgets || {};
  const w01 = widgets["DASH-01"] || {};
  const w02 = widgets["DASH-02"] || {};
  const w03 = widgets["DASH-03"] || {};
  const w04 = widgets["DASH-04"] || {};
  const w07 = widgets["DASH-07"] || {};
  const w08 = widgets["DASH-08"] || {};
  const w09 = widgets["DASH-09"] || {};
  const dash01 = w01.data || {};
  const dash02 = w02.data || {};
  const dash03 = w03.data || {};
  const dash04 = w04.data || {};
  const dash05 = widgets["DASH-05"]?.data || {};
  const dash06 = widgets["DASH-06"]?.data || {};
  const dash07 = w07.data || {};
  const dash08 = w08.data || {};
  const dash09 = w09.data || {};
  const dash10 = widgets["DASH-10"]?.data || {};
  const dash11 = widgets["DASH-11"]?.data || {};
  const dash12 = widgets["DASH-12"]?.data || {};

  // Offline preview fallback ONLY when unauthenticated (!writer)
  const hasApiSession = Boolean(writer);
  const isOfficialApiConnected = Boolean(writer && overviewData);
  const postedLocal = items.filter((t) => t.status === "posted");
  const pendingLocal = items.filter((t) => t.status === "pending");

  const kpiCards = [
    {
      code: "DASH-01",
      label: "Doanh thu bán hàng",
      status: w01.status || (hasApiSession ? "NO_DATA" : "DEMO"),
      value: hasApiSession
        ? Number(w01.value ?? dash01.revenue_net ?? dash01.net_revenue ?? 0)
        : postedLocal.filter((t) => t.kind === "sale").reduce((s, t) => s + t.amount, 0),
      subtext: hasApiSession
        ? `Gộp: ${fmtMoney(dash01.revenue_gross ?? dash01.gross_revenue ?? 0)} · Giảm trừ: ${fmtMoney(dash01.revenue_deduction ?? dash01.deduction_amount ?? 0)}`
        : "Chứng từ bán hàng đã ghi sổ",
      deltaPct: fmtPct(w01.comparison?.delta_percent ?? w01.comparison?.change_percent ?? dash01.delta_pct),
      icon: ArrowUpRight,
      tone: "blue",
      isCount: false,
      targetUrl: "/sales/transactions",
    },
    {
      code: "DASH-02",
      label: "Giá trị mua hàng",
      status: w02.status || (hasApiSession ? "NO_DATA" : "DEMO"),
      value: hasApiSession
        ? Number(w02.value ?? dash02.purchase_net_amount ?? dash02.net_purchase_value ?? 0)
        : postedLocal.filter((t) => t.kind === "purchase").reduce((s, t) => s + t.amount, 0),
      subtext: hasApiSession
        ? `${dash02.document_count ?? 0} chứng từ · Giảm trừ: ${fmtMoney(dash02.purchase_return_discount_amount ?? dash02.return_allowance_value ?? 0)}`
        : "Chứng từ mua hàng đã ghi sổ",
      deltaPct: fmtPct(w02.comparison?.delta_percent ?? w02.comparison?.change_percent ?? dash02.delta_pct),
      icon: ArrowDownLeft,
      tone: "orange",
      isCount: false,
      targetUrl: "/purchases/transactions",
    },
    {
      code: "DASH-03",
      label: "Tổng tiền đã thu",
      status: w03.status || (hasApiSession ? "NO_DATA" : "DEMO"),
      value: hasApiSession
        ? Number(w03.value ?? dash03.receipt_total_external ?? dash03.cash_collected_external_amount ?? dash03.total_cash_inflow ?? 0)
        : postedLocal.filter((t) => t.kind === "receipt" || t.kind === "bank").reduce((s, t) => s + t.amount, 0),
      subtext: hasApiSession
        ? `TM: ${fmtMoney(dash03.cash_receipt_amount ?? dash03.cash_inflow ?? 0)} · NH: ${fmtMoney(dash03.bank_receipt_amount ?? dash03.bank_inflow ?? 0)}`
        : "Tiền mặt và tiền gửi đã ghi sổ",
      deltaPct: fmtPct(w03.comparison?.delta_percent ?? w03.comparison?.change_percent ?? dash03.delta_pct),
      icon: Wallet,
      tone: "teal",
      isCount: false,
      targetUrl: "/cash/transactions",
    },
    {
      code: "DASH-04",
      label: "Chứng từ chờ xử lý",
      status: w04.status || (hasApiSession ? "NO_DATA" : "DEMO"),
      value: hasApiSession
        ? Number(w04.value ?? dash04.pending_company_approval_count ?? dash04.total_pending_count ?? 0)
        : pendingLocal.length,
      subtext: hasApiSession
        ? `Chờ duyệt: ${dash04.pending_company_approval_count ?? dash04.pending_approval_count ?? 0} · Chờ ghi sổ: ${dash04.approved_unposted_count ?? 0}`
        : "Cần kiểm tra và xác nhận",
      deltaPct: null,
      icon: FileCheck2,
      tone: "violet",
      isCount: true,
      targetUrl: "/ledger/transactions",
    },
  ];

  const recentDocsList: any[] = useMemo(() => {
    const raw: any[] = hasApiSession
      ? dash12.items || []
      : items.slice(0, 10).map((t) => ({
          document_id: t.id,
          module: t.kind === "sale" ? "SAL" : t.kind === "purchase" ? "PUR" : t.kind === "bank" ? "BANK" : "CASH",
          document_type_label: kinds[t.kind] || "Chứng từ",
          document_number: t.code,
          document_date: t.date,
          description: t.partner,
          amount: String(t.amount),
          status: t.status === "posted" ? "POSTED" : t.status === "pending" ? "PENDING_APPROVAL" : "DRAFT",
          target_url: "/ledger/transactions",
        }));
    return raw.filter((doc) => {
      if (recentModuleFilter && doc.module !== recentModuleFilter) return false;
      if (recentStatusFilter && doc.status !== recentStatusFilter) return false;
      return true;
    });
  }, [hasApiSession, dash12.items, items, recentModuleFilter, recentStatusFilter]);

  const cashFlowSeries: any[] = useMemo(() => {
    const raw: any[] = dash05.series || [];
    const active = raw.filter(
      (pt: any) => Number(pt.inflow_amount ?? pt.inflow ?? 0) !== 0 || Number(pt.outflow_amount ?? pt.outflow ?? 0) !== 0,
    );
    return active.length > 0 ? active : raw;
  }, [dash05.series]);
  const profitSeries: any[] = dash06.series || [];
  const arRows: any[] =
    (Array.isArray(dash07.top_debtors) && dash07.top_debtors.length ? dash07.top_debtors : dash07.items) || [];
  const apRows: any[] =
    (Array.isArray(dash08.top_creditors) && dash08.top_creditors.length ? dash08.top_creditors : dash08.items) || [];
  const lowStockItems: any[] =
    (Array.isArray(dash09.below_minimum_items) && dash09.below_minimum_items.length
      ? dash09.below_minimum_items
      : dash09.low_stock_items) || [];
  const inventorySummaryRows: any[] =
    (Array.isArray(dash09.top_items) && dash09.top_items.length
      ? dash09.top_items
      : dash09.by_warehouse || dash09.warehouse_summary) || [];
  const filterInfo = overviewData?.filters || overviewData?.context || {};

  return (
    <div className="ref-overview" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Thanh điều khiển & Bộ lọc ngữ cảnh Dashboard (DR-RPT-01, AF-01..AF-05) */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderLeft: "4px solid #0d9488",
          overflow: "visible",
          position: "relative",
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: "#0f172a" }}>Tổng quan tình hình tài chính &amp; hoạt động</strong>
            <span
              style={{
                fontSize: 11.5,
                padding: "2px 10px",
                borderRadius: 999,
                fontWeight: 600,
                background: hasApiSession ? "#ecfdf5" : "#fff7ed",
                color: hasApiSession ? "#047857" : "#c2410c",
                border: `1px solid ${hasApiSession ? "#a7f3d0" : "#fed7aa"}`,
              }}
            >
              {isOfficialApiConnected
                ? "Đã kết nối Sổ cái trực tuyến"
                : hasApiSession
                  ? "Đang đồng bộ Sổ cái…"
                  : "Chế độ xem thử ngoại tuyến"}
            </span>
            <span
              data-testid="dashboard-regime-badge"
              style={{
                fontSize: 11.5,
                padding: "2px 10px",
                borderRadius: 999,
                fontWeight: 700,
                background:
                  activeAccountingRegime === "TT133"
                    ? "#eff6ff"
                    : activeAccountingRegime === "TT200"
                    ? "#fffbeb"
                    : "#ecfdf5",
                color:
                  activeAccountingRegime === "TT133"
                    ? "#1d4ed8"
                    : activeAccountingRegime === "TT200"
                    ? "#b45309"
                    : "#047857",
                border:
                  activeAccountingRegime === "TT133"
                    ? "1px solid #bfdbfe"
                    : activeAccountingRegime === "TT200"
                    ? "1px solid #fde68a"
                    : "1px solid #a7f3d0",
              }}
            >
              Chế độ: {circularFullLabel}
            </span>
            {filterInfo.from_date && (
              <span style={{ fontSize: 12, color: "#475569" }}>
                Kỳ: <strong>{selectedPeriod || filterInfo.fiscal_period_code}</strong> ({filterInfo.from_date} →{" "}
                {filterInfo.to_date})
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              className="ref-button teal"
              disabled={loading || refreshing}
              onClick={() => void loadDashboardOverview({ forceRefresh: true })}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0, borderRadius: 999 }}
            >
              <RefreshCw size={14} className={loading || refreshing ? "spin" : ""} />
              <span>{refreshing ? "Đang làm mới…" : "Làm mới"}</span>
            </button>

            <Link
              to={href("/reports")}
              className="ref-button"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0, borderRadius: 999 }}
            >
              <span>Trung tâm báo cáo</span>
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
            <Calendar size={14} style={{ color: "#64748b" }} />
            <span>Kỳ:</span>
            <MisaDropdownSelect
              ariaLabel="Chọn kỳ báo cáo Dashboard"
              title="Kỳ báo cáo kế toán"
              value={selectedPeriod}
              onChange={(val) => handlePeriodChange(val)}
              minWidth={230}
              buttonStyle={{
                height: 31,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12.5,
                minWidth: 195,
              }}
              popoverStyle={{ borderRadius: 12, padding: 6 }}
              options={periodsList.map((p) => ({
                value: p.period_code,
                label: `${p.name} (${p.period_code})`,
              }))}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
            <Building2 size={14} style={{ color: "#64748b" }} />
            <span>Đơn vị:</span>
            <MisaDropdownSelect
              ariaLabel="Chọn đơn vị/chi nhánh"
              title="Đơn vị / Chi nhánh"
              value={selectedBranchId}
              onChange={(val) => handleBranchChange(val)}
              minWidth={280}
              buttonStyle={{
                height: 31,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12.5,
                minWidth: 230,
                maxWidth: 320,
              }}
              popoverStyle={{ borderRadius: 12, padding: 6 }}
              options={[
                { value: "", label: `Toàn doanh nghiệp (${companyName})` },
                ...branchesList.map((b) => ({
                  value: b.id,
                  label: `${b.code} - ${b.name}`,
                })),
              ]}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
            <span>So sánh:</span>
            <MisaDropdownSelect
              ariaLabel="Chế độ so sánh kỳ"
              title="Chế độ so sánh"
              value={comparisonMode}
              onChange={(val) => setComparisonMode(val)}
              minWidth={190}
              buttonStyle={{
                height: 31,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12.5,
              }}
              popoverStyle={{ borderRadius: 12, padding: 6 }}
              options={[
                { value: "PREVIOUS_PERIOD", label: "Kỳ liền trước" },
                { value: "SAME_PERIOD_LAST_YEAR", label: "Cùng kỳ năm trước" },
                { value: "NONE", label: "Không so sánh" },
              ]}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155", whiteSpace: "nowrap" }}>
            <span>Nguồn DT:</span>
            <MisaDropdownSelect
              ariaLabel="Nguồn tính doanh thu"
              title="Nguồn tính doanh thu"
              value={revenueBasis}
              onChange={(val) => setRevenueBasis(val)}
              minWidth={210}
              buttonStyle={{
                height: 31,
                padding: "0 12px",
                borderRadius: 999,
                fontSize: 12.5,
              }}
              popoverStyle={{ borderRadius: 12, padding: 6 }}
              options={[
                { value: "GL", label: "Sổ cái (TK 511/521)" },
                { value: "SAL", label: "Chứng từ bán hàng (SAL)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Thông báo lỗi toàn cục nếu không có quyền hoặc kỳ không hợp lệ (EF-01..EF-05) */}
      {globalError && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} />
            <span>
              <strong>Không thể tải Dashboard:</strong> {globalError}
            </span>
          </div>
          <button
            type="button"
            className="ref-button"
            style={{ borderRadius: 6 }}
            onClick={() => void loadDashboardOverview({ forceRefresh: true })}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* NHÓM 1: 4 THẺ CHỈ TIÊU TỔNG QUAN (DASH-01 .. DASH-04) */}
      <div
        className="metrics"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isError = card.status === "ERROR";
          const isForbidden = card.status === "FORBIDDEN" || card.status === "HIDDEN";
          return (
            <article
              key={card.code}
              className="metric card"
              style={{
                padding: 16,
                cursor: "pointer",
                transition: "box-shadow 0.15s ease",
                borderTop: `3px solid ${
                  card.tone === "blue"
                    ? "#2563eb"
                    : card.tone === "orange"
                      ? "#ea580c"
                      : card.tone === "teal"
                        ? "#0d9488"
                        : "#7c3aed"
                }`,
              }}
              onClick={() => void openMetricDrilldown(card.code)}
            >
              <div className="metric-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                  {card.label}
                </span>
                <span className={`metric-icon ${card.tone}`}>
                  <Icon size={18} />
                </span>
              </div>

              {isForbidden ? (
                <div style={{ margin: "12px 0", fontSize: 12.5, color: "#64748b" }}>
                  Ngoài phạm vi quyền xem chỉ tiêu
                </div>
              ) : isError ? (
                <div style={{ margin: "12px 0", fontSize: 12.5, color: "#dc2626" }}>
                  Lỗi tải dữ liệu chỉ tiêu
                </div>
              ) : (
                <div style={{ margin: "10px 0 6px", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 22, color: "#0f172a" }}>
                    {card.isCount
                      ? `${Number(card.value || 0)} chứng từ`
                      : fmtMoney(card.value)}
                  </strong>
                  {card.deltaPct && (
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: card.deltaPct.startsWith("-") ? "#fef2f2" : "#ecfdf5",
                        color: card.deltaPct.startsWith("-") ? "#dc2626" : "#059669",
                      }}
                    >
                      {card.deltaPct}
                    </span>
                  )}
                </div>
              )}

              <div
                className="metric-hint"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 11.5,
                  color: "#64748b",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={card.subtext}>
                  {card.subtext}
                </span>
                <span style={{ color: "#0284c7", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>Chi tiết →</span>
              </div>
            </article>
          );
        })}
      </div>

      {/* NHÓM 2: DÒNG TIỀN (DASH-05) & KẾT QUẢ DOANH THU - CHI PHÍ - LỢI NHUẬN (DASH-06) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 16,
        }}
      >
        {/* DASH-05: Biểu đồ dòng tiền thu – chi */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, margin: 0, color: "#0f172a" }}>Biểu đồ dòng tiền thu – chi</h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                Tổng hợp Tiền mặt (111) và Tiền gửi ngân hàng (112), đã loại trừ chuyển quỹ nội bộ
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button
                type="button"
                className="ref-button"
                style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}
                onClick={() => void openMetricDrilldown("DASH-05")}
              >
                Truy vết
              </button>
              <Link
                className="text-link"
                to={href("/cash/transactions")}
                style={{ fontSize: 12, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                Sổ quỹ <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: 10,
              background: "#f8fafc",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Tồn đầu kỳ</span>
              <strong style={{ color: "#0f172a" }}>
                {fmtMoney(dash05.opening_cash_balance ?? dash05.opening_balance ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#059669", display: "block" }}>Tổng thu</span>
              <strong style={{ color: "#059669" }}>
                {fmtMoney(dash05.cash_inflow_total ?? dash05.total_inflow ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#dc2626", display: "block" }}>Tổng chi</span>
              <strong style={{ color: "#dc2626" }}>
                {fmtMoney(dash05.cash_outflow_total ?? dash05.total_outflow ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#0284c7", display: "block" }}>Tồn cuối kỳ</span>
              <strong style={{ color: "#0284c7" }}>
                {fmtMoney(dash05.closing_cash_balance ?? dash05.closing_balance ?? 0)}
              </strong>
            </div>
          </div>

          {cashFlowSeries.length > 0 ? (
            <div style={{ maxHeight: 195, overflowY: "auto" }}>
              <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Kỳ / Nhóm ngày</th>
                    <th className="numeric">Tiền thu</th>
                    <th className="numeric">Tiền chi</th>
                    <th className="numeric">Chênh lệch</th>
                    <th className="numeric">Số dư lũy kế</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowSeries.map((pt: any) => (
                    <tr key={pt.bucket_key || pt.bucket}>
                      <td>{pt.label || pt.bucket_key || pt.bucket}</td>
                      <td className="numeric" style={{ color: "#059669" }}>
                        {fmtMoney(pt.inflow_amount ?? pt.inflow)}
                      </td>
                      <td className="numeric" style={{ color: "#dc2626" }}>
                        {fmtMoney(pt.outflow_amount ?? pt.outflow)}
                      </td>
                      <td className="numeric" style={{ fontWeight: 600 }}>
                        {fmtMoney(pt.net_cash_flow ?? pt.net_flow)}
                      </td>
                      <td className="numeric">{fmtMoney(pt.closing_balance ?? pt.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
              Chưa có phát sinh dòng tiền thu – chi trong kỳ đã chọn (Số dư hiện tại:{" "}
              {fmtMoney(dash05.closing_cash_balance ?? dash05.closing_balance ?? 0)}).
            </div>
          )}
        </section>

        {/* DASH-06: Doanh thu, chi phí và lợi nhuận */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, margin: 0, color: "#0f172a" }}>Doanh thu, chi phí và lợi nhuận</h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>
                {dash06RegimeSubtitle}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button
                type="button"
                className="ref-button"
                style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}
                onClick={() => void openMetricDrilldown("DASH-06")}
              >
                Truy vết
              </button>
              <Link
                className="text-link"
                to={href("/reports")}
                style={{ fontSize: 12, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}
              >
                B02-DN <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {(widgets["DASH-06"]?.warnings || []).map((w: any, idx: number) => (
            <div
              key={w.code || idx}
              style={{
                padding: "6px 10px",
                marginBottom: 10,
                borderRadius: 6,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 11.5,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={14} />
              <span>{w.message}</span>
            </div>
          ))}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
              padding: 10,
              background: "#f8fafc",
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 12,
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Doanh thu thuần</span>
              <strong style={{ color: "#0284c7" }}>
                {fmtMoney(dash06.net_revenue ?? dash06.revenue_net ?? dash06.total_revenue ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Giá vốn (632)</span>
              <strong style={{ color: "#d97706" }}>
                {fmtMoney(dash06.cogs ?? dash06.cogs_amount ?? dash06.total_cogs ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Tổng chi phí</span>
              <strong style={{ color: "#dc2626" }}>
                {fmtMoney(dash06.total_expense ?? dash06.expense_total ?? dash06.operating_expense ?? 0)}
              </strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>Lợi nhuận thuần</span>
              <strong
                style={{
                  color: Number(dash06.net_profit ?? dash06.profit_after_tax ?? dash06.profit_before_tax ?? 0) >= 0 ? "#059669" : "#dc2626",
                }}
              >
                {fmtMoney(dash06.net_profit ?? dash06.profit_after_tax ?? dash06.profit_before_tax ?? 0)}
              </strong>
            </div>
          </div>

          {profitSeries.length > 0 ? (
            <div style={{ maxHeight: 175, overflowY: "auto" }}>
              <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th className="numeric">Doanh thu</th>
                    <th className="numeric">Chi phí</th>
                    <th className="numeric">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {profitSeries.map((pt: any) => {
                    const rowProfit = pt.profit_after_tax ?? pt.net_profit ?? pt.profit ?? 0;
                    return (
                      <tr key={pt.period_key || pt.bucket_key || pt.bucket}>
                        <td>{pt.label || pt.period_key || pt.bucket_key || pt.bucket}</td>
                        <td className="numeric" style={{ color: "#0284c7" }}>
                          {fmtMoney(pt.net_revenue ?? pt.revenue)}
                        </td>
                        <td className="numeric" style={{ color: "#d97706" }}>
                          {fmtMoney(pt.total_expense ?? pt.expense)}
                        </td>
                        <td
                          className="numeric"
                          style={{
                            fontWeight: 600,
                            color: Number(rowProfit) >= 0 ? "#059669" : "#dc2626",
                          }}
                        >
                          {fmtMoney(rowProfit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: "#64748b", fontSize: 12.5 }}>
              Chưa có phát sinh doanh thu – chi phí trong kỳ đã chọn.
            </div>
          )}
        </section>
      </div>

      {/* NHÓM 3: CÔNG NỢ PHẢI THU (DASH-07), CÔNG NỢ PHẢI TRẢ (DASH-08), TỒN KHO (DASH-09), THUẾ (DASH-10) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
          gap: 16,
        }}
      >
        {/* DASH-07: Công nợ phải thu */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Công nợ phải thu khách hàng</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Tổng phải thu:{" "}
                <strong>{fmtMoney(dash07.ar_total_receivable ?? dash07.receivable_total ?? dash07.total_receivable ?? w07.value ?? 0)}</strong> ·
                Quá hạn: <strong style={{ color: "#dc2626" }}>{fmtMoney(dash07.ar_overdue_amount ?? dash07.overdue_amount ?? 0)}</strong> (
                {dash07.overdue_customer_count ?? 0} KH)
              </p>
            </div>
            <button
              type="button"
              className="ref-button"
              style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999 }}
              onClick={() => void openMetricDrilldown("DASH-07")}
            >
              Chi tiết phải thu
            </button>
          </div>

          {dash07.aging_buckets && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
                fontSize: 11,
                background: "#f8fafc",
                padding: 8,
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              <div>
                <span style={{ color: "#64748b", display: "block" }}>Quá hạn 1–30 ngày</span>
                <strong>{fmtMoney(dash07.aging_buckets.overdue_1_30 ?? dash07.aging_buckets.days_1_30)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>31–60 ngày</span>
                <strong>{fmtMoney(dash07.aging_buckets.overdue_31_60 ?? dash07.aging_buckets.days_31_60)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>61–90 ngày</span>
                <strong>{fmtMoney(dash07.aging_buckets.overdue_61_90 ?? dash07.aging_buckets.days_61_90)}</strong>
              </div>
              <div>
                <span style={{ color: "#dc2626", display: "block" }}>&gt; 90 ngày</span>
                <strong style={{ color: "#dc2626" }}>
                  {fmtMoney(dash07.aging_buckets.overdue_over_90 ?? dash07.aging_buckets.days_over_90)}
                </strong>
              </div>
            </div>
          )}

          <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th>Khách hàng nợ cao nhất</th>
                <th className="numeric">Tổng dư nợ</th>
                <th className="numeric">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {arRows.map((row: any) => (
                <tr key={row.party_id || row.partner_id || row.customer_id || row.party_code || row.partner_code || row.customer_code}>
                  <td>
                    <strong>{row.party_code || row.partner_code || row.customer_code || row.document_number}</strong> ·{" "}
                    {row.party_name || row.partner_name || row.customer_name}
                  </td>
                  <td className="numeric">{fmtMoney(row.total_balance ?? row.open_balance ?? row.open_amount ?? row.total_outstanding)}</td>
                  <td className="numeric" style={{ color: Number(row.overdue_amount) > 0 ? "#dc2626" : "#64748b" }}>
                    {fmtMoney(row.overdue_amount)}
                  </td>
                </tr>
              ))}
              {!arRows.length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    Không có công nợ phải thu còn tồn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* DASH-08: Công nợ phải trả */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Công nợ phải trả nhà cung cấp</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Tổng phải trả:{" "}
                <strong>{fmtMoney(dash08.ap_total_payable ?? dash08.payable_total ?? dash08.total_payable ?? w08.value ?? 0)}</strong> · Sắp đến
                hạn: <strong style={{ color: "#d97706" }}>{fmtMoney(dash08.ap_due_soon_amount ?? dash08.due_soon_amount ?? dash08.aging_buckets?.current ?? 0)}</strong> · Quá hạn:{" "}
                <strong style={{ color: "#dc2626" }}>{fmtMoney(dash08.ap_overdue_amount ?? dash08.overdue_amount ?? 0)}</strong>
              </p>
            </div>
            <button
              type="button"
              className="ref-button"
              style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999 }}
              onClick={() => void openMetricDrilldown("DASH-08")}
            >
              Chi tiết phải trả
            </button>
          </div>

          {dash08.aging_buckets && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 6,
                fontSize: 11,
                background: "#f8fafc",
                padding: 8,
                borderRadius: 6,
                marginBottom: 10,
              }}
            >
              <div>
                <span style={{ color: "#64748b", display: "block" }}>Quá hạn 1–30 ngày</span>
                <strong>{fmtMoney(dash08.aging_buckets.overdue_1_30 ?? dash08.aging_buckets.days_1_30)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>31–60 ngày</span>
                <strong>{fmtMoney(dash08.aging_buckets.overdue_31_60 ?? dash08.aging_buckets.days_31_60)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block" }}>61–90 ngày</span>
                <strong>{fmtMoney(dash08.aging_buckets.overdue_61_90 ?? dash08.aging_buckets.days_61_90)}</strong>
              </div>
              <div>
                <span style={{ color: "#dc2626", display: "block" }}>&gt; 90 ngày</span>
                <strong style={{ color: "#dc2626" }}>
                  {fmtMoney(dash08.aging_buckets.overdue_over_90 ?? dash08.aging_buckets.days_over_90)}
                </strong>
              </div>
            </div>
          )}

          <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th>Nhà cung cấp phải trả lớn nhất</th>
                <th className="numeric">Tổng phải trả</th>
                <th className="numeric">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {apRows.map((row: any) => (
                <tr key={row.party_id || row.partner_id || row.vendor_id || row.party_code || row.partner_code || row.vendor_code}>
                  <td>
                    <strong>{row.party_code || row.partner_code || row.vendor_code || row.document_number}</strong> ·{" "}
                    {row.party_name || row.partner_name || row.vendor_name}
                  </td>
                  <td className="numeric">{fmtMoney(row.total_balance ?? row.open_balance ?? row.open_amount ?? row.total_outstanding)}</td>
                  <td className="numeric" style={{ color: Number(row.overdue_amount) > 0 ? "#dc2626" : "#64748b" }}>
                    {fmtMoney(row.overdue_amount)}
                  </td>
                </tr>
              ))}
              {!apRows.length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    Không có công nợ phải trả còn tồn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* DASH-09: Tổng quan tồn kho */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Tổng quan tồn kho vật tư, hàng hóa</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Giá trị tồn:{" "}
                <strong>{fmtMoney(dash09.inventory_total_value ?? dash09.total_inventory_value ?? w09.value ?? 0)}</strong> ·{" "}
                {dash09.active_sku_count ?? dash09.active_item_count ?? 0} mặt hàng · Dưới tối thiểu:{" "}
                <strong style={{ color: "#d97706" }}>
                  {dash09.below_minimum_stock_count ?? dash09.below_min_stock_count ?? 0}
                </strong>
              </p>
            </div>
            <button
              type="button"
              className="ref-button"
              style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999 }}
              onClick={() => void openMetricDrilldown("DASH-09")}
            >
              Chi tiết tồn kho
            </button>
          </div>

          <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th>Vật tư / Kho cần chú ý</th>
                <th className="numeric">SL tồn / Định mức</th>
                <th className="numeric">Thiếu hụt / Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.slice(0, 5).map((item: any) => (
                <tr key={item.item_id || item.item_code}>
                  <td>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>[Cảnh báo]</span> {item.item_code} ·{" "}
                    {item.item_name}
                  </td>
                  <td className="numeric">
                    {item.quantity_on_hand ?? item.closing_quantity} / {item.min_stock_level ?? item.minimum_stock_qty}
                  </td>
                  <td className="numeric" style={{ color: "#dc2626", fontWeight: 600 }}>
                    {item.shortage_quantity
                      ? `Thiếu ${item.shortage_quantity}`
                      : fmtMoney(item.closing_value ?? item.total_value ?? 0)}
                  </td>
                </tr>
              ))}
              {!lowStockItems.length &&
                inventorySummaryRows.slice(0, 5).map((wh: any) => (
                  <tr key={wh.warehouse_id || wh.warehouse_code || wh.item_id || wh.item_code}>
                    <td>
                      <strong>{wh.warehouse_code || wh.item_code}</strong> · {wh.warehouse_name || wh.item_name}
                    </td>
                    <td className="numeric">
                      {wh.closing_quantity !== undefined || wh.quantity !== undefined
                        ? `${Number(wh.closing_quantity ?? wh.quantity ?? 0).toLocaleString("vi-VN")} ${wh.uom_code === "VND" ? "nhóm TK" : (wh.uom_code || "đv")}`
                        : `${wh.sku_count ?? wh.item_count ?? 0} mặt hàng`}
                    </td>
                    <td className="numeric">{fmtMoney(wh.inventory_value ?? wh.closing_value ?? wh.total_value ?? 0)}</td>
                  </tr>
                ))}
              {!lowStockItems.length && !inventorySummaryRows.length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    Tồn kho ổn định, không có mặt hàng dưới định mức tối thiểu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* DASH-10: Tổng quan nghĩa vụ thuế */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Tổng quan nghĩa vụ thuế (TK 133 / 333)</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Tổng thuế phải nộp:{" "}
                <strong style={{ color: "#dc2626" }}>
                  {fmtMoney(dash10.tax_payable_total ?? dash10.total_tax_payable ?? 0)}
                </strong>{" "}
                · GTGT còn khấu trừ:{" "}
                <strong style={{ color: "#059669" }}>
                  {fmtMoney(dash10.net_vat_deductible_carryforward ?? dash10.remaining_vat_credit ?? 0)}
                </strong>
              </p>
            </div>
            <Link className="ref-button" to={href("/tax")} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 999 }}>
              Phân hệ Thuế
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
              fontSize: 11.5,
              background: "#f8fafc",
              padding: 8,
              borderRadius: 6,
              marginBottom: 10,
            }}
          >
            <div>
              <span style={{ color: "#64748b", display: "block" }}>GTGT đầu ra (3331)</span>
              <strong>{fmtMoney(dash10.vat_output_amount ?? 0)}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>GTGT đầu vào (133)</span>
              <strong>{fmtMoney(dash10.vat_input_deductible_amount ?? 0)}</strong>
            </div>
            <div>
              <span style={{ color: "#64748b", display: "block" }}>GTGT phải nộp thuần</span>
              <strong style={{ color: "#dc2626" }}>{fmtMoney(dash10.net_vat_payable ?? 0)}</strong>
            </div>
          </div>

          <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th>Nghĩa vụ / Tờ khai thuế</th>
                <th>Trạng thái hạn nộp</th>
                <th className="numeric">Còn phải nộp</th>
              </tr>
            </thead>
            <tbody>
              {(dash10.obligations || dash10.declarations || []).slice(0, 4).map((ob: any) => (
                <tr key={ob.obligation_id || ob.id}>
                  <td>
                    <strong>{ob.tax_type}</strong> ({ob.period_code || ob.declaration_no || "Kỳ HT"})
                  </td>
                  <td>{ob.deadline_status || ob.status}</td>
                  <td className="numeric">{fmtMoney(ob.outstanding_amount ?? ob.payable_amount)}</td>
                </tr>
              ))}
              {!(dash10.obligations || dash10.declarations || []).length && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                    Chưa có nghĩa vụ thuế quá hạn hoặc sắp đến hạn trong kỳ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* NHÓM 4: ĐIỀU HÀNH – CÔNG VIỆC CẦN XỬ LÝ (DASH-11) & CHỨNG TỪ GẦN ĐÂY (DASH-12) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr",
          gap: 16,
        }}
      >
        {/* DASH-11: Danh sách công việc cần xử lý */}
        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Công việc cần xử lý</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Phê duyệt chứng từ, ghi sổ và cảnh báo vận hành
              </p>
            </div>
            <span className="count-pill">{dash11.total_count ?? (dash11.items || []).length}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
            {(dash11.items || []).map((task: any) => (
              <div
                key={task.task_id}
                onClick={() => navigate(href(task.action_url || task.target_url || "/ledger/transactions"))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: task.is_overdue || task.priority === 1 || task.priority === "HIGH" ? "#fffbeb" : "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background:
                          task.is_overdue || task.priority === 1 || task.priority === "HIGH" ? "#fef2f2" : "#eff6ff",
                        color:
                          task.is_overdue || task.priority === 1 || task.priority === "HIGH" ? "#dc2626" : "#1d4ed8",
                      }}
                    >
                      {task.module}
                    </span>
                    <strong style={{ fontSize: 12.5, color: "#0f172a" }}>{task.title}</strong>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2 }}>
                    {task.document_number || task.subtitle || task.task_type}
                    {task.amount ? ` · ${fmtMoney(task.amount)}` : ""}
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: "#64748b", flexShrink: 0 }} />
              </div>
            ))}
            {!(dash11.items || []).length && (
              <div style={{ padding: 24, textAlign: "center", color: "#059669", fontSize: 12.5 }}>
                <CheckCircle2 size={24} style={{ margin: "0 auto 6px", display: "block" }} />
                Đã xử lý hoàn tất các công việc tồn đọng trong kỳ.
              </div>
            )}
          </div>
        </section>

        {/* DASH-12: Danh sách chứng từ gần đây */}
        <section className="card" style={{ padding: 16, overflow: "visible", position: "relative", zIndex: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div>
              <h2 style={{ fontSize: 14.5, margin: 0, color: "#0f172a" }}>Chứng từ phát sinh gần đây</h2>
              <p style={{ fontSize: 11.5, color: "#64748b", margin: "2px 0 0" }}>
                Tổng hợp chứng từ phát sinh gần nhất từ Sổ cái và các phân hệ nghiệp vụ
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Filter size={13} style={{ color: "#64748b" }} />
              <MisaDropdownSelect
                ariaLabel="Lọc phân hệ chứng từ gần đây"
                title="Phân hệ nghiệp vụ"
                value={recentModuleFilter}
                onChange={(val) => setRecentModuleFilter(val)}
                minWidth={175}
                align="right"
                buttonStyle={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 999,
                  fontSize: 11.5,
                }}
                popoverStyle={{ borderRadius: 12, padding: 6 }}
                options={[
                  { value: "", label: "Tất cả phân hệ" },
                  { value: "SAL", label: "Bán hàng (SAL)" },
                  { value: "PUR", label: "Mua hàng (PUR)" },
                  { value: "CASH", label: "Tiền mặt (CASH)" },
                  { value: "BANK", label: "Tiền gửi (BANK)" },
                  { value: "GL", label: "Tổng hợp (GL)" },
                ]}
              />
              <MisaDropdownSelect
                ariaLabel="Lọc trạng thái chứng từ gần đây"
                title="Trạng thái chứng từ"
                value={recentStatusFilter}
                onChange={(val) => setRecentStatusFilter(val)}
                minWidth={160}
                align="right"
                buttonStyle={{
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 999,
                  fontSize: 11.5,
                }}
                popoverStyle={{ borderRadius: 12, padding: 6 }}
                options={[
                  { value: "", label: "Mọi trạng thái" },
                  { value: "POSTED", label: "Đã ghi sổ" },
                  { value: "PENDING_APPROVAL", label: "Chờ duyệt" },
                  { value: "APPROVED", label: "Đã duyệt" },
                  { value: "DRAFT", label: "Nháp" },
                ]}
              />
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Số CT</th>
                  <th>Phân hệ / Loại</th>
                  <th>Ngày CT</th>
                  <th>Đối tác / Diễn giải</th>
                  <th className="numeric">Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentDocsList.map((doc: any) => (
                  <tr
                    key={`${doc.module}-${doc.document_id || doc.document_number || doc.document_no}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(href(doc.target_url || "/ledger/transactions"))}
                  >
                    <td>
                      <strong style={{ color: "#0284c7" }}>{doc.document_number || doc.document_no}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: "#475569" }}>
                        [{doc.module}] {doc.document_type_label || doc.document_type}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{doc.document_date || doc.posting_date}</td>
                    <td>{doc.description || doc.partner_name || "—"}</td>
                    <td className="numeric" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                      {doc.amount_masked ? "***" : fmtMoney(doc.amount)}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 600,
                          background: doc.status === "POSTED" ? "#ecfdf5" : "#fffbeb",
                          color: doc.status === "POSTED" ? "#047857" : "#b45309",
                        }}
                      >
                        {doc.status === "POSTED"
                          ? "Đã ghi sổ"
                          : doc.status === "PENDING_APPROVAL"
                            ? "Chờ duyệt"
                            : doc.status === "APPROVED"
                              ? "Đã duyệt"
                              : doc.status === "DRAFT"
                                ? "Nháp"
                                : doc.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!recentDocsList.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#64748b", padding: 20 }}>
                      Không có chứng từ phát sinh khớp bộ lọc trong kỳ.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Chân trang xác nhận nguồn dữ liệu chính thức (BR-RPT-DASH-03, BR-RPT-DASH-04) */}
      <div
        className="dashboard-bottom"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "#475569",
          padding: "8px 4px",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={15} style={{ color: "#0d9488" }} />
          {hasApiSession
            ? `Số liệu kế toán chính thức · Đã kết nối Sổ cái (GL) và các phân hệ nghiệp vụ · Cập nhật: ${
                overviewData?.data_as_of
                  ? new Date(overviewData.data_as_of).toLocaleString("vi-VN")
                  : "Vừa xong"
              }`
            : "Chế độ xem thử ngoại tuyến · Đăng nhập để kết nối Sổ cái chính thức"}
        </span>
        <span>Sổ Việt ERP · {circularFullLabel}</span>
      </div>

      {/* MODAL DRILL-DOWN TRUY VẾT CHỈ TIÊU KPI (MF-06, AF-06..AF-08, BR-RPT-DASH-60..63) */}
      {drilldownMetric && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Chi tiết chỉ tiêu ${drilldownMetric}`}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDrilldownMetric(null)}
        >
          <div
            className="card"
            style={{
              width: "min(860px, 95vw)",
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 15.5, color: "#0f172a" }}>
                  Truy vết chi tiết chỉ tiêu {drilldownMetric}{" "}
                  {drilldownData?.name || drilldownData?.metric_name
                    ? `— ${drilldownData.name || drilldownData.metric_name}`
                    : ""}
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Kỳ kế toán: {selectedPeriod} · Đồng bộ bộ lọc đơn vị và quyền truy cập Data Scope
                </span>
              </div>
              <button
                type="button"
                className="ref-icon"
                aria-label="Đóng cửa sổ truy vết"
                onClick={() => setDrilldownMetric(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
              {drilldownLoading ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Đang truy vết danh sách chứng từ nguồn…
                </div>
              ) : drilldownError ? (
                <div style={{ padding: 16, background: "#fef2f2", color: "#991b1b", borderRadius: 6 }}>
                  {drilldownError}
                </div>
              ) : drilldownData ? (
                <>
                  <div
                    style={{
                      padding: 12,
                      background: "#f8fafc",
                      borderRadius: 8,
                      marginBottom: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 12, color: "#64748b", display: "block" }}>
                        Tổng giá trị khớp chỉ tiêu trên Dashboard
                      </span>
                      <strong style={{ fontSize: 18, color: "#0f172a" }}>
                        {drilldownMetric === "DASH-04"
                          ? `${drilldownData.total_value ?? 0} chứng từ`
                          : fmtMoney(drilldownData.total_value ?? 0)}
                      </strong>
                    </div>
                    {(drilldownData.drilldown?.target_route || drilldownData.target_report_url) && (
                      <button
                        type="button"
                        className="ref-button teal"
                        onClick={() => {
                          const rawTarget =
                            drilldownData.drilldown?.target_route || drilldownData.target_report_url || "/reports";
                          const target = String(rawTarget).split("?")[0];
                          setDrilldownMetric(null);
                          navigate(href(target));
                        }}
                      >
                        Mở màn hình / báo cáo gốc →
                      </button>
                    )}
                  </div>

                  <table className="ref-overview-table" style={{ width: "100%", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Số chứng từ / Mã</th>
                        <th>Phân hệ</th>
                        <th>Ngày hạch toán</th>
                        <th>Đối tác / Diễn giải</th>
                        <th className="numeric">Giá trị</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(drilldownData.items || drilldownData.records || []).map((rec: any, idx: number) => (
                        <tr key={rec.document_id || rec.task_id || rec.partner_id || rec.bucket_key || idx}>
                          <td>
                            <strong>
                              {rec.document_number ||
                                rec.document_no ||
                                rec.partner_code ||
                                rec.item_code ||
                                rec.label ||
                                "—"}
                            </strong>
                          </td>
                          <td>{rec.module || rec.document_type || drilldownMetric}</td>
                          <td>{rec.posting_date || rec.document_date || rec.due_date || rec.start_date || "—"}</td>
                          <td>
                            {rec.party_name ||
                              rec.partner_name ||
                              rec.item_name ||
                              rec.title ||
                              rec.description ||
                              "—"}
                          </td>
                          <td className="numeric" style={{ fontWeight: 600 }}>
                            {fmtMoney(
                              rec.pre_tax_amount ??
                                rec.net_amount ??
                                rec.amount ??
                                rec.open_amount ??
                                rec.total_value ??
                                rec.net_cash_flow ??
                                rec.profit ??
                                0,
                            )}
                          </td>
                        </tr>
                      ))}
                      {!(drilldownData.items || drilldownData.records || []).length && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: 16 }}>
                            Không có dòng chứng từ chi tiết trong kỳ này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MisaDashboardOverview;
