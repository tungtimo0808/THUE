import { exportVisibleTable, printVisibleTable } from "./table-actions";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApiSession } from "./ApiSession";
import { clearLiveApiGetCache, request } from "./live-api";
import { MisaSelect } from "./MisaFormControls";
import {
  resolveActiveDatasetBookType,
  resolveActiveDatasetYear,
} from "./transaction-period";
import {
  HelpCircle,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  LineChart,
  RefreshCw,
  Edit3,
  Plus,
  Eye,
  Trash2,
  Printer,
  Bot,
  Layers,
  ArrowLeft,
  Save,
  Download,
  Sparkles,
} from "lucide-react";
import "./misa-budget.css";

export type CompanyInfo = {
  id: string;
  name: string;
  short?: string;
};

export type MisaBudgetWorkspaceProps = {
  company: CompanyInfo;
  period: string;
  tab?: string;
  href: (path: string, extra?: Record<string, string>) => string;
  notify?: (msg: string) => void;
};

type MatrixKey = "rev511" | "rev515" | "cost632" | "cost641" | "cost642";
type MatrixTargets = Record<MatrixKey, number[]>;

interface BudgetPlanSummary {
  key: string;
  code: string;
  date: string;
  description: string;
  year: number;
  periodType: string;
  branchId: string; // "" for whole company
  unitLabel: string;
  totalRevenue: number; // Triệu đồng
  totalCost: number; // Triệu đồng
  totalProfit: number; // Triệu đồng
  status: string;
  matrix: MatrixTargets;
  lineIds: string[];
  isDraftOnly?: boolean;
}

const ZERO_12 = () => Array.from({ length: 12 }, () => 0);

function emptyMatrix(): MatrixTargets {
  return {
    rev511: ZERO_12(),
    rev515: ZERO_12(),
    cost632: ZERO_12(),
    cost641: ZERO_12(),
    cost642: ZERO_12(),
  };
}

function roundMillion(vndAmount: number): number {
  return Math.round((vndAmount / 1_000_000) * 10) / 10;
}

