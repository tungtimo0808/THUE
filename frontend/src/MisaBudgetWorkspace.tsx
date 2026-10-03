import React, { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
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
  FileSpreadsheet,
  Printer,
  SlidersHorizontal,
  Bot,
  Layers,
  ArrowLeft,
  Check,
  Save,
  Download,
  Upload,
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

// Semicircle Half Gauge Component matching Screenshot 2
function SemicircleGauge({
  percent = 0,
  color = "#00a862",
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

  // 100% tick mark calculation:
  // Range is 0% to 150%, so 100% is at 2/3 of 180° = 120° from left (60° from right)
  const tickAngleRad = (60 * Math.PI) / 180;
  const tickX1 = cx + (r - strokeWidth / 2 - 1) * Math.cos(tickAngleRad);
  const tickY1 = cy - (r - strokeWidth / 2 - 1) * Math.sin(tickAngleRad);
  const tickX2 = cx + (r + strokeWidth / 2 + 5) * Math.cos(tickAngleRad);
  const tickY2 = cy - (r + strokeWidth / 2 + 5) * Math.sin(tickAngleRad);
  const label100X = cx + (r + 17) * Math.cos(tickAngleRad);
  const label100Y = cy - (r + 17) * Math.sin(tickAngleRad);

  // Active arc
  const clamped = Math.min(Math.max(percent, 0), 150);
  const frac = clamped / 150;
  const currentAngleDeg = 180 - frac * 180;
  const currentAngleRad = (currentAngleDeg * Math.PI) / 180;
  const activeEndX = cx + r * Math.cos(currentAngleRad);
  const activeEndY = cy - r * Math.sin(currentAngleRad);

  return (
    <div style={{ position: "relative", width: size, height: size * 0.65, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 180 115" width={size} height={size * 0.64} style={{ overflow: "visible" }}>
        {/* Background Grey Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* 100% Tick & Label */}
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

        {/* Progress Arc */}
        {clamped > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${activeEndX} ${activeEndY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* 0% Label at bottom left */}
        <text x={cx - r - 2} y={cy + 22} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">
          0%
        </text>

        {/* 150% Label at bottom right */}
        <text x={cx + r + 4} y={cy + 22} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="500">
          150%
        </text>

        {/* Center Percentage Display */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill="#1e293b"
        >
          {percent}%
        </text>
      </svg>
    </div>
  );
}

// 12-Month Comparison Bar Chart Component matching Screenshot 2
function MonthlyComparisonChart({
  title,
  unit = "Triệu đồng",
  actualColor = "#00a862",
  planColor = "#94a3b8",
  periodLabel = "Theo tháng",
  actualLabel = "Thực hiện",
  planLabel = "Kế hoạch",
  values,
  lastUpdated,
  onRefresh,
}: {
  title: string;
  unit?: string;
  actualColor?: string;
  planColor?: string;
  periodLabel?: string;
  actualLabel?: string;
  planLabel?: string;
  values?: { month: number; plan: number; actual: number }[];
  lastUpdated: string;
  onRefresh: () => void;
}) {
  const months = useMemo(() => {
    if (values && values.length === 12) return values;
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      plan: 0,
      actual: 0,
    }));
  }, [values]);

  const maxVal = Math.max(...months.map((m) => Math.max(m.plan, m.actual)), 1);

  return (
    <div className="misa-budget-card">
      <div className="misa-budget-card-header">
        <h4 className="misa-budget-card-title">{title}</h4>
        <div className="misa-budget-chart-header-right">
          <select className="misa-budget-select" style={{ height: 26, fontSize: 12 }}>
            <option value="month">{periodLabel}</option>
            <option value="quarter">Theo quý</option>
            <option value="year">Theo năm</option>
          </select>
          <span className="misa-budget-card-unit">Đvt: {unit}</span>
        </div>
      </div>

      <div className="misa-budget-card-body" style={{ flexDirection: "column" }}>
        {/* Bars Container with 12 months */}
        <div className="misa-budget-bar-canvas">
          {months.map((item) => {
            const planHeight = item.plan > 0 ? Math.max(4, (item.plan / maxVal) * 60) : 0;
            const actualHeight = item.actual > 0 ? Math.max(4, (item.actual / maxVal) * 60) : 0;
            const displayVal = item.actual > 0 ? item.actual : item.plan > 0 ? item.plan : 0;

            return (
              <div key={item.month} className="misa-budget-month-col">
                <span className="misa-budget-month-val">{displayVal}</span>
                <div className="misa-budget-bars-pair">
                  <div
                    className="misa-budget-bar"
                    style={{
                      height: `${planHeight}px`,
                      backgroundColor: planColor,
                    }}
                    title={`Kế hoạch: ${item.plan}`}
                  />
                  <div
                    className="misa-budget-bar"
                    style={{
                      height: `${actualHeight}px`,
                      backgroundColor: actualColor,
                    }}
                    title={`Thực hiện: ${item.actual}`}
                  />
                </div>
                <span className="misa-budget-month-label">{item.month}</span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
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

// Unit Comparison Chart
function UnitComparisonChart({
  title,
  unit = "Triệu đồng",
  actualColor = "#00a862",
  planColor = "#94a3b8",
  lastUpdated,
  onRefresh,
}: {
  title: string;
  unit?: string;
  actualColor?: string;
  planColor?: string;
  lastUpdated: string;
  onRefresh: () => void;
}) {
  return (
    <div className="misa-budget-card">
      <div className="misa-budget-card-header">
        <h4 className="misa-budget-card-title">{title}</h4>
        <div className="misa-budget-chart-header-right">
          <select className="misa-budget-select" style={{ height: 26, fontSize: 12 }}>
            <option value="year">Năm nay</option>
            <option value="last_year">Năm trước</option>
            <option value="quarter">Quý này</option>
          </select>
          <span className="misa-budget-card-unit">Đvt: {unit}</span>
        </div>
      </div>

      <div className="misa-budget-card-body" style={{ flexDirection: "column", minHeight: 140, justifyContent: "center", alignItems: "center" }}>
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
          Chưa có số liệu thực hiện theo đơn vị
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

export default function MisaBudgetWorkspace({
  company,
  period,
  tab = "charts",
  href,
  notify,
}: MisaBudgetWorkspaceProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active subtab: "charts" | "planning" | "reports"
  const currentTab = useMemo(() => {
    if (tab === "planning" || tab === "plan") return "planning";
    if (tab === "reports" || tab === "report") return "reports";
    return "charts";
  }, [tab]);

  // Tab 1 Filters
  const [selectedUnit, setSelectedUnit] = useState<string>("Tung");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [lastUpdated, setLastUpdated] = useState<string>("11:05");

  // Tab 2 Planning View State
  const [planningViewMode, setPlanningViewMode] = useState<"landing" | "list" | "editor">("landing");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Check URL query parameters for actions (e.g. ?action=settings from flyout)
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "settings") {
      setIsSettingsModalOpen(true);
    } else if (action === "create") {
      setIsCreateModalOpen(true);
    }
  }, [searchParams]);

  // Modal "Chọn kỳ lập kế hoạch" form values (Screenshot 4)
  const [modalYear, setModalYear] = useState<number>(2027);
  const [modalFromDate, setModalFromDate] = useState<string>("01/01/2027");
  const [modalToDate, setModalToDate] = useState<string>("31/12/2027");
  const [modalPeriodType, setModalPeriodType] = useState<string>("Tháng");
  const [modalDetailByUnit, setModalDetailByUnit] = useState<boolean>(false);
  const [modalUnit, setModalUnit] = useState<string>("Tung");

  // Settings Modal form values (Thiết lập ngày bắt đầu năm ngân sách)
  const [settingsStartDate, setSettingsStartDate] = useState<string>("01/01");
  const [settingsApplyYear, setSettingsApplyYear] = useState<number>(2026);

  // Tab 3 Reports State
  const [reportSearch, setReportSearch] = useState<string>("");
  const [reportLang, setReportLang] = useState<string>("Tiếng Việt");
  const [favoriteReports, setFavoriteReports] = useState<Set<string>>(new Set());
  const [selectedReportPreview, setSelectedReportPreview] = useState<string | null>(null);

  // Existing Budget Plans list
  const [budgetPlans, setBudgetPlans] = useState<
    {
      id: string;
      code: string;
      date: string;
      description: string;
      year: number;
      periodType: string;
      unit: string;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
      status: string;
    }[]
  >([
    {
      id: "bp-1",
      code: "KHNS001/2026",
      date: "01/01/2026",
      description: "Kế hoạch ngân sách sản xuất kinh doanh năm 2026",
      year: 2026,
      periodType: "Tháng",
      unit: "Tung",
      totalRevenue: 24000,
      totalCost: 16500,
      totalProfit: 7500,
      status: "Đang theo dõi",
    },
  ]);

  // Editor Target Figures Matrix (12 months)
  const [matrixTargets, setMatrixTargets] = useState<{
    rev511: number[];
    rev515: number[];
    cost632: number[];
    cost641: number[];
    cost642: number[];
  }>({
    rev511: [1500, 1600, 1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600, 3000],
    rev515: [50, 50, 60, 60, 70, 70, 80, 80, 90, 90, 100, 100],
    cost632: [900, 950, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400, 1450, 1600],
    cost641: [200, 210, 220, 230, 240, 250, 260, 270, 280, 290, 300, 320],
    cost642: [150, 150, 160, 160, 170, 170, 180, 180, 190, 190, 200, 200],
  });

  const handleRefreshData = () => {
    const now = new Date();
    const formatted = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setLastUpdated(formatted);
    notify?.("Đã làm mới số liệu ngân sách thành công.");
  };

  const toggleFavorite = (reportName: string) => {
    setFavoriteReports((prev) => {
      const next = new Set(prev);
      if (next.has(reportName)) {
        next.delete(reportName);
      } else {
        next.add(reportName);
      }
      return next;
    });
  };

  const handleModalSubmit = () => {
    setIsCreateModalOpen(false);
    // Create new plan and open spreadsheet editor
    const newId = `bp-${Date.now()}`;
    const newCode = `KHNS00${budgetPlans.length + 1}/${modalYear}`;
    const newPlan = {
      id: newId,
      code: newCode,
      date: modalFromDate,
      description: `Kế hoạch ngân sách năm ${modalYear} (${modalPeriodType})`,
      year: modalYear,
      periodType: modalPeriodType,
      unit: modalUnit,
      totalRevenue: 27900,
      totalCost: 19100,
      totalProfit: 8800,
      status: "Đang theo dõi",
    };
    setBudgetPlans([newPlan, ...budgetPlans]);
    setPlanningViewMode("editor");
    notify?.(`Đã khởi tạo kỳ lập kế hoạch ${newCode}.`);
  };

  const handleSaveSettings = () => {
    setIsSettingsModalOpen(false);
    // Clear action param if present
    if (searchParams.get("action") === "settings") {
      const p = new URLSearchParams(searchParams);
      p.delete("action");
      setSearchParams(p);
    }
    notify?.(`Đã thiết lập ngày bắt đầu năm ngân sách: ${settingsStartDate} (Áp dụng từ năm ${settingsApplyYear}).`);
  };

  return (
    <div className="misa-budget-container">
      {/* ========================================================= */}
      {/* TAB 1: BIỂU ĐỒ (CHARTS) - Matches Screenshot 2           */}
      {/* ========================================================= */}
      {currentTab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          {/* Top Filter Bar */}
          <div className="misa-budget-charts-bar">
            <div className="misa-budget-filters-group">
              {/* Đơn vị */}
              <div className="misa-budget-filter-item">
                <span>Đơn vị</span>
                <select
                  className="misa-budget-select"
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                >
                  <option value="Tung">Tung</option>
                  <option value="Công ty Cổ phần MISA">Công ty Cổ phần MISA</option>
                  <option value="Văn phòng Tổng công ty">Văn phòng Tổng công ty</option>
                  <option value="Chi nhánh Hà Nội">Chi nhánh Hà Nội</option>
                  <option value="Chi nhánh TP.HCM">Chi nhánh TP.HCM</option>
                </select>
              </div>

              {/* Năm */}
              <div className="misa-budget-filter-item">
                <span>Năm</span>
                <div className="misa-budget-year-stepper">
                  <input
                    type="text"
                    className="misa-budget-year-input"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value) || 2026)}
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

            {/* Right: Tùy chỉnh */}
            <div>
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

          {/* Charts Grid */}
          <div className="misa-budget-charts-grid">
            {/* ROW 1: 3 Semicircle Gauges */}
            <div className="misa-budget-row-gauges">
              {/* Card 1: Tình hình thực hiện doanh thu */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">Tình hình thực hiện doanh thu</h4>
                  <div className="misa-budget-chart-header-right">
                    <select className="misa-budget-select" style={{ height: 26, fontSize: 12 }}>
                      <option value="year">Năm nay</option>
                      <option value="last_year">Năm trước</option>
                      <option value="quarter">Quý này</option>
                    </select>
                    <span className="misa-budget-card-unit">Đvt: Triệu đồng</span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge percent={0} color="#00a862" size={175} />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#00a862" }} />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#334155" }} />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#94a3b8" }} />
                          <span>Chênh lệch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
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

              {/* Card 2: Tình hình thực hiện chi phí */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">Tình hình thực hiện chi phí</h4>
                  <div className="misa-budget-chart-header-right">
                    <select className="misa-budget-select" style={{ height: 26, fontSize: 12 }}>
                      <option value="year">Năm nay</option>
                      <option value="last_year">Năm trước</option>
                      <option value="quarter">Quý này</option>
                    </select>
                    <span className="misa-budget-card-unit">Đvt: Triệu đồng</span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge percent={0} color="#0284c7" size={175} />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#0284c7" }} />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#334155" }} />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#94a3b8" }} />
                          <span>Chênh lệch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
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

              {/* Card 3: Tình hình thực hiện lợi nhuận */}
              <div className="misa-budget-card">
                <div className="misa-budget-card-header">
                  <h4 className="misa-budget-card-title">Tình hình thực hiện lợi nhuận</h4>
                  <div className="misa-budget-chart-header-right">
                    <select className="misa-budget-select" style={{ height: 26, fontSize: 12 }}>
                      <option value="year">Năm nay</option>
                      <option value="last_year">Năm trước</option>
                      <option value="quarter">Quý này</option>
                    </select>
                    <span className="misa-budget-card-unit">Đvt: Triệu đồng</span>
                  </div>
                </div>

                <div className="misa-budget-card-body">
                  <div className="misa-budget-gauge-layout">
                    <div className="misa-budget-gauge-left">
                      <SemicircleGauge percent={0} color="#0d9488" size={175} />
                    </div>
                    <div className="misa-budget-gauge-right">
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#0d9488" }} />
                          <span>Thực hiện</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#334155" }} />
                          <span>Kế hoạch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
                      </div>
                      <div className="misa-budget-metric-item">
                        <span className="misa-budget-metric-label">
                          <span className="misa-budget-metric-badge" style={{ backgroundColor: "#94a3b8" }} />
                          <span>Chênh lệch</span>
                        </span>
                        <span className="misa-budget-metric-val">0</span>
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

            {/* ROW 2: 2 Monthly Comparison Charts */}
            <div className="misa-budget-row-charts">
              {/* Card 4: Doanh thu thực hiện so với kế hoạch */}
              <MonthlyComparisonChart
                title="Doanh thu thực hiện so với kế hoạch"
                actualColor="#00a862"
                planColor="#94a3b8"
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />

              {/* Card 5: Chi phí thực hiện so với kế hoạch */}
              <MonthlyComparisonChart
                title="Chi phí thực hiện so với kế hoạch"
                actualColor="#0284c7"
                planColor="#94a3b8"
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />
            </div>

            {/* ROW 3: Lợi nhuận & Theo đơn vị */}
            <div className="misa-budget-row-charts">
              {/* Card 6: Lợi nhuận thực hiện so với kế hoạch */}
              <MonthlyComparisonChart
                title="Lợi nhuận thực hiện so với kế hoạch"
                actualColor="#0d9488"
                planColor="#94a3b8"
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />

              {/* Card 7: Tình hình thực hiện doanh thu theo đơn vị */}
              <UnitComparisonChart
                title="Tình hình thực hiện doanh thu theo đơn vị"
                actualColor="#00a862"
                planColor="#94a3b8"
                lastUpdated={lastUpdated}
                onRefresh={handleRefreshData}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: KẾ HOẠCH NGÂN SÁCH - Matches Screenshots 3, 4      */}
      {/* ========================================================= */}
      {currentTab === "planning" && (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
          {/* Landing Mode matching Screenshot 3 */}
          {planningViewMode === "landing" && (
            <div className="misa-budget-landing-wrap">
              {/* Illustration: Document folder with upward trend and $ badge */}
              <div className="misa-budget-illustration">
                <svg width="180" height="150" viewBox="0 0 180 150" fill="none">
                  {/* Subtle shadow base */}
                  <ellipse cx="90" cy="138" rx="60" ry="8" fill="#e2e8f0" opacity="0.6" />
                  
                  {/* Document Page Base */}
                  <rect x="52" y="32" width="68" height="92" rx="6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
                  {/* Folded Top-Right Corner */}
                  <path d="M102 32 L120 50 L102 50 Z" fill="#00a862" opacity="0.15" />
                  <path d="M102 32 L102 50 L120 50" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                  
                  {/* Document lines */}
                  <rect x="62" y="60" width="34" height="4" rx="2" fill="#00a862" />
                  <rect x="62" y="72" width="24" height="4" rx="2" fill="#00a862" />
                  <rect x="62" y="84" width="30" height="4" rx="2" fill="#cbd5e1" />

                  {/* Upward Line Chart Path */}
                  <path
                    d="M 60 106 L 85 92 L 105 82 L 132 54"
                    fill="none"
                    stroke="#00a862"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Chart Points */}
                  <circle cx="85" cy="92" r="4.5" fill="#00a862" />
                  <circle cx="105" cy="82" r="4.5" fill="#00a862" />
                  <circle cx="132" cy="54" r="5" fill="#00a862" />

                  {/* Circular Dollar Badge */}
                  <circle cx="126" cy="100" r="16" fill="#00a862" />
                  <text x="126" y="106" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">
                    $
                  </text>

                  {/* Sparkles / Plus decorative points */}
                  <path d="M 40 50 L 44 50 M 42 48 L 42 52" stroke="#94a3b8" strokeWidth="1.5" />
                  <path d="M 148 38 L 152 38 M 150 36 L 150 40" stroke="#94a3b8" strokeWidth="1.5" />
                  <circle cx="48" cy="96" r="2" fill="#00a862" />
                  <circle cx="152" cy="86" r="2.5" fill="#00a862" />
                </svg>
              </div>

              {/* Title text */}
              <h2 className="misa-budget-landing-title">
                Lập kế hoạch ngân sách để theo dõi tình hình doanh thu, chi phí, lợi nhuận thực tế so với kế hoạch
              </h2>

              {/* Green Add Button */}
              <button
                type="button"
                className="misa-budget-btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Thêm
              </button>

              {/* Bottom toggle button */}
              <button
                type="button"
                className="misa-budget-landing-bottom-btn"
                onClick={() => setPlanningViewMode("list")}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          )}

          {/* List Mode: Danh sách chứng từ kế hoạch ngân sách */}
          {planningViewMode === "list" && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
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
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px" }}
                  >
                    <Plus size={14} />
                    <span>Thêm kế hoạch</span>
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="misa-budget-reports-search-box">
                    <Search size={14} className="misa-budget-reports-search-icon" />
                    <input type="text" placeholder="Tìm theo số chứng từ, diễn giải..." />
                  </div>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={() => notify?.("Đã xuất danh sách kế hoạch ngân sách ra Excel.")}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={14} />
                    <span>Xuất Excel</span>
                  </button>
                </div>
              </div>

              {/* Table of budget vouchers */}
              <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#334155", fontWeight: 600, borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "10px 14px" }}>Số chứng từ</th>
                      <th style={{ padding: "10px 14px" }}>Ngày chứng từ</th>
                      <th style={{ padding: "10px 14px" }}>Diễn giải</th>
                      <th style={{ padding: "10px 14px" }}>Năm</th>
                      <th style={{ padding: "10px 14px" }}>Kỳ lập</th>
                      <th style={{ padding: "10px 14px" }}>Đơn vị</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Tổng doanh thu (Tr.đ)</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Tổng chi phí (Tr.đ)</th>
                      <th style={{ padding: "10px 14px", textAlign: "right" }}>Lợi nhuận (Tr.đ)</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Trạng thái</th>
                      <th style={{ padding: "10px 14px", textAlign: "center" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetPlans.map((plan) => (
                      <tr key={plan.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "#00a862" }}>{plan.code}</td>
                        <td style={{ padding: "10px 14px" }}>{plan.date}</td>
                        <td style={{ padding: "10px 14px" }}>{plan.description}</td>
                        <td style={{ padding: "10px 14px" }}>{plan.year}</td>
                        <td style={{ padding: "10px 14px" }}>{plan.periodType}</td>
                        <td style={{ padding: "10px 14px" }}>{plan.unit}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{plan.totalRevenue.toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{plan.totalCost.toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{plan.totalProfit.toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", background: "#f0fdf4", color: "#166534", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {plan.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setPlanningViewMode("editor")}
                              style={{ background: "none", border: "none", color: "#0284c7", cursor: "pointer", padding: 2 }}
                              title="Xem / Sửa chi tiết"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBudgetPlans(budgetPlans.filter((p) => p.id !== plan.id));
                                notify?.(`Đã xóa kế hoạch ${plan.code}`);
                              }}
                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 2 }}
                              title="Xóa kế hoạch"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Editor Mode: Bảng lập kế hoạch ngân sách chi tiết 12 tháng */}
          {planningViewMode === "editor" && (
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
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
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                    Bảng kế hoạch ngân sách năm {modalYear} - Đơn vị: {modalUnit}
                  </h3>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    className="misa-budget-btn-secondary"
                    onClick={() => notify?.("Đã xuất mẫu kế hoạch ngân sách ra Excel.")}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Download size={14} />
                    <span>Xuất Excel</span>
                  </button>
                  <button
                    type="button"
                    className="misa-budget-btn-primary"
                    onClick={() => {
                      notify?.("Đã lưu kế hoạch ngân sách thành công.");
                      setPlanningViewMode("list");
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 18px" }}
                  >
                    <Save size={14} />
                    <span>Lưu kế hoạch</span>
                  </button>
                </div>
              </div>

              {/* Spreadsheet Matrix Grid */}
              <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1", color: "#334155" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", width: 260, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>Chỉ tiêu ngân sách</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 70 }}>Mã số</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", width: 110, background: "#f1f5f9" }}>Tổng cả năm</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} style={{ padding: "8px 10px", textAlign: "right", minWidth: 80 }}>
                          Tháng {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Section I: Doanh thu */}
                    <tr style={{ background: "#f0fdf4", fontWeight: 700, color: "#166534" }}>
                      <td style={{ padding: "8px 12px", position: "sticky", left: 0, background: "#f0fdf4" }}>I. TỔNG DOANH THU & THU NHẬP</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>01</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {(
                          matrixTargets.rev511.reduce((a, b) => a + b, 0) +
                          matrixTargets.rev515.reduce((a, b) => a + b, 0)
                        ).toLocaleString("vi-VN")}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => (
                        <td key={i} style={{ padding: "8px 10px", textAlign: "right" }}>
                          {(matrixTargets.rev511[i] + matrixTargets.rev515[i]).toLocaleString("vi-VN")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 12px 6px 24px", position: "sticky", left: 0, background: "#ffffff" }}>1. Doanh thu bán hàng và CCDV (511)</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>511</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, background: "#f8fafc" }}>
                        {matrixTargets.rev511.reduce((a, b) => a + b, 0).toLocaleString("vi-VN")}
                      </td>
                      {matrixTargets.rev511.map((v, i) => (
                        <td key={i} style={{ padding: "6px 10px", textAlign: "right" }}>{v.toLocaleString("vi-VN")}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 12px 6px 24px", position: "sticky", left: 0, background: "#ffffff" }}>2. Doanh thu hoạt động tài chính (515)</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>515</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, background: "#f8fafc" }}>
                        {matrixTargets.rev515.reduce((a, b) => a + b, 0).toLocaleString("vi-VN")}
                      </td>
                      {matrixTargets.rev515.map((v, i) => (
                        <td key={i} style={{ padding: "6px 10px", textAlign: "right" }}>{v.toLocaleString("vi-VN")}</td>
                      ))}
                    </tr>

                    {/* Section II: Chi phí */}
                    <tr style={{ background: "#fef2f2", fontWeight: 700, color: "#991b1b" }}>
                      <td style={{ padding: "8px 12px", position: "sticky", left: 0, background: "#fef2f2" }}>II. TỔNG CHI PHÍ HOẠT ĐỘNG</td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>10</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {(
                          matrixTargets.cost632.reduce((a, b) => a + b, 0) +
                          matrixTargets.cost641.reduce((a, b) => a + b, 0) +
                          matrixTargets.cost642.reduce((a, b) => a + b, 0)
                        ).toLocaleString("vi-VN")}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => (
                        <td key={i} style={{ padding: "8px 10px", textAlign: "right" }}>
                          {(matrixTargets.cost632[i] + matrixTargets.cost641[i] + matrixTargets.cost642[i]).toLocaleString("vi-VN")}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 12px 6px 24px", position: "sticky", left: 0, background: "#ffffff" }}>1. Giá vốn hàng bán (632)</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>632</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, background: "#f8fafc" }}>
                        {matrixTargets.cost632.reduce((a, b) => a + b, 0).toLocaleString("vi-VN")}
                      </td>
                      {matrixTargets.cost632.map((v, i) => (
                        <td key={i} style={{ padding: "6px 10px", textAlign: "right" }}>{v.toLocaleString("vi-VN")}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 12px 6px 24px", position: "sticky", left: 0, background: "#ffffff" }}>2. Chi phí bán hàng (641)</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>641</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, background: "#f8fafc" }}>
                        {matrixTargets.cost641.reduce((a, b) => a + b, 0).toLocaleString("vi-VN")}
                      </td>
                      {matrixTargets.cost641.map((v, i) => (
                        <td key={i} style={{ padding: "6px 10px", textAlign: "right" }}>{v.toLocaleString("vi-VN")}</td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 12px 6px 24px", position: "sticky", left: 0, background: "#ffffff" }}>3. Chi phí quản lý doanh nghiệp (642)</td>
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>642</td>
                      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 600, background: "#f8fafc" }}>
                        {matrixTargets.cost642.reduce((a, b) => a + b, 0).toLocaleString("vi-VN")}
                      </td>
                      {matrixTargets.cost642.map((v, i) => (
                        <td key={i} style={{ padding: "6px 10px", textAlign: "right" }}>{v.toLocaleString("vi-VN")}</td>
                      ))}
                    </tr>

                    {/* Section III: Lợi nhuận trước thuế */}
                    <tr style={{ background: "#f8fafc", fontWeight: 700, color: "#0f172a", borderTop: "2px solid #cbd5e1" }}>
                      <td style={{ padding: "9px 12px", position: "sticky", left: 0, background: "#f8fafc" }}>III. LỢI NHUẬN DỰ KIẾN (I - II)</td>
                      <td style={{ padding: "9px 12px", textAlign: "center" }}>20</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", color: "#00a862", fontWeight: 700 }}>
                        {(
                          matrixTargets.rev511.reduce((a, b) => a + b, 0) +
                          matrixTargets.rev515.reduce((a, b) => a + b, 0) -
                          (matrixTargets.cost632.reduce((a, b) => a + b, 0) +
                            matrixTargets.cost641.reduce((a, b) => a + b, 0) +
                            matrixTargets.cost642.reduce((a, b) => a + b, 0))
                        ).toLocaleString("vi-VN")}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mRev = matrixTargets.rev511[i] + matrixTargets.rev515[i];
                        const mCost = matrixTargets.cost632[i] + matrixTargets.cost641[i] + matrixTargets.cost642[i];
                        return (
                          <td key={i} style={{ padding: "9px 10px", textAlign: "right", color: "#00a862", fontWeight: 600 }}>
                            {(mRev - mCost).toLocaleString("vi-VN")}
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
      {/* TAB 3: BÁO CÁO - Matches Screenshot 5                     */}
      {/* ========================================================= */}
      {currentTab === "reports" && (
        <div className="misa-budget-reports-wrap">
          {/* Top Filter & Tools */}
          <div className="misa-budget-reports-toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Search by Report Name */}
              <div className="misa-budget-reports-search-box">
                <Search size={14} className="misa-budget-reports-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm theo tên báo cáo"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                />
              </div>

              {/* AVA AI shortcut */}
              <button
                type="button"
                className="misa-budget-ava-ai-btn"
                onClick={() => notify?.("Đang khởi tạo trợ lý AVA Kế toán cho báo cáo ngân sách...")}
              >
                <span>Tìm kiếm nhanh báo cáo với AVA Kế toán</span>
                <span style={{ fontSize: 14 }}>🤖</span>
              </button>
            </div>

            {/* Right Tools */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155" }}>
                <span>Ngôn ngữ báo cáo</span>
                <select
                  className="misa-budget-select"
                  value={reportLang}
                  onChange={(e) => setReportLang(e.target.value)}
                >
                  <option value="Tiếng Việt">Tiếng Việt</option>
                  <option value="English">English</option>
                </select>
              </div>

              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => notify?.("Tùy chọn ẩn/hiện danh mục báo cáo ngân sách.")}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Eye size={14} />
                <span>Ẩn/hiện báo cáo</span>
              </button>

              <button
                type="button"
                className="misa-budget-btn-secondary"
                style={{ width: 34, padding: 0, justifyContent: "center" }}
                title="Thay đổi bố cục"
              >
                <Layers size={14} />
              </button>
            </div>
          </div>

          {/* 2-Column Report Matrix matching Screenshot 5 */}
          <div className="misa-budget-reports-grid">
            {/* Column 1 */}
            <div className="misa-budget-reports-col">
              {/* Report 1: Kế hoạch ngân sách */}
              <div className="misa-budget-report-row">
                <a
                  href="#report-ke-hoach-ngan-sach"
                  className="misa-budget-report-name"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedReportPreview("Kế hoạch ngân sách");
                  }}
                >
                  Kế hoạch ngân sách
                </a>
                <div className="misa-budget-report-actions">
                  <button
                    type="button"
                    className="misa-budget-report-icon-btn"
                    title="Xem biểu đồ báo cáo"
                    onClick={() => setSelectedReportPreview("Kế hoạch ngân sách")}
                  >
                    <LineChart size={16} />
                  </button>
                  <button
                    type="button"
                    className={`misa-budget-report-icon-btn ${favoriteReports.has("Kế hoạch ngân sách") ? "starred" : ""}`}
                    title="Đánh dấu ưa thích"
                    onClick={() => toggleFavorite("Kế hoạch ngân sách")}
                  >
                    <Star size={16} fill={favoriteReports.has("Kế hoạch ngân sách") ? "#eab308" : "none"} />
                  </button>
                </div>
              </div>

              {/* Report 2: Tình hình thực hiện ngân sách */}
              <div className="misa-budget-report-row">
                <a
                  href="#report-tinh-hinh-thuc-hien"
                  className="misa-budget-report-name"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedReportPreview("Tình hình thực hiện ngân sách");
                  }}
                >
                  Tình hình thực hiện ngân sách
                </a>
                <div className="misa-budget-report-actions">
                  <button
                    type="button"
                    className="misa-budget-report-icon-btn"
                    title="Xem biểu đồ báo cáo"
                    onClick={() => setSelectedReportPreview("Tình hình thực hiện ngân sách")}
                  >
                    <LineChart size={16} />
                  </button>
                  <button
                    type="button"
                    className={`misa-budget-report-icon-btn ${favoriteReports.has("Tình hình thực hiện ngân sách") ? "starred" : ""}`}
                    title="Đánh dấu ưa thích"
                    onClick={() => toggleFavorite("Tình hình thực hiện ngân sách")}
                  >
                    <Star size={16} fill={favoriteReports.has("Tình hình thực hiện ngân sách") ? "#eab308" : "none"} />
                  </button>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className="misa-budget-reports-col">
              {/* Report 3: Tình hình thực hiện doanh thu so với kế hoạch */}
              <div className="misa-budget-report-row">
                <a
                  href="#report-doanh-thu-so-ke-hoach"
                  className="misa-budget-report-name"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedReportPreview("Tình hình thực hiện doanh thu so với kế hoạch");
                  }}
                >
                  Tình hình thực hiện doanh thu so với kế hoạch
                </a>
                <div className="misa-budget-report-actions">
                  <button
                    type="button"
                    className="misa-budget-report-icon-btn"
                    title="Xem biểu đồ báo cáo"
                    onClick={() => setSelectedReportPreview("Tình hình thực hiện doanh thu so với kế hoạch")}
                  >
                    <LineChart size={16} />
                  </button>
                  <button
                    type="button"
                    className={`misa-budget-report-icon-btn ${favoriteReports.has("Tình hình thực hiện doanh thu so với kế hoạch") ? "starred" : ""}`}
                    title="Đánh dấu ưa thích"
                    onClick={() => toggleFavorite("Tình hình thực hiện doanh thu so với kế hoạch")}
                  >
                    <Star size={16} fill={favoriteReports.has("Tình hình thực hiện doanh thu so với kế hoạch") ? "#eab308" : "none"} />
                  </button>
                </div>
              </div>

              {/* Report 4: Tình hình chi phí thực tế so với kế hoạch */}
              <div className="misa-budget-report-row">
                <a
                  href="#report-chi-phi-so-ke-hoach"
                  className="misa-budget-report-name"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedReportPreview("Tình hình chi phí thực tế so với kế hoạch");
                  }}
                >
                  Tình hình chi phí thực tế so với kế hoạch
                </a>
                <div className="misa-budget-report-actions">
                  <button
                    type="button"
                    className="misa-budget-report-icon-btn"
                    title="Xem biểu đồ báo cáo"
                    onClick={() => setSelectedReportPreview("Tình hình chi phí thực tế so với kế hoạch")}
                  >
                    <LineChart size={16} />
                  </button>
                  <button
                    type="button"
                    className={`misa-budget-report-icon-btn ${favoriteReports.has("Tình hình chi phí thực tế so với kế hoạch") ? "starred" : ""}`}
                    title="Đánh dấu ưa thích"
                    onClick={() => toggleFavorite("Tình hình chi phí thực tế so với kế hoạch")}
                  >
                    <Star size={16} fill={favoriteReports.has("Tình hình chi phí thực tế so với kế hoạch") ? "#eab308" : "none"} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHỌN KỲ LẬP KẾ HOẠCH - Matches Screenshot 4        */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="misa-budget-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="misa-budget-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">Chọn kỳ lập kế hoạch</h3>
              <div className="misa-budget-modal-header-actions">
                <button
                  type="button"
                  className="misa-budget-modal-icon-btn"
                  title="Hướng dẫn chọn kỳ kế hoạch"
                  onClick={() => notify?.("Kỳ lập kế hoạch có thể theo Tháng, Quý hoặc Năm áp dụng cho toàn đơn vị hoặc từng chi nhánh.")}
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

            {/* Body */}
            <div className="misa-budget-modal-body">
              {/* Row 1: Năm, Từ, Đến, Lập kế hoạch theo * */}
              <div className="misa-budget-modal-row-grid">
                {/* Năm */}
                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">Năm</label>
                  <div className="misa-budget-year-stepper" style={{ height: 32 }}>
                    <input
                      type="text"
                      className="misa-budget-year-input"
                      value={modalYear}
                      onChange={(e) => {
                        const y = Number(e.target.value) || 2027;
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

                {/* Từ */}
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

                {/* Đến */}
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

                {/* Lập kế hoạch theo * */}
                <div className="misa-budget-field-group">
                  <label className="misa-budget-field-label">
                    Lập kế hoạch theo <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    className="misa-budget-select"
                    value={modalPeriodType}
                    onChange={(e) => setModalPeriodType(e.target.value)}
                  >
                    <option value="Tháng">Tháng</option>
                    <option value="Quý">Quý</option>
                    <option value="Năm">Năm</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Checkbox Kế hoạch ngân sách chi tiết theo đơn vị */}
              <label className="misa-budget-checkbox-label">
                <input
                  type="checkbox"
                  checked={modalDetailByUnit}
                  onChange={(e) => setModalDetailByUnit(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#00a862", cursor: "pointer" }}
                />
                <span>Kế hoạch ngân sách chi tiết theo đơn vị</span>
              </label>

              {/* Row 3: Dropdown Đơn vị */}
              <div>
                <select
                  className="misa-budget-select"
                  style={{ width: "100%", height: 34 }}
                  value={modalUnit}
                  onChange={(e) => setModalUnit(e.target.value)}
                >
                  <option value="Tung">Tung</option>
                  <option value="Công ty Cổ phần MISA">Công ty Cổ phần MISA</option>
                  <option value="Văn phòng Tổng công ty">Văn phòng Tổng công ty</option>
                  <option value="Chi nhánh Hà Nội">Chi nhánh Hà Nội</option>
                  <option value="Chi nhánh TP.HCM">Chi nhánh TP.HCM</option>
                </select>
              </div>
            </div>

            {/* Footer Buttons */}
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
      {/* MODAL: THIẾT LẬP NGÀY BẮT ĐẦU NĂM NGÂN SÁCH (Screenshot 1)*/}
      {/* ========================================================= */}
      {isSettingsModalOpen && (
        <div className="misa-budget-modal-overlay" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="misa-budget-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">Thiết lập ngày bắt đầu năm ngân sách</h3>
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
                <label className="misa-budget-field-label">Ngày bắt đầu năm ngân sách (dd/MM)</label>
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
                <label className="misa-budget-field-label">Áp dụng từ năm</label>
                <input
                  type="number"
                  className="misa-budget-select"
                  value={settingsApplyYear}
                  onChange={(e) => setSettingsApplyYear(Number(e.target.value) || 2026)}
                />
              </div>

              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, background: "#f8fafc", padding: 10, borderRadius: 4, border: "1px solid #e2e8f0" }}>
                Hệ thống AMIS Kế toán sẽ căn cứ ngày bắt đầu năm ngân sách để tính toán chu kỳ 12 tháng dự toán và đối soát dữ liệu thực tế.
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
        <div className="misa-budget-modal-overlay" onClick={() => setSelectedReportPreview(null)}>
          <div className="misa-budget-modal" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
            <div className="misa-budget-modal-header">
              <h3 className="misa-budget-modal-title">{selectedReportPreview}</h3>
              <button
                type="button"
                className="misa-budget-modal-icon-btn"
                onClick={() => setSelectedReportPreview(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="misa-budget-modal-body" style={{ maxHeight: 480, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>
                  Kỳ báo cáo: <strong style={{ color: "#0f172a" }}>Năm 2026</strong> | Đơn vị: <strong style={{ color: "#0f172a" }}>{selectedUnit}</strong>
                </span>
                <span style={{ color: "#64748b" }}>Đơn vị tính: <strong>Triệu đồng</strong></span>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#334155" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Chỉ tiêu</th>
                    <th style={{ padding: "8px 12px", textAlign: "center" }}>Mã số</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Kế hoạch</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Thực hiện</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Chênh lệch</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Tỷ lệ (%)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td style={{ padding: "8px 12px" }}>A. TỔNG THU HOẠT ĐỘNG (511 + 515)</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>01</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>24.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#ef4444" }}>-24.000</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 12px 6px 24px" }}>1. Doanh thu bán hàng hóa, dịch vụ</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>511</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>23.200</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#ef4444" }}>-23.200</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 12px 6px 24px" }}>2. Doanh thu tài chính</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>515</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>800</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#ef4444" }}>-800</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td style={{ padding: "8px 12px" }}>B. TỔNG CHI PHÍ HOẠT ĐỘNG</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>10</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>16.500</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#00a862" }}>-16.500</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 12px 6px 24px" }}>1. Giá vốn hàng bán</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>632</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>11.800</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#00a862" }}>-11.800</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 12px 6px 24px" }}>2. Chi phí bán hàng & quản lý</td>
                    <td style={{ padding: "6px 12px", textAlign: "center", color: "#64748b" }}>641, 642</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>4.700</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "6px 12px", textAlign: "right", color: "#00a862" }}>-4.700</td>
                    <td style={{ padding: "6px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                  <tr style={{ background: "#f0fdf4", fontWeight: 700, borderTop: "2px solid #cbd5e1" }}>
                    <td style={{ padding: "9px 12px", color: "#166534" }}>C. LỢI NHUẬN TRƯỚC THUẾ (A - B)</td>
                    <td style={{ padding: "9px 12px", textAlign: "center" }}>20</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>7.500</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>0</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "#ef4444" }}>-7.500</td>
                    <td style={{ padding: "9px 12px", textAlign: "right" }}>0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="misa-budget-modal-footer">
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => notify?.("Đã xuất báo cáo ra Excel.")}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} />
                <span>Xuất Excel</span>
              </button>
              <button
                type="button"
                className="misa-budget-btn-secondary"
                onClick={() => notify?.("Đang chuẩn bị trang in...")}
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
