import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiDate, apiNumber, useMisaApiLists, useMisaApiSave } from "./misa-api-lists";
import {
  cancelDepreciationVoucher,
  exportDepreciationAllocation,
  fetchFixedAssetHistory,
  fetchFixedAssetRegister,
  fetchFixedAssetReport,
  fetchFixedAssetReportCatalog,
  loadBookAssetsForStocktakeUc08,
  postDepreciationVoucher,
  previewDepreciationPeriod,
  reconcileFixedAssetAccounting,
  saveAssetCount,
  saveAssetMovement,
  saveDepreciation,
  saveDepreciationVoucher,
  saveFixedAsset,
  saveFixedAssetCategory,
  saveFixedAssetTransfer,
  unpostDepreciationVoucher,
  updateFixedAssetInfo,
  updateStocktakeVoucherUc08,
  errorText,
  REVALUATION_REASON_CODES,
  reverseRevaluation,
  saveRevaluation,
  toViDate,
} from "./misa-api-writes";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { ATTACHMENT_MAX_SIZE, ATTACHMENT_PATTERN, escapeHtml, openPrintFrame, VoucherAttachments } from "./VoucherAttachments";
import MisaApiDocumentStatus from "./MisaApiDocumentStatus";
import {
  Car,
  Calendar,
  Plus,
  Search,
  Download,
  HelpCircle,
  X,
  Calculator,
  RotateCw,
  ArrowRightLeft,
  MinusCircle,
  ClipboardList,
  GitBranch,
  Lightbulb,
  FileSpreadsheet,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  Settings,
  Trash2,
  Paperclip,
  Upload,
  Pin,
  RotateCcw,
  Eye,
  Printer,
} from "lucide-react";
import { formatVND } from "./MisaPurchaseModals";

export type MisaAssetsWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// Danh sách 8 Lý do ghi giảm tài sản cố định chuẩn xác theo MISA AMIS
export const DECREASE_REASONS = [
  "Nhượng bán, thanh lý",
  "Phát hiện thiếu khi kiểm kê",
  "Góp vốn vào công ty con",
  "Góp vốn công ty liên doanh",
  "Góp vốn vào công ty liên kết",
  "Đầu tư dài hạn khác",
  "Trả lại TSCĐ thuê tài chính",
  "Chuyển TSCĐ thành CCDC",
];

// ============================================================================
// SAMPLE DATA TÀI SẢN CỐ ĐỊNH
// ============================================================================
// Real data for fixed assets from Company ABC (TT99/2025/TT-BTC)
export const SAMPLE_ASSETS_DATA = [
  {
    code: "LT001",
    name: "Máy tính xách tay Dell XPS 15",
    category: "Máy móc, thiết bị",
    dept: "Phòng Kỹ thuật",
    startDate: "01/05/2021",
    years: 4,
    rateYear: 25.0,
    originalCost: 43200000,
    depreciatedAmount: 35000000,
    remainingAmount: 8200000,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6414",
  },
  {
    code: "PD001",
    name: "Máy photocopy Ricoh MP 5054",
    category: "Máy móc, thiết bị",
    dept: "Phòng Hành chính - Nhân sự",
    startDate: "01/02/2021",
    years: 5,
    rateYear: 20.0,
    originalCost: 60000000,
    depreciatedAmount: 47000000,
    remainingAmount: 13000000,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6424",
  },
  {
    code: "DH002",
    name: "Máy lạnh Daikin VRV A Series",
    category: "Máy móc, thiết bị",
    dept: "Phòng Hành chính - Nhân sự",
    startDate: "01/03/2022",
    years: 10,
    rateYear: 10.0,
    originalCost: 252000000,
    depreciatedAmount: 71400000,
    remainingAmount: 180600000,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6424",
  },
  {
    code: "MPD001",
    name: "Máy phát điện Cummins",
    category: "Máy móc, thiết bị",
    dept: "Phòng Hành chính - Nhân sự",
    startDate: "01/01/2023",
    years: 12,
    rateYear: 8.33,
    originalCost: 158400000,
    depreciatedAmount: 26400000,
    remainingAmount: 132000000,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6424",
  },
  {
    code: "OT002",
    name: "Xe ô tô Ford Transit 2023",
    category: "Phương tiện vận tải",
    dept: "Phòng Hành chính - Nhân sự",
    startDate: "01/05/2023",
    years: 8,
    rateYear: 12.5,
    originalCost: 816000000,
    depreciatedAmount: 170000000,
    remainingAmount: 646000000,
    costAccount: "2113",
    deprAccount: "2141",
    expenseAccount: "6424",
  },
  {
    code: "PM002",
    name: "Phần mềm kế toán Misa",
    category: "Tài sản cố định vô hình",
    dept: "Phòng Kế toán",
    startDate: "01/04/2024",
    years: 4,
    rateYear: 25.0,
    originalCost: 48000000,
    depreciatedAmount: 9000000,
    remainingAmount: 39000000,
    costAccount: "213",
    deprAccount: "2143",
    expenseAccount: "6424",
  },
  {
    code: "DELL 7780",
    name: "Máy tính để bàn Dell OptiPlex 7780",
    category: "Máy móc, thiết bị",
    dept: "Phòng Kỹ thuật",
    startDate: "05/01/2026",
    years: 5,
    rateYear: 20.0,
    originalCost: 35000000,
    depreciatedAmount: 6416667,
    remainingAmount: 28583333,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6414",
  },
  {
    code: "DELL R350",
    name: "Máy chủ Dell PowerEdge R350",
    category: "Máy móc, thiết bị",
    dept: "Phòng Hành chính - Nhân sự",
    startDate: "10/12/2026",
    years: 4,
    rateYear: 25.0,
    originalCost: 53000000,
    depreciatedAmount: 783602,
    remainingAmount: 52216398,
    costAccount: "2111",
    deprAccount: "2141",
    expenseAccount: "6424",
  },
];

export const SAMPLE_INCREASE_VOUCHERS = [
  {
    voucherNo: "GTTS00001",
    date: "01/05/2021",
    assetCode: "LT001",
    assetName: "Máy tính xách tay Dell XPS 15",
    originalCost: 43200000,
    dept: "Phòng Kỹ thuật",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00002",
    date: "01/02/2021",
    assetCode: "PD001",
    assetName: "Máy photocopy Ricoh MP 5054",
    originalCost: 60000000,
    dept: "Phòng Hành chính",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00003",
    date: "01/03/2022",
    assetCode: "DH002",
    assetName: "Máy lạnh Daikin VRV A Series",
    originalCost: 252000000,
    dept: "Toàn công ty",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00004",
    date: "01/01/2023",
    assetCode: "MPD001",
    assetName: "Máy phát điện Cummins",
    originalCost: 158400000,
    dept: "Toàn công ty",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00005",
    date: "01/05/2023",
    assetCode: "OT002",
    assetName: "Xe ô tô Ford Transit 2023",
    originalCost: 816000000,
    dept: "Phòng Hành chính",
    status: "Đã ghi sổ",
  },
  {
    voucherNo: "GTTS00006",
    date: "01/04/2024",
    assetCode: "PM002",
    assetName: "Phần mềm kế toán Misa",
    originalCost: 48000000,
    dept: "Phòng Kế toán",
    status: "Đã ghi sổ",
  },
];

export default function MisaAssetsWorkspace({
  company: _company = { id: "abc", name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC" },
  period: _period = "2026-12",
  tab = "process",
  href,
  notify,
}: MisaAssetsWorkspaceProps) {
  const navigate = useNavigate();
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(_company.id, {
    assets: "/api/v1/fixed-assets/assets/",
    transactions: "/api/v1/fixed-assets/transactions/",
    calculations: "/api/v1/fixed-assets/calculations/",
    assetCounts: "/api/v1/fixed-assets/counts/?asset_type=FIXED_ASSET",
    assetCategories: "/api/v1/fixed-assets/categories/?asset_type=FIXED_ASSET",
    departments: "/api/v1/organization/departments/",
    accounts: "/api/v1/general-ledger/accounts/",
    goodsPurchases: "/api/v1/purchases/goods-purchases/",
    revaluations: "/api/v1/fixed-assets/revaluations/",
    parties: "/api/v1/master-data/parties/",
  }, notify);
  const apiSave = useMisaApiSave(_company.id, notify, reloadApi);
  // Navigation helper
  const navigateTo = (targetTab: string) => {
    if (href) {
      navigate(href(`/assets/${targetTab}`));
    }
  };

  // State data
  const [assetsList, setAssetsList] = useState(SAMPLE_ASSETS_DATA);
  const [increaseVouchers, setIncreaseVouchers] = useState(SAMPLE_INCREASE_VOUCHERS);
  useEffect(() => {
    if (!apiConnected) return;
    if (apiRows.assets) setAssetsList(apiRows.assets
      .filter((row) => !row.asset_type || row.asset_type === "FIXED_ASSET")
      .map((row) => ({
        id: row.id,
        code: row.code || "",
        name: row.name || "",
        voucherNo: row.acquisition_voucher_no || row.source_reference || "",
        category: row.category_name || "",
        dept: row.department_name || "",
        noDepr: row.is_depreciable === false,
        startDate: apiDate(row.acquisition_date || row.in_service_date),
        deprStartDate: apiDate(row.in_service_date),
        years: row.useful_life_unit === "MONTH"
          ? Number((apiNumber(row.useful_life_value || row.useful_life_periods) / 12).toFixed(2))
          : apiNumber(row.useful_life_value) || (apiNumber(row.useful_life_periods) / 12),
        useDuration: apiNumber(row.useful_life_value) || (apiNumber(row.useful_life_periods) / 12),
        useDurationUnit: row.useful_life_unit === "MONTH" ? "Tháng" : "Năm",
        rateMonth: apiNumber(row.monthly_depreciation_rate) || (row.is_depreciable === false ? 0 : (apiNumber(row.useful_life_periods) ? Number((100 / apiNumber(row.useful_life_periods)).toFixed(2)) : 0)),
        rateYear: apiNumber(row.annual_depreciation_rate) || (row.is_depreciable === false ? 0 : (apiNumber(row.useful_life_periods) ? Number((1200 / apiNumber(row.useful_life_periods)).toFixed(2)) : 0)),
        deprCostValue: apiNumber(row.depreciable_amount || row.original_cost),
        deprMonthValue: apiNumber(row.monthly_depreciation_amount),
        deprYearValue: apiNumber(row.annual_depreciation_amount),
        originalCost: apiNumber(row.original_cost),
        depreciatedAmount: apiNumber(row.accumulated_depreciation),
        remainingAmount: apiNumber(row.remaining_value),
        costAccount: row.asset_account_code || "2111",
        deprAccount: row.accumulated_account_code || (row.is_depreciable === false ? "" : "2141"),
        expenseAccount: Array.isArray(row.allocations) && row.allocations[0]?.expense_account_code ? row.allocations[0].expense_account_code : "6424",
        limitTaxLaw: Boolean(row.cit_cap_enabled),
        taxLawValue: apiNumber(row.cit_depreciable_cap),
        taxLawMonthValue: apiNumber(row.cit_monthly_cap),
        allocations: Array.isArray(row.allocations)
          ? row.allocations.map((a: any) => ({
              department: a.department_name || a.department || row.department_name || "",
              rate: apiNumber(a.rate ?? 100),
              expenseAccount: a.expense_account_code || a.expense_account || "6424",
              expenseItem: a.expense_item || "Chi phí khấu hao TSCĐ",
              costObject: a.cost_center || "",
            }))
          : [],
        origins: Array.isArray(row.origins)
          ? row.origins.map((o: any) => ({
              sourceType: o.origin_type || o.sourceType || "Mua sắm mới trong nước",
              documentNo: o.document_number || o.documentNo || "",
              documentDate: o.document_date ? apiDate(o.document_date) : (o.documentDate || ""),
              amount: apiNumber(o.amount),
              supplier: o.partner_name || o.supplier || "",
            }))
          : [],
        components: Array.isArray(row.components)
          ? row.components.map((c: any) => ({
              name: c.name || "",
              unit: c.unit || "Cái",
              quantity: apiNumber(c.quantity || 1),
              value: apiNumber(c.value || 0),
            }))
          : [],
        accessories: Array.isArray(row.accessories)
          ? row.accessories.map((ac: any) => ({
              name: ac.name || "",
              unit: ac.unit || "Bộ",
              quantity: apiNumber(ac.quantity || 1),
              value: apiNumber(ac.value || 0),
            }))
          : [],
        countryOfOrigin: row.country_of_origin || "",
        manufactureYear: row.manufacture_year ?? "",
        serialNumber: row.serial_number || "",
        description: row.description || "",
        status: row.status || "ACTIVE",
        statusDisplay: row.status_display || (row.status === "DISPOSED" ? "Đã ghi giảm" : row.status === "SUSPENDED" ? "Ngừng sử dụng" : "Đang sử dụng"),
        reconciliationStatus: row.accounting_reconciliation_status_display || "Chưa đối chiếu hạch toán",
        version: Number(row.version) || 1,
        lastUpdateReason: row.last_update_reason || "",
        updatedBy: row.updated_by_name || "",
        updatedAt: row.updated_at || "",
      } as any)));
    if (apiRows.transactions) setIncreaseVouchers(apiRows.transactions
      .filter((row) => row.transaction_type === "ACQUISITION")
      .map((row) => ({
        id: row.id,
        voucherNo: row.number || "",
        date: apiDate(row.transaction_date),
        assetCode: row.asset_code || "",
        assetName: row.asset_name || "",
        originalCost: apiNumber(row.amount),
        dept: row.department_name || row.target_department_name || "",
        status: row.asset_status_display || (row.status === "POSTED" ? "Đang sử dụng" : row.status || ""),
        reconciliationStatus: row.accounting_reconciliation_status_display || (row.gl_status === "POSTED" ? "Đã đối chiếu" : "Chưa đối chiếu hạch toán"),
      } as any)));
    const movement = (types: string[]) => (apiRows.transactions || []).filter((row) => types.includes(row.transaction_type));
    const assetOf = (row: any) => apiRows.assets?.find((asset) => asset.id === row.asset);
    if (apiRows.transactions) {
      setTransferVouchers(movement(["TRANSFER"]).map((row) => ({
        id: row.id, voucherNo: row.number, date: apiDate(row.transaction_date), assetCode: row.asset_code || "",
        assetName: row.asset_name || "", fromDept: row.before_snapshot?.department_name || "",
        toDept: row.target_department_name || "", reason: row.reason || "", status: row.status,
      })));
      setDecVouchers(movement(["DISPOSAL"]).map((row) => ({
        id: row.id, voucherNo: row.number, date: apiDate(row.transaction_date), assetCode: row.asset_code || "",
        assetName: row.asset_name || "", reason: row.reason || "",
        originalCost: apiNumber(assetOf(row)?.original_cost), remainingValue: apiNumber(row.amount), status: row.status,
      })));
    }
    if (apiRows.revaluations) setRevalVouchers(apiRows.revaluations.map((row) => ({
      id: row.id, voucherNo: row.number, date: apiDate(row.posting_date),
      assetCode: (row.lines || []).map((line: any) => line.asset_code).join(", "),
      assetName: (row.lines || []).map((line: any) => line.asset_name).join(", "),
      reason: row.reason_label || "", diffAmount: apiNumber(row.totals?.remaining_value), status: row.status_label || row.status,
    })));
    if (apiRows.assetCounts) setStocktakeVouchers(apiRows.assetCounts.map((row) => {
      const lines = row.lines || [];
      const matched = lines.filter((line: any) => apiNumber(line.actual_quantity) === apiNumber(line.book_quantity)).length;
      return { voucherNo: row.number, date: apiDate(row.created_at), auditDate: apiDate(row.count_date), purpose: row.purpose,
        totalAssets: lines.length, matchedAssets: matched, diffAssets: lines.length - matched, conclusion: row.conclusion, status: "Đã ghi sổ" };
    }));
    if (apiRows.calculations) setDeprVouchers(apiRows.calculations.map((row) => ({
      id: row.id,
      voucherNo: row.number,
      date: apiDate(row.voucher_date || row.period_end),
      postingDate: apiDate(row.posting_date || row.period_end),
      month: Number(row.period_month || String(row.period_code || "").slice(5, 7) || 1),
      year: Number(row.period_year || String(row.period_code || "").slice(0, 4) || 2026),
      period: `Tháng ${String(row.period_code || "").slice(5, 7)}/${String(row.period_code || "").slice(0, 4)}`,
      amount: apiNumber(row.total_amount ?? row.amount),
      deductibleAmount: apiNumber(row.total_deductible_amount ?? row.total_amount ?? row.amount),
      nonDeductibleAmount: apiNumber(row.total_non_deductible_amount ?? 0),
      reason: row.description || `Khấu hao TSCĐ tháng ${String(row.period_code || "").slice(5, 7)} năm ${String(row.period_code || "").slice(0, 4)}`,
      reference: row.reference || "",
      status: row.status === "POSTED" ? "Đã ghi sổ" : row.status === "CALCULATED" ? "Chưa ghi sổ" : row.status === "CANCELLED" ? "Đã hủy" : row.status,
      rawStatus: row.status || "POSTED",
      lines: Array.isArray(row.lines) ? row.lines.map((l: any) => ({
        assetId: l.asset || "",
        assetCode: l.asset_code || "",
        assetName: l.asset_name || "",
        categoryName: l.category_name || "",
        departmentName: l.department_name || "",
        originalCost: apiNumber(l.original_cost),
        depreciableAmount: apiNumber(l.depreciable_amount),
        openingAccumulated: apiNumber(l.opening_accumulated_depreciation),
        closingAccumulated: apiNumber(l.closing_accumulated_depreciation),
        openingValue: apiNumber(l.opening_value),
        closingValue: apiNumber(l.closing_value),
        amount: apiNumber(l.amount),
        deductibleAmount: apiNumber(l.deductible_amount ?? l.amount),
        nonDeductibleAmount: apiNumber(l.non_deductible_amount ?? 0),
        eligibleDays: Number(l.eligible_days || 0),
        totalDaysInPeriod: Number(l.total_days_in_period || 0),
      })) : [],
      allocations: Array.isArray(row.allocations_snapshot) ? row.allocations_snapshot.map((al: any) => ({
        assetCode: al.asset_code || "",
        assetName: al.asset_name || "",
        departmentName: al.department_name || "",
        rate: apiNumber(al.rate ?? 100),
        allocatedAmount: apiNumber(al.allocated_amount),
        deductibleAmount: apiNumber(al.deductible_amount ?? al.allocated_amount),
        nonDeductibleAmount: apiNumber(al.non_deductible_amount ?? 0),
        expenseAccount: al.expense_account_code || "6424",
        costItem: al.cost_item || "Chi phí khấu hao TSCĐ",
      })) : [],
      accountingEntries: Array.isArray(row.accounting_entries) ? row.accounting_entries.map((ae: any) => ({
        description: ae.description || "",
        debitAccount: ae.debit_account_code || "6424",
        creditAccount: ae.credit_account_code || "2141",
        amount: apiNumber(ae.amount),
        departmentName: ae.department_name || "",
        costItem: ae.cost_item || "Chi phí khấu hao TSCĐ",
        assetCode: ae.asset_code || "",
      })) : [],
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
    } as any)));
  }, [apiRows, apiConnected]);
  const [searchRegister, setSearchRegister] = useState("");
  const [filterDept, setFilterDept] = useState("all");

  // Tab views (Intro vs Table)
  const [registerView, setRegisterView] = useState<"intro" | "table">("intro");
  const [increaseView, setIncreaseView] = useState<"intro" | "table">("intro");
  const [deprView, setDeprView] = useState<"intro" | "table">("intro");
  const [revalView, setRevalView] = useState<"intro" | "table">("intro");
  const [transferView, setTransferView] = useState<"intro" | "table">("intro");
  const [decreaseView, setDecreaseView] = useState<"intro" | "table">("intro");
  const [stocktakeView, setStocktakeView] = useState<"intro" | "table">("intro");

  // Modals state
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showDeprModal, setShowDeprModal] = useState(false);
  const [showRevalModal, setShowRevalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDecreaseModal, setShowDecreaseModal] = useState(false);
  const [showStocktakeModal, setShowStocktakeModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [previewReportName, setPreviewReportName] = useState<string | null>(null);

  // Tính khấu hao Voucher Modal state (Chính xác theo Ảnh 1: KH00001)
  const [showDeprVoucherModal, setShowDeprVoucherModal] = useState(false);
  const [deprVoucherNo, setDeprVoucherNo] = useState("KH00001");
  const [deprPostingDate, setDeprPostingDate] = useState("31/10/2026");
  const [deprVoucherDate, setDeprVoucherDate] = useState("31/10/2026");
  const [deprReason, setDeprReason] = useState("Khấu hao TSCĐ tháng 10 năm 2026");
  const [deprVoucherMonth, setDeprVoucherMonth] = useState(10);
  const [deprVoucherYear, setDeprVoucherYear] = useState(2026);
  const [deprActiveTab, setDeprActiveTab] = useState<"depreciation" | "allocation" | "accounting">("depreciation");

  // Revaluation state (Ảnh 1 & 2: Đánh giá lại TSCĐ ĐGL00001)
  const [revalVoucherNo, setRevalVoucherNo] = useState("ĐGL00001");
  const [revalDate, setRevalDate] = useState("12/10/2026");
  const [revalPostingDate, setRevalPostingDate] = useState("12/10/2026");
  const [revalVoucherDate, setRevalVoucherDate] = useState("12/10/2026");
  const [revalReason, setRevalReason] = useState("Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản");
  const [revalReportNo, setRevalReportNo] = useState("");
  const [revalTab, setRevalTab] = useState<"adjust" | "accounting">("adjust");
  const [revalMembersOpen, setRevalMembersOpen] = useState(true);
  const [revalMembers, setRevalMembers] = useState<Array<{ id: number; name: string; title: string; rep: string }>>([]);
  const [revalConclusion, setRevalConclusion] = useState("");
  const [revalRows, setRevalRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      dept: "",
      // Nguyên giá
      origBefore: 0,
      origAfter: 0,
      origDiff: 0,
      // Thời gian sử dụng còn lại (tháng)
      monthsBefore: 0,
      monthsAfter: 0,
      monthsDiff: 0,
      // Hao mòn lũy kế
      deprBefore: 0,
      deprAfter: 0,
      deprDiff: 0,
      costAccount: "",
      // Giá trị tính khấu hao
      valBefore: 0,
      valAfter: 0,
      valDiff: 0,
      revalAccount: "",
      // GTKH tháng sau điều chỉnh
      monthlyDeprAfter: 0,
      monthlyDeprLawAfter: 0,
    }
  ]);
  const [revalAccountingRows, setRevalAccountingRows] = useState([
    {
      id: 1,
      desc: "Đánh giá lại tài sản cố định ĐGL00001",
      debitAccount: "2111",
      creditAccount: "412",
      amount: 0,
      objectCode: "",
      objectName: "",
      costItem: "",
      dept: "",
    }
  ]);
  const [revalVouchers, setRevalVouchers] = useState([
    {
      voucherNo: "ĐGL00001",
      date: "12/10/2026",
      assetCode: "TSCD001",
      assetName: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
      reason: "Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản",
      diffAmount: 0,
      status: "Đã ghi sổ",
    }
  ]);
  // UC-FA-06: API document being edited, eligible assets, references, attachments and the dirty check (AF26).
  const { token: apiToken } = useApiSession();
  const [editingRevalId, setEditingRevalId] = useState("");
  const [revalRecord, setRevalRecord] = useState<any>(null);
  const [revalCandidates, setRevalCandidates] = useState<any[]>([]);
  const [revalReferences, setRevalReferences] = useState<string[]>([]);
  const [revalReferenceDraft, setRevalReferenceDraft] = useState<string | null>(null);
  const [revalCostBookedAtSource, setRevalCostBookedAtSource] = useState(false);
  const [revalSourceReference, setRevalSourceReference] = useState("");
  const [revalFiles, setRevalFiles] = useState<File[]>([]);
  const [revalAttachments, setRevalAttachments] = useState<any[]>([]);
  const [revalIdempotencyKey, setRevalIdempotencyKey] = useState("");
  const [revalSnapshot, setRevalSnapshot] = useState("");
  const [showRevalPrintMenu, setShowRevalPrintMenu] = useState(false);
  const [revalPrintTemplate, setRevalPrintTemplate] = useState("RECORD");
  const revalFormState = JSON.stringify([revalVoucherNo, revalDate, revalPostingDate, revalVoucherDate, revalReason, revalReportNo,
    revalConclusion, revalMembers.map((member) => [member.name, member.title, member.rep]),
    revalRows.map((row) => [row.assetCode, row.origAfter, row.monthsAfter, row.deprAfter, row.valAfter, row.monthlyDeprAfter, row.monthlyDeprLawAfter, row.costAccount, row.revalAccount]),
    revalAccountingRows.map((row) => [row.desc, row.debitAccount, row.creditAccount, row.amount, row.objectCode, row.costItem, row.dept]),
    revalReferences, revalCostBookedAtSource, revalSourceReference, revalFiles.map((file) => file.name)]);
  useEffect(() => {
    if (showRevalModal) setRevalSnapshot(revalFormState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRevalModal]);
  // Steps 16-17: eligible assets and their values at the effective date (record date, otherwise posting date).
  const isoFromVi = (value: string) => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(value || "").trim());
    return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
  };
  const revalEffectiveDate = isoFromVi(revalDate) || isoFromVi(revalPostingDate);
  useEffect(() => {
    if (!showRevalModal || !apiConnected || !apiToken || !revalEffectiveDate) return;
    let active = true;
    request<any[]>(`/api/v1/fixed-assets/revaluations/candidates/?company_id=${encodeURIComponent(_company.id)}&date=${revalEffectiveDate}`, apiToken)
      .then((rows) => { if (active) setRevalCandidates(rows); })
      .catch((error) => notify(`Không tải được danh sách tài sản: ${errorText(error)}`));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRevalModal, apiConnected, apiToken, revalEffectiveDate]);
  const revalReasonCode = REVALUATION_REASON_CODES[revalReason] || "";
  const revalReadOnly = Boolean(revalRecord && revalRecord.status !== "DRAFT");
  const emptyRevalRow = () => ({
    id: Date.now() + Math.round(Math.random() * 1e6), assetCode: "", assetName: "", dept: "",
    origBefore: 0, origAfter: 0, origDiff: 0, monthsBefore: 0, monthsAfter: 0, monthsDiff: 0,
    deprBefore: 0, deprAfter: 0, deprDiff: 0, costAccount: "", valBefore: 0, valAfter: 0, valDiff: 0,
    revalAccount: "", monthlyDeprAfter: 0, monthlyDeprLawAfter: 0,
  });
  /** Step 28 / section 4.7: straight-line amount for a full month after the adjustment. */
  const suggestRevalMonthly = (row: { valAfter: number; deprAfter: number; monthsAfter: number }) =>
    row.monthsAfter > 0 ? Math.round((row.valAfter - row.deprAfter) / row.monthsAfter) : 0;
  const updateRevalRow = (index: number, patch: Partial<ReturnType<typeof emptyRevalRow>>) => setRevalRows((rows) => rows.map((row, i) => {
    if (i !== index) return row;
    const next = { ...row, ...patch };
    // AF13: with a new cost the depreciable value follows unless it was set apart (keeps the salvage value).
    if ("origAfter" in patch && !("valAfter" in patch) && row.valAfter === row.origAfter - (row.origBefore - row.valBefore)) {
      next.valAfter = next.origAfter - (row.origBefore - row.valBefore);
    }
    next.origDiff = next.origAfter - next.origBefore;
    next.monthsDiff = next.monthsAfter - next.monthsBefore;
    next.deprDiff = next.deprAfter - next.deprBefore;
    next.valDiff = next.valAfter - next.valBefore;
    if (["origAfter", "monthsAfter", "deprAfter", "valAfter"].some((key) => key in patch)) {
      const suggested = suggestRevalMonthly(next);
      // AF18: the tax amount follows only while the user has not set it apart.
      if (row.monthlyDeprLawAfter === row.monthlyDeprAfter) next.monthlyDeprLawAfter = suggested;
      next.monthlyDeprAfter = suggested;
    }
    return next;
  }));
  const selectRevalAsset = (index: number, code: string) => {
    const asset = revalCandidates.find((row) => row.code === code);
    if (!asset) { updateRevalRow(index, { assetCode: code }); return; }
    const monthly = Number(asset.monthly_depreciation || 0);
    setRevalRows((rows) => rows.map((row, i) => i !== index ? row : {
      ...row, assetCode: asset.code, assetName: asset.name, dept: asset.department_name || "",
      origBefore: Number(asset.original_cost), origAfter: Number(asset.original_cost), origDiff: 0,
      monthsBefore: Number(asset.remaining_periods), monthsAfter: Number(asset.remaining_periods), monthsDiff: 0,
      deprBefore: Number(asset.accumulated_depreciation), deprAfter: Number(asset.accumulated_depreciation), deprDiff: 0,
      valBefore: Number(asset.depreciable_value), valAfter: Number(asset.depreciable_value), valDiff: 0,
      // BR23/BR24: no default revaluation (412) or expense account; the user picks them for the case at hand.
      costAccount: "", revalAccount: "", monthlyDeprAfter: monthly,
      monthlyDeprLawAfter: asset.tax_monthly_depreciation !== null && asset.tax_monthly_depreciation !== undefined ? Number(asset.tax_monthly_depreciation) : monthly,
    }));
  };
  /** Steps 34-35: proposed entries from the value differences and the reason; the user may change them. */
  const proposeRevalEntries = () => {
    const proposals: typeof revalAccountingRows = [];
    const revaluationAccount = (row: ReturnType<typeof emptyRevalRow>) =>
      row.revalAccount || (["STATE_DECISION", "CONVERSION"].includes(revalReasonCode) ? "412" : "");
    for (const row of revalRows.filter((entry) => entry.assetCode)) {
      const asset = revalCandidates.find((entry) => entry.code === row.assetCode) || {};
      const assetAccount = asset.asset_account_code || "211";
      const accumulatedAccount = asset.accumulated_account_code || "214";
      const cost = row.origAfter - row.origBefore;
      const depreciation = row.deprAfter - row.deprBefore;
      if (cost && !revalCostBookedAtSource) {
        // BR20: an upgrade is capitalised from TK 241, not through TK 412.
        const counterpart = revalReasonCode === "UPGRADE" ? "241" : revaluationAccount(row);
        proposals.push({ id: Date.now() + proposals.length, desc: `${cost > 0 ? "Tăng" : "Giảm"} nguyên giá ${row.assetCode} theo ${revalVoucherNo}`,
          debitAccount: cost > 0 ? assetAccount : counterpart, creditAccount: cost > 0 ? counterpart : assetAccount,
          amount: Math.abs(cost), objectCode: "", objectName: "", costItem: "", dept: row.dept });
      }
      if (depreciation) {
        const counterpart = revaluationAccount(row) || row.costAccount;
        proposals.push({ id: Date.now() + proposals.length, desc: `${depreciation > 0 ? "Tăng" : "Giảm"} hao mòn lũy kế ${row.assetCode} theo ${revalVoucherNo}`,
          debitAccount: depreciation > 0 ? counterpart : accumulatedAccount, creditAccount: depreciation > 0 ? accumulatedAccount : counterpart,
          amount: Math.abs(depreciation), objectCode: "", objectName: "", costItem: "", dept: row.dept });
      }
    }
    setRevalAccountingRows(proposals);
    // AF30: a change of life or depreciation basis only needs no entry.
    if (!proposals.length) notify("Điều chỉnh không phát sinh bút toán (chỉ thay đổi thời gian sử dụng hoặc cơ sở khấu hao).");
  };
  const openNewReval = () => {
    setEditingRevalId(""); setRevalRecord(null); setRevalReportNo(""); setRevalConclusion(""); setRevalMembers([]);
    setRevalReason("Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản"); setRevalTab("adjust");
    const today = toViDate(new Date().toISOString().slice(0, 10));
    setRevalDate(today); setRevalPostingDate(today); setRevalVoucherDate(today);
    setRevalRows([emptyRevalRow()]); setRevalAccountingRows(apiConnected ? [] : revalAccountingRows);
    setRevalReferences([]); setRevalReferenceDraft(null); setRevalCostBookedAtSource(false); setRevalSourceReference("");
    setRevalFiles([]); setRevalAttachments([]); setShowRevalPrintMenu(false);
    setRevalIdempotencyKey(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
    // BR04: the next number of the ĐGL series; the backend still rejects a duplicate (EF02).
    const highest = (apiRows.revaluations || []).map((row: any) => String(row.number || "")).filter((number: string) => /^ĐGL\d+$/.test(number))
      .reduce((max: number, number: string) => Math.max(max, Number(number.slice(3))), 0);
    setRevalVoucherNo(`ĐGL${String(highest + 1).padStart(5, "0")}`);
    setShowRevalModal(true);
  };
  const openRevalRecord = (id: string) => {
    const record = (apiRows.revaluations || []).find((row: any) => row.id === id);
    if (!record) return;
    setEditingRevalId(record.id); setRevalRecord(record); setRevalTab("adjust"); setShowRevalPrintMenu(false);
    setRevalVoucherNo(record.number || ""); setRevalReportNo(record.record_number || "");
    setRevalDate(record.record_date ? toViDate(record.record_date) : ""); setRevalPostingDate(toViDate(record.posting_date));
    setRevalVoucherDate(toViDate(record.document_date)); setRevalConclusion(record.conclusion || "");
    setRevalReason(Object.entries(REVALUATION_REASON_CODES).find(([, code]) => code === record.reason)?.[0] || "Lý do khác");
    setRevalMembers((record.members || []).map((member: any, index: number) => ({ id: index + 1, name: member.full_name, title: member.title, rep: member.representing })));
    setRevalRows((record.lines || []).map((line: any, index: number) => ({
      id: index + 1, assetCode: line.asset_code, assetName: line.asset_name, dept: line.department_name || "",
      origBefore: Number(line.before_original_cost), origAfter: Number(line.after_original_cost),
      origDiff: Number(line.after_original_cost) - Number(line.before_original_cost),
      monthsBefore: Number(line.before_remaining_periods), monthsAfter: Number(line.after_remaining_periods),
      monthsDiff: Number(line.after_remaining_periods) - Number(line.before_remaining_periods),
      deprBefore: Number(line.before_accumulated_depreciation), deprAfter: Number(line.after_accumulated_depreciation),
      deprDiff: Number(line.after_accumulated_depreciation) - Number(line.before_accumulated_depreciation),
      costAccount: line.expense_account_code || "", valBefore: Number(line.before_depreciable_value), valAfter: Number(line.after_depreciable_value),
      valDiff: Number(line.after_depreciable_value) - Number(line.before_depreciable_value), revalAccount: line.revaluation_account_code || "",
      monthlyDeprAfter: Number(line.monthly_depreciation_after), monthlyDeprLawAfter: Number(line.tax_monthly_depreciation_after ?? line.monthly_depreciation_after),
    })));
    setRevalAccountingRows((record.entries || []).map((entry: any, index: number) => ({
      id: index + 1, desc: entry.description, debitAccount: entry.debit_account_code, creditAccount: entry.credit_account_code,
      amount: Number(entry.amount), objectCode: entry.party_code || "", objectName: entry.party_name || "", costItem: entry.expense_item_code || "", dept: entry.department_name || "",
    })));
    setRevalReferences(record.references || []); setRevalReferenceDraft(null);
    setRevalCostBookedAtSource(Boolean(record.cost_booked_at_source)); setRevalSourceReference(record.source_reference || "");
    setRevalFiles([]); setRevalAttachments(record.attachments || []); setRevalIdempotencyKey("");
    setShowRevalModal(true);
  };
  const closeRevalModal = () => {
    if (revalFormState !== revalSnapshot && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    setShowRevalModal(false); setShowRevalPrintMenu(false); setRevalFiles([]);
  };
  /** AF25: the valuation record or the accounting voucher, printed from the saved data. */
  const printRevaluation = (record: any, template: string) => {
    const cell = "border:1px solid #000;padding:4px 6px";
    const money = (value: unknown) => Number(value || 0).toLocaleString("vi-VN");
    const [year, month, day] = String(record.record_date || record.document_date || "").split("-");
    const head = `<table><tr><td><strong>${escapeHtml(_company.name)}</strong></td><td class="center" style="width:240px"><strong>${template === "RECORD" ? "Mẫu số 04 - TSCĐ" : ""}</strong></td></tr></table>`;
    const body = template === "RECORD"
      ? `<div class="center"><h1>BIÊN BẢN ĐÁNH GIÁ LẠI TÀI SẢN CỐ ĐỊNH</h1><div class="muted">Ngày ${escapeHtml(day)} tháng ${escapeHtml(month)} năm ${escapeHtml(year)}</div>
<div>Số: <strong>${escapeHtml(record.record_number || record.number)}</strong> &nbsp; Chứng từ: ${escapeHtml(record.number)}</div></div>
<p>- Lý do: ${escapeHtml(record.reason_label)}</p>
<p>- Hội đồng đánh giá gồm:</p><ul>${(record.members || []).map((member: any) => `<li>${escapeHtml(member.full_name)} – ${escapeHtml(member.title)} – Đại diện ${escapeHtml(member.representing)}</li>`).join("") || "<li>(Không có)</li>"}</ul>
<table><thead><tr><th style="${cell}">Mã TSCĐ</th><th style="${cell}">Tên TSCĐ</th><th style="${cell}">Nguyên giá trước</th><th style="${cell}">Nguyên giá sau</th><th style="${cell}">Hao mòn trước</th><th style="${cell}">Hao mòn sau</th><th style="${cell}">GTCL trước</th><th style="${cell}">GTCL sau</th><th style="${cell}">Tháng còn lại sau</th></tr></thead><tbody>
${(record.lines || []).map((line: any) => `<tr><td style="${cell}">${escapeHtml(line.asset_code)}</td><td style="${cell}">${escapeHtml(line.asset_name)}</td>
<td style="${cell}" class="num">${money(line.before_original_cost)}</td><td style="${cell}" class="num">${money(line.after_original_cost)}</td>
<td style="${cell}" class="num">${money(line.before_accumulated_depreciation)}</td><td style="${cell}" class="num">${money(line.after_accumulated_depreciation)}</td>
<td style="${cell}" class="num">${money(Number(line.before_original_cost) - Number(line.before_accumulated_depreciation))}</td>
<td style="${cell}" class="num">${money(Number(line.after_original_cost) - Number(line.after_accumulated_depreciation))}</td>
<td style="${cell}" class="num">${escapeHtml(line.after_remaining_periods)}</td></tr>`).join("")}</tbody></table>
<p>- Kết luận: ${escapeHtml(record.conclusion)}</p>
<table style="margin-top:24px"><tr class="center"><td class="center"><strong>Kế toán trưởng</strong><br><span class="muted">(Ký, họ tên)</span></td><td class="center"><strong>Chủ tịch hội đồng</strong><br><span class="muted">(Ký, họ tên)</span></td></tr></table>`
      : `<div class="center"><h1>CHỨNG TỪ KẾ TOÁN</h1><div>Số: <strong>${escapeHtml(record.number)}</strong> &nbsp; Ngày hạch toán: ${escapeHtml(toViDate(record.posting_date))}</div></div>
<p>- Nội dung: Đánh giá lại tài sản cố định – ${escapeHtml(record.reason_label)}</p>
<table><thead><tr><th style="${cell}">Diễn giải</th><th style="${cell}">TK Nợ</th><th style="${cell}">TK Có</th><th style="${cell}">Số tiền</th></tr></thead><tbody>
${(record.entries || []).map((entry: any) => `<tr><td style="${cell}">${escapeHtml(entry.description)}</td><td style="${cell}" class="center">${escapeHtml(entry.debit_account_code)}</td><td style="${cell}" class="center">${escapeHtml(entry.credit_account_code)}</td><td style="${cell}" class="num">${money(entry.amount)}</td></tr>`).join("") || `<tr><td style="${cell}" colspan="4">Không phát sinh bút toán</td></tr>`}
</tbody></table>
<table style="margin-top:24px"><tr class="center"><td class="center"><strong>Người lập</strong><br><span class="muted">(Ký, họ tên)</span></td><td class="center"><strong>Kế toán trưởng</strong><br><span class="muted">(Ký, họ tên)</span></td></tr></table>`;
    openPrintFrame(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(record.number)}</title>
<style>body{font-family:"Times New Roman",serif;font-size:13px;color:#000;margin:24px}table{border-collapse:collapse;width:100%}.num{text-align:right}.center{text-align:center}h1{font-size:18px;margin:4px 0}.muted{font-style:italic}</style></head><body>${head}${body}</body></html>`,
      `In ${record.number}`, () => notify("Trình duyệt chặn lệnh in. Vui lòng thử lại."));
  };
  const handleSaveReval = async (printTemplate?: string) => {
    setShowRevalPrintMenu(false);
    let outcome: { record?: any; posted?: boolean; uploaded?: number } | null = null;
    const saved = await apiSave(async (writer) => {
      const result = await saveRevaluation(writer, {
        id: editingRevalId, status: revalRecord?.status, number: revalVoucherNo, recordNumber: revalReportNo, recordDate: revalDate,
        reason: revalReason, documentDate: revalVoucherDate, postingDate: revalPostingDate, conclusion: revalConclusion,
        references: revalReferences, costBookedAtSource: revalCostBookedAtSource, sourceReference: revalSourceReference,
        idempotencyKey: revalIdempotencyKey, members: revalMembers, rows: revalRows, entries: revalAccountingRows, files: revalFiles,
      });
      outcome = result;
      return result;
    });
    const result = outcome as { record?: any; posted?: boolean; uploaded?: number } | null;
    if (result?.record) { setRevalRecord(result.record); setEditingRevalId(result.record.id); setRevalAttachments(result.record.attachments || []); }
    if (result?.uploaded) setRevalFiles((files) => files.slice(result.uploaded));
    if (saved && result?.posted) {
      if (printTemplate) printRevaluation(result.record, printTemplate);
      setShowRevalModal(false); setRevalView("table"); setRevalFiles([]);
      return;
    }
    // Saved but not posted: the draft stays open so the user can correct it and press Cất again.
    if (saved) setRevalSnapshot(revalFormState);
  };
  const unpostReval = async () => {
    const reason = window.prompt("Lý do bỏ ghi sổ chứng từ đánh giá lại");
    if (reason === null) return;
    let updated: any = null;
    const done = await apiSave(async (writer) => {
      const result = await reverseRevaluation(writer, editingRevalId, reason);
      updated = result.record;
      return result;
    });
    if (done && updated) setRevalRecord(updated);
  };
  const addRevalFiles = (list: FileList | null) => {
    const files = Array.from(list || []);
    const refused = files.filter((file) => file.size > ATTACHMENT_MAX_SIZE || !ATTACHMENT_PATTERN.test(file.name));
    if (refused.length) notify(`Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB. (${refused.map((file) => file.name).join(", ")})`);
    const accepted = files.filter((file) => !refused.includes(file));
    if (accepted.length) setRevalFiles((current) => [...current, ...accepted]);
  };
  const downloadRevalAttachment = async (entry: any) => {
    try {
      const response = await fetch(`/api/v1/fixed-assets/revaluations/${editingRevalId}/attachments/${entry.id}/?company_id=${encodeURIComponent(_company.id)}`,
        { headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {} });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = entry.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      notify(`Không tải được tệp ${entry.name}: ${errorText(error)}`);
    }
  };
  const removeRevalAttachment = async (entry: any) => {
    if (!window.confirm(`Xóa tệp đính kèm ${entry.name}?`)) return;
    await apiSave(async (writer) => {
      const record = await writer.action("/api/v1/fixed-assets/revaluations/", editingRevalId, `attachments/${entry.id}/remove`);
      setRevalAttachments(record.attachments || []);
      return { message: `Đã xóa tệp đính kèm ${entry.name}.` };
    });
  };

  // UC-FA-05: Transfer state (Điều chuyển tài sản cố định: ĐCTS00001 -> ĐCTS00002)
  const [transferVouchers, setTransferVouchers] = useState([
    {
      voucherNo: "ĐCTS00001",
      date: "30/09/2026",
      deliverer: "Nguyễn Văn A",
      receiver: "Trần Văn B",
      assetCode: "TSCD001",
      assetName: "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
      fromDept: "Ban Giám đốc",
      toDept: "Khối Văn phòng",
      reason: "Điều chuyển xe phục vụ công tác văn phòng",
      reference: "",
      contract: "",
      order: "",
      project: "",
      costItem: "Chi phí khấu hao TSCĐ",
      costObj: "Khối Văn phòng",
      status: "Đã ghi sổ",
    }
  ]);

  const suggestNextTransferVoucherNo = (existingList = transferVouchers) => {
    let maxSeq = 0;
    for (const v of existingList) {
      const m = /^ĐCTS(?:-?\d{4}-?)?(\d+)$/i.exec(String(v.voucherNo || "").trim());
      if (m) {
        const seq = Number(m[1]);
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return `ĐCTS${String(maxSeq + 1).padStart(5, "0")}`;
  };

  const [transferVoucherNo, setTransferVoucherNo] = useState(() => suggestNextTransferVoucherNo());
  const [transferDate, setTransferDate] = useState("15/10/2026");
  const [transferSender, setTransferSender] = useState("");
  const [transferReceiver, setTransferReceiver] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [showTransferRefInput, setShowTransferRefInput] = useState(false);
  const [transferAttachments, setTransferAttachments] = useState<Array<{ name: string; size: number }>>([]);
  const [transferIsDirty, setTransferIsDirty] = useState(false);
  const [transferRows, setTransferRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      fromDept: "",
      toDept: "",
      contract: "",
      order: "",
      project: "",
      costItem: "",
      costObj: "",
    }
  ]);

  const handleOpenNewTransferModal = () => {
    setTransferVoucherNo(suggestNextTransferVoucherNo(transferVouchers));
    setTransferDate("15/10/2026");
    setTransferSender("");
    setTransferReceiver("");
    setTransferReason("");
    setTransferReference("");
    setShowTransferRefInput(false);
    setTransferAttachments([]);
    setTransferIsDirty(false);
    setTransferRows([
      {
        id: Date.now(),
        assetCode: "",
        assetName: "",
        fromDept: "",
        toDept: "",
        contract: "",
        order: "",
        project: "",
        costItem: "Chi phí khấu hao TSCĐ",
        costObj: "",
      },
    ]);
    setShowTransferModal(true);

    if (apiConnected && _company?.id) {
      fetch(`/api/v1/fixed-assets/transactions/next-transfer-number/?company_id=${encodeURIComponent(_company.id)}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.voucher_no) {
            setTransferVoucherNo(String(data.voucher_no));
          }
        })
        .catch(() => {});
    }
  };

  const handleCancelTransferModal = () => {
    if (transferIsDirty) {
      const ok = typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("Dữ liệu điều chuyển tài sản chưa được lưu. Bạn có chắc chắn muốn hủy bỏ không?")
        : true;
      if (!ok) return;
    }
    setTransferIsDirty(false);
    setShowTransferModal(false);
  };

  const handleSaveTransferVoucher = (printAfter: boolean = false) => {
    const trimmedNo = String(transferVoucherNo || "").trim();
    // EF03
    if (!trimmedNo) {
      notify("Vui lòng nhập số biên bản giao nhận.");
      return;
    }
    // EF04
    if (trimmedNo.length > 50 || !/^[A-Za-zÀ-ỹĐđ0-9_\-/.]+$/.test(trimmedNo)) {
      notify("Số biên bản giao nhận không hợp lệ.");
      return;
    }
    // EF05 / EF06
    if (transferVouchers.some((v) => String(v.voucherNo || "").trim().toLowerCase() === trimmedNo.toLowerCase())) {
      notify("Số biên bản giao nhận đã tồn tại. Vui lòng sử dụng số khác.");
      return;
    }
    // EF08
    const parsedTxDate = parseDeprDateString(transferDate);
    if (!parsedTxDate) {
      notify("Vui lòng nhập ngày điều chuyển hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }
    // EF10
    const trimmedDeliverer = String(transferSender || "").trim();
    if (!trimmedDeliverer) {
      notify("Vui lòng nhập người bàn giao tài sản.");
      return;
    }
    // EF11
    const trimmedReceiver = String(transferReceiver || "").trim();
    if (!trimmedReceiver) {
      notify("Vui lòng nhập người tiếp nhận tài sản.");
      return;
    }
    // EF12
    const trimmedReason = String(transferReason || "").trim();
    if (!trimmedReason) {
      notify("Vui lòng nhập lý do điều chuyển tài sản.");
      return;
    }
    // EF13
    const filledRows = transferRows.filter((r) => String(r.assetCode || "").trim() !== "");
    if (filledRows.length === 0) {
      notify("Vui lòng chọn ít nhất một tài sản cần điều chuyển.");
      return;
    }

    const seenCodes = new Set<string>();
    for (const row of filledRows) {
      const code = String(row.assetCode || "").trim();
      const assetObj: any = assetsList.find((a) => a.code === code);
      // EF14
      if (!assetObj) {
        notify(`Tài sản ${code} không hợp lệ.`);
        return;
      }
      // EF21
      if (seenCodes.has(code)) {
        notify(`Tài sản ${code} đã được chọn trong chứng từ.`);
        return;
      }
      seenCodes.add(code);

      // EF16
      if (
        assetObj.status === "DISPOSED" ||
        assetObj.statusDisplay === "Đã ghi giảm" ||
        decVouchers.some((dv) => dv.assetCode === code)
      ) {
        notify(`Tài sản ${code} đã ghi giảm, không thể điều chuyển.`);
        return;
      }
      // EF15
      const acqDt = parseDeprDateString(assetObj.startDate || assetObj.deprStartDate || "");
      if (acqDt && parsedTxDate.getTime() < acqDt.getTime()) {
        notify(`Tài sản ${code} chưa đủ điều kiện điều chuyển.`);
        return;
      }
      // EF20
      if (row.fromDept && String(row.fromDept).trim() !== String(assetObj.dept || "").trim()) {
        notify("Đơn vị sử dụng của tài sản đã thay đổi. Vui lòng kiểm tra lại.");
        return;
      }
      // EF17
      const toDeptTrimmed = String(row.toDept || "").trim();
      if (!toDeptTrimmed) {
        notify(`Vui lòng chọn đơn vị tiếp nhận cho tài sản ${code}.`);
        return;
      }
      // EF18
      if (toDeptTrimmed.toLowerCase() === String(assetObj.dept || "").trim().toLowerCase()) {
        notify("Đơn vị tiếp nhận phải khác đơn vị hiện đang sử dụng tài sản.");
        return;
      }
      // EF22
      if (transferVouchers.some((tv) => tv.assetCode === code && tv.date === String(transferDate).trim())) {
        notify(`Tài sản ${code} đã có nghiệp vụ điều chuyển tại thời điểm này.`);
        return;
      }
    }

    if (apiConnected) {
      void apiSave((writer) =>
        saveFixedAssetTransfer(writer, {
          voucherNo: trimmedNo,
          date: transferDate,
          deliverer: trimmedDeliverer,
          receiver: trimmedReceiver,
          reason: trimmedReason,
          reference: transferReference,
          attachments: transferAttachments,
          rows: filledRows,
        })
      ).then((saved) => {
        if (saved) {
          setTransferIsDirty(false);
          setShowTransferModal(false);
          setTransferView("table");
          if (printAfter && typeof window !== "undefined" && typeof window.print === "function") {
            setTimeout(() => window.print(), 200);
          }
        }
      });
      return;
    }

    // Update each transferred asset in Sổ tài sản while strictly preserving originalCost, depreciatedAmount, remainingAmount (BR28, Section 5.3-5.5)
    const nowStr = new Date().toLocaleString("vi-VN");
    setAssetsList((prev) =>
      prev.map((a: any) => {
        const matchedRow = filledRows.find((r) => r.assetCode === a.code);
        if (!matchedRow) return a;
        const newDept = String(matchedRow.toDept).trim();
        const newExpItem = String(matchedRow.costItem || "Chi phí khấu hao TSCĐ").trim();
        const newCostObj = String(matchedRow.costObj || matchedRow.project || newDept).trim();
        const existingAllocs = Array.isArray(a.allocations) ? a.allocations : [];
        const updatedAllocs =
          existingAllocs.length > 1
            ? existingAllocs.map((al: any) =>
                al.department === a.dept
                  ? { ...al, department: newDept, expenseItem: newExpItem, costObject: newCostObj }
                  : al
              )
            : [
                {
                  department: newDept,
                  rate: 100,
                  expenseAccount: a.expenseAccount || "6424",
                  expenseItem: newExpItem,
                  costObject: newCostObj,
                },
              ];
        return {
          ...a,
          dept: newDept,
          allocations: updatedAllocs,
          originalCost: a.originalCost,
          depreciatedAmount: a.depreciatedAmount,
          remainingAmount: a.remainingAmount,
        };
      })
    );

    const newVoucherEntries = filledRows.map((r, idx) => ({
      voucherNo: idx === 0 ? trimmedNo : `${trimmedNo}-${String(idx + 1).padStart(2, "0")}`,
      date: String(transferDate).trim(),
      deliverer: trimmedDeliverer,
      receiver: trimmedReceiver,
      assetCode: r.assetCode,
      assetName: r.assetName,
      fromDept: r.fromDept,
      toDept: r.toDept,
      reason: trimmedReason,
      reference: transferReference,
      contract: r.contract || "",
      order: r.order || "",
      project: r.project || "",
      costItem: r.costItem || "Chi phí khấu hao TSCĐ",
      costObj: r.costObj || "",
      status: "Đã ghi sổ",
    }));

    setTransferVouchers((prev) => [...newVoucherEntries, ...prev]);
    setLocalAuditLogsByCode((prev) => {
      const next = { ...prev };
      for (const r of filledRows) {
        next[r.assetCode] = [
          {
            id: `transfer-${Date.now()}-${r.assetCode}`,
            occurredAt: nowStr,
            actor: trimmedDeliverer,
            reason: `${trimmedNo} - ${trimmedReason}`,
            changes: [
              { fieldName: "Đơn vị sử dụng", oldValue: r.fromDept, newValue: r.toDept },
              ...(r.project ? [{ fieldName: "Công trình", oldValue: "", newValue: r.project }] : []),
              ...(r.costItem ? [{ fieldName: "Khoản mục CP", oldValue: "", newValue: r.costItem }] : []),
            ],
          },
          ...(next[r.assetCode] || []),
        ];
      }
      return next;
    });

    setTransferIsDirty(false);
    setShowTransferModal(false);
    setTransferView("table");
    notify("Điều chuyển tài sản cố định thành công.");
    if (printAfter && typeof window !== "undefined" && typeof window.print === "function") {
      setTimeout(() => window.print(), 200);
    }
  };

  // =========================================================================
  // UC-FA-07: GHI GIẢM TÀI SẢN CỐ ĐỊNH (GGTS00001)
  // =========================================================================
  const [decVoucherNo, setDecVoucherNo] = useState("GGTS00001");
  const [decDate, setDecDate] = useState("12/10/2026");
  const [decPostingDate, setDecPostingDate] = useState("12/10/2026");
  const [decReason, setDecReason] = useState("Nhượng bán, thanh lý");
  const [decReference, setDecReference] = useState("");
  const [decAttachments, setDecAttachments] = useState<Array<{ name: string; size: number; type: string }>>([]);
  const [decIsDirty, setDecIsDirty] = useState(false);
  const [showDecReasonDropdown, setShowDecReasonDropdown] = useState(false);
  const [decHoveredReason, setDecHoveredReason] = useState<string | null>(null);
  const [decTab, setDecTab] = useState<"asset" | "accounting">("asset");
  const [decRows, setDecRows] = useState([
    {
      id: 1,
      assetCode: "",
      assetName: "",
      dept: "",
      originalCost: 0,
      deprCost: 0,
      accumulatedDepr: 0,
      remainingValue: 0,
      costAcc: "2113",
      accumulatedAcc: "2141",
      handlingAcc: "811",
    }
  ]);
  const [decAccountingRows, setDecAccountingRows] = useState<Array<{
    id: string;
    assetCode: string;
    description: string;
    debitAcc: string;
    creditAcc: string;
    amount: number;
  }>>([]);
  const [decAccountingCustomEdited, setDecAccountingCustomEdited] = useState(false);
  const [decVouchers, setDecVouchers] = useState([
    {
      voucherNo: "GGTS00001",
      date: "30/09/2026",
      assetCode: "TSCD005",
      assetName: "Xe tải vận chuyển hàng hóa Hyundai HD120",
      reason: "Nhượng bán, thanh lý",
      originalCost: 920000000,
      remainingValue: 638888889,
      status: "Đã ghi sổ",
    }
  ]);

  // Step 4, 21, AF04–AF13, BR15, BR16: Propose TK Xử lý giá trị according to disposal reason
  const proposeDecHandlingAccount = (reason: string): string => {
    switch (reason) {
      case "Nhượng bán, thanh lý":
        return "811";
      case "Phát hiện thiếu khi kiểm kê":
        return "1381";
      case "Góp vốn vào công ty con":
        return "221";
      case "Góp vốn công ty liên doanh":
      case "Góp vốn vào công ty liên kết":
        return "222";
      case "Đầu tư dài hạn khác":
        return "228";
      case "Trả lại TSCĐ thuê tài chính":
        return "2142";
      case "Chuyển TSCĐ thành CCDC":
        return "242";
      default:
        return "811";
    }
  };

  // Step 24–27, AF18, Section 4.6–4.9: Build automatic accounting entries for Tab Hạch toán
  const buildDecAccountingRows = (
    rowsList = decRows,
    reasonVal = decReason
  ): Array<{ id: string; assetCode: string; description: string; debitAcc: string; creditAcc: string; amount: number }> => {
    const entries: Array<{ id: string; assetCode: string; description: string; debitAcc: string; creditAcc: string; amount: number }> = [];
    const filled = rowsList.filter((r) => String(r.assetCode || "").trim());
    for (const [idx, r] of filled.entries()) {
      const accumAmt = Number(r.accumulatedDepr) || 0;
      const remAmt = Number(r.remainingValue) || 0;
      const costAcc = String(r.costAcc || "2112").trim();
      const accumAcc = String(r.accumulatedAcc || "2141").trim();
      const handlingAcc = String(r.handlingAcc || proposeDecHandlingAccount(reasonVal)).trim();

      if (accumAmt > 0) {
        let deprDesc = `Ghi giảm hao mòn lũy kế TSCĐ (${reasonVal})`;
        if (reasonVal === "Nhượng bán, thanh lý") {
          deprDesc = "Ghi giảm hao mòn lũy kế TSCĐ do nhượng bán, thanh lý";
        } else if (reasonVal === "Phát hiện thiếu khi kiểm kê") {
          deprDesc = "Ghi giảm hao mòn lũy kế TSCĐ thiếu khi kiểm kê";
        } else if (reasonVal === "Chuyển TSCĐ thành CCDC") {
          deprDesc = "Ghi giảm hao mòn lũy kế khi chuyển TSCĐ thành CCDC";
        } else if (reasonVal === "Trả lại TSCĐ thuê tài chính") {
          deprDesc = "Ghi giảm hao mòn lũy kế khi trả lại TSCĐ thuê tài chính";
        }
        entries.push({
          id: `dec-ae-${idx}-1`,
          assetCode: r.assetCode,
          description: deprDesc,
          debitAcc: accumAcc,
          creditAcc: costAcc,
          amount: accumAmt,
        });
      }

      // AF18: Only generate 2nd line when remainingValue > 0
      if (remAmt > 0) {
        let remDesc = `Ghi nhận giá trị còn lại của TSCĐ (${reasonVal})`;
        if (reasonVal === "Nhượng bán, thanh lý") {
          remDesc = "Ghi nhận giá trị còn lại của TSCĐ vào chi phí khác";
        } else if (reasonVal === "Phát hiện thiếu khi kiểm kê") {
          remDesc = "Ghi nhận giá trị còn lại của TSCĐ thiếu chờ xử lý";
        } else if (reasonVal === "Chuyển TSCĐ thành CCDC") {
          remDesc = handlingAcc.startsWith("242")
            ? "Kết chuyển giá trị còn lại sang chi phí trả trước"
            : "Kết chuyển giá trị còn lại vào chi phí sản xuất kinh doanh";
        } else if (reasonVal === "Trả lại TSCĐ thuê tài chính") {
          remDesc = "Ghi nhận giá trị còn lại khi trả lại TSCĐ thuê tài chính";
        }
        entries.push({
          id: `dec-ae-${idx}-2`,
          assetCode: r.assetCode,
          description: remDesc,
          debitAcc: handlingAcc,
          creditAcc: costAcc,
          amount: remAmt,
        });
      }
    }
    return entries;
  };

  // Step 7, AF03, BR06: Auto-suggest next sequential disposal voucher number (GGTS00001 -> GGTS00002)
  const suggestNextDecreaseVoucherNo = (existingList = decVouchers): string => {
    const nums = existingList
      .map((v) => {
        const m = String(v.voucherNo || "").match(/^GGTS(?:-\d{4}-)?(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !Number.isNaN(n) && n > 0);
    const nextSeq = (nums.length ? Math.max(...nums) : 0) + 1;
    return `GGTS${String(nextSeq).padStart(5, "0")}`;
  };

  const handleOpenNewDecreaseModal = () => {
    const localSuggested = suggestNextDecreaseVoucherNo(decVouchers);
    setDecVoucherNo(localSuggested);
    setDecDate("12/10/2026");
    setDecPostingDate("12/10/2026");
    setDecReason("Nhượng bán, thanh lý");
    setDecReference("");
    setDecAttachments([]);
    setDecIsDirty(false);
    setDecTab("asset");
    const initRows = [
      {
        id: 1,
        assetCode: "",
        assetName: "",
        dept: "",
        originalCost: 0,
        deprCost: 0,
        accumulatedDepr: 0,
        remainingValue: 0,
        costAcc: "2112",
        accumulatedAcc: "2141",
        handlingAcc: "811",
      },
    ];
    setDecRows(initRows);
    setDecAccountingRows([]);
    setDecAccountingCustomEdited(false);
    setShowDecreaseModal(true);

    if (apiConnected && _company?.id) {
      fetch(`/api/v1/fixed-assets/transactions/next-disposal-number/?company_id=${encodeURIComponent(_company.id)}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.voucher_no) {
            setDecVoucherNo(String(data.voucher_no));
          }
        })
        .catch(() => {});
    }
  };

  const handleCloseDecreaseModal = () => {
    if (decIsDirty) {
      const ok = window.confirm("Dữ liệu chứng từ ghi giảm đã thay đổi nhưng chưa lưu. Bạn có chắc chắn muốn đóng?");
      if (!ok) return;
    }
    setDecIsDirty(false);
    setShowDecreaseModal(false);
  };

  // Step 28, EF29: Validate attachment <= 5MB and allowed file format
  const handleDecAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxBytes = 5 * 1024 * 1024;
    const allowedExts = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".csv", ".txt"];
    const nextList = [...decAttachments];
    for (const f of files) {
      const dot = f.name.lastIndexOf(".");
      const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : "";
      if (f.size > maxBytes || (ext && !allowedExts.includes(ext))) {
        notify("Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.");
        e.target.value = "";
        return;
      }
      nextList.push({ name: f.name, size: f.size, type: f.type || "application/octet-stream" });
    }
    setDecAttachments(nextList);
    setDecIsDirty(true);
    e.target.value = "";
  };

  // Steps 29–40, EF02–EF25, BR01–BR40: Validate and save disposal voucher
  const handleSaveDecrease = (printAfter: boolean = false) => {
    const parseDdMmYyyy = (str: string): Date | null => {
      const m = String(str || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return null;
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const y = parseInt(m[3], 10);
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
      return dt;
    };

    // EF02: Validate Lý do ghi giảm
    const trimmedReason = String(decReason || "").trim();
    if (!trimmedReason || !DECREASE_REASONS.includes(trimmedReason)) {
      notify("Vui lòng chọn lý do ghi giảm tài sản cố định.");
      return;
    }

    // EF03: Validate Ngày hạch toán
    const postDt = parseDdMmYyyy(decPostingDate);
    if (!postDt) {
      notify("Vui lòng nhập ngày hạch toán hợp lệ.");
      return;
    }

    // EF04: Validate Ngày chứng từ (<= Ngày hạch toán)
    const vchDt = parseDdMmYyyy(decDate);
    if (!vchDt || vchDt.getTime() > postDt.getTime()) {
      notify("Vui lòng nhập ngày chứng từ hợp lệ.");
      return;
    }

    // EF06 & EF07: Validate Số chứng từ
    const trimmedNo = String(decVoucherNo || "").trim();
    if (!trimmedNo || trimmedNo.length > 50 || !/^[A-Za-z0-9Đđ_-]+$/.test(trimmedNo)) {
      notify("Số chứng từ ghi giảm không hợp lệ.");
      return;
    }
    if (decVouchers.some((v) => v.voucherNo.toLowerCase() === trimmedNo.toLowerCase())) {
      notify("Số chứng từ ghi giảm đã tồn tại.");
      return;
    }

    // EF08: Must select at least one asset
    const filledRows = decRows.filter((r) => String(r.assetCode || "").trim() !== "");
    if (filledRows.length === 0) {
      notify("Vui lòng chọn ít nhất một tài sản cần ghi giảm.");
      return;
    }

    // Per-row validations (EF09–EF15, EF20, EF22, EF23)
    const seenCodes = new Set<string>();
    const allowedHandlingPrefixes: Record<string, string[]> = {
      "Nhượng bán, thanh lý": ["811", "353", "466", "138"],
      "Phát hiện thiếu khi kiểm kê": ["1381", "1388", "138", "334", "811", "111", "112"],
      "Góp vốn vào công ty con": ["221"],
      "Góp vốn công ty liên doanh": ["222"],
      "Góp vốn vào công ty liên kết": ["222"],
      "Đầu tư dài hạn khác": ["228"],
      "Trả lại TSCĐ thuê tài chính": ["2142", "214", "3412", "341", "811", "138", "711"],
      "Chuyển TSCĐ thành CCDC": ["242", "627", "641", "642", "153"],
    };

    for (const r of filledRows) {
      const code = String(r.assetCode || "").trim();
      const asset = assetsList.find((a) => a.code === code);
      // EF09
      if (!asset) {
        notify(`Tài sản ${code} không hợp lệ.`);
        return;
      }
      // EF12
      if (seenCodes.has(code.toUpperCase())) {
        notify(`Tài sản ${code} đã được chọn trong chứng từ.`);
        return;
      }
      seenCodes.add(code.toUpperCase());

      // EF11
      if ((asset as any).status === "DISPOSED" || (asset as any).statusDisplay === "Đã ghi giảm") {
        notify(`Tài sản ${code} đã được ghi giảm.`);
        return;
      }
      // EF10
      if ((asset as any).status === "DRAFT") {
        notify(`Tài sản ${code} chưa đủ điều kiện ghi giảm.`);
        return;
      }

      // EF14 & EF15
      const orig = Number(r.originalCost) || 0;
      const accum = Number(r.accumulatedDepr) || 0;
      const rem = Number(r.remainingValue) || 0;
      if (accum < 0 || accum > orig) {
        notify("Hao mòn lũy kế của tài sản không hợp lệ.");
        return;
      }
      if (rem < 0 || rem !== orig - accum) {
        notify("Giá trị còn lại của tài sản không hợp lệ.");
        return;
      }

      // EF22: Validate TK Nguyên giá & TK Hao mòn
      const costAcc = String(r.costAcc || "").trim();
      const accumAcc = String(r.accumulatedAcc || "").trim();
      if (!/^(211|212|213)/.test(costAcc) || !/^214/.test(accumAcc)) {
        notify("Tài khoản nguyên giá hoặc hao mòn TSCĐ không hợp lệ.");
        return;
      }

      // EF20: Finance lease return check
      if (trimmedReason === "Trả lại TSCĐ thuê tài chính" && !costAcc.startsWith("212") && !accumAcc.startsWith("2142")) {
        notify("Tài sản không thuộc loại TSCĐ thuê tài chính.");
        return;
      }

      // EF23: Validate TK Xử lý giá trị against reason
      const handlingAcc = String(r.handlingAcc || "").trim();
      const allowedPrefs = allowedHandlingPrefixes[trimmedReason] || ["811"];
      if (!handlingAcc || !allowedPrefs.some((p) => handlingAcc.startsWith(p))) {
        notify("Tài khoản xử lý giá trị không phù hợp với lý do ghi giảm.");
        return;
      }
    }

    // EF24 & EF25: Validate Tab Hạch toán
    const activeAccountingRows =
      decAccountingCustomEdited && decAccountingRows.length > 0
        ? decAccountingRows
        : buildDecAccountingRows(filledRows, trimmedReason);

    const totalOrig = filledRows.reduce((s, r) => s + (Number(r.originalCost) || 0), 0);
    let totalAssetCredit = 0;
    for (const ae of activeAccountingRows) {
      const dr = String(ae.debitAcc || "").trim();
      const cr = String(ae.creditAcc || "").trim();
      const amt = Number(ae.amount) || 0;
      if (!dr || !cr || dr === cr || amt <= 0) {
        notify("Bút toán ghi giảm không cân đối. Vui lòng kiểm tra lại.");
        return;
      }
      if (/^(211|212|213)/.test(cr)) {
        totalAssetCredit += amt;
      }
    }
    if (totalAssetCredit !== totalOrig) {
      notify("Số tiền ghi giảm nguyên giá không khớp với danh sách tài sản.");
      return;
    }

    if (apiConnected) {
      void apiSave((writer) =>
        saveFixedAssetDisposal(writer, {
          voucherNo: trimmedNo,
          postingDate: decPostingDate,
          voucherDate: decDate,
          date: decDate,
          reason: trimmedReason,
          reference: decReference,
          rows: filledRows,
          accountingRows: activeAccountingRows,
          attachments: decAttachments,
        })
      ).then((saved) => {
        if (saved) {
          setDecIsDirty(false);
          setShowDecreaseModal(false);
          setDecreaseView("table");
          if (printAfter && typeof window !== "undefined" && typeof window.print === "function") {
            setTimeout(() => window.print(), 200);
          }
        }
      });
      return;
    }

    // Step 35, 36, BR32, BR33: Update assetsList status to DISPOSED ("Đã ghi giảm")
    const nowStr = new Date().toLocaleString("vi-VN");
    setAssetsList((prev) =>
      prev.map((a: any) => {
        const matchedRow = filledRows.find((r) => r.assetCode === a.code);
        if (!matchedRow) return a;
        return {
          ...a,
          status: "DISPOSED",
          statusDisplay: "Đã ghi giảm",
          disposedAt: decPostingDate,
        };
      })
    );

    const newVoucherEntries = filledRows.map((r, idx) => ({
      voucherNo: idx === 0 ? trimmedNo : `${trimmedNo}-${String(idx + 1).padStart(2, "0")}`,
      date: decDate || "12/10/2026",
      assetCode: r.assetCode,
      assetName: r.assetName,
      reason: trimmedReason,
      originalCost: Number(r.originalCost) || 0,
      remainingValue: Number(r.remainingValue) || 0,
      status: "Đã ghi sổ",
    }));

    setDecVouchers((prev) => [...newVoucherEntries, ...prev]);

    setLocalAuditLogsByCode((prev) => {
      const next = { ...prev };
      for (const r of filledRows) {
        next[r.assetCode] = [
          {
            id: `dispose-${Date.now()}-${r.assetCode}`,
            occurredAt: nowStr,
            actor: "Kế toán TSCĐ",
            reason: `${trimmedNo} - ${trimmedReason}`,
            changes: [
              { fieldName: "Trạng thái", oldValue: "Đang sử dụng", newValue: "Đã ghi giảm" },
              { fieldName: "TK Xử lý giá trị", oldValue: "", newValue: r.handlingAcc },
            ],
          },
          ...(next[r.assetCode] || []),
        ];
      }
      return next;
    });

    setDecIsDirty(false);
    setShowDecreaseModal(false);
    setDecreaseView("table");
    notify("Ghi giảm tài sản cố định thành công.");
    if (printAfter && typeof window !== "undefined" && typeof window.print === "function") {
      setTimeout(() => window.print(), 200);
    }
  };

  // Stocktake state (Ảnh 1, 2, 3 mới của người dùng: KKTS00001)
  const [stocktakeVouchers, setStocktakeVouchers] = useState([
    {
      voucherNo: "KKTS00001",
      date: "12/10/2026 11:23:21",
      auditDate: "12/10/2026",
      purpose: "Kiểm kê tài sản cố định định kỳ",
      totalAssets: 1,
      matchedAssets: 1,
      diffAssets: 0,
      conclusion: "",
      status: "Đã ghi sổ",
    },
    {
      voucherNo: "BBKK-2026/09",
      date: "30/09/2026 09:15:00",
      auditDate: "30/09/2026",
      purpose: "Kiểm kê TSCĐ định kỳ Quý 3/2026",
      totalAssets: 5,
      matchedAssets: 5,
      diffAssets: 0,
      conclusion: "Khớp sổ sách 100%, tình trạng tài sản hoạt động tốt",
      status: "Đã ghi sổ",
    }
  ]);

  // Bảng kiểm kê tài sản cố định KKTS00001 (UC-FA-08 – Kiểm kê tài sản)
  type StocktakeRowItem = {
    id: string;
    assetCode: string;
    assetName: string;
    dept: string;
    actualDept: string;
    cost: number;
    deprCost: number;
    accumDepr: number;
    remainCost: number;
    existenceStatus: "UNCOUNTED" | "EXISTS" | "MISSING";
    exists: boolean | null;
    isSurplus?: boolean;
    identificationInfo?: string;
    currentQuality: string;
    recommendation: string;
    resolutionVoucherNo?: string;
    note: string;
  };

  const [stocktakeVoucherNo, setStocktakeVoucherNo] = useState("KKTS00002");
  const [stocktakeDate, setStocktakeDate] = useState("12/10/2026 11:23:21");
  const [stocktakeAuditDate, setStocktakeAuditDate] = useState("12/10/2026");
  const [stocktakePurpose, setStocktakePurpose] = useState("Kiểm kê tài sản cố định định kỳ");
  const [stocktakeReference, setStocktakeReference] = useState("");
  const [stocktakeScopeDept, setStocktakeScopeDept] = useState("ALL");
  const [stocktakeScopeCategory, setStocktakeScopeCategory] = useState("ALL");
  const [stocktakeMembersOpen, setStocktakeMembersOpen] = useState(false);
  const [stocktakeConclusion, setStocktakeConclusion] = useState("");
  const [stocktakeProcessed, setStocktakeProcessed] = useState(false);
  const [stocktakeRowsPerPage, setStocktakeRowsPerPage] = useState("50");
  const [stocktakeCurrentPage, setStocktakeCurrentPage] = useState(1);
  const [stocktakeAttachments, setStocktakeAttachments] = useState<Array<{ name: string; size: number }>>([]);
  const [stocktakeIsDirty, setStocktakeIsDirty] = useState(false);
  const [stocktakeRows, setStocktakeRows] = useState<StocktakeRowItem[]>([
    {
      id: "1",
      assetCode: "",
      assetName: "",
      dept: "",
      actualDept: "",
      cost: 0,
      deprCost: 0,
      accumDepr: 0,
      remainCost: 0,
      existenceStatus: "UNCOUNTED",
      exists: null,
      isSurplus: false,
      currentQuality: "",
      recommendation: "",
      note: "",
    }
  ]);
  const [stocktakeMembers, setStocktakeMembers] = useState([
    { id: "1", name: "Nguyễn Văn Tuấn", position: "Trưởng ban", represent: "Ban Giám đốc", role: "Trưởng ban" },
    { id: "2", name: "Trần Thị Mai", position: "Kế toán trưởng", represent: "Phòng Kế toán", role: "Ủy viên" },
    { id: "3", name: "Lê Văn Hùng", position: "Thủ kho", represent: "Bộ phận QLTS", role: "Thư ký" },
  ]);

  const computeNextStocktakeVoucherNo = () => {
    let maxSeq = 0;
    for (const v of stocktakeVouchers) {
      const m = String(v.voucherNo || "").trim().match(/^KKTS(\d+)$/i);
      if (m) {
        const seq = parseInt(m[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
    return `KKTS${String(maxSeq + 1).padStart(5, "0")}`;
  };

  const hasStocktakeQualityIssue = (qualityStr: string) => {
    const norm = String(qualityStr || "").trim().toLowerCase();
    if (!norm || ["bình thường", "binh thuong", "tốt", "tot", "đang sử dụng tốt", "hoạt động tốt"].includes(norm)) {
      return false;
    }
    return [
      "hư hỏng",
      "hu hong",
      "xuống cấp",
      "xuong cap",
      "không sử dụng được",
      "cần sửa chữa",
      "chờ thanh lý",
      "lạc hậu",
      "hỏng",
    ].some((kw) => norm.includes(kw));
  };

  // Section 4.1–4.8: Live reconciliation summary metrics
  const stocktakeSummary = (() => {
    const validRows = stocktakeRows.filter((r) => Boolean(r.isSurplus || String(r.assetCode || r.assetName || "").trim()));
    const bookRows = validRows.filter((r) => !r.isSurplus);
    const surplusRows = validRows.filter((r) => Boolean(r.isSurplus));
    let verifiedExistingCount = 0;
    let matchedCount = 0;
    let missingCount = 0;
    let deptMismatchCount = 0;
    let qualityIssueCount = 0;
    let uncountedCount = 0;
    let totalCost = 0;
    let totalDeprCost = 0;
    let totalAccumDepr = 0;
    let totalRemainCost = 0;

    for (const r of bookRows) {
      const c = Number(r.cost || 0);
      const dc = Number(r.deprCost || c);
      const ac = Math.min(c, Math.max(0, Number(r.accumDepr || 0)));
      const rc = Math.max(0, c - ac);
      totalCost += c;
      totalDeprCost += dc;
      totalAccumDepr += ac;
      totalRemainCost += rc;

      if (r.existenceStatus === "UNCOUNTED" || r.exists === null) {
        uncountedCount += 1;
      } else if (r.existenceStatus === "MISSING" || r.exists === false) {
        missingCount += 1;
      } else {
        verifiedExistingCount += 1;
        const bookDept = String(r.dept || "").trim();
        const actDept = String(r.actualDept || r.dept || "").trim();
        if (bookDept && actDept && bookDept.toLowerCase() !== actDept.toLowerCase()) {
          deptMismatchCount += 1;
        } else {
          matchedCount += 1;
        }
        if (hasStocktakeQualityIssue(r.currentQuality)) {
          qualityIssueCount += 1;
        }
      }
    }

    for (const sr of surplusRows) {
      if (hasStocktakeQualityIssue(sr.currentQuality)) {
        qualityIssueCount += 1;
      }
    }

    const surplusCount = surplusRows.length;
    const diffCount = missingCount + surplusCount + deptMismatchCount;
    return {
      bookAssetsCount: bookRows.length,
      verifiedExistingCount,
      matchedCount,
      missingCount,
      deptMismatchCount,
      surplusCount,
      diffCount,
      qualityIssueCount,
      uncountedCount,
      totalCost,
      totalDeprCost,
      totalAccumDepr,
      totalRemainCost,
    };
  })();

  const handleOpenNewStocktake = () => {
    const nextNo = computeNextStocktakeVoucherNo();
    setStocktakeVoucherNo(nextNo);
    setStocktakeDate("12/10/2026 11:23:21");
    setStocktakeAuditDate("12/10/2026");
    setStocktakePurpose("Kiểm kê tài sản cố định định kỳ");
    setStocktakeReference("");
    setStocktakeScopeDept("ALL");
    setStocktakeScopeCategory("ALL");
    setStocktakeConclusion("");
    setStocktakeProcessed(false);
    setStocktakeMembersOpen(false);
    setStocktakeCurrentPage(1);
    setStocktakeAttachments([]);
    setStocktakeIsDirty(false);
    setStocktakeRows([
      {
        id: "1",
        assetCode: "",
        assetName: "",
        dept: "",
        actualDept: "",
        cost: 0,
        deprCost: 0,
        accumDepr: 0,
        remainCost: 0,
        existenceStatus: "UNCOUNTED",
        exists: null,
        isSurplus: false,
        currentQuality: "",
        recommendation: "",
        note: "",
      }
    ]);
    setShowStocktakeModal(true);

    if (apiConnected && _company?.id) {
      fetch(`/api/v1/fixed-assets/counts/next-number/?company_id=${encodeURIComponent(_company.id)}&asset_type=FIXED_ASSET`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.voucher_no) {
            setStocktakeVoucherNo(String(data.voucher_no));
          }
        })
        .catch(() => {});
    }
  };

  const handleCloseStocktakeModal = () => {
    if (stocktakeIsDirty) {
      const ok = window.confirm("Dữ liệu biên bản kiểm kê chưa được lưu. Bạn có chắc chắn muốn đóng?");
      if (!ok) return;
    }
    setStocktakeIsDirty(false);
    setShowStocktakeModal(false);
  };

  // Steps 14–16, AF06, AF07, AF08, BR11–BR17: Nạp danh sách TSCĐ đang theo dõi tại ngày kiểm kê
  const handleLoadBookAssetsForStocktake = () => {
    const auditDt = parseDeprDateString(stocktakeAuditDate);
    if (!auditDt) {
      notify("Vui lòng nhập ngày kiểm kê hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }
    if (apiConnected) {
      void apiSave(async (writer) => {
        const res = await loadBookAssetsForStocktakeUc08(writer, {
          assetType: "FIXED_ASSET",
          countDate: stocktakeAuditDate,
          departmentName: stocktakeScopeDept === "ALL" ? "" : stocktakeScopeDept,
          categoryName: stocktakeScopeCategory === "ALL" ? "" : stocktakeScopeCategory,
        });
        const apiAssets = Array.isArray(res?.record?.assets) ? res.record.assets : [];
        if (apiAssets.length > 0) {
          const mappedApi: StocktakeRowItem[] = apiAssets.map((a: any, i: number) => ({
            id: String(i + 1),
            assetCode: String(a.asset_code || a.code || ""),
            assetName: String(a.asset_name || a.name || ""),
            dept: String(a.department_name || a.dept || ""),
            actualDept: String(a.actual_department_name || a.department_name || a.dept || ""),
            cost: Number(a.original_cost || a.cost || 0),
            deprCost: Number(a.depreciable_cost || a.original_cost || 0),
            accumDepr: Number(a.accumulated_depreciation || 0),
            remainCost: Number(a.remaining_value || 0),
            existenceStatus: "UNCOUNTED",
            exists: null,
            isSurplus: false,
            currentQuality: "",
            recommendation: "",
            note: Number(a.remaining_value || 0) === 0 ? "Đã khấu hao hết, còn sử dụng" : "",
          }));
          setStocktakeRows(mappedApi);
          setStocktakeCurrentPage(1);
          setStocktakeIsDirty(true);
        }
        return res;
      });
    }
    const eligible = assetsList.filter((a: any) => {
      if (a.status === "DISPOSED" || a.statusDisplay === "Đã ghi giảm" || decVouchers.some((dv) => dv.assetCode === a.code)) {
        return false;
      }
      if (stocktakeScopeDept !== "ALL" && String(a.dept || "").trim() !== stocktakeScopeDept) {
        return false;
      }
      if (stocktakeScopeCategory !== "ALL" && String(a.category || "").trim() !== stocktakeScopeCategory) {
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      setStocktakeRows([]);
      notify("Không có tài sản cố định thuộc phạm vi kiểm kê tại ngày đã chọn.");
      return;
    }

    // BR14 & Step 15: Khởi tạo trạng thái 'Chưa kiểm kê' (UNCOUNTED, exists: null), không tự động mặc định Tồn tại
    const mapped: StocktakeRowItem[] = eligible.map((a: any, i: number) => {
      const orig = Number(a.originalCost || 0);
      const accum = Math.min(orig, Math.max(0, Number(a.depreciatedAmount || 0)));
      const rem = Math.max(0, orig - accum);
      return {
        id: String(i + 1),
        assetCode: a.code,
        assetName: a.name,
        dept: a.dept || "",
        actualDept: a.dept || "",
        cost: orig,
        deprCost: Number(a.deprCostValue || orig),
        accumDepr: accum,
        remainCost: rem,
        existenceStatus: "UNCOUNTED",
        exists: null,
        isSurplus: false,
        currentQuality: "",
        recommendation: "",
        note: rem === 0 ? "Đã khấu hao hết, còn sử dụng" : "",
      };
    });
    setStocktakeRows(mapped);
    setStocktakeCurrentPage(1);
    setStocktakeIsDirty(true);
    notify(`Đã nạp ${mapped.length} tài sản cố định tại ngày ${stocktakeAuditDate} (trạng thái: Chưa kiểm kê).`);
  };

  // AF11, EF17, BR22, BR32: Bổ sung tài sản phát hiện thừa ngoài sổ kế toán
  const handleAddSurplusStocktakeRow = () => {
    const surplusIdx = stocktakeRows.filter((r) => r.isSurplus).length + 1;
    const tempCode = `THUA-${String(surplusIdx).padStart(3, "0")}`;
    setStocktakeRows((prev) => [
      ...prev,
      {
        id: `surplus-${Date.now()}`,
        assetCode: tempCode,
        assetName: "",
        dept: "",
        actualDept: stocktakeScopeDept !== "ALL" ? stocktakeScopeDept : (departmentOptions[0] || "Phòng Hành chính"),
        cost: 0,
        deprCost: 0,
        accumDepr: 0,
        remainCost: 0,
        existenceStatus: "EXISTS",
        exists: true,
        isSurplus: true,
        identificationInfo: "",
        currentQuality: "Bình thường",
        recommendation: "Xác minh nguồn gốc để ghi tăng",
        note: "",
      },
    ]);
    setStocktakeIsDirty(true);
  };

  // UC-FA-08 Steps 34–46 & EF02–EF26: Xác thực và lưu biên bản kiểm kê TSCĐ
  const handleSaveStocktake = (isPrint: boolean = false) => {
    // EF02: Mục đích kiểm kê
    const trimmedPurpose = String(stocktakePurpose || "").trim();
    if (!trimmedPurpose) {
      notify("Vui lòng nhập mục đích kiểm kê.");
      return;
    }

    // EF03: Kiểm kê đến ngày
    const auditDt = parseDeprDateString(stocktakeAuditDate);
    if (!auditDt) {
      notify("Vui lòng nhập ngày kiểm kê hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }

    // EF05: Ngày lập biên bản không được nhỏ hơn ngày kiểm kê
    const reportDatePart = String(stocktakeDate || "").trim().split(" ")[0];
    const reportDt = parseDeprDateString(reportDatePart);
    if (!reportDt || reportDt.getTime() < auditDt.getTime()) {
      notify("Ngày lập biên bản không phù hợp với ngày kiểm kê.");
      return;
    }

    // EF06 & EF07: Số chứng từ kiểm kê
    const trimmedNo = String(stocktakeVoucherNo || "").trim();
    if (!trimmedNo || trimmedNo.length > 50 || !/^[A-Za-z0-9Đđ/_-]+$/.test(trimmedNo)) {
      notify("Vui lòng nhập số chứng từ kiểm kê hợp lệ.");
      return;
    }
    if (stocktakeVouchers.some((v) => String(v.voucherNo || "").toLowerCase() === trimmedNo.toLowerCase())) {
      notify("Số chứng từ kiểm kê đã tồn tại.");
      return;
    }

    // EF08: Thành viên tham gia kiểm kê
    const seenMembers = new Set<string>();
    for (const m of stocktakeMembers) {
      const mName = String(m.name || "").trim();
      const hasAnyField = Boolean(mName || String(m.position || "").trim() || String(m.represent || "").trim());
      if (hasAnyField && !mName) {
        notify("Vui lòng khai báo đầy đủ thành viên tham gia kiểm kê.");
        return;
      }
      if (mName) {
        const key = mName.toLowerCase();
        if (seenMembers.has(key)) {
          notify("Vui lòng khai báo đầy đủ thành viên tham gia kiểm kê.");
          return;
        }
        seenMembers.add(key);
      }
    }

    // EF09: Danh sách tài sản kiểm kê
    const filledRows = stocktakeRows.filter((r) => Boolean(r.isSurplus || String(r.assetCode || r.assetName || "").trim()));
    if (filledRows.length === 0) {
      notify("Chưa có tài sản trong bảng kiểm kê.");
      return;
    }

    // EF11–EF19: Kiểm tra từng dòng tài sản
    const seenBookCodes = new Set<string>();
    for (const r of filledRows) {
      if (r.isSurplus) {
        // EF17: Tài sản thừa ngoài sổ
        if (
          !String(r.assetName || "").trim() ||
          !String(r.actualDept || r.dept || "").trim() ||
          !String(r.identificationInfo || r.note || r.assetCode || "").trim()
        ) {
          notify("Vui lòng bổ sung thông tin nhận dạng tài sản thừa.");
          return;
        }
        continue;
      }

      const code = String(r.assetCode || "").trim();
      if (!code) {
        notify("Vui lòng chọn mã tài sản hợp lệ.");
        return;
      }
      const codeKey = code.toLowerCase();
      if (seenBookCodes.has(codeKey)) {
        // EF13
        notify(`Tài sản ${code} đã có trong bảng kiểm kê.`);
        return;
      }
      seenBookCodes.add(codeKey);

      const foundAsset: any = assetsList.find((a) => String(a.code || "").toLowerCase() === codeKey);
      if (!foundAsset) {
        // EF11
        notify(`Tài sản ${code} không hợp lệ.`);
        return;
      }
      if (foundAsset.status === "DISPOSED" || foundAsset.statusDisplay === "Đã ghi giảm") {
        // EF12
        notify(`Tài sản ${code} không thuộc danh sách tài sản đang theo dõi tại ngày kiểm kê.`);
        return;
      }

      if (r.existenceStatus === "UNCOUNTED" || r.exists === null) {
        // EF14
        notify("Còn tài sản chưa được xác nhận kết quả kiểm kê. Vui lòng kiểm tra lại.");
        return;
      }

      const qual = String(r.currentQuality || "").trim();
      const rec = String(r.recommendation || "").trim();
      const noteStr = String(r.note || "").trim();

      if (r.existenceStatus === "MISSING" || r.exists === false) {
        // EF19: Mâu thuẫn kết quả
        if (["tiếp tục sử dụng", "đang sử dụng bình thường"].includes(rec.toLowerCase())) {
          notify(`Kết quả kiểm kê của tài sản ${code} không nhất quán.`);
          return;
        }
        // EF15: Tài sản thiếu phải có tình trạng/ghi chú và kiến nghị xử lý
        if (!(qual || noteStr) || !rec) {
          notify(`Vui lòng ghi rõ tình trạng và kiến nghị xử lý đối với tài sản ${code}.`);
          return;
        }
      } else {
        // EF16: Tài sản tồn tại nhưng chất lượng bất thường phải có kiến nghị xử lý
        if (hasStocktakeQualityIssue(qual) && (!qual || !rec)) {
          notify(`Vui lòng bổ sung tình trạng và kiến nghị xử lý cho tài sản ${code}.`);
          return;
        }
      }
    }

    // EF20: Kết luận mâu thuẫn với kết quả đối chiếu
    const conclusionStr = String(stocktakeConclusion || "").trim();
    const conclusionLower = conclusionStr.toLowerCase();
    if (
      stocktakeSummary.diffCount > 0 &&
      ["khớp 100%", "khớp sổ sách 100%", "khớp hoàn toàn", "không phát sinh chênh lệch", "không có chênh lệch"].some((p) =>
        conclusionLower.includes(p)
      )
    ) {
      notify("Kết luận kiểm kê không khớp với kết quả đối chiếu. Vui lòng kiểm tra lại.");
      return;
    }

    // EF21 & EF22: Kiểm tra tích chọn 'Đã xử lý kiến nghị'
    if (stocktakeProcessed) {
      const actionableRows = filledRows.filter((r) => {
        if (r.isSurplus || r.existenceStatus === "MISSING" || r.exists === false) return true;
        const bDept = String(r.dept || "").trim();
        const aDept = String(r.actualDept || r.dept || "").trim();
        if (bDept && aDept && bDept.toLowerCase() !== aDept.toLowerCase()) return true;
        if (hasStocktakeQualityIssue(r.currentQuality)) return true;
        return false;
      });
      for (const ar of actionableRows) {
        if (String(ar.recommendation || "").toLowerCase().includes("tiếp tục xác minh")) {
          notify("Còn kiến nghị kiểm kê chưa được xử lý. Không thể xác nhận đã xử lý kiến nghị.");
          return;
        }
      }
      if (actionableRows.length > 0 && !String(stocktakeReference || "").trim()) {
        const allHaveRowVoucher = actionableRows.every((ar) => Boolean(String(ar.resolutionVoucherNo || "").trim()));
        if (!allHaveRowVoucher) {
          notify("Vui lòng bổ sung chứng từ hoặc kết quả xử lý kiến nghị.");
          return;
        }
      }
    }

    // EF26: Tệp đính kèm (<= 5MB)
    for (const att of stocktakeAttachments) {
      if (Number(att.size || 0) > 5 * 1024 * 1024) {
        notify("Tệp đính kèm không hợp lệ hoặc vượt quá dung lượng cho phép (tối đa 5MB).");
        return;
      }
    }

    if (apiConnected) {
      const existingCount = (apiRows.assetCounts || []).find(
        (c: any) => String(c.number || c.voucher_no || "").toLowerCase() === trimmedNo.toLowerCase()
      );
      void apiSave((writer) =>
        existingCount?.id
          ? updateStocktakeVoucherUc08(writer, String(existingCount.id), {
              auditDate: stocktakeAuditDate,
              reportDatetime: stocktakeDate,
              purpose: trimmedPurpose,
              conclusion: conclusionStr,
              recommendationsProcessed: stocktakeProcessed,
              members: stocktakeMembers,
              lines: filledRows,
            })
          : saveAssetCount(writer, "FIXED_ASSET", {
              voucherNo: trimmedNo,
              number: trimmedNo,
              auditDate: stocktakeAuditDate,
              date: stocktakeAuditDate,
              reportDatetime: stocktakeDate,
              purpose: trimmedPurpose,
              conclusion: conclusionStr,
              reference: stocktakeReference,
              recommendationsProcessed: stocktakeProcessed,
              scope: {
                department_name: stocktakeScopeDept === "ALL" ? "" : stocktakeScopeDept,
                category_name: stocktakeScopeCategory === "ALL" ? "" : stocktakeScopeCategory,
              },
              members: stocktakeMembers,
              attachments: stocktakeAttachments,
              rows: filledRows,
            })
      ).then((saved) => {
        if (saved) {
          setStocktakeIsDirty(false);
          setShowStocktakeModal(false);
          setStocktakeView("table");
        }
      });
      return;
    }

    // Step 41 & BR37: Lưu biên bản kiểm kê KHÔNG tự động sửa đổi nguyên giá, hao mòn, đơn vị hoặc trạng thái trên Sổ tài sản
    const newV = {
      voucherNo: trimmedNo,
      date: stocktakeDate || "12/10/2026 11:23:21",
      auditDate: stocktakeAuditDate || "12/10/2026",
      purpose: trimmedPurpose,
      totalAssets: stocktakeSummary.bookAssetsCount,
      matchedAssets: stocktakeSummary.matchedCount,
      diffAssets: stocktakeSummary.diffCount,
      conclusion: conclusionStr,
      status: stocktakeProcessed ? "Đã xử lý kiến nghị" : "Đã hoàn tất",
    };
    setStocktakeVouchers((prev) => [newV, ...prev]);
    setStocktakeIsDirty(false);
    setShowStocktakeModal(false);
    setStocktakeView("table");
    notify("Lưu biên bản kiểm kê tài sản cố định thành công.");
    if (isPrint && typeof window !== "undefined" && typeof window.print === "function") {
      setTimeout(() => window.print(), 200);
    }
  };

  // =========================================================================
  // UC-FA-09: SỔ TÀI SẢN CỐ ĐỊNH & BÁO CÁO TÀI SẢN CỐ ĐỊNH (STATE)
  // =========================================================================
  // Main Flow A – Sổ tài sản cố định (Steps 4–25, AF02–AF08)
  const [registerAsOfDate, setRegisterAsOfDate] = useState("31/12/2026");
  const [registerCategoryFilter, setRegisterCategoryFilter] = useState("all");
  const [registerIncludeDisposed, setRegisterIncludeDisposed] = useState(false);
  const [registerPageSize, setRegisterPageSize] = useState<number>(50);
  const [registerCurrentPage, setRegisterCurrentPage] = useState<number>(1);

  // Main Flow B – Báo cáo tài sản cố định (Steps 1–24, AF09–AF16)
  const [reportSearch, setReportSearch] = useState("");
  const [reportLang, setReportLang] = useState<"vi" | "en">("vi");
  const [assetReportsOpen, setAssetReportsOpen] = useState(true);
  const [reconcileReportsOpen, setReconcileReportsOpen] = useState(true);
  const [previewReportCode, setPreviewReportCode] = useState<string | null>(null);
  const [reportPeriodPreset, setReportPeriodPreset] = useState("YEAR_2026");
  const [reportYear, setReportYear] = useState<number>(2026);
  const [reportFromDate, setReportFromDate] = useState("01/01/2026");
  const [reportToDate, setReportToDate] = useState("31/12/2026");
  const [reportDeptFilter, setReportDeptFilter] = useState("all");
  const [reportCategoryFilter, setReportCategoryFilter] = useState("all");
  const [reportAssetCodeFilter, setReportAssetCodeFilter] = useState("all");
  const [reportAccountFilter, setReportAccountFilter] = useState("all");
  const [reportOnlyDifferences, setReportOnlyDifferences] = useState(false);
  const [reportExcludeDisposed, setReportExcludeDisposed] = useState(false);
  const [hiddenReportIds, setHiddenReportIds] = useState<string[]>([]);
  const [showHideReportsModal, setShowHideReportsModal] = useState(false);
  const [showAvaReportModal, setShowAvaReportModal] = useState(false);
  const [avaReportQuery, setAvaReportQuery] = useState("");
  const [apiReportPayload, setApiReportPayload] = useState<any | null>(null);

  // =========================================================================
  // FORM GHI TĂNG TÀI SẢN CỐ ĐỊNH (UC-FA-01)
  // =========================================================================
  const suggestNextIncreaseVoucherNo = (existingList = increaseVouchers) => {
    const used = new Set(existingList.map((v) => String(v.voucherNo || "").trim().toUpperCase()));
    let seq = existingList.length + 1;
    while (used.has(`GTTS${String(seq).padStart(5, "0")}`)) {
      seq += 1;
    }
    return `GTTS${String(seq).padStart(5, "0")}`;
  };

  const [incVoucherNo, setIncVoucherNo] = useState(() => suggestNextIncreaseVoucherNo(SAMPLE_INCREASE_VOUCHERS));
  const [incVoucherDate, setIncVoucherDate] = useState("30/12/2026");
  const [incCategory, setIncCategory] = useState("");
  const [incCode, setIncCode] = useState("");
  const [incDept, setIncDept] = useState("");
  const [incName, setIncName] = useState("");
  const [incNoDepr, setIncNoDepr] = useState(false);
  const [incSubTab, setIncSubTab] = useState<
    "depreciation" | "allocation" | "origin" | "components" | "accessories" | "others"
  >("depreciation");

  // Sub-tab 1: Thông tin khấu hao cho Ghi tăng
  const [incCostAcc, setIncCostAcc] = useState("");
  const [incOriginalCost, setIncOriginalCost] = useState<number>(0);
  const [incDeprRateMonth, setIncDeprRateMonth] = useState<number>(0);
  const [incDeprRateYear, setIncDeprRateYear] = useState<number>(0);
  const [incDeprAcc, setIncDeprAcc] = useState("");
  const [incDeprCostValue, setIncDeprCostValue] = useState<number>(0);
  const [incDeprMonthValue, setIncDeprMonthValue] = useState<number>(0);
  const [incDeprYearValue, setIncDeprYearValue] = useState<number>(0);
  const [incStartDate, setIncStartDate] = useState("30/12/2026");
  const [incAccumulatedDepr, setIncAccumulatedDepr] = useState<number>(0);
  const [incRemainingValue, setIncRemainingValue] = useState<number>(0);
  const [incUseDuration, setIncUseDuration] = useState<number>(0);
  const [incUseDurationUnit, setIncUseDurationUnit] = useState<"Năm" | "Tháng">("Năm");
  const [incLimitTaxLaw, setIncLimitTaxLaw] = useState(false);
  const [incTaxLawValue, setIncTaxLawValue] = useState<number>(0);
  const [incTaxLawMonthValue, setIncTaxLawMonthValue] = useState<number>(0);

  // Sub-tab 2: Thiết lập phân bổ (AF09, AF10, BR22, BR23)
  const [incAllocations, setIncAllocations] = useState<Array<{
    id: string;
    dept: string;
    rate: number;
    expenseAccount: string;
    expenseItem: string;
    costCenter: string;
  }>>([]);

  // Sub-tab 3: Nguồn gốc hình thành (AF05, AF11, BR07, BR12, BR24, BR25)
  const [incOrigins, setIncOrigins] = useState<Array<{
    id: string;
    originType: string;
    documentNumber: string;
    documentDate: string;
    amount: number;
    partnerCode: string;
    partnerName: string;
    sourceDocumentId: string;
  }>>([]);
  const [incOriginVarianceReason, setIncOriginVarianceReason] = useState("");

  // Sub-tab 4: Bộ phận cấu thành (AF12, BR26)
  const [incComponents, setIncComponents] = useState<Array<{
    id: string;
    name: string;
    unit: string;
    quantity: number;
    value: number;
  }>>([]);

  // Sub-tab 5: Dụng cụ, phụ tùng kèm theo (AF13, BR26)
  const [incAccessories, setIncAccessories] = useState<Array<{
    id: string;
    name: string;
    unit: string;
    quantity: number;
    value: number;
  }>>([]);

  // Sub-tab 6: Thông tin khác (AF14)
  const [incCountryOfOrigin, setIncCountryOfOrigin] = useState("");
  const [incManufactureYear, setIncManufactureYear] = useState("");
  const [incSerialNumber, setIncSerialNumber] = useState("");
  const [incDescription, setIncDescription] = useState("");

  // AF04: Quick-Add Loại tài sản Modal state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatCode, setNewCatCode] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatAssetAcc, setNewCatAssetAcc] = useState("2111");
  const [newCatDeprAcc, setNewCatDeprAcc] = useState("2141");
  const [newCatExpAcc, setNewCatExpAcc] = useState("6424");
  const [newCatPeriods, setNewCatPeriods] = useState("60");
  const [localCategories, setLocalCategories] = useState<Array<{
    code: string;
    name: string;
    assetAccount: string;
    deprAccount: string;
    expenseAccount: string;
    defaultPeriods: number;
  }>>([
    { code: "PTVT", name: "Phương tiện vận tải", assetAccount: "2113", deprAccount: "2141", expenseAccount: "6424", defaultPeriods: 96 },
    { code: "NCVKT", name: "Nhà cửa, vật kiến trúc", assetAccount: "2111", deprAccount: "2141", expenseAccount: "6424", defaultPeriods: 240 },
    { code: "MMTB", name: "Máy móc, thiết bị", assetAccount: "2112", deprAccount: "2141", expenseAccount: "6274", defaultPeriods: 60 },
    { code: "TBDCQL", name: "Thiết bị, dụng cụ quản lý", assetAccount: "2114", deprAccount: "2141", expenseAccount: "6424", defaultPeriods: 36 },
    { code: "TSVH", name: "Tài sản cố định vô hình", assetAccount: "2131", deprAccount: "2143", expenseAccount: "6424", defaultPeriods: 48 },
    { code: "TSKHAC", name: "Tài sản cố định khác", assetAccount: "2118", deprAccount: "2141", expenseAccount: "6424", defaultPeriods: 60 },
  ]);

  const categoryOptions = (() => {
    const map = new Map<string, { code: string; name: string; assetAccount: string; deprAccount: string; expenseAccount: string; defaultPeriods: number }>();
    for (const c of localCategories) map.set(c.name.toLowerCase(), c);
    for (const row of apiRows.assetCategories || []) {
      const name = String(row.name || "").trim();
      if (!name) continue;
      map.set(name.toLowerCase(), {
        code: String(row.code || ""),
        name,
        assetAccount: String(row.asset_account_code || "2111"),
        deprAccount: String(row.accumulated_account_code || "2141"),
        expenseAccount: String(row.expense_account_code || "6424"),
        defaultPeriods: Number(row.default_periods) || 60,
      });
    }
    return Array.from(map.values());
  })();

  const departmentOptions = (() => {
    const names = new Set<string>([
      "Ban Giám đốc",
      "Khối Văn phòng",
      "Phòng Hành chính - Nhân sự",
      "Phòng Kỹ thuật",
      "Phòng Công nghệ & IT",
      "Phòng Kế toán",
      "Phòng Kinh doanh & Marketing",
      "Phân xưởng Sản xuất 1",
      "Đội Vận tải & Kho vận",
    ]);
    for (const d of apiRows.departments || []) {
      if (d.name) names.add(String(d.name));
    }
    return Array.from(names);
  })();

  // Section 4.3 & 4.4: Quy đổi thời gian sử dụng (Năm * 12 vs Tháng giữ nguyên) & Khấu hao đường thẳng
  const recalcIncDepreciation = (
    costVal: number,
    deprBaseVal: number,
    durVal: number,
    unitVal: "Năm" | "Tháng",
    noDeprVal: boolean,
    accumVal: number,
    limitTaxVal: boolean,
    taxBaseVal: number
  ) => {
    const remain = Math.max(0, costVal - accumVal);
    setIncRemainingValue(remain);
    if (noDeprVal || durVal <= 0) {
      setIncDeprRateMonth(0);
      setIncDeprRateYear(0);
      setIncDeprMonthValue(0);
      setIncDeprYearValue(0);
      if (noDeprVal) setIncDeprCostValue(0);
      return;
    }
    const totalMonths = unitVal === "Tháng" ? durVal : durVal * 12;
    if (totalMonths <= 0) return;
    const monthRate = Number((100 / totalMonths).toFixed(2));
    const yearRate = Number(((100 / totalMonths) * 12).toFixed(2));
    const monthAmt = Math.round(deprBaseVal / totalMonths);
    const yearAmt = Math.round(monthAmt * 12);
    setIncDeprRateMonth(monthRate);
    setIncDeprRateYear(yearRate);
    setIncDeprMonthValue(monthAmt);
    setIncDeprYearValue(yearAmt);
    if (limitTaxVal && taxBaseVal > 0) {
      setIncTaxLawMonthValue(Math.round(taxBaseVal / totalMonths));
    }
  };

  const handleIncOriginalCostChange = (val: number) => {
    setIncOriginalCost(val);
    const nextDeprBase = incNoDepr ? 0 : val;
    setIncDeprCostValue(nextDeprBase);
    recalcIncDepreciation(val, nextDeprBase, incUseDuration, incUseDurationUnit, incNoDepr, incAccumulatedDepr, incLimitTaxLaw, incTaxLawValue);
  };

  const handleIncDeprCostValueChange = (val: number) => {
    setIncDeprCostValue(val);
    recalcIncDepreciation(incOriginalCost, val, incUseDuration, incUseDurationUnit, incNoDepr, incAccumulatedDepr, incLimitTaxLaw, incTaxLawValue);
  };

  const handleIncUseDurationChange = (dur: number) => {
    setIncUseDuration(dur);
    recalcIncDepreciation(incOriginalCost, incDeprCostValue || incOriginalCost, dur, incUseDurationUnit, incNoDepr, incAccumulatedDepr, incLimitTaxLaw, incTaxLawValue);
  };

  const handleIncUseDurationUnitChange = (unit: "Năm" | "Tháng") => {
    setIncUseDurationUnit(unit);
    recalcIncDepreciation(incOriginalCost, incDeprCostValue || incOriginalCost, incUseDuration, unit, incNoDepr, incAccumulatedDepr, incLimitTaxLaw, incTaxLawValue);
  };

  const handleIncAccumulatedDeprChange = (acc: number) => {
    setIncAccumulatedDepr(acc);
    setIncRemainingValue(Math.max(0, incOriginalCost - acc));
  };

  const handleIncCategorySelect = (catName: string) => {
    setIncCategory(catName);
    const matched = categoryOptions.find((c) => c.name === catName);
    if (matched) {
      setIncCostAcc(matched.assetAccount || "2111");
      if (!incNoDepr) {
        setIncDeprAcc(matched.deprAccount || "2141");
        if (incUseDuration <= 0 && matched.defaultPeriods > 0) {
          const defaultYears = Number((matched.defaultPeriods / 12).toFixed(2));
          setIncUseDuration(defaultYears);
          setIncUseDurationUnit("Năm");
          recalcIncDepreciation(incOriginalCost, incDeprCostValue || incOriginalCost, defaultYears, "Năm", false, incAccumulatedDepr, incLimitTaxLaw, incTaxLawValue);
        }
      }
      setIncAllocations((prev) => {
        if (prev.length === 0) {
          return incDept
            ? [{ id: "alloc-1", dept: incDept, rate: 100, expenseAccount: matched.expenseAccount || "6424", expenseItem: "Chi phí khấu hao TSCĐ", costCenter: "" }]
            : [];
        }
        if (prev.length === 1 && !prev[0].expenseAccount) {
          return [{ ...prev[0], expenseAccount: matched.expenseAccount || "6424" }];
        }
        return prev;
      });
    }
  };

  const handleIncDeptSelect = (deptName: string) => {
    setIncDept(deptName);
    const matchedCat = categoryOptions.find((c) => c.name === incCategory);
    const defaultExpAcc = matchedCat?.expenseAccount || (/sản xuất|phân xưởng|kỹ thuật/i.test(deptName) ? "6274" : /kinh doanh|bán hàng/i.test(deptName) ? "6414" : "6424");
    setIncAllocations((prev) => {
      if (prev.length === 0 && deptName) {
        return [{ id: "alloc-1", dept: deptName, rate: 100, expenseAccount: defaultExpAcc, expenseItem: "Chi phí khấu hao TSCĐ", costCenter: "" }];
      }
      if (prev.length === 1) {
        return [{ ...prev[0], dept: deptName, expenseAccount: prev[0].expenseAccount || defaultExpAcc }];
      }
      return prev;
    });
  };

  const resetIncreaseForm = (nextVouchersList = increaseVouchers) => {
    setIncVoucherNo(suggestNextIncreaseVoucherNo(nextVouchersList));
    setIncVoucherDate("30/12/2026");
    setIncCategory("");
    setIncCode("");
    setIncDept("");
    setIncName("");
    setIncNoDepr(false);
    setIncSubTab("depreciation");
    setIncCostAcc("");
    setIncOriginalCost(0);
    setIncDeprRateMonth(0);
    setIncDeprRateYear(0);
    setIncDeprAcc("");
    setIncDeprCostValue(0);
    setIncDeprMonthValue(0);
    setIncDeprYearValue(0);
    setIncStartDate("30/12/2026");
    setIncAccumulatedDepr(0);
    setIncRemainingValue(0);
    setIncUseDuration(0);
    setIncUseDurationUnit("Năm");
    setIncLimitTaxLaw(false);
    setIncTaxLawValue(0);
    setIncTaxLawMonthValue(0);
    setIncAllocations([]);
    setIncOrigins([]);
    setIncOriginVarianceReason("");
    setIncComponents([]);
    setIncAccessories([]);
    setIncCountryOfOrigin("");
    setIncManufactureYear("");
    setIncSerialNumber("");
    setIncDescription("");
  };

  const openNewIncreaseModal = () => {
    resetIncreaseForm(increaseVouchers);
    setShowAddAssetModal(true);
  };

  const handleCloseIncreaseModal = () => {
    const isDirty = Boolean(incCode.trim() || incName.trim() || incOriginalCost > 0 || incCategory || incDept || incOrigins.length > 0);
    if (isDirty && typeof window !== "undefined") {
      if (!window.confirm("Dữ liệu ghi tăng tài sản cố định chưa được lưu. Bạn có chắc chắn muốn hủy bỏ các thay đổi không?")) {
        return;
      }
    }
    setShowAddAssetModal(false);
  };

  const isValidDdMmYyyy = (val: string) => {
    const trimmed = String(val || "").trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (!m) return false;
    const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  };

  const parseDdMmYyyyToTime = (val: string) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(val || "").trim());
    if (!m) return 0;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  };

  // UC-FA-01 Step 20–24 & EF02–EF22 validation + submission
  const handleSubmitIncrease = (keepOpen: boolean) => {
    const vNo = incVoucherNo.trim();
    if (!vNo) {
      notify("Vui lòng nhập số chứng từ ghi tăng.");
      return;
    }
    if (increaseVouchers.some((v) => String(v.voucherNo || "").trim().toLowerCase() === vNo.toLowerCase())) {
      notify("Số chứng từ ghi tăng đã tồn tại.");
      return;
    }
    if (!isValidDdMmYyyy(incVoucherDate)) {
      notify("Vui lòng nhập Ngày ghi tăng hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }
    if (!incCategory.trim()) {
      notify("Vui lòng chọn loại tài sản hợp lệ.");
      return;
    }
    const aCode = incCode.trim();
    if (!aCode) {
      notify("Vui lòng nhập mã tài sản.");
      return;
    }
    if (assetsList.some((a) => String(a.code || "").trim().toLowerCase() === aCode.toLowerCase())) {
      notify("Mã tài sản đã tồn tại. Vui lòng nhập mã khác.");
      return;
    }
    if (!incDept.trim()) {
      notify("Vui lòng chọn đơn vị sử dụng hợp lệ.");
      return;
    }
    const aName = incName.trim();
    if (!aName) {
      notify("Vui lòng nhập tên tài sản cố định.");
      return;
    }
    if (incOriginalCost <= 0) {
      notify("Nguyên giá tài sản phải lớn hơn 0 và có căn cứ hợp lệ.");
      return;
    }
    if (!incCostAcc.trim() || !/^(211|212|213)/.test(incCostAcc.trim())) {
      setIncSubTab("depreciation");
      notify("Tài khoản nguyên giá không hợp lệ.");
      return;
    }
    if (incAccumulatedDepr < 0 || incAccumulatedDepr > incOriginalCost || incAccumulatedDepr > 0) {
      setIncSubTab("depreciation");
      notify("Hao mòn lũy kế không hợp lệ.");
      return;
    }
    if (!incNoDepr) {
      if (!incDeprAcc.trim() || !/^214/.test(incDeprAcc.trim())) {
        setIncSubTab("depreciation");
        notify("Vui lòng chọn tài khoản khấu hao hợp lệ.");
        return;
      }
      if (incUseDuration <= 0) {
        setIncSubTab("depreciation");
        notify("Thời gian sử dụng tài sản không hợp lệ.");
        return;
      }
      if (!isValidDdMmYyyy(incStartDate) || parseDdMmYyyyToTime(incStartDate) < parseDdMmYyyyToTime(incVoucherDate)) {
        setIncSubTab("depreciation");
        notify("Ngày bắt đầu tính khấu hao không hợp lệ.");
        return;
      }
      if (incDeprCostValue <= 0 || incDeprCostValue > incOriginalCost) {
        setIncSubTab("depreciation");
        notify("Thông tin khấu hao không nhất quán. Vui lòng kiểm tra lại.");
        return;
      }
      if (incAllocations.length === 0) {
        setIncSubTab("allocation");
        notify("Tổng tỷ lệ phân bổ khấu hao phải bằng 100%.");
        return;
      }
      const totalRate = incAllocations.reduce((s, r) => s + (Number(r.rate) || 0), 0);
      if (Math.abs(totalRate - 100) > 0.01) {
        setIncSubTab("allocation");
        notify("Tổng tỷ lệ phân bổ khấu hao phải bằng 100%.");
        return;
      }
      if (incAllocations.some((r) => !r.dept.trim() || !r.expenseAccount.trim() || Number(r.rate) <= 0)) {
        setIncSubTab("allocation");
        notify("Thông tin phân bổ chi phí khấu hao không hợp lệ.");
        return;
      }
    }
    const filledOrigins = incOrigins.filter((o) => o.documentNumber.trim() || Number(o.amount) > 0);
    if (filledOrigins.length > 0) {
      const originSum = filledOrigins.reduce((s, o) => s + (Number(o.amount) || 0), 0);
      if (originSum !== incOriginalCost && !incOriginVarianceReason.trim()) {
        setIncSubTab("origin");
        notify("Nguyên giá chưa phù hợp với hồ sơ nguồn. Vui lòng kiểm tra lại.");
        return;
      }
    }

    const totalMonths = incNoDepr ? 0 : (incUseDurationUnit === "Tháng" ? incUseDuration : incUseDuration * 12);
    const yearsEquivalent = incNoDepr ? 0 : Number((totalMonths / 12).toFixed(2));
    const newItem = {
      voucherNo: vNo,
      voucherDate: incVoucherDate,
      code: aCode,
      name: aName,
      category: incCategory,
      dept: incDept,
      noDepr: incNoDepr,
      startDate: incVoucherDate,
      deprStartDate: incStartDate,
      years: yearsEquivalent,
      useDuration: incUseDuration,
      useDurationUnit: incUseDurationUnit,
      rateMonth: incNoDepr ? 0 : Number(incDeprRateMonth),
      rateYear: incNoDepr ? 0 : Number(incDeprRateYear),
      deprCostValue: incNoDepr ? 0 : Number(incDeprCostValue),
      deprMonthValue: incNoDepr ? 0 : Number(incDeprMonthValue),
      deprYearValue: incNoDepr ? 0 : Number(incDeprYearValue),
      originalCost: Number(incOriginalCost),
      depreciatedAmount: Number(incAccumulatedDepr),
      remainingAmount: Math.max(0, Number(incOriginalCost) - Number(incAccumulatedDepr)),
      costAccount: incCostAcc,
      deprAccount: incNoDepr ? "" : incDeprAcc,
      expenseAccount: incAllocations[0]?.expenseAccount || "6424",
      limitTaxLaw: incLimitTaxLaw,
      taxLawValue: incLimitTaxLaw ? Number(incTaxLawValue) : 0,
      taxLawMonthValue: incLimitTaxLaw ? Number(incTaxLawMonthValue) : 0,
      allocations: incAllocations,
      origins: filledOrigins,
      originVarianceReason: incOriginVarianceReason,
      components: incComponents.filter((c) => c.name.trim()),
      accessories: incAccessories.filter((a) => a.name.trim()),
      countryOfOrigin: incCountryOfOrigin,
      manufactureYear: incManufactureYear,
      serialNumber: incSerialNumber,
      description: incDescription,
      statusDisplay: "Đang sử dụng",
      reconciliationStatus: filledOrigins.length > 0 ? "Đã đối chiếu" : "Chưa đối chiếu hạch toán",
    };

    if (apiConnected) {
      void apiSave((writer) => saveFixedAsset(writer, newItem, true)).then((saved) => {
        if (!saved) return;
        if (keepOpen) {
          resetIncreaseForm([{ voucherNo: vNo } as any, ...increaseVouchers]);
        } else {
          setShowAddAssetModal(false);
          setIncreaseView("table");
        }
      });
      return;
    }

    const newVoucher = {
      voucherNo: vNo,
      date: incVoucherDate,
      assetCode: newItem.code,
      assetName: newItem.name,
      originalCost: newItem.originalCost,
      dept: newItem.dept,
      status: "Đang sử dụng",
      reconciliationStatus: newItem.reconciliationStatus,
    };
    const nextAssets = [newItem as any, ...assetsList];
    const nextVouchers = [newVoucher as any, ...increaseVouchers];
    setAssetsList(nextAssets);
    setIncreaseVouchers(nextVouchers);
    notify("Ghi tăng tài sản cố định thành công.");
    if (keepOpen) {
      resetIncreaseForm(nextVouchers);
    } else {
      setShowAddAssetModal(false);
      setIncreaseView("table");
    }
  };

  // =========================================================================
  // UC-FA-02: CHI TIẾT & CẬP NHẬT THÔNG TIN TÀI SẢN CỐ ĐỊNH
  // =========================================================================
  const [showAssetDetailModal, setShowAssetDetailModal] = useState(false);
  const [detailAsset, setDetailAsset] = useState<any | null>(null);
  const [isEditingAsset, setIsEditingAsset] = useState(false);
  const [detailSubTab, setDetailSubTab] = useState<
    "depreciation" | "allocation" | "origin" | "components" | "accessories" | "others" | "history"
  >("others");

  // Các trường được phép sửa trực tiếp / bổ sung có kiểm soát trong UC-FA-02 (Mục 5)
  const [editName, setEditName] = useState("");
  const [editCountryOfOrigin, setEditCountryOfOrigin] = useState("");
  const [editManufactureYear, setEditManufactureYear] = useState("");
  const [editSerialNumber, setEditSerialNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editComponents, setEditComponents] = useState<Array<{ name: string; unit: string; quantity: number; value: number }>>([]);
  const [editAccessories, setEditAccessories] = useState<Array<{ name: string; unit: string; quantity: number; value: number }>>([]);
  const [editOrigins, setEditOrigins] = useState<Array<{ sourceType: string; documentNo: string; documentDate: string; amount: number; supplier: string }>>([]);
  const [editUpdateReason, setEditUpdateReason] = useState("");

  // Kiểm soát lỗi giao diện & xác nhận hủy thay đổi (EF04, EF05, EF12, AF15, AF16)
  const [editNameError, setEditNameError] = useState(false);
  const [editYearError, setEditYearError] = useState(false);
  const [editReasonError, setEditReasonError] = useState(false);
  const [showDiscardEditConfirm, setShowDiscardEditConfirm] = useState(false);

  // Lịch sử thay đổi (Audit Log) của từng tài sản (Mục 6, Bước 17, BR19)
  const [localAuditLogsByCode, setLocalAuditLogsByCode] = useState<Record<string, Array<{
    id: string;
    occurredAt: string;
    actor: string;
    reason: string;
    changes: Array<{ fieldName: string; oldValue: any; newValue: any }>;
  }>>>({});
  const [apiAuditLogs, setApiAuditLogs] = useState<Array<{
    id: string;
    occurredAt: string;
    actor: string;
    reason: string;
    changes: Array<{ fieldName: string; oldValue: any; newValue: any }>;
  }>>([]);

  const populateEditStatesFromAsset = (row: any) => {
    setEditName(String(row.name || ""));
    setEditCountryOfOrigin(String(row.countryOfOrigin || ""));
    setEditManufactureYear(row.manufactureYear !== undefined && row.manufactureYear !== null ? String(row.manufactureYear) : "");
    setEditSerialNumber(String(row.serialNumber || ""));
    setEditDescription(String(row.description || ""));
    setEditComponents(
      Array.isArray(row.components)
        ? row.components.map((c: any) => ({
            name: String(c.name || ""),
            unit: String(c.unit || "Cái"),
            quantity: Number(c.quantity) || 1,
            value: Number(c.value) || 0,
          }))
        : []
    );
    setEditAccessories(
      Array.isArray(row.accessories)
        ? row.accessories.map((ac: any) => ({
            name: String(ac.name || ""),
            unit: String(ac.unit || "Bộ"),
            quantity: Number(ac.quantity) || 1,
            value: Number(ac.value) || 0,
          }))
        : []
    );
    const defaultOrigins =
      Array.isArray(row.origins) && row.origins.length > 0
        ? row.origins.map((o: any) => ({
            sourceType: String(o.sourceType || o.originType || o.origin_type || "Mua sắm mới trong nước"),
            documentNo: String(o.documentNo || o.documentNumber || o.document_number || row.voucherNo || ""),
            documentDate: String(o.documentDate || o.document_date || row.startDate || ""),
            amount: Number(o.amount ?? row.originalCost ?? 0),
            supplier: String(o.supplier || o.partnerName || o.partner_name || ""),
          }))
        : [
            {
              sourceType: "Mua sắm mới trong nước",
              documentNo: String(row.voucherNo || `CT-${row.code}`),
              documentDate: String(row.startDate || ""),
              amount: Number(row.originalCost || 0),
              supplier: "",
            },
          ];
    setEditOrigins(defaultOrigins);
    setEditUpdateReason("");
    setEditNameError(false);
    setEditYearError(false);
    setEditReasonError(false);
    setShowDiscardEditConfirm(false);
  };

  // Bước 5 & AF03 & AF17 & EF01: Mở màn hình Chi tiết tài sản cố định ở chế độ chỉ đọc
  const openAssetDetailModal = (assetCodeOrRow: string | any) => {
    const found =
      typeof assetCodeOrRow === "string"
        ? assetsList.find((a) => a.code === assetCodeOrRow)
        : assetsList.find((a) => a.code === assetCodeOrRow?.code) || assetCodeOrRow;
    if (!found || !found.code) {
      notify("Không tìm thấy thông tin tài sản cố định.");
      return;
    }
    const matchedVoucher = increaseVouchers.find((v) => v.assetCode === found.code);
    const enriched = {
      ...found,
      voucherNo: found.voucherNo || matchedVoucher?.voucherNo || `GT-${found.code}`,
      deprStartDate: found.deprStartDate || found.startDate || "01/01/2026",
      useDuration: found.useDuration ?? found.years ?? 5,
      useDurationUnit: found.useDurationUnit || "Năm",
      rateMonth: found.rateMonth ?? Number(((found.rateYear || 0) / 12).toFixed(2)),
      deprCostValue: found.deprCostValue ?? found.originalCost ?? 0,
      deprMonthValue:
        found.deprMonthValue ??
        ((found.years || 0) > 0 ? Math.round((found.originalCost || 0) / ((found.years || 1) * 12)) : 0),
      deprYearValue:
        found.deprYearValue ??
        ((found.years || 0) > 0 ? Math.round((found.originalCost || 0) / (found.years || 1)) : 0),
      allocations:
        Array.isArray(found.allocations) && found.allocations.length > 0
          ? found.allocations
          : [
              {
                department: found.dept || "",
                rate: 100,
                expenseAccount: found.expenseAccount || "6424",
                expenseItem: "Chi phí khấu hao TSCĐ",
                costObject: "",
              },
            ],
      status: found.status || (found.statusDisplay === "Đã ghi giảm" ? "DISPOSED" : "ACTIVE"),
      statusDisplay: found.statusDisplay || "Đang sử dụng",
      version: found.version || 1,
    };
    setDetailAsset(enriched);
    populateEditStatesFromAsset(enriched);
    setIsEditingAsset(false);
    setDetailSubTab("others");
    setShowAssetDetailModal(true);

    if (apiConnected && enriched.id) {
      void apiSave(async (writer) => {
        const res = await fetchFixedAssetHistory(writer, String(enriched.id));
        const logs = Array.isArray((res as any)?.audit_logs)
          ? (res as any).audit_logs.map((l: any) => ({
              id: String(l.id || Math.random()),
              occurredAt: l.occurred_at ? new Date(l.occurred_at).toLocaleString("vi-VN") : "",
              actor: String(l.actor || "Kế toán TSCĐ"),
              reason: String(l.reason || ""),
              changes: Array.isArray(l.changes)
                ? l.changes.map((c: any) => ({
                    fieldName: String(c.field_name || ""),
                    oldValue: c.old_value,
                    newValue: c.new_value,
                  }))
                : [],
            }))
          : [];
        setApiAuditLogs(logs);
        return { message: "" };
      });
    } else {
      setApiAuditLogs([]);
    }
  };

  // Bước 6 & AF18 & EF03: Nhấn Sửa -> kiểm tra trạng thái tài sản
  const handleStartEditAsset = () => {
    if (!detailAsset) {
      notify("Không tìm thấy thông tin tài sản cố định.");
      return;
    }
    if (
      detailAsset.status === "DISPOSED" ||
      detailAsset.statusDisplay === "Đã ghi giảm" ||
      detailAsset.status === "SUSPENDED" ||
      detailAsset.statusDisplay === "Ngừng sử dụng" ||
      decVouchers.some((d) => d.assetCode === detailAsset.code)
    ) {
      notify("Trạng thái tài sản không cho phép cập nhật trực tiếp.");
      return;
    }
    populateEditStatesFromAsset(detailAsset);
    setIsEditingAsset(true);
  };

  // Kiểm tra dữ liệu có thay đổi thực tế so với hồ sơ đang lưu (Bước 14, Mục 4.4)
  const getAssetInfoChanges = () => {
    if (!detailAsset) return [];
    const changes: Array<{ fieldName: string; label: string; oldValue: any; newValue: any }> = [];

    const trimmedName = editName.trim();
    if (trimmedName !== String(detailAsset.name || "").trim()) {
      changes.push({
        fieldName: "name",
        label: "Tên tài sản",
        oldValue: detailAsset.name || "Chưa khai báo",
        newValue: trimmedName,
      });
    }

    const trimmedCountry = editCountryOfOrigin.trim();
    if (trimmedCountry !== String(detailAsset.countryOfOrigin || "").trim()) {
      changes.push({
        fieldName: "country_of_origin",
        label: "Nước sản xuất",
        oldValue: detailAsset.countryOfOrigin || "Chưa khai báo",
        newValue: trimmedCountry || "Chưa khai báo",
      });
    }

    const trimmedYear = editManufactureYear.trim();
    const oldYear = detailAsset.manufactureYear !== undefined && detailAsset.manufactureYear !== null ? String(detailAsset.manufactureYear).trim() : "";
    if (trimmedYear !== oldYear) {
      changes.push({
        fieldName: "manufacture_year",
        label: "Năm sản xuất",
        oldValue: oldYear || "Chưa khai báo",
        newValue: trimmedYear || "Chưa khai báo",
      });
    }

    const trimmedSerial = editSerialNumber.trim();
    if (trimmedSerial !== String(detailAsset.serialNumber || "").trim()) {
      changes.push({
        fieldName: "serial_number",
        label: "Số hiệu / Serial",
        oldValue: detailAsset.serialNumber || "Chưa khai báo",
        newValue: trimmedSerial || "Chưa khai báo",
      });
    }

    const trimmedDesc = editDescription.trim();
    if (trimmedDesc !== String(detailAsset.description || "").trim()) {
      changes.push({
        fieldName: "description",
        label: "Mô tả / Ghi chú",
        oldValue: detailAsset.description || "Chưa khai báo",
        newValue: trimmedDesc || "Chưa khai báo",
      });
    }

    const cleanComp = editComponents.filter((c) => c.name.trim());
    const oldComp = Array.isArray(detailAsset.components) ? detailAsset.components : [];
    if (JSON.stringify(cleanComp) !== JSON.stringify(oldComp)) {
      changes.push({
        fieldName: "components",
        label: "Bộ phận cấu thành",
        oldValue: `${oldComp.length} bộ phận`,
        newValue: `${cleanComp.length} bộ phận`,
      });
    }

    const cleanAcc = editAccessories.filter((a) => a.name.trim());
    const oldAcc = Array.isArray(detailAsset.accessories) ? detailAsset.accessories : [];
    if (JSON.stringify(cleanAcc) !== JSON.stringify(oldAcc)) {
      changes.push({
        fieldName: "accessories",
        label: "Dụng cụ, phụ tùng kèm theo",
        oldValue: `${oldAcc.length} phụ tùng`,
        newValue: `${cleanAcc.length} phụ tùng`,
      });
    }

    const oldOrigins =
      Array.isArray(detailAsset.origins) && detailAsset.origins.length > 0
        ? detailAsset.origins
        : [
            {
              sourceType: "Mua sắm mới trong nước",
              documentNo: String(detailAsset.voucherNo || `CT-${detailAsset.code}`),
              documentDate: String(detailAsset.startDate || ""),
              amount: Number(detailAsset.originalCost || 0),
              supplier: "",
            },
          ];
    if (JSON.stringify(editOrigins) !== JSON.stringify(oldOrigins)) {
      changes.push({
        fieldName: "origins",
        label: "Tham chiếu nguồn gốc hình thành",
        oldValue: oldOrigins.map((o: any) => o.documentNo).join(", "),
        newValue: editOrigins.map((o) => o.documentNo).join(", "),
      });
    }

    return changes;
  };

  // AF15 & AF16: Hủy chỉnh sửa (kiểm tra có thay đổi chưa lưu để xác nhận)
  const handleCancelEditAsset = () => {
    const changes = getAssetInfoChanges();
    if (changes.length > 0 || editUpdateReason.trim() !== "") {
      setShowDiscardEditConfirm(true);
      return;
    }
    setIsEditingAsset(false);
    setShowDiscardEditConfirm(false);
  };

  const confirmDiscardAssetEdits = () => {
    if (detailAsset) {
      populateEditStatesFromAsset(detailAsset);
    }
    setShowDiscardEditConfirm(false);
    setIsEditingAsset(false);
  };

  // Bước 12–18 & EF03–EF17 & AF14: Nhấn Cất cập nhật thông tin tài sản
  const handleSaveAssetUpdate = () => {
    if (!detailAsset) {
      notify("Không tìm thấy thông tin tài sản cố định.");
      return;
    }

    // EF14 & EF03: Kiểm tra tài sản còn tồn tại và trạng thái hợp lệ
    const latestInList = assetsList.find((a) => a.code === detailAsset.code) as any;
    if (!latestInList) {
      notify("Không tìm thấy thông tin tài sản cố định.");
      return;
    }
    if (
      latestInList.status === "DISPOSED" ||
      latestInList.statusDisplay === "Đã ghi giảm" ||
      decVouchers.some((d) => d.assetCode === detailAsset.code)
    ) {
      notify(
        detailAsset.status === "ACTIVE"
          ? "Trạng thái tài sản đã thay đổi. Vui lòng kiểm tra lại."
          : "Trạng thái tài sản không cho phép cập nhật trực tiếp."
      );
      return;
    }

    // EF13 & BR20: Kiểm soát phiên bản dữ liệu đồng thời
    if ((latestInList.version || 1) !== (detailAsset.version || 1)) {
      notify("Thông tin tài sản đã được thay đổi. Vui lòng tải lại dữ liệu trước khi cập nhật.");
      return;
    }

    // EF04 & BR05: Tên tài sản bắt buộc
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditNameError(true);
      notify("Vui lòng nhập tên tài sản cố định.");
      return;
    }
    setEditNameError(false);

    // EF17: Kiểm tra độ dài và ký tự hợp lệ
    if (
      trimmedName.length > 255 ||
      editCountryOfOrigin.trim().length > 120 ||
      editSerialNumber.trim().length > 100 ||
      editUpdateReason.trim().length > 500 ||
      /<script/i.test(trimmedName + editCountryOfOrigin + editDescription + editUpdateReason)
    ) {
      notify("Thông tin nhập không hợp lệ hoặc vượt quá độ dài cho phép.");
      return;
    }

    // EF05 & BR06: Kiểm tra Năm sản xuất
    const trimmedYear = editManufactureYear.trim();
    const currentYear = new Date().getFullYear();
    if (trimmedYear !== "") {
      if (!/^\d+$/.test(trimmedYear)) {
        setEditYearError(true);
        setDetailSubTab("others");
        notify("Năm sản xuất không hợp lệ. Vui lòng kiểm tra lại.");
        return;
      }
      const yearNum = Number(trimmedYear);
      if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > currentYear) {
        setEditYearError(true);
        setDetailSubTab("others");
        notify("Năm sản xuất không hợp lệ. Vui lòng kiểm tra lại.");
        return;
      }
    }
    setEditYearError(false);

    // EF11 & AF07 & BR13: Kiểm tra tham chiếu nguồn gốc hình thành
    const originSum = editOrigins.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    if (
      editOrigins.some((o) => !o.documentNo.trim()) ||
      (editOrigins.length > 0 && originSum !== Number(detailAsset.originalCost || 0))
    ) {
      setDetailSubTab("origin");
      notify("Thông tin nguồn gốc hình thành chưa hợp lệ. Vui lòng kiểm tra chứng từ liên quan.");
      return;
    }

    // Bước 14 & AF14 & BR18: Kiểm tra có thay đổi thực tế không
    const changes = getAssetInfoChanges();
    if (changes.length === 0) {
      notify("Không có thông tin thay đổi.");
      return;
    }

    // EF12 & Bước 11: Lý do cập nhật bắt buộc khi có thay đổi
    const trimmedReason = editUpdateReason.trim();
    if (!trimmedReason) {
      setEditReasonError(true);
      notify("Vui lòng nhập lý do cập nhật thông tin tài sản.");
      return;
    }
    setEditReasonError(false);

    const nextVersion = (Number(detailAsset.version) || 1) + 1;
    const nowStr = new Date().toLocaleString("vi-VN");
    const updatedAssetObj = {
      ...detailAsset,
      name: trimmedName,
      countryOfOrigin: editCountryOfOrigin.trim(),
      manufactureYear: trimmedYear ? Number(trimmedYear) : "",
      serialNumber: editSerialNumber.trim(),
      description: editDescription.trim(),
      components: editComponents.filter((c) => c.name.trim()),
      accessories: editAccessories.filter((a) => a.name.trim()),
      origins: editOrigins,
      // Mục 4.1–4.3: Giữ nguyên bất biến kế toán (Nguyên giá, Hao mòn lũy kế, Giá trị còn lại)
      originalCost: detailAsset.originalCost,
      depreciatedAmount: detailAsset.depreciatedAmount,
      remainingAmount: detailAsset.remainingAmount,
      version: nextVersion,
      lastUpdateReason: trimmedReason,
      updatedAt: nowStr,
    };

    const newLogEntry = {
      id: `log-${Date.now()}`,
      occurredAt: nowStr,
      actor: "Kế toán TSCĐ",
      reason: trimmedReason,
      changes: changes.map((c) => ({
        fieldName: c.label,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })),
    };

    if (apiConnected && detailAsset.id) {
      void apiSave((writer) =>
        updateFixedAssetInfo(writer, {
          id: detailAsset.id,
          code: detailAsset.code,
          name: trimmedName,
          countryOfOrigin: editCountryOfOrigin.trim(),
          manufactureYear: trimmedYear ? Number(trimmedYear) : null,
          serialNumber: editSerialNumber.trim(),
          description: editDescription.trim(),
          components: editComponents.filter((c) => c.name.trim()),
          accessories: editAccessories.filter((a) => a.name.trim()),
          origins: editOrigins,
          updateReason: trimmedReason,
          version: detailAsset.version || 1,
          expectedStatus: detailAsset.status || "ACTIVE",
        })
      ).then((saved) => {
        if (!saved) return;
        setDetailAsset(updatedAssetObj);
        setLocalAuditLogsByCode((prev) => ({
          ...prev,
          [detailAsset.code]: [newLogEntry, ...(prev[detailAsset.code] || [])],
        }));
        setIsEditingAsset(false);
      });
      return;
    }

    // Đồng bộ Sổ tài sản và các danh sách liên quan (Bước 16, BR21, BR22)
    setAssetsList((prev) =>
      prev.map((row) => (row.code === detailAsset.code ? { ...row, ...updatedAssetObj } : row))
    );
    setIncreaseVouchers((prev) =>
      prev.map((v) => (v.assetCode === detailAsset.code ? { ...v, assetName: trimmedName } : v))
    );
    setDetailAsset(updatedAssetObj);
    setLocalAuditLogsByCode((prev) => ({
      ...prev,
      [detailAsset.code]: [newLogEntry, ...(prev[detailAsset.code] || [])],
    }));
    setIsEditingAsset(false);
    notify("Cập nhật thông tin tài sản thành công.");
  };

  // =========================================================================
  // FORM KHAI BÁO TÀI SẢN CỐ ĐỊNH ĐẦU KỲ (ẢNH TRƯỚC - OPN)
  // =========================================================================
  const [openingVoucherNo, setOpeningVoucherNo] = useState("OPN");
  const [openingVoucherDate, setOpeningVoucherDate] = useState("01/01/2026");
  const [openingCategory, setOpeningCategory] = useState("Phương tiện vận tải");
  const [openingCode, setOpeningCode] = useState("TSCD006");
  const [openingDept, setOpeningDept] = useState("Ban Giám đốc");
  const [openingName, setOpeningName] = useState("");
  const [openingNoDepr, setOpeningNoDepr] = useState(false);
  const [openingSubTab, setOpeningSubTab] = useState<
    "depreciation" | "allocation" | "components" | "accessories" | "others"
  >("depreciation");

  // Sub-tab 1: Thông tin khấu hao cho Đầu kỳ
  const [openingCostAcc, setOpeningCostAcc] = useState("2113");
  const [openingOriginalCost, setOpeningOriginalCost] = useState<number>(0);
  const [openingDeprRateMonth, setOpeningDeprRateMonth] = useState<number>(0);
  const [openingDeprRateYear, setOpeningDeprRateYear] = useState<number>(0);
  const [openingDeprAcc, setOpeningDeprAcc] = useState("2141");
  const [openingDeprCostValue, setOpeningDeprCostValue] = useState<number>(0);
  const [openingDeprMonthValue, setOpeningDeprMonthValue] = useState<number>(0);
  const [openingDeprYearValue, setOpeningDeprYearValue] = useState<number>(0);
  const [openingStartDate, setOpeningStartDate] = useState("01/01/2026");
  const [openingAccumulatedDepr, setOpeningAccumulatedDepr] = useState<number>(0);
  const [openingRemainingValue, setOpeningRemainingValue] = useState<number>(0);
  const [openingUseDuration, setOpeningUseDuration] = useState<number>(5);
  const [openingUseDurationUnit, setOpeningUseDurationUnit] = useState("Năm");
  const [openingRemainDuration, setOpeningRemainDuration] = useState<number>(5);
  const [openingRemainDurationUnit, setOpeningRemainDurationUnit] = useState("Năm");
  const [openingLimitTaxLaw, setOpeningLimitTaxLaw] = useState(false);
  const [openingTaxLawValue, setOpeningTaxLawValue] = useState<number>(0);
  const [openingTaxLawMonthValue, setOpeningTaxLawMonthValue] = useState<number>(0);

  const handleOriginalCostChange = (val: number) => {
    setOpeningOriginalCost(val);
    setOpeningDeprCostValue(val);
    const remain = Math.max(0, val - openingAccumulatedDepr);
    setOpeningRemainingValue(remain);
    if (openingUseDuration > 0) {
      const yearRate = Number((100 / openingUseDuration).toFixed(2));
      const monthRate = Number((100 / openingUseDuration / 12).toFixed(2));
      setOpeningDeprRateYear(yearRate);
      setOpeningDeprRateMonth(monthRate);
      setOpeningDeprYearValue(Math.round(val / openingUseDuration));
      setOpeningDeprMonthValue(Math.round(val / openingUseDuration / 12));
    }
  };

  const handleUseDurationChange = (dur: number) => {
    setOpeningUseDuration(dur);
    if (dur > 0) {
      const yearRate = Number((100 / dur).toFixed(2));
      const monthRate = Number((100 / dur / 12).toFixed(2));
      setOpeningDeprRateYear(yearRate);
      setOpeningDeprRateMonth(monthRate);
      if (openingOriginalCost > 0) {
        setOpeningDeprYearValue(Math.round(openingOriginalCost / dur));
        setOpeningDeprMonthValue(Math.round(openingOriginalCost / dur / 12));
      }
      if (openingRemainDuration === 0 || openingRemainDuration > dur) {
        setOpeningRemainDuration(dur);
      }
    }
  };

  const handleAccumulatedDeprChange = (acc: number) => {
    setOpeningAccumulatedDepr(acc);
    const remain = Math.max(0, openingOriginalCost - acc);
    setOpeningRemainingValue(remain);
    if (openingOriginalCost > 0 && openingUseDuration > 0) {
      const remainYears = Number(((remain / openingOriginalCost) * openingUseDuration).toFixed(1));
      setOpeningRemainDuration(remainYears);
    }
  };

  // =========================================================================
  // UC-FA-03: TÍNH KHẤU HAO TÀI SẢN CỐ ĐỊNH (STATE & BUSINESS LOGIC)
  // =========================================================================
  const [deprMonth, setDeprMonth] = useState(10);
  const [deprYear, setDeprYear] = useState(2026);
  const [deprProrateByDays, setDeprProrateByDays] = useState(false);
  const [deprReference, setDeprReference] = useState("");
  const [deprCurrentRunId, setDeprCurrentRunId] = useState<string | null>(null);
  const [deprVoucherStatus, setDeprVoucherStatus] = useState<"Mới lập" | "Chưa ghi sổ" | "Đã ghi sổ" | "Đã hủy">("Mới lập");
  const [deprIsDirty, setDeprIsDirty] = useState(false);

  type DeprLineItem = {
    assetId?: string;
    assetCode: string;
    assetName: string;
    categoryName: string;
    departmentName: string;
    originalCost: number;
    depreciableAmount: number;
    openingAccumulated: number;
    closingAccumulated: number;
    openingValue: number;
    closingValue: number;
    amount: number;
    deductibleAmount: number;
    nonDeductibleAmount: number;
    eligibleDays: number;
    totalDaysInPeriod: number;
    deprAccount?: string;
    expenseAccount?: string;
  };

  type DeprAllocationRow = {
    assetCode: string;
    assetName: string;
    departmentName: string;
    rate: number;
    allocatedAmount: number;
    deductibleAmount: number;
    nonDeductibleAmount: number;
    expenseAccount: string;
    costItem: string;
    creditAccount?: string;
  };

  type DeprAccountingRow = {
    description: string;
    debitAccount: string;
    creditAccount: string;
    amount: number;
    departmentName: string;
    costItem: string;
    assetCode?: string;
  };

  const [deprLines, setDeprLines] = useState<DeprLineItem[]>([]);
  const [deprAllocationRows, setDeprAllocationRows] = useState<DeprAllocationRow[]>([]);
  const [deprAccountingRows, setDeprAccountingRows] = useState<DeprAccountingRow[]>([]);
  const [deprAttachments, setDeprAttachments] = useState<Array<{ name: string; size: number }>>([]);

  const [deprVouchers, setDeprVouchers] = useState<Array<any>>([
    {
      voucherNo: "KH00008",
      date: "31/08/2026",
      postingDate: "31/08/2026",
      month: 8,
      year: 2026,
      period: "Tháng 08/2026",
      amount: 88560000,
      deductibleAmount: 88560000,
      nonDeductibleAmount: 0,
      reason: "Trích khấu hao tài sản cố định Tháng 08/2026",
      reference: "",
      status: "Đã ghi sổ",
      rawStatus: "POSTED",
      lines: [],
      allocations: [],
      accountingEntries: [],
      attachments: [],
    },
    {
      voucherNo: "KH00007",
      date: "31/07/2026",
      postingDate: "31/07/2026",
      month: 7,
      year: 2026,
      period: "Tháng 07/2026",
      amount: 88560000,
      deductibleAmount: 88560000,
      nonDeductibleAmount: 0,
      reason: "Trích khấu hao tài sản cố định Tháng 07/2026",
      reference: "",
      status: "Đã ghi sổ",
      rawStatus: "POSTED",
      lines: [],
      allocations: [],
      accountingEntries: [],
      attachments: [],
    },
  ]);

  const parseDeprDateString = (str: string): Date | null => {
    const trimmed = String(str || "").trim();
    if (!trimmed) return null;
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (dmy) {
      const d = Number(dmy[1]);
      const m = Number(dmy[2]);
      const y = Number(dmy[3]);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return dt;
      return null;
    }
    const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]);
      const d = Number(ymd[3]);
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return dt;
      return null;
    }
    return null;
  };

  const buildAllocationsAndAccountingFromLines = (
    lines: DeprLineItem[],
    targetMonth: number,
    targetYear: number
  ): { allocations: DeprAllocationRow[]; accountingEntries: DeprAccountingRow[] } => {
    const mStr = String(targetMonth).padStart(2, "0");
    const periodCode = `${mStr}/${targetYear}`;
    const allocations: DeprAllocationRow[] = [];
    const accountingEntries: DeprAccountingRow[] = [];

    for (const line of lines) {
      const assetObj: any = assetsList.find((a) => a.code === line.assetCode);
      const creditAcc = line.deprAccount || assetObj?.deprAccount || "2141";
      const rawAllocs: Array<{ department: string; rate: number; expenseAccount: string; expenseItem?: string }> =
        Array.isArray(assetObj?.allocations) && assetObj.allocations.length > 0
          ? assetObj.allocations.map((al: any) => ({
              department: al.department || line.departmentName || "Khối Văn phòng",
              rate: Number(al.rate ?? 100),
              expenseAccount: al.expenseAccount || line.expenseAccount || "6424",
              expenseItem: al.expenseItem || "Chi phí khấu hao TSCĐ",
            }))
          : [
              {
                department: line.departmentName || "Khối Văn phòng",
                rate: 100,
                expenseAccount: line.expenseAccount || assetObj?.expenseAccount || "6424",
                expenseItem: "Chi phí khấu hao TSCĐ",
              },
            ];

      let runningAllocated = 0;
      let runningDeductible = 0;
      rawAllocs.forEach((al, idx) => {
        const isLast = idx === rawAllocs.length - 1;
        const allocAmt = isLast
          ? Math.max(0, Math.round(line.amount - runningAllocated))
          : Math.round((line.amount * al.rate) / 100);
        runningAllocated += allocAmt;

        const allocDed = isLast
          ? Math.max(0, Math.round(line.deductibleAmount - runningDeductible))
          : Math.round((line.deductibleAmount * al.rate) / 100);
        runningDeductible += allocDed;
        const allocNonDed = Math.max(0, allocAmt - allocDed);

        allocations.push({
          assetCode: line.assetCode,
          assetName: line.assetName,
          departmentName: al.department,
          rate: al.rate,
          allocatedAmount: allocAmt,
          deductibleAmount: allocDed,
          nonDeductibleAmount: allocNonDed,
          expenseAccount: al.expenseAccount || "6424",
          costItem: al.expenseItem || "Chi phí khấu hao TSCĐ",
          creditAccount: creditAcc,
        });

        accountingEntries.push({
          description: `Khấu hao TSCĐ ${line.assetCode} - ${al.department} kỳ ${periodCode}`,
          debitAccount: al.expenseAccount || "6424",
          creditAccount: creditAcc,
          amount: allocAmt,
          departmentName: al.department,
          costItem: al.expenseItem || "Chi phí khấu hao TSCĐ",
          assetCode: line.assetCode,
        });
      });
    }

    return { allocations, accountingEntries };
  };

  const computePeriodDepreciationData = (
    targetMonth: number,
    targetYear: number,
    prorateByDays: boolean
  ): {
    lines: DeprLineItem[];
    allocations: DeprAllocationRow[];
    accountingEntries: DeprAccountingRow[];
  } => {
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const periodStart = new Date(targetYear, targetMonth - 1, 1);
    const periodEnd = new Date(targetYear, targetMonth - 1, daysInMonth);

    const computedLines: DeprLineItem[] = [];

    for (const rawAsset of assetsList) {
      const a: any = rawAsset;
      // AF07: Skip assets marked "Không tính khấu hao"
      if (a.noDepr) continue;
      // AF09: Skip disposed or suspended assets
      if (a.status === "DISPOSED" || a.status === "SUSPENDED" || a.statusDisplay === "Đã ghi giảm") continue;

      const startDt = parseDeprDateString(a.deprStartDate || a.startDate);
      // BR05: Skip assets whose depreciation start date is after period end
      if (startDt && startDt > periodEnd) continue;

      const originalCost = Number(a.originalCost || 0);
      const depreciableAmount = Number(a.deprCostValue || originalCost);
      const openingAccumulated = Number(a.depreciatedAmount || 0);
      const remainingDepreciable = Math.max(0, depreciableAmount - openingAccumulated);

      // AF06 / BR06: Skip fully depreciated assets
      if (remainingDepreciable <= 0) continue;

      const totalMonths =
        a.useDurationUnit === "Tháng"
          ? Math.max(1, Number(a.useDuration || a.years || 12))
          : Math.max(1, Math.round(Number(a.years || a.useDuration || 5) * 12));

      const baseMonthly =
        Number(a.deprMonthValue || 0) > 0
          ? Number(a.deprMonthValue)
          : Math.round(depreciableAmount / totalMonths);

      let effStart = periodStart;
      if (startDt && startDt > periodStart) {
        effStart = startDt;
      }
      const eligibleDays = Math.max(
        0,
        Math.floor((periodEnd.getTime() - effStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );
      if (eligibleDays <= 0) continue;

      // Section 4.1 & AF05: Prorate by days if mid-month and prorateByDays enabled
      let rawPeriodDepr = baseMonthly;
      if (prorateByDays && eligibleDays < daysInMonth) {
        rawPeriodDepr = Math.round((baseMonthly * eligibleDays) / daysInMonth);
      }

      // Section 4.2 & BR17: Cap final period at remaining depreciable value
      const periodDepr = Math.min(remainingDepreciable, Math.max(0, rawPeriodDepr));
      if (periodDepr <= 0) continue;

      // Section 4.6 & AF12: CIT deductible vs non-deductible split
      let deductibleAmount = periodDepr;
      let nonDeductibleAmount = 0;
      const hasTaxCap = Boolean(a.limitTaxLaw) && (Number(a.taxLawValue || 0) > 0 || Number(a.taxLawMonthValue || 0) > 0);
      if (hasTaxCap) {
        let monthlyTaxCap = Number(a.taxLawMonthValue || 0);
        if (monthlyTaxCap <= 0 && Number(a.taxLawValue || 0) > 0) {
          monthlyTaxCap = Math.round(Number(a.taxLawValue) / totalMonths);
        }
        if (prorateByDays && eligibleDays < daysInMonth) {
          monthlyTaxCap = Math.round((monthlyTaxCap * eligibleDays) / daysInMonth);
        }
        if (monthlyTaxCap > 0 && monthlyTaxCap < periodDepr) {
          deductibleAmount = monthlyTaxCap;
          nonDeductibleAmount = Math.max(0, periodDepr - deductibleAmount);
        }
      }

      const closingAccumulated = openingAccumulated + periodDepr;
      const openingValue = Math.max(0, originalCost - openingAccumulated);
      const closingValue = Math.max(0, originalCost - closingAccumulated);

      computedLines.push({
        assetId: a.id,
        assetCode: a.code,
        assetName: a.name,
        categoryName: a.category || "",
        departmentName: a.dept || "",
        originalCost,
        depreciableAmount,
        openingAccumulated,
        closingAccumulated,
        openingValue,
        closingValue,
        amount: periodDepr,
        deductibleAmount,
        nonDeductibleAmount,
        eligibleDays,
        totalDaysInPeriod: daysInMonth,
        deprAccount: a.deprAccount || "2141",
        expenseAccount: a.expenseAccount || "6424",
      });
    }

    const { allocations, accountingEntries } = buildAllocationsAndAccountingFromLines(
      computedLines,
      targetMonth,
      targetYear
    );

    return { lines: computedLines, allocations, accountingEntries };
  };

  const totalDeprMonthAmount = deprLines.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const totalDeprDeductibleAmount = deprLines.reduce((sum, r) => sum + Number(r.deductibleAmount || 0), 0);
  const totalDeprNonDeductibleAmount = deprLines.reduce((sum, r) => sum + Number(r.nonDeductibleAmount || 0), 0);
  const totalDeprAllocatedAmount = deprAllocationRows.reduce((sum, r) => sum + Number(r.allocatedAmount || 0), 0);
  const totalDeprAccountingAmount = deprAccountingRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const handleOpenDeprPeriodVoucher = (targetMonth: number, targetYear: number, prorate = deprProrateByDays) => {
    // EF02: Validate month & year
    if (!targetMonth || targetMonth < 1 || targetMonth > 12 || !targetYear || targetYear < 1990 || targetYear > 2100) {
      notify("Kỳ tính khấu hao không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    const mStr = String(targetMonth).padStart(2, "0");
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const dateStr = `${String(daysInMonth).padStart(2, "0")}/${mStr}/${targetYear}`;

    // Suggest dynamic voucher number without colliding with existing vouchers (Step 12, BR18)
    let candidateNo = `KH${mStr}${targetYear}`;
    if (deprVouchers.some((v) => v.voucherNo === candidateNo && v.status !== "Đã hủy")) {
      const nextIdx = deprVouchers.length + 1;
      candidateNo = `KH${String(nextIdx).padStart(5, "0")}`;
    }

    const applyLocalPreview = () => {
      const { lines, allocations, accountingEntries } = computePeriodDepreciationData(targetMonth, targetYear, prorate);
      if (lines.length === 0) {
        notify("Không có tài sản cố định đủ điều kiện tính khấu hao trong kỳ đã chọn.");
        return false;
      }
      setDeprCurrentRunId(null);
      setDeprVoucherStatus("Mới lập");
      setDeprVoucherNo(candidateNo);
      setDeprPostingDate(dateStr);
      setDeprVoucherDate(dateStr);
      setDeprReason(`Khấu hao TSCĐ tháng ${mStr} năm ${targetYear}`);
      setDeprReference("");
      setDeprVoucherMonth(targetMonth);
      setDeprVoucherYear(targetYear);
      setDeprLines(lines);
      setDeprAllocationRows(allocations);
      setDeprAccountingRows(accountingEntries);
      setDeprAttachments([]);
      setDeprIsDirty(false);
      setDeprActiveTab("depreciation");
      setShowDeprModal(false);
      setShowDeprVoucherModal(true);
      return true;
    };

    if (apiConnected) {
      void apiSave((writer) => previewDepreciationPeriod(writer, { month: targetMonth, year: targetYear, prorateByDays: prorate }))
        .then((res: any) => {
          if (!res) return;
          const data = res;
          const apiLines: DeprLineItem[] = (data.lines || []).map((l: any) => ({
            assetId: l.asset_id,
            assetCode: l.asset_code || "",
            assetName: l.asset_name || "",
            categoryName: l.category_name || "",
            departmentName: l.department_name || "",
            originalCost: apiNumber(l.original_cost),
            depreciableAmount: apiNumber(l.depreciable_amount),
            openingAccumulated: apiNumber(l.opening_accumulated_depreciation),
            closingAccumulated: apiNumber(l.closing_accumulated_depreciation),
            openingValue: apiNumber(l.opening_value),
            closingValue: apiNumber(l.closing_value),
            amount: apiNumber(l.amount),
            deductibleAmount: apiNumber(l.deductible_amount),
            nonDeductibleAmount: apiNumber(l.non_deductible_amount),
            eligibleDays: Number(l.eligible_days || daysInMonth),
            totalDaysInPeriod: Number(l.total_days_in_period || daysInMonth),
          }));
          const apiAllocs: DeprAllocationRow[] = (data.allocations || []).map((al: any) => ({
            assetCode: al.asset_code || "",
            assetName: al.asset_name || "",
            departmentName: al.department_name || "",
            rate: apiNumber(al.rate ?? 100),
            allocatedAmount: apiNumber(al.allocated_amount),
            deductibleAmount: apiNumber(al.deductible_amount),
            nonDeductibleAmount: apiNumber(al.non_deductible_amount),
            expenseAccount: al.expense_account_code || "6424",
            costItem: al.cost_item || "Chi phí khấu hao TSCĐ",
            creditAccount: al.credit_account_code || "2141",
          }));
          const apiEntries: DeprAccountingRow[] = (data.accounting_entries || []).map((ae: any) => ({
            description: ae.description || "",
            debitAccount: ae.debit_account_code || "6424",
            creditAccount: ae.credit_account_code || "2141",
            amount: apiNumber(ae.amount),
            departmentName: ae.department_name || "",
            costItem: ae.cost_item || "Chi phí khấu hao TSCĐ",
            assetCode: ae.asset_code || "",
          }));

          setDeprCurrentRunId(data.existing_run_id || null);
          setDeprVoucherStatus(data.existing_status === "POSTED" ? "Đã ghi sổ" : data.existing_status === "CALCULATED" ? "Chưa ghi sổ" : "Mới lập");
          setDeprVoucherNo(data.suggested_voucher_no || candidateNo);
          setDeprPostingDate(data.posting_date ? apiDate(data.posting_date) : dateStr);
          setDeprVoucherDate(data.voucher_date ? apiDate(data.voucher_date) : dateStr);
          setDeprReason(data.description || `Khấu hao TSCĐ tháng ${mStr} năm ${targetYear}`);
          setDeprReference("");
          setDeprVoucherMonth(targetMonth);
          setDeprVoucherYear(targetYear);
          setDeprLines(apiLines);
          setDeprAllocationRows(apiAllocs);
          setDeprAccountingRows(apiEntries);
          setDeprAttachments([]);
          setDeprIsDirty(false);
          setDeprActiveTab("depreciation");
          setShowDeprModal(false);
          setShowDeprVoucherModal(true);
        });
      return;
    }

    applyLocalPreview();
  };

  const handleSaveDeprVoucher = (opts: { postNow?: boolean; printAfter?: boolean; recalculate?: boolean } = {}) => {
    const postNow = opts.postNow !== undefined ? opts.postNow : true;
    const printAfter = Boolean(opts.printAfter);
    const recalculate = Boolean(opts.recalculate);

    // EF02: Validate period
    if (!deprVoucherMonth || deprVoucherMonth < 1 || deprVoucherMonth > 12 || !deprVoucherYear || deprVoucherYear < 1990 || deprVoucherYear > 2100) {
      notify("Kỳ tính khấu hao không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    // EF07: Validate voucher_no
    const trimmedNo = String(deprVoucherNo || "").trim();
    if (!trimmedNo) {
      notify("Vui lòng nhập số chứng từ tính khấu hao.");
      return;
    }

    // EF09: Validate postingDate & voucherDate
    const parsedVoucherDt = parseDeprDateString(deprVoucherDate);
    const parsedPostingDt = parseDeprDateString(deprPostingDate);
    if (!parsedVoucherDt || !parsedPostingDt) {
      notify("Ngày hạch toán hoặc ngày chứng từ không hợp lệ.");
      return;
    }

    // EF10: Posting date vs voucher date
    if (parsedPostingDt < parsedVoucherDt) {
      notify("Ngày hạch toán không phù hợp với kỳ tính khấu hao hoặc ngày chứng từ.");
      return;
    }

    // EF04: Must have at least 1 eligible asset line
    if (deprLines.length === 0 || totalDeprMonthAmount <= 0) {
      notify("Không có tài sản cố định đủ điều kiện tính khấu hao trong kỳ đã chọn.");
      return;
    }

    // EF24: Validate CIT deductible + non-deductible == amount for every asset line
    for (const line of deprLines) {
      const d = Number(line.deductibleAmount || 0);
      const nd = Number(line.nonDeductibleAmount || 0);
      if (d < 0 || nd < 0 || Math.abs(d + nd - Number(line.amount || 0)) > 1) {
        notify("Phân loại chi phí khấu hao hợp lý và không hợp lý không hợp lệ.");
        return;
      }
    }

    // EF11 & EF12: Validate allocation rows per asset
    for (const line of deprLines) {
      const assetAllocs = deprAllocationRows.filter((al) => al.assetCode === line.assetCode);
      if (assetAllocs.length === 0) {
        notify(`Tài sản ${line.assetCode} chưa được thiết lập thông tin phân bổ chi phí khấu hao.`);
        return;
      }
      const rateSum = assetAllocs.reduce((s, al) => s + Number(al.rate || 0), 0);
      if (Math.abs(rateSum - 100) > 0.05) {
        notify("Thông tin phân bổ chi phí khấu hao không hợp lệ. Tổng tỷ lệ phân bổ phải bằng 100%.");
        return;
      }
    }

    // EF13 & EF14: Validate accounting accounts
    for (const ae of deprAccountingRows) {
      if (!String(ae.debitAccount || "").trim() || !String(ae.creditAccount || "").trim()) {
        notify("Thiếu tài khoản hạch toán khấu hao. Vui lòng kiểm tra thiết lập tài khoản.");
        return;
      }
    }

    // EF15: Validate accounting total matches depreciation total
    if (Math.abs(totalDeprAccountingAmount - totalDeprMonthAmount) > 1 || Math.abs(totalDeprAllocatedAmount - totalDeprMonthAmount) > 1) {
      notify("Tổng số tiền hạch toán không khớp với tổng khấu hao trong kỳ.");
      return;
    }

    const mStr = String(deprVoucherMonth).padStart(2, "0");
    const periodLabel = `Tháng ${mStr}/${deprVoucherYear}`;

    // EF16: Check duplicate period voucher unless recalculating or updating current voucher
    const existingPeriodVoucher = deprVouchers.find(
      (v) => v.period === periodLabel && v.status !== "Đã hủy" && v.voucherNo !== trimmedNo
    );
    if (existingPeriodVoucher && !recalculate) {
      notify("Kỳ tính khấu hao đã có chứng từ hợp lệ. Vui lòng kiểm tra trước khi thực hiện lại.");
      return;
    }

    // EF08: Check duplicate voucher_no in another period
    const duplicateNoVoucher = deprVouchers.find(
      (v) => v.voucherNo === trimmedNo && v.period !== periodLabel && v.status !== "Đã hủy"
    );
    if (duplicateNoVoucher) {
      notify("Số chứng từ tính khấu hao đã tồn tại. Vui lòng kiểm tra lại.");
      return;
    }

    if (apiConnected) {
      void apiSave((writer) =>
        saveDepreciationVoucher(writer, {
          month: deprVoucherMonth,
          year: deprVoucherYear,
          voucherNo: trimmedNo,
          voucherDate: deprVoucherDate,
          postingDate: deprPostingDate,
          reason: deprReason,
          reference: deprReference,
          prorateByDays: deprProrateByDays,
          postNow,
          recalculate,
          lines: deprLines.map((l) => ({
            asset_id: l.assetId,
            asset_code: l.assetCode,
            amount: l.amount,
            deductible_amount: l.deductibleAmount,
            non_deductible_amount: l.nonDeductibleAmount,
          })),
          allocations: deprAllocationRows.map((al) => ({
            asset_code: al.assetCode,
            asset_name: al.assetName,
            department_name: al.departmentName,
            rate: al.rate,
            allocated_amount: al.allocatedAmount,
            deductible_amount: al.deductibleAmount,
            non_deductible_amount: al.nonDeductibleAmount,
            expense_account_code: al.expenseAccount,
            cost_item: al.costItem,
          })),
          accountingEntries: deprAccountingRows.map((ae) => ({
            description: ae.description,
            debit_account_code: ae.debitAccount,
            credit_account_code: ae.creditAccount,
            amount: ae.amount,
            department_name: ae.departmentName,
            cost_item: ae.costItem,
            asset_code: ae.assetCode,
          })),
          attachments: deprAttachments,
        })
      ).then((saved) => {
        if (!saved) return;
        setDeprIsDirty(false);
        setShowDeprVoucherModal(false);
        setDeprView("table");
        if (printAfter) {
          handlePrintDeprVoucher(trimmedNo);
        }
      });
      return;
    }

    // Local state update: If recalculating an already-posted voucher for this period, revert old lines first (BR32)
    const oldPostedForPeriod = deprVouchers.find((v) => v.period === periodLabel && v.status === "Đã ghi sổ");
    setAssetsList((prevAssets) =>
      prevAssets.map((rawAsset) => {
        const a: any = { ...rawAsset };
        if (oldPostedForPeriod && Array.isArray(oldPostedForPeriod.lines)) {
          const oldLine = oldPostedForPeriod.lines.find((ol: any) => ol.assetCode === a.code);
          if (oldLine) {
            a.depreciatedAmount = Math.max(0, Number(a.depreciatedAmount || 0) - Number(oldLine.amount || 0));
            a.remainingAmount = Math.max(0, Number(a.originalCost || 0) - a.depreciatedAmount);
          }
        }
        if (postNow) {
          const newLine = deprLines.find((nl) => nl.assetCode === a.code);
          if (newLine) {
            // BR16: Preserve originalCost, update depreciatedAmount and remainingAmount
            a.depreciatedAmount = Number(a.depreciatedAmount || 0) + Number(newLine.amount || 0);
            a.remainingAmount = Math.max(0, Number(a.originalCost || 0) - a.depreciatedAmount);
          }
        }
        return a;
      })
    );

    const newVoucherRecord = {
      voucherNo: trimmedNo,
      date: deprVoucherDate,
      postingDate: deprPostingDate,
      month: deprVoucherMonth,
      year: deprVoucherYear,
      period: periodLabel,
      amount: totalDeprMonthAmount,
      deductibleAmount: totalDeprDeductibleAmount,
      nonDeductibleAmount: totalDeprNonDeductibleAmount,
      reason: deprReason,
      reference: deprReference,
      status: postNow ? "Đã ghi sổ" : "Chưa ghi sổ",
      rawStatus: postNow ? "POSTED" : "CALCULATED",
      lines: deprLines,
      allocations: deprAllocationRows,
      accountingEntries: deprAccountingRows,
      attachments: deprAttachments,
    };

    setDeprVouchers((prev) => [
      newVoucherRecord,
      ...prev.filter((x) => x.voucherNo !== trimmedNo && !(recalculate && x.period === periodLabel)),
    ]);
    setDeprVoucherStatus(postNow ? "Đã ghi sổ" : "Chưa ghi sổ");
    setDeprIsDirty(false);
    setShowDeprVoucherModal(false);
    setDeprView("table");
    notify(`Đã lưu chứng từ tính khấu hao ${trimmedNo} thành công!`);
    if (printAfter) {
      handlePrintDeprVoucher(trimmedNo);
    }
  };

  const handleUnpostDeprVoucher = () => {
    if (deprVoucherStatus !== "Đã ghi sổ") return;
    if (apiConnected && deprCurrentRunId) {
      void apiSave((writer) => unpostDepreciationVoucher(writer, deprCurrentRunId)).then((res) => {
        if (!res) return;
        setDeprVoucherStatus("Chưa ghi sổ");
      });
      return;
    }
    // Roll back asset accumulated depreciation (AF14, BR34)
    setAssetsList((prevAssets) =>
      prevAssets.map((rawAsset) => {
        const a: any = { ...rawAsset };
        const line = deprLines.find((l) => l.assetCode === a.code);
        if (line) {
          a.depreciatedAmount = Math.max(0, Number(a.depreciatedAmount || 0) - Number(line.amount || 0));
          a.remainingAmount = Math.max(0, Number(a.originalCost || 0) - a.depreciatedAmount);
        }
        return a;
      })
    );
    setDeprVouchers((prev) =>
      prev.map((v) =>
        v.voucherNo === deprVoucherNo ? { ...v, status: "Chưa ghi sổ", rawStatus: "CALCULATED" } : v
      )
    );
    setDeprVoucherStatus("Chưa ghi sổ");
    notify(`Đã bỏ ghi sổ chứng từ tính khấu hao ${deprVoucherNo}.`);
  };

  // UC-FA-04 AF04: Đồng bộ Tab Hạch toán khi chỉnh sửa Tab Phân bổ trước khi ghi sổ
  const syncDeprAccountingFromAllocations = (nextAllocs: DeprAllocationRow[]) => {
    const mStr = String(deprVoucherMonth).padStart(2, "0");
    const rebuilt: DeprAccountingRow[] = nextAllocs.map((al) => ({
      description: `Khấu hao TSCĐ ${al.assetCode} - ${al.assetName} tháng ${mStr}/${deprVoucherYear} (${al.departmentName})`,
      debitAccount: al.expenseAccount || "6424",
      creditAccount: al.creditAccount || "2141",
      amount: Number(al.allocatedAmount || 0),
      departmentName: al.departmentName || "",
      costItem: al.costItem || "Chi phí khấu hao TSCĐ",
      assetCode: al.assetCode || "",
    }));
    setDeprAccountingRows(rebuilt);
  };

  // UC-FA-04 AF05 & BR16: Gộp các dòng hạch toán có cùng cặp tài khoản Nợ/Có và Bộ phận/Khoản mục CP
  const handleConsolidateDeprAccountingRows = () => {
    if (deprVoucherStatus === "Đã ghi sổ") return;
    const grouped = new Map<string, DeprAccountingRow & { sourceCodes: string[] }>();
    const mStr = String(deprVoucherMonth).padStart(2, "0");
    for (const row of deprAccountingRows) {
      const key = `${row.debitAccount.trim()}|${row.creditAccount.trim()}|${row.departmentName.trim()}|${(row.costItem || "").trim()}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ...row,
          sourceCodes: row.assetCode ? [row.assetCode] : [],
        });
      } else {
        existing.amount = Number(existing.amount || 0) + Number(row.amount || 0);
        if (row.assetCode && !existing.sourceCodes.includes(row.assetCode)) {
          existing.sourceCodes.push(row.assetCode);
        }
        existing.description = `Hạch toán khấu hao TSCĐ kỳ ${mStr}/${deprVoucherYear} (${row.departmentName || "Gộp"}: ${existing.sourceCodes.join(", ")})`;
        existing.assetCode = existing.sourceCodes.join(", ");
      }
    }
    setDeprAccountingRows(Array.from(grouped.values()).map(({ sourceCodes: _s, ...rest }) => rest));
    setDeprIsDirty(true);
    notify("Đã gộp các dòng hạch toán có cùng cặp tài khoản và đối tượng chi phí (UC-FA-04 AF05).");
  };

  // UC-FA-04 Main Flow (Steps 7–22) & Exception Flows (EF01–EF21): Ghi sổ chứng từ khấu hao
  const handlePostDeprVoucher = (opts: { printAfter?: boolean; targetVoucher?: any } = {}) => {
    const printAfter = Boolean(opts.printAfter);
    const vTarget = opts.targetVoucher;

    const currentStatus = vTarget ? vTarget.status : deprVoucherStatus;
    if (currentStatus === "Đã ghi sổ") {
      // EF03
      notify("Chứng từ khấu hao đã được ghi sổ.");
      return;
    }

    const trimmedNo = String(vTarget ? vTarget.voucherNo : deprVoucherNo || "").trim();
    if (!trimmedNo) {
      // EF04
      notify("Số chứng từ khấu hao không hợp lệ.");
      return;
    }

    const vMonth = Number(vTarget ? vTarget.month || String(vTarget.period || "").replace(/\D+/g, "").slice(0, 2) : deprVoucherMonth);
    const vYear = Number(vTarget ? vTarget.year || String(vTarget.period || "").slice(-4) : deprVoucherYear);
    if (!vMonth || vMonth < 1 || vMonth > 12 || !vYear || vYear < 1990 || vYear > 2100) {
      // EF07
      notify("Chưa xác định được kỳ khấu hao của chứng từ.");
      return;
    }

    const vDateStr = String(vTarget ? vTarget.date : deprVoucherDate || "");
    const pDateStr = String(vTarget ? vTarget.postingDate || vTarget.date : deprPostingDate || "");
    const parsedVoucherDt = parseDeprDateString(vDateStr);
    const parsedPostingDt = parseDeprDateString(pDateStr);
    if (
      !parsedVoucherDt ||
      !parsedPostingDt ||
      parsedPostingDt.getMonth() + 1 !== vMonth ||
      parsedPostingDt.getFullYear() !== vYear
    ) {
      // EF05
      notify("Ngày hạch toán không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    const fallbackCalc = vTarget && (!Array.isArray(vTarget.lines) || vTarget.lines.length === 0)
      ? computePeriodDepreciationData(vMonth, vYear, false)
      : null;
    const linesToValidate: DeprAssetLine[] = vTarget
      ? (Array.isArray(vTarget.lines) && vTarget.lines.length > 0 ? vTarget.lines : fallbackCalc?.lines || [])
      : deprLines;
    const allocsToValidate: DeprAllocationRow[] = vTarget
      ? (Array.isArray(vTarget.allocations) && vTarget.allocations.length > 0 ? vTarget.allocations : fallbackCalc?.allocations || [])
      : deprAllocationRows;
    const acctToValidate: DeprAccountingRow[] = vTarget
      ? (Array.isArray(vTarget.accountingEntries) && vTarget.accountingEntries.length > 0 ? vTarget.accountingEntries : fallbackCalc?.accountingEntries || [])
      : deprAccountingRows;

    const totalDepr = linesToValidate.reduce((s, l) => s + Number(l.amount || 0), 0);
    if (linesToValidate.length === 0 || totalDepr <= 0) {
      // EF10
      notify("Chứng từ chưa có dữ liệu khấu hao để ghi nhận.");
      return;
    }

    // AF13: Check if any prior period depreciation voucher is still unposted ("Chưa ghi sổ")
    const hasUnpostedPrior = deprVouchers.some((pv) => {
      if (pv.voucherNo === trimmedNo || pv.status !== "Chưa ghi sổ") return false;
      const pm = Number(pv.month || String(pv.period || "").replace(/\D+/g, "").slice(0, 2) || 0);
      const py = Number(pv.year || String(pv.period || "").slice(-4) || 0);
      return py < vYear || (py === vYear && pm < vMonth);
    });
    if (hasUnpostedPrior) {
      notify("Khấu hao kỳ trước chưa được ghi sổ. Vui lòng ghi sổ kỳ trước trước khi thực hiện.");
      return;
    }

    const mStr = String(vMonth).padStart(2, "0");
    const periodLabel = `Tháng ${mStr}/${vYear}`;

    // EF14, EF15, EF16, EF17: Validate asset eligibility and remaining depreciable balance
    if (deprVouchers.some((pv) => pv.period === periodLabel && pv.status === "Đã ghi sổ" && pv.voucherNo !== trimmedNo)) {
      // EF14
      notify("Tài sản đã được ghi nhận khấu hao trong kỳ này.");
      return;
    }

    for (const line of linesToValidate) {
      const currentAsset: any = assetsList.find((a) => a.code === line.assetCode);
      if (currentAsset) {
        if (
          currentAsset.status === "DISPOSED" ||
          currentAsset.statusDisplay === "Đã ghi giảm" ||
          currentAsset.status === "SUSPENDED" ||
          currentAsset.statusDisplay === "Ngừng sử dụng" ||
          decVouchers.some((dv) => dv.assetCode === line.assetCode)
        ) {
          // EF17
          notify("Thông tin tài sản không còn phù hợp với kết quả khấu hao. Vui lòng kiểm tra lại.");
          return;
        }
        const remAllowed = Math.max(0, Number(currentAsset.originalCost || 0) - Number(currentAsset.depreciatedAmount || 0));
        if (Number(line.amount || 0) <= 0 || Number(line.amount || 0) > remAllowed) {
          // EF15
          notify("Giá trị khấu hao vượt mức được phép của tài sản.");
          return;
        }
      }
    }

    // EF13 & EF11: Validate allocations
    if (allocsToValidate.length === 0) {
      notify("Chưa thiết lập đầy đủ thông tin phân bổ khấu hao.");
      return;
    }
    for (const al of allocsToValidate) {
      if (!String(al.departmentName || "").trim() || !String(al.expenseAccount || "").trim() || Number(al.rate || 0) <= 0) {
        notify("Chưa thiết lập đầy đủ thông tin phân bổ khấu hao.");
        return;
      }
    }
    for (const line of linesToValidate) {
      const aAllocs = allocsToValidate.filter((al) => al.assetCode === line.assetCode);
      if (aAllocs.length === 0) {
        notify("Chưa thiết lập đầy đủ thông tin phân bổ khấu hao.");
        return;
      }
      const rSum = aAllocs.reduce((s, al) => s + Number(al.rate || 0), 0);
      if (Math.abs(rSum - 100) > 0.05) {
        notify("Chưa thiết lập đầy đủ thông tin phân bổ khấu hao.");
        return;
      }
      const amtSum = aAllocs.reduce((s, al) => s + Number(al.allocatedAmount || 0), 0);
      if (Math.abs(amtSum - Number(line.amount || 0)) > 1) {
        notify("Tổng tiền phân bổ không khớp với số khấu hao đã tính.");
        return;
      }
    }
    const totalAlloc = allocsToValidate.reduce((s, al) => s + Number(al.allocatedAmount || 0), 0);
    if (Math.abs(totalAlloc - totalDepr) > 1) {
      notify("Tổng tiền phân bổ không khớp với số khấu hao đã tính.");
      return;
    }

    // EF08, EF09, EF12: Validate accounting entries
    const validDebitPrefixes = ["621", "622", "623", "627", "641", "642", "154", "241", "811"];
    if (acctToValidate.length === 0) {
      notify("Số tiền hạch toán không khớp với số khấu hao của chứng từ.");
      return;
    }
    for (const ae of acctToValidate) {
      const dAcc = String(ae.debitAccount || "").trim();
      const cAcc = String(ae.creditAccount || "").trim();
      if (!dAcc || !validDebitPrefixes.some((p) => dAcc.startsWith(p))) {
        // EF08
        notify("Tài khoản ghi Nợ không hợp lệ.");
        return;
      }
      if (!cAcc || !cAcc.startsWith("214")) {
        // EF09
        notify("Tài khoản hao mòn TSCĐ không hợp lệ.");
        return;
      }
      if (Number(ae.amount || 0) <= 0) {
        // EF12
        notify("Số tiền hạch toán không khớp với số khấu hao của chứng từ.");
        return;
      }
    }
    const totalAcct = acctToValidate.reduce((s, ae) => s + Number(ae.amount || 0), 0);
    if (Math.abs(totalAcct - totalDepr) > 1) {
      // EF12
      notify("Số tiền hạch toán không khớp với số khấu hao của chứng từ.");
      return;
    }

    const targetRunId = vTarget ? vTarget.id : deprCurrentRunId;
    if (apiConnected) {
      if (targetRunId) {
        void apiSave((writer) =>
          postDepreciationVoucher(writer, String(targetRunId), {
            voucher_no: trimmedNo,
            voucher_date: vDateStr,
            posting_date: pDateStr,
            month: vMonth,
            year: vYear,
            description: vTarget ? vTarget.reason : deprReason,
            reference: vTarget ? vTarget.reference : deprReference,
            allocations: allocsToValidate.map((al) => ({
              asset_code: al.assetCode,
              asset_name: al.assetName,
              department_name: al.departmentName,
              rate: al.rate,
              allocated_amount: al.allocatedAmount,
              deductible_amount: al.deductibleAmount,
              non_deductible_amount: al.nonDeductibleAmount,
              expense_account: al.expenseAccount,
              expense_account_code: al.expenseAccount,
              cost_item: al.costItem,
              credit_account: al.creditAccount,
            })),
            accounting_entries: acctToValidate.map((ae) => ({
              description: ae.description,
              debit_account: ae.debitAccount,
              debit_account_code: ae.debitAccount,
              credit_account: ae.creditAccount,
              credit_account_code: ae.creditAccount,
              amount: ae.amount,
              department_name: ae.departmentName,
              cost_item: ae.costItem,
              asset_code: ae.assetCode,
            })),
          })
        ).then((posted) => {
          if (!posted) return;
          setDeprVoucherStatus("Đã ghi sổ");
          setDeprIsDirty(false);
          setShowDeprVoucherModal(false);
          setDeprView("table");
          if (printAfter) {
            handlePrintDeprVoucher(trimmedNo);
          }
        });
        return;
      }
      // If voucher was not saved yet, save and post now
      handleSaveDeprVoucher({ postNow: true, printAfter, recalculate: false });
      return;
    }

    // Local state update: Update each asset's depreciatedAmount and remainingAmount (BR19–BR22)
    setAssetsList((prevAssets) =>
      prevAssets.map((rawAsset) => {
        const a: any = { ...rawAsset };
        const matchedLine = linesToValidate.find((nl) => nl.assetCode === a.code);
        if (matchedLine) {
          a.depreciatedAmount = Number(a.depreciatedAmount || 0) + Number(matchedLine.amount || 0);
          a.remainingAmount = Math.max(0, Number(a.originalCost || 0) - a.depreciatedAmount);
        }
        return a;
      })
    );

    const postedVoucherRecord = {
      voucherNo: trimmedNo,
      date: vDateStr,
      postingDate: pDateStr,
      month: vMonth,
      year: vYear,
      period: periodLabel,
      amount: totalDepr,
      deductibleAmount: linesToValidate.reduce((s, l) => s + Number(l.deductibleAmount || 0), 0),
      nonDeductibleAmount: linesToValidate.reduce((s, l) => s + Number(l.nonDeductibleAmount || 0), 0),
      reason: vTarget ? vTarget.reason : deprReason,
      reference: vTarget ? vTarget.reference : deprReference,
      status: "Đã ghi sổ",
      rawStatus: "POSTED",
      lines: linesToValidate,
      allocations: allocsToValidate,
      accountingEntries: acctToValidate,
      attachments: vTarget ? vTarget.attachments || [] : deprAttachments,
    };

    setDeprVouchers((prev) => {
      const exists = prev.some((x) => x.voucherNo === trimmedNo);
      if (exists) {
        return prev.map((x) => (x.voucherNo === trimmedNo ? postedVoucherRecord : x));
      }
      return [postedVoucherRecord, ...prev];
    });
    setDeprVoucherStatus("Đã ghi sổ");
    setDeprIsDirty(false);
    setShowDeprVoucherModal(false);
    setDeprView("table");
    notify("Ghi sổ chứng từ khấu hao thành công.");
    if (printAfter) {
      handlePrintDeprVoucher(trimmedNo);
    }
  };

  const handleExportDeprAllocationExcel = () => {
    if (deprAllocationRows.length === 0) {
      notify("Không có dữ liệu phân bổ khấu hao để xuất khẩu.");
      return;
    }
    if (apiConnected && deprCurrentRunId) {
      void apiSave((writer) => exportDepreciationAllocation(writer, deprCurrentRunId));
    }
    try {
      const headers = [
        "STT",
        "Mã tài sản",
        "Tên tài sản",
        "Đơn vị sử dụng",
        "Tỷ lệ PB (%)",
        "Giá trị KH phân bổ",
        "Giá trị CP hợp lý",
        "Giá trị CP không hợp lý",
        "TK chi phí",
        "Khoản mục chi phí",
      ];
      const csvRows = [
        headers.join(","),
        ...deprAllocationRows.map((row, idx) =>
          [
            idx + 1,
            `"${row.assetCode}"`,
            `"${row.assetName.replace(/"/g, '""')}"`,
            `"${row.departmentName.replace(/"/g, '""')}"`,
            row.rate,
            row.allocatedAmount,
            row.deductibleAmount,
            row.nonDeductibleAmount,
            `"${row.expenseAccount}"`,
            `"${(row.costItem || "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ];
      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Bang_Phan_Bo_Khau_Hao_TSCD_${deprVoucherNo}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      notify(`Đã xuất khẩu bảng phân bổ khấu hao tài sản cố định (Bang_Phan_Bo_Khau_Hao_TSCD_${deprVoucherNo}.csv) thành công!`);
    } catch {
      // EF21
      notify("Không thể xuất khẩu bảng phân bổ khấu hao. Vui lòng thử lại.");
    }
  };

  const handlePrintDeprVoucher = (voucherNoArg?: string) => {
    const vNo = voucherNoArg || deprVoucherNo;
    notify(`Đang chuẩn bị bản in Bảng tính và phân bổ khấu hao TSCĐ (${vNo})...`);
    if (typeof window !== "undefined" && typeof window.print === "function") {
      setTimeout(() => {
        try {
          window.print();
        } catch {
          notify("Không thể in chứng từ tính khấu hao. Vui lòng thử lại.");
        }
      }, 250);
    }
  };


  // Check URL params for action
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "opening") {
      setShowOpeningModal(true);
    } else if (action === "new") {
      setShowAddAssetModal(true);
    } else if (action === "depreciation" || (tab === "depreciation" && action === "add")) {
      setShowDeprVoucherModal(true);
    } else if (action === "select-period") {
      setShowDeprModal(true);
    } else if (action === "reval") {
      openNewReval();
    } else if (action === "transfer") {
      setShowTransferModal(true);
    } else if (action === "decrease") {
      setShowDecreaseModal(true);
    } else if (action === "stocktake") {
      setShowStocktakeModal(true);
    }
    const viewParam = urlParams.get("view");
    if (viewParam === "table") {
      setRegisterView("table");
      setIncreaseView("table");
      setDeprView("table");
      setRevalView("table");
      setTransferView("table");
      setDecreaseView("table");
      setStocktakeView("table");
    }
  }, [tab]);

  // =========================================================================
  // UC-FA-09: CALCULATIONS & HELPERS FOR SỔ TÀI SẢN & BÁO CÁO TSCĐ
  // =========================================================================
  const reconstructAssetSnapshotAtDate = (rawAsset: any, asOfDt: Date | null) => {
    const startDt = parseDeprDateString(String(rawAsset.startDate || "01/01/2026"));
    if (asOfDt && startDt && startDt.getTime() > asOfDt.getTime()) {
      return { acquiredByDate: false, ...rawAsset };
    }

    // Check disposal vouchers up to asOfDt (AF05 & AF06)
    const dispVoucher = decVouchers.find(
      (dv: any) => String(dv.assetCode || "").toLowerCase() === String(rawAsset.code || "").toLowerCase()
    );
    const dispDt = dispVoucher ? parseDeprDateString(String(dispVoucher.date || "")) : null;
    let isDisposedAtDate = false;
    if (dispDt && asOfDt) {
      isDisposedAtDate = dispDt.getTime() <= asOfDt.getTime();
    } else if (rawAsset.status === "DISPOSED" || rawAsset.statusDisplay === "Đã ghi giảm" || Boolean(dispVoucher)) {
      isDisposedAtDate = true;
    }

    // Step 9 & AF03 & AF05: Reconstruct effective department at asOfDt
    let effectiveDept = String(rawAsset.dept || "");
    const assetTransfers = transferVouchers
      .filter((tv: any) => String(tv.assetCode || "").toLowerCase() === String(rawAsset.code || "").toLowerCase())
      .map((tv: any) => ({ ...tv, dt: parseDeprDateString(String(tv.date || "")) }))
      .filter((tv: any) => Boolean(tv.dt))
      .sort((a: any, b: any) => a.dt.getTime() - b.dt.getTime());

    if (asOfDt && assetTransfers.length > 0) {
      const futureTransfers = assetTransfers.filter((tv: any) => tv.dt.getTime() > asOfDt.getTime());
      const pastTransfers = assetTransfers.filter((tv: any) => tv.dt.getTime() <= asOfDt.getTime());
      if (futureTransfers.length > 0 && futureTransfers[0].fromDept) {
        effectiveDept = String(futureTransfers[0].fromDept);
      } else if (pastTransfers.length > 0 && pastTransfers[pastTransfers.length - 1].toDept) {
        effectiveDept = String(pastTransfers[pastTransfers.length - 1].toDept);
      }
    }

    // Steps 11–13 & AF05: Reconstruct originalCost, depreciatedAmount, remainingAmount at asOfDt
    let effOrig = Number(rawAsset.originalCost || 0);
    let effDepr = Number(rawAsset.depreciatedAmount || 0);

    if (asOfDt) {
      const futureRevals = revalVouchers.filter((rv: any) => {
        if (String(rv.assetCode || "").toLowerCase() !== String(rawAsset.code || "").toLowerCase()) return false;
        const rDt = parseDeprDateString(String(rv.date || ""));
        return Boolean(rDt && rDt.getTime() > asOfDt.getTime());
      });
      for (const rv of futureRevals) {
        effOrig = Math.max(0, effOrig - Number((rv as any).diffAmount || 0));
      }
    }

    effDepr = Math.min(effOrig, Math.max(0, effDepr));
    const effRem = Math.max(0, effOrig - effDepr);

    // Step 14: Depreciation rate display per method (never fabricate a fixed rate for non-fixed-rate methods)
    const rawMethod = String(rawAsset.method || rawAsset.depreciationMethod || "STRAIGHT_LINE").toUpperCase();
    const descLower = String(rawAsset.description || "").toLowerCase();
    let rateDisplay = `${rawAsset.rateYear ?? 0}%`;
    if (rawAsset.noDepr) {
      rateDisplay = reportLang === "en" ? "No depreciation" : "Không tính KH";
    } else if (rawMethod === "UNITS_OF_PRODUCTION" || rawMethod === "OTHER" || descLower.includes("sản lượng")) {
      rateDisplay = reportLang === "en" ? "By units of production" : "Theo sản lượng";
    } else if (rawMethod === "DECLINING_BALANCE" || descLower.includes("giảm dần")) {
      rateDisplay = reportLang === "en" ? "Declining balance" : "Theo số dư giảm dần";
    }

    const effStatusDisplay = isDisposedAtDate
      ? "Đã ghi giảm"
      : effRem === 0 && effOrig > 0
      ? "Đã KH hết, còn sử dụng"
      : rawAsset.statusDisplay || "Đang sử dụng";

    return {
      ...rawAsset,
      acquiredByDate: true,
      dept: effectiveDept,
      originalCost: effOrig,
      depreciatedAmount: effDepr,
      remainingAmount: effRem,
      rateDisplay,
      isDisposedAtDate,
      statusDisplay: effStatusDisplay,
      disposalVoucherNo: isDisposedAtDate ? (dispVoucher?.voucherNo || "GGTS00001") : "",
      disposalDate: isDisposedAtDate ? (dispVoucher?.date || "") : "",
      disposalReason: isDisposedAtDate ? (dispVoucher?.reason || "Nhượng bán, thanh lý") : "",
    };
  };

  const registerAsOfDtObj = parseDeprDateString(registerAsOfDate);

  const filteredAssets = (() => {
    const seenCodes = new Set<string>();
    const result: any[] = [];
    const kw = String(searchRegister || "").trim().toLowerCase();

    for (const a of assetsList) {
      const codeKey = String(a.code || "").trim().toLowerCase();
      if (!codeKey || seenCodes.has(codeKey)) continue;

      const snap = reconstructAssetSnapshotAtDate(a, registerAsOfDtObj);
      if (!snap.acquiredByDate) continue;

      // AF06: Exclude disposed assets unless registerIncludeDisposed is checked
      if (snap.isDisposedAtDate && !registerIncludeDisposed) continue;

      // Step 17 & AF03: Filter by effective department at asOfDate
      if (filterDept !== "all" && snap.dept !== filterDept) continue;

      // Filter by category
      if (registerCategoryFilter !== "all" && String(snap.category || "") !== registerCategoryFilter) continue;

      // Step 16 & AF02 & AF04: Case-insensitive keyword search
      if (kw) {
        const haystack = [
          snap.code,
          snap.name,
          snap.dept,
          snap.category,
          snap.voucherNo,
          snap.serialNumber,
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(kw)) continue;
      }

      seenCodes.add(codeKey);
      result.push(snap);
    }
    return result;
  })();

  // Steps 19–22 & AF07 & AF08: Summary metrics across the ENTIRE filtered dataset
  const totalOriginalCost = filteredAssets.reduce((s, a) => s + Number(a.originalCost || 0), 0);
  const totalDepreciated = filteredAssets.reduce((s, a) => s + Number(a.depreciatedAmount || 0), 0);
  const totalRemaining = Math.max(0, totalOriginalCost - totalDepreciated);

  // AF07: Pagination for Sổ tài sản (20, 50, 100)
  const registerTotalPages = Math.max(1, Math.ceil(filteredAssets.length / registerPageSize));
  const safeRegisterPage = Math.min(registerCurrentPage, registerTotalPages);
  const paginatedRegisterAssets = filteredAssets.slice(
    (safeRegisterPage - 1) * registerPageSize,
    safeRegisterPage * registerPageSize
  );

  // Steps 24–25: Xuất khẩu Sổ tài sản ra Excel (100% read-only)
  const handleExportRegisterExcel = () => {
    if (registerAsOfDate.trim() && !registerAsOfDtObj) {
      notify("Ngày xem số liệu không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY.");
      return;
    }
    if (apiConnected) {
      void apiSave(async (writer) => {
        await fetchFixedAssetRegister(writer, {
          asOfDate: registerAsOfDate,
          search: searchRegister,
          departmentName: filterDept === "all" ? "" : filterDept,
          categoryName: registerCategoryFilter === "all" ? "" : registerCategoryFilter,
          includeDisposed: registerIncludeDisposed,
          exportExcel: true,
        });
        return { message: "" };
      });
    }
    if (typeof window !== "undefined" && typeof Blob !== "undefined") {
      const headers = [
        "STT",
        "Mã TSCĐ",
        "Tên tài sản cố định",
        "Loại tài sản",
        "Đơn vị sử dụng",
        "Ngày ghi tăng",
        "Nguyên giá",
        "Hao mòn lũy kế",
        "Giá trị còn lại",
        "Tỷ lệ KH",
        "TK NG",
        "Trạng thái TS",
      ];
      const csvRows = [
        headers.join(","),
        ...filteredAssets.map((r, idx) =>
          [
            idx + 1,
            `"${String(r.code || "").replace(/"/g, '""')}"`,
            `"${String(r.name || "").replace(/"/g, '""')}"`,
            `"${String(r.category || "").replace(/"/g, '""')}"`,
            `"${String(r.dept || "").replace(/"/g, '""')}"`,
            `"${String(r.startDate || "")}"`,
            r.originalCost,
            r.depreciatedAmount,
            r.remainingAmount,
            `"${String(r.rateDisplay || `${r.rateYear}%`)}"`,
            `"${String(r.costAccount || "2111")}"`,
            `"${String(r.statusDisplay || "Đang sử dụng")}"`,
          ].join(",")
        ),
        [
          "",
          `"TỔNG CỘNG (${filteredAssets.length} tài sản)"`,
          "",
          "",
          "",
          "",
          totalOriginalCost,
          totalDepreciated,
          totalRemaining,
          "",
          "",
          "",
        ].join(","),
      ];
      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `So_Tai_San_Co_Dinh_${registerAsOfDate.replace(/\//g, "") || "20261231"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    notify(`Đã xuất khẩu Sổ tài sản cố định tại ngày ${registerAsOfDate} ra file Excel thành công.`);
  };

  // Main Flow B: Danh mục 6 Báo cáo TSCĐ chuẩn (Steps 2–4, AF10–AF16)
  const UC09_REPORT_CATALOG = [
    {
      id: "S21",
      code: "S21_DN",
      group: "ASSET",
      formCode: "Mẫu số S21-DN",
      titleVi: "S21 - DN: Sổ tài sản cố định",
      titleEn: "S21 - DN: Statutory Fixed Asset Register",
      keywords: ["s21", "sổ tài sản", "thông tư 200", "thông tư 133", "statutory", "ghi tăng", "ghi giảm"],
    },
    {
      id: "SO_TSCD",
      code: "ASSET_REGISTER",
      group: "ASSET",
      formCode: "BC-TS01",
      titleVi: "Sổ tài sản cố định",
      titleEn: "Fixed Asset Register",
      keywords: ["sổ tài sản cố định", "tổng hợp tài sản", "nguyên giá", "hao mòn", "còn lại"],
    },
    {
      id: "THE_TSCD",
      code: "ASSET_CARD",
      group: "ASSET",
      formCode: "Mẫu số S22-DN",
      titleVi: "Thẻ tài sản cố định",
      titleEn: "Fixed Asset Card",
      keywords: ["thẻ tài sản", "s22", "lịch sử tài sản", "phụ tùng", "bộ phận cấu thành", "card"],
    },
    {
      id: "KH_NAM",
      code: "ANNUAL_DEPRECIATION_SCHEDULE",
      group: "ASSET",
      formCode: "BC-TS02",
      titleVi: "Bảng tính khấu hao tài sản cố định theo năm",
      titleEn: "Annual Fixed Asset Depreciation Schedule",
      keywords: ["bảng tính khấu hao", "khấu hao năm", "12 tháng", "phân bổ khấu hao", "annual"],
    },
    {
      id: "DC_SO_CAI",
      code: "RECONCILE_FA_GL",
      group: "RECONCILE",
      formCode: "BC-ĐC01",
      titleVi: "Báo cáo đối chiếu sổ tài sản và sổ cái",
      titleEn: "Reconciliation Report: Fixed Asset Subledger vs. General Ledger",
      keywords: ["đối chiếu sổ cái", "sổ cái", "211", "214", "chênh lệch hạch toán", "gl"],
    },
    {
      id: "DC_KIEM_KE",
      code: "RECONCILE_STOCKTAKE_FA",
      group: "RECONCILE",
      formCode: "BC-ĐC02",
      titleVi: "Báo cáo đối chiếu kết quả kiểm kê với sổ tài sản",
      titleEn: "Reconciliation Report: Physical Count vs. Fixed Asset Register",
      keywords: ["đối chiếu kiểm kê", "kiểm kê", "thừa", "thiếu", "sai đơn vị", "stocktake"],
    },
  ];

  const handleSelectReportPeriodPreset = (preset: string) => {
    setReportPeriodPreset(preset);
    const y = reportYear || 2026;
    if (preset === "YEAR_2026") {
      setReportFromDate(`01/01/${y}`);
      setReportToDate(`31/12/${y}`);
    } else if (preset === "Q1") {
      setReportFromDate(`01/01/${y}`);
      setReportToDate(`31/03/${y}`);
    } else if (preset === "Q2") {
      setReportFromDate(`01/04/${y}`);
      setReportToDate(`30/06/${y}`);
    } else if (preset === "Q3") {
      setReportFromDate(`01/07/${y}`);
      setReportToDate(`30/09/${y}`);
    } else if (preset === "Q4") {
      setReportFromDate(`01/10/${y}`);
      setReportToDate(`31/12/${y}`);
    } else if (preset === "M10") {
      setReportFromDate(`01/10/${y}`);
      setReportToDate(`31/10/${y}`);
    }
  };

  const handleOpenReportByDef = (def: (typeof UC09_REPORT_CATALOG)[number]) => {
    setPreviewReportCode(def.code);
    setPreviewReportName(reportLang === "en" ? def.titleEn : def.titleVi);
    setApiReportPayload(null);
    if (apiConnected) {
      void apiSave(async (writer) => {
        const res = await fetchFixedAssetReport(writer, {
          reportCode: def.code,
          year: reportYear,
          fromDate: reportFromDate,
          toDate: reportToDate,
          departmentName: reportDeptFilter === "all" ? "" : reportDeptFilter,
          categoryName: reportCategoryFilter === "all" ? "" : reportCategoryFilter,
          assetCode: reportAssetCodeFilter === "all" ? "" : reportAssetCodeFilter,
          accountCode: reportAccountFilter === "all" ? "" : reportAccountFilter,
          onlyDifferences: reportOnlyDifferences,
          excludeDisposedInPeriod: reportExcludeDisposed,
          lang: reportLang,
        });
        setApiReportPayload(res);
        return { message: "" };
      });
    }
  };

  // Step 7 & Step 11: Kiểm tra tham số báo cáo (Từ ngày <= Đến ngày) và tổng hợp dữ liệu
  const handleApplyReportParams = () => {
    const fDt = parseDeprDateString(reportFromDate);
    const tDt = parseDeprDateString(reportToDate);
    if (!fDt || !tDt) {
      notify("Từ ngày hoặc Đến ngày không hợp lệ. Vui lòng nhập theo định dạng DD/MM/YYYY.");
      return;
    }
    if (fDt.getTime() > tDt.getTime()) {
      notify("Từ ngày không được lớn hơn Đến ngày.");
      return;
    }
    if (previewReportCode === "ASSET_CARD" && reportAssetCodeFilter !== "all") {
      const exists = assetsList.some((a) => a.code === reportAssetCodeFilter);
      if (!exists) {
        notify("Không tìm thấy tài sản cố định được chọn.");
        return;
      }
    }
    const def = UC09_REPORT_CATALOG.find((d) => d.code === previewReportCode);
    if (def && apiConnected) {
      void apiSave(async (writer) => {
        const res = await fetchFixedAssetReport(writer, {
          reportCode: def.code,
          year: reportYear,
          fromDate: reportFromDate,
          toDate: reportToDate,
          departmentName: reportDeptFilter === "all" ? "" : reportDeptFilter,
          categoryName: reportCategoryFilter === "all" ? "" : reportCategoryFilter,
          assetCode: reportAssetCodeFilter === "all" ? "" : reportAssetCodeFilter,
          accountCode: reportAccountFilter === "all" ? "" : reportAccountFilter,
          onlyDifferences: reportOnlyDifferences,
          excludeDisposedInPeriod: reportExcludeDisposed,
          lang: reportLang,
        });
        setApiReportPayload(res);
        return { message: "" };
      });
    }
    notify(`Đã tổng hợp dữ liệu báo cáo kỳ ${reportFromDate} - ${reportToDate}.`);
  };

  // Common Central SVG Illustration for Sổ tài sản
  const renderMisaEmptyIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="24" width="46" height="34" rx="17" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M40 44V34H56V44H40Z" fill="#00a862"/>
        <path d="M38 34L48 27L58 34" stroke="#00a862" strokeWidth="2" strokeLinecap="round"/>
        <rect x="44" y="37" width="3" height="3" fill="#ffffff"/>
        <rect x="49" y="37" width="3" height="3" fill="#ffffff"/>
        <circle cx="34" cy="30" r="5" fill="#10b981"/>
        <path d="M32 30H36M34 28V32" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"/>
        
        <path d="M78 40H94" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M91 36L96 40L91 44" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        <rect x="100" y="26" width="34" height="34" rx="4" fill="#00a862"/>
        <rect x="106" y="32" width="6" height="6" rx="1" fill="#d1fae5"/>
        <rect x="122" y="32" width="6" height="6" rx="1" fill="#d1fae5"/>
        <path d="M112 60V50C112 47.79 113.79 46 116 46H118C120.21 46 122 47.79 122 50V60H112Z" fill="#ffffff"/>
        
        <circle cx="140" cy="22" r="7" fill="#34d399"/>
        <text x="140" y="25.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>
        
        <circle cx="156" cy="36" r="9" fill="#10b981"/>
        <text x="156" y="39.5" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff">$</text>
        
        <circle cx="145" cy="46" r="6" fill="#059669"/>
        <text x="145" y="49" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="#ffffff">$</text>

        <circle cx="106" cy="58" r="6" fill="#00a862"/>
        <path d="M103.5 58H108.5M106 55.5V60.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>

        <circle cx="152" cy="53" r="6.5" fill="#f87171"/>
        <circle cx="152" cy="55" r="5.5" fill="#fed7aa"/>
        <path d="M145 74C145 66 148 64 152 64C156 64 159 66 159 74H145Z" fill="#00a862"/>
        <path d="M136 74L140 65H150L154 74H136Z" fill="#cbd5e1"/>
        <rect x="134" y="73" width="22" height="2.5" rx="1" fill="#94a3b8"/>
        
        <path d="M92 20V24M90 22H94" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="94" cy="54" r="1.5" fill="#10b981"/>
        <circle cx="168" cy="52" r="1.5" fill="#34d399"/>
        <path d="M164 16V19M162.5 17.5H165.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Ghi tăng (Ảnh 1 mới của người dùng)
  const renderIncreaseIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Factory / Building Left with chimney */}
        <path d="M46 64V40H60V64H46Z" fill="#00a862"/>
        <path d="M42 40L53 30L64 40" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="58" y="24" width="4" height="10" fill="#00a862"/>
        <rect x="49" y="44" width="3" height="3" fill="#ffffff"/>
        <rect x="54" y="44" width="3" height="3" fill="#ffffff"/>
        <rect x="49" y="52" width="3" height="3" fill="#ffffff"/>
        <rect x="54" y="52" width="3" height="3" fill="#ffffff"/>
        <path d="M51 64V58H55V64" fill="#ffffff"/>
        
        {/* Arrow from building to clipboard */}
        <path d="M68 48H84" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M81 44L86 48L81 52" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        
        {/* Clipboard Center */}
        <rect x="94" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
        <path d="M102 30H114V34H102V30Z" fill="#00a862"/>
        <circle cx="108" cy="48" r="8" fill="#00a862"/>
        <text x="108" y="51.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>
        <path d="M100 62H116" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>

        {/* Arrow from clipboard to calendar */}
        <path d="M126 48H142" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 3"/>
        <path d="M139 44L144 48L139 52" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

        {/* Calendar Right */}
        <rect x="150" y="34" width="34" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5"/>
        <path d="M150 40H184" stroke="#00a862" strokeWidth="2.5"/>
        <rect x="156" y="30" width="2" height="4" fill="#00a862"/>
        <rect x="166" y="30" width="2" height="4" fill="#00a862"/>
        <rect x="176" y="30" width="2" height="4" fill="#00a862"/>
        <circle cx="157" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="163" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="169" cy="48" r="1.5" fill="#94a3b8"/>
        <circle cx="157" cy="56" r="1.5" fill="#94a3b8"/>
        <circle cx="163" cy="56" r="1.5" fill="#94a3b8"/>
        <circle cx="178" cy="58" r="5" fill="#00a862"/>
        <text x="178" y="60.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#ffffff">$</text>

        {/* Sparkles */}
        <path d="M88 28V32M86 30H90" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
        <circle cx="92" cy="62" r="1.5" fill="#34d399"/>
        <circle cx="144" cy="28" r="1.5" fill="#10b981"/>
        <path d="M182 24V27M180.5 25.5H183.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Tính khấu hao (Ảnh 1 mới của người dùng)
  const renderDepreciationIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="220" height="110" viewBox="0 0 220 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <path d="M72 74C88 77 122 77 142 74C136 68 84 68 72 74Z" fill="#f1f5f9" />
        <ellipse cx="112" cy="74" rx="34" ry="7" fill="#f8fafc" />

        {/* Garage Building Left */}
        <path d="M44 65V46L60 38L76 46V65H44Z" fill="#00a862" />
        
        {/* Downward Arrow on roof */}
        <path d="M60 26V34" stroke="#007a46" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M57 32L60 35L63 32" stroke="#007a46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        
        {/* Garage Doorway Arch */}
        <path d="M50 65V51C50 49.5 51.5 48.5 53 48.5H67C68.5 48.5 70 49.5 70 51V65H50Z" fill="#007a46" />
        
        {/* White Car Front Silhouette */}
        <path d="M53.5 64C53.5 60.5 55.5 59 60 59C64.5 59 66.5 60.5 66.5 64H53.5Z" fill="#ffffff" />
        <rect x="55.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="56" cy="62" r="1.2" fill="#007a46" />
        <circle cx="64" cy="62" r="1.2" fill="#007a46" />

        {/* Dashed arrow from Garage to Voucher */}
        <path d="M84 52H120" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M117 48L122 52L117 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Depreciation Document Right */}
        <rect x="132" y="34" width="30" height="38" rx="4" fill="#ffffff" stroke="#00a862" strokeWidth="1.5" />
        {/* Folded Top-Right Corner */}
        <path d="M152 34V42H162" fill="#10b981" />
        <path d="M152 34L162 44H152V34Z" fill="#007a46" />
        
        {/* Document horizontal lines */}
        <rect x="138" y="47" width="16" height="2.5" rx="1" fill="#00a862" />
        <rect x="138" y="53" width="12" height="2" rx="1" fill="#94a3b8" />
        <rect x="138" y="58" width="14" height="2" rx="1" fill="#cbd5e1" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="128" cy="38" r="2" fill="#10b981" />
        <circle cx="138" cy="28" r="2.5" fill="#00a862" />
        <circle cx="170" cy="32" r="3" fill="#34d399" />
        <circle cx="172" cy="45" r="2" fill="#10b981" />
        <circle cx="168" cy="62" r="1.5" fill="#007a46" />
        <path d="M162 24V27M160.5 25.5H163.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Đánh giá lại (Ảnh 1 mới của người dùng)
  const renderRevalIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Garage Building with white car */}
        <path d="M26 65V46L42 38L58 46V65H26Z" fill="#00a862" />
        <path d="M32 65V51C32 49.5 33.5 48.5 35 48.5H49C50.5 48.5 52 49.5 52 51V65H32Z" fill="#007a46" />
        <path d="M35.5 64C35.5 60.5 37.5 59 42 59C46.5 59 48.5 60.5 48.5 64H35.5Z" fill="#ffffff" />
        <rect x="37.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="38" cy="62" r="1.2" fill="#007a46" />
        <circle cx="46" cy="62" r="1.2" fill="#007a46" />

        {/* Arrow 1: Garage to Document */}
        <path d="M66 52H96" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M93 48L98 52L93 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Document with Clock */}
        <rect x="106" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M112 30H128V34H112V30Z" fill="#00a862" />
        <rect x="112" y="42" width="16" height="2" rx="1" fill="#00a862" />
        <rect x="112" y="47" width="12" height="2" rx="1" fill="#94a3b8" />
        <rect x="112" y="52" width="14" height="2" rx="1" fill="#cbd5e1" />
        {/* Clock badge */}
        <circle cx="128" cy="62" r="6" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
        <path d="M128 59.5V62H130.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Arrow 2: Document to Person */}
        <path d="M142 52H172" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M169 48L174 52L169 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right: Accountant Person with Laptop */}
        <circle cx="198" cy="40" r="6" fill="#fed7aa" />
        <path d="M192 38C192 34 204 34 204 38C204 42 201 44 198 44C195 44 192 42 192 38Z" fill="#059669" />
        <path d="M190 66C190 56 193 50 198 50C203 50 206 56 206 66H190Z" fill="#00a862" />
        <rect x="180" y="62" width="18" height="3" rx="1.5" fill="#cbd5e1" />
        <path d="M184 62L190 53H194L188 62H184Z" fill="#94a3b8" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="68" cy="36" r="1.5" fill="#10b981" />
        <circle cx="102" cy="26" r="2" fill="#00a862" />
        <circle cx="140" cy="30" r="2.5" fill="#34d399" />
        <circle cx="212" cy="34" r="1.5" fill="#10b981" />
        <path d="M152 24V27M150.5 25.5H153.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Điều chuyển (Ảnh 3 mới của người dùng)
  const renderTransferIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Garage Building with white car & Person */}
        <path d="M26 65V46L42 38L58 46V65H26Z" fill="#00a862" />
        <path d="M32 65V51C32 49.5 33.5 48.5 35 48.5H49C50.5 48.5 52 49.5 52 51V65H32Z" fill="#007a46" />
        <path d="M35.5 64C35.5 60.5 37.5 59 42 59C46.5 59 48.5 60.5 48.5 64H35.5Z" fill="#ffffff" />
        <rect x="37.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="38" cy="62" r="1.2" fill="#007a46" />
        <circle cx="46" cy="62" r="1.2" fill="#007a46" />
        {/* Person left */}
        <circle cx="64" cy="50" r="3" fill="#007a46" />
        <path d="M60 65C60 58 68 58 68 65H60Z" fill="#007a46" />

        {/* Bi-directional dashed line with arrows */}
        <path d="M78 52H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M82 48L76 52L82 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M158 48L164 52L158 56" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle Document with Plus badge */}
        <rect x="106" y="32" width="28" height="38" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M112 30H128V34H112V30Z" fill="#00a862" />
        <rect x="112" y="42" width="16" height="2" rx="1" fill="#00a862" />
        <rect x="112" y="47" width="12" height="2" rx="1" fill="#94a3b8" />
        <circle cx="120" cy="58" r="6" fill="#00a862" />
        <path d="M117.5 58H122.5M120 55.5V60.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />

        {/* Right: Garage Building with white car & Person */}
        <path d="M182 65V46L198 38L214 46V65H182Z" fill="#00a862" />
        <path d="M188 65V51C188 49.5 189.5 48.5 191 48.5H205C206.5 48.5 208 49.5 208 51V65H188Z" fill="#007a46" />
        <path d="M191.5 64C191.5 60.5 193.5 59 198 59C202.5 59 204.5 60.5 204.5 64H191.5Z" fill="#ffffff" />
        <rect x="193.5" y="55" width="9" height="4.5" rx="1.5" fill="#ffffff" />
        <circle cx="194" cy="62" r="1.2" fill="#007a46" />
        <circle cx="202" cy="62" r="1.2" fill="#007a46" />
        {/* Person right */}
        <circle cx="176" cy="50" r="3" fill="#007a46" />
        <path d="M172 65C172 58 180 58 180 65H172Z" fill="#007a46" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="94" cy="34" r="2" fill="#10b981" />
        <circle cx="146" cy="30" r="2.5" fill="#00a862" />
        <circle cx="148" cy="64" r="1.5" fill="#34d399" />
        <circle cx="70" cy="62" r="1.5" fill="#007a46" />
        <path d="M102 24V27M100.5 25.5H103.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Ghi giảm (Ảnh 2 mới của người dùng)
  const renderDecreaseIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="240" height="110" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="120" cy="74" rx="95" ry="10" fill="#f8fafc" />

        {/* Left: Green Office Building with 6 windows & Entrance door */}
        <rect x="36" y="36" width="30" height="40" rx="3" fill="#00a862" />
        <rect x="42" y="42" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="52" y="42" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="42" y="51" width="6" height="5" rx="1" fill="#ffffff" />
        <rect x="52" y="51" width="6" height="5" rx="1" fill="#ffffff" />
        <path d="M46 76V65C46 63 56 63 56 65V76H46Z" fill="#ffffff" />

        {/* Arrow 1: Building to Document */}
        <path d="M74 54H98" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M95 50L100 54L95 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Document with Circular arrows */}
        <rect x="108" y="32" width="30" height="42" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M114 30H132V34H114V30Z" fill="#00a862" />
        <rect x="115" y="40" width="16" height="2" rx="1" fill="#00a862" />
        <circle cx="123" cy="54" r="10" fill="#ecfdf5" stroke="#10b981" strokeWidth="1.2" strokeDasharray="3 2" />
        <path d="M123 47C126.5 47 129 49.5 129 53M123 59C119.5 59 117 56.5 117 53" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M127 50L129 53L132 51M119 56L117 53L114 55" stroke="#00a862" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="123" cy="53" r="2.5" fill="#00a862" />

        {/* Arrow 2: Document to Calendar */}
        <path d="M146 54H170" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M167 50L172 54L167 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right: Calendar with top rings and Dollar Badge */}
        <rect x="178" y="36" width="32" height="34" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M178 39C178 37.3 179.3 36 181 36H207C208.7 36 210 37.3 210 39V44H178V39Z" fill="#00a862" />
        {/* Spiral rings */}
        <rect x="183" y="33" width="2" height="6" rx="1" fill="#64748b" />
        <rect x="193" y="33" width="2" height="6" rx="1" fill="#64748b" />
        <rect x="203" y="33" width="2" height="6" rx="1" fill="#64748b" />
        {/* Date dots */}
        <circle cx="184" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="190" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="196" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="202" cy="50" r="1.5" fill="#cbd5e1" />
        <circle cx="184" cy="56" r="1.5" fill="#cbd5e1" />
        <circle cx="190" cy="56" r="1.5" fill="#cbd5e1" />
        {/* Dollar coin lower right */}
        <circle cx="204" cy="64" r="7" fill="#00a862" stroke="#ffffff" strokeWidth="1.5" />
        <text x="204" y="67" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#ffffff">$</text>

        {/* Floating Green Dots and Sparkles */}
        <circle cx="70" cy="38" r="1.5" fill="#10b981" />
        <circle cx="104" cy="26" r="2" fill="#00a862" />
        <circle cx="148" cy="28" r="2" fill="#34d399" />
        <circle cx="218" cy="40" r="1.5" fill="#10b981" />
        <path d="M156 22V25M154.5 23.5H157.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // Dedicated SVG Illustration for Kiểm kê (Ảnh 3 mới của người dùng)
  const renderStocktakeIllustration = () => (
    <div style={{ marginBottom: 26 }}>
      <svg width="250" height="110" viewBox="0 0 250 110" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Soft ground shadow */}
        <ellipse cx="125" cy="74" rx="100" ry="10" fill="#f8fafc" />

        {/* Left: Building with garage and car + office building */}
        <path d="M22 66V48L36 40L50 48V66H22Z" fill="#00a862" />
        <path d="M27 66V53C27 51.5 28.5 50.5 30 50.5H42C43.5 50.5 45 51.5 45 53V66H27Z" fill="#007a46" />
        <path d="M30 65C30 62 32 61 36 61C40 61 42 62 42 65H30Z" fill="#ffffff" />
        <rect x="32" y="57" width="8" height="4" rx="1.5" fill="#ffffff" />
        <circle cx="32" cy="63" r="1" fill="#007a46" />
        <circle cx="40" cy="63" r="1" fill="#007a46" />
        {/* Small office below */}
        <rect x="32" y="70" width="20" height="24" rx="2" fill="#059669" />
        <rect x="36" y="74" width="4" height="4" rx="1" fill="#ffffff" />
        <rect x="44" y="74" width="4" height="4" rx="1" fill="#ffffff" />

        {/* Arrow Left to Center */}
        <path d="M58 54H84" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M81 50L86 54L81 58" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Middle: Clipboard Document with 2 big checkmarks */}
        <rect x="94" y="30" width="34" height="46" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M102 28H120V32H102V28Z" fill="#00a862" />
        {/* Checkmark 1 */}
        <path d="M103 44L107 48L117 38" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="120" y1="44" x2="124" y2="44" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        {/* Checkmark 2 */}
        <path d="M103 58L107 62L117 52" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="120" y1="58" x2="124" y2="58" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />

        {/* Arrow Center to Right (branching top & bottom) */}
        <path d="M136 46H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M159 42L164 46L159 50" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M136 62H162" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M159 58L164 62L159 66" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Right Top Building Card */}
        <rect x="174" y="24" width="28" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M180 34C180 30 196 30 196 34V46H180V34Z" fill="#00a862" />
        <path d="M184 46V40C184 38 192 38 192 40V46H184Z" fill="#ffffff" />
        <rect x="180" y="49" width="16" height="2" rx="1" fill="#94a3b8" />

        {/* Right Bottom Building Card */}
        <rect x="174" y="62" width="28" height="32" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M180 72C180 68 196 68 196 72V84H180V72Z" fill="#00a862" />
        <path d="M184 84V78C184 76 192 76 192 78V84H184Z" fill="#ffffff" />
        <rect x="180" y="87" width="16" height="2" rx="1" fill="#94a3b8" />

        {/* Floating Green Dots and Sparkles */}
        <circle cx="88" cy="26" r="1.5" fill="#10b981" />
        <circle cx="140" cy="24" r="2" fill="#00a862" />
        <circle cx="212" cy="48" r="2" fill="#34d399" />
        <circle cx="144" cy="74" r="1.5" fill="#10b981" />
        <path d="M148 18V21M146.5 19.5H149.5" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );

  // =========================================================================
  // RENDER MODALS
  // =========================================================================
  const renderModals = () => (
    <>
      {/* 1. MODAL GHI TĂNG TÀI SẢN CỐ ĐỊNH GTTS00001 (ẢNH 2 MỚI CỦA NGƯỜI DÙNG) */}
      {showAddAssetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1100,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                height: 44,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCw size={17} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Ghi tăng tài sản cố định {incVoucherNo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Ghi tăng tài sản cố định mua mới về sử dụng")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseIncreaseModal}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Header Fields Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: Số CT ghi tăng | Ngày ghi tăng | Loại tài sản */}
                <div style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incVoucherNo}
                      onChange={(e) => setIncVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={incVoucherDate}
                        onChange={(e) => {
                          setIncVoucherDate(e.target.value);
                          setIncStartDate(e.target.value);
                        }}
                        placeholder="DD/MM/YYYY"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Loại tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={incCategory}
                        onChange={(e) => handleIncCategorySelect(e.target.value)}
                        style={{ flex: 1, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                      >
                        <option value=""></option>
                        {categoryOptions.map((cat, idx) => (
                          <option key={cat.code || idx} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddCategoryModal(true)}
                        style={{ width: 28, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", color: "#00a862", fontWeight: "bold", fontSize: 15, cursor: "pointer", display: "grid", placeItems: "center" }}
                        title="Thêm loại tài sản (AF04)"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Mã tài sản | Đơn vị sử dụng */}
                <div style={{ display: "grid", gridTemplateColumns: "286px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incCode}
                      onChange={(e) => setIncCode(e.target.value)}
                      placeholder="Nhập mã định danh tài sản..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={incDept}
                      onChange={(e) => handleIncDeptSelect(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value=""></option>
                      {departmentOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Tên tài sản | Checkbox Không tính khấu hao */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={incName}
                      onChange={(e) => setIncName(e.target.value)}
                      placeholder="Nhập tên chi tiết của tài sản cố định ghi tăng..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={incNoDepr}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncNoDepr(checked);
                          if (checked) {
                            setIncDeprRateMonth(0);
                            setIncDeprRateYear(0);
                            setIncDeprMonthValue(0);
                            setIncDeprYearValue(0);
                          } else {
                            recalculateIncreaseDepreciation(incDeprCostValue || incOriginalCost, incUseDuration, incUseDurationUnit, false, incLimitTaxLaw, incTaxLawValue);
                          }
                        }}
                        style={{ width: 14, height: 14, accentColor: "#00a862" }}
                      />
                      <span>Không tính khấu hao</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs Navigation (6 Sub-tabs chuẩn Ảnh 2 mới) */}
              <div style={{ borderBottom: "1px solid #cbd5e1", display: "flex", gap: 20, marginTop: 4 }}>
                {[
                  { id: "depreciation", label: "Thông tin khấu hao" },
                  { id: "allocation", label: "Thiết lập phân bổ" },
                  { id: "origin", label: "Nguồn gốc hình thành" },
                  { id: "components", label: "Bộ phận cấu thành" },
                  { id: "accessories", label: "Dụng cụ, phụ tùng kèm theo" },
                  { id: "others", label: "Thông tin khác" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setIncSubTab(st.id as any)}
                    style={{
                      padding: "8px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: incSubTab === st.id ? 700 : 500,
                      color: incSubTab === st.id ? "#00a862" : "#475569",
                      borderBottom: incSubTab === st.id ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sub-Tab 1: Thông tin khấu hao cho Ghi tăng */}
              {incSubTab === "depreciation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, paddingTop: 6 }}>
                  {/* Left Column: Kế toán & Khấu hao */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Row 1: TK nguyên giá | Nguyên giá | Tỷ lệ tháng | Tỷ lệ năm */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={incCostAcc}
                          onChange={(e) => setIncCostAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value=""></option>
                          {costAccountOptions.map((acc) => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={incOriginalCost === 0 ? "0" : incOriginalCost.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            handleIncOriginalCostChange(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ tính KH thg (%)
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incDeprRateMonth === 0 ? "0,00" : incDeprRateMonth.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            setIncDeprRateMonth(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ tính KH năm (%)
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incDeprRateYear === 0 ? "0,00" : incDeprRateYear.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            setIncDeprRateYear(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 2: TK khấu hao | Giá trị tính KH | Giá trị KH tháng | Giá trị KH năm */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK khấu hao {!incNoDepr && <span style={{ color: "#ef4444" }}>*</span>}
                        </label>
                        <select
                          value={incDeprAcc}
                          disabled={incNoDepr}
                          onChange={(e) => setIncDeprAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: incNoDepr ? "#f1f5f9" : "#ffffff" }}
                        >
                          <option value=""></option>
                          {deprAccountOptions.map((acc) => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị tính KH
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incDeprCostValue === 0 ? "0" : incDeprCostValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            handleIncDeprCostValueChange(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH tháng
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incDeprMonthValue === 0 ? "0" : incDeprMonthValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncDeprMonthValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH năm
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incDeprYearValue === 0 ? "0" : incDeprYearValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncDeprYearValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 3: Ngày bắt đầu tính KH | Hao mòn lũy kế | Giá trị còn lại */}
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Ngày BĐ tính KH
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            disabled={incNoDepr}
                            value={incStartDate}
                            onChange={(e) => setIncStartDate(e.target.value)}
                            placeholder="DD/MM/YYYY"
                            style={{ width: "100%", height: 28, padding: "0 22px 0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, outline: "none", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                          />
                          <Calendar size={13} style={{ position: "absolute", right: 6, top: 7, color: "#64748b" }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Hao mòn lũy kế
                        </label>
                        <input
                          type="text"
                          value={incAccumulatedDepr === 0 ? "0" : incAccumulatedDepr.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            handleIncAccumulatedDeprChange(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị còn lại
                        </label>
                        <input
                          type="text"
                          value={incRemainingValue === 0 ? "0" : incRemainingValue.toLocaleString("vi-VN")}
                          readOnly
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "#1e293b", background: "#f8fafc", outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Row 4: Thời gian sử dụng (Năm hoặc Tháng theo AF06 / BR15) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian sử dụng
                        </label>
                        <input
                          type="text"
                          disabled={incNoDepr}
                          value={incUseDuration === 0 ? "0,00" : incUseDuration.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value.replace(",", "."));
                            handleIncUseDurationChange(isNaN(val) ? 0 : val);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incNoDepr ? "#f1f5f9" : "#ffffff", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={incUseDurationUnit}
                          disabled={incNoDepr}
                          onChange={(e) => handleIncUseDurationUnitChange(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: incNoDepr ? "#f1f5f9" : "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                      <div style={{ paddingTop: 18, fontSize: 11.5, color: "#64748b" }}>
                        (Quy đổi: {incUseDurationUnit === "Tháng" ? Math.round(incUseDuration) : Math.round(incUseDuration * 12)} tháng)
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Giới hạn luật thuế TNDN & Lưu ý */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={incLimitTaxLaw}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setIncLimitTaxLaw(checked);
                            if (checked && incTaxLawValue === 0) {
                              const defaultCap = 1600000000;
                              setIncTaxLawValue(defaultCap);
                              const totalMonths = incUseDurationUnit === "Tháng" ? Number(incUseDuration) : Number(incUseDuration) * 12;
                              setIncTaxLawMonthValue(totalMonths > 0 ? Math.round(defaultCap / totalMonths) : 0);
                            }
                          }}
                          style={{ width: 14, height: 14, accentColor: "#00a862" }}
                        />
                        <span>Giới hạn giá trị tính KH theo luật thuế TNDN</span>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị tính KH theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!incLimitTaxLaw}
                          value={incTaxLawValue === 0 ? "0" : incTaxLawValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            const capVal = Number(raw) || 0;
                            setIncTaxLawValue(capVal);
                            const totalMonths = incUseDurationUnit === "Tháng" ? Number(incUseDuration) : Number(incUseDuration) * 12;
                            setIncTaxLawMonthValue(totalMonths > 0 ? Math.round(capVal / totalMonths) : 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị KH tháng theo luật
                        </label>
                        <input
                          type="text"
                          disabled={!incLimitTaxLaw}
                          value={incTaxLawMonthValue === 0 ? "0" : incTaxLawMonthValue.toLocaleString("vi-VN")}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            setIncTaxLawMonthValue(Number(raw) || 0);
                          }}
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: incLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Notice Callout Box */}
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "10px 14px",
                        marginTop: 8,
                      }}
                    >
                      <Info size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#166534" }}>
                        Nếu nhập Giá trị KH theo luật thì khi tính KH, chương trình sẽ hạch toán phần chi phí KH tương ứng với Giá trị KH theo luật vào chi phí hợp lý, phần chi phí KH vượt quá giới hạn được hạch toán vào chi phí không hợp lý.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Thiết lập phân bổ (AF09, AF10, EF19, EF20, BR22, BR23) */}
              {incSubTab === "allocation" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Đơn vị sử dụng *</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 130 }}>Tỷ lệ phân bổ (%) *</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>TK chi phí *</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Khoản mục chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 160 }}>Đối tượng THCP</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incAllocations.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={row.department}
                              onChange={(e) => {
                                const next = [...incAllocations];
                                next[idx] = { ...next[idx], department: e.target.value };
                                setIncAllocations(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                            >
                              <option value="">-- Chọn đơn vị --</option>
                              {departmentOptions.map((d) => (
                                <option key={d} value={d}>{d}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="number"
                              step="0.01"
                              value={row.rate}
                              onChange={(e) => {
                                const next = [...incAllocations];
                                next[idx] = { ...next[idx], rate: Number(e.target.value) || 0 };
                                setIncAllocations(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", fontWeight: 600, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={row.expenseAccount}
                              onChange={(e) => {
                                const next = [...incAllocations];
                                next[idx] = { ...next[idx], expenseAccount: e.target.value };
                                setIncAllocations(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#00a862", fontWeight: 600, background: "#ffffff" }}
                            >
                              <option value="">-- TK --</option>
                              {expenseAccountOptions.map((acc) => (
                                <option key={acc} value={acc}>{acc}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.expenseItem}
                              onChange={(e) => {
                                const next = [...incAllocations];
                                next[idx] = { ...next[idx], expenseItem: e.target.value };
                                setIncAllocations(next);
                              }}
                              placeholder="Khoản mục chi phí..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.costObject}
                              onChange={(e) => {
                                const next = [...incAllocations];
                                next[idx] = { ...next[idx], costObject: e.target.value };
                                setIncAllocations(next);
                              }}
                              placeholder="Đối tượng THCP..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            {incAllocations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setIncAllocations(incAllocations.filter((_, i) => i !== idx))}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                                title="Xóa dòng"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const usedRate = incAllocations.reduce((s, r) => s + (Number(r.rate) || 0), 0);
                        const remRate = Math.max(0, Number((100 - usedRate).toFixed(2)));
                        const fallbackExp = incAllocations[0]?.expenseAccount || "";
                        setIncAllocations([
                          ...incAllocations,
                          { department: "", rate: remRate, expenseAccount: fallbackExp, expenseItem: "Chi phí khấu hao TSCĐ", costObject: "" },
                        ]);
                      }}
                      style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      + Thêm dòng phân bổ
                    </button>
                    <div style={{ fontSize: 12, fontWeight: 600, color: Math.abs(incAllocations.reduce((s, r) => s + (Number(r.rate) || 0), 0) - 100) <= 0.01 ? "#16a34a" : "#ef4444" }}>
                      Tổng tỷ lệ phân bổ: {incAllocations.reduce((s, r) => s + (Number(r.rate) || 0), 0).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Nguồn gốc hình thành (AF05, AF11, EF21, EF22, BR07, BR08, BR12, BR24, BR25) */}
              {incSubTab === "origin" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  {purchaseSourceDocs.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 10px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Chọn nhanh từ chứng từ mua hàng:</span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const docNo = e.target.value;
                          if (!docNo) return;
                          const found = purchaseSourceDocs.find((p) => p.documentNo === docNo);
                          if (!found) return;
                          if (incOrigins.some((o) => o.documentNo.trim().toUpperCase() === found.documentNo.trim().toUpperCase())) {
                            notify("Chứng từ nguồn đã được gắn cho tài sản khác hoặc bị trùng lặp.");
                            e.target.value = "";
                            return;
                          }
                          const next = incOrigins.length === 1 && !incOrigins[0].documentNo
                            ? [{ sourceType: "Mua sắm mới trong nước", documentNo: found.documentNo, documentDate: found.documentDate, amount: found.amount, supplier: found.supplier }]
                            : [...incOrigins, { sourceType: "Mua sắm mới trong nước", documentNo: found.documentNo, documentDate: found.documentDate, amount: found.amount, supplier: found.supplier }];
                          setIncOrigins(next);
                          const totalOriginAmt = next.reduce((s, r) => s + (Number(r.amount) || 0), 0);
                          if (totalOriginAmt > 0) {
                            handleIncOriginalCostChange(totalOriginAmt);
                          }
                          e.target.value = "";
                        }}
                        style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff", minWidth: 280 }}
                      >
                        <option value="">-- Chọn hóa đơn / chứng từ mua hàng --</option>
                        {purchaseSourceDocs.map((p, i) => (
                          <option key={p.documentNo || i} value={p.documentNo}>
                            {p.documentNo} ({p.documentDate}) - {formatVND(p.amount)} - {p.supplier}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Loại nguồn gốc hình thành</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 160 }}>Số chứng từ / Hóa đơn</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Ngày chứng từ</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 150 }}>Số tiền (VND)</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 220 }}>Nhà cung cấp / Đối tác</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incOrigins.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={row.sourceType}
                              onChange={(e) => {
                                const next = [...incOrigins];
                                next[idx] = { ...next[idx], sourceType: e.target.value };
                                setIncOrigins(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                            >
                              <option value="Mua sắm mới trong nước">Mua sắm mới trong nước</option>
                              <option value="Chi phí vận chuyển, lắp đặt, chạy thử">Chi phí vận chuyển, lắp đặt, chạy thử</option>
                              <option value="Nhập khẩu">Nhập khẩu</option>
                              <option value="Đầu tư XDCB hoàn thành">Đầu tư XDCB hoàn thành</option>
                              <option value="Nhận góp vốn / Tài trợ">Nhận góp vốn / Tài trợ</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.documentNo}
                              onChange={(e) => {
                                const next = [...incOrigins];
                                next[idx] = { ...next[idx], documentNo: e.target.value };
                                setIncOrigins(next);
                              }}
                              placeholder="Số CT / Hóa đơn..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#00a862", fontWeight: 600, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.documentDate}
                              onChange={(e) => {
                                const next = [...incOrigins];
                                next[idx] = { ...next[idx], documentDate: e.target.value };
                                setIncOrigins(next);
                              }}
                              placeholder="DD/MM/YYYY"
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.amount === 0 ? "0" : row.amount.toLocaleString("vi-VN")}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                                const next = [...incOrigins];
                                next[idx] = { ...next[idx], amount: Number(raw) || 0 };
                                setIncOrigins(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", fontWeight: 600, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.supplier}
                              onChange={(e) => {
                                const next = [...incOrigins];
                                next[idx] = { ...next[idx], supplier: e.target.value };
                                setIncOrigins(next);
                              }}
                              placeholder="Nhà cung cấp / Đối tác..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 4px", textAlign: "center" }}>
                            {incOrigins.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setIncOrigins(incOrigins.filter((_, i) => i !== idx))}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                                title="Xóa dòng"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() =>
                        setIncOrigins([
                          ...incOrigins,
                          { sourceType: "Chi phí vận chuyển, lắp đặt, chạy thử", documentNo: "", documentDate: incVoucherDate, amount: 0, supplier: "" },
                        ])
                      }
                      style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      + Thêm chứng từ nguồn gốc hình thành
                    </button>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
                      Tổng cộng nguồn gốc hình thành:{" "}
                      <span style={{ color: "#00a862" }}>
                        {formatVND(incOrigins.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 4: Bộ phận cấu thành (AF12, BR26) */}
              {incSubTab === "components" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Tên bộ phận cấu thành</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Đơn vị tính</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 120 }}>Số lượng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 160 }}>Giá trị (VND)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incComponents.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                            Chưa có bộ phận cấu thành riêng biệt. Nhấn nút bên dưới để khai báo chi tiết cấu thành tài sản.
                          </td>
                        </tr>
                      ) : (
                        incComponents.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => {
                                  const next = [...incComponents];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setIncComponents(next);
                                }}
                                placeholder="Tên bộ phận cấu thành..."
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const next = [...incComponents];
                                  next[idx] = { ...next[idx], unit: e.target.value };
                                  setIncComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="number"
                                value={row.quantity}
                                onChange={(e) => {
                                  const next = [...incComponents];
                                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                                  setIncComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.value === 0 ? "0" : row.value.toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                                  const next = [...incComponents];
                                  next[idx] = { ...next[idx], value: Number(raw) || 0 };
                                  setIncComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => setIncComponents(incComponents.filter((_, i) => i !== idx))}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div>
                    <button
                      type="button"
                      onClick={() => setIncComponents([...incComponents, { name: "", unit: "Cái", quantity: 1, value: 0 }])}
                      style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      + Thêm bộ phận cấu thành
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Tab 5: Dụng cụ, phụ tùng kèm theo (AF13, BR26) */}
              {incSubTab === "accessories" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Tên dụng cụ, phụ tùng kèm theo</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Đơn vị tính</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 120 }}>Số lượng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 160 }}>Giá trị (VND)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incAccessories.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                            Chưa có dụng cụ, phụ tùng đi kèm. Nhấn nút bên dưới để thêm dụng cụ, phụ tùng kèm theo (không cộng trùng vào nguyên giá).
                          </td>
                        </tr>
                      ) : (
                        incAccessories.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => {
                                  const next = [...incAccessories];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setIncAccessories(next);
                                }}
                                placeholder="Tên dụng cụ, phụ tùng..."
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => {
                                  const next = [...incAccessories];
                                  next[idx] = { ...next[idx], unit: e.target.value };
                                  setIncAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="number"
                                value={row.quantity}
                                onChange={(e) => {
                                  const next = [...incAccessories];
                                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                                  setIncAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.value === 0 ? "0" : row.value.toLocaleString("vi-VN")}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                                  const next = [...incAccessories];
                                  next[idx] = { ...next[idx], value: Number(raw) || 0 };
                                  setIncAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => setIncAccessories(incAccessories.filter((_, i) => i !== idx))}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div>
                    <button
                      type="button"
                      onClick={() => setIncAccessories([...incAccessories, { name: "", unit: "Bộ", quantity: 1, value: 0 }])}
                      style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      + Thêm dụng cụ, phụ tùng kèm theo
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-Tab 6: Thông tin khác (AF14) */}
              {incSubTab === "others" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Nước sản xuất</label>
                    <input
                      type="text"
                      value={incCountryOfOrigin}
                      onChange={(e) => setIncCountryOfOrigin(e.target.value)}
                      placeholder="Ví dụ: Nhật Bản, Đức, Việt Nam..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Năm sản xuất</label>
                    <input
                      type="number"
                      value={incManufactureYear}
                      onChange={(e) => setIncManufactureYear(e.target.value)}
                      placeholder="2026"
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Số hiệu / Số Serial</label>
                    <input
                      type="text"
                      value={incSerialNumber}
                      onChange={(e) => setIncSerialNumber(e.target.value)}
                      placeholder="Nhập số khung, số máy hoặc số serial..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Ghi chú / Mô tả kỹ thuật</label>
                    <input
                      type="text"
                      value={incDescription}
                      onChange={(e) => setIncDescription(e.target.value)}
                      placeholder="Thông số kỹ thuật, tình trạng bàn giao..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer (Ảnh 2 mới: Hủy | Ghi tăng | Ghi tăng và Thêm) */}
            <div
              style={{
                height: 48,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 20px",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={handleCloseIncreaseModal}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSubmitIncrease(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#1e293b",
                  cursor: "pointer",
                }}
              >
                Ghi tăng
              </button>
              <button
                type="button"
                onClick={() => handleSubmitIncrease(true)}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Ghi tăng và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1B. MODAL THÊM NHANH LOẠI TÀI SẢN CỐ ĐỊNH (AF04) */}
      {showAddCategoryModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 1200,
            padding: 10,
          }}
        >
          <div
            style={{
              width: 480,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: 42, padding: "0 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Thêm nhanh Loại tài sản cố định</span>
              <button type="button" onClick={() => setShowAddCategoryModal(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Mã loại TS *</label>
                  <input
                    type="text"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    placeholder="VD: PTVT"
                    style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Tên loại tài sản *</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nhập tên loại tài sản..."
                    style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>TK nguyên giá</label>
                  <select value={newCatCostAcc} onChange={(e) => setNewCatCostAcc(e.target.value)} style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }}>
                    {costAccountOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>TK hao mòn</label>
                  <select value={newCatDeprAcc} onChange={(e) => setNewCatDeprAcc(e.target.value)} style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }}>
                    {deprAccountOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>TK chi phí</label>
                  <select value={newCatExpAcc} onChange={(e) => setNewCatExpAcc(e.target.value)} style={{ width: "100%", height: 30, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }}>
                    {expenseAccountOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Thời gian sử dụng mặc định (Năm)</label>
                <input
                  type="number"
                  value={newCatLifeYears}
                  onChange={(e) => setNewCatLifeYears(Number(e.target.value) || 5)}
                  style={{ width: 140, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }}
                />
              </div>
            </div>
            <div style={{ height: 46, padding: "0 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowAddCategoryModal(false)} style={{ height: 30, padding: "0 14px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, cursor: "pointer" }}>
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newCatCode.trim() || !newCatName.trim()) {
                    notify("Vui lòng nhập Mã loại tài sản và Tên loại tài sản.");
                    return;
                  }
                  const catObj = {
                    code: newCatCode.trim().toUpperCase(),
                    name: newCatName.trim(),
                    costAccount: newCatCostAcc,
                    deprAccount: newCatDeprAcc,
                    expenseAccount: newCatExpAcc,
                    lifeYears: newCatLifeYears,
                  };
                  if (apiConnected) {
                    void apiSave((writer) => saveFixedAssetCategory(writer, catObj)).then((saved) => {
                      if (saved) {
                        setLocalCategories((prev) => [...prev, catObj]);
                        handleIncCategorySelect(catObj.name);
                        setShowAddCategoryModal(false);
                        setNewCatCode("");
                        setNewCatName("");
                      }
                    });
                    return;
                  }
                  setLocalCategories((prev) => [...prev, catObj]);
                  handleIncCategorySelect(catObj.name);
                  setShowAddCategoryModal(false);
                  setNewCatCode("");
                  setNewCatName("");
                  notify(`Đã thêm loại tài sản "${catObj.name}".`);
                }}
                style={{ height: 30, padding: "0 16px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Cất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1C. MODAL CHI TIẾT & CẬP NHẬT THÔNG TIN TÀI SẢN CỐ ĐỊNH (UC-FA-02) */}
      {showAssetDetailModal && detailAsset && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1150,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1120,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                height: 46,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: isEditingAsset ? "#f0fdf4" : "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCw size={17} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  {isEditingAsset
                    ? `Cập nhật thông tin tài sản cố định: ${detailAsset.code}`
                    : `Chi tiết tài sản cố định: ${detailAsset.code} - ${detailAsset.name}`}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: detailAsset.statusDisplay === "Đang sử dụng" ? "#dcfce7" : "#fee2e2",
                    color: detailAsset.statusDisplay === "Đang sử dụng" ? "#166534" : "#b91c1c",
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  {detailAsset.statusDisplay || "Đang sử dụng"}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Phiên bản #{detailAsset.version || 1}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() =>
                    notify(
                      "UC-FA-02: Chỉ cho phép cập nhật thông tin nhận diện và hồ sơ bổ sung. Các chỉ tiêu kế toán, nguyên giá, khấu hao, loại tài sản và đơn vị sử dụng được khóa bảo vệ."
                    )
                  }
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingAsset) {
                      handleCancelEditAsset();
                    } else {
                      setShowAssetDetailModal(false);
                    }
                  }}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Info Banner in Edit Mode */}
              {isEditingAsset && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#166534",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span>
                    <strong>Chế độ Cập nhật thông tin tài sản (UC-FA-02):</strong> Bạn có thể sửa <strong>Tên tài sản</strong>, <strong>Thông tin khác</strong> (Nước SX, Năm SX, Số hiệu), <strong>Bộ phận cấu thành</strong>, <strong>Dụng cụ phụ tùng</strong> và số hiệu tham chiếu <strong>Nguồn gốc hình thành</strong>. Các chỉ tiêu kế toán được giữ nguyên.
                  </span>
                </div>
              )}

              {/* Header Fields Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: Số CT ghi tăng | Ngày ghi tăng | Loại tài sản (All Locked per EF07, EF09, AF10) */}
                <div style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr", gap: 16 }}>
                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Không được phép sửa thông tin chứng từ ghi tăng tại chức năng này.");
                      }
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số CT ghi tăng
                    </label>
                    <input
                      type="text"
                      value={detailAsset.voucherNo || ""}
                      readOnly
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#f1f5f9",
                        color: "#475569",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Không được phép sửa thông tin chứng từ ghi tăng tại chức năng này.");
                      }
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ngày ghi tăng
                    </label>
                    <input
                      type="text"
                      value={detailAsset.startDate || ""}
                      readOnly
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#f1f5f9",
                        color: "#475569",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Không thể thay đổi Loại tài sản tại màn hình cập nhật thông tin.");
                      }
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Loại tài sản
                    </label>
                    <input
                      type="text"
                      value={detailAsset.category || ""}
                      readOnly
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#f1f5f9",
                        color: "#475569",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Mã tài sản (EF06) | Đơn vị sử dụng (AF08, EF10) */}
                <div style={{ display: "grid", gridTemplateColumns: "296px 1fr", gap: 16 }}>
                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Mã tài sản không được phép thay đổi sau khi đã ghi tăng.");
                      }
                    }}
                  >
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={detailAsset.code || ""}
                      readOnly
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontWeight: 600,
                        background: "#f1f5f9",
                        color: "#0f172a",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                        Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      {isEditingAsset && (
                        <button
                          type="button"
                          onClick={() => {
                            notify("Không thể đổi Đơn vị sử dụng tại màn hình này. Vui lòng thực hiện Điều chuyển tài sản cố định.");
                            setShowAssetDetailModal(false);
                            setIsEditingAsset(false);
                            setShowTransferModal(true);
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#0284c7",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                            padding: 0,
                            textDecoration: "underline",
                          }}
                        >
                          Thực hiện Điều chuyển TSCĐ →
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={detailAsset.dept || ""}
                      readOnly
                      onClick={() => {
                        if (isEditingAsset) {
                          notify("Không thể đổi Đơn vị sử dụng tại màn hình này. Vui lòng thực hiện Điều chuyển tài sản cố định.");
                        }
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#f1f5f9",
                        color: "#475569",
                        cursor: "not-allowed",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Row 3: Tên tài sản (Editable in Edit Mode per Step 7, AF04, EF04) */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                    Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={isEditingAsset ? editName : detailAsset.name || ""}
                    readOnly={!isEditingAsset}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (e.target.value.trim()) setEditNameError(false);
                    }}
                    placeholder="Nhập tên tài sản cố định..."
                    style={{
                      width: "100%",
                      height: 32,
                      padding: "0 10px",
                      border: editNameError
                        ? "1px solid #ef4444"
                        : isEditingAsset
                        ? "1px solid #00a862"
                        : "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      background: isEditingAsset ? "#ffffff" : "#f8fafc",
                      color: "#1e293b",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  {editNameError && (
                    <span style={{ fontSize: 11.5, color: "#ef4444", marginTop: 3, display: "block" }}>
                      Vui lòng nhập tên tài sản cố định.
                    </span>
                  )}
                </div>

                {/* Row 4: Lý do cập nhật (Step 11, EF12 - Mandatory in Edit Mode) */}
                {isEditingAsset ? (
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Lý do cập nhật <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editUpdateReason}
                      onChange={(e) => {
                        setEditUpdateReason(e.target.value);
                        if (e.target.value.trim()) setEditReasonError(false);
                      }}
                      placeholder="Nhập lý do hoặc căn cứ cập nhật thông tin tài sản (bắt buộc khi lưu thay đổi)..."
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px",
                        border: editReasonError ? "1px solid #ef4444" : "1px solid #00a862",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: "#ffffff",
                        color: "#1e293b",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    {editReasonError && (
                      <span style={{ fontSize: 11.5, color: "#ef4444", marginTop: 3, display: "block" }}>
                        Vui lòng nhập lý do cập nhật thông tin tài sản.
                      </span>
                    )}
                  </div>
                ) : detailAsset.lastUpdateReason ? (
                  <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "6px 10px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    <strong>Lý do cập nhật gần nhất:</strong> {detailAsset.lastUpdateReason}
                  </div>
                ) : null}
              </div>

              {/* Sub-navigation Tabs (6 standard tabs + Lịch sử thay đổi per Step 17) */}
              <div style={{ display: "flex", borderBottom: "1px solid #cbd5e1", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {[
                  { id: "depreciation", label: "1. Thông tin khấu hao (Chỉ đọc)" },
                  { id: "allocation", label: "2. Thiết lập phân bổ (Chỉ đọc)" },
                  { id: "origin", label: "3. Nguồn gốc hình thành" },
                  { id: "components", label: "4. Bộ phận cấu thành" },
                  { id: "accessories", label: "5. Dụng cụ, phụ tùng kèm theo" },
                  { id: "others", label: "6. Thông tin khác" },
                  { id: "history", label: "7. Lịch sử thay đổi" },
                ].map((t) => {
                  const active = detailSubTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailSubTab(t.id as any)}
                      style={{
                        padding: "8px 13px",
                        border: "1px solid",
                        borderColor: active ? "#cbd5e1 #cbd5e1 #ffffff" : "transparent",
                        borderBottom: active ? "2px solid #00a862" : "none",
                        background: active ? "#ffffff" : "#f1f5f9",
                        color: active ? "#00a862" : "#475569",
                        fontWeight: active ? 700 : 500,
                        fontSize: 12,
                        borderRadius: "4px 4px 0 0",
                        cursor: "pointer",
                        marginBottom: -1,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-Tab 1: Thông tin khấu hao (Locked in Edit Mode per AF11, AF12, EF08, BR09–BR11) */}
              {detailSubTab === "depreciation" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 6 }}>
                  {isEditingAsset && (
                    <div
                      style={{
                        padding: "8px 12px",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#92400e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        Chỉ tiêu kế toán (Nguyên giá, Hao mòn lũy kế, Giá trị còn lại, Thời gian sử dụng, Tài khoản) không được phép chỉnh sửa trực tiếp tại UC-FA-02.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          notify("Chỉ tiêu kế toán không được phép chỉnh sửa trực tiếp. Vui lòng thực hiện nghiệp vụ điều chỉnh/đánh giá lại tài sản.");
                          setShowAssetDetailModal(false);
                          setIsEditingAsset(false);
                          setShowRevalModal(true);
                        }}
                        style={{
                          height: 26,
                          padding: "0 10px",
                          background: "#ffffff",
                          border: "1px solid #f59e0b",
                          borderRadius: 4,
                          color: "#b45309",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Mở Đánh giá lại TSCĐ →
                      </button>
                    </div>
                  )}

                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Chỉ tiêu kế toán không được phép chỉnh sửa trực tiếp. Vui lòng thực hiện nghiệp vụ điều chỉnh/đánh giá lại tài sản.");
                      }
                    }}
                    style={{ display: "grid", gridTemplateColumns: "140px 1fr 170px 170px", gap: 16 }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>TK nguyên giá</label>
                      <input
                        type="text"
                        value={detailAsset.costAccount || "2111"}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Nguyên giá</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.originalCost || 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", fontWeight: 700, background: "#f1f5f9", color: "#0f172a", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Tỷ lệ tính KH tháng (%)</label>
                      <input
                        type="text"
                        value={detailAsset.rateMonth ?? Number(((detailAsset.rateYear || 0) / 12).toFixed(2))}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Tỷ lệ tính KH năm (%)</label>
                      <input
                        type="text"
                        value={detailAsset.rateYear || 0}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Chỉ tiêu kế toán không được phép chỉnh sửa trực tiếp. Vui lòng thực hiện nghiệp vụ điều chỉnh/đánh giá lại tài sản.");
                      }
                    }}
                    style={{ display: "grid", gridTemplateColumns: "140px 1fr 170px 170px", gap: 16 }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>TK khấu hao</label>
                      <input
                        type="text"
                        value={detailAsset.deprAccount || "2141"}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Giá trị tính KH</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.deprCostValue ?? detailAsset.originalCost ?? 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Giá trị KH tháng</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.deprMonthValue || 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Giá trị KH năm</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.deprYearValue || 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (isEditingAsset) {
                        notify("Chỉ tiêu kế toán không được phép chỉnh sửa trực tiếp. Vui lòng thực hiện nghiệp vụ điều chỉnh/đánh giá lại tài sản.");
                      }
                    }}
                    style={{ display: "grid", gridTemplateColumns: "140px 1fr 170px 170px", gap: 16 }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Ngày BĐ tính KH</label>
                      <input
                        type="text"
                        value={detailAsset.deprStartDate || detailAsset.startDate || ""}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Hao mòn lũy kế</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.depreciatedAmount || 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Giá trị còn lại</label>
                      <input
                        type="text"
                        value={formatVND(detailAsset.remainingAmount || 0)}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", fontWeight: 700, background: "#f1f5f9", color: "#16a34a", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Thời gian sử dụng</label>
                      <input
                        type="text"
                        value={`${detailAsset.useDuration ?? detailAsset.years ?? 5} ${detailAsset.useDurationUnit || "Năm"}`}
                        readOnly
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, textAlign: "right", background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Thiết lập phân bổ (Locked per AF13, BR12) */}
              {detailSubTab === "allocation" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  {isEditingAsset && (
                    <div style={{ padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, fontSize: 12, color: "#92400e" }}>
                      Thiết lập phân bổ chi phí khấu hao ảnh hưởng đến hạch toán kỳ tính khấu hao nên được giữ ở chế độ chỉ đọc (AF13, BR12).
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Đối tượng phân bổ (Đơn vị / Phòng ban)</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 130 }}>Tỷ lệ phân bổ (%)</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 150 }}>TK chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 220 }}>Khoản mục chi phí</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(detailAsset.allocations) ? detailAsset.allocations : []).map((row: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                          <td style={{ padding: "8px" }}>{row.department || detailAsset.dept}</td>
                          <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{row.rate ?? 100}%</td>
                          <td style={{ padding: "8px", fontWeight: 600, color: "#0284c7" }}>{row.expenseAccount || detailAsset.expenseAccount || "6424"}</td>
                          <td style={{ padding: "8px" }}>{row.expenseItem || "Chi phí khấu hao TSCĐ"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 3: Nguồn gốc hình thành (Controlled Reference Update per AF07, EF11, BR13) */}
              {detailSubTab === "origin" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "8px 12px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    <strong>Lưu ý (AF07, BR13):</strong> Bạn có thể cập nhật thông tin tham chiếu chứng từ nguồn gốc hình thành (Số chứng từ/Hóa đơn, Ngày chứng từ, Nhà cung cấp). Giá trị tiền nguồn gốc được khóa để bảo đảm luôn khớp với <strong>Nguyên giá ({formatVND(detailAsset.originalCost || 0)})</strong>.
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Loại nguồn gốc hình thành</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Số chứng từ / Hóa đơn *</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 130 }}>Ngày chứng từ</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 150 }}>Số tiền (VND)</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 230 }}>Nhà cung cấp / Đối tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editOrigins.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "6px 8px" }}>
                            <select
                              value={row.sourceType}
                              disabled={!isEditingAsset}
                              onChange={(e) => {
                                const next = [...editOrigins];
                                next[idx] = { ...next[idx], sourceType: e.target.value };
                                setEditOrigins(next);
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: isEditingAsset ? "#ffffff" : "#f1f5f9" }}
                            >
                              <option value="Mua sắm mới trong nước">Mua sắm mới trong nước</option>
                              <option value="Chi phí vận chuyển, lắp đặt, chạy thử">Chi phí vận chuyển, lắp đặt, chạy thử</option>
                              <option value="Nhập khẩu">Nhập khẩu</option>
                              <option value="Đầu tư XDCB hoàn thành">Đầu tư XDCB hoàn thành</option>
                              <option value="Nhận góp vốn / Tài trợ">Nhận góp vốn / Tài trợ</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.documentNo}
                              readOnly={!isEditingAsset}
                              onChange={(e) => {
                                const next = [...editOrigins];
                                next[idx] = { ...next[idx], documentNo: e.target.value };
                                setEditOrigins(next);
                              }}
                              placeholder="Số CT / Hóa đơn..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#00a862", fontWeight: 600, background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.documentDate}
                              readOnly={!isEditingAsset}
                              onChange={(e) => {
                                const next = [...editOrigins];
                                next[idx] = { ...next[idx], documentDate: e.target.value };
                                setEditOrigins(next);
                              }}
                              placeholder="DD/MM/YYYY"
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={formatVND(row.amount || 0)}
                              readOnly
                              onClick={() => {
                                if (isEditingAsset) {
                                  notify("Không được phép thay đổi số tiền nguồn gốc hình thành làm lệch Nguyên giá (BR13).");
                                }
                              }}
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", fontWeight: 600, background: "#f1f5f9", color: "#475569", boxSizing: "border-box" }}
                            />
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <input
                              type="text"
                              value={row.supplier}
                              readOnly={!isEditingAsset}
                              onChange={(e) => {
                                const next = [...editOrigins];
                                next[idx] = { ...next[idx], supplier: e.target.value };
                                setEditOrigins(next);
                              }}
                              placeholder="Nhà cung cấp / Đối tác..."
                              style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-Tab 4: Bộ phận cấu thành (AF05, BR14) */}
              {detailSubTab === "components" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "6px 10px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    Khai báo chi tiết các bộ phận cấu thành của tài sản (AF05). Việc cập nhật danh sách này phục vụ quản lý hiện vật và không làm thay đổi Nguyên giá (BR14).
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Tên bộ phận cấu thành</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Đơn vị tính</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 120 }}>Số lượng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 160 }}>Giá trị tham khảo (VND)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editComponents.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                            Chưa có thông tin bộ phận cấu thành.
                          </td>
                        </tr>
                      ) : (
                        editComponents.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.name}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editComponents];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setEditComponents(next);
                                }}
                                placeholder="Tên bộ phận cấu thành..."
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.unit}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editComponents];
                                  next[idx] = { ...next[idx], unit: e.target.value };
                                  setEditComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="number"
                                value={row.quantity}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editComponents];
                                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                                  setEditComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.value === 0 ? "0" : row.value.toLocaleString("vi-VN")}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                                  const next = [...editComponents];
                                  next[idx] = { ...next[idx], value: Number(raw) || 0 };
                                  setEditComponents(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "center" }}>
                              {isEditingAsset && (
                                <button
                                  type="button"
                                  onClick={() => setEditComponents(editComponents.filter((_, i) => i !== idx))}
                                  style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {isEditingAsset && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setEditComponents([...editComponents, { name: "", unit: "Cái", quantity: 1, value: 0 }])}
                        style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        + Thêm bộ phận cấu thành
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 5: Dụng cụ, phụ tùng kèm theo (AF06, BR15) */}
              {detailSubTab === "accessories" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "6px 10px", borderRadius: 4, border: "1px solid #e2e8f0" }}>
                    Khai báo dụng cụ, phụ tùng đi kèm tài sản (AF06). Việc cập nhật danh sách này không tự động cộng vào Nguyên giá TSCĐ (BR15).
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Tên dụng cụ, phụ tùng kèm theo</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 120 }}>Đơn vị tính</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 120 }}>Số lượng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 160 }}>Giá trị (VND)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 42 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editAccessories.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "#64748b", background: "#f8fafc" }}>
                            Chưa có thông tin dụng cụ, phụ tùng kèm theo.
                          </td>
                        </tr>
                      ) : (
                        editAccessories.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.name}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editAccessories];
                                  next[idx] = { ...next[idx], name: e.target.value };
                                  setEditAccessories(next);
                                }}
                                placeholder="Tên dụng cụ, phụ tùng..."
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.unit}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editAccessories];
                                  next[idx] = { ...next[idx], unit: e.target.value };
                                  setEditAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "center", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="number"
                                value={row.quantity}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const next = [...editAccessories];
                                  next[idx] = { ...next[idx], quantity: Number(e.target.value) || 0 };
                                  setEditAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                value={row.value === 0 ? "0" : row.value.toLocaleString("vi-VN")}
                                readOnly={!isEditingAsset}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                                  const next = [...editAccessories];
                                  next[idx] = { ...next[idx], value: Number(raw) || 0 };
                                  setEditAccessories(next);
                                }}
                                style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, textAlign: "right", background: isEditingAsset ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "6px 4px", textAlign: "center" }}>
                              {isEditingAsset && (
                                <button
                                  type="button"
                                  onClick={() => setEditAccessories(editAccessories.filter((_, i) => i !== idx))}
                                  style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 14 }}
                                >
                                  ×
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {isEditingAsset && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setEditAccessories([...editAccessories, { name: "", unit: "Bộ", quantity: 1, value: 0 }])}
                        style={{ height: 28, padding: "0 12px", border: "1px dashed #00a862", borderRadius: 4, background: "#f0fdf4", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        + Thêm dụng cụ, phụ tùng kèm theo
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 6: Thông tin khác (Step 8–10, EF05, BR06) */}
              {detailSubTab === "others" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Nước sản xuất
                    </label>
                    <input
                      type="text"
                      value={isEditingAsset ? editCountryOfOrigin : detailAsset.countryOfOrigin || ""}
                      readOnly={!isEditingAsset}
                      onChange={(e) => setEditCountryOfOrigin(e.target.value)}
                      placeholder={isEditingAsset ? "Ví dụ: Nhật Bản, Đức, Việt Nam..." : "Chưa khai báo"}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: isEditingAsset ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: isEditingAsset ? "#ffffff" : "#f8fafc",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Năm sản xuất
                    </label>
                    <input
                      type="text"
                      value={
                        isEditingAsset
                          ? editManufactureYear
                          : detailAsset.manufactureYear !== undefined && detailAsset.manufactureYear !== null && detailAsset.manufactureYear !== ""
                          ? String(detailAsset.manufactureYear)
                          : ""
                      }
                      readOnly={!isEditingAsset}
                      onChange={(e) => {
                        setEditManufactureYear(e.target.value);
                        setEditYearError(false);
                      }}
                      placeholder={isEditingAsset ? "Nhập năm sản xuất (1900 - nay)..." : "Chưa khai báo"}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: editYearError
                          ? "1px solid #ef4444"
                          : isEditingAsset
                          ? "1px solid #00a862"
                          : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: isEditingAsset ? "#ffffff" : "#f8fafc",
                        boxSizing: "border-box",
                      }}
                    />
                    {editYearError && (
                      <span style={{ fontSize: 11.5, color: "#ef4444", marginTop: 3, display: "block" }}>
                        Năm sản xuất không hợp lệ. Vui lòng kiểm tra lại (1900 – {new Date().getFullYear()}).
                      </span>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số hiệu / Số Serial
                    </label>
                    <input
                      type="text"
                      value={isEditingAsset ? editSerialNumber : detailAsset.serialNumber || ""}
                      readOnly={!isEditingAsset}
                      onChange={(e) => setEditSerialNumber(e.target.value)}
                      placeholder={isEditingAsset ? "Nhập số khung, số máy hoặc số serial..." : "Chưa khai báo"}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: isEditingAsset ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: isEditingAsset ? "#ffffff" : "#f8fafc",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ghi chú / Mô tả kỹ thuật
                    </label>
                    <input
                      type="text"
                      value={isEditingAsset ? editDescription : detailAsset.description || ""}
                      readOnly={!isEditingAsset}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={isEditingAsset ? "Thông số kỹ thuật, tình trạng..." : "Chưa khai báo"}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 8px",
                        border: isEditingAsset ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: isEditingAsset ? "#ffffff" : "#f8fafc",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 7: Lịch sử thay đổi (Step 17, BR19) */}
              {detailSubTab === "history" && (
                <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                  {(() => {
                    const localLogs = localAuditLogsByCode[detailAsset.code] || [];
                    const allLogs = [...localLogs, ...apiAuditLogs];
                    if (allLogs.length === 0) {
                      return (
                        <div style={{ padding: "20px", textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 4, border: "1px solid #e2e8f0", fontSize: 12.5 }}>
                          Chưa có lịch sử cập nhật thông tin cho tài sản <strong>{detailAsset.code}</strong>.
                        </div>
                      );
                    }
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                            <th style={{ padding: "8px", textAlign: "left", width: 145 }}>Thời điểm cập nhật</th>
                            <th style={{ padding: "8px", textAlign: "left", width: 140 }}>Người thực hiện</th>
                            <th style={{ padding: "8px", textAlign: "left", width: 220 }}>Lý do cập nhật</th>
                            <th style={{ padding: "8px", textAlign: "left" }}>Chi tiết trường thay đổi (Trước → Sau)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allLogs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "8px", color: "#64748b", verticalAlign: "top" }}>{log.occurredAt}</td>
                              <td style={{ padding: "8px", fontWeight: 600, color: "#1e293b", verticalAlign: "top" }}>{log.actor}</td>
                              <td style={{ padding: "8px", color: "#334155", verticalAlign: "top" }}>{log.reason}</td>
                              <td style={{ padding: "8px", verticalAlign: "top" }}>
                                {log.changes.map((c, i) => (
                                  <div key={i} style={{ marginBottom: 3 }}>
                                    <strong>{c.fieldName}:</strong>{" "}
                                    <span style={{ color: "#dc2626", textDecoration: "line-through" }}>
                                      {typeof c.oldValue === "object" ? JSON.stringify(c.oldValue) : String(c.oldValue ?? "Trống")}
                                    </span>{" "}
                                    →{" "}
                                    <span style={{ color: "#16a34a", fontWeight: 600 }}>
                                      {typeof c.newValue === "object" ? JSON.stringify(c.newValue) : String(c.newValue ?? "Trống")}
                                    </span>
                                  </div>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer (Step 6, Step 12, AF15, AF16, AF17) */}
            <div
              style={{
                height: 48,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
              }}
            >
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Nguyên giá: <strong style={{ color: "#0f172a" }}>{formatVND(detailAsset.originalCost || 0)}</strong> | Hao mòn lũy kế:{" "}
                <strong style={{ color: "#0f172a" }}>{formatVND(detailAsset.depreciatedAmount || 0)}</strong> | Giá trị còn lại:{" "}
                <strong style={{ color: "#16a34a" }}>{formatVND(detailAsset.remainingAmount || 0)}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!isEditingAsset ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (apiConnected && detailAsset) {
                          void apiSave((writer) =>
                            reconcileFixedAssetAccounting(writer, String(detailAsset.id || detailAsset.code || ""))
                          );
                          return;
                        }
                        notify(`Đã đối chiếu hạch toán TSCĐ ${detailAsset?.code || ""} với Sổ cái: Khớp đúng.`);
                      }}
                      style={{
                        height: 32,
                        padding: "0 14px",
                        border: "1px solid #0284c7",
                        borderRadius: 4,
                        background: "#f0f9ff",
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#0284c7",
                        cursor: "pointer",
                      }}
                    >
                      Đối chiếu hạch toán
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAssetDetailModal(false)}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      onClick={handleStartEditAsset}
                      style={{
                        height: 32,
                        padding: "0 22px",
                        background: "#00a862",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Sửa
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEditAsset}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        background: "#ffffff",
                        fontSize: 12.5,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAssetUpdate}
                      style={{
                        height: 32,
                        padding: "0 22px",
                        background: "#00a862",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Cất
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1D. HỘP THOẠI XÁC NHẬN HỦY THAY ĐỔI CHƯA LƯU (AF15 & AF16) */}
      {showDiscardEditConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 1300,
            padding: 10,
          }}
        >
          <div
            style={{
              width: 440,
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: 42, padding: "0 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Xác nhận hủy cập nhật thông tin</span>
              <button type="button" onClick={() => setShowDiscardEditConfirm(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: "18px 16px", fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
              Dữ liệu thông tin tài sản cố định đã thay đổi nhưng chưa được lưu. Bạn có muốn hủy bỏ các thay đổi đang nhập không?
            </div>
            <div style={{ height: 46, padding: "0 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowDiscardEditConfirm(false)}
                style={{ height: 30, padding: "0 14px", border: "1px solid #00a862", borderRadius: 4, background: "#ffffff", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Tiếp tục chỉnh sửa
              </button>
              <button
                type="button"
                onClick={confirmDiscardAssetEdits}
                style={{ height: 30, padding: "0 16px", border: "none", borderRadius: 4, background: "#ef4444", color: "#ffffff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Bỏ thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL KHAI BÁO TÀI SẢN CỐ ĐỊNH ĐẦU KỲ (ẢNH 2 TRƯỚC ĐÓ) */}
      {showOpeningModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "98vw",
              maxWidth: 1100,
              maxHeight: "94vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 44,
                padding: "0 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCw size={17} style={{ color: "#64748b" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  Khai báo tài sản cố định đầu kỳ
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Khai báo số dư và hồ sơ tài sản cố định đầu kỳ")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowOpeningModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "130px 140px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Số CT ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingVoucherNo}
                      onChange={(e) => setOpeningVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Ngày ghi tăng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={openingVoucherDate}
                        onChange={(e) => setOpeningVoucherDate(e.target.value)}
                        placeholder="DD/MM/YYYY"
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Loại tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={openingCategory}
                        onChange={(e) => setOpeningCategory(e.target.value)}
                        style={{ flex: 1, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                      >
                        <option value="Phương tiện vận tải">Phương tiện vận tải</option>
                        <option value="Nhà cửa, vật kiến trúc">Nhà cửa, vật kiến trúc</option>
                        <option value="Máy móc, thiết bị">Máy móc, thiết bị</option>
                        <option value="Thiết bị, dụng cụ quản lý">Thiết bị, dụng cụ quản lý</option>
                        <option value="Tài sản cố định vô hình">Tài sản cố định vô hình</option>
                        <option value="Tài sản cố định khác">Tài sản cố định khác</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => notify("Thêm nhanh Loại tài sản cố định mới")}
                        style={{ width: 28, height: 30, border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", color: "#00a862", fontWeight: "bold", fontSize: 15, cursor: "pointer", display: "grid", placeItems: "center" }}
                        title="Thêm loại tài sản"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "286px 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Mã tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingCode}
                      onChange={(e) => setOpeningCode(e.target.value)}
                      placeholder="Nhập mã TSCĐ..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Đơn vị sử dụng <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={openingDept}
                      onChange={(e) => setOpeningDept(e.target.value)}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", background: "#ffffff" }}
                    >
                      <option value="Ban Giám đốc">Ban Giám đốc</option>
                      <option value="Khối Văn phòng">Khối Văn phòng</option>
                      <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
                      <option value="Phòng Kế toán">Phòng Kế toán</option>
                      <option value="Phòng Kinh doanh & Marketing">Phòng Kinh doanh & Marketing</option>
                      <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
                      <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 16, alignItems: "center" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>
                      Tên tài sản <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={openingName}
                      onChange={(e) => setOpeningName(e.target.value)}
                      placeholder="Nhập tên chi tiết của tài sản cố định..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ paddingTop: 18 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                      <input
                        type="checkbox"
                        checked={openingNoDepr}
                        onChange={(e) => setOpeningNoDepr(e.target.checked)}
                        style={{ width: 14, height: 14, accentColor: "#00a862" }}
                      />
                      <span>Không tính khấu hao</span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ borderBottom: "1px solid #cbd5e1", display: "flex", gap: 24, marginTop: 4 }}>
                {[
                  { id: "depreciation", label: "Thông tin khấu hao" },
                  { id: "allocation", label: "Thiết lập phân bổ" },
                  { id: "components", label: "Bộ phận cấu thành" },
                  { id: "accessories", label: "Dụng cụ, phụ tùng kèm theo" },
                  { id: "others", label: "Thông tin khác" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOpeningSubTab(st.id as any)}
                    style={{
                      padding: "8px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: openingSubTab === st.id ? 700 : 500,
                      color: openingSubTab === st.id ? "#00a862" : "#475569",
                      borderBottom: openingSubTab === st.id ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {openingSubTab === "depreciation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, paddingTop: 6 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK nguyên giá <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={openingCostAcc}
                          onChange={(e) => setOpeningCostAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="2111">2111</option>
                          <option value="2112">2112</option>
                          <option value="2113">2113</option>
                          <option value="2114">2114</option>
                          <option value="2118">2118</option>
                          <option value="213">213</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Nguyên giá
                        </label>
                        <input
                          type="number"
                          value={openingOriginalCost || ""}
                          onChange={(e) => handleOriginalCostChange(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ KH thg (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={openingDeprRateMonth || ""}
                          onChange={(e) => setOpeningDeprRateMonth(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Tỷ lệ KH năm (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={openingDeprRateYear || ""}
                          onChange={(e) => setOpeningDeprRateYear(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          TK khấu hao <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <select
                          value={openingDeprAcc}
                          onChange={(e) => setOpeningDeprAcc(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="2141">2141</option>
                          <option value="2142">2142</option>
                          <option value="2143">2143</option>
                          <option value="2147">2147</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị tính KH
                        </label>
                        <input
                          type="number"
                          value={openingDeprCostValue || ""}
                          onChange={(e) => setOpeningDeprCostValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH tháng
                        </label>
                        <input
                          type="number"
                          value={openingDeprMonthValue || ""}
                          onChange={(e) => setOpeningDeprMonthValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị KH năm
                        </label>
                        <input
                          type="number"
                          value={openingDeprYearValue || ""}
                          onChange={(e) => setOpeningDeprYearValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "110px 130px 105px 105px", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Ngày BĐ tính KH <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={openingStartDate}
                          onChange={(e) => setOpeningStartDate(e.target.value)}
                          placeholder="DD/MM/YYYY"
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Hao mòn lũy kế
                        </label>
                        <input
                          type="number"
                          value={openingAccumulatedDepr || ""}
                          onChange={(e) => handleAccumulatedDeprChange(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Giá trị còn lại
                        </label>
                        <input
                          type="number"
                          value={openingRemainingValue || ""}
                          readOnly
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 700, color: "#16a34a", background: "#f8fafc", outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian sử dụng
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={openingUseDuration || ""}
                          onChange={(e) => handleUseDurationChange(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={openingUseDurationUnit}
                          onChange={(e) => setOpeningUseDurationUnit(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#334155", marginBottom: 3 }}>
                          Thời gian SD còn lại
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={openingRemainDuration || ""}
                          onChange={(e) => setOpeningRemainDuration(Number(e.target.value))}
                          placeholder="0,00"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ width: 90, paddingTop: 18 }}>
                        <select
                          value={openingRemainDurationUnit}
                          onChange={(e) => setOpeningRemainDurationUnit(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", background: "#ffffff" }}
                        >
                          <option value="Năm">Năm</option>
                          <option value="Tháng">Tháng</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={openingLimitTaxLaw}
                          onChange={(e) => setOpeningLimitTaxLaw(e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: "#00a862" }}
                        />
                        <span>Giới hạn giá trị tính KH theo luật thuế TNDN</span>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị tính KH theo luật
                        </label>
                        <input
                          type="number"
                          disabled={!openingLimitTaxLaw}
                          value={openingTaxLawValue || ""}
                          onChange={(e) => setOpeningTaxLawValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: openingLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>
                          Giá trị KH tháng theo luật
                        </label>
                        <input
                          type="number"
                          disabled={!openingLimitTaxLaw}
                          value={openingTaxLawMonthValue || ""}
                          onChange={(e) => setOpeningTaxLawMonthValue(Number(e.target.value))}
                          placeholder="0"
                          style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none", textAlign: "right", background: openingLimitTaxLaw ? "#ffffff" : "#f1f5f9", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        borderRadius: 6,
                        padding: "10px 14px",
                        marginTop: 8,
                      }}
                    >
                      <Info size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "#166534" }}>
                        Nếu nhập Giá trị KH theo luật thì khi tính KH, chương trình sẽ hạch toán phần chi phí KH tương ứng với Giá trị KH theo luật vào chi phí hợp lý, phần chi phí KH vượt quá giới hạn được hạch toán vào chi phí không hợp lý.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {openingSubTab === "allocation" && (
                <div style={{ paddingTop: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px", textAlign: "left" }}>Đơn vị sử dụng</th>
                        <th style={{ padding: "8px", textAlign: "right", width: 130 }}>Tỷ lệ phân bổ (%)</th>
                        <th style={{ padding: "8px", textAlign: "center", width: 110 }}>TK chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Khoản mục chi phí</th>
                        <th style={{ padding: "8px", textAlign: "left", width: 180 }}>Đối tượng THCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "8px" }}>{openingDept}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>100,00</td>
                        <td style={{ padding: "8px", textAlign: "center", color: "#00a862", fontWeight: 600 }}>6422</td>
                        <td style={{ padding: "8px", color: "#64748b" }}>Chi phí khấu hao TSCĐ</td>
                        <td style={{ padding: "8px", color: "#94a3b8" }}>—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {openingSubTab === "components" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có bộ phận cấu thành riêng biệt. Nhấp nút bên dưới để thêm phụ kiện hoặc chi tiết máy móc cấu thành.
                  </div>
                </div>
              )}

              {openingSubTab === "accessories" && (
                <div style={{ paddingTop: 8 }}>
                  <div style={{ padding: "20px", textAlign: "center", background: "#f8fafc", borderRadius: 4, border: "1px solid #cbd5e1", color: "#64748b", fontSize: 12.5 }}>
                    Chưa có dụng cụ, phụ tùng đi kèm.
                  </div>
                </div>
              )}

              {openingSubTab === "others" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Nước sản xuất</label>
                    <input type="text" placeholder="Ví dụ: Nhật Bản, Việt Nam..." style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Năm sản xuất</label>
                    <input type="number" placeholder="2025" style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }} />
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                height: 48,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "0 20px",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowOpeningModal(false)}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!openingName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: openingCode || `TSCD00${assetsList.length + 1}`,
                    name: openingName,
                    category: openingCategory,
                    dept: openingDept,
                    startDate: openingStartDate,
                    years: Number(openingUseDuration) || 5,
                    rateYear: Number(openingDeprRateYear) || 20,
                    originalCost: Number(openingOriginalCost) || 0,
                    depreciatedAmount: Number(openingAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(openingOriginalCost) || 0) - (Number(openingAccumulatedDepr) || 0)),
                    costAccount: openingCostAcc,
                    deprAccount: openingDeprAcc,
                    expenseAccount: "6422",
                  };
                  if (apiConnected) {
                    void apiSave((writer) => saveFixedAsset(writer, newItem, false))
                      .then((saved) => { if (saved) { setShowOpeningModal(false); setRegisterView("table"); } });
                    return;
                  }
                  setAssetsList([newItem, ...assetsList]);
                  setShowOpeningModal(false);
                  setRegisterView("table");
                  notify(`Đã khai báo TSCĐ đầu kỳ ${newItem.code} - ${newItem.name} thành công!`);
                }}
                style={{
                  height: 32,
                  padding: "0 18px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "#1e293b",
                  cursor: "pointer",
                }}
              >Lưu</button>
              <button
                type="button"
                onClick={() => {
                  if (!openingName) {
                    notify("Vui lòng nhập Tên tài sản cố định!");
                    return;
                  }
                  const newItem = {
                    code: openingCode || `TSCD00${assetsList.length + 1}`,
                    name: openingName,
                    category: openingCategory,
                    dept: openingDept,
                    startDate: openingStartDate,
                    years: Number(openingUseDuration) || 5,
                    rateYear: Number(openingDeprRateYear) || 20,
                    originalCost: Number(openingOriginalCost) || 0,
                    depreciatedAmount: Number(openingAccumulatedDepr) || 0,
                    remainingAmount: Math.max(0, (Number(openingOriginalCost) || 0) - (Number(openingAccumulatedDepr) || 0)),
                    costAccount: openingCostAcc,
                    deprAccount: openingDeprAcc,
                    expenseAccount: "6422",
                  };
                  if (apiConnected) {
                    void apiSave((writer) => saveFixedAsset(writer, newItem, false))
                      .then((saved) => { if (saved) { setOpeningCode(""); setOpeningName(""); setOpeningOriginalCost(0); setOpeningAccumulatedDepr(0); } });
                    return;
                  }
                  setAssetsList([newItem, ...assetsList]);
                  notify(`Đã lưu ${newItem.code}. Mời tiếp tục khai báo TSCĐ đầu kỳ tiếp theo!`);
                  setOpeningCode(`TSCD00${assetsList.length + 2}`);
                  setOpeningName("");
                  setOpeningOriginalCost(0);
                  setOpeningAccumulatedDepr(0);
                  setOpeningRemainingValue(0);
                }}
                style={{
                  height: 32,
                  padding: "0 20px",
                  background: "#00a862",
                  border: "none",
                  borderRadius: 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                Lưu và Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL THÊM BẰNG AI (AVA KẾ TOÁN) */}
      {showAiModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: 10,
          }}
        >
          <div
            style={{
              width: "90vw",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: 8,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: 46, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #f0fdf4 0%, #ede9fe 100%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} style={{ color: "#7c3aed" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Sổ Việt AI: Thêm tài sản bằng AI</span>
              </div>
              <button type="button" onClick={() => setShowAiModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ border: "2px solid #cbd5e1", borderRadius: 8, padding: "24px 20px", textAlign: "center", background: "#f8fafc" }}>
                <FileText size={32} style={{ color: "#7c3aed", margin: "0 auto 8px auto" }} />
                <p style={{ margin: "0 0 6px 0", fontSize: 13, fontWeight: 600, color: "#1e293b" }}>Kéo thả hoặc tải lên Hóa đơn / Hợp đồng mua sắm TSCĐ</p>
                <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>Định dạng hỗ trợ: PDF, XML, Ảnh hóa đơn (JPG, PNG). AI sẽ tự bóc tách số liệu.</p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>Hoặc nhập mô tả bằng văn bản tự nhiên:</label>
                <textarea
                  placeholder="Ví dụ: Công ty mua xe ô tô Hyundai SantaFe giá 1 tỷ 250 triệu ngày 15/09/2026 bàn giao cho Ban Giám đốc, khấu hao 8 năm..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box", resize: "none" }}
                />
              </div>
            </div>
            <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button type="button" onClick={() => setShowAiModal(false)} style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}>
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAiModal(false);
                  setShowAddAssetModal(true);
                  setIncName("Xe ô tô Hyundai SantaFe 2.5 HTRAC");
                  setIncOriginalCost(1250000000);
                  setIncUseDuration(8);
                  notify("Sổ Việt AI đã phân tích hóa đơn và điền sẵn thông tin vào chứng từ ghi tăng!");
                }}
                style={{ height: 32, padding: "0 20px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
              >
                AI Phân tích & Điền mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL CHỌN KỲ TÍNH KHẤU HAO (UC-FA-03 BƯỚC 3–6) */}
      {showDeprModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "90vw", maxWidth: 440, background: "#ffffff", borderRadius: 8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Chọn kỳ tính khấu hao</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Chọn kỳ tháng và năm cần trích khấu hao tài sản cố định")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeprModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 22px 20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Tháng</label>
                  <select
                    value={deprMonth}
                    onChange={(e) => setDeprMonth(Number(e.target.value))}
                    style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #00a862", borderRadius: 4, fontSize: 13, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Năm</label>
                  <input
                    type="number"
                    value={deprYear}
                    onChange={(e) => setDeprYear(Number(e.target.value))}
                    style={{ width: "100%", height: 32, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#334155", cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={deprProrateByDays}
                  onChange={(e) => setDeprProrateByDays(e.target.checked)}
                  style={{ width: 14, height: 14, accentColor: "#00a862" }}
                />
                <span>Tính khấu hao theo số ngày sử dụng thực tế trong tháng (AF05)</span>
              </label>
            </div>

            {/* Footer */}
            <div style={{ height: 48, background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowDeprModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleOpenDeprPeriodVoucher(deprMonth, deprYear, deprProrateByDays)}
                style={{ height: 32, padding: "0 22px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4B. MODAL CHỨNG TỪ TÍNH KHẤU HAO (UC-FA-03 BƯỚC 7–28)               */}
      {/* =================================================================== */}
      {showDeprVoucherModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 1100,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 1340,
              height: "92vh",
              background: "#ffffff",
              borderRadius: 6,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                height: 44,
                padding: "0 18px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#ffffff",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  title="Lịch sử chứng từ"
                  onClick={() => notify(`Chứng từ ${deprVoucherNo} — Trạng thái: ${deprVoucherStatus}`)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, color: "#64748b" }}
                >
                  <RotateCcw size={16} />
                </button>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Tính khấu hao {deprVoucherNo}
                </h2>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    background:
                      deprVoucherStatus === "Đã ghi sổ"
                        ? "#dcfce7"
                        : deprVoucherStatus === "Chưa ghi sổ"
                        ? "#fef9c3"
                        : "#e0f2fe",
                    color:
                      deprVoucherStatus === "Đã ghi sổ"
                        ? "#166534"
                        : deprVoucherStatus === "Chưa ghi sổ"
                        ? "#854d0e"
                        : "#0369a1",
                  }}
                >
                  {deprVoucherStatus}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button
                  type="button"
                  title="Thiết lập"
                  onClick={() => notify("Tùy chọn thiết lập mẫu chứng từ tính khấu hao")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <Settings size={17} />
                </button>
                <button
                  type="button"
                  title="Hướng dẫn"
                  onClick={() => notify("Hướng dẫn lập chứng từ tính khấu hao TSCĐ theo Thông tư 99/2025/TT-BTC")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <HelpCircle size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deprIsDirty && !window.confirm("Dữ liệu chứng từ đã thay đổi. Bạn có chắc chắn muốn đóng không?")) {
                      return;
                    }
                    setShowDeprVoucherModal(false);
                  }}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Thông tin chung (Bước 7–12) */}
            <div
              style={{
                padding: "14px 20px 10px 20px",
                background: "#f4f5f8",
                display: "grid",
                gridTemplateColumns: "1fr 340px 220px",
                gap: 24,
                alignItems: "start",
                flexShrink: 0,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {/* Cột 1: Diễn giải, Tháng, Năm, Tham chiếu */}
              <div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                    Diễn giải
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={deprReason}
                      disabled={deprVoucherStatus === "Đã ghi sổ"}
                      onChange={(e) => {
                        setDeprReason(e.target.value);
                        setDeprIsDirty(true);
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 28px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => notify("Sổ Việt AI: Đã tối ưu hóa diễn giải chứng từ tính khấu hao")}
                      title="Trợ lý Sổ Việt AI"
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        padding: 2,
                      }}
                    >
                      <Sparkles size={14} style={{ color: "#8b5cf6" }} />
                    </button>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                      Tháng
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={deprVoucherMonth}
                      disabled={deprVoucherStatus === "Đã ghi sổ"}
                      onChange={(e) => {
                        const newM = Number(e.target.value);
                        setDeprVoucherMonth(newM);
                        setDeprIsDirty(true);
                        if (newM >= 1 && newM <= 12 && deprVoucherYear >= 1990) {
                          const mStr = String(newM).padStart(2, "0");
                          const days = new Date(deprVoucherYear, newM, 0).getDate();
                          const dStr = `${String(days).padStart(2, "0")}/${mStr}/${deprVoucherYear}`;
                          setDeprPostingDate(dStr);
                          setDeprVoucherDate(dStr);
                          setDeprReason(`Khấu hao TSCĐ tháng ${mStr} năm ${deprVoucherYear}`);
                          const recomputed = computePeriodDepreciationData(newM, deprVoucherYear, deprProrateByDays);
                          setDeprLines(recomputed.lines);
                          setDeprAllocationRows(recomputed.allocations);
                          setDeprAccountingRows(recomputed.accountingEntries);
                        }
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                      Năm
                    </label>
                    <input
                      type="number"
                      value={deprVoucherYear}
                      disabled={deprVoucherStatus === "Đã ghi sổ"}
                      onChange={(e) => {
                        const newY = Number(e.target.value);
                        setDeprVoucherYear(newY);
                        setDeprIsDirty(true);
                        if (deprVoucherMonth >= 1 && deprVoucherMonth <= 12 && newY >= 1990 && newY <= 2100) {
                          const mStr = String(deprVoucherMonth).padStart(2, "0");
                          const days = new Date(newY, deprVoucherMonth, 0).getDate();
                          const dStr = `${String(days).padStart(2, "0")}/${mStr}/${newY}`;
                          setDeprPostingDate(dStr);
                          setDeprVoucherDate(dStr);
                          setDeprReason(`Khấu hao TSCĐ tháng ${mStr} năm ${newY}`);
                          const recomputed = computePeriodDepreciationData(deprVoucherMonth, newY, deprProrateByDays);
                          setDeprLines(recomputed.lines);
                          setDeprAllocationRows(recomputed.allocations);
                          setDeprAccountingRows(recomputed.accountingEntries);
                        }
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                  <span>Tham chiếu</span>
                  <input
                    type="text"
                    value={deprReference}
                    disabled={deprVoucherStatus === "Đã ghi sổ"}
                    onChange={(e) => {
                      setDeprReference(e.target.value);
                      setDeprIsDirty(true);
                    }}
                    placeholder="Số CT tham chiếu..."
                    style={{
                      height: 24,
                      padding: "0 8px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12,
                      background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                      outline: "none",
                      width: 180,
                    }}
                  />
                  <span
                    onClick={() => {
                      if (deprVoucherStatus === "Đã ghi sổ") return;
                      const refList = increaseVouchers.slice(0, 3).map((v) => v.voucherNo).join(", ");
                      setDeprReference(refList);
                      setDeprIsDirty(true);
                      notify(`Đã liên kết chứng từ tham chiếu: ${refList}`);
                    }}
                    title="Chọn chứng từ tham chiếu"
                    style={{ color: "#00a862", fontWeight: 700, cursor: "pointer", padding: "0 4px" }}
                  >
                    ...
                  </span>
                </div>
              </div>

              {/* Cột 2: Ngày hạch toán, Ngày chứng từ, Số chứng từ */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                    Ngày hạch toán
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={deprPostingDate}
                      disabled={deprVoucherStatus === "Đã ghi sổ"}
                      onChange={(e) => {
                        setDeprPostingDate(e.target.value);
                        setDeprIsDirty(true);
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                    Ngày chứng từ
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={deprVoucherDate}
                      disabled={deprVoucherStatus === "Đã ghi sổ"}
                      onChange={(e) => {
                        setDeprVoucherDate(e.target.value);
                        setDeprIsDirty(true);
                      }}
                      style={{
                        width: "100%",
                        height: 30,
                        padding: "0 30px 0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <Calendar size={14} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#475569", marginBottom: 4, fontWeight: 500 }}>
                    Số chứng từ <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={deprVoucherNo}
                    disabled={deprVoucherStatus === "Đã ghi sổ"}
                    onChange={(e) => {
                      setDeprVoucherNo(e.target.value);
                      setDeprIsDirty(true);
                    }}
                    style={{
                      width: "100%",
                      height: 30,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 12.5,
                      background: deprVoucherStatus === "Đã ghi sổ" ? "#f1f5f9" : "#ffffff",
                      fontWeight: 600,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Cột 3: Tổng khấu hao tháng (Bước 12, BR19: Tự động cộng từ bảng chi tiết) */}
              <div style={{ textAlign: "right", paddingTop: 4 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Tổng khấu hao tháng</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", lineHeight: 1.1 }}>
                  {formatVND(totalDeprMonthAmount)}
                </div>
                {totalDeprNonDeductibleAmount > 0 && (
                  <div style={{ fontSize: 11, color: "#dc2626", marginTop: 6, fontWeight: 500 }}>
                    CP không hợp lý: {formatVND(totalDeprNonDeductibleAmount)}
                  </div>
                )}
              </div>
            </div>

            {/* 3 Tabs: Tính khấu hao | Phân bổ | Hạch toán */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 24 }}>
                {[
                  { id: "depreciation", label: `Tính khấu hao (${deprLines.length})` },
                  { id: "allocation", label: `Phân bổ (${deprAllocationRows.length})` },
                  { id: "accounting", label: `Hạch toán (${deprAccountingRows.length})` },
                ].map((t) => {
                  const isActive = deprActiveTab === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setDeprActiveTab(t.id as any)}
                      style={{
                        padding: "10px 4px",
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#00a862" : "#64748b",
                        borderBottom: isActive ? "2.5px solid #00a862" : "2.5px solid transparent",
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </div>
                  );
                })}
              </div>

              {deprVoucherStatus !== "Đã ghi sổ" && (
                <button
                  type="button"
                  onClick={() => {
                    const recomputed = computePeriodDepreciationData(deprVoucherMonth, deprVoucherYear, deprProrateByDays);
                    setDeprLines(recomputed.lines);
                    setDeprAllocationRows(recomputed.allocations);
                    setDeprAccountingRows(recomputed.accountingEntries);
                    setDeprIsDirty(true);
                    notify(`Đã tính lại dữ liệu khấu hao kỳ ${String(deprVoucherMonth).padStart(2, "0")}/${deprVoucherYear} (${recomputed.lines.length} tài sản).`);
                  }}
                  style={{
                    height: 26,
                    padding: "0 10px",
                    border: "1px solid #00a862",
                    borderRadius: 4,
                    background: "#f0fdf4",
                    color: "#00a862",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Calculator size={13} />
                  <span>Lấy lại dữ liệu tính KH</span>
                </button>
              )}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: "#ffffff" }}>
              {/* TAB 1: TÍNH KHẤU HAO (Bước 13–18) */}
              {deprActiveTab === "depreciation" && (
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                          <th style={{ width: 40, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 130, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                          <th style={{ minWidth: 220, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                          <th style={{ width: 170, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại tài sản</th>
                          <th style={{ width: 170, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                          <th style={{ width: 160, padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị KH tháng</th>
                          <th style={{ width: 190, padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị tính vào CP hợp lý</th>
                          <th style={{ width: 210, padding: "8px 10px", textAlign: "right" }}>Giá trị tính vào CP không hợp lý</th>
                        </tr>
                        {/* Summary Row (BR19) */}
                        <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                          <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Tổng cộng</td>
                          <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                          <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                            {formatVND(totalDeprMonthAmount)}
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                            {formatVND(totalDeprDeductibleAmount)}
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right", color: totalDeprNonDeductibleAmount > 0 ? "#dc2626" : "#1e293b" }}>
                            {formatVND(totalDeprNonDeductibleAmount)}
                          </td>
                        </tr>
                      </thead>
                      <tbody>
                        {deprLines.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: "40px 20px", textAlign: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                <svg width="68" height="68" viewBox="0 0 64 64" fill="none">
                                  <path d="M32 6 V10 M20 10 L23 13 M44 10 L41 13" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                                  <path d="M22 14 H38 L48 24 V54 C48 56 46 58 44 58 H22 C20 58 18 56 18 54 V18 C18 16 20 14 22 14 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
                                  <path d="M38 14 V24 H48" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
                                  <circle cx="28" cy="36" r="1.5" fill="#94a3b8" />
                                  <circle cx="38" cy="36" r="1.5" fill="#94a3b8" />
                                  <path d="M30 42 C31.5 44 34.5 44 36 42" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" fill="none" />
                                </svg>
                                <span style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Không có dữ liệu</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          deprLines.map((line, idx) => (
                            <tr key={line.assetCode || idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ textAlign: "center", padding: "7px 6px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                                {idx + 1}
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>
                                {line.assetCode}
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                                {line.assetName}
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                                {line.categoryName}
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", color: "#334155" }}>
                                {line.departmentName}
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                                <input
                                  type="text"
                                  disabled={deprVoucherStatus === "Đã ghi sổ"}
                                  value={formatVND(line.amount)}
                                  onChange={(e) => {
                                    const raw = Number(e.target.value.replace(/\./g, "").replace(/,/g, "")) || 0;
                                    const nextLines = [...deprLines];
                                    const nonDed = Math.min(raw, Number(nextLines[idx].nonDeductibleAmount || 0));
                                    const ded = Math.max(0, raw - nonDed);
                                    nextLines[idx] = {
                                      ...nextLines[idx],
                                      amount: raw,
                                      deductibleAmount: ded,
                                      nonDeductibleAmount: nonDed,
                                      closingAccumulated: nextLines[idx].openingAccumulated + raw,
                                      closingValue: Math.max(0, nextLines[idx].originalCost - (nextLines[idx].openingAccumulated + raw)),
                                    };
                                    setDeprLines(nextLines);
                                    const synced = buildAllocationsAndAccountingFromLines(nextLines, deprVoucherMonth, deprVoucherYear);
                                    setDeprAllocationRows(synced.allocations);
                                    setDeprAccountingRows(synced.accountingEntries);
                                    setDeprIsDirty(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    height: 26,
                                    padding: "0 6px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 4,
                                    textAlign: "right",
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    color: "#1e293b",
                                    background: deprVoucherStatus === "Đã ghi sổ" ? "#f8fafc" : "#ffffff",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>
                                <input
                                  type="text"
                                  disabled={deprVoucherStatus === "Đã ghi sổ"}
                                  value={formatVND(line.deductibleAmount)}
                                  onChange={(e) => {
                                    const raw = Number(e.target.value.replace(/\./g, "").replace(/,/g, "")) || 0;
                                    const cappedDed = Math.min(line.amount, Math.max(0, raw));
                                    const nonDed = Math.max(0, line.amount - cappedDed);
                                    const nextLines = [...deprLines];
                                    nextLines[idx] = {
                                      ...nextLines[idx],
                                      deductibleAmount: cappedDed,
                                      nonDeductibleAmount: nonDed,
                                    };
                                    setDeprLines(nextLines);
                                    const synced = buildAllocationsAndAccountingFromLines(nextLines, deprVoucherMonth, deprVoucherYear);
                                    setDeprAllocationRows(synced.allocations);
                                    setDeprIsDirty(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    height: 26,
                                    padding: "0 6px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 4,
                                    textAlign: "right",
                                    fontSize: 12.5,
                                    color: "#1e293b",
                                    background: deprVoucherStatus === "Đã ghi sổ" ? "#f8fafc" : "#ffffff",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                <input
                                  type="text"
                                  disabled={deprVoucherStatus === "Đã ghi sổ"}
                                  value={formatVND(line.nonDeductibleAmount)}
                                  onChange={(e) => {
                                    const raw = Number(e.target.value.replace(/\./g, "").replace(/,/g, "")) || 0;
                                    const cappedNonDed = Math.min(line.amount, Math.max(0, raw));
                                    const ded = Math.max(0, line.amount - cappedNonDed);
                                    const nextLines = [...deprLines];
                                    nextLines[idx] = {
                                      ...nextLines[idx],
                                      deductibleAmount: ded,
                                      nonDeductibleAmount: cappedNonDed,
                                    };
                                    setDeprLines(nextLines);
                                    const synced = buildAllocationsAndAccountingFromLines(nextLines, deprVoucherMonth, deprVoucherYear);
                                    setDeprAllocationRows(synced.allocations);
                                    setDeprIsDirty(true);
                                  }}
                                  style={{
                                    width: "100%",
                                    height: 26,
                                    padding: "0 6px",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: 4,
                                    textAlign: "right",
                                    fontSize: 12.5,
                                    color: line.nonDeductibleAmount > 0 ? "#dc2626" : "#64748b",
                                    fontWeight: line.nonDeductibleAmount > 0 ? 600 : 400,
                                    background: deprVoucherStatus === "Đã ghi sổ" ? "#f8fafc" : "#ffffff",
                                    boxSizing: "border-box",
                                  }}
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Đính kèm Dung lượng tối đa 5MB (Bước 18, AF13, EF17) */}
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Paperclip size={14} style={{ color: "#64748b" }} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>Đính kèm</span>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>Dung lượng tối đa 5MB</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <label
                        style={{
                          border: "1px dashed #94a3b8",
                          borderRadius: 4,
                          background: "#f8fafc",
                          padding: "10px 18px",
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: "pointer",
                          gap: 8,
                        }}
                      >
                        <Upload size={16} style={{ color: "#0284c7" }} />
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          <strong style={{ color: "#0284c7" }}>Chọn tệp</strong> hoặc kéo và thả tệp vào đây
                        </span>
                        <input
                          type="file"
                          multiple
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            for (const f of files) {
                              if (f.size > 5 * 1024 * 1024) {
                                // EF17
                                notify("Tệp đính kèm không hợp lệ hoặc vượt quá dung lượng 5MB.");
                                e.target.value = "";
                                return;
                              }
                            }
                            setDeprAttachments((prev) => [
                              ...prev,
                              ...files.map((f) => ({ name: f.name, size: f.size })),
                            ]);
                            setDeprIsDirty(true);
                            e.target.value = "";
                          }}
                        />
                      </label>

                      {deprAttachments.map((att, i) => (
                        <div
                          key={`${att.name}-${i}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            borderRadius: 4,
                            background: "#f1f5f9",
                            fontSize: 12,
                            color: "#334155",
                          }}
                        >
                          <FileText size={13} style={{ color: "#0284c7" }} />
                          <span>{att.name}</span>
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>
                            ({Math.max(1, Math.round(att.size / 1024))} KB)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDeprAttachments((prev) => prev.filter((_, idx) => idx !== i));
                              setDeprIsDirty(true);
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 0 }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PHÂN BỔ (Bước 19–20, AF10, AF11, Mục 4.5) */}
              {deprActiveTab === "allocation" && (
                <div style={{ flex: 1, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ width: 120, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                        <th style={{ minWidth: 220, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                        <th style={{ width: 190, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th style={{ width: 110, padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tỷ lệ PB (%)</th>
                        <th style={{ width: 160, padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị KH phân bổ</th>
                        <th style={{ width: 110, padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                        <th style={{ width: 180, padding: "8px 10px", textAlign: "left" }}>Khoản mục CP</th>
                      </tr>
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                        <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Tổng cộng</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                          {formatVND(totalDeprAllocatedAmount)}
                        </td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px" }}></td>
                      </tr>
                    </thead>
                    <tbody>
                      {deprAllocationRows.map((row, idx) => (
                        <tr key={`${row.assetCode}-${idx}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "7px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>
                            {row.assetCode}
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0" }}>{row.assetName}</td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={row.departmentName}
                              onChange={(e) => {
                                const next = [...deprAllocationRows];
                                next[idx] = { ...next[idx], departmentName: e.target.value };
                                setDeprAllocationRows(next);
                                syncDeprAccountingFromAllocations(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="number"
                              step="0.01"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={row.rate}
                              onChange={(e) => {
                                const newRate = Number(e.target.value) || 0;
                                const next = [...deprAllocationRows];
                                const parentLine = deprLines.find((l) => l.assetCode === row.assetCode);
                                const newAllocAmt = parentLine
                                  ? Math.round((parentLine.amount * newRate) / 100)
                                  : row.allocatedAmount;
                                next[idx] = { ...next[idx], rate: newRate, allocatedAmount: newAllocAmt };
                                setDeprAllocationRows(next);
                                syncDeprAccountingFromAllocations(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                textAlign: "right",
                                fontWeight: 600,
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: 600 }}>
                            {formatVND(row.allocatedAmount)}
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={row.expenseAccount}
                              onChange={(e) => {
                                const next = [...deprAllocationRows];
                                next[idx] = { ...next[idx], expenseAccount: e.target.value };
                                setDeprAllocationRows(next);
                                syncDeprAccountingFromAllocations(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                textAlign: "center",
                                color: "#0284c7",
                                fontWeight: 600,
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={row.costItem}
                              onChange={(e) => {
                                const next = [...deprAllocationRows];
                                next[idx] = { ...next[idx], costItem: e.target.value };
                                setDeprAllocationRows(next);
                                syncDeprAccountingFromAllocations(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: HẠCH TOÁN (Bước 17–19 UC-FA-04, AF05, Mục 4.3, 4.7) */}
              {deprActiveTab === "accounting" && (
                <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                  {deprVoucherStatus !== "Đã ghi sổ" && (
                    <div
                      style={{
                        padding: "6px 12px",
                        background: "#f8fafc",
                        borderBottom: "1px solid #cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#475569" }}>
                        Kiểm tra định khoản <strong>Nợ TK chi phí / Có TK hao mòn TSCĐ (214x)</strong> trước khi thực hiện <strong>Ghi sổ</strong>.
                      </span>
                      <button
                        type="button"
                        onClick={handleConsolidateDeprAccountingRows}
                        style={{
                          height: 26,
                          padding: "0 10px",
                          background: "#ffffff",
                          border: "1px solid #0284c7",
                          borderRadius: 4,
                          color: "#0284c7",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Gộp bút toán cùng TK & Bộ phận (AF05)
                      </button>
                    </div>
                  )}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#e6f4ea", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ minWidth: 280, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải định khoản</th>
                        <th style={{ width: 100, padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                        <th style={{ width: 100, padding: "8px 10px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        <th style={{ width: 160, padding: "8px 10px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                        <th style={{ width: 180, padding: "8px 10px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP / Bộ phận</th>
                        <th style={{ width: 160, padding: "8px 10px", textAlign: "left" }}>Khoản mục chi phí</th>
                      </tr>
                      <tr style={{ background: "#f8fafc", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                        <td style={{ padding: "6px 4px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>Tổng tiền hạch toán</td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>
                          {formatVND(totalDeprAccountingAmount)}
                        </td>
                        <td style={{ padding: "6px 10px", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 10px" }}></td>
                      </tr>
                    </thead>
                    <tbody>
                      {deprAccountingRows.map((ae, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "7px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={ae.description}
                              onChange={(e) => {
                                const next = [...deprAccountingRows];
                                next[idx] = { ...next[idx], description: e.target.value };
                                setDeprAccountingRows(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={ae.debitAccount}
                              onChange={(e) => {
                                const next = [...deprAccountingRows];
                                next[idx] = { ...next[idx], debitAccount: e.target.value };
                                setDeprAccountingRows(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                textAlign: "center",
                                fontWeight: 600,
                                color: "#0284c7",
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={ae.creditAccount}
                              onChange={(e) => {
                                const next = [...deprAccountingRows];
                                next[idx] = { ...next[idx], creditAccount: e.target.value };
                                setDeprAccountingRows(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                textAlign: "center",
                                fontWeight: 600,
                                color: "#16a34a",
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              disabled={deprVoucherStatus === "Đã ghi sổ"}
                              value={formatVND(ae.amount)}
                              onChange={(e) => {
                                const raw = Number(e.target.value.replace(/\./g, "").replace(/,/g, "")) || 0;
                                const next = [...deprAccountingRows];
                                next[idx] = { ...next[idx], amount: raw };
                                setDeprAccountingRows(next);
                                setDeprIsDirty(true);
                              }}
                              style={{
                                width: "100%",
                                height: 26,
                                padding: "0 6px",
                                border: "1px solid #cbd5e1",
                                borderRadius: 4,
                                textAlign: "right",
                                fontWeight: 700,
                                color: "#00a862",
                                fontSize: 12,
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td style={{ padding: "7px 10px", borderRight: "1px solid #e2e8f0" }}>{ae.departmentName}</td>
                          <td style={{ padding: "7px 10px" }}>{ae.costItem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Buttons (Bước 24–28, AF14, AF15, AF16, AF17, AF20, Mục 5) */}
            <div
              style={{
                height: 52,
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (deprIsDirty && !window.confirm("Dữ liệu chứng từ đã thay đổi. Bạn có chắc chắn muốn hủy thao tác không?")) {
                      return;
                    }
                    setDeprIsDirty(false);
                    setShowDeprVoucherModal(false);
                  }}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    background: "#ffffff",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={handleExportDeprAllocationExcel}
                  style={{
                    height: 32,
                    padding: "0 14px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "#334155",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <FileSpreadsheet size={14} style={{ color: "#16a34a" }} />
                  <span>Xuất khẩu bảng phân bổ ra Excel</span>
                </button>

                {deprVoucherStatus === "Đã ghi sổ" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePrintDeprVoucher()}
                      style={{
                        height: 32,
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      In chứng từ
                    </button>
                    <button
                      type="button"
                      onClick={handleUnpostDeprVoucher}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        background: "#fff7ed",
                        border: "1px solid #fdba74",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#c2410c",
                        cursor: "pointer",
                      }}
                    >
                      Bỏ ghi sổ
                    </button>
                  </>
                ) : (
                  <>
                    {deprVoucherStatus === "Chưa ghi sổ" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (apiConnected && deprCurrentRunId) {
                            void apiSave((writer) => cancelDepreciationVoucher(writer, deprCurrentRunId)).then((ok) => {
                              if (ok) {
                                setDeprVoucherStatus("Đã hủy");
                                setShowDeprVoucherModal(false);
                              }
                            });
                            return;
                          }
                          setDeprVouchers((prev) =>
                            prev.map((v) => (v.voucherNo === deprVoucherNo ? { ...v, status: "Đã hủy" } : v))
                          );
                          setDeprVoucherStatus("Đã hủy");
                          setShowDeprVoucherModal(false);
                          notify(`Đã hủy chứng từ tính khấu hao ${deprVoucherNo}.`);
                        }}
                        style={{
                          height: 32,
                          padding: "0 16px",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: 4,
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "#dc2626",
                          cursor: "pointer",
                        }}
                      >
                        Hủy chứng từ
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveDeprVoucher({ postNow: false, recalculate: deprVoucherStatus === "Chưa ghi sổ" })}
                      style={{
                        height: 32,
                        padding: "0 18px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#334155",
                        cursor: "pointer",
                      }}
                      title="Cất chứng từ ở trạng thái Chưa ghi sổ (UC-FA-03)"
                    >
                      Cất
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePostDeprVoucher({ printAfter: false })}
                      style={{
                        height: 32,
                        padding: "0 20px",
                        background: "#00a862",
                        border: "1px solid #00a862",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: "pointer",
                      }}
                      title="Ghi nhận khấu hao vào Sổ cái và cập nhật Hao mòn lũy kế / Giá trị còn lại (UC-FA-04)"
                    >
                      Ghi sổ
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePostDeprVoucher({ printAfter: true })}
                      style={{
                        height: 32,
                        padding: "0 16px",
                        background: "#ffffff",
                        border: "1px solid #00a862",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#00a862",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>Ghi sổ và In</span>
                      <ChevronDown size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL ĐÁNH GIÁ LẠI TÀI SẢN CỐ ĐỊNH (ẢNH 1 & 2: ĐGL00001) */}
      {showRevalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 8 }}>
          <div style={{ width: "98vw", maxWidth: 1400, height: "96vh", maxHeight: "96vh", background: "#f2f5f8", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={16} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Đánh giá lại tài sản cố định {revalVoucherNo}</span>
                {apiConnected && <span data-testid="reval-status" style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: revalRecord?.status === "POSTED" ? "#dcfce7" : "#f1f5f9", color: revalRecord?.status === "POSTED" ? "#15803d" : "#475569" }}>
                  {revalRecord ? revalRecord.status_label : "Chứng từ mới"}
                </span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Tùy biến mẫu chứng từ đánh giá lại")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Tùy biến">
                  <Settings size={17} />
                </button>
                <button type="button" onClick={() => notify("Hướng dẫn: Đánh giá lại tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={apiConnected ? closeRevalModal : () => setShowRevalModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "12px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 10, background: "#f2f5f8" }}>
              {/* Form Top Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 140px", gap: 24, padding: "2px 4px" }}>
                {/* Left Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 3 }}>Biên bản số</label>
                      <input
                        type="text"
                        value={revalReportNo}
                        aria-label="Biên bản số"
                        disabled={revalReadOnly}
                        onChange={(e) => setRevalReportNo(e.target.value)}
                        placeholder=""
                        style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 3 }}>Ngày</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="text"
                          value={revalDate}
                        aria-label="Ngày biên bản"
                        disabled={revalReadOnly}
                          onChange={(e) => setRevalDate(e.target.value)}
                          style={{ width: "100%", height: 28, padding: "0 26px 0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                        />
                        <Calendar size={13} style={{ position: "absolute", right: 8, top: 7.5, color: "#64748b" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 3 }}>Lý do</label>
                    <select
                      value={revalReason}
                      aria-label="Lý do"
                      disabled={revalReadOnly}
                      onChange={(e) => setRevalReason(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", color: "#1e293b" }}
                    >
                      <option value="Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản">Nâng cấp TSCĐ làm tăng thời gian sử dụng hoặc giá trị tài sản</option>
                      <option value="Đánh giá lại theo quyết định của cơ quan nhà nước">Đánh giá lại theo quyết định của cơ quan nhà nước</option>
                      <option value="Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp">Đánh giá lại khi chia tách, hợp nhất, sáp nhập doanh nghiệp</option>
                      <option value="Đánh giá lại khi chuyển đổi loại hình doanh nghiệp">Đánh giá lại khi chuyển đổi loại hình doanh nghiệp</option>
                      <option value="Lý do khác">Lý do khác</option>
                    </select>
                  </div>

                  <div>
                    <span onClick={() => apiConnected ? !revalReadOnly && setRevalReferenceDraft("") : notify("Chọn chứng từ tham chiếu")} style={{ fontSize: 12, color: "#00a862", cursor: "pointer", fontWeight: 500 }}>
                      Tham chiếu <span style={{ color: "#00a862", textDecoration: "none" }}>...</span>
                    </span>
                    {/* AF23: decisions, acceptance records or source vouchers referred to by the document. */}
                    {apiConnected && (revalReferences.length > 0 || revalReferenceDraft !== null) && (
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
                        {revalReferences.map((reference, index) => (
                          <span key={`${reference}-${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 10, background: "#ecfdf5", fontSize: 11.5, color: "#065f46" }}>
                            {reference}
                            {!revalReadOnly && <button type="button" title={`Bỏ tham chiếu ${reference}`} onClick={() => setRevalReferences(revalReferences.filter((_, i) => i !== index))}
                              style={{ border: "none", background: "none", padding: 0, color: "#ef4444", cursor: "pointer", display: "grid" }}><X size={11} /></button>}
                          </span>
                        ))}
                        {revalReferenceDraft !== null && (
                          <input aria-label="Hồ sơ tham chiếu" autoFocus placeholder="Số quyết định / biên bản nghiệm thu, nhấn Enter" value={revalReferenceDraft}
                            onChange={(e) => setRevalReferenceDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && revalReferenceDraft.trim()) { setRevalReferences([...revalReferences, revalReferenceDraft.trim()]); setRevalReferenceDraft(null); }
                              if (e.key === "Escape") setRevalReferenceDraft(null);
                            }}
                            style={{ height: 24, minWidth: 260, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12 }} />
                        )}
                      </div>
                    )}
                    {/* AF29: the upgrade cost was already capitalised by its source voucher (e.g. Nợ 211 / Có 241). */}
                    {apiConnected && revalReasonCode === "UPGRADE" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, color: "#334155" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                          <input type="checkbox" checked={revalCostBookedAtSource} disabled={revalReadOnly} onChange={(e) => setRevalCostBookedAtSource(e.target.checked)} />
                          Chi phí nâng cấp đã hạch toán tại chứng từ nguồn
                        </label>
                        {revalCostBookedAtSource && (
                          <input aria-label="Số chứng từ nguồn" placeholder="Số chứng từ nguồn" value={revalSourceReference} disabled={revalReadOnly}
                            onChange={(e) => setRevalSourceReference(e.target.value)}
                            style={{ height: 24, width: 160, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12 }} />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={revalPostingDate}
                        aria-label="Ngày hạch toán"
                        disabled={revalReadOnly}
                        onChange={(e) => setRevalPostingDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: 7.5, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={revalVoucherDate}
                        aria-label="Ngày chứng từ"
                        disabled={revalReadOnly}
                        onChange={(e) => setRevalVoucherDate(e.target.value)}
                        style={{ width: "100%", height: 28, padding: "0 26px 0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                      />
                      <Calendar size={13} style={{ position: "absolute", right: 8, top: 7.5, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Số chứng từ</label>
                    <input
                      type="text"
                      value={revalVoucherNo}
                        aria-label="Số chứng từ"
                        disabled={revalReadOnly}
                      onChange={(e) => setRevalVoucherNo(e.target.value)}
                      style={{ width: "100%", height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Right Total Box */}
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 2 }}>
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>Tổng tiền</span>
                  {/* Step 33: value differences only (cost and accumulated depreciation); months are not money. */}
                  <span data-testid="reval-total" title="Chênh lệch giá trị còn lại = Chênh lệch nguyên giá - Chênh lệch hao mòn lũy kế" style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>
                    {revalRows.reduce((s, r) => s + (r.origDiff || 0) - (r.deprDiff || 0), 0).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>

              {/* Section: Thành viên tham gia */}
              <div style={{ background: "#ffffff", borderRadius: 4, border: "1px solid #e2e8f0", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  onClick={() => setRevalMembersOpen(!revalMembersOpen)}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#1e293b", cursor: "pointer", userSelect: "none" }}
                >
                  <ChevronDown size={14} style={{ transform: revalMembersOpen ? "none" : "rotate(-90deg)", transition: "transform 0.15s ease" }} />
                  <span>Thành viên tham gia</span>
                </div>
                {revalMembersOpen && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 3, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#e2eae5", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                            <th style={{ width: 38, padding: "5px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                            <th style={{ width: "32%", padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Họ và tên</th>
                            <th style={{ width: "32%", padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Chức danh</th>
                            <th style={{ padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đại diện</th>
                            <th style={{ width: 36, padding: "5px 4px", textAlign: "center" }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {revalMembers.map((m, idx) => (
                            <tr key={m.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ textAlign: "center", padding: "4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                              <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                                <input
                                  type="text"
                                  value={m.name}
                                  aria-label={`Họ và tên thành viên ${idx + 1}`}
                                  onChange={(e) => {
                                    const updated = [...revalMembers];
                                    updated[idx].name = e.target.value;
                                    setRevalMembers(updated);
                                  }}
                                  placeholder="Họ và tên..."
                                  style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                                />
                              </td>
                              <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                                <input
                                  type="text"
                                  value={m.title}
                                  aria-label={`Chức danh thành viên ${idx + 1}`}
                                  onChange={(e) => {
                                    const updated = [...revalMembers];
                                    updated[idx].title = e.target.value;
                                    setRevalMembers(updated);
                                  }}
                                  placeholder="Chức danh..."
                                  style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                                />
                              </td>
                              <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                                <input
                                  type="text"
                                  value={m.rep}
                                  aria-label={`Đại diện thành viên ${idx + 1}`}
                                  onChange={(e) => {
                                    const updated = [...revalMembers];
                                    updated[idx].rep = e.target.value;
                                    setRevalMembers(updated);
                                  }}
                                  placeholder="Đại diện..."
                                  style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                                />
                              </td>
                              <td style={{ textAlign: "center", padding: "4px" }}>
                                <button
                                  type="button"
                                  onClick={() => setRevalMembers(revalMembers.filter((_, i) => i !== idx))}
                                  style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setRevalMembers([...revalMembers, { id: Date.now(), name: "", title: "", rep: "" }])}
                        style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Plus size={13} />
                        <span>Thêm dòng</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRevalMembers([])}
                        style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Trash2 size={13} />
                        <span>Xóa hết dòng</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Kết quả đánh giá */}
              <div style={{ background: "#ffffff", borderRadius: 4, border: "1px solid #e2e8f0", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Kết quả đánh giá</span>

                {/* Sub-Tabs */}
                <div style={{ display: "flex", gap: 20, borderBottom: "1px solid #cbd5e1" }}>
                  <button
                    type="button"
                    onClick={() => setRevalTab("adjust")}
                    style={{
                      padding: "6px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: revalTab === "adjust" ? 700 : 500,
                      color: revalTab === "adjust" ? "#00a862" : "#475569",
                      borderBottom: revalTab === "adjust" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Chi tiết điều chỉnh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRevalTab("accounting");
                      if (apiConnected && !revalReadOnly && !revalAccountingRows.length) proposeRevalEntries();
                    }}
                    style={{
                      padding: "6px 2px",
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      fontWeight: revalTab === "accounting" ? 700 : 500,
                      color: revalTab === "accounting" ? "#00a862" : "#475569",
                      borderBottom: revalTab === "accounting" ? "2px solid #00a862" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    Hạch toán
                  </button>
                </div>

                {/* Tab 1: Chi tiết điều chỉnh */}
                {revalTab === "adjust" && (
                  <>
                    <div style={{ border: "1px solid #cbd5e1", borderRadius: 3, overflowX: "auto", maxWidth: "100%" }}>
                      <table style={{ width: "100%", minWidth: 1850, borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#e2eae5", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                            <th rowSpan={2} style={{ width: 38, padding: "5px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1", position: "sticky", left: 0, zIndex: 4, background: "#e2eae5" }}>#</th>
                            <th rowSpan={2} style={{ width: 120, padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                            <th rowSpan={2} style={{ width: 220, padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                            <th rowSpan={2} style={{ width: 150, padding: "5px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                            <th colSpan={3} style={{ padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                            <th colSpan={3} style={{ padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Thời gian sử dụng còn lại (tháng)</th>
                            <th colSpan={4} style={{ padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                            <th colSpan={4} style={{ padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Giá trị tính khấu hao</th>
                            <th rowSpan={2} style={{ width: 180, padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>GTKH tháng sau điều chỉnh</th>
                            <th rowSpan={2} style={{ width: 220, padding: "5px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>GTKH tháng theo luật sau điều chỉnh</th>
                            <th rowSpan={2} style={{ width: 36, padding: "5px 4px", textAlign: "center" }}></th>
                          </tr>
                          <tr style={{ background: "#e2eae5", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontSize: 11.5, fontWeight: 600 }}>
                            {/* Nguyên giá */}
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                            {/* Thời gian sử dụng còn lại */}
                            <th style={{ width: 100, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                            <th style={{ width: 100, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                            <th style={{ width: 100, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                            {/* Hao mòn lũy kế */}
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                            <th style={{ width: 80, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK chi phí</th>
                            {/* Giá trị tính khấu hao */}
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Trước điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Sau điều chỉnh</th>
                            <th style={{ width: 110, padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                            <th style={{ width: 95, padding: "4px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK đánh giá lại</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revalRows.map((row, idx) => (
                            <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ textAlign: "center", padding: "4px", borderRight: "1px solid #e2e8f0", color: "#64748b", position: "sticky", left: 0, zIndex: 2, background: "#ffffff" }}>{idx + 1}</td>
                              <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                                <select
                                  value={row.assetCode}
                                  aria-label={`Mã tài sản dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    const codeVal = e.target.value;
                                    if (codeVal && revalRows.some((other, i) => i !== idx && other.assetCode === codeVal)) {
                                      notify(`Tài sản ${codeVal} đã được chọn trong chứng từ.`);
                                      return;
                                    }
                                    if (apiConnected) {
                                      selectRevalAsset(idx, codeVal);
                                      return;
                                    }
                                    const selected = assetsList.find(a => a.code === codeVal);
                                    const updated = [...revalRows];
                                    updated[idx].assetCode = codeVal;
                                    if (selected) {
                                      const totalMonths = Math.max(1, (selected.years || 1) * 12);
                                      const remRatio = selected.originalCost > 0 ? (selected.remainingAmount / selected.originalCost) : 1;
                                      const remMonths = Math.max(1, Math.round(totalMonths * remRatio));
                                      const isUpgrade = revalReason.toLowerCase().includes("nâng cấp");
                                      const defaultCounterAcc = isUpgrade ? "2412" : "412";
                                      updated[idx].assetName = selected.name;
                                      updated[idx].dept = selected.dept;
                                      updated[idx].origBefore = selected.originalCost;
                                      updated[idx].origAfter = selected.originalCost;
                                      updated[idx].origDiff = 0;
                                      updated[idx].monthsBefore = remMonths;
                                      updated[idx].monthsAfter = remMonths;
                                      updated[idx].monthsDiff = 0;
                                      updated[idx].deprBefore = selected.depreciatedAmount;
                                      updated[idx].deprAfter = selected.depreciatedAmount;
                                      updated[idx].deprDiff = 0;
                                      updated[idx].costAccount = selected.expenseAccount || "6424";
                                      updated[idx].valBefore = selected.remainingAmount;
                                      updated[idx].valAfter = selected.remainingAmount;
                                      updated[idx].valDiff = 0;
                                      updated[idx].revalAccount = defaultCounterAcc;
                                      const monthly = Math.round(selected.remainingAmount / remMonths);
                                      updated[idx].monthlyDeprAfter = monthly;
                                      updated[idx].monthlyDeprLawAfter = monthly;
                                    }
                                    setRevalRows(updated);
                                  }}
                                  style={{ width: "100%", height: 26, border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", background: "transparent" }}
                                >
                                  <option value=""></option>
                                  {apiConnected
                                    ? [...revalCandidates, ...(row.assetCode && !revalCandidates.some((a) => a.code === row.assetCode) ? [{ code: row.assetCode, name: row.assetName }] : [])].map((a: any) => (
                                        <option key={a.code} value={a.code} disabled={Boolean(a.blocked)} title={a.blocked || undefined}>{a.code} - {String(a.name).slice(0, 22)}{a.blocked ? " (đã ghi sổ kỳ sau)" : ""}</option>
                                      ))
                                    : assetsList.map(a => (
                                        <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 22)}...</option>
                                      ))}
                                </select>
                              </td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.assetName}</td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", color: "#475569" }}>{row.dept}</td>

                              {/* Nguyên giá */}
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", color: "#1e293b" }}>
                                {row.origBefore ? row.origBefore.toLocaleString("vi-VN") : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.origAfter || ""}
                                  aria-label={`Nguyên giá sau điều chỉnh dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    if (apiConnected) { updateRevalRow(idx, { origAfter: Number(e.target.value) }); return; }
                                    const val = Number(e.target.value);
                                    const updated = [...revalRows];
                                    updated[idx].origAfter = val;
                                    updated[idx].origDiff = val - (updated[idx].origBefore || 0);
                                    const remAfter = Math.max(0, val - (updated[idx].deprAfter || 0));
                                    updated[idx].valAfter = remAfter;
                                    updated[idx].valDiff = remAfter - (updated[idx].valBefore || 0);
                                    const mAfter = updated[idx].monthsAfter || updated[idx].monthsBefore || 1;
                                    const mDepr = mAfter > 0 ? Math.round(remAfter / mAfter) : 0;
                                    updated[idx].monthlyDeprAfter = mDepr;
                                    updated[idx].monthlyDeprLawAfter = mDepr;
                                    setRevalRows(updated);
                                    const diffAmt = updated[idx].origDiff;
                                    if (diffAmt !== 0) {
                                      const isUpgrade = revalReason.toLowerCase().includes("nâng cấp");
                                      const cAcc = updated[idx].revalAccount || (isUpgrade ? "2412" : "412");
                                      setRevalAccountingRows([{
                                        id: 1,
                                        desc: `${revalReason} - ${updated[idx].assetCode}`,
                                        debitAccount: diffAmt > 0 ? "2111" : cAcc,
                                        creditAccount: diffAmt > 0 ? cAcc : "2111",
                                        amount: Math.abs(diffAmt),
                                        objectCode: updated[idx].assetCode,
                                        objectName: updated[idx].assetName,
                                        costItem: "",
                                        dept: updated[idx].dept,
                                      }]);
                                    }
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", fontWeight: 600, color: row.origDiff > 0 ? "#16a34a" : row.origDiff < 0 ? "#ef4444" : "#1e293b" }}>
                                {row.origDiff ? (row.origDiff > 0 ? `+${row.origDiff.toLocaleString("vi-VN")}` : row.origDiff.toLocaleString("vi-VN")) : ""}
                              </td>

                              {/* Thời gian sử dụng còn lại */}
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "center", color: "#1e293b" }}>
                                {row.monthsBefore ? row.monthsBefore : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.monthsAfter || ""}
                                  aria-label={`Thời gian còn lại sau điều chỉnh dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    if (apiConnected) { updateRevalRow(idx, { monthsAfter: Number(e.target.value) }); return; }
                                    const m = Number(e.target.value);
                                    const updated = [...revalRows];
                                    updated[idx].monthsAfter = m;
                                    updated[idx].monthsDiff = m - (updated[idx].monthsBefore || 0);
                                    const mDepr = m > 0 ? Math.round((updated[idx].valAfter || 0) / m) : 0;
                                    updated[idx].monthlyDeprAfter = mDepr;
                                    updated[idx].monthlyDeprLawAfter = mDepr;
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "center", fontWeight: 600 }}>
                                {row.monthsDiff ? row.monthsDiff : ""}
                              </td>

                              {/* Hao mòn lũy kế */}
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", color: "#1e293b" }}>
                                {row.deprBefore ? row.deprBefore.toLocaleString("vi-VN") : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.deprAfter || ""}
                                  aria-label={`Hao mòn lũy kế sau điều chỉnh dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    if (apiConnected) { updateRevalRow(idx, { deprAfter: Number(e.target.value) }); return; }
                                    const d = Number(e.target.value);
                                    const updated = [...revalRows];
                                    updated[idx].deprAfter = d;
                                    updated[idx].deprDiff = d - (updated[idx].deprBefore || 0);
                                    const remAfter = Math.max(0, (updated[idx].origAfter || 0) - d);
                                    updated[idx].valAfter = remAfter;
                                    updated[idx].valDiff = remAfter - (updated[idx].valBefore || 0);
                                    const mAfter = updated[idx].monthsAfter || updated[idx].monthsBefore || 1;
                                    const mDepr = mAfter > 0 ? Math.round(remAfter / mAfter) : 0;
                                    updated[idx].monthlyDeprAfter = mDepr;
                                    updated[idx].monthlyDeprLawAfter = mDepr;
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", fontWeight: 600 }}>
                                {row.deprDiff ? row.deprDiff.toLocaleString("vi-VN") : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1", textAlign: "center" }}>
                                <input
                                  type="text"
                                  value={row.costAccount}
                                  aria-label={`TK chi phí dòng ${idx + 1}`}
                                  list={apiConnected ? "reval-accounts" : undefined}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    const updated = [...revalRows];
                                    updated[idx].costAccount = e.target.value;
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>

                              {/* Giá trị tính khấu hao */}
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", color: "#1e293b" }}>
                                {row.valBefore ? row.valBefore.toLocaleString("vi-VN") : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.valAfter || ""}
                                  aria-label={`Giá trị tính khấu hao sau điều chỉnh dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    if (apiConnected) { updateRevalRow(idx, { valAfter: Number(e.target.value) }); return; }
                                    const v = Number(e.target.value);
                                    const updated = [...revalRows];
                                    updated[idx].valAfter = v;
                                    updated[idx].valDiff = v - (updated[idx].valBefore || 0);
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>
                              <td style={{ padding: "4px 8px", borderRight: "1px dotted #cbd5e1", textAlign: "right", fontWeight: 600, color: row.valDiff > 0 ? "#16a34a" : row.valDiff < 0 ? "#ef4444" : "#1e293b" }}>
                                {row.valDiff ? (row.valDiff > 0 ? `+${row.valDiff.toLocaleString("vi-VN")}` : row.valDiff.toLocaleString("vi-VN")) : ""}
                              </td>
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1", textAlign: "center" }}>
                                <input
                                  type="text"
                                  value={row.revalAccount}
                                  aria-label={`TK đánh giá lại dòng ${idx + 1}`}
                                  list={apiConnected ? "reval-accounts" : undefined}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    const updated = [...revalRows];
                                    updated[idx].revalAccount = e.target.value;
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>

                              {/* GTKH tháng sau điều chỉnh */}
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.monthlyDeprAfter || ""}
                                  aria-label={`GTKH tháng sau điều chỉnh dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    const updated = [...revalRows];
                                    updated[idx].monthlyDeprAfter = Number(e.target.value);
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>
                              {/* GTKH tháng theo luật sau điều chỉnh */}
                              <td style={{ padding: "2px 4px", borderRight: "1px dotted #cbd5e1" }}>
                                <input
                                  type="number"
                                  value={row.monthlyDeprLawAfter || ""}
                                  aria-label={`GTKH tháng theo luật dòng ${idx + 1}`}
                                  disabled={revalReadOnly}
                                  onChange={(e) => {
                                    const updated = [...revalRows];
                                    updated[idx].monthlyDeprLawAfter = Number(e.target.value);
                                    setRevalRows(updated);
                                  }}
                                  placeholder=""
                                  style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid transparent", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box", background: "transparent" }}
                                />
                              </td>

                              <td style={{ textAlign: "center", padding: "4px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (revalRows.length > 1) {
                                      setRevalRows(revalRows.filter((_, i) => i !== idx));
                                    } else {
                                      setRevalRows([{
                                        id: 1,
                                        assetCode: "",
                                        assetName: "",
                                        dept: "",
                                        origBefore: 0,
                                        origAfter: 0,
                                        origDiff: 0,
                                        monthsBefore: 0,
                                        monthsAfter: 0,
                                        monthsDiff: 0,
                                        deprBefore: 0,
                                        deprAfter: 0,
                                        deprDiff: 0,
                                        costAccount: "",
                                        valBefore: 0,
                                        valAfter: 0,
                                        valDiff: 0,
                                        revalAccount: "",
                                        monthlyDeprAfter: 0,
                                        monthlyDeprLawAfter: 0,
                                      }]);
                                    }
                                  }}
                                  style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* Summary Row (Chính xác theo Ảnh 1 & 2) */}
                          <tr style={{ background: "#edf2f7", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 28 }}>
                            <td style={{ padding: "4px", textAlign: "center", borderRight: "1px solid #cbd5e1", position: "sticky", left: 0, zIndex: 2, background: "#edf2f7" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            {/* Nguyên giá */}
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.origDiff || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            {/* Thời gian sử dụng còn lại */}
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            {/* Hao mòn lũy kế */}
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.deprAfter || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.deprDiff || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            {/* Giá trị tính khấu hao */}
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.valBefore || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.valAfter || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.valDiff || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                            {/* GTKH */}
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.monthlyDeprAfter || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                              {revalRows.reduce((s, r) => s + (r.monthlyDeprLawAfter || 0), 0).toLocaleString("vi-VN")}
                            </td>
                            <td></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Tab 2: Hạch toán */}
                {revalTab === "accounting" && (
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 3, overflowX: "auto", maxWidth: "100%" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#e2eae5", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                          <th style={{ width: 38, padding: "6px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ width: 260, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                          <th style={{ width: 90, padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                          <th style={{ width: 90, padding: "6px 8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                          <th style={{ width: 140, padding: "6px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số tiền</th>
                          <th style={{ width: 120, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã đối tượng</th>
                          <th style={{ width: 200, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên đối tượng</th>
                          <th style={{ width: 130, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục CP</th>
                          <th style={{ width: 150, padding: "6px 8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                          <th style={{ width: 36, padding: "6px 4px", textAlign: "center" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {revalAccountingRows.map((acc, idx) => (
                          <tr key={acc.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ textAlign: "center", padding: "4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={acc.desc}
                                aria-label={`Diễn giải bút toán ${idx + 1}`}
                                                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].desc = e.target.value;
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={acc.debitAccount}
                                aria-label={`TK Nợ bút toán ${idx + 1}`}
                                list={apiConnected ? "reval-accounts" : undefined}
                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].debitAccount = e.target.value;
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={acc.creditAccount}
                                aria-label={`TK Có bút toán ${idx + 1}`}
                                list={apiConnected ? "reval-accounts" : undefined}
                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].creditAccount = e.target.value;
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="number"
                                value={acc.amount || ""}
                                aria-label={`Số tiền bút toán ${idx + 1}`}
                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].amount = Number(e.target.value);
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", textAlign: "right", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={acc.objectCode}
                                aria-label={`Mã đối tượng bút toán ${idx + 1}`}
                                list={apiConnected ? "reval-parties" : undefined}
                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].objectCode = e.target.value;
                                  updated[idx].objectName = (apiRows.parties || []).find((party: any) => party.code === e.target.value)?.name || "";
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{acc.objectName}</td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0" }}>
                              <input
                                type="text"
                                value={acc.costItem}
                                aria-label={`Khoản mục CP bút toán ${idx + 1}`}
                                list={undefined}
                                disabled={revalReadOnly}
                                onChange={(e) => {
                                  const updated = [...revalAccountingRows];
                                  updated[idx].costItem = e.target.value;
                                  setRevalAccountingRows(updated);
                                }}
                                style={{ width: "100%", height: 26, padding: "0 4px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                              />
                            </td>
                            <td style={{ padding: "3px 6px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                              {apiConnected ? (
                                <select aria-label={`Đơn vị sử dụng bút toán ${idx + 1}`} value={acc.dept} disabled={revalReadOnly}
                                  onChange={(e) => setRevalAccountingRows(revalAccountingRows.map((row, i) => i === idx ? { ...row, dept: e.target.value } : row))}
                                  style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                                  <option value=""></option>
                                  {(apiRows.departments || []).map((department: any) => <option key={department.id} value={department.name}>{department.name}</option>)}
                                </select>
                              ) : acc.dept}
                            </td>
                            <td style={{ textAlign: "center", padding: "4px" }}>
                              <button
                                type="button"
                                onClick={() => setRevalAccountingRows(revalAccountingRows.filter((_, i) => i !== idx))}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* Accounting Summary Row */}
                        <tr style={{ background: "#edf2f7", fontWeight: 700, borderTop: "1px solid #cbd5e1", height: 28 }}>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ borderRight: "1px solid #cbd5e1" }}></td>
                          <td style={{ padding: "4px 8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>
                            {revalAccountingRows.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString("vi-VN")}
                          </td>
                          <td colSpan={5}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {apiConnected && <>
                  <datalist id="reval-accounts">
                    {(apiRows.accounts || []).filter((account: any) => account.status === "ACTIVE" && account.is_postable).map((account: any) => <option key={account.id} value={account.code}>{account.name}</option>)}
                  </datalist>
                  <datalist id="reval-parties">
                    {(apiRows.parties || []).filter((party: any) => party.status === "ACTIVE").map((party: any) => <option key={party.id} value={party.code}>{party.name}</option>)}
                  </datalist>
                </>}
                {/* Table Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {apiConnected && revalTab === "accounting" && !revalReadOnly && (
                    <button type="button" onClick={proposeRevalEntries}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #00a862", borderRadius: 4, background: "#f0fdf4", fontSize: 12, fontWeight: 600, color: "#047857", cursor: "pointer" }}>
                      Đề xuất định khoản
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (revalTab === "adjust" && apiConnected) {
                        setRevalRows([...revalRows, emptyRevalRow()]);
                      } else if (revalTab === "accounting" && apiConnected) {
                        setRevalAccountingRows([...revalAccountingRows, { id: Date.now(), desc: `Đánh giá lại tài sản cố định ${revalVoucherNo}`,
                          debitAccount: "", creditAccount: "", amount: 0, objectCode: "", objectName: "", costItem: "", dept: "" }]);
                      } else if (revalTab === "adjust") {
                        setRevalRows([...revalRows, {
                          id: Date.now(),
                          assetCode: "",
                          assetName: "",
                          dept: "",
                          origBefore: 0,
                          origAfter: 0,
                          origDiff: 0,
                          monthsBefore: 0,
                          monthsAfter: 0,
                          monthsDiff: 0,
                          deprBefore: 0,
                          deprAfter: 0,
                          deprDiff: 0,
                          costAccount: "",
                          valBefore: 0,
                          valAfter: 0,
                          valDiff: 0,
                          revalAccount: "",
                          monthlyDeprAfter: 0,
                          monthlyDeprLawAfter: 0,
                        }]);
                      } else {
                        setRevalAccountingRows([...revalAccountingRows, {
                          id: Date.now(),
                          desc: "Đánh giá lại tài sản cố định ĐGL00001",
                          debitAccount: "2111",
                          creditAccount: "412",
                          amount: 0,
                          objectCode: "",
                          objectName: "",
                          costItem: "",
                          dept: "",
                        }]);
                      }
                    }}
                    style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={13} />
                    <span>Thêm dòng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (revalTab === "adjust") {
                        setRevalRows([{
                          id: Date.now(),
                          assetCode: "",
                          assetName: "",
                          dept: "",
                          origBefore: 0,
                          origAfter: 0,
                          origDiff: 0,
                          monthsBefore: 0,
                          monthsAfter: 0,
                          monthsDiff: 0,
                          deprBefore: 0,
                          deprAfter: 0,
                          deprDiff: 0,
                          costAccount: "",
                          valBefore: 0,
                          valAfter: 0,
                          valDiff: 0,
                          revalAccount: "",
                          monthlyDeprAfter: 0,
                          monthlyDeprLawAfter: 0,
                        }]);
                      } else {
                        setRevalAccountingRows([]);
                      }
                    }}
                    style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa hết dòng</span>
                  </button>
                </div>

                {/* Textarea: Kết luận */}
                <div style={{ marginTop: 2 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 3 }}>Kết luận</label>
                  <textarea
                    value={revalConclusion}
                    aria-label="Kết luận"
                    disabled={revalReadOnly}
                    onChange={(e) => setRevalConclusion(e.target.value)}
                    placeholder=""
                    rows={2}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", background: "#ffffff" }}
                  />
                </div>

                {/* Attachment File Box */}
                {apiConnected ? (
                  <VoucherAttachments inputId="reval-attachment-input" files={revalFiles} attachments={revalAttachments} readOnly={revalReadOnly}
                    onAdd={addRevalFiles} onRemoveFile={(index) => setRevalFiles((files) => files.filter((_, i) => i !== index))}
                    onDownload={downloadRevalAttachment} onRemove={removeRevalAttachment} />
                ) : <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 5 }}>
                    <Paperclip size={13} style={{ color: "#64748b" }} />
                    <span>Đính kèm</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                  </div>
                  <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#ffffff", cursor: "pointer" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                      <Upload size={14} />
                      <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                    </div>
                  </div>
                </div>}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 46, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px", gap: 8 }}>
              <button
                type="button"
                onClick={apiConnected ? closeRevalModal : () => setShowRevalModal(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              {apiConnected && revalRecord?.status === "POSTED" && (
                <>
                  <button type="button" onClick={unpostReval}
                    style={{ height: 32, padding: "0 16px", border: "1px solid #fca5a5", borderRadius: 4, background: "#fff1f2", fontSize: 12.5, color: "#b91c1c", cursor: "pointer" }}>
                    Bỏ ghi sổ
                  </button>
                  <button type="button" onClick={() => printRevaluation(revalRecord, revalPrintTemplate)}
                    style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#1e293b", cursor: "pointer" }}>
                    In
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  const vNo = String(revalVoucherNo || "").trim();
                  if (!vNo) {
                    notify("Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.");
                    return;
                  }
                  if (!String(revalPostingDate || "").trim() || !String(revalVoucherDate || "").trim()) {
                    notify("Vui lòng nhập ngày chứng từ và ngày hạch toán hợp lệ.");
                    return;
                  }
                  if (!String(revalReason || "").trim()) {
                    notify("Vui lòng chọn lý do đánh giá lại tài sản.");
                    return;
                  }
                  const validRows = revalRows.filter((r) => String(r.assetCode || "").trim());
                  if (!validRows.length) {
                    notify("Vui lòng chọn ít nhất một tài sản cần đánh giá lại.");
                    return;
                  }
                  for (const r of validRows) {
                    if ((r.origAfter || 0) <= 0) {
                      notify("Nguyên giá sau điều chỉnh không hợp lệ.");
                      return;
                    }
                    if ((r.deprAfter || 0) < 0 || (r.deprAfter || 0) > (r.origAfter || 0)) {
                      notify("Hao mòn lũy kế sau điều chỉnh không hợp lệ.");
                      return;
                    }
                    if ((r.monthsAfter || 0) <= 0 && (r.origAfter || 0) - (r.deprAfter || 0) > 0) {
                      notify("Thời gian sử dụng còn lại sau điều chỉnh không hợp lệ.");
                      return;
                    }
                    if ((r.origDiff || 0) === 0 && (r.deprDiff || 0) === 0 && (r.monthsDiff || 0) === 0 && (r.valDiff || 0) === 0) {
                      notify("Chưa có thông tin tài sản cần điều chỉnh.");
                      return;
                    }
                  }
                  const diffTot = validRows.reduce((s, r) => s + (r.origDiff || r.valDiff || 0), 0);
                  const firstAsset = validRows[0];
                  const newV = {
                    voucherNo: vNo,
                    date: revalPostingDate || revalDate || "12/10/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    reason: revalReason,
                    diffAmount: diffTot || 0,
                    status: "Đã ghi sổ",
                  };
                  const applyLocalRevalUpdate = () => {
                    setAssetsList((prev) =>
                      prev.map((a) => {
                        const matched = validRows.find((r) => r.assetCode === a.code);
                        if (!matched) return a;
                        const newOrig = matched.origAfter || a.originalCost;
                        const newDepr = matched.deprAfter ?? a.depreciatedAmount;
                        const newRem = Math.max(0, newOrig - newDepr);
                        const newMDepr = matched.monthlyDeprAfter || a.deprMonthValue;
                        return {
                          ...a,
                          originalCost: newOrig,
                          depreciatedAmount: newDepr,
                          remainingAmount: newRem,
                          deprCostValue: newOrig,
                          deprMonthValue: newMDepr,
                        };
                      })
                    );
                    setRevalVouchers((prev) => {
                      const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                      if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                      return [newV, ...prev];
                    });
                    const m = vNo.match(/^(.*?)(\d+)$/);
                    if (m) {
                      setRevalVoucherNo(`${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, "0")}`);
                    }
                  };
                  if (apiConnected) {
                    void handleSaveReval();
                    return;
                  }
                  applyLocalRevalUpdate();
                  setShowRevalModal(false);
                  setRevalView("table");
                  notify("Đánh giá lại tài sản cố định thành công.");
                }}
                disabled={apiConnected && revalReadOnly}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >{apiConnected ? "Cất" : "Lưu"}</button>
              <button
                type="button"
                onClick={() => {
                  const vNo = String(revalVoucherNo || "").trim();
                  if (!vNo) {
                    notify("Số chứng từ đánh giá lại không hợp lệ hoặc đã tồn tại.");
                    return;
                  }
                  if (!String(revalPostingDate || "").trim() || !String(revalVoucherDate || "").trim()) {
                    notify("Vui lòng nhập ngày chứng từ và ngày hạch toán hợp lệ.");
                    return;
                  }
                  if (!String(revalReason || "").trim()) {
                    notify("Vui lòng chọn lý do đánh giá lại tài sản.");
                    return;
                  }
                  const validRows = revalRows.filter((r) => String(r.assetCode || "").trim());
                  if (!validRows.length) {
                    notify("Vui lòng chọn ít nhất một tài sản cần đánh giá lại.");
                    return;
                  }
                  const diffTot = validRows.reduce((s, r) => s + (r.origDiff || r.valDiff || 0), 0);
                  const firstAsset = validRows[0];
                  const newV = {
                    voucherNo: vNo,
                    date: revalPostingDate || revalDate || "12/10/2026",
                    assetCode: firstAsset?.assetCode || "TSCD001",
                    assetName: firstAsset?.assetName || "Xe ô tô Toyota Camry 2.5Q - BKS 29A-888.88",
                    reason: revalReason,
                    diffAmount: diffTot || 0,
                    status: "Đã ghi sổ",
                  };
                  const applyLocalRevalUpdate = () => {
                    setAssetsList((prev) =>
                      prev.map((a) => {
                        const matched = validRows.find((r) => r.assetCode === a.code);
                        if (!matched) return a;
                        const newOrig = matched.origAfter || a.originalCost;
                        const newDepr = matched.deprAfter ?? a.depreciatedAmount;
                        const newRem = Math.max(0, newOrig - newDepr);
                        const newMDepr = matched.monthlyDeprAfter || a.deprMonthValue;
                        return {
                          ...a,
                          originalCost: newOrig,
                          depreciatedAmount: newDepr,
                          remainingAmount: newRem,
                          deprCostValue: newOrig,
                          deprMonthValue: newMDepr,
                        };
                      })
                    );
                    setRevalVouchers((prev) => {
                      const exists = prev.some(x => x.voucherNo === newV.voucherNo);
                      if (exists) return prev.map(x => x.voucherNo === newV.voucherNo ? newV : x);
                      return [newV, ...prev];
                    });
                  };
                  if (apiConnected) {
                    void handleSaveReval(revalPrintTemplate);
                    return;
                  }
                  applyLocalRevalUpdate();
                  setShowRevalModal(false);
                  setRevalView("table");
                  notify("Đánh giá lại tài sản cố định thành công.");
                  window.print();
                }}
                disabled={apiConnected && revalReadOnly}
                style={{ height: 32, padding: "0 16px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>{apiConnected ? "Cất và In" : "Lưu và In"}</span>
              </button>
              {apiConnected && (
                <div style={{ position: "relative" }}>
                  <button type="button" aria-label="Chọn mẫu in đánh giá lại" onClick={() => setShowRevalPrintMenu((open) => !open)}
                    style={{ height: 32, padding: "0 8px", background: "#00a862", border: "none", borderRadius: 4, color: "#ffffff", cursor: "pointer", display: "grid", placeItems: "center" }}>
                    <ChevronDown size={14} />
                  </button>
                  {showRevalPrintMenu && (
                    <div role="menu" aria-label="Mẫu in đánh giá lại" style={{ position: "absolute", right: 0, bottom: 38, minWidth: 280, background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, boxShadow: "0 10px 25px rgba(15,23,42,0.18)", padding: 4, zIndex: 5 }}>
                      {[["RECORD", "Biên bản đánh giá lại TSCĐ (Mẫu số 04 - TSCĐ)"], ["VOUCHER", "Chứng từ kế toán (bút toán đánh giá lại)"]].map(([id, label]) => (
                        <button key={id} type="button" role="menuitem"
                          onClick={() => {
                            setRevalPrintTemplate(id);
                            setShowRevalPrintMenu(false);
                            if (revalRecord?.status === "POSTED") printRevaluation(revalRecord, id); else void handleSaveReval(id);
                          }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", border: "none", borderRadius: 3, background: id === revalPrintTemplate ? "#ecfdf5" : "transparent", fontSize: 12.5, cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐIỀU CHUYỂN TÀI SẢN CỐ ĐỊNH (ẢNH 4 MỚI CỦA NGƯỜI DÙNG: ĐCTS00001) */}
      {showTransferModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "98vw", maxWidth: 1120, maxHeight: "94vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCw size={17} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Điều chuyển tài sản cố định {transferVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Hướng dẫn: Điều chuyển tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={handleCancelTransferModal} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Form Top Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Row 1: Biên bản giao nhận số | Ngày */}
                <div style={{ display: "grid", gridTemplateColumns: "260px 160px", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Biên bản giao nhận số</label>
                    <input
                      type="text"
                      value={transferVoucherNo}
                      onChange={(e) => {
                        setTransferVoucherNo(e.target.value);
                        setTransferIsDirty(true);
                      }}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Ngày</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={transferDate}
                        onChange={(e) => {
                          setTransferDate(e.target.value);
                          setTransferIsDirty(true);
                        }}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Người bàn giao | Người tiếp nhận */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Người bàn giao</label>
                    <input
                      type="text"
                      value={transferSender}
                      onChange={(e) => {
                        setTransferSender(e.target.value);
                        setTransferIsDirty(true);
                      }}
                      placeholder="Nhập họ tên người bàn giao..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Người tiếp nhận</label>
                    <input
                      type="text"
                      value={transferReceiver}
                      onChange={(e) => {
                        setTransferReceiver(e.target.value);
                        setTransferIsDirty(true);
                      }}
                      placeholder="Nhập họ tên người tiếp nhận..."
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Row 3: Lý do điều chuyển */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 4 }}>Lý do điều chuyển</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={transferReason}
                      onChange={(e) => {
                        setTransferReason(e.target.value);
                        setTransferIsDirty(true);
                      }}
                      placeholder="Nhập lý do điều chuyển tài sản cố định..."
                      style={{ width: "100%", height: 30, padding: "0 30px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                    <Sparkles size={15} style={{ position: "absolute", right: 8, top: 8, color: "#7c3aed" }} />
                  </div>
                </div>

                {/* Row 4: Tham chiếu (AF17) */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    onClick={() => setShowTransferRefInput((v) => !v)}
                    style={{ fontSize: 12.5, color: "#0284c7", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Tham chiếu ...
                  </span>
                  {(showTransferRefInput || transferReference) && (
                    <input
                      type="text"
                      value={transferReference}
                      onChange={(e) => {
                        setTransferReference(e.target.value);
                        setTransferIsDirty(true);
                      }}
                      placeholder="Số quyết định / biên bản tham chiếu (VD: QĐ-ĐC-2026/25)"
                      style={{ width: 320, height: 26, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, outline: "none" }}
                    />
                  )}
                </div>
              </div>

              {/* Sub-tab: Chi tiết */}
              <div style={{ borderBottom: "1px solid #cbd5e1", marginTop: 4 }}>
                <button
                  type="button"
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#00a862",
                    borderBottom: "2px solid #00a862",
                    cursor: "pointer",
                  }}
                >
                  Chi tiết
                </button>
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                      <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                      <th style={{ minWidth: 190, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                      <th style={{ width: 140, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Từ đơn vị</th>
                      <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đến đơn vị</th>
                      <th style={{ width: 115, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Hợp đồng bán</th>
                      <th style={{ width: 115, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn đặt hàng</th>
                      <th style={{ width: 115, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Công trình</th>
                      <th style={{ width: 125, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Khoản mục CP</th>
                      <th style={{ width: 125, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đối tượng THCP</th>
                      <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferRows.map((row, idx) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.assetCode}
                            onChange={(e) => {
                              const sel = assetsList.find(a => a.code === e.target.value);
                              const updated = [...transferRows];
                              updated[idx].assetCode = e.target.value;
                              if (sel) {
                                updated[idx].assetName = sel.name;
                                updated[idx].fromDept = sel.dept;
                                if (!updated[idx].costItem) {
                                  updated[idx].costItem = "Chi phí khấu hao TSCĐ";
                                }
                              }
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                          >
                            <option value=""></option>
                            {assetsList.map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 20)}...</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{row.assetName}</td>
                        <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.fromDept}</td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <select
                            value={row.toDept}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].toDept = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                          >
                            <option value=""></option>
                            <option value="Ban Giám đốc">Ban Giám đốc</option>
                            <option value="Khối Văn phòng">Khối Văn phòng</option>
                            <option value="Phòng Công nghệ & IT">Phòng Công nghệ & IT</option>
                            <option value="Phòng Kỹ thuật">Phòng Kỹ thuật</option>
                            <option value="Ban Quản lý Công trình">Ban Quản lý Công trình</option>
                            <option value="Phòng Kế toán">Phòng Kế toán</option>
                            <option value="Phòng Kinh doanh & Marketing">Phòng Kinh doanh & Marketing</option>
                            <option value="Phân xưởng Sản xuất 1">Phân xưởng Sản xuất 1</option>
                            <option value="Đội Vận tải & Kho vận">Đội Vận tải & Kho vận</option>
                          </select>
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.contract || ""}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].contract = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            placeholder="—"
                            style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.order || ""}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].order = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            placeholder="—"
                            style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.project || ""}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].project = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            placeholder="VD: Công trình A"
                            style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.costItem || ""}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].costItem = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            placeholder="Chi phí khấu hao TSCĐ"
                            style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </td>
                        <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                          <input
                            type="text"
                            value={row.costObj || ""}
                            onChange={(e) => {
                              const updated = [...transferRows];
                              updated[idx].costObj = e.target.value;
                              setTransferRows(updated);
                              setTransferIsDirty(true);
                            }}
                            placeholder="—"
                            style={{ width: "100%", height: 24, padding: "0 6px", border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", boxSizing: "border-box" }}
                          />
                        </td>
                        <td style={{ textAlign: "center", padding: "4px" }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (transferRows.length > 1) {
                                setTransferRows(transferRows.filter((_, i) => i !== idx));
                              } else {
                                setTransferRows([{ id: 1, assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "", costObj: "" }]);
                              }
                              setTransferIsDirty(true);
                            }}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    setTransferRows([...transferRows, { id: Date.now(), assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "Chi phí khấu hao TSCĐ", costObj: "" }]);
                    setTransferIsDirty(true);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span>+ Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTransferRows([{ id: Date.now(), assetCode: "", assetName: "", fromDept: "", toDept: "", contract: "", order: "", project: "", costItem: "", costObj: "" }]);
                    setTransferIsDirty(true);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment File Box (AF18, EF33) */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                </div>
                <label style={{ display: "block", border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#f8fafc", cursor: "pointer" }}>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const maxBytes = 5 * 1024 * 1024;
                      for (const f of files) {
                        if (f.size > maxBytes) {
                          notify("Tệp đính kèm không hợp lệ hoặc vượt dung lượng tối đa 5MB.");
                          e.target.value = "";
                          return;
                        }
                      }
                      setTransferAttachments((prev) => [
                        ...prev,
                        ...files.map((f) => ({ name: f.name, size: f.size })),
                      ]);
                      setTransferIsDirty(true);
                      e.target.value = "";
                    }}
                  />
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={14} />
                    <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                  </div>
                </label>
                {transferAttachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {transferAttachments.map((att, aIdx) => (
                      <span
                        key={`${att.name}-${aIdx}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 4, background: "#f1f5f9", fontSize: 11.5, color: "#334155" }}
                      >
                        <span>{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setTransferAttachments(transferAttachments.filter((_, i) => i !== aIdx))}
                          style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={handleCancelTransferModal}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveTransferVoucher(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => handleSaveTransferVoucher(true)}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Lưu và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL GHI GIẢM TÀI SẢN CỐ ĐỊNH (UC-FA-07: GGTS00001) */}
      {showDecreaseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 10 }}>
          <div style={{ width: "98vw", maxWidth: 1120, maxHeight: "94vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ height: 44, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={17} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Ghi giảm tài sản cố định {decVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => notify("Tùy chọn mẫu chứng từ ghi giảm")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Tùy chỉnh">
                  <Settings size={17} />
                </button>
                <button type="button" onClick={() => notify("Hướng dẫn: Ghi giảm tài sản cố định")} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Trợ giúp">
                  <HelpCircle size={17} />
                </button>
                <button type="button" onClick={handleCloseDecreaseModal} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }} title="Đóng">
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "16px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Form Top Section */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 140px", gap: 20 }}>
                {/* Left Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 3 }}>Lý do ghi giảm</label>
                    <div
                      onClick={() => setShowDecReasonDropdown(!showDecReasonDropdown)}
                      style={{
                        width: "100%",
                        height: 28,
                        padding: "0 8px",
                        border: showDecReasonDropdown ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 3,
                        fontSize: 12,
                        background: "#ffffff",
                        color: "#1e293b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        boxSizing: "border-box",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{decReason}</span>
                      {showDecReasonDropdown ? <ChevronUp size={14} style={{ color: "#64748b" }} /> : <ChevronDown size={14} style={{ color: "#64748b" }} />}
                    </div>

                    {showDecReasonDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: 2,
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 3,
                          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
                          zIndex: 1300,
                          maxHeight: 220,
                          overflowY: "auto",
                        }}
                      >
                        {DECREASE_REASONS.map((reason) => {
                          const isSelected = decReason === reason;
                          const isHovered = decHoveredReason === reason;
                          return (
                            <div
                              key={reason}
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextHandlingAcc = proposeDecHandlingAccount(reason);
                                const updatedRows = decRows.map((r) => ({
                                  ...r,
                                  handlingAcc: nextHandlingAcc,
                                }));
                                setDecReason(reason);
                                setDecRows(updatedRows);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(updatedRows, reason));
                                }
                                setDecIsDirty(true);
                                setShowDecReasonDropdown(false);
                              }}
                              onMouseEnter={() => setDecHoveredReason(reason)}
                              onMouseLeave={() => setDecHoveredReason(null)}
                              style={{
                                padding: "6px 12px",
                                fontSize: 12.5,
                                cursor: "pointer",
                                background: isSelected
                                  ? "#00a862"
                                  : isHovered
                                  ? "#d1fae5"
                                  : "#ffffff",
                                color: isSelected ? "#ffffff" : isHovered ? "#065f46" : "#1e293b",
                                fontWeight: isSelected ? 600 : 400,
                                transition: "background-color 0.1s ease",
                              }}
                            >
                              {reason}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span onClick={() => notify("Chọn chứng từ tham chiếu")} style={{ fontSize: 12, color: "#00a862", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}>
                      Tham chiếu <span style={{ color: "#00a862" }}>...</span>
                    </span>
                    <input
                      type="text"
                      value={decReference}
                      onChange={(e) => {
                        setDecReference(e.target.value);
                        setDecIsDirty(true);
                      }}
                      placeholder="Số QĐ thanh lý / Biên bản kiểm kê / Hợp đồng góp vốn..."
                      style={{ flex: 1, height: 26, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none" }}
                    />
                  </div>
                </div>

                {/* Right Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày hạch toán</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={decPostingDate}
                        onChange={(e) => {
                          setDecPostingDate(e.target.value);
                          setDecIsDirty(true);
                        }}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Ngày chứng từ</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={decDate}
                        onChange={(e) => {
                          setDecDate(e.target.value);
                          setDecIsDirty(true);
                        }}
                        style={{ width: "100%", height: 30, padding: "0 28px 0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Số chứng từ</label>
                    <input
                      type="text"
                      value={decVoucherNo}
                      onChange={(e) => {
                        setDecVoucherNo(e.target.value);
                        setDecIsDirty(true);
                      }}
                      style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Big Total Box */}
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Tổng tiền</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>
                    {decRows.reduce((s, r) => s + r.originalCost, 0).toLocaleString("vi-VN")}
                  </span>
                </div>
              </div>

              {/* Sub-Tabs: Tài sản | Hạch toán */}
              <div style={{ display: "flex", gap: 20, borderBottom: "1px solid #cbd5e1", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setDecTab("asset")}
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: decTab === "asset" ? 700 : 500,
                    color: decTab === "asset" ? "#00a862" : "#475569",
                    borderBottom: decTab === "asset" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Tài sản
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!decAccountingCustomEdited) {
                      setDecAccountingRows(buildDecAccountingRows(decRows, decReason));
                    }
                    setDecTab("accounting");
                  }}
                  style={{
                    padding: "6px 2px",
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    fontWeight: decTab === "accounting" ? 700 : 500,
                    color: decTab === "accounting" ? "#00a862" : "#475569",
                    borderBottom: decTab === "accounting" ? "2px solid #00a862" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  Hạch toán
                </button>
              </div>

              {/* Table under Tab Tài sản */}
              {decTab === "asset" ? (
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Pin size={12} style={{ color: "#64748b" }} />
                            <span>Mã tài sản</span>
                          </div>
                        </th>
                        <th style={{ minWidth: 180, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                        <th style={{ width: 140, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                        <th style={{ width: 130, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị tính khấu hao</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nguyên giá</th>
                        <th style={{ width: 80, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Hao mòn</th>
                        <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Xử lý giá trị</th>
                        <th style={{ width: 36, padding: "8px 4px", textAlign: "center" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {decRows.map((row, idx) => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                            <select
                              value={row.assetCode}
                              onChange={(e) => {
                                const codeVal = e.target.value;
                                if (codeVal && decRows.some((r, i) => i !== idx && r.assetCode === codeVal)) {
                                  notify(`Tài sản ${codeVal} đã được chọn trong chứng từ.`);
                                  return;
                                }
                                const selected = assetsList.find(a => a.code === codeVal);
                                const updated = [...decRows];
                                updated[idx] = { ...updated[idx], assetCode: codeVal };
                                if (selected) {
                                  const orig = Number(selected.originalCost) || 0;
                                  const accum = Number(selected.depreciatedAmount) || 0;
                                  const rem = Math.max(0, orig - accum);
                                  updated[idx].assetName = selected.name;
                                  updated[idx].dept = selected.dept;
                                  updated[idx].originalCost = orig;
                                  updated[idx].deprCost = Number((selected as any).deprCostValue) || orig;
                                  updated[idx].accumulatedDepr = accum;
                                  updated[idx].remainingValue = rem;
                                  updated[idx].costAcc = selected.costAccount || "2112";
                                  updated[idx].accumulatedAcc = selected.deprAccount || "2141";
                                  updated[idx].handlingAcc = proposeDecHandlingAccount(decReason);
                                }
                                setDecRows(updated);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(updated, decReason));
                                }
                                setDecIsDirty(true);
                              }}
                              style={{ width: "100%", height: 26, border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                            >
                              <option value=""></option>
                              {assetsList
                                .filter((a: any) => a.status !== "DISPOSED" && a.statusDisplay !== "Đã ghi giảm")
                                .map(a => (
                                  <option key={a.code} value={a.code}>{a.code} - {a.name.slice(0, 20)}...</option>
                                ))}
                            </select>
                          </td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{row.assetName}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.originalCost ? row.originalCost.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.deprCost ? row.deprCost.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right" }}>{row.accumulatedDepr ? row.accumulatedDepr.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{row.remainingValue ? row.remainingValue.toLocaleString("vi-VN") : "0"}</td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.costAcc}
                              onChange={(e) => {
                                const updated = [...decRows];
                                updated[idx] = { ...updated[idx], costAcc: e.target.value };
                                setDecRows(updated);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(updated, decReason));
                                }
                                setDecIsDirty(true);
                              }}
                              style={{ width: 64, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.accumulatedAcc}
                              onChange={(e) => {
                                const updated = [...decRows];
                                updated[idx] = { ...updated[idx], accumulatedAcc: e.target.value };
                                setDecRows(updated);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(updated, decReason));
                                }
                                setDecIsDirty(true);
                              }}
                              style={{ width: 64, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                            <input
                              type="text"
                              value={row.handlingAcc}
                              onChange={(e) => {
                                const updated = [...decRows];
                                updated[idx] = { ...updated[idx], handlingAcc: e.target.value };
                                setDecRows(updated);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(updated, decReason));
                                }
                                setDecIsDirty(true);
                              }}
                              style={{ width: 72, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, color: "#00a862", fontWeight: 600 }}
                            />
                          </td>
                          <td style={{ textAlign: "center", padding: "4px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const nextRows =
                                  decRows.length > 1
                                    ? decRows.filter((_, i) => i !== idx)
                                    : [{ id: 1, assetCode: "", assetName: "", dept: "", originalCost: 0, deprCost: 0, accumulatedDepr: 0, remainingValue: 0, costAcc: "2112", accumulatedAcc: "2141", handlingAcc: proposeDecHandlingAccount(decReason) }];
                                setDecRows(nextRows);
                                if (!decAccountingCustomEdited) {
                                  setDecAccountingRows(buildDecAccountingRows(nextRows, decReason));
                                }
                                setDecIsDirty(true);
                              }}
                              style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", display: "grid", placeItems: "center" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {/* Summary row */}
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}></td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.originalCost, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.deprCost, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{decRows.reduce((s, r) => s + r.accumulatedDepr, 0).toLocaleString("vi-VN")}</td>
                        <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#ef4444" }}>{decRows.reduce((s, r) => s + r.remainingValue, 0).toLocaleString("vi-VN")}</td>
                        <td colSpan={3} style={{ borderRight: "1px solid #e2e8f0" }}></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Hạch toán sub-tab (Steps 24–27, AF18, AF21, AF22, Section 4.6–4.9) */
                <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                        <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                        <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Nợ</th>
                        <th style={{ width: 100, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK Có</th>
                        <th style={{ width: 160, padding: "8px", textAlign: "right" }}>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(decAccountingRows.length > 0 ? decAccountingRows : buildDecAccountingRows(decRows, decReason)).map((ae, idx) => (
                        <tr key={ae.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ textAlign: "center", padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={ae.description}
                              onChange={(e) => {
                                const current = decAccountingRows.length > 0 ? [...decAccountingRows] : buildDecAccountingRows(decRows, decReason);
                                current[idx] = { ...current[idx], description: e.target.value };
                                setDecAccountingRows(current);
                                setDecAccountingCustomEdited(true);
                                setDecIsDirty(true);
                              }}
                              style={{ width: "100%", height: 24, border: "1px solid #cbd5e1", borderRadius: 3, padding: "0 6px", fontSize: 12 }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={ae.debitAcc}
                              onChange={(e) => {
                                const current = decAccountingRows.length > 0 ? [...decAccountingRows] : buildDecAccountingRows(decRows, decReason);
                                current[idx] = { ...current[idx], debitAcc: e.target.value };
                                setDecAccountingRows(current);
                                setDecAccountingCustomEdited(true);
                                setDecIsDirty(true);
                              }}
                              style={{ width: 72, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, fontWeight: 600, color: "#00a862" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <input
                              type="text"
                              value={ae.creditAcc}
                              onChange={(e) => {
                                const current = decAccountingRows.length > 0 ? [...decAccountingRows] : buildDecAccountingRows(decRows, decReason);
                                current[idx] = { ...current[idx], creditAcc: e.target.value };
                                setDecAccountingRows(current);
                                setDecAccountingCustomEdited(true);
                                setDecIsDirty(true);
                              }}
                              style={{ width: 72, height: 24, textAlign: "center", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, fontWeight: 600, color: "#00a862" }}
                            />
                          </td>
                          <td style={{ padding: "4px 8px", textAlign: "right" }}>
                            <input
                              type="number"
                              value={ae.amount}
                              onChange={(e) => {
                                const current = decAccountingRows.length > 0 ? [...decAccountingRows] : buildDecAccountingRows(decRows, decReason);
                                current[idx] = { ...current[idx], amount: Number(e.target.value) || 0 };
                                setDecAccountingRows(current);
                                setDecAccountingCustomEdited(true);
                                setDecIsDirty(true);
                              }}
                              style={{ width: 130, height: 24, textAlign: "right", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, fontWeight: 600 }}
                            />
                          </td>
                        </tr>
                      ))}
                      {(decAccountingRows.length > 0 ? decAccountingRows : buildDecAccountingRows(decRows, decReason)).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: "14px", textAlign: "center", color: "#94a3b8" }}>
                            Chọn tài sản tại tab Tài sản để hệ thống tự động sinh bút toán hạch toán ghi giảm.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Actions */}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    const nextRows = [
                      ...decRows,
                      {
                        id: Date.now(),
                        assetCode: "",
                        assetName: "",
                        dept: "",
                        originalCost: 0,
                        deprCost: 0,
                        accumulatedDepr: 0,
                        remainingValue: 0,
                        costAcc: "2112",
                        accumulatedAcc: "2141",
                        handlingAcc: proposeDecHandlingAccount(decReason),
                      },
                    ];
                    setDecRows(nextRows);
                    setDecIsDirty(true);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <span>+ Thêm dòng</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const resetRows = [
                      {
                        id: Date.now(),
                        assetCode: "",
                        assetName: "",
                        dept: "",
                        originalCost: 0,
                        deprCost: 0,
                        accumulatedDepr: 0,
                        remainingValue: 0,
                        costAcc: "2112",
                        accumulatedAcc: "2141",
                        handlingAcc: proposeDecHandlingAccount(decReason),
                      },
                    ];
                    setDecRows(resetRows);
                    setDecAccountingRows([]);
                    setDecAccountingCustomEdited(false);
                    setDecIsDirty(true);
                  }}
                  style={{ height: 28, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Trash2 size={13} />
                  <span>Xóa hết dòng</span>
                </button>
              </div>

              {/* Attachment File Box */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  <Paperclip size={14} style={{ color: "#64748b" }} />
                  <span>Đính kèm</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>Dung lượng tối đa 5MB</span>
                </div>
                <label style={{ display: "block", border: "1px solid #cbd5e1", borderRadius: 4, padding: "14px 16px", textAlign: "center", background: "#f8fafc", cursor: "pointer" }}>
                  <input type="file" multiple onChange={handleDecAttachmentSelect} style={{ display: "none" }} />
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0284c7" }}>
                    <Upload size={14} />
                    <span>Chọn tệp hoặc kéo và thả tệp vào đây</span>
                  </div>
                </label>
                {decAttachments.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {decAttachments.map((att, i) => (
                      <span key={`${att.name}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 4, background: "#e2e8f0", fontSize: 11.5, color: "#1e293b" }}>
                        <span>{att.name} ({Math.round(att.size / 1024)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setDecAttachments(decAttachments.filter((_, idx) => idx !== i))}
                          style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 0 }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 20px", gap: 10 }}>
              <button
                type="button"
                onClick={handleCloseDecreaseModal}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveDecrease(false)}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => handleSaveDecrease(true)}
                style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL BẢNG KIỂM KÊ TÀI SẢN CỐ ĐỊNH KKTS00001 (UC-FA-08 – KIỂM KÊ TÀI SẢN) */}
      {showStocktakeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1100, padding: 8 }}>
          <div style={{ width: "98vw", maxWidth: 1440, height: "96vh", maxHeight: "96vh", background: "#f2f5f8", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Modal Header */}
            <div style={{ height: 44, padding: "0 18px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RotateCcw size={16} style={{ color: "#475569" }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Bảng kiểm kê tài sản cố định {stocktakeVoucherNo}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => notify("Hướng dẫn: Bảng kiểm kê tài sản cố định (UC-FA-08)")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Trợ giúp"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseStocktakeModal}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", display: "grid", placeItems: "center" }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: "14px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12, background: "#f2f5f8" }}>
              {/* Master Info (Top Form) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "flex-start" }}>
                {/* Left Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                      Mục đích <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={stocktakePurpose}
                        onChange={(e) => {
                          setStocktakePurpose(e.target.value);
                          setStocktakeIsDirty(true);
                        }}
                        placeholder="Ví dụ: Kiểm kê TSCĐ định kỳ cuối năm, kiểm kê bàn giao..."
                        style={{ width: "100%", height: 30, padding: "0 34px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff", outline: "none", boxSizing: "border-box" }}
                      />
                      <Sparkles size={14} style={{ position: "absolute", right: 10, top: 8, color: "#6366f1" }} />
                    </div>
                  </div>

                  {/* Row: Kiểm kê đến ngày + Phạm vi kiểm kê (AF06, AF07) */}
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr", gap: 12, alignItems: "flex-end" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                        Kiểm kê đến ngày <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          type="text"
                          value={stocktakeAuditDate}
                          onChange={(e) => {
                            setStocktakeAuditDate(e.target.value);
                            setStocktakeIsDirty(true);
                          }}
                          placeholder="DD/MM/YYYY"
                          style={{ width: "100%", height: 30, padding: "0 30px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff", outline: "none", boxSizing: "border-box" }}
                        />
                        <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                        Phạm vi Đơn vị sử dụng (AF06)
                      </label>
                      <select
                        value={stocktakeScopeDept}
                        onChange={(e) => setStocktakeScopeDept(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none" }}
                      >
                        <option value="ALL">-- Tất cả đơn vị sử dụng --</option>
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                        Phạm vi Loại tài sản (AF07)
                      </label>
                      <select
                        value={stocktakeScopeCategory}
                        onChange={(e) => setStocktakeScopeCategory(e.target.value)}
                        style={{ width: "100%", height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none" }}
                      >
                        <option value="ALL">-- Tất cả loại TSCĐ --</option>
                        {categoryOptions.map((c, idx) => (
                          <option key={c.code || idx} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tham chiếu (Step 8, AF02, AF20) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#475569", whiteSpace: "nowrap" }}>Tham chiếu</span>
                    <input
                      type="text"
                      value={stocktakeReference}
                      onChange={(e) => {
                        setStocktakeReference(e.target.value);
                        setStocktakeIsDirty(true);
                      }}
                      placeholder="Nhập QĐ kiểm kê, kế hoạch hoặc chứng từ xử lý (VD: QĐ-KK/2026, GGTS00001)..."
                      style={{ width: 380, height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none" }}
                    />
                    <span
                      onClick={() => {
                        const nextRef = stocktakeReference ? `${stocktakeReference}; QĐ-KK-2026/01` : "QĐ-KK-2026/01";
                        setStocktakeReference(nextRef);
                        setStocktakeIsDirty(true);
                        notify("Đã liên kết quyết định/chứng từ tham chiếu kiểm kê.");
                      }}
                      style={{ fontSize: 12.5, color: "#00a862", cursor: "pointer", fontWeight: 600, userSelect: "none" }}
                      title="Chọn chứng từ tham chiếu"
                    >
                      ...
                    </span>
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                      Số chứng từ <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={stocktakeVoucherNo}
                      onChange={(e) => {
                        setStocktakeVoucherNo(e.target.value);
                        setStocktakeIsDirty(true);
                      }}
                      style={{ width: 200, height: 30, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#334155", marginBottom: 4 }}>
                      Ngày <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative", width: 200 }}>
                      <input
                        type="text"
                        value={stocktakeDate}
                        onChange={(e) => {
                          setStocktakeDate(e.target.value);
                          setStocktakeIsDirty(true);
                        }}
                        style={{ width: "100%", height: 30, padding: "0 30px 0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, background: "#ffffff", outline: "none", boxSizing: "border-box" }}
                      />
                      <Calendar size={14} style={{ position: "absolute", right: 8, top: 8, color: "#64748b" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible Section: > Thành viên tham gia (Steps 9–13, AF04, AF05, EF08) */}
              <div style={{ background: "#ffffff", borderRadius: 4, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div
                  onClick={() => setStocktakeMembersOpen(!stocktakeMembersOpen)}
                  style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}
                >
                  {stocktakeMembersOpen ? (
                    <ChevronDown size={15} style={{ color: "#475569" }} />
                  ) : (
                    <ChevronRight size={15} style={{ color: "#475569" }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    Thành viên tham gia ({stocktakeMembers.filter((m) => String(m.name || "").trim()).length})
                  </span>
                </div>

                {stocktakeMembersOpen && (
                  <div style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#ffffff" }}>
                      <thead>
                        <tr style={{ background: "#e2eae5", color: "#1e293b", fontWeight: 600 }}>
                          <th style={{ width: 40, padding: "6px 4px", textAlign: "center", border: "1px solid #cbd5e1" }}>#</th>
                          <th style={{ padding: "6px 8px", textAlign: "left", border: "1px solid #cbd5e1" }}>Họ và tên</th>
                          <th style={{ width: 160, padding: "6px 8px", textAlign: "left", border: "1px solid #cbd5e1" }}>Chức vụ</th>
                          <th style={{ width: 180, padding: "6px 8px", textAlign: "left", border: "1px solid #cbd5e1" }}>Đại diện</th>
                          <th style={{ width: 180, padding: "6px 8px", textAlign: "left", border: "1px solid #cbd5e1" }}>Vai trò trong ban kiểm kê</th>
                          <th style={{ width: 60, padding: "6px 4px", textAlign: "center", border: "1px solid #cbd5e1" }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stocktakeMembers.map((m, idx) => (
                          <tr key={m.id}>
                            <td style={{ textAlign: "center", padding: "6px 4px", border: "1px solid #cbd5e1" }}>{idx + 1}</td>
                            <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={m.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStocktakeMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, name: val } : x)));
                                  setStocktakeIsDirty(true);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={m.position}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStocktakeMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, position: val } : x)));
                                  setStocktakeIsDirty(true);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={m.represent}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStocktakeMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, represent: val } : x)));
                                  setStocktakeIsDirty(true);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ padding: "4px 8px", border: "1px solid #cbd5e1" }}>
                              <input
                                type="text"
                                value={m.role}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setStocktakeMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: val } : x)));
                                  setStocktakeIsDirty(true);
                                }}
                                style={{ width: "100%", border: "none", outline: "none", fontSize: 12.5 }}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "4px", border: "1px solid #cbd5e1" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setStocktakeMembers((prev) => prev.filter((x) => x.id !== m.id));
                                  setStocktakeIsDirty(true);
                                }}
                                style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setStocktakeMembers((prev) => [
                            ...prev,
                            { id: String(Date.now()), name: "", position: "", represent: "", role: "Thành viên" },
                          ]);
                          setStocktakeIsDirty(true);
                        }}
                        style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#00a862", fontWeight: 600, cursor: "pointer" }}
                      >
                        + Thêm thành viên
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Table Card: Danh sách tài sản cố định kiểm kê */}
              <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>Chi tiết tài sản kiểm kê</h4>
                    {/* Live Reconciliation Badges (Section 4.2–4.8) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#f1f5f9", color: "#334155", fontWeight: 600 }}>
                        Theo sổ: {stocktakeSummary.bookAssetsCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
                        Khớp: {stocktakeSummary.matchedCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
                        Thiếu: {stocktakeSummary.missingCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                        Sai đơn vị: {stocktakeSummary.deptMismatchCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#e0e7ff", color: "#3730a3", fontWeight: 600 }}>
                        Thừa ngoài sổ: {stocktakeSummary.surplusCount}
                      </span>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#ffedd5", color: "#9a3412", fontWeight: 600 }}>
                        Vấn đề CL: {stocktakeSummary.qualityIssueCount}
                      </span>
                      {stocktakeSummary.uncountedCount > 0 && (
                        <span style={{ padding: "2px 8px", borderRadius: 12, background: "#f3e8ff", color: "#6b21a8", fontWeight: 600 }}>
                          Chưa xác nhận: {stocktakeSummary.uncountedCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = String(Date.now());
                        setStocktakeRows((prev) => [
                          ...prev,
                          {
                            id: newId,
                            assetCode: "",
                            assetName: "",
                            dept: "",
                            actualDept: "",
                            cost: 0,
                            deprCost: 0,
                            accumDepr: 0,
                            remainCost: 0,
                            existenceStatus: "UNCOUNTED",
                            exists: null,
                            isSurplus: false,
                            currentQuality: "",
                            recommendation: "",
                            note: "",
                          },
                        ]);
                        setStocktakeIsDirty(true);
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #00a862", borderRadius: 4, background: "#ffffff", color: "#00a862", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      + Thêm dòng
                    </button>
                    <button
                      type="button"
                      onClick={handleAddSurplusStocktakeRow}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #4f46e5", borderRadius: 4, background: "#eef2ff", color: "#4338ca", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      title="Ghi nhận tài sản phát hiện thực tế nhưng chưa có trên sổ kế toán (AF11)"
                    >
                      + Thêm tài sản thừa
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadBookAssetsForStocktake}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#f8fafc", color: "#334155", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Lấy từ danh mục TSCĐ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStocktakeRows((prev) =>
                          prev.map((row) =>
                            row.isSurplus
                              ? row
                              : {
                                  ...row,
                                  existenceStatus: "EXISTS",
                                  exists: true,
                                  currentQuality: row.currentQuality || "Bình thường",
                                  recommendation: row.recommendation || "Tiếp tục sử dụng",
                                }
                          )
                        );
                        setStocktakeIsDirty(true);
                        notify("Đã xác nhận tồn tại cho toàn bộ tài sản trên bảng kiểm kê.");
                      }}
                      style={{ height: 26, padding: "0 10px", border: "1px solid #16a34a", borderRadius: 4, background: "#f0fdf4", color: "#15803d", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Xác nhận tồn tại tất cả
                    </button>
                  </div>
                </div>

                {/* Table with Two-Tier Headers matching Screenshots 1 & 2 + UC-FA-08 columns */}
                {(() => {
                  const perPage = Math.max(1, parseInt(stocktakeRowsPerPage, 10) || 50);
                  const totalPages = Math.max(1, Math.ceil(stocktakeRows.length / perPage));
                  const safePage = Math.min(stocktakeCurrentPage, totalPages);
                  const startIndex = (safePage - 1) * perPage;
                  const pagedRows = stocktakeRows.slice(startIndex, startIndex + perPage);

                  return (
                    <>
                      <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: 2 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, whiteSpace: "nowrap" }}>
                          <thead>
                            <tr style={{ background: "#e2eae5", color: "#1e293b", fontWeight: 600 }}>
                              <th rowSpan={2} style={{ width: 38, textAlign: "center", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", padding: "6px 4px" }}>#</th>
                              <th rowSpan={2} style={{ width: 125, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Mã tài sản</th>
                              <th rowSpan={2} style={{ minWidth: 190, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Tên tài sản</th>
                              <th rowSpan={2} style={{ width: 140, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                              <th colSpan={4} style={{ textAlign: "center", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Theo sổ kế toán</th>
                              <th colSpan={4} style={{ textAlign: "center", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Theo kiểm kê</th>
                              <th colSpan={2} style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #cbd5e1" }}>Xử lý</th>
                            </tr>
                            <tr style={{ background: "#e2eae5", color: "#1e293b", fontWeight: 600 }}>
                              {/* Theo sổ kế toán */}
                              <th style={{ width: 115, textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Nguyên giá</th>
                              <th style={{ width: 125, textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Giá trị tính KH</th>
                              <th style={{ width: 115, textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                              <th style={{ width: 115, textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                              {/* Theo kiểm kê */}
                              <th style={{ width: 125, textAlign: "center", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Tồn tại</th>
                              <th style={{ width: 140, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Đơn vị thực tế</th>
                              <th style={{ width: 140, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Chất lượng hiện thời</th>
                              <th style={{ width: 150, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Kiến nghị xử lý</th>
                              {/* Xử lý */}
                              <th style={{ minWidth: 130, textAlign: "left", padding: "6px 8px", borderRight: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1" }}>Ghi chú</th>
                              <th style={{ width: 42, textAlign: "center", padding: "6px 4px", borderBottom: "1px solid #cbd5e1" }}>Xóa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagedRows.map((r, idx) => {
                              const globalIdx = startIndex + idx;
                              const isDeptDiff =
                                !r.isSurplus &&
                                r.existenceStatus === "EXISTS" &&
                                r.dept &&
                                r.actualDept &&
                                r.dept.trim().toLowerCase() !== r.actualDept.trim().toLowerCase();

                              return (
                                <tr
                                  key={r.id}
                                  style={{
                                    borderBottom: "1px solid #e2e8f0",
                                    background: r.isSurplus
                                      ? "#eef2ff"
                                      : r.existenceStatus === "MISSING"
                                      ? "#fff1f2"
                                      : isDeptDiff
                                      ? "#fffbeb"
                                      : "#ffffff",
                                  }}
                                >
                                  <td style={{ textAlign: "center", padding: "6px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                                    {globalIdx + 1}
                                  </td>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    {r.isSurplus ? (
                                      <input
                                        type="text"
                                        value={r.assetCode}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setStocktakeRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, assetCode: val } : x)));
                                          setStocktakeIsDirty(true);
                                        }}
                                        placeholder="Mã tạm (THUA-001)"
                                        style={{ width: "100%", height: 26, border: "1px solid #818cf8", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", background: "#ffffff" }}
                                      />
                                    ) : (
                                      <select
                                        value={r.assetCode}
                                        onChange={(e) => {
                                          const selectedCode = e.target.value;
                                          const found: any = assetsList.find((a) => a.code === selectedCode);
                                          const orig = found ? Number(found.originalCost || 0) : 0;
                                          const accum = found ? Math.min(orig, Math.max(0, Number(found.depreciatedAmount || 0))) : 0;
                                          const rem = Math.max(0, orig - accum);
                                          setStocktakeRows((prev) =>
                                            prev.map((x) =>
                                              x.id === r.id
                                                ? {
                                                    ...x,
                                                    assetCode: selectedCode,
                                                    assetName: found ? found.name : "",
                                                    dept: found ? found.dept : "",
                                                    actualDept: found ? found.dept : "",
                                                    cost: orig,
                                                    deprCost: found ? Number(found.deprCostValue || orig) : 0,
                                                    accumDepr: accum,
                                                    remainCost: rem,
                                                    existenceStatus: "UNCOUNTED",
                                                    exists: null,
                                                  }
                                                : x
                                            )
                                          );
                                          setStocktakeIsDirty(true);
                                        }}
                                        style={{ width: "100%", height: 26, border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 12, outline: "none", background: "#ffffff" }}
                                      >
                                        <option value="">-- Chọn tài sản --</option>
                                        {assetsList.map((a) => (
                                          <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                  <td style={{ padding: "4px 8px", borderRight: "1px solid #e2e8f0", color: "#1e293b", fontWeight: 500 }}>
                                    {r.isSurplus ? (
                                      <input
                                        type="text"
                                        value={r.assetName}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setStocktakeRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, assetName: val } : x)));
                                          setStocktakeIsDirty(true);
                                        }}
                                        placeholder="Nhập tên tài sản thừa phát hiện..."
                                        style={{ width: "100%", height: 24, border: "1px solid #818cf8", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none", background: "#ffffff" }}
                                      />
                                    ) : (
                                      r.assetName || ""
                                    )}
                                  </td>
                                  <td style={{ padding: "6px 8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>
                                    {r.isSurplus ? <span style={{ color: "#6366f1", fontStyle: "italic" }}>Ngoài sổ kế toán</span> : r.dept || ""}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                                    {r.cost > 0 ? formatVND(r.cost) : "0"}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>
                                    {r.deprCost > 0 ? formatVND(r.deprCost) : "0"}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>
                                    {r.accumDepr > 0 ? formatVND(r.accumDepr) : "0"}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>
                                    {r.remainCost > 0 ? formatVND(r.remainCost) : "0"}
                                  </td>
                                  {/* 3-State Existence Status (Step 24, BR14, BR19) */}
                                  <td style={{ textAlign: "center", padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    {r.isSurplus ? (
                                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "#4338ca" }}>Phát hiện thừa</span>
                                    ) : (
                                      <select
                                        value={r.existenceStatus}
                                        onChange={(e) => {
                                          const st = e.target.value as "UNCOUNTED" | "EXISTS" | "MISSING";
                                          setStocktakeRows((prev) =>
                                            prev.map((x) =>
                                              x.id === r.id
                                                ? {
                                                    ...x,
                                                    existenceStatus: st,
                                                    exists: st === "UNCOUNTED" ? null : st === "EXISTS",
                                                    currentQuality:
                                                      st === "EXISTS" && !x.currentQuality
                                                        ? "Bình thường"
                                                        : st === "MISSING" && (!x.currentQuality || x.currentQuality === "Bình thường")
                                                        ? "Không tìm thấy khi kiểm kê"
                                                        : x.currentQuality,
                                                    recommendation:
                                                      st === "EXISTS" && !x.recommendation
                                                        ? "Tiếp tục sử dụng"
                                                        : st === "MISSING" && (!x.recommendation || x.recommendation === "Tiếp tục sử dụng")
                                                        ? "Xác minh nguyên nhân / lập hồ sơ xử lý thiếu"
                                                        : x.recommendation,
                                                  }
                                                : x
                                            )
                                          );
                                          setStocktakeIsDirty(true);
                                        }}
                                        style={{
                                          width: "100%",
                                          height: 24,
                                          border: "1px solid #cbd5e1",
                                          borderRadius: 3,
                                          fontSize: 11.5,
                                          fontWeight: 600,
                                          color: r.existenceStatus === "EXISTS" ? "#15803d" : r.existenceStatus === "MISSING" ? "#b91c1c" : "#6b21a8",
                                          background: "#ffffff",
                                          outline: "none",
                                        }}
                                      >
                                        <option value="UNCOUNTED">-- Chưa kiểm kê --</option>
                                        <option value="EXISTS">✓ Tồn tại</option>
                                        <option value="MISSING">✗ Không tồn tại</option>
                                      </select>
                                    )}
                                  </td>
                                  {/* Đơn vị thực tế (AF10, BR23) */}
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    <select
                                      value={r.actualDept || r.dept || ""}
                                      disabled={r.existenceStatus === "MISSING"}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStocktakeRows((prev) =>
                                          prev.map((x) => {
                                            if (x.id !== r.id) return x;
                                            const mismatch = x.dept && val && x.dept.toLowerCase() !== val.toLowerCase();
                                            return {
                                              ...x,
                                              actualDept: val,
                                              recommendation:
                                                mismatch && (!x.recommendation || x.recommendation === "Tiếp tục sử dụng")
                                                  ? `Điều chuyển sang ${val}`
                                                  : x.recommendation,
                                            };
                                          })
                                        );
                                        setStocktakeIsDirty(true);
                                      }}
                                      style={{ width: "100%", height: 24, border: "1px solid #e2e8f0", borderRadius: 3, fontSize: 11.5, outline: "none", background: r.existenceStatus === "MISSING" ? "#f1f5f9" : "#ffffff" }}
                                    >
                                      <option value="">-- Đơn vị thực tế --</option>
                                      {departmentOptions.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    <input
                                      type="text"
                                      value={r.currentQuality}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStocktakeRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, currentQuality: val } : x)));
                                        setStocktakeIsDirty(true);
                                      }}
                                      placeholder="Bình thường / Hư hỏng..."
                                      style={{ width: "100%", height: 24, border: "1px solid #e2e8f0", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    <input
                                      type="text"
                                      value={r.recommendation}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStocktakeRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, recommendation: val } : x)));
                                        setStocktakeIsDirty(true);
                                      }}
                                      placeholder="Tiếp tục sử dụng / Sửa chữa..."
                                      style={{ width: "100%", height: 24, border: "1px solid #e2e8f0", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ padding: "4px 6px", borderRight: "1px solid #e2e8f0" }}>
                                    <input
                                      type="text"
                                      value={r.isSurplus ? r.identificationInfo || r.note : r.note}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setStocktakeRows((prev) =>
                                          prev.map((x) =>
                                            x.id === r.id
                                              ? { ...x, note: val, ...(x.isSurplus ? { identificationInfo: val } : {}) }
                                              : x
                                          )
                                        );
                                        setStocktakeIsDirty(true);
                                      }}
                                      placeholder={r.isSurplus ? "Đặc điểm nhận dạng / Số serial *" : "Ghi chú"}
                                      style={{ width: "100%", height: 24, border: "1px solid #e2e8f0", borderRadius: 3, padding: "0 6px", fontSize: 12, outline: "none" }}
                                    />
                                  </td>
                                  <td style={{ textAlign: "center", padding: "4px" }}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStocktakeRows((prev) => prev.filter((x) => x.id !== r.id));
                                        setStocktakeIsDirty(true);
                                      }}
                                      style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer" }}
                                      title="Xóa dòng"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {/* Summary Row matching Screenshots 1 & 2 (Section 4.1) */}
                            <tr style={{ background: "#f8fafc", borderTop: "1px solid #cbd5e1", fontWeight: 700, color: "#1e293b" }}>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 4px" }}></td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}>Tổng cộng</td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>
                                {formatVND(stocktakeSummary.totalCost)}
                              </td>
                              <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>
                                {formatVND(stocktakeSummary.totalDeprCost)}
                              </td>
                              <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1" }}>
                                {formatVND(stocktakeSummary.totalAccumDepr)}
                              </td>
                              <td style={{ textAlign: "right", padding: "6px 8px", borderRight: "1px solid #cbd5e1", color: "#00a862" }}>
                                {formatVND(stocktakeSummary.totalRemainCost)}
                              </td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 4px", textAlign: "center", fontSize: 11.5 }}>
                                Tồn tại: {stocktakeSummary.verifiedExistingCount}/{stocktakeSummary.bookAssetsCount}
                              </td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ borderRight: "1px solid #cbd5e1", padding: "6px 8px" }}></td>
                              <td style={{ padding: "6px 4px" }}></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Table Bottom Bar: Tổng số & Số dòng/trang (AF23) */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: "#334155", paddingTop: 4 }}>
                        <div>
                          <span>Tổng số: </span>
                          <strong>{stocktakeRows.length}</strong>
                          <span> dòng ({stocktakeSummary.bookAssetsCount} theo sổ, {stocktakeSummary.surplusCount} phát hiện thừa)</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span>Số dòng/trang</span>
                            <select
                              value={stocktakeRowsPerPage}
                              onChange={(e) => {
                                setStocktakeRowsPerPage(e.target.value);
                                setStocktakeCurrentPage(1);
                              }}
                              style={{ height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, outline: "none", cursor: "pointer" }}
                            >
                              <option value="10">10</option>
                              <option value="20">20</option>
                              <option value="50">50</option>
                              <option value="100">100</option>
                            </select>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, userSelect: "none", color: "#64748b" }}>
                            <span onClick={() => setStocktakeCurrentPage(1)} style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang đầu">|&lt;</span>
                            <span onClick={() => setStocktakeCurrentPage(Math.max(1, safePage - 1))} style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang trước">&lt;</span>
                            <span style={{ display: "inline-block", minWidth: 20, textAlign: "center", padding: "2px 6px", borderRadius: 3, background: "#00a862", color: "#ffffff", fontWeight: 700, fontSize: 12 }}>
                              {safePage}/{totalPages}
                            </span>
                            <span onClick={() => setStocktakeCurrentPage(Math.min(totalPages, safePage + 1))} style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang sau">&gt;</span>
                            <span onClick={() => setStocktakeCurrentPage(totalPages)} style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang cuối">&gt;|</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Form below Table: Kết luận, Checkbox Đã xử lý kiến nghị, Đính kèm (Steps 31–33) */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#334155", marginBottom: 4 }}>Kết luận</label>
                  <textarea
                    value={stocktakeConclusion}
                    onChange={(e) => {
                      setStocktakeConclusion(e.target.value);
                      setStocktakeIsDirty(true);
                    }}
                    rows={2}
                    placeholder="Nhập kết luận của Ban kiểm kê về tình hình tài sản và phương án xử lý chênh lệch..."
                    style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 4, padding: "8px 10px", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", background: "#ffffff" }}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1e293b", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={stocktakeProcessed}
                    onChange={(e) => {
                      setStocktakeProcessed(e.target.checked);
                      setStocktakeIsDirty(true);
                    }}
                    style={{ cursor: "pointer" }}
                  />
                  <span>Đã xử lý kiến nghị</span>
                </label>

                {/* Attachments Section (Step 33, AF24, EF26) */}
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 6 }}>
                    <Paperclip size={14} style={{ color: "#64748b" }} />
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>Đính kèm</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>Dung lượng tối đa 5MB</span>
                  </div>

                  <label
                    style={{
                      border: "1px dashed #cbd5e1",
                      borderRadius: 6,
                      padding: "14px 20px",
                      textAlign: "center",
                      background: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <input
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        for (const f of files) {
                          if (f.size > 5 * 1024 * 1024) {
                            notify("Tệp đính kèm không hợp lệ hoặc vượt quá dung lượng cho phép (tối đa 5MB).");
                            return;
                          }
                        }
                        setStocktakeAttachments((prev) => [
                          ...prev,
                          ...files.map((f) => ({ name: f.name, size: f.size })),
                        ]);
                        setStocktakeIsDirty(true);
                      }}
                    />
                    <Upload size={18} style={{ color: "#64748b" }} />
                    <div style={{ fontSize: 12.5, color: "#64748b" }}>
                      <span style={{ color: "#2563eb", fontWeight: 500 }}>Chọn tệp</span> hoặc kéo và thả tệp vào đây
                    </div>
                  </label>
                  {stocktakeAttachments.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {stocktakeAttachments.map((att, i) => (
                        <span
                          key={i}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 4, background: "#e2e8f0", fontSize: 12, color: "#1e293b" }}
                        >
                          {att.name} ({Math.round(att.size / 1024)} KB)
                          <button
                            type="button"
                            onClick={() => setStocktakeAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                            style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer matching UC-FA-08 Steps 34–38 */}
            <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 18px", gap: 10, flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleCloseStocktakeModal}
                style={{ height: 32, padding: "0 18px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#334155", cursor: "pointer" }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSaveStocktake(false)}
                style={{ height: 32, padding: "0 22px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, fontWeight: 500, color: "#334155", cursor: "pointer" }}
              >
                Cất
              </button>
              <button
                type="button"
                onClick={() => handleSaveStocktake(true)}
                style={{ height: 32, padding: "0 18px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                <span>Cất và In</span>
                <ChevronDown size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL PREVIEW BÁO CÁO & THIẾT LẬP THAM SỐ (UC-FA-09 Steps 5–24, AF13, AF15, AF16) */}
      {previewReportName && (() => {
        const isEn = reportLang === "en";
        const activeDef = UC09_REPORT_CATALOG.find((d) => d.code === previewReportCode) || UC09_REPORT_CATALOG[1];
        const rCode = activeDef.code;
        const fDt = parseDeprDateString(reportFromDate);
        const tDt = parseDeprDateString(reportToDate);

        // Filter assets according to report parameters (Steps 6–10)
        const reportAssets = assetsList
          .map((a) => reconstructAssetSnapshotAtDate(a, tDt))
          .filter((snap: any) => {
            if (!snap.acquiredByDate) return false;
            if (reportExcludeDisposed && snap.isDisposedAtDate) return false;
            if (reportDeptFilter !== "all" && snap.dept !== reportDeptFilter) return false;
            if (reportCategoryFilter !== "all" && String(snap.category || "") !== reportCategoryFilter) return false;
            if (rCode === "ASSET_CARD" && reportAssetCodeFilter !== "all" && snap.code !== reportAssetCodeFilter) return false;
            return true;
          });

        const rTotOrig = reportAssets.reduce((s, a) => s + Number(a.originalCost || 0), 0);
        const rTotDepr = reportAssets.reduce((s, a) => s + Number(a.depreciatedAmount || 0), 0);
        const rTotRem = Math.max(0, rTotOrig - rTotDepr);

        const handleExportCurrentReportExcel = () => {
          if (typeof window !== "undefined" && typeof Blob !== "undefined") {
            const csvLines = [
              `"${previewReportName}"`,
              `"Đơn vị: ${_company.name}","Kỳ báo cáo: Từ ${reportFromDate} đến ${reportToDate}"`,
              ["STT", "Mã TSCĐ", "Tên tài sản cố định", "Đơn vị sử dụng", "Nguyên giá", "Hao mòn lũy kế", "Giá trị còn lại"].join(","),
              ...reportAssets.map((a: any, idx: number) =>
                [
                  idx + 1,
                  `"${a.code}"`,
                  `"${String(a.name || "").replace(/"/g, '""')}"`,
                  `"${String(a.dept || "").replace(/"/g, '""')}"`,
                  a.originalCost,
                  a.depreciatedAmount,
                  a.remainingAmount,
                ].join(",")
              ),
              ["", `"TỔNG CỘNG"`, "", "", rTotOrig, rTotDepr, rTotRem].join(","),
            ];
            const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${rCode}_${reportFromDate.replace(/\//g, "")}_${reportToDate.replace(/\//g, "")}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
          notify(`Đã xuất báo cáo "${previewReportName}" ra file Excel thành công.`);
        };

        const handlePrintCurrentReport = () => {
          notify(`Đang chuẩn bị bản in báo cáo "${previewReportName}"...`);
          if (typeof window !== "undefined" && typeof window.print === "function") {
            setTimeout(() => window.print(), 200);
          }
        };

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", zIndex: 1050, padding: 10 }}>
            <div style={{ width: "96vw", maxWidth: 1180, maxHeight: "92vh", background: "#ffffff", borderRadius: 6, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Modal Header */}
              <div style={{ height: 46, padding: "0 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                    {isEn ? activeDef.titleEn : activeDef.titleVi}
                  </span>
                  <span style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 4, background: "#e2e8f0", color: "#475569", fontWeight: 600 }}>
                    {activeDef.formCode}
                  </span>
                </div>
                <button type="button" onClick={() => setPreviewReportName(null)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={18} /></button>
              </div>

              {/* Parameter Setup Toolbar (Steps 5–11) */}
              <div style={{ padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#475569", fontWeight: 500 }}>{isEn ? "Period:" : "Kỳ báo cáo:"}</span>
                  <select
                    value={reportPeriodPreset}
                    onChange={(e) => handleSelectReportPeriodPreset(e.target.value)}
                    style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                  >
                    <option value="YEAR_2026">{isEn ? "Full Year 2026" : "Cả năm 2026"}</option>
                    <option value="Q1">{isEn ? "Q1/2026" : "Quý 1/2026"}</option>
                    <option value="Q2">{isEn ? "Q2/2026" : "Quý 2/2026"}</option>
                    <option value="Q3">{isEn ? "Q3/2026" : "Quý 3/2026"}</option>
                    <option value="Q4">{isEn ? "Q4/2026" : "Quý 4/2026"}</option>
                    <option value="M10">{isEn ? "Month 10/2026" : "Tháng 10/2026"}</option>
                    <option value="CUSTOM">{isEn ? "Custom" : "Tùy chọn"}</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#475569" }}>{isEn ? "From:" : "Từ ngày:"}</span>
                  <input
                    type="text"
                    value={reportFromDate}
                    onChange={(e) => {
                      setReportFromDate(e.target.value);
                      setReportPeriodPreset("CUSTOM");
                    }}
                    placeholder="DD/MM/YYYY"
                    style={{ width: 92, height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}
                  />
                  <span style={{ color: "#475569" }}>{isEn ? "To:" : "Đến ngày:"}</span>
                  <input
                    type="text"
                    value={reportToDate}
                    onChange={(e) => {
                      setReportToDate(e.target.value);
                      setReportPeriodPreset("CUSTOM");
                    }}
                    placeholder="DD/MM/YYYY"
                    style={{ width: 92, height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12 }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#475569" }}>{isEn ? "Dept:" : "Đơn vị:"}</span>
                  <select
                    value={reportDeptFilter}
                    onChange={(e) => setReportDeptFilter(e.target.value)}
                    style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                  >
                    <option value="all">{isEn ? "All departments" : "Tất cả đơn vị"}</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {rCode === "ASSET_CARD" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#475569" }}>{isEn ? "Asset:" : "Mã TSCĐ:"}</span>
                    <select
                      value={reportAssetCodeFilter}
                      onChange={(e) => setReportAssetCodeFilter(e.target.value)}
                      style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                    >
                      <option value="all">{isEn ? "All fixed assets" : "Tất cả TSCĐ"}</option>
                      {assetsList.map((a) => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {rCode === "RECONCILE_FA_GL" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#475569" }}>{isEn ? "Account:" : "Tài khoản:"}</span>
                    <select
                      value={reportAccountFilter}
                      onChange={(e) => setReportAccountFilter(e.target.value)}
                      style={{ height: 28, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
                    >
                      <option value="all">{isEn ? "All (211, 213, 214)" : "Tất cả (211, 213, 214)"}</option>
                      <option value="211">TK 211 - TSCĐ hữu hình</option>
                      <option value="214">TK 214 - Hao mòn TSCĐ</option>
                    </select>
                  </div>
                )}

                {(rCode === "RECONCILE_FA_GL" || rCode === "RECONCILE_STOCKTAKE_FA") && (
                  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#334155", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={reportOnlyDifferences}
                      onChange={(e) => setReportOnlyDifferences(e.target.checked)}
                    />
                    <span>{isEn ? "Only show discrepancies" : "Chỉ hiển thị dòng chênh lệch"}</span>
                  </label>
                )}

                {(rCode === "S21_DN" || rCode === "ASSET_REGISTER") && (
                  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#334155", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={reportExcludeDisposed}
                      onChange={(e) => setReportExcludeDisposed(e.target.checked)}
                    />
                    <span>{isEn ? "Exclude disposed in period" : "Không lấy TSCĐ đã ghi giảm"}</span>
                  </label>
                )}

                <button
                  type="button"
                  onClick={handleApplyReportParams}
                  style={{ height: 28, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  {isEn ? "Apply" : "Đồng ý"}
                </button>
              </div>

              {/* Report Body */}
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
                {/* Company & Form Header (Step 16) */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12, color: "#334155" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{_company.name}</div>
                    <div style={{ color: "#64748b" }}>{isEn ? "Department:" : "Đơn vị sử dụng:"} {reportDeptFilter === "all" ? (isEn ? "All departments" : "Tất cả đơn vị") : reportDeptFilter}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{activeDef.formCode}</div>
                    <div style={{ color: "#64748b", fontSize: 11.5 }}>
                      {isEn ? "(Issued under Circular No. 200/2014/TT-BTC)" : "(Ban hành theo Thông tư số 200/2014/TT-BTC của Bộ Tài chính)"}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", marginBottom: 18 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                    {(isEn ? activeDef.titleEn : activeDef.titleVi).toUpperCase()}
                  </h3>
                  <p style={{ fontSize: 12.5, color: "#64748b", margin: "4px 0 0 0" }}>
                    {isEn
                      ? `From ${reportFromDate} to ${reportToDate} - Currency: VND`
                      : `Từ ngày ${reportFromDate} đến ngày ${reportToDate} - Đơn vị tiền tệ: Việt Nam Đồng (VND)`}
                  </p>
                </div>

                {/* Specialized Report Content */}
                {rCode === "S21_DN" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Increase Voucher" : "Số CT ghi tăng"}</th>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Date" : "Ngày tháng"}</th>
                        <th style={{ padding: 7, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Asset Name & Spec" : "Tên, đặc điểm, ký hiệu TSCĐ"}</th>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Origin" : "Nước SX"}</th>
                        <th style={{ padding: 7, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Asset Code" : "Số hiệu TSCĐ"}</th>
                        <th style={{ padding: 7, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Original Cost" : "Nguyên giá TSCĐ"}</th>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Depr. Rate" : "Tỷ lệ KH"}</th>
                        <th style={{ padding: 7, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Annual Depr." : "Mức KH năm"}</th>
                        <th style={{ padding: 7, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Accum. Depr." : "Hao mòn lũy kế"}</th>
                        <th style={{ padding: 7, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Remaining Value" : "Giá trị còn lại"}</th>
                        <th style={{ padding: 7, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Disposal Voucher" : "Số CT ghi giảm"}</th>
                        <th style={{ padding: 7, textAlign: "left" }}>{isEn ? "Disposal Reason" : "Lý do ghi giảm"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportAssets.length === 0 ? (
                        <tr>
                          <td colSpan={13} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>
                            Không có tài sản cố định phù hợp với điều kiện tìm kiếm.
                          </td>
                        </tr>
                      ) : (
                        reportAssets.map((a: any, i: number) => (
                          <tr key={a.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{i + 1}</td>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.voucherNo || `GT-${a.code}`}</td>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.startDate}</td>
                            <td style={{ padding: 7, borderRight: "1px solid #e2e8f0", fontWeight: 500 }}>{a.name}</td>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.countryOfOrigin || "Việt Nam"}</td>
                            <td onClick={() => openAssetDetailModal(a)} style={{ padding: 7, fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline", borderRight: "1px solid #e2e8f0" }}>{a.code}</td>
                            <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.originalCost)}</td>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.rateDisplay}</td>
                            <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.deprYearValue || Math.round((a.originalCost * (a.rateYear || 0)) / 100))}</td>
                            <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.depreciatedAmount)}</td>
                            <td style={{ padding: 7, textAlign: "right", fontWeight: 600, color: "#16a34a", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.remainingAmount)}</td>
                            <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.disposalVoucherNo || "-"}</td>
                            <td style={{ padding: 7 }}>{a.disposalReason || "-"}</td>
                          </tr>
                        ))
                      )}
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{isEn ? "Total:" : "Tổng cộng:"}</td>
                        <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>{formatVND(rTotOrig)}</td>
                        <td style={{ padding: 7, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>-</td>
                        <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>
                          {formatVND(reportAssets.reduce((s, a) => s + Number(a.deprYearValue || Math.round((a.originalCost * (a.rateYear || 0)) / 100)), 0))}
                        </td>
                        <td style={{ padding: 7, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(rTotDepr)}</td>
                        <td style={{ padding: 7, textAlign: "right", color: "#16a34a", borderRight: "1px solid #e2e8f0" }}>{formatVND(rTotRem)}</td>
                        <td colSpan={2} style={{ padding: 7 }}></td>
                      </tr>
                    </tbody>
                  </table>
                ) : rCode === "ASSET_CARD" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {reportAssets.map((a: any) => (
                      <div key={a.code} style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, fontSize: 12.5, background: "#f8fafc", padding: 12, borderRadius: 4 }}>
                          <div><strong>Mã TSCĐ:</strong> <span style={{ color: "#00a862", fontWeight: 700 }}>{a.code}</span></div>
                          <div><strong>Tên TSCĐ:</strong> {a.name}</div>
                          <div><strong>Đơn vị sử dụng:</strong> {a.dept}</div>
                          <div><strong>Loại TSCĐ:</strong> {a.category}</div>
                          <div><strong>Ngày ghi tăng:</strong> {a.startDate} ({a.voucherNo || `GT-${a.code}`})</div>
                          <div><strong>TK Nguyên giá / Hao mòn:</strong> {a.costAccount || "2111"} / {a.deprAccount || "2141"}</div>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                              <th style={{ padding: 6, borderRight: "1px solid #cbd5e1" }}>Số hiệu CT</th>
                              <th style={{ padding: 6, borderRight: "1px solid #cbd5e1" }}>Ngày tháng</th>
                              <th style={{ padding: 6, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải (Ghi tăng / Điều chỉnh / Khấu hao)</th>
                              <th style={{ padding: 6, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                              <th style={{ padding: 6, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                              <th style={{ padding: 6, textAlign: "right" }}>Giá trị còn lại</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: 6, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.voucherNo || `GT-${a.code}`}</td>
                              <td style={{ padding: 6, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.startDate}</td>
                              <td style={{ padding: 6, borderRight: "1px solid #e2e8f0" }}>Ghi tăng TSCĐ và đưa vào sử dụng tại {a.dept}</td>
                              <td style={{ padding: 6, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.originalCost)}</td>
                              <td style={{ padding: 6, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.depreciatedAmount)}</td>
                              <td style={{ padding: 6, textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(a.remainingAmount)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ) : rCode === "ANNUAL_DEPRECIATION_SCHEDULE" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 6, borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                        <th style={{ padding: 6, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên TSCĐ</th>
                        <th style={{ padding: 6, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                          <th key={m} style={{ padding: 5, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>T{m}</th>
                        ))}
                        <th style={{ padding: 6, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Cộng KH năm</th>
                        <th style={{ padding: 6, textAlign: "right" }}>GT còn lại</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportAssets.map((a: any) => {
                        const mAmt = a.noDepr ? 0 : Math.round((a.originalCost * (a.rateMonth || (a.rateYear || 0) / 12)) / 100);
                        const yAmt = mAmt * 12;
                        return (
                          <tr key={a.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: 6, fontWeight: 600, color: "#00a862", borderRight: "1px solid #e2e8f0" }}>{a.code}</td>
                            <td style={{ padding: 6, borderRight: "1px solid #e2e8f0" }}>{a.name}</td>
                            <td style={{ padding: 6, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.originalCost)}</td>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                              <td key={m} style={{ padding: 5, textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{formatVND(mAmt)}</td>
                            ))}
                            <td style={{ padding: 6, textAlign: "right", fontWeight: 600, borderRight: "1px solid #e2e8f0" }}>{formatVND(yAmt)}</td>
                            <td style={{ padding: 6, textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(a.remainingAmount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : rCode === "RECONCILE_FA_GL" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Tài khoản</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Chỉ tiêu đối chiếu</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số dư cuối kỳ Sổ TSCĐ</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Số dư cuối kỳ Sổ cái</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                        <th style={{ padding: 8, textAlign: "center" }}>Trạng thái đối chiếu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { acc: "211", label: "Nguyên giá TSCĐ hữu hình (TK 211)", faVal: rTotOrig, glVal: rTotOrig, diff: 0 },
                        { acc: "214", label: "Hao mòn lũy kế TSCĐ (TK 214)", faVal: rTotDepr, glVal: rTotDepr, diff: 0 },
                      ]
                        .filter((r) => (reportAccountFilter === "all" || r.acc.startsWith(reportAccountFilter)) && (!reportOnlyDifferences || r.diff !== 0))
                        .map((r, idx) => (
                          <tr key={r.acc} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                            <td style={{ padding: 8, textAlign: "center", fontWeight: 700, color: "#0284c7", borderRight: "1px solid #e2e8f0" }}>{r.acc}</td>
                            <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{r.label}</td>
                            <td style={{ padding: 8, textAlign: "right", fontWeight: 600, borderRight: "1px solid #e2e8f0" }}>{formatVND(r.faVal)}</td>
                            <td style={{ padding: 8, textAlign: "right", fontWeight: 600, borderRight: "1px solid #e2e8f0" }}>{formatVND(r.glVal)}</td>
                            <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: r.diff === 0 ? "#16a34a" : "#dc2626", borderRight: "1px solid #e2e8f0" }}>{formatVND(r.diff)}</td>
                            <td style={{ padding: 8, textAlign: "center" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 10, background: r.diff === 0 ? "#dcfce7" : "#fee2e2", color: r.diff === 0 ? "#166534" : "#b91c1c", fontSize: 11.5, fontWeight: 600 }}>
                                {r.diff === 0 ? "Khớp đúng" : "Có chênh lệch"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : rCode === "RECONCILE_STOCKTAKE_FA" ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>STT</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị theo sổ</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị thực tế</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>SL sổ sách</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>SL thực tế</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kết quả đối chiếu</th>
                        <th style={{ padding: 8, textAlign: "left" }}>Kiến nghị xử lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportAssets.map((a: any, idx: number) => (
                        <tr key={a.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{idx + 1}</td>
                          <td style={{ padding: 8, fontWeight: 600, color: "#00a862", borderRight: "1px solid #e2e8f0" }}>{a.code}</td>
                          <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.name}</td>
                          <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.dept}</td>
                          <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.dept}</td>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>1</td>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>1</td>
                          <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.remainingAmount)}</td>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 600 }}>Khớp</span>
                          </td>
                          <td style={{ padding: 8, color: "#475569" }}>Tiếp tục sử dụng</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Asset Code" : "Mã TSCĐ"}</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Asset Name" : "Tên tài sản cố định"}</th>
                        <th style={{ padding: 8, textAlign: "left", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Department" : "Đơn vị sử dụng"}</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Cost Account" : "TK NG"}</th>
                        <th style={{ padding: 8, textAlign: "center", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Depr. Rate" : "Tỷ lệ KH"}</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Original Cost" : "Nguyên giá"}</th>
                        <th style={{ padding: 8, textAlign: "right", borderRight: "1px solid #cbd5e1" }}>{isEn ? "Accum. Depr." : "Hao mòn lũy kế"}</th>
                        <th style={{ padding: 8, textAlign: "right" }}>{isEn ? "Remaining Value" : "Giá trị còn lại"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportAssets.map((a: any, i: number) => (
                        <tr key={a.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{i + 1}</td>
                          <td onClick={() => openAssetDetailModal(a)} style={{ padding: 8, fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline", borderRight: "1px solid #e2e8f0" }}>{a.code}</td>
                          <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.name}</td>
                          <td style={{ padding: 8, borderRight: "1px solid #e2e8f0" }}>{a.dept}</td>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0", color: "#0284c7", fontWeight: 600 }}>{a.costAccount || "2111"}</td>
                          <td style={{ padding: 8, textAlign: "center", borderRight: "1px solid #e2e8f0" }}>{a.rateDisplay}</td>
                          <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.originalCost)}</td>
                          <td style={{ padding: 8, textAlign: "right", color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{formatVND(a.depreciatedAmount)}</td>
                          <td style={{ padding: 8, textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(a.remainingAmount)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{isEn ? "Total:" : "Tổng cộng:"}</td>
                        <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0", color: "#00a862" }}>{formatVND(rTotOrig)}</td>
                        <td style={{ padding: 8, textAlign: "right", borderRight: "1px solid #e2e8f0" }}>{formatVND(rTotDepr)}</td>
                        <td style={{ padding: 8, textAlign: "right", color: "#16a34a" }}>{formatVND(rTotRem)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}

                {/* Report Signatures Block (Steps 16 & 23) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 28, textAlign: "center", fontSize: 12.5, color: "#334155" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{isEn ? "Prepared by" : "Người lập biểu"}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>{isEn ? "(Sign, full name)" : "(Ký, họ tên)"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{isEn ? "Chief Accountant" : "Kế toán trưởng"}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>{isEn ? "(Sign, full name)" : "(Ký, họ tên)"}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{isEn ? "General Director" : "Giám đốc / Tổng giám đốc"}</div>
                    <div style={{ fontSize: 11.5, color: "#64748b", fontStyle: "italic" }}>{isEn ? "(Sign, full name, stamp)" : "(Ký, họ tên, đóng dấu)"}</div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Steps 22–24) */}
              <div style={{ height: 48, background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {isEn ? `Total records: ${reportAssets.length}` : `Số lượng bản ghi: ${reportAssets.length} tài sản`}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handlePrintCurrentReport}
                    style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Printer size={14} style={{ color: "#0284c7" }} />
                    <span>{isEn ? "Print" : "In báo cáo"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCurrentReportExcel}
                    style={{ height: 32, padding: "0 16px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12.5, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <FileSpreadsheet size={14} style={{ color: "#16a34a" }} />
                    <span>{isEn ? "Export Excel" : "Xuất Excel"}</span>
                  </button>
                  <button type="button" onClick={() => setPreviewReportName(null)} style={{ height: 32, padding: "0 20px", background: "#00a862", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: "#ffffff", cursor: "pointer" }}>
                    {isEn ? "Close" : "Đóng"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 9. MODAL TÌM KIẾM NHANH BÁO CÁO VỚI AVA KẾ TOÁN (AF12) */}
      {showAvaReportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", display: "grid", placeItems: "center", zIndex: 1060, padding: 10 }}>
          <div style={{ width: 560, background: "#ffffff", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ height: 44, padding: "0 18px", background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5 }}>
                <Sparkles size={15} />
                <span>AVA Kế toán – Tìm kiếm nhanh báo cáo TSCĐ</span>
              </div>
              <button type="button" onClick={() => setShowAvaReportModal(false)} style={{ border: "none", background: "transparent", color: "#ffffff", cursor: "pointer" }}><X size={17} /></button>
            </div>
            <div style={{ padding: 18 }}>
              <input
                type="text"
                value={avaReportQuery}
                onChange={(e) => setAvaReportQuery(e.target.value)}
                placeholder="Nhập nhu cầu báo cáo (VD: sổ tài sản S21, thẻ tài sản, khấu hao năm, đối chiếu sổ cái...)"
                style={{ width: "100%", height: 34, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, marginBottom: 14, boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600 }}>Báo cáo gợi ý phù hợp:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {UC09_REPORT_CATALOG.filter((r) => {
                  const q = avaReportQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    r.titleVi.toLowerCase().includes(q) ||
                    r.titleEn.toLowerCase().includes(q) ||
                    r.keywords.some((kw) => kw.includes(q) || q.includes(kw))
                  );
                }).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setShowAvaReportModal(false);
                      handleOpenReportByDef(r);
                    }}
                    style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#f8fafc" }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{reportLang === "en" ? r.titleEn : r.titleVi}</div>
                      <div style={{ fontSize: 11.5, color: "#64748b" }}>{r.formCode}</div>
                    </div>
                    <ChevronRight size={15} style={{ color: "#7c3aed" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL ẨN / HIỆN BÁO CÁO (AF14) */}
      {showHideReportsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)", display: "grid", placeItems: "center", zIndex: 1060, padding: 10 }}>
          <div style={{ width: 500, background: "#ffffff", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ height: 44, padding: "0 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>Tùy chọn ẩn / hiện báo cáo</span>
              <button type="button" onClick={() => setShowHideReportsModal(false)} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={17} /></button>
            </div>
            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              {UC09_REPORT_CATALOG.map((r) => {
                const isVisible = !hiddenReportIds.includes(r.id);
                return (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer" }}>
                    <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>{reportLang === "en" ? r.titleEn : r.titleVi}</span>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setHiddenReportIds((prev) => prev.filter((id) => id !== r.id));
                        } else {
                          setHiddenReportIds((prev) => [...prev, r.id]);
                        }
                      }}
                    />
                  </label>
                );
              })}
            </div>
            <div style={{ height: 46, padding: "0 18px", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setHiddenReportIds([]);
                  notify("Đã khôi phục hiển thị tất cả báo cáo.");
                }}
                style={{ height: 30, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, cursor: "pointer" }}
              >
                Mặc định
              </button>
              <button
                type="button"
                onClick={() => {
                  if (apiConnected) {
                    void apiSave(async (writer) => {
                      await fetchFixedAssetReportCatalog(writer, { hiddenReportCodes: hiddenReportIds });
                      return { message: "" };
                    });
                  }
                  setShowHideReportsModal(false);
                  notify("Đã lưu cấu hình ẩn/hiện báo cáo tài sản cố định.");
                }}
                style={{ height: 30, padding: "0 16px", border: "none", borderRadius: 4, background: "#00a862", color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
              >
                Lưu thiết lập
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // =========================================================================
  // 1. TAB: QUY TRÌNH (ẢNH BAN ĐẦU CỦA NGƯỜI DÙNG)
  // =========================================================================
  if (tab === "process") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        <div style={{ flex: 1, padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, overflowY: "auto" }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "24px 28px",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: "center",
                  margin: 0,
                  padding: "4px 10px 14px 10px",
                  borderBottom: "1px solid #f1f5f9",
                  color: "#1e293b",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                NGHIỆP VỤ TÀI SẢN CỐ ĐỊNH
              </h2>
            </div>

            <div style={{ position: "relative", width: "100%", minHeight: 330, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  position: "absolute",
                  left: 100,
                  right: 30,
                  top: "50%",
                  height: 2,
                  background: "#cbd5e1",
                  transform: "translateY(-50%)",
                  zIndex: 1,
                }}
              >
                <div style={{ position: "absolute", right: -4, top: -5, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "8px solid #94a3b8" }} />
              </div>

              {/* NODE 1: GHI TĂNG */}
              <div
                onClick={openNewIncreaseModal}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span className="ref-business-icon increase" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>GT</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Ghi tăng</span>
              </div>

              {/* HÀNG TRÊN: Điều chuyển | Tính khấu hao | Chuyển TS thuê TC */}
              <div
                onClick={() => navigateTo("transfer")}
                style={{ position: "absolute", left: "28%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <span className="ref-business-icon transfer" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>ĐC</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <ArrowRightLeft size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Điều chuyển</span>
                <div style={{ position: "absolute", top: 48, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              <div
                onClick={() => setShowDeprModal(true)}
                style={{ position: "absolute", left: "52%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <span className="ref-business-icon calc" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>KH</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <Calculator size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Tính khấu hao</span>
                <div style={{ position: "absolute", top: 48, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              <div
                onClick={() => notify("Nghiệp vụ: Chuyển tài sản thuê tài chính thành tài sản sở hữu")}
                style={{ position: "absolute", left: "76%", top: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", maxWidth: 140, textAlign: "center" }}
              >
                <span className="ref-business-icon lease" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>TC</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <RotateCw size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", lineHeight: 1.3, textAlign: "center" }}>Chuyển TS thuê tài chính thành TS sở hữu</span>
                <div style={{ position: "absolute", top: 48, bottom: -70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
              </div>

              {/* HÀNG DƯỚI: Đánh giá lại | Ghi giảm | Kiểm kê tài sản */}
              <div
                onClick={() => navigateTo("revaluation")}
                style={{ position: "absolute", left: "40%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", textAlign: "center" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <span className="ref-business-icon reval" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>ĐG</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <Sparkles size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Đánh giá<br />lại tài sản</span>
              </div>

              <div
                onClick={() => navigateTo("decrease")}
                style={{ position: "absolute", left: "58%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <span className="ref-business-icon decrease" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>GG</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#ea580c", borderColor: "#f97316" }}
                  >
                    <MinusCircle size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Ghi giảm</span>
              </div>

              <div
                onClick={() => navigateTo("stocktake")}
                style={{ position: "absolute", left: "82%", bottom: 24, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
              >
                <div style={{ position: "absolute", top: -70, height: 70, width: 1.5, background: "#cbd5e1", zIndex: -1 }} />
                <span className="ref-business-icon audit" style={{ marginBottom: 6 }}>
                  <span
                    className="ref-document-sheet"
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      border: "1px solid #34d399",
                    }}
                  >
                    <b style={{ color: "#ffffff", fontWeight: 800 }}>KK</b>
                    <i /><i /><i />
                  </span>
                  <span
                    className="ref-gold-icon"
                    style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                  >
                    <ClipboardList size={14} strokeWidth={2.2} />
                  </span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: "#334155", textAlign: "center" }}>Kiểm kê tài sản</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f1f5f9", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", textAlign: "center" }}>
              <div onClick={() => notify("Danh mục: Cơ cấu tổ chức và phòng ban quản lý tài sản")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0", borderRight: "1px solid #e2e8f0" }}>
                <GitBranch size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Cơ cấu tổ chức</span>
              </div>
              <div onClick={() => notify("Danh mục: Loại tài sản cố định chuẩn quy định kế toán")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0", borderRight: "1px solid #e2e8f0" }}>
                <Car size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Loại tài sản</span>
              </div>
              <div onClick={() => setShowOpeningModal(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", padding: "6px 0" }}>
                <Lightbulb size={16} style={{ color: "#00a862" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Tiện ích</span>
              </div>
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px 20px" }}>
            <div>
              <div style={{ textAlign: "center", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b", letterSpacing: 0.3 }}>BÁO CÁO</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  "S21 - DN: Sổ tài sản cố định",
                  "Bảng tính khấu hao tài sản cố định theo năm",
                  "Báo cáo đối chiếu sổ tài sản và sổ cái",
                  "Sổ tài sản cố định",
                  "Thẻ tài sản cố định",
                ].map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setPreviewReportName(item)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer", lineHeight: 1.45, transition: "color 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
                  >
                    <span style={{ color: "#94a3b8", fontSize: 14, lineHeight: "16px" }}>•</span>
                    <span style={{ fontWeight: 500 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", marginTop: 24, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
              <span onClick={() => navigateTo("reports")} style={{ fontSize: 13, color: "#0284c7", fontWeight: 600, cursor: "pointer" }}>
                Tất cả báo cáo
              </span>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 2. TAB: SỔ TÀI SẢN (register)
  // =========================================================================
  if (tab === "register") {
    if (registerView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderMisaEmptyIllustration()}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 660, lineHeight: 1.45 }}>
              Quản lý tất cả các tài sản cố định đang sử dụng và tình hình khấu hao của từng tài sản
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOpeningModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                Khai báo TSCĐ đầu kỳ
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setRegisterView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f8fafc" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowOpeningModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <RotateCw size={13} />
              <span>Khai báo TSCĐ đầu kỳ</span>
            </button>
            <button
              type="button"
              onClick={openNewIncreaseModal}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <Plus size={14} />
              <span>Ghi tăng TSCĐ</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 10px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
            <div style={{ position: "relative", width: 200 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={searchRegister}
                onChange={(e) => {
                  setSearchRegister(e.target.value);
                  setRegisterCurrentPage(1);
                }}
                placeholder="Tìm mã, tên tài sản..."
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value);
                setRegisterCurrentPage(1);
              }}
              style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
            >
              <option value="all">Tất cả đơn vị sử dụng</option>
              {departmentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={registerCategoryFilter}
              onChange={(e) => {
                setRegisterCategoryFilter(e.target.value);
                setRegisterCurrentPage(1);
              }}
              style={{ height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
            >
              <option value="all">Tất cả loại tài sản</option>
              {categoryOptions.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {/* Step 4 & AF05: Ngày xem số liệu */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#334155" }}>
              <span>Ngày xem:</span>
              <input
                type="text"
                value={registerAsOfDate}
                onChange={(e) => {
                  setRegisterAsOfDate(e.target.value);
                  setRegisterCurrentPage(1);
                }}
                placeholder="DD/MM/YYYY"
                title="Chọn ngày xem số liệu (mặc định ngày hiện tại hoặc tra cứu quá khứ)"
                style={{ width: 92, height: 30, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
            {/* AF06: Bao gồm TSCĐ đã ghi giảm */}
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#334155", cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={registerIncludeDisposed}
                onChange={(e) => {
                  setRegisterIncludeDisposed(e.target.checked);
                  setRegisterCurrentPage(1);
                }}
              />
              <span>Bao gồm TSCĐ đã ghi giảm</span>
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRegisterView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={handleExportRegisterExcel}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Loại tài sản</th>
                <th style={{ width: 170, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày ghi tăng</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Hao mòn lũy kế</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                <th style={{ width: 90, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Tỷ lệ KH</th>
                <th style={{ width: 80, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>TK NG</th>
                <th style={{ width: 125, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái TS</th>
                <th style={{ width: 165, padding: "8px", textAlign: "center" }}>Đối chiếu kế toán</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: "28px 16px", textAlign: "center", color: "#64748b", background: "#f8fafc", fontSize: 13 }}>
                    Không có tài sản cố định phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                paginatedRegisterAssets.map((row, idx) => {
                  const assetStatus = (row as any).statusDisplay || "Đang sử dụng";
                  const reconStatus = (row as any).reconciliationStatus || "Đã đối chiếu";
                  const globalIdx = (safeRegisterPage - 1) * registerPageSize + idx + 1;
                  return (
                  <tr key={row.code} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{globalIdx}</td>
                    <td
                      onClick={() => openAssetDetailModal(row)}
                      title="Nhấn để xem chi tiết / cập nhật thông tin TSCĐ (UC-FA-02)"
                      style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {row.code}
                    </td>
                    <td
                      onClick={() => openAssetDetailModal(row)}
                      title="Nhấn để xem chi tiết / cập nhật thông tin TSCĐ (UC-FA-02)"
                      style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b", cursor: "pointer" }}
                    >
                      {row.name}
                    </td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.category}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{row.dept}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{row.startDate}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600 }}>{formatVND(row.originalCost)}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", color: "#64748b" }}>{formatVND(row.depreciatedAmount)}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>{formatVND(row.remainingAmount)}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>{(row as any).rateDisplay || `${row.rateYear}%`}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#0284c7", fontWeight: 600 }}>{row.costAccount}</td>
                    <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 10, background: assetStatus === "Đang sử dụng" ? "#dcfce7" : "#f1f5f9", color: assetStatus === "Đang sử dụng" ? "#166534" : "#475569", fontSize: 11.5, fontWeight: 500 }}>
                        {assetStatus}
                      </span>
                    </td>
                    <td style={{ padding: "8px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: reconStatus === "Đã đối chiếu" ? "#e0f2fe" : reconStatus === "Có chênh lệch" ? "#fee2e2" : "#fef3c7",
                          color: reconStatus === "Đã đối chiếu" ? "#0369a1" : reconStatus === "Có chênh lệch" ? "#b91c1c" : "#92400e",
                          fontSize: 11.5,
                          fontWeight: 500,
                        }}
                      >
                        {reconStatus}
                      </span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Pagination (Steps 19–22 & AF07) */}
        <div style={{ height: 40, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span>Số lượng tài sản: {filteredAssets.length}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, fontSize: 12, color: "#475569" }}>
              <span>Hiển thị:</span>
              <select
                value={registerPageSize}
                onChange={(e) => {
                  setRegisterPageSize(Number(e.target.value));
                  setRegisterCurrentPage(1);
                }}
                style={{ height: 24, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, background: "#ffffff" }}
              >
                <option value={20}>20 dòng/trang</option>
                <option value={50}>50 dòng/trang</option>
                <option value={100}>100 dòng/trang</option>
              </select>
              <span>Trang {safeRegisterPage}/{registerTotalPages}</span>
              <button
                type="button"
                disabled={safeRegisterPage <= 1}
                onClick={() => setRegisterCurrentPage((p) => Math.max(1, p - 1))}
                style={{ height: 24, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: safeRegisterPage <= 1 ? "not-allowed" : "pointer", fontSize: 11.5 }}
              >
                Trước
              </button>
              <button
                type="button"
                disabled={safeRegisterPage >= registerTotalPages}
                onClick={() => setRegisterCurrentPage((p) => Math.min(registerTotalPages, p + 1))}
                style={{ height: 24, padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", cursor: safeRegisterPage >= registerTotalPages ? "not-allowed" : "pointer", fontSize: 11.5 }}
              >
                Sau
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <span>Tổng nguyên giá: <strong style={{ color: "#00a862" }}>{formatVND(totalOriginalCost)}</strong></span>
            <span>Tổng hao mòn: <strong>{formatVND(totalDepreciated)}</strong></span>
            <span>Tổng còn lại: <strong style={{ color: "#16a34a" }}>{formatVND(totalRemaining)}</strong></span>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 3. TAB: GHI TĂNG (increase) - ẢNH MỚI 1 & ẢNH MỚI 2
  // =========================================================================
  if (tab === "increase") {
    // VIEW 1: INTRO LANDING SCREEN (ẢNH MỚI 1 CỦA NGƯỜI DÙNG)
    if (increaseView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderIncreaseIllustration()}

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 660, lineHeight: 1.45 }}>
              Khi mua TSCĐ về sử dụng ngay, bạn cần ghi tăng TSCĐ vào sổ tài sản để theo dõi và tính khấu hao hàng tháng
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={openNewIncreaseModal}
                style={{
                  height: 34,
                  padding: "0 22px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                Thêm
              </button>
              <button
                type="button"
                onClick={() => notify("Tiện ích: Nhập khẩu chứng từ ghi tăng TSCĐ từ file Excel")}
                style={{
                  height: 34,
                  padding: "0 18px",
                  borderRadius: 6,
                  background: "#ffffff",
                  color: "#1e293b",
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.borderColor = "#94a3b8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#cbd5e1";
                }}
              >
                Nhập từ Excel
              </button>
            </div>
          </div>

          {/* Bottom Button: Xem danh sách chứng từ */}
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setIncreaseView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>

          {renderModals()}
        </div>
      );
    }

    // VIEW 2: DATA TABLE VIEW
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={openNewIncreaseModal}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm chứng từ ghi tăng</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
            <button
              type="button"
              onClick={() => notify("Nhập khẩu chứng từ ghi tăng từ Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#1e293b", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer" }}
            >
              Nhập từ Excel
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setIncreaseView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ ghi tăng ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã TSCĐ</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản cố định</th>
                <th style={{ width: 150, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 160, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đơn vị sử dụng</th>
                <th style={{ width: 125, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái TS</th>
                <th style={{ width: 165, padding: "8px", textAlign: "center" }}>Đối chiếu kế toán</th>
              </tr>
            </thead>
            <tbody>
              {increaseVouchers.map((a, idx) => {
                const reconStatus = (a as any).reconciliationStatus || "Chưa đối chiếu hạch toán";
                return (
                <tr key={a.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{idx + 1}</td>
                  <td
                    onClick={() => openAssetDetailModal(a.assetCode)}
                    title="Nhấn để mở chi tiết tài sản từ chứng từ ghi tăng (AF03)"
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {a.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{a.date}</td>
                  <td
                    onClick={() => openAssetDetailModal(a.assetCode)}
                    title="Nhấn để mở chi tiết tài sản (AF03)"
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {a.assetCode}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{a.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(a.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{a.dept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {(() => {
                        const record = apiConnected ? apiRows.transactions?.find((row) => row.id === (a as any).id) : undefined;
                        return record ? <MisaApiDocumentStatus path="/api/v1/fixed-assets/transactions/" record={record}
                          companyId={_company.id} notify={notify} onChanged={reloadApi} /> : a.status;
                      })()}
                    </span>
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: reconStatus === "Đã đối chiếu" ? "#e0f2fe" : reconStatus === "Có chênh lệch" ? "#fee2e2" : "#fef3c7",
                        color: reconStatus === "Đã đối chiếu" ? "#0369a1" : reconStatus === "Có chênh lệch" ? "#b91c1c" : "#92400e",
                        fontSize: 11.5,
                        fontWeight: 500,
                      }}
                    >
                      {reconStatus}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: TÍNH KHẤU HAO (depreciation) - ẢNH MỚI 1 & ẢNH MỚI 2
  // =========================================================================
  if (tab === "depreciation") {
    // VIEW 1: INTRO LANDING SCREEN (ẢNH MỚI 1 CỦA NGƯỜI DÙNG)
    if (deprView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderDepreciationIllustration()}

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 680, lineHeight: 1.45 }}>
              Lập chứng từ tính và phân bổ chi phí khấu hao cho từng đối tượng sử dụng
            </h2>

            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{
                  height: 34,
                  padding: "0 20px",
                  borderRadius: 6,
                  background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeprModal(true)}
                style={{
                  height: 34,
                  padding: "0 24px",
                  borderRadius: 6,
                  background: "#00a862",
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(0, 168, 98, 0.25)",
                }}
              >
                Thêm
              </button>
            </div>
          </div>

          {/* Bottom Button: Xem danh sách chứng từ */}
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setDeprView("table")}
              style={{
                height: 32,
                padding: "0 22px",
                borderRadius: 4,
                background: "#ffffff",
                color: "#00a862",
                border: "1px solid #00a862",
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Xem danh sách chứng từ
            </button>
          </div>

          {renderModals()}
        </div>
      );
    }

    // VIEW 2: DATA TABLE VIEW
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowDeprModal(true)}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm chứng từ khấu hao</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setDeprView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ trích khấu hao ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Kỳ khấu hao</th>
                <th style={{ minWidth: 320, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Diễn giải</th>
                <th style={{ width: 160, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Tổng tiền khấu hao</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Trạng thái</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Chức năng</th>
              </tr>
            </thead>
            <tbody>
              {deprVouchers.map((v, i) => (
                <tr
                  key={v.voucherNo}
                  onClick={() => {
                    const vMonth = Number(v.month || String(v.period || "").replace(/\D+/g, "").slice(0, 2) || 8);
                    const vYear = Number(v.year || String(v.period || "").slice(-4) || 2026);
                    setDeprCurrentRunId(v.id || null);
                    setDeprVoucherNo(v.voucherNo);
                    setDeprVoucherDate(v.date);
                    setDeprPostingDate(v.postingDate || v.date);
                    setDeprReason(v.reason);
                    setDeprReference(v.reference || "");
                    setDeprVoucherMonth(vMonth);
                    setDeprVoucherYear(vYear);
                    setDeprVoucherStatus(
                      v.status === "Đã ghi sổ" || v.status === "Chưa ghi sổ" || v.status === "Đã hủy"
                        ? v.status
                        : "Đã ghi sổ"
                    );
                    if (Array.isArray(v.lines) && v.lines.length > 0) {
                      setDeprLines(v.lines);
                      setDeprAllocationRows(v.allocations || []);
                      setDeprAccountingRows(v.accountingEntries || []);
                    } else {
                      const fallback = computePeriodDepreciationData(vMonth, vYear, false);
                      setDeprLines(fallback.lines);
                      setDeprAllocationRows(fallback.allocations);
                      setDeprAccountingRows(fallback.accountingEntries);
                    }
                    setDeprAttachments(v.attachments || []);
                    setDeprIsDirty(false);
                    setDeprActiveTab("depreciation");
                    setShowDeprVoucherModal(true);
                  }}
                  style={{ borderBottom: "1px solid #e2e8f0", cursor: "pointer" }}
                >
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862" }}>{v.voucherNo}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 500 }}>{v.period}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(v.amount)}</td>
                  <td style={{ padding: "8px", textAlign: "center", borderRight: "1px solid #e2e8f0" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: v.status === "Chưa ghi sổ" ? "#fef9c3" : v.status === "Đã hủy" ? "#fee2e2" : "#dcfce7",
                        color: v.status === "Chưa ghi sổ" ? "#854d0e" : v.status === "Đã hủy" ? "#991b1b" : "#166534",
                        fontSize: 11.5,
                        fontWeight: 500,
                      }}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td
                    style={{ padding: "6px 8px", textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {v.status === "Chưa ghi sổ" ? (
                      <button
                        type="button"
                        onClick={() => handlePostDeprVoucher({ targetVoucher: v })}
                        style={{
                          height: 24,
                          padding: "0 10px",
                          background: "#00a862",
                          border: "none",
                          borderRadius: 4,
                          color: "#ffffff",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Ghi sổ
                      </button>
                    ) : (
                      <span
                        onClick={() => {
                          const vMonth = Number(v.month || String(v.period || "").replace(/\D+/g, "").slice(0, 2) || 8);
                          const vYear = Number(v.year || String(v.period || "").slice(-4) || 2026);
                          setDeprCurrentRunId(v.id || null);
                          setDeprVoucherNo(v.voucherNo);
                          setDeprVoucherDate(v.date);
                          setDeprPostingDate(v.postingDate || v.date);
                          setDeprReason(v.reason);
                          setDeprReference(v.reference || "");
                          setDeprVoucherMonth(vMonth);
                          setDeprVoucherYear(vYear);
                          setDeprVoucherStatus(v.status);
                          if (Array.isArray(v.lines) && v.lines.length > 0) {
                            setDeprLines(v.lines);
                            setDeprAllocationRows(v.allocations || []);
                            setDeprAccountingRows(v.accountingEntries || []);
                          } else {
                            const fallback = computePeriodDepreciationData(vMonth, vYear, false);
                            setDeprLines(fallback.lines);
                            setDeprAllocationRows(fallback.allocations);
                            setDeprAccountingRows(fallback.accountingEntries);
                          }
                          setDeprAttachments(v.attachments || []);
                          setDeprIsDirty(false);
                          setDeprActiveTab("depreciation");
                          setShowDeprVoucherModal(true);
                        }}
                        style={{ color: "#0284c7", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                      >
                        Xem
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {deprVouchers.length}</span>
          <span>Tổng tiền trích khấu hao: <strong style={{ color: "#00a862" }}>{formatVND(deprVouchers.reduce((s, v) => s + v.amount, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 5. TAB: ĐÁNH GIÁ LẠI (revaluation)
  // =========================================================================
  if (tab === "revaluation") {
    if (revalView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderRevalIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Điều chỉnh giá trị khấu hao, hao mòn lũy kế, thời gian sử dụng TSCĐ sau khi thực hiện đánh giá lại TSCĐ hoặc nâng cấp TSCĐ
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={openNewReval}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setRevalView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={openNewReval}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm đánh giá lại</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setRevalView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ đánh giá lại TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do đánh giá lại</th>
                <th style={{ width: 160, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Chênh lệch giá trị</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {revalVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      if (apiConnected && (v as any).id) { openRevalRecord((v as any).id); return; }
                      setRevalVoucherNo(v.voucherNo);
                      setShowRevalModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: v.diffAmount >= 0 ? "#16a34a" : "#ef4444" }}>
                    {v.diffAmount >= 0 ? `+${formatVND(v.diffAmount)}` : formatVND(v.diffAmount)}
                  </td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {revalVouchers.length}</span>
          <span>Tổng tiền chênh lệch: <strong style={{ color: "#00a862" }}>{formatVND(revalVouchers.reduce((s, v) => s + v.diffAmount, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 6. TAB: ĐIỀU CHUYỂN (transfer)
  // =========================================================================
  if (tab === "transfer") {
    if (transferView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderTransferIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Lập chứng từ để ghi nhận vào sổ TSCĐ việc điều chuyển TSCĐ từ đơn vị sử dụng này sang đơn vị sử dụng khác
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={handleOpenNewTransferModal}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setTransferView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleOpenNewTransferModal}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm điều chuyển</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setTransferView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ điều chuyển TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 200, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Từ đơn vị</th>
                <th style={{ width: 150, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Đến đơn vị</th>
                <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do điều chuyển</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {transferVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setTransferVoucherNo(v.voucherNo);
                      setShowTransferModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.fromDept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#00a862", fontWeight: 500 }}>{v.toDept}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.reason}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {(() => {
                        const record = apiConnected ? apiRows.transactions?.find((row) => row.id === (v as any).id) : undefined;
                        return record ? <MisaApiDocumentStatus path="/api/v1/fixed-assets/transactions/" record={record}
                          companyId={_company.id} notify={notify} onChanged={reloadApi} /> : v.status;
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {transferVouchers.length}</span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 7. TAB: GHI GIẢM (decrease)
  // =========================================================================
  if (tab === "decrease") {
    if (decreaseView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderDecreaseIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Ghi giảm TSCĐ trên sổ TSCĐ khi thanh lý TSCĐ hoặc chuyển TSCĐ thành CCDC hoặc báo mất TSCĐ
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={handleOpenNewDecreaseModal}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setDecreaseView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleOpenNewDecreaseModal}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm ghi giảm</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setDecreaseView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách chứng từ ghi giảm TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 120, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số chứng từ</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày chứng từ</th>
                <th style={{ minWidth: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Lý do ghi giảm</th>
                <th style={{ width: 110, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mã tài sản</th>
                <th style={{ width: 220, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Tên tài sản</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Nguyên giá</th>
                <th style={{ width: 140, padding: "8px", textAlign: "right", borderRight: "1px solid #cbd5e1" }}>Giá trị còn lại</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {decVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setDecVoucherNo(v.voucherNo);
                      setShowDecreaseModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.reason}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 500, color: "#1e293b" }}>{v.assetCode}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.assetName}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#00a862" }}>{formatVND(v.originalCost)}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "right", fontWeight: 600, color: "#ef4444" }}>{formatVND(v.remainingValue)}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {(() => {
                        const record = apiConnected ? apiRows.transactions?.find((row) => row.id === (v as any).id) : undefined;
                        return record ? <MisaApiDocumentStatus path="/api/v1/fixed-assets/transactions/" record={record}
                          companyId={_company.id} notify={notify} onChanged={reloadApi} /> : v.status;
                      })()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng chứng từ: {decVouchers.length}</span>
          <span>Tổng nguyên giá ghi giảm: <strong style={{ color: "#00a862" }}>{formatVND(decVouchers.reduce((s, v) => s + v.originalCost, 0))}</strong></span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 8. TAB: KIỂM KÊ (stocktake)
  // =========================================================================
  if (tab === "stocktake") {
    if (stocktakeView === "intro") {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff", position: "relative" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", textAlign: "center" }}>
            {renderStocktakeIllustration()}
            <h2 style={{ fontSize: 15.5, fontWeight: 700, color: "#1e293b", margin: "0 0 22px 0", maxWidth: 720, lineHeight: 1.45 }}>
              Lập biên bản kiểm kê TSCĐ để ghi nhận kết quả kiểm kê TSCĐ định kỳ và xử lý chênh lệch từ kiểm kê
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                style={{ height: 34, padding: "0 20px", borderRadius: 6, background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}
              >
                <Sparkles size={14} />
                <span>Thêm bằng AI</span>
              </button>
              <button
                type="button"
                onClick={handleOpenNewStocktake}
                style={{ height: 34, padding: "0 22px", borderRadius: 6, background: "#00a862", color: "#ffffff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Thêm
              </button>
            </div>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={() => setStocktakeView("table")}
              style={{ height: 32, padding: "0 22px", borderRadius: 4, background: "#ffffff", color: "#00a862", border: "1px solid #00a862", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}
            >
              Xem danh sách chứng từ
            </button>
          </div>
          {renderModals()}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={handleOpenNewStocktake}
              style={{ height: 30, padding: "0 16px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={14} />
              <span>Thêm kiểm kê</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              style={{ height: 30, padding: "0 12px", background: "linear-gradient(135deg, #2563eb, #7c3aed)", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Sparkles size={13} />
              <span>Thêm bằng AI</span>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setStocktakeView("intro")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", cursor: "pointer" }}
            >
              Màn hình giới thiệu
            </button>
            <button
              type="button"
              onClick={() => notify("Đang xuất khẩu danh sách biên bản kiểm kê TSCĐ ra Excel...")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} />
              <span>Xuất khẩu</span>
            </button>
          </div>
        </div>

        {/* Table View */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#e6ebe6", borderBottom: "1px solid #cbd5e1", color: "#1e293b", fontWeight: 600 }}>
                <th style={{ width: 36, padding: "8px 6px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>#</th>
                <th style={{ width: 140, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Số biên bản</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Ngày kiểm kê</th>
                <th style={{ minWidth: 240, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Mục đích kiểm kê</th>
                <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Tổng số TSCĐ</th>
                <th style={{ width: 120, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Số lượng khớp</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center", borderRight: "1px solid #cbd5e1" }}>Chênh lệch</th>
                <th style={{ minWidth: 260, padding: "8px", textAlign: "left", borderRight: "1px solid #cbd5e1" }}>Kết luận kiểm kê</th>
                <th style={{ width: 110, padding: "8px", textAlign: "center" }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {stocktakeVouchers.map((v, i) => (
                <tr key={v.voucherNo} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ textAlign: "center", padding: "8px 4px", borderRight: "1px solid #e2e8f0", color: "#64748b" }}>{i + 1}</td>
                  <td
                    onClick={() => {
                      setStocktakeVoucherNo(v.voucherNo);
                      setStocktakeDate(v.date);
                      if ((v as any).auditDate) setStocktakeAuditDate((v as any).auditDate);
                      if (v.purpose) setStocktakePurpose(v.purpose);
                      if (v.conclusion) setStocktakeConclusion(v.conclusion);
                      setShowStocktakeModal(true);
                    }}
                    style={{ padding: "8px", borderRight: "1px solid #e2e8f0", fontWeight: 600, color: "#00a862", cursor: "pointer", textDecoration: "underline" }}
                  >
                    {v.voucherNo}
                  </td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#64748b" }}>{v.date}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#1e293b" }}>{v.purpose}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", fontWeight: 600 }}>{v.totalAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{v.matchedAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", textAlign: "center", color: v.diffAssets > 0 ? "#ef4444" : "#64748b", fontWeight: 600 }}>{v.diffAssets}</td>
                  <td style={{ padding: "8px", borderRight: "1px solid #e2e8f0", color: "#475569" }}>{v.conclusion}</td>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
          <span>Số lượng biên bản kiểm kê: {stocktakeVouchers.length}</span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 9. TAB: BÁO CÁO (reports - UC-FA-09 Main Flow B Steps 1–24, AF09–AF16)
  // =========================================================================
  if (tab === "reports") {
    const isEn = reportLang === "en";
    const kw = reportSearch.trim().toLowerCase();
    const visibleCatalog = UC09_REPORT_CATALOG.filter((r) => {
      if (hiddenReportIds.includes(r.id)) return false;
      if (!kw) return true;
      return (
        r.titleVi.toLowerCase().includes(kw) ||
        r.titleEn.toLowerCase().includes(kw) ||
        r.code.toLowerCase().includes(kw)
      );
    });

    const assetReportsList = visibleCatalog.filter((r) => r.group === "ASSET");
    const reconcileReportsList = visibleCatalog.filter((r) => r.group === "RECONCILE");

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Top bar matching Image 5 & UC-FA-09 AF10–AF14 */}
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", width: 240 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder={isEn ? "Search by report name" : "Tìm theo tên báo cáo"}
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAvaReportModal(true)}
              style={{ height: 30, padding: "0 10px", border: "none", background: "transparent", fontSize: 12.5, color: "#7c3aed", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 500 }}
            >
              <span>{isEn ? "Quick report search with AVA Accounting" : "Tìm kiếm nhanh báo cáo với AVA Kế toán"}</span>
              <Sparkles size={14} style={{ color: "#7c3aed" }} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#475569" }}>
              <span>{isEn ? "Report Language" : "Ngôn ngữ báo cáo"}</span>
              <select
                value={reportLang}
                onChange={(e) => setReportLang(e.target.value as "vi" | "en")}
                style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff", outline: "none", cursor: "pointer" }}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowHideReportsModal(true)}
              style={{ height: 28, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, background: "#ffffff", fontSize: 12, color: "#334155", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Eye size={13} style={{ color: "#64748b" }} />
              <span>{isEn ? "Show/Hide reports" : "Ẩn/hiện báo cáo"}</span>
            </button>
            <div style={{ borderLeft: "1px solid #cbd5e1", paddingLeft: 8, display: "flex", alignItems: "center" }}>
              <button
                type="button"
                style={{ border: "1px solid #cbd5e1", background: "#f8fafc", width: 28, height: 28, borderRadius: 4, display: "grid", placeItems: "center", color: "#475569", cursor: "pointer" }}
                title="Dạng lưới"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Content sections */}
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {assetReportsList.length === 0 && reconcileReportsList.length === 0 ? (
            <div style={{ padding: 36, background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", textAlign: "center", color: "#64748b", fontSize: 13 }}>
              {isEn ? "No matching reports found." : "Không tìm thấy báo cáo phù hợp với từ khóa tìm kiếm."}
            </div>
          ) : (
            <>
              {/* 1. Báo cáo tài sản */}
              <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div
                  onClick={() => setAssetReportsOpen(!assetReportsOpen)}
                  style={{ height: 38, padding: "0 16px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: assetReportsOpen ? "1px solid #e2e8f0" : "none", cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    {isEn ? "Fixed Asset Reports" : "Báo cáo tài sản"} ({assetReportsList.length})
                  </span>
                  {assetReportsOpen ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
                </div>
                {assetReportsOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "14px 16px", gap: 12 }}>
                    {assetReportsList.map((r) => {
                      const title = isEn ? r.titleEn : r.titleVi;
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleOpenReportByDef(r)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 4,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#1e293b",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#00a862";
                            e.currentTarget.style.background = "#f0fdf4";
                            e.currentTarget.style.color = "#00a862";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.background = "#ffffff";
                            e.currentTarget.style.color = "#1e293b";
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{title}</span>
                          <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Báo cáo đối chiếu */}
              <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div
                  onClick={() => setReconcileReportsOpen(!reconcileReportsOpen)}
                  style={{ height: 38, padding: "0 16px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: reconcileReportsOpen ? "1px solid #e2e8f0" : "none", cursor: "pointer", userSelect: "none" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    {isEn ? "Reconciliation Reports" : "Báo cáo đối chiếu"} ({reconcileReportsList.length})
                  </span>
                  {reconcileReportsOpen ? <ChevronUp size={16} style={{ color: "#64748b" }} /> : <ChevronDown size={16} style={{ color: "#64748b" }} />}
                </div>
                {reconcileReportsOpen && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "14px 16px", gap: 12 }}>
                    {reconcileReportsList.map((r) => {
                      const title = isEn ? r.titleEn : r.titleVi;
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleOpenReportByDef(r)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: 4,
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "#1e293b",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "#00a862";
                            e.currentTarget.style.background = "#f0fdf4";
                            e.currentTarget.style.color = "#00a862";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = "#e2e8f0";
                            e.currentTarget.style.background = "#ffffff";
                            e.currentTarget.style.color = "#1e293b";
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{title}</span>
                          <FileSpreadsheet size={15} style={{ color: "#94a3b8" }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {renderModals()}
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ padding: 20 }}>
      {renderModals()}
    </div>
  );
}