function fmtMillion(val: number): string {
  if (!Number.isFinite(val) || Math.abs(val) < 0.05) return "0";
  return val.toLocaleString("vi-VN", {
    minimumFractionDigits: Number.isInteger(val) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

async function fetchAllPages(path: string, token: string): Promise<any[]> {
  let nextPath: string | null = path.includes("page_size=")
    ? path
    : `${path}${path.includes("?") ? "&" : "?"}page_size=200`;
  const out: any[] = [];
  let pages = 0;
  while (nextPath && pages < 30) {
    const res: any = await request<any>(nextPath, token);
    if (Array.isArray(res)) {
      out.push(...res);
      break;
    }
    if (Array.isArray(res?.results)) {
      out.push(...res.results);
    }
    if (!res?.next) break;
    const u = new URL(res.next, window.location.origin);
    nextPath = `${u.pathname}${u.search}`;
    pages += 1;
  }
  return out;
}

function classifyAccountToBucket(
  code: string,
  has641Account: boolean,
): { key: MatrixKey; sign: "credit" | "debit" } | null {
  if (!code) return null;
  if (code.startsWith("511")) return { key: "rev511", sign: "credit" };
  if (code.startsWith("521")) return { key: "rev511", sign: "debit" }; // khoản giảm trừ doanh thu
  if (code.startsWith("515") || code.startsWith("711")) {
    return { key: "rev515", sign: "credit" };
  }
  if (code.startsWith("632")) return { key: "cost632", sign: "debit" };
  if (code.startsWith("641")) return { key: "cost641", sign: "debit" };
  if (!has641Account && code.startsWith("6421")) {
    return { key: "cost641", sign: "debit" }; // TT133: 6421 = Chi phí bán hàng
  }
  if (
    code.startsWith("642") ||
    code.startsWith("635") ||
    code.startsWith("811")
  ) {
    return { key: "cost642", sign: "debit" };
  }
  return null;
}

// Semicircle Half Gauge Component
function SemicircleGauge({
  percent = 0,
  color = "var(--brand)",
  size = 180,
}: {
  percent: number;
  color?: string;
  size?: number;
}) {
  const cx = 90;
  const cy = 82;
  const r = 58;
  const strokeWidth = 14;

  const tickAngleRad = (60 * Math.PI) / 180;
  const tickX1 = cx + (r - strokeWidth / 2 - 1) * Math.cos(tickAngleRad);
  const tickY1 = cy - (r - strokeWidth / 2 - 1) * Math.sin(tickAngleRad);
  const tickX2 = cx + (r + strokeWidth / 2 + 5) * Math.cos(tickAngleRad);
  const tickY2 = cy - (r + strokeWidth / 2 + 5) * Math.sin(tickAngleRad);
  const label100X = cx + (r + 17) * Math.cos(tickAngleRad);
  const label100Y = cy - (r + 17) * Math.sin(tickAngleRad);

  const clamped = Math.min(Math.max(percent, 0), 150);
  const frac = clamped / 150;
  const currentAngleDeg = Math.max(0.5, 180 - frac * 180);
  const currentAngleRad = (currentAngleDeg * Math.PI) / 180;
  const activeEndX = cx + r * Math.cos(currentAngleRad);
  const activeEndY = cy - r * Math.sin(currentAngleRad);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * 0.65,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg
        viewBox="0 0 180 115"
        width={size}
        height={size * 0.64}
        style={{ overflow: "visible" }}
      >
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <line
          x1={tickX1}
          y1={tickY1}
          x2={tickX2}
          y2={tickY2}
          stroke="#94a3b8"
          strokeWidth={2}
        />
        <text
          x={label100X}
          y={label100Y + 3}
          textAnchor="middle"
          fontSize="10"
          fill="#64748b"
          fontWeight="500"
        >
          100%
        </text>
        {clamped > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${activeEndX} ${activeEndY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        <text
          x={cx - r - 2}
          y={cy + 22}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
          fontWeight="500"
        >
          0%
        </text>
        <text
          x={cx + r + 4}
          y={cy + 22}
          textAnchor="middle"
          fontSize="11"
          fill="#64748b"
          fontWeight="500"
        >
          150%
        </text>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="21"
          fontWeight="700"
          fill="#1e293b"
        >
          {Math.round(percent)}%
        </text>
      </svg>
    </div>
  );
}

// Comparison Bar Chart Component (supports Month / Quarter / Year granularity)
function MonthlyComparisonChart({
  title,
  unit = "Triệu đồng",
  actualColor = "var(--brand)",
  planColor = "#94a3b8",
  actualLabel = "Thực hiện",
  planLabel = "Kế hoạch",
  monthlyValues,
  yearLabel,
  lastUpdated,
  onRefresh,
}: {
  title: string;
  unit?: string;
  actualColor?: string;
  planColor?: string;
  actualLabel?: string;
  planLabel?: string;
  monthlyValues: { month: number; plan: number; actual: number }[];
  yearLabel: number;
  lastUpdated: string;
  onRefresh: () => void;
}) {
  const [granularity, setGranularity] = useState<"month" | "quarter" | "year">(
    "month",
  );

  const buckets = useMemo(() => {
    const base =
      monthlyValues.length === 12
        ? monthlyValues
        : Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            plan: 0,
            actual: 0,
          }));
    if (granularity === "quarter") {
      return [1, 2, 3, 4].map((q) => {
        const slice = base.slice((q - 1) * 3, q * 3);
        return {
          key: `Q${q}`,
          label: `Quý ${q}`,
          plan: Math.round(slice.reduce((s, x) => s + x.plan, 0) * 10) / 10,
          actual: Math.round(slice.reduce((s, x) => s + x.actual, 0) * 10) / 10,
        };
      });
    }
    if (granularity === "year") {
      return [
        {
          key: String(yearLabel),
          label: `Năm ${yearLabel}`,
          plan: Math.round(base.reduce((s, x) => s + x.plan, 0) * 10) / 10,
          actual: Math.round(base.reduce((s, x) => s + x.actual, 0) * 10) / 10,
        },
      ];
    }
    return base.map((item) => ({
      key: String(item.month),
      label: String(item.month),
      plan: item.plan,
      actual: item.actual,
    }));
  }, [monthlyValues, granularity, yearLabel]);

  const maxVal = Math.max(
    ...buckets.map((m) => Math.max(Math.abs(m.plan), Math.abs(m.actual))),
    1,
  );

  return (
    <div className="misa-budget-card">
      <div className="misa-budget-card-header">
        <h4 className="misa-budget-card-title">{title}</h4>
        <div className="misa-budget-chart-header-right">
          <MisaSelect
            ariaLabel={`Kỳ hiển thị ${title}`}
            style={{ width: "auto", minWidth: 112, height: 28, padding: "0 12px", fontSize: 12, justifyContent: "center", gap: 6 }}
            value={granularity}
            onChange={(val) =>
              setGranularity(val as "month" | "quarter" | "year")
            }
            options={[
              { value: "month", label: "Theo tháng" },
              { value: "quarter", label: "Theo quý" },
              { value: "year", label: "Theo năm" },
            ]}
          />
          <span className="misa-budget-card-unit">Đvt: {unit}</span>
        </div>
      </div>

      <div className="misa-budget-card-body" style={{ flexDirection: "column" }}>
        <div className="misa-budget-bar-canvas">
          {buckets.map((item) => {
            const planHeight =
              item.plan > 0 ? Math.max(4, (item.plan / maxVal) * 62) : 0;
            const actualHeight =
              item.actual > 0 ? Math.max(4, (item.actual / maxVal) * 62) : 0;
            const displayVal =
              item.actual !== 0
                ? fmtMillion(item.actual)
                : item.plan !== 0
                  ? fmtMillion(item.plan)
                  : "0";

            return (
              <div key={item.key} className="misa-budget-month-col">
                <span className="misa-budget-month-val">{displayVal}</span>
                <div className="misa-budget-bars-pair">
                  <div
                    className="misa-budget-bar"
                    style={{
                      height: `${planHeight}px`,
                      width: granularity === "month" ? 8 : 18,
                      backgroundColor: planColor,
                    }}
                    title={`${planLabel} (${item.label}): ${fmtMillion(item.plan)} ${unit}`}
                  />
                  <div
                    className="misa-budget-bar"
                    style={{
                      height: `${actualHeight}px`,
                      width: granularity === "month" ? 8 : 18,
                      backgroundColor: actualColor,
                    }}
                    title={`${actualLabel} (${item.label}): ${fmtMillion(item.actual)} ${unit}`}
                  />
                </div>
                <span className="misa-budget-month-label">{item.label}</span>
              </div>
            );
          })}
        </div>

        <div className="misa-budget-legend">
          <div className="misa-budget-legend-item">
            <span
              style={{
                width: 10,
                height: 10,
                backgroundColor: planColor,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span>{planLabel}</span>
          </div>
          <div className="misa-budget-legend-item">
            <span
              style={{
                width: 10,
                height: 10,
                backgroundColor: actualColor,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span>{actualLabel}</span>
          </div>
        </div>
      </div>

      <div className="misa-budget-card-footer">
        <RefreshCw size={12} color="#64748b" />
        <span>Số liệu tính đến: {lastUpdated}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="misa-budget-refresh-link"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          Tải lại
        </button>
      </div>
    </div>
  );
}

// Unit / Branch Revenue Comparison Chart
function UnitComparisonChart({
  title,
  unit = "Triệu đồng",
  actualColor = "var(--brand)",
  planColor = "#94a3b8",
  unitRows,
  scope,
  onScopeChange,
  lastUpdated,
  onRefresh,
}: {
  title: string;
  unit?: string;
  actualColor?: string;
  planColor?: string;
  unitRows: { id: string; name: string; plan: number; actual: number }[];
  scope: "year" | "last_year" | "quarter";
  onScopeChange: (val: "year" | "last_year" | "quarter") => void;
  lastUpdated: string;
  onRefresh: () => void;
}) {
  const hasAnyValue = unitRows.some((r) => r.plan > 0 || r.actual > 0);
  const maxVal = Math.max(
    ...unitRows.map((r) => Math.max(r.plan, r.actual)),
    1,
  );

  return (
    <div className="misa-budget-card">
      <div className="misa-budget-card-header">
        <h4 className="misa-budget-card-title">{title}</h4>
        <div className="misa-budget-chart-header-right">
          <MisaSelect
            ariaLabel={`Kỳ so sánh ${title}`}
            style={{ width: "auto", minWidth: 112, height: 28, padding: "0 12px", fontSize: 12, justifyContent: "center", gap: 6 }}
            value={scope}
            onChange={(val) =>
              onScopeChange(val as "year" | "last_year" | "quarter")
            }
            options={[
              { value: "year", label: "Năm nay" },
              { value: "last_year", label: "Năm trước" },
              { value: "quarter", label: "Quý này" },
            ]}
          />
          <span className="misa-budget-card-unit">Đvt: {unit}</span>
        </div>
      </div>

      <div
        className="misa-budget-card-body"
        style={{
          flexDirection: "column",
          minHeight: 140,
          justifyContent: "center",
        }}
      >
        {hasAnyValue ? (
          <div className="misa-budget-bar-canvas" style={{ gap: 12 }}>
            {unitRows.map((item) => {
              const planH =
                item.plan > 0 ? Math.max(4, (item.plan / maxVal) * 62) : 0;
              const actualH =
                item.actual > 0 ? Math.max(4, (item.actual / maxVal) * 62) : 0;
              return (
                <div key={item.id} className="misa-budget-month-col">
                  <span className="misa-budget-month-val">
                    {fmtMillion(item.actual || item.plan)}
                  </span>
                  <div className="misa-budget-bars-pair" style={{ gap: 4 }}>
                    <div
                      className="misa-budget-bar"
                      style={{
                        width: 16,
                        height: `${planH}px`,
                        backgroundColor: planColor,
                      }}
                      title={`Kế hoạch (${item.name}): ${fmtMillion(item.plan)} ${unit}`}
                    />
                    <div
                      className="misa-budget-bar"
                      style={{
                        width: 16,
                        height: `${actualH}px`,
                        backgroundColor: actualColor,
                      }}
                      title={`Thực hiện (${item.name}): ${fmtMillion(item.actual)} ${unit}`}
                    />
                  </div>
                  <span
                    className="misa-budget-month-label"
                    style={{
                      maxWidth: 110,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: 13,
            }}
          >
            Chưa có số liệu phát sinh theo đơn vị trong kỳ này
          </div>
        )}
        <div className="misa-budget-legend">
          <div className="misa-budget-legend-item">
            <span
              style={{
                width: 10,
                height: 10,
                backgroundColor: planColor,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span>Kế hoạch</span>
          </div>
          <div className="misa-budget-legend-item">
            <span
              style={{
                width: 10,
                height: 10,
                backgroundColor: actualColor,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            <span>Thực hiện</span>
          </div>
        </div>
      </div>

      <div className="misa-budget-card-footer">
        <RefreshCw size={12} color="#64748b" />
        <span>Số liệu tính đến: {lastUpdated}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="misa-budget-refresh-link"
          style={{ background: "none", border: "none", padding: 0 }}
        >
          Tải lại
        </button>
      </div>
    </div>
  );
}

const REPORT_DEFINITIONS = [
  {
    id: "plan",
    vi: "Kế hoạch ngân sách",
    en: "Annual Budget Plan",
    col: 1,
  },
  {
    id: "execution",
    vi: "Tình hình thực hiện ngân sách",
    en: "Budget Execution Summary",
    col: 1,
  },
  {
    id: "revenue_vs_plan",
    vi: "Tình hình thực hiện doanh thu so với kế hoạch",
    en: "Actual vs Planned Revenue",
    col: 2,
  },
  {
    id: "cost_vs_plan",
    vi: "Tình hình chi phí thực tế so với kế hoạch",
    en: "Actual vs Planned Operating Cost",
    col: 2,
  },
];

export default function MisaBudgetWorkspace({
  company,
  tab = "charts",
  href,
  notify,
}: MisaBudgetWorkspaceProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token } = useApiSession();
  const defaultYear = useMemo(() => resolveActiveDatasetYear(), []);

  const currentTab = useMemo(() => {
    if (tab === "planning" || tab === "plan") return "planning";
    if (tab === "reports" || tab === "report") return "reports";
    return "charts";
  }, [tab]);

  // Live backend state
  const [branches, setBranches] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [budgetLines, setBudgetLines] = useState<any[]>([]);
  const [postedJournals, setPostedJournals] = useState<any[]>([]);
  const [bookType, setBookType] = useState<string>(() =>
    resolveActiveDatasetBookType(),
  );
  const [savingPlan, setSavingPlan] = useState(false);

  // Filters
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [revScope, setRevScope] = useState<"year" | "last_year" | "quarter">(
    "year",
  );
  const [costScope, setCostScope] = useState<"year" | "last_year" | "quarter">(
    "year",
  );
  const [profitScope, setProfitScope] = useState<
    "year" | "last_year" | "quarter"
  >("year");
  const [unitScope, setUnitScope] = useState<"year" | "last_year" | "quarter">(
    "year",
  );
  const [lastUpdated, setLastUpdated] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

  // Tab 2 Planning View State
  const [planningViewMode, setPlanningViewMode] = useState<
    "landing" | "list" | "editor"
  >("landing");
  const [planSearch, setPlanSearch] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] =
    useState<boolean>(false);
  const [draftPlans, setDraftPlans] = useState<BudgetPlanSummary[]>([]);

  // Modal "Chọn kỳ lập kế hoạch" (defaults to selectedYear when logged in, or defaultYear + 1 offline)
  const initialPlanYear = token ? defaultYear : defaultYear + 1;
  const [modalYear, setModalYear] = useState<number>(initialPlanYear);
  const [modalFromDate, setModalFromDate] = useState<string>(
    `01/01/${initialPlanYear}`,
  );
  const [modalToDate, setModalToDate] = useState<string>(
    `31/12/${initialPlanYear}`,
  );
  const [modalPeriodType, setModalPeriodType] = useState<string>("Tháng");
  const [modalDetailByUnit, setModalDetailByUnit] = useState<boolean>(false);
  const [modalBranchId, setModalBranchId] = useState<string>("ALL");

  // Active editor state
  const [editingYear, setEditingYear] = useState<number>(initialPlanYear);
  const [editingBranchId, setEditingBranchId] = useState<string>("ALL");
  const [editingPeriodType, setEditingPeriodType] = useState<string>("Tháng");
  const [editingCode, setEditingCode] = useState<string>(
    `KHNS001/${initialPlanYear}`,
  );

  const openCreatePlanModal = useCallback(() => {
    const targetYr = token ? selectedYear : defaultYear + 1;
    setModalYear(targetYr);
    setModalFromDate(`01/01/${targetYr}`);
    setModalToDate(`31/12/${targetYr}`);
    if (selectedBranchId && selectedBranchId !== "ALL") {
      setModalDetailByUnit(true);
      setModalBranchId(selectedBranchId);
    } else {
      setModalDetailByUnit(false);
      setModalBranchId("ALL");
    }
    setIsCreateModalOpen(true);
  }, [token, selectedYear, defaultYear, selectedBranchId]);
  const [matrixTargets, setMatrixTargets] = useState<MatrixTargets>(() => ({
    rev511: [1500, 1600, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 3000],
    rev515: [50, 50, 60, 60, 70, 70, 80, 80, 90, 90, 100, 100],
    cost632: [900, 950, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1600],
    cost641: [200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 320],
    cost642: [150, 150, 160, 160, 170, 170, 180, 180, 190, 190, 200, 200],
  }));

  // Settings Modal form values
  const [settingsStartDate, setSettingsStartDate] = useState<string>(() => {
    try {
      return (
        localStorage.getItem(`budget_fiscal_start_${company?.id}`) || "01/01"
      );
    } catch {
      return "01/01";
    }
  });
  const [settingsApplyYear, setSettingsApplyYear] =
    useState<number>(defaultYear);

  // Tab 3 Reports State
  const [reportSearch, setReportSearch] = useState<string>("");
  const [reportLang, setReportLang] = useState<string>("Tiếng Việt");
  const [favoriteReports, setFavoriteReports] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenReportIds, setHiddenReportIds] = useState<Set<string>>(
    new Set(),
  );
  const [showHideReportsModal, setShowHideReportsModal] = useState(false);
  const [selectedReportPreview, setSelectedReportPreview] = useState<
    string | null
  >(null);

  const loadLiveBudgetData = useCallback(async () => {
    if (!token || !company?.id) return;
    const cid = encodeURIComponent(company.id);
    const [brRes, prRes, accRes, bgRes, jrRes] = await Promise.allSettled([
      fetchAllPages(`/api/v1/organization/branches/?company_id=${cid}`, token),
      fetchAllPages(`/api/v1/general-ledger/periods/?company_id=${cid}`, token),
      fetchAllPages(`/api/v1/general-ledger/accounts/?company_id=${cid}`, token),
      fetchAllPages(`/api/v1/general-ledger/budgets/?company_id=${cid}`, token),
      fetchAllPages(
        `/api/v1/general-ledger/journals/?company_id=${cid}&status=POSTED`,
        token,
      ),
    ]);
    if (brRes.status === "fulfilled") {
      setBranches(
        brRes.value.filter((b: any) => !b.status || b.status === "ACTIVE"),
      );
    }
    if (prRes.status === "fulfilled") setPeriods(prRes.value);
    if (accRes.status === "fulfilled") setAccounts(accRes.value);
    if (bgRes.status === "fulfilled") setBudgetLines(bgRes.value);
    if (jrRes.status === "fulfilled") setPostedJournals(jrRes.value);
    const now = new Date();
    setLastUpdated(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
  }, [token, company?.id]);

  useEffect(() => {
    void loadLiveBudgetData();
  }, [loadLiveBudgetData]);

  useEffect(() => {
    const onCtxChange = () => {
      setBookType(resolveActiveDatasetBookType());
      setSelectedYear(resolveActiveDatasetYear());
      const storedBranch = localStorage.getItem("ref_branch") || "all";
      setSelectedBranchId(
        storedBranch && storedBranch !== "all" ? storedBranch : "ALL",
      );
    };
    window.addEventListener("erp_context_changed", onCtxChange);
    return () => window.removeEventListener("erp_context_changed", onCtxChange);
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "settings") {
      setIsSettingsModalOpen(true);
    } else if (action === "create") {
      openCreatePlanModal();
    }
  }, [searchParams, openCreatePlanModal]);

  const has641Account = useMemo(
    () => accounts.some((a: any) => String(a.code || "").startsWith("641")),
    [accounts],
  );

  const unitLabelFor = useCallback(
    (branchId: string) => {
      if (!branchId || branchId === "ALL") {
        return company?.name ? `Toàn doanh nghiệp (${company.name})` : "Toàn doanh nghiệp";
      }
      const found = branches.find((b: any) => String(b.id) === branchId);
      return found ? `${found.code} — ${found.name}` : branchId;
    },
    [branches, company?.name],
  );

  // Build persisted BudgetPlanSummary list from real BudgetLine records
  const persistedPlans = useMemo<BudgetPlanSummary[]>(() => {
    const periodById = new Map<string, any>();
    for (const p of periods) periodById.set(String(p.id), p);
    const accountById = new Map<string, any>();
    for (const a of accounts) accountById.set(String(a.id), a);

    const groups = new Map<string, BudgetPlanSummary>();
    for (const line of budgetLines) {
      const periodObj = periodById.get(String(line.period));
      const pCode = String(line.period_code || periodObj?.code || "");
      const year =
        Number(periodObj?.fiscal_year) ||
        Number(pCode.slice(0, 4)) ||
        defaultYear;
      const month =
        Number(periodObj?.period_number) ||
        Number(pCode.slice(5, 7)) ||
        1;
      if (month < 1 || month > 12) continue;

      const branchId = line.branch ? String(line.branch) : "ALL";
      const key = `${year}::${branchId}`;
      const accCode = String(
        line.account_code || accountById.get(String(line.account))?.code || "",
      );
      const cls = classifyAccountToBucket(accCode, has641Account);
      if (!cls) continue;

      if (!groups.has(key)) {
        const noteParts = String(line.notes || "").split("|").map((s) => s.trim());
        const customCode = noteParts[0]?.startsWith("KHNS")
          ? noteParts[0]
          : `KHNS001/${year}`;
        const customPeriodType = noteParts[1] || "Tháng";
        groups.set(key, {
          key,
          code: customCode,
          date: `01/01/${year}`,
          description:
            noteParts[2] ||
            `Kế hoạch ngân sách sản xuất kinh doanh năm ${year}`,
          year,
          periodType: customPeriodType,
          branchId: branchId === "ALL" ? "" : branchId,
          unitLabel: unitLabelFor(branchId),
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          status: "Đang theo dõi",
          matrix: emptyMatrix(),
          lineIds: [],
        });
      }
      const grp = groups.get(key)!;
      grp.lineIds.push(String(line.id));
      grp.matrix[cls.key][month - 1] = roundMillion(
        grp.matrix[cls.key][month - 1] * 1_000_000 + Number(line.amount || 0),
      );
    }

    const list = Array.from(groups.values()).map((grp) => {
      const rev =
        grp.matrix.rev511.reduce((a, b) => a + b, 0) +
        grp.matrix.rev515.reduce((a, b) => a + b, 0);
      const cost =
        grp.matrix.cost632.reduce((a, b) => a + b, 0) +
        grp.matrix.cost641.reduce((a, b) => a + b, 0) +
        grp.matrix.cost642.reduce((a, b) => a + b, 0);
      return {
        ...grp,
        totalRevenue: Math.round(rev * 10) / 10,
        totalCost: Math.round(cost * 10) / 10,
        totalProfit: Math.round((rev - cost) * 10) / 10,
      };
    });
    return list.sort((a, b) => b.year - a.year);
  }, [budgetLines, periods, accounts, has641Account, unitLabelFor, defaultYear]);

  const allBudgetPlans = useMemo(() => {
    const persistedKeys = new Set(persistedPlans.map((p) => p.key));
    const combined = [
      ...draftPlans.filter((d) => !persistedKeys.has(d.key)),
      ...persistedPlans,
    ];
    const q = planSearch.trim().toLowerCase();
    if (!q) return combined;
    return combined.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.unitLabel.toLowerCase().includes(q) ||
        String(p.year).includes(q),
    );
  }, [persistedPlans, draftPlans, planSearch]);

  useEffect(() => {
    if (persistedPlans.length > 0 && planningViewMode === "landing") {
      setPlanningViewMode("list");
    }
  }, [persistedPlans.length, planningViewMode]);

  // Compute 12-month Actuals matrix (in Triệu đồng) for any (year, branchFilter)
  const computeActualMatrix = useCallback(
    (year: number, branchFilter: string): MatrixTargets => {
      const mat = emptyMatrix();
      const vndBuckets: Record<MatrixKey, number[]> = {
        rev511: ZERO_12(),
        rev515: ZERO_12(),
        cost632: ZERO_12(),
        cost641: ZERO_12(),
        cost642: ZERO_12(),
      };

      for (const entry of postedJournals) {
        const statusUpper = String(entry.status || "").toUpperCase();
        if (statusUpper !== "POSTED") continue;
        const eType = String(entry.entry_type || "").toUpperCase();
        if (eType === "CLOSING" || eType === "OPENING") continue;
        const docNum = String(entry.number || "").toUpperCase();
        if (bookType === "accounting" && docNum.startsWith("QT-")) continue;

        if (branchFilter && branchFilter !== "ALL") {
          if (String(entry.branch || "") !== branchFilter) continue;
        }

        const pDate = String(entry.posting_date || "");
        const mMatch = pDate.match(/^(\d{4})-(\d{2})/);
        if (!mMatch || Number(mMatch[1]) !== year) continue;
        const mIdx = Number(mMatch[2]) - 1;
        if (mIdx < 0 || mIdx > 11) continue;

        for (const line of entry.lines || []) {
          const code = String(line.account_code || "");
          const cls = classifyAccountToBucket(code, has641Account);
          if (!cls) continue;
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          if (code.startsWith("521")) {
            // Khoản giảm trừ doanh thu làm giảm 511
            vndBuckets.rev511[mIdx] -= debit - credit;
          } else if (cls.sign === "credit") {
            vndBuckets[cls.key][mIdx] += credit - debit;
          } else {
            vndBuckets[cls.key][mIdx] += debit - credit;
          }
        }
      }

      for (const k of Object.keys(vndBuckets) as MatrixKey[]) {
        mat[k] = vndBuckets[k].map((val) => roundMillion(Math.max(0, val)));
      }
      return mat;
    },
    [postedJournals, bookType, has641Account],
  );

  // Compute 12-month Planned matrix (in Triệu đồng) for any (year, branchFilter)
  const computePlanMatrix = useCallback(
    (year: number, branchFilter: string): MatrixTargets => {
      const mat = emptyMatrix();
      const matching = [...persistedPlans, ...draftPlans].filter((p) => {
        if (p.year !== year) return false;
        if (!branchFilter || branchFilter === "ALL") return true;
        return p.branchId === branchFilter;
      });
      // Deduplicate by key (persisted wins over draft)
      const seen = new Set<string>();
      for (const plan of matching) {
        if (seen.has(plan.key)) continue;
        seen.add(plan.key);
        for (const k of Object.keys(mat) as MatrixKey[]) {
          for (let i = 0; i < 12; i += 1) {
            mat[k][i] = Math.round((mat[k][i] + plan.matrix[k][i]) * 10) / 10;
          }
        }
      }
      return mat;
    },
    [persistedPlans, draftPlans],
  );

  // Helper for gauge metrics according to scope ("year" | "last_year" | "quarter")
  const computeScopedTotals = useCallback(
    (scope: "year" | "last_year" | "quarter") => {
      const targetYear = scope === "last_year" ? selectedYear - 1 : selectedYear;
      const actualMat = computeActualMatrix(targetYear, selectedBranchId);
      const planMat = computePlanMatrix(targetYear, selectedBranchId);
      const curQuarter = Math.floor(new Date().getMonth() / 3);
      const indices =
        scope === "quarter"
          ? [curQuarter * 3, curQuarter * 3 + 1, curQuarter * 3 + 2]
          : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

      const sumAt = (arr: number[]) =>
        indices.reduce((s, idx) => s + (arr[idx] || 0), 0);

      const actRev = sumAt(actualMat.rev511) + sumAt(actualMat.rev515);
      const plnRev = sumAt(planMat.rev511) + sumAt(planMat.rev515);
      const actCost =
        sumAt(actualMat.cost632) +
        sumAt(actualMat.cost641) +
        sumAt(actualMat.cost642);
      const plnCost =
        sumAt(planMat.cost632) +
        sumAt(planMat.cost641) +
        sumAt(planMat.cost642);
      const actProfit = actRev - actCost;
      const plnProfit = plnRev - plnCost;

      const pct = (act: number, pln: number) =>
        pln > 0 ? Math.round((act / pln) * 100) : 0;

      return {
        revenue: {
          actual: Math.round(actRev * 10) / 10,
          plan: Math.round(plnRev * 10) / 10,
          diff: Math.round((actRev - plnRev) * 10) / 10,
          percent: pct(actRev, plnRev),
        },
        cost: {
          actual: Math.round(actCost * 10) / 10,
          plan: Math.round(plnCost * 10) / 10,
          diff: Math.round((actCost - plnCost) * 10) / 10,
          percent: pct(actCost, plnCost),
        },
        profit: {
          actual: Math.round(actProfit * 10) / 10,
          plan: Math.round(plnProfit * 10) / 10,
          diff: Math.round((actProfit - plnProfit) * 10) / 10,
          percent: pct(actProfit, plnProfit),
        },
      };
    },
    [selectedYear, selectedBranchId, computeActualMatrix, computePlanMatrix],
  );

  const revGauge = useMemo(
    () => computeScopedTotals(revScope).revenue,
    [computeScopedTotals, revScope],
  );
  const costGauge = useMemo(
    () => computeScopedTotals(costScope).cost,
    [computeScopedTotals, costScope],
  );
  const profitGauge = useMemo(
    () => computeScopedTotals(profitScope).profit,
    [computeScopedTotals, profitScope],
  );

  // 12-month series for Charts 4, 5, 6
  const currentActualMatrix = useMemo(
    () => computeActualMatrix(selectedYear, selectedBranchId),
    [computeActualMatrix, selectedYear, selectedBranchId],
  );
  const currentPlanMatrix = useMemo(
    () => computePlanMatrix(selectedYear, selectedBranchId),
    [computePlanMatrix, selectedYear, selectedBranchId],
  );

  const monthlyRevenueSeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        plan:
          Math.round(
            (currentPlanMatrix.rev511[i] + currentPlanMatrix.rev515[i]) * 10,
          ) / 10,
        actual:
          Math.round(
            (currentActualMatrix.rev511[i] + currentActualMatrix.rev515[i]) *
              10,
          ) / 10,
      })),
    [currentPlanMatrix, currentActualMatrix],
  );

  const monthlyCostSeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        plan:
          Math.round(
            (currentPlanMatrix.cost632[i] +
              currentPlanMatrix.cost641[i] +
              currentPlanMatrix.cost642[i]) *
              10,
          ) / 10,
        actual:
          Math.round(
            (currentActualMatrix.cost632[i] +
              currentActualMatrix.cost641[i] +
              currentActualMatrix.cost642[i]) *
              10,
          ) / 10,
      })),
    [currentPlanMatrix, currentActualMatrix],
  );

  const monthlyProfitSeries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        plan:
          Math.round(
            (monthlyRevenueSeries[i].plan - monthlyCostSeries[i].plan) * 10,
          ) / 10,
        actual:
          Math.round(
            (monthlyRevenueSeries[i].actual - monthlyCostSeries[i].actual) * 10,
          ) / 10,
      })),
    [monthlyRevenueSeries, monthlyCostSeries],
  );

  // Branch comparison rows for Card 7
  const unitComparisonRows = useMemo(() => {
    const targetYear =
      unitScope === "last_year" ? selectedYear - 1 : selectedYear;
    const curQuarter = Math.floor(new Date().getMonth() / 3);
    const indices =
      unitScope === "quarter"
        ? [curQuarter * 3, curQuarter * 3 + 1, curQuarter * 3 + 2]
        : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const sumAt = (arr: number[]) =>
      indices.reduce((s, idx) => s + (arr[idx] || 0), 0);

    if (!branches.length) {
      const aMat = computeActualMatrix(targetYear, "ALL");
      const pMat = computePlanMatrix(targetYear, "ALL");
      return [
        {
          id: "ALL",
          name: company?.short || company?.name || "Toàn đơn vị",
          plan: Math.round((sumAt(pMat.rev511) + sumAt(pMat.rev515)) * 10) / 10,
          actual:
            Math.round((sumAt(aMat.rev511) + sumAt(aMat.rev515)) * 10) / 10,
        },
      ];
    }

    return branches.map((br: any) => {
      const brId = String(br.id);
      const aMat = computeActualMatrix(targetYear, brId);
      const pMat = persistedPlans.find(
        (p) => p.year === targetYear && p.branchId === brId,
      )?.matrix || emptyMatrix();
      return {
        id: brId,
        name: String(br.name || br.code || "Chi nhánh"),
        plan: Math.round((sumAt(pMat.rev511) + sumAt(pMat.rev515)) * 10) / 10,
        actual: Math.round((sumAt(aMat.rev511) + sumAt(aMat.rev515)) * 10) / 10,
      };
    });
  }, [
    branches,
    unitScope,
    selectedYear,
    computeActualMatrix,
    computePlanMatrix,
    persistedPlans,
    company,
  ]);

  const handleRefreshData = () => {
    void loadLiveBudgetData();
    notify?.("Đã đồng bộ số liệu ngân sách và thực tế Sổ cái mới nhất.");
  };

  const toggleFavorite = (reportName: string) => {
    setFavoriteReports((prev) => {
      const next = new Set(prev);
      if (next.has(reportName)) next.delete(reportName);
      else next.add(reportName);
      return next;
    });
  };

  const openPlanInEditor = (plan: BudgetPlanSummary) => {
    setEditingYear(plan.year);
    setEditingBranchId(plan.branchId || "ALL");
    setEditingPeriodType(plan.periodType || "Tháng");
    setEditingCode(plan.code);
    setMatrixTargets({
      rev511: [...plan.matrix.rev511],
      rev515: [...plan.matrix.rev515],
      cost632: [...plan.matrix.cost632],
      cost641: [...plan.matrix.cost641],
      cost642: [...plan.matrix.cost642],
    });
    setPlanningViewMode("editor");
  };

  const handleModalSubmit = () => {
    setIsCreateModalOpen(false);
    const targetBranch = modalDetailByUnit ? modalBranchId : "ALL";
    const key = `${modalYear}::${targetBranch}`;
    const existing = persistedPlans.find((p) => p.key === key);
    const nextCode =
      existing?.code ||
      `KHNS00${persistedPlans.length + draftPlans.length + 1}/${modalYear}`;

    let initialMat: MatrixTargets;
    if (existing) {
      initialMat = {
        rev511: [...existing.matrix.rev511],
        rev515: [...existing.matrix.rev515],
        cost632: [...existing.matrix.cost632],
        cost641: [...existing.matrix.cost641],
        cost642: [...existing.matrix.cost642],
      };
    } else {
      const refActual = computeActualMatrix(selectedYear, targetBranch);
      const hasActual = Object.values(refActual).some((arr) =>
        arr.some((v) => v > 0),
      );
      if (hasActual) {
        initialMat = {
          rev511: refActual.rev511.map((v) => Math.round(v * 1.1 * 10) / 10),
          rev515: refActual.rev515.map((v) => Math.round(v * 1.05 * 10) / 10),
          cost632: refActual.cost632.map((v) => Math.round(v * 1.05 * 10) / 10),
          cost641: refActual.cost641.map((v) => Math.round(v * 1.05 * 10) / 10),
          cost642: refActual.cost642.map((v) => Math.round(v * 1.05 * 10) / 10),
        };
      } else {
        initialMat = {
          rev511: [1500, 1600, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 3000],
          rev515: [50, 50, 60, 60, 70, 70, 80, 80, 90, 90, 100, 100],
          cost632: [900, 950, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1600],
          cost641: [200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 320],
          cost642: [150, 150, 160, 160, 170, 170, 180, 180, 190, 190, 200, 200],
        };
      }
    }

    setEditingYear(modalYear);
    setEditingBranchId(targetBranch);
    setEditingPeriodType(modalPeriodType);
    setEditingCode(nextCode);
    setMatrixTargets(initialMat);

    const revSum =
      initialMat.rev511.reduce((a, b) => a + b, 0) +
      initialMat.rev515.reduce((a, b) => a + b, 0);
    const costSum =
      initialMat.cost632.reduce((a, b) => a + b, 0) +
      initialMat.cost641.reduce((a, b) => a + b, 0) +
      initialMat.cost642.reduce((a, b) => a + b, 0);

    if (!existing) {
      const draft: BudgetPlanSummary = {
        key,
        code: nextCode,
        date: modalFromDate,
        description: `Kế hoạch ngân sách năm ${modalYear} (${modalPeriodType})`,
        year: modalYear,
        periodType: modalPeriodType,
        branchId: targetBranch === "ALL" ? "" : targetBranch,
        unitLabel: unitLabelFor(targetBranch),
        totalRevenue: Math.round(revSum * 10) / 10,
        totalCost: Math.round(costSum * 10) / 10,
        totalProfit: Math.round((revSum - costSum) * 10) / 10,
        status: "Bản nháp (Chưa lưu)",
        matrix: initialMat,
        lineIds: [],
        isDraftOnly: true,
      };
      setDraftPlans((prev) => [draft, ...prev.filter((d) => d.key !== key)]);
    }

    setPlanningViewMode("editor");
    if (currentTab !== "planning") {
      navigate(href("/budget/planning"));
    }
    notify?.(`Đã khởi tạo kỳ lập kế hoạch ${nextCode}.`);
  };

  const resolveAccountForBucket = (bucket: MatrixKey): any | undefined => {
    const postable = accounts.filter(
      (a: any) => (!a.status || a.status === "ACTIVE") && a.is_postable,
    );
    const pick = (prefixes: string[]) => {
      for (const p of prefixes) {
        const exact = postable.find((a: any) => String(a.code) === p);
        if (exact) return exact;
        const starts = postable
          .filter((a: any) => String(a.code).startsWith(p))
          .sort((a: any, b: any) =>
            String(a.code).localeCompare(String(b.code)),
          )[0];
        if (starts) return starts;
      }
      return undefined;
    };
    if (bucket === "rev511") return pick(["5111", "511"]);
    if (bucket === "rev515") return pick(["515"]);
    if (bucket === "cost632") return pick(["632"]);
    if (bucket === "cost641") return pick(["641", "6421"]);
    return pick(["6422", "642"]);
  };

  const handlePersistBudgetPlan = async () => {
    // Update local draft summary first so offline / mocked tests work seamlessly
    const revSum =
      matrixTargets.rev511.reduce((a, b) => a + b, 0) +
      matrixTargets.rev515.reduce((a, b) => a + b, 0);
    const costSum =
      matrixTargets.cost632.reduce((a, b) => a + b, 0) +
      matrixTargets.cost641.reduce((a, b) => a + b, 0) +
      matrixTargets.cost642.reduce((a, b) => a + b, 0);
    const key = `${editingYear}::${editingBranchId}`;
    const updatedDraft: BudgetPlanSummary = {
      key,
      code: editingCode,
      date: `01/01/${editingYear}`,
      description: `Kế hoạch ngân sách năm ${editingYear} (${editingPeriodType})`,
      year: editingYear,
      periodType: editingPeriodType,
      branchId: editingBranchId === "ALL" ? "" : editingBranchId,
      unitLabel: unitLabelFor(editingBranchId),
      totalRevenue: Math.round(revSum * 10) / 10,
      totalCost: Math.round(costSum * 10) / 10,
      totalProfit: Math.round((revSum - costSum) * 10) / 10,
      status: "Đang theo dõi",
      matrix: matrixTargets,
      lineIds: [],
    };

    if (!token || !company?.id || !accounts.length) {
      setDraftPlans((prev) => [
        updatedDraft,
        ...prev.filter((d) => d.key !== key),
      ]);
      notify?.("Đã lưu kế hoạch ngân sách thành công.");
      setPlanningViewMode("list");
      return;
    }

    setSavingPlan(true);
    try {
      const cid = encodeURIComponent(company.id);
      // 1. Ensure 12 monthly AccountingPeriod records exist for editingYear
      const periodMap = new Map<number, any>();
      for (const p of periods) {
        const y = Number(p.fiscal_year) || Number(String(p.code || "").slice(0, 4));
        const m = Number(p.period_number) || Number(String(p.code || "").slice(5, 7));
        if (y === editingYear && m >= 1 && m <= 12) {
          periodMap.set(m, p);
        }
      }
      for (let m = 1; m <= 12; m += 1) {
        if (!periodMap.has(m)) {
          const mm = String(m).padStart(2, "0");
          const lastDay = new Date(editingYear, m, 0).getDate();
          const created = await request<any>(
            `/api/v1/general-ledger/periods/?company_id=${cid}`,
            token,
            {
              method: "POST",
              body: JSON.stringify({
                company: company.id,
                code: `${editingYear}-${mm}`,
                fiscal_year: editingYear,
                period_number: m,
                start_date: `${editingYear}-${mm}-01`,
                end_date: `${editingYear}-${mm}-${String(lastDay).padStart(2, "0")}`,
                status: "OPEN",
              }),
            },
          );
          periodMap.set(m, created);
        }
      }

      // 2. Map existing BudgetLines for (editingYear, editingBranchId)
      const branchUuid = editingBranchId === "ALL" ? null : editingBranchId;
      const existingLines = budgetLines.filter((l: any) => {
        const lBranch = l.branch ? String(l.branch) : null;
        return lBranch === branchUuid;
      });

      const noteMeta = `${editingCode} | ${editingPeriodType} | Kế hoạch ngân sách năm ${editingYear}`;
      const buckets: MatrixKey[] = [
        "rev511",
        "rev515",
        "cost632",
        "cost641",
        "cost642",
      ];

      for (const bucket of buckets) {
        const account = resolveAccountForBucket(bucket);
        if (!account) continue;
        for (let m = 1; m <= 12; m += 1) {
          const periodObj = periodMap.get(m);
          if (!periodObj?.id) continue;
          const valMillion = Number(matrixTargets[bucket][m - 1] || 0);
          const vndAmount = Math.round(valMillion * 1_000_000);
          const matchLine = existingLines.find(
            (l: any) =>
              String(l.period) === String(periodObj.id) &&
              String(l.account) === String(account.id),
          );
          if (vndAmount > 0) {
            if (matchLine) {
              await request(
                `/api/v1/general-ledger/budgets/${matchLine.id}/?company_id=${cid}`,
                token,
                {
                  method: "PATCH",
                  body: JSON.stringify({
                    amount: String(vndAmount),
                    notes: noteMeta,
                  }),
                },
              );
            } else {
              await request(
                `/api/v1/general-ledger/budgets/?company_id=${cid}`,
                token,
                {
                  method: "POST",
                  body: JSON.stringify({
                    company: company.id,
                    period: periodObj.id,
                    account: account.id,
                    branch: branchUuid,
                    amount: String(vndAmount),
                    allow_negative: false,
                    notes: noteMeta,
                  }),
                },
              );
            }
          } else if (matchLine) {
            await request(
              `/api/v1/general-ledger/budgets/${matchLine.id}/?company_id=${cid}`,
              token,
              { method: "DELETE" },
            );
          }
        }
      }

      setDraftPlans((prev) => prev.filter((d) => d.key !== key));
      clearLiveApiGetCache();
      await loadLiveBudgetData();
      setSelectedYear(editingYear);
      notify?.(`Đã lưu kế hoạch ngân sách ${editingCode} lên hệ thống.`);
      setPlanningViewMode("list");
    } catch (err) {
      notify?.(
        err instanceof Error
          ? `Không lưu được kế hoạch: ${err.message}`
          : "Không lưu được kế hoạch ngân sách.",
      );
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (plan: BudgetPlanSummary) => {
    if (plan.isDraftOnly || !plan.lineIds.length || !token || !company?.id) {
      setDraftPlans((prev) => prev.filter((d) => d.key !== plan.key));
      notify?.(`Đã xóa kế hoạch ${plan.code}.`);
      return;
    }
    const cid = encodeURIComponent(company.id);
    const deletedSet = new Set(plan.lineIds.map((id) => String(id)));
    try {
      await Promise.all(
        plan.lineIds.map((id) =>
          request(
            `/api/v1/general-ledger/budgets/${id}/?company_id=${cid}`,
            token,
            { method: "DELETE" },
          ),
        ),
      );
      setDraftPlans((prev) => prev.filter((d) => d.key !== plan.key));
      setBudgetLines((prev) =>
        prev.filter((l: any) => !deletedSet.has(String(l.id))),
      );
      clearLiveApiGetCache();
      await loadLiveBudgetData();
      notify?.(`Đã xóa kế hoạch ${plan.code} khỏi hệ thống.`);
    } catch (err) {
      notify?.(
        err instanceof Error ? err.message : "Không thể xóa kế hoạch ngân sách.",
      );
    }
  };

  const handleSuggestFromActuals = () => {
    const refAct = computeActualMatrix(selectedYear, editingBranchId);
    const hasAny = Object.values(refAct).some((arr) => arr.some((v) => v > 0));
    if (!hasAny) {
      notify?.(
        `Sổ cái năm ${selectedYear} chưa có số phát sinh doanh thu/chi phí để gợi ý.`,
      );
      return;
    }
    setMatrixTargets({
      rev511: refAct.rev511.map((v) => Math.round(v * 1.1 * 10) / 10),
      rev515: refAct.rev515.map((v) => Math.round(v * 1.05 * 10) / 10),
      cost632: refAct.cost632.map((v) => Math.round(v * 1.05 * 10) / 10),
      cost641: refAct.cost641.map((v) => Math.round(v * 1.05 * 10) / 10),
      cost642: refAct.cost642.map((v) => Math.round(v * 1.05 * 10) / 10),
    });
    notify?.(
      `Đã điền dự toán từ thực tế Sổ cái năm ${selectedYear} (+10% mục tiêu doanh thu).`,
    );
  };

  const updateMatrixCell = (key: MatrixKey, monthIdx: number, raw: string) => {
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.-]/g, "");
    const num = cleaned === "" || cleaned === "-" ? 0 : Number(cleaned);
    setMatrixTargets((prev) => ({
      ...prev,
      [key]: prev[key].map((v, idx) =>
        idx === monthIdx ? (Number.isFinite(num) ? num : 0) : v,
      ),
    }));
  };

  const handleSaveSettings = () => {
    try {
      if (company?.id) {
        localStorage.setItem(
          `budget_fiscal_start_${company.id}`,
          settingsStartDate,
        );
      }
    } catch {
      /* ignore storage errors */
    }
    setIsSettingsModalOpen(false);
    if (searchParams.get("action") === "settings") {
      const p = new URLSearchParams(searchParams);
      p.delete("action");
      setSearchParams(p);
    }
    notify?.(
      `Đã thiết lập ngày bắt đầu năm ngân sách: ${settingsStartDate} (Áp dụng từ năm ${settingsApplyYear}).`,
    );
  };

  // Report figures for selectedReportPreview
  const reportRows = useMemo(() => {
    const sum = (arr: number[]) =>
      Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10;
    const p511 = sum(currentPlanMatrix.rev511);
    const a511 = sum(currentActualMatrix.rev511);
    const p515 = sum(currentPlanMatrix.rev515);
    const a515 = sum(currentActualMatrix.rev515);
    const p632 = sum(currentPlanMatrix.cost632);
    const a632 = sum(currentActualMatrix.cost632);
    const p6412 = sum(currentPlanMatrix.cost641) + sum(currentPlanMatrix.cost642);
    const a6412 =
      sum(currentActualMatrix.cost641) + sum(currentActualMatrix.cost642);

    const pRev = Math.round((p511 + p515) * 10) / 10;
    const aRev = Math.round((a511 + a515) * 10) / 10;
    const pCost = Math.round((p632 + p6412) * 10) / 10;
    const aCost = Math.round((a632 + a6412) * 10) / 10;
    const pProfit = Math.round((pRev - pCost) * 10) / 10;
    const aProfit = Math.round((aRev - aCost) * 10) / 10;
    const rate = (act: number, pln: number) =>
      pln > 0 ? `${Math.round((act / pln) * 100)}%` : "—";

    return {
      p511,
      a511,
      r511: rate(a511, p511),
      p515,
      a515,
      r515: rate(a515, p515),
      p632,
      a632,
      r632: rate(a632, p632),
      p6412,
      a6412,
      r6412: rate(a6412, p6412),
      pRev,
      aRev,
      rRev: rate(aRev, pRev),
      pCost,
      aCost,
      rCost: rate(aCost, pCost),
      pProfit,
      aProfit,
      rProfit: rate(aProfit, pProfit),
    };
  }, [currentPlanMatrix, currentActualMatrix]);

  const visibleReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    return REPORT_DEFINITIONS.filter((r) => {
      if (hiddenReportIds.has(r.id)) return false;
      if (!q) return true;
      return r.vi.toLowerCase().includes(q) || r.en.toLowerCase().includes(q);
    });
  }, [reportSearch, hiddenReportIds]);

  const isEn = reportLang === "English";

  return (
    <div className="misa-budget-container">
      {/* ========================================================= */}
      {/* TAB 1: BIỂU ĐỒ (CHARTS)                                   */}
      {/* ========================================================= */}
      {currentTab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div className="misa-budget-charts-bar">
            <div className="misa-budget-filters-group">
              <div className="misa-budget-filter-item">
                <span>Đơn vị</span>
                <MisaSelect
                  ariaLabel="Đơn vị ngân sách"
                  style={{ width: 290, height: 32 }}
                  value={selectedBranchId}
                  onChange={(val) => setSelectedBranchId(val)}
                  options={[
                    {
                      value: "ALL",
                      label: company?.name
                        ? `Toàn doanh nghiệp — ${company.name}`
                        : "Toàn doanh nghiệp",
                    },
                    ...branches.map((br: any) => ({
                      value: String(br.id),
                      label: `${br.code} — ${br.name}`,
                    })),
                  ]}
                />
              </div>

              <div className="misa-budget-filter-item">
                <span>Năm</span>
                <div className="misa-budget-year-stepper">
                  <input
                    type="text"
                    className="misa-budget-year-input"
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(Number(e.target.value) || defaultYear)
                    }
                  />
                  <div className="misa-budget-stepper-btns">
                    <button
                      type="button"
                      className="misa-budget-stepper-btn"
                      onClick={() => setSelectedYear((y) => y + 1)}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="misa-budget-stepper-btn"
                      onClick={() => setSelectedYear((y) => y - 1)}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                className="misa-budget-btn-custom"
                onClick={openCreatePlanModal}
              >
                <Plus size={14} />
                <span>Lập kế hoạch</span>
              </button>
              <button
                type="button"
                className="misa-budget-btn-custom"
                onClick={() => setIsSettingsModalOpen(true)}
              >
                <Edit3 size={14} />
                <span>Tùy chỉnh</span>
              </button>
            </div>
          </div>

          <div className="misa-budget-charts-grid">
            {/* ROW 1: 3 Semicircle Gauges */}
            <div className="misa-budget-row-gauges">
              {/* Card 1: Doanh thu */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">
                    Tình hình thực hiện doanh thu
                  </h4>
                  <div className="misa-budget-chart-header-right">
                    <MisaSelect
                      ariaLabel="Kỳ doanh thu"
                      style={{ width: "auto", minWidth: 112, height: 28, padding: "0 12px", fontSize: 12, justifyContent: "center", gap: 6 }}
                      value={revScope}
                      onChange={(val) =>
                        setRevScope(val as "year" | "last_year" | "quarter")
                      }
                      options={[
                        { value: "year", label: "Năm nay" },
                        { value: "last_year", label: "Năm trước" },
                        { value: "quarter", label: "Quý này" },
                      ]}
                    />
                    <span className="misa-budget-card-unit">
                      Đvt: Triệu đồng
                    </span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge
                        percent={revGauge.percent}
                        color="var(--brand)"
                        size={175}
                      />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "var(--brand)" }}
                          />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(revGauge.actual)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#334155" }}
                          />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(revGauge.plan)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#94a3b8" }}
                          />
                          <span>Chênh lệch</span>
                        </span>
                        <span
                          className="misa-budget-metric-val"
                          style={{
                            color: revGauge.diff < 0 ? "#dc2626" : "#0f172a",
                          }}
                        >
                          {fmtMillion(revGauge.diff)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="misa-budget-card-footer">
                  <RefreshCw size={12} color="#64748b" />
                  <span>Số liệu tính đến: {lastUpdated}</span>
                  <button
                    type="button"
                    onClick={handleRefreshData}
                    className="misa-budget-refresh-link"
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    Tải lại
                  </button>
                </div>
              </div>

              {/* Card 2: Chi phí */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">
                    Tình hình thực hiện chi phí
                  </h4>
                  <div className="misa-budget-chart-header-right">
                    <MisaSelect
                      ariaLabel="Kỳ chi phí"
                      style={{ width: "auto", minWidth: 112, height: 28, padding: "0 12px", fontSize: 12, justifyContent: "center", gap: 6 }}
                      value={costScope}
                      onChange={(val) =>
                        setCostScope(val as "year" | "last_year" | "quarter")
                      }
                      options={[
                        { value: "year", label: "Năm nay" },
                        { value: "last_year", label: "Năm trước" },
                        { value: "quarter", label: "Quý này" },
                      ]}
                    />
                    <span className="misa-budget-card-unit">
                      Đvt: Triệu đồng
                    </span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge
                        percent={costGauge.percent}
                        color="var(--brand)"
                        size={175}
                      />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "var(--brand)" }}
                          />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(costGauge.actual)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#334155" }}
                          />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(costGauge.plan)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#94a3b8" }}
                          />
                          <span>Chênh lệch</span>
                        </span>
                        <span
                          className="misa-budget-metric-val"
                          style={{
                            color:
                              costGauge.plan > 0 && costGauge.diff > 0
                                ? "#dc2626"
                                : "#0f172a",
                          }}
                        >
                          {fmtMillion(costGauge.diff)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="misa-budget-card-footer">
                  <RefreshCw size={12} color="#64748b" />
                  <span>Số liệu tính đến: {lastUpdated}</span>
                  <button
                    type="button"
                    onClick={handleRefreshData}
                    className="misa-budget-refresh-link"
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    Tải lại
                  </button>
                </div>
              </div>

              {/* Card 3: Lợi nhuận */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">
                    Tình hình thực hiện lợi nhuận
                  </h4>
                  <div className="misa-budget-chart-header-right">
                    <MisaSelect
                      ariaLabel="Kỳ lợi nhuận"
                      style={{ width: "auto", minWidth: 112, height: 28, padding: "0 12px", fontSize: 12, justifyContent: "center", gap: 6 }}
                      value={profitScope}
                      onChange={(val) =>
                        setProfitScope(val as "year" | "last_year" | "quarter")
                      }
                      options={[
                        { value: "year", label: "Năm nay" },
                        { value: "last_year", label: "Năm trước" },
                        { value: "quarter", label: "Quý này" },
                      ]}
                    />
                    <span className="misa-budget-card-unit">
                      Đvt: Triệu đồng
                    </span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge
                        percent={profitGauge.percent}
                        color="#0d9488"
                        size={175}
                      />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#0d9488" }}
                          />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(profitGauge.actual)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#334155" }}
                          />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">
                          {fmtMillion(profitGauge.plan)}
                        </span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span
                            className="misa-budget-metric-badge"
                            style={{ backgroundColor: "#94a3b8" }}
                          />
                          <span>Chênh lệch</span>
                        </span>
                        <span
                          className="misa-budget-metric-val"
                          style={{
                            color: profitGauge.diff < 0 ? "#dc2626" : "#0f172a",
                          }}
                        >
                          {fmtMillion(profitGauge.diff)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="misa-budget-card-footer">
                  <RefreshCw size={12} color="#64748b" />
                  <span>Số liệu tính đến: {lastUpdated}</span>
                  <button
                    type="button"
                    onClick={handleRefreshData}
                    className="misa-budget-refresh-link"
                    style={{ background: "none", border: "none", padding: 0 }}
                  >
                    Tải lại
                  </button>
                </div>
              </div>
            </div>

            {/* ROW 2: Doanh thu & Chi phí 12 tháng */}
            <div className="misa-budget-row-charts">
              <MonthlyComparisonChart
                title="Doanh thu thực hiện so với kế hoạch"
                actualColor="var(--brand)"
                planColor="#94a3b8"
                monthlyValues={monthlyRevenueSeries}
                yearLabel={selectedYear}
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />

              <MonthlyComparisonChart
                title="Chi phí thực hiện so với kế hoạch"
                actualColor="var(--brand)"
                planColor="#94a3b8"
                monthlyValues={monthlyCostSeries}
                yearLabel={selectedYear}
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />
            </div>

            {/* ROW 3: Lợi nhuận & Theo đơn vị */}
            <div className="misa-budget-row-charts">
              <MonthlyComparisonChart
                title="Lợi nhuận thực hiện so với kế hoạch"
                actualColor="#0d9488"
                planColor="#94a3b8"
                monthlyValues={monthlyProfitSeries}
                yearLabel={selectedYear}
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />

              <UnitComparisonChart
                title="Tình hình thực hiện doanh thu theo đơn vị"
                actualColor="var(--brand)"
                planColor="#94a3b8"
                unitRows={unitComparisonRows}
                scope={unitScope}
                onScopeChange={setUnitScope}
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: KẾ HOẠCH NGÂN SÁCH                                 */}
      {/* ========================================================= */}
      {currentTab === "planning" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
          }}
        >
          {planningViewMode === "landing" && (
            <div className="misa-budget-landing-wrap">
              <div className="misa-budget-illustration">
                <svg width="180" height="150" viewBox="0 0 180 150" fill="none">
                  <ellipse
                    cx="90"
                    cy="138"
                    rx="60"
                    ry="8"
                    fill="#e2e8f0"
                    opacity="0.6"
                  />
                  <rect
                    x="52"
                    y="32"
                    width="68"
                    height="92"
                    rx="6"
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <path
                    d="M102 32 L120 50 L102 50 Z"
                    fill="var(--brand)"
                    opacity="0.15"
                  />
                  <path
                    d="M102 32 L102 50 L120 50"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <rect
                    x="62"
                    y="60"
                    width="34"
                    height="4"
                    rx="2"
                    fill="var(--brand)"
                  />
                  <rect
                    x="62"
                    y="72"
                    width="24"
                    height="4"
                    rx="2"
                    fill="var(--brand)"
                  />
                  <rect
                    x="62"
                    y="84"
                    width="30"
                    height="4"
                    rx="2"
                    fill="#cbd5e1"
                  />
                  <path
                    d="M 60 106 L 85 92 L 105 82 L 132 54"
                    fill="none"
                    stroke="var(--brand)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="85" cy="92" r="4.5" fill="var(--brand)" />
                  <circle cx="105" cy="82" r="4.5" fill="var(--brand)" />
                  <circle cx="132" cy="54" r="5" fill="var(--brand)" />
                  <circle cx="126" cy="100" r="16" fill="var(--brand)" />
                  <text
                    x="126"
                    y="106"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="16"
                    fontWeight="bold"
                  >
                    $
                  </text>
                </svg>
              </div>

              <h2 className="misa-budget-landing-title">
                Lập kế hoạch ngân sách để theo dõi tình hình doanh thu, chi phí,
                lợi nhuận thực tế so với kế hoạch
              </h2>

              <button
                type="button"
                className="misa-budget-btn-primary"
                onClick={openCreatePlanModal}
              >
                Thêm
              </button>

              <button
                type="button"
                className="misa-budget-landing-bottom-btn"
                onClick={() => setPlanningViewMode("list")}
              >
                Xem danh sách chứng từ{" "}
                {allBudgetPlans.length > 0 ? `(${allBudgetPlans.length})` : ""}
              </button>
            </div>
          )}

          {planningViewMode === "list" && (
            <div
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={() => setPlanningViewMode("landing")}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ArrowLeft size={14} />
                    <span>Quay lại giới thiệu</span>
                  </button>
                  <button
                    type="button"
                    className="misa-budget-btn-primary"
                    onClick={openCreatePlanModal}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      height: 34,
                      padding: "0 16px",
                    }}
                  >
                    <Plus size={14} />
                    <span>Thêm kế hoạch</span>
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="misa-budget-reports-search-box">
                    <Search
                      size={14}
                      className="misa-budget-reports-search-icon"
                    />
                    <input
                      type="text"
                      value={planSearch}
                      onChange={(e) => setPlanSearch(e.target.value)}
                      placeholder="Tìm theo số chứng từ, diễn giải, đơn vị..."
                    />
                  </div>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={() => void loadLiveBudgetData()}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={14} />
                    <span>Làm mới</span>
                  </button>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={async (event) => {
                      try {
                        await exportVisibleTable(
                          event.currentTarget,
                          "Đã xuất danh sách kế hoạch ngân sách",
                        );
                      } catch (cause) {
                        notify?.(
                          cause instanceof Error
                            ? cause.message
                            : "Không thực hiện được thao tác.",
                        );
                      }
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={14} />
                    <span>Xuất Excel</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f1f5f9",
                        color: "#334155",
                        fontWeight: 600,
                        borderBottom: "1px solid #cbd5e1",
                      }}
                    >
                      <th style={{ padding: "10px 14px" }}>Số chứng từ</th>
                      <th style={{ padding: "10px 14px" }}>Ngày chứng từ</th>
                      <th style={{ padding: "10px 14px" }}>Diễn giải</th>
                      <th style={{ padding: "10px 14px" }}>Năm</th>
                      <th style={{ padding: "10px 14px" }}>Kỳ lập</th>
                      <th style={{ padding: "10px 14px" }}>Đơn vị</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>
                        Tổng doanh thu (Tr.đ)
                      </th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>
                        Tổng chi phí (Tr.đ)
                      </th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>
                        Lợi nhuận (Tr.đ)
                      </th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>
                        Trạng thái
                      </th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBudgetPlans.map((plan) => (
                      <tr
                        key={plan.key}
                        style={{ borderBottom: "1px solid #f1f5f9" }}
                      >
                        <td
                          style={{
                            padding: "10px 14px",
                            fontWeight: 600,
                            color: "var(--brand)",
                            cursor: "pointer",
                          }}
                          onClick={() => openPlanInEditor(plan)}
                        >
                          {plan.code}
                        </td>
                        <td style={{ padding: "10px 14px" }}>{plan.date}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {plan.description}
                        </td>
                        <td style={{ padding: "10px 14px" }}>{plan.year}</td>
                        <td style={{ padding: "10px 14px" }}>
                          {plan.periodType}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {plan.unitLabel}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          {fmtMillion(plan.totalRevenue)}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          {fmtMillion(plan.totalCost)}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            textAlign: "right",
                            fontWeight: 700,
                            color: "var(--brand)",
                          }}
                        >
                          {fmtMillion(plan.totalProfit)}
                        </td>
                        <td
                          style={{ padding: "10px 14px", textAlign: "center" }}
                        >
                          <span
                            style={{
                              padding: "2px 8px",
                              background: plan.isDraftOnly
                                ? "#fef3c7"
                                : "#f0fdf4",
                              color: plan.isDraftOnly ? "#92400e" : "#166534",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {plan.status}
                          </span>
                        </td>
                        <td
                          style={{ padding: "10px 14px", textAlign: "center" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openPlanInEditor(plan)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "var(--brand)",
                                cursor: "pointer",
                                padding: 2,
                              }}
                              title="Xem / Sửa chi tiết"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeletePlan(plan)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: 2,
                              }}
                              title="Xóa kế hoạch"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!allBudgetPlans.length && (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            padding: "32px 16px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          Chưa có kế hoạch ngân sách nào được lập cho doanh
                          nghiệp này. Bấm <strong>Thêm kế hoạch</strong> để khởi
                          tạo dự toán 12 tháng.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Editor Mode: Bảng lập kế hoạch ngân sách chi tiết 12 tháng */}
          {planningViewMode === "editor" && (
            <div
              style={{
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={() => setPlanningViewMode("list")}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ArrowLeft size={14} />
                    <span>Danh sách kế hoạch</span>
                  </button>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Bảng kế hoạch ngân sách năm {editingYear} - Đơn vị:{" "}
                    {unitLabelFor(editingBranchId)} (Đvt: Triệu đồng)
                  </h3>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={handleSuggestFromActuals}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--brand)",
                      borderColor: "#bfdbfe",
                      background: "#eff6ff",
                    }}
                  >
                    <Sparkles size={14} />
                    <span>Gợi ý từ Sổ cái (+10%)</span>
                  </button>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={async (event) => {
                      try {
                        await exportVisibleTable(
                          event.currentTarget,
                          `Đã xuất bảng kế hoạch ngân sách năm ${editingYear}`,
                        );
                      } catch {
                        notify?.("Đã xuất mẫu kế hoạch ngân sách ra Excel.");
                      }
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={14} />
                    <span>Xuất Excel</span>
                  </button>
                  <button
                    type="button"
                    disabled={savingPlan}
                    className="misa-budget-btn-primary"
                    onClick={() => void handlePersistBudgetPlan()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      height: 34,
                      padding: "0 18px",
                    }}
                  >
                    <Save size={14} />
                    <span>{savingPlan ? "Đang lưu..." : "Lưu kế hoạch"}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  overflowX: "auto",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#f8fafc",
                        borderBottom: "2px solid #cbd5e1",
                        color: "#334155",
                      }}
                    >
                      <th
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          width: 260,
                          position: "sticky",
                          left: 0,
                          background: "#f8fafc",
                          zIndex: 1,
                        }}
                      >
                        Chỉ tiêu ngân sách
                      </th>
                      <th
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          width: 70,
                        }}
                      >
                        Mã TK
                      </th>
                      <th
                        style={{
                          padding: "8px 12px",
                          textAlign: "right",
                          width: 110,
                          background: "#f1f5f9",
                        }}
                      >
                        Tổng cả năm
                      </th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "8px 8px",
                            textAlign: "right",
                            minWidth: 86,
                          }}
                        >
                          Tháng {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Section I: Doanh thu */}
                    <tr
                      style={{
                        background: "#f0fdf4",
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          position: "sticky",
                          left: 0,
                          background: "#f0fdf4",
                        }}
                      >
                        I. TỔNG DOANH THU & THU NHẬP
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        01
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {fmtMillion(
                          matrixTargets.rev511.reduce((a, b) => a + b, 0) +
                            matrixTargets.rev515.reduce((a, b) => a + b, 0),
                        )}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => (
                        <td
                          key={i}
                          style={{ padding: "8px 8px", textAlign: "right" }}
                        >
                          {fmtMillion(
                            matrixTargets.rev511[i] + matrixTargets.rev515[i],
                          )}
                        </td>
                      ))}
                    </tr>

                    {(
                      [
                        [
                          "rev511",
                          "1. Doanh thu bán hàng và CCDV (511)",
                          "511",
                        ],
                        [
                          "rev515",
                          "2. Doanh thu hoạt động tài chính (515)",
                          "515",
                        ],
                      ] as [MatrixKey, string, string][]
                    ).map(([bKey, label, accCode]) => (
                      <tr key={bKey}>
                        <td
                          style={{
                            padding: "6px 12px 6px 24px",
                            position: "sticky",
                            left: 0,
                            background: "#ffffff",
                          }}
                        >
                          {label}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          {accCode}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            fontWeight: 600,
                            background: "#f8fafc",
                          }}
                        >
                          {fmtMillion(
                            matrixTargets[bKey].reduce((a, b) => a + b, 0),
                          )}
                        </td>
                        {matrixTargets[bKey].map((v, i) => (
                          <td
                            key={i}
                            style={{ padding: "4px 6px", textAlign: "right" }}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              aria-label={`${label} Tháng ${i + 1}`}
                              value={v === 0 ? "" : String(v)}
                              onChange={(e) =>
                                updateMatrixCell(bKey, i, e.target.value)
                              }
                              style={{
                                width: 74,
                                height: 26,
                                padding: "0 6px",
                                textAlign: "right",
                                border: "1px solid #e2e8f0",
                                borderRadius: 4,
                                fontSize: 12.5,
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Section II: Chi phí */}
                    <tr
                      style={{
                        background: "#fef2f2",
                        fontWeight: 700,
                        color: "#991b1b",
                      }}
                    >
                      <td
                        style={{
                          padding: "8px 12px",
                          position: "sticky",
                          left: 0,
                          background: "#fef2f2",
                        }}
                      >
                        II. TỔNG CHI PHÍ HOẠT ĐỘNG
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        10
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {fmtMillion(
                          matrixTargets.cost632.reduce((a, b) => a + b, 0) +
                            matrixTargets.cost641.reduce((a, b) => a + b, 0) +
                            matrixTargets.cost642.reduce((a, b) => a + b, 0),
                        )}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => (
                        <td
                          key={i}
                          style={{ padding: "8px 8px", textAlign: "right" }}
                        >
                          {fmtMillion(
                            matrixTargets.cost632[i] +
                              matrixTargets.cost641[i] +
                              matrixTargets.cost642[i],
                          )}
                        </td>
                      ))}
                    </tr>

                    {(
                      [
                        ["cost632", "1. Giá vốn hàng bán (632)", "632"],
                        [
                          "cost641",
                          has641Account
                            ? "2. Chi phí bán hàng (641)"
                            : "2. Chi phí bán hàng (6421)",
                          has641Account ? "641" : "6421",
                        ],
                        [
                          "cost642",
                          has641Account
                            ? "3. Chi phí quản lý doanh nghiệp (642)"
                            : "3. Chi phí quản lý doanh nghiệp (6422)",
                          has641Account ? "642" : "6422",
                        ],
                      ] as [MatrixKey, string, string][]
                    ).map(([bKey, label, accCode]) => (
                      <tr key={bKey}>
                        <td
                          style={{
                            padding: "6px 12px 6px 24px",
                            position: "sticky",
                            left: 0,
                            background: "#ffffff",
                          }}
                        >
                          {label}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          {accCode}
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "right",
                            fontWeight: 600,
                            background: "#f8fafc",
                          }}
                        >
                          {fmtMillion(
                            matrixTargets[bKey].reduce((a, b) => a + b, 0),
                          )}
                        </td>
                        {matrixTargets[bKey].map((v, i) => (
                          <td
                            key={i}
                            style={{ padding: "4px 6px", textAlign: "right" }}
                          >
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0"
                              aria-label={`${label} Tháng ${i + 1}`}
                              value={v === 0 ? "" : String(v)}
                              onChange={(e) =>
                                updateMatrixCell(bKey, i, e.target.value)
                              }
                              style={{
                                width: 74,
                                height: 26,
                                padding: "0 6px",
                                textAlign: "right",
                                border: "1px solid #e2e8f0",
                                borderRadius: 4,
                                fontSize: 12.5,
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/* Section III: Lợi nhuận dự kiến */}
                    <tr
                      style={{
                        background: "#f8fafc",
                        fontWeight: 700,
                        color: "#0f172a",
                        borderTop: "2px solid #cbd5e1",
                      }}
                    >
                      <td
                        style={{
                          padding: "9px 12px",
                          position: "sticky",
                          left: 0,
                          background: "#f8fafc",
                        }}
                      >
                        III. LỢI NHUẬN DỰ KIẾN (I - II)
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>
                        20
                      </td>
                      <td
                        style={{
                          padding: "9px 12px",
                          textAlign: "right",
                          color: "var(--brand)",
                          fontWeight: 700,
                        }}
                      >
                        {fmtMillion(
                          matrixTargets.rev511.reduce((a, b) => a + b, 0) +
                            matrixTargets.rev515.reduce((a, b) => a + b, 0) -
                            (matrixTargets.cost632.reduce((a, b) => a + b, 0) +
                              matrixTargets.cost641.reduce((a, b) => a + b, 0) +
                              matrixTargets.cost642.reduce((a, b) => a + b, 0)),
                        )}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mRev =
                          matrixTargets.rev511[i] + matrixTargets.rev515[i];
                        const mCost =
                          matrixTargets.cost632[i] +
                          matrixTargets.cost641[i] +
                          matrixTargets.cost642[i];
                        return (
                          <td
                            key={i}
                            style={{
                              padding: "9px 8px",
                              textAlign: "right",
                              color: "var(--brand)",
                              fontWeight: 600,
                            }}
                          >
                            {fmtMillion(mRev - mCost)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BÁO CÁO                                            */}
      {/* ========================================================= */}
      {currentTab === "reports" && (
        <div className="misa-budget-reports-wrap">
          <div className="misa-budget-reports-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className="misa-budget-reports-search-box">
                <Search size={14} className="misa-budget-reports-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm theo tên báo cáo"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="misa-budget-ava-ai-btn"
                onClick={() =>
                  setSelectedReportPreview("Tình hình thực hiện ngân sách")
                }
              >
                <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
                <span style={{ fontSize: 14 }}>
                  <Bot size={14} className="ui-inline-icon" aria-hidden="true" />
                </span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "#334155",
                }}
              >
                <span>Ngôn ngữ báo cáo</span>
                <MisaSelect
                  ariaLabel="Ngôn ngữ báo cáo"
                  style={{ width: 136, height: 32 }}
                  value={reportLang}
                  onChange={(val) => setReportLang(val)}
                  options={[
                    { value: "Tiếng Việt", label: "Tiếng Việt" },
                    { value: "English", label: "English" },
                  ]}
                />
              </div>

              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => setShowHideReportsModal((prev) => !prev)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Eye size={14} />
                <span>Ẩn/hiện báo cáo</span>
              </button>

              <button
                type="button"
                className="misa-budget-btn-secondary"
                style={{ width: 34, padding: 0, justifyContent: "center" }}
                title="Làm mới dữ liệu báo cáo"
                onClick={handleRefreshData}
              >
                <Layers size={14} />
              </button>
            </div>
          </div>

          {showHideReportsModal && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 16,
                padding: "10px 14px",
                marginTop: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {REPORT_DEFINITIONS.map((r) => (
                <label
                  key={r.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenReportIds.has(r.id)}
                    onChange={() =>
                      setHiddenReportIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      })
                    }
                  />
                  <span>{isEn ? r.en : r.vi}</span>
                </label>
              ))}
            </div>
          )}

          <div className="misa-budget-reports-grid">
            {[1, 2].map((colNum) => (
              <div key={colNum} className="misa-budget-reports-col">
                {visibleReports
                  .filter((r) => r.col === colNum)
                  .map((r) => {
                    const displayTitle = isEn ? r.en : r.vi;
                    return (
                      <div key={r.id} className="misa-budget-report-row">
                        <a
                          href={`#report-${r.id}`}
                          className="misa-budget-report-name"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedReportPreview(r.vi);
                          }}
                        >
                          {displayTitle}
                        </a>
                        <div className="misa-budget-report-actions">
                          <button
                            type="button"
                            className="misa-budget-report-icon-btn"
                            title="Xem báo cáo"
                            onClick={() => setSelectedReportPreview(r.vi)}
                          >
                            <LineChart size={16} />
                          </button>
                          <button
                            type="button"
                            className={`misa-budget-report-icon-btn ${favoriteReports.has(r.vi) ? "starred" : ""}`}
                            title="Đánh dấu ưa thích"
                            onClick={() => toggleFavorite(r.vi)}
                          >
                            <Star
                              size={16}
                              fill={
                                favoriteReports.has(r.vi) ? "#eab308" : "none"
                              }
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHỌN KỲ LẬP KẾ HOẠCH                               */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div
          className="misa-budget-modal-overlay"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="misa-budget-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">Chọn kỳ lập kế hoạch</h3>
              <div className="misa-budget-modal-header-actions">
                <button
                  type="button"
                  className="misa-budget-modal-icon-btn"
                  title="Hướng dẫn chọn kỳ kế hoạch"
                  onClick={() =>
                    notify?.(
                      "Kỳ lập kế hoạch có thể theo Tháng, Quý hoặc Năm áp dụng cho toàn doanh nghiệp hoặc từng chi nhánh.",
                    )
                  }
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  className="misa-budget-modal-icon-btn"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="misa-budget-modal-body">
              <div className="misa-budget-modal-row-grid">
                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">Năm</label>
                  <div
                    className="misa-budget-year-stepper"
                    style={{ height: 32 }}
                  >
                    <input
                      type="text"
                      className="misa-budget-year-input"
                      value={modalYear}
                      onChange={(e) => {
                        const y = Number(e.target.value) || defaultYear + 1;
                        setModalYear(y);
                        setModalFromDate(`01/01/${y}`);
                        setModalToDate(`31/12/${y}`);
                      }}
                      style={{ width: 56 }}
                    />
                    <div className="misa-budget-stepper-btns">
                      <button
                        type="button"
                        className="misa-budget-stepper-btn"
                        onClick={() => {
                          const nextY = modalYear + 1;
                          setModalYear(nextY);
                          setModalFromDate(`01/01/${nextY}`);
                          setModalToDate(`31/12/${nextY}`);
                        }}
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        type="button"
                        className="misa-budget-stepper-btn"
                        onClick={() => {
                          const prevY = modalYear - 1;
                          setModalYear(prevY);
                          setModalFromDate(`01/01/${prevY}`);
                          setModalToDate(`31/12/${prevY}`);
                        }}
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">Từ</label>
                  <div className="misa-budget-input-with-icon">
                    <input
                      type="text"
                      value={modalFromDate}
                      onChange={(e) => setModalFromDate(e.target.value)}
                    />
                    <Calendar size={14} className="misa-budget-input-icon" />
                  </div>
                </div>

                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">Đến</label>
                  <div className="misa-budget-input-with-icon">
                    <input
                      type="text"
                      value={modalToDate}
                      onChange={(e) => setModalToDate(e.target.value)}
                    />
                    <Calendar size={14} className="misa-budget-input-icon" />
                  </div>
                </div>

                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">
                    Lập kế hoạch theo{" "}
                    <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <MisaSelect
                    ariaLabel="Lập kế hoạch theo"
                    style={{ width: "100%", height: 34 }}
                    value={modalPeriodType}
                    onChange={(val) => setModalPeriodType(val)}
                    options={[
                      { value: "Tháng", label: "Tháng" },
                      { value: "Quý", label: "Quý" },
                      { value: "Năm", label: "Năm" },
                    ]}
                  />
                </div>
              </div>

              <label className="misa-budget-checkbox-label">
                <input
                  type="checkbox"
                  checked={modalDetailByUnit}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setModalDetailByUnit(checked);
                    if (checked && modalBranchId === "ALL" && branches[0]?.id) {
                      setModalBranchId(String(branches[0].id));
                    } else if (!checked) {
                      setModalBranchId("ALL");
                    }
                  }}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: "var(--brand)",
                    cursor: "pointer",
                  }}
                />
                <span>Kế hoạch ngân sách chi tiết theo đơn vị</span>
              </label>

              <div
                style={{
                  opacity: modalDetailByUnit ? 1 : 0.6,
                  pointerEvents: modalDetailByUnit ? "auto" : "none",
                }}
              >
                <MisaSelect
                  ariaLabel="Đơn vị lập kế hoạch"
                  style={{ width: "100%", height: 34 }}
                  value={modalDetailByUnit ? modalBranchId : "ALL"}
                  onChange={(val) => setModalBranchId(val)}
                  options={[
                    {
                      value: "ALL",
                      label: company?.name
                        ? `Toàn doanh nghiệp — ${company.name}`
                        : "Toàn doanh nghiệp",
                    },
                    ...branches.map((br: any) => ({
                      value: String(br.id),
                      label: `${br.code} — ${br.name}`,
                    })),
                  ]}
                />
              </div>
            </div>

            <div className="misa-budget-modal-footer">
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="misa-budget-btn-primary"
                onClick={handleModalSubmit}
                style={{ height: 34, padding: "0 22px" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: THIẾT LẬP NGÀY BẮT ĐẦU NĂM NGÂN SÁCH               */}
      {/* ========================================================= */}
      {isSettingsModalOpen && (
        <div
          className="misa-budget-modal-overlay"
          onClick={() => setIsSettingsModalOpen(false)}
        >
          <div
            className="misa-budget-modal"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">
                Thiết lập ngày bắt đầu năm ngân sách
              </h3>
              <button
                type="button"
                className="misa-budget-modal-icon-btn"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="misa-budget-modal-body">
              <div className="misa-budget-field-group">
                <label className="misa-budget-field-label">
                  Ngày bắt đầu năm ngân sách (dd/MM)
                </label>
                <div className="misa-budget-input-with-icon">
                  <input
                    type="text"
                    value={settingsStartDate}
                    onChange={(e) => setSettingsStartDate(e.target.value)}
                    placeholder="01/01"
                  />
                  <Calendar size={14} className="misa-budget-input-icon" />
                </div>
              </div>

              <div className="misa-budget-field-group">
                <label className="misa-budget-field-label">
                  Áp dụng từ năm
                </label>
                <input
                  type="number"
                  className="misa-budget-select"
                  value={settingsApplyYear}
                  onChange={(e) =>
                    setSettingsApplyYear(Number(e.target.value) || defaultYear)
                  }
                />
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  lineHeight: 1.5,
                  background: "#f8fafc",
                  padding: 10,
                  borderRadius: 4,
                  border: "1px solid #e2e8f0",
                }}
              >
                Hệ thống Sổ Việt ERP sẽ căn cứ ngày bắt đầu năm ngân sách để
                tính toán chu kỳ 12 tháng dự toán và đối soát dữ liệu thực tế từ
                Sổ cái.
              </div>
            </div>

            <div className="misa-budget-modal-footer">
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => setIsSettingsModalOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="misa-budget-btn-primary"
                onClick={handleSaveSettings}
                style={{ height: 34, padding: "0 22px" }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REPORT VIEWER / PREVIEW                            */}
      {/* ========================================================= */}
      {selectedReportPreview && (
        <div
          className="misa-budget-modal-overlay"
          onClick={() => setSelectedReportPreview(null)}
        >
          <div
            className="misa-budget-modal"
            style={{ maxWidth: 880 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">
                {selectedReportPreview}
              </h3>
              <button
                type="button"
                className="misa-budget-modal-icon-btn"
                onClick={() => setSelectedReportPreview(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="misa-budget-modal-body"
              style={{ maxHeight: 500, overflowY: "auto" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  fontSize: 13,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span style={{ color: "#64748b" }}>
                  Kỳ báo cáo:{" "}
                  <strong style={{ color: "#0f172a" }}>
                    Năm {selectedYear}
                  </strong>{" "}
                  | Đơn vị:{" "}
                  <strong style={{ color: "#0f172a" }}>
                    {unitLabelFor(selectedBranchId)}
                  </strong>
                </span>
                <span style={{ color: "#64748b" }}>
                  Đơn vị tính: <strong>Triệu đồng</strong>
                </span>
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f1f5f9",
                      borderBottom: "1px solid #cbd5e1",
                      color: "#334155",
                    }}
                  >
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Chỉ tiêu
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>
                      Mã TK
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>
                      Kế hoạch
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>
                      Thực hiện (Sổ cái)
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>
                      Chênh lệch
                    </th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>
                      Tỷ lệ (%)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReportPreview !==
                    "Tình hình chi phí thực tế so với kế hoạch" && (
                    <>
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td style={{ padding: "8px 12px" }}>
                          A. TỔNG THU HOẠT ĐỘNG (511 + 515)
                        </td>
                        <td
                          style={{ padding: "8px 12px", textAlign: "center" }}
                        >
                          01
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.pRev)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.aRev)}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            color:
                              reportRows.aRev - reportRows.pRev < 0
                                ? "#ef4444"
                                : "var(--brand)",
                          }}
                        >
                          {fmtMillion(reportRows.aRev - reportRows.pRev)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {reportRows.rRev}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 12px 6px 24px" }}>
                          1. Doanh thu bán hàng hóa, dịch vụ
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          511
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.p511)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a511)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a511 - reportRows.p511)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {reportRows.r511}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 12px 6px 24px" }}>
                          2. Doanh thu tài chính & thu nhập khác
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          515, 711
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.p515)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a515)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a515 - reportRows.p515)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {reportRows.r515}
                        </td>
                      </tr>
                    </>
                  )}

                  {selectedReportPreview !==
                    "Tình hình thực hiện doanh thu so với kế hoạch" && (
                    <>
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td style={{ padding: "8px 12px" }}>
                          B. TỔNG CHI PHÍ HOẠT ĐỘNG
                        </td>
                        <td
                          style={{ padding: "8px 12px", textAlign: "center" }}
                        >
                          10
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.pCost)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.aCost)}
                        </td>
                        <td
                          style={{
                            padding: "8px 12px",
                            textAlign: "right",
                            color:
                              reportRows.aCost - reportRows.pCost > 0
                                ? "#ef4444"
                                : "var(--brand)",
                          }}
                        >
                          {fmtMillion(reportRows.aCost - reportRows.pCost)}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {reportRows.rCost}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 12px 6px 24px" }}>
                          1. Giá vốn hàng bán
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          632
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.p632)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a632)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a632 - reportRows.p632)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {reportRows.r632}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "6px 12px 6px 24px" }}>
                          2. Chi phí bán hàng & quản lý doanh nghiệp
                        </td>
                        <td
                          style={{
                            padding: "6px 12px",
                            textAlign: "center",
                            color: "#64748b",
                          }}
                        >
                          {has641Account ? "641, 642" : "6421, 6422"}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.p6412)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a6412)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.a6412 - reportRows.p6412)}
                        </td>
                        <td style={{ padding: "6px 12px", textAlign: "right" }}>
                          {reportRows.r6412}
                        </td>
                      </tr>
                    </>
                  )}

                  {selectedReportPreview !==
                    "Tình hình thực hiện doanh thu so với kế hoạch" &&
                    selectedReportPreview !==
                      "Tình hình chi phí thực tế so với kế hoạch" && (
                      <tr
                        style={{
                          background: "#f0fdf4",
                          fontWeight: 700,
                          borderTop: "2px solid #cbd5e1",
                        }}
                      >
                        <td style={{ padding: "9px 12px", color: "#166534" }}>
                          C. LỢI NHUẬN TRƯỚC THUẾ (A - B)
                        </td>
                        <td
                          style={{ padding: "9px 12px", textAlign: "center" }}
                        >
                          20
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.pProfit)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right" }}>
                          {fmtMillion(reportRows.aProfit)}
                        </td>
                        <td
                          style={{
                            padding: "9px 12px",
                            textAlign: "right",
                            color:
                              reportRows.aProfit - reportRows.pProfit < 0
                                ? "#ef4444"
                                : "#166534",
                          }}
                        >
                          {fmtMillion(reportRows.aProfit - reportRows.pProfit)}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "right" }}>
                          {reportRows.rProfit}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            <div className="misa-budget-modal-footer">
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={async (event) => {
                  try {
                    await exportVisibleTable(
                      event.currentTarget,
                      "Đã xuất báo cáo ngân sách",
                    );
                  } catch (cause) {
                    notify?.(
                      cause instanceof Error
                        ? cause.message
                        : "Không thực hiện được thao tác.",
                    );
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={async (event) => {
                  try {
                    await printVisibleTable(
                      event.currentTarget,
                      selectedReportPreview,
                    );
                  } catch {
                    window.print();
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={14} />
                <span>In</span>
              </button>
              <button
                type="button"
                className="misa-budget-btn-primary"
                onClick={() => setSelectedReportPreview(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
