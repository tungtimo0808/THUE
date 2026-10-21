import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Calendar,
  Plus,
  Search,
  Download,
  X,
  Calculator,
  RotateCw,
  Users,
  ChevronDown,
  FileText,
  DollarSign,
  Printer,
  Sliders,
  Scale,
  ShieldCheck,
  UserCheck,
  Check,
  Clock,
  Layers,
  SlidersHorizontal,
  CircleHelp,
  ArrowLeft,
  ChevronUp,
  Coins,
} from "lucide-react";
import { SalaryPaymentModal, InsurancePaymentModal } from "./MisaBankModals";
import { apiDate, apiNumber, useMisaApiLists, useMisaApiSave } from "./misa-api-lists";
import {
  createApiWriter, insurancePaymentRows, payrollEmployees, postSalarySheet, salaryPaymentRows, saveAttendanceSheet,
  savePayProfiles, savePayrollPayment, saveSalarySheet,
} from "./misa-api-writes";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import "./misa-cash.css";

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount);
}

export type MisaPayrollWorkspaceProps = {
  company?: { id: string; name: string };
  period?: string;
  tab?: string;
  href?: (path: string) => string;
  notify: (msg: string) => void;
};

// ============================================================================
// SAMPLE DATA: CBNV & PHÒNG BAN
// ============================================================================
// Real employee data from Company ABC (TT99/2025/TT-BTC)
export const SAMPLE_EMPLOYEES = [
  {
    id: "TRUONGTHANHQUAN",
    name: "Trương Thanh Quân",
    dept: "Ban Giám đốc",
    title: "Giám đốc",
    salaryRate: 35000000,
    allowance: 5000000,
    bankAcc: "1500205888888 - Techcombank",
    taxCode: "109876543-001",
    dependents: 2,
    insuranceSalary: 35000000,
    joinDate: "01/01/2020",
    status: "Đang làm việc",
  },
  {
    id: "NGUYENTHIYEN",
    name: "Nguyễn Thị Yến",
    dept: "Phòng Kế toán",
    title: "Kế toán trưởng",
    salaryRate: 25000000,
    allowance: 3000000,
    bankAcc: "1500205888889 - Techcombank",
    taxCode: "109876543-002",
    dependents: 1,
    insuranceSalary: 25000000,
    joinDate: "15/03/2021",
    status: "Đang làm việc",
  },
  {
    id: "LEVANHIEU",
    name: "Lê Văn Hiếu",
    dept: "Phòng Kế toán",
    title: "Kế toán viên",
    salaryRate: 15000000,
    allowance: 1500000,
    bankAcc: "1500205888890 - Techcombank",
    taxCode: "109876543-003",
    dependents: 0,
    insuranceSalary: 15000000,
    joinDate: "01/06/2022",
    status: "Đang làm việc",
  },
  {
    id: "TRANVANHUNG",
    name: "Trần Văn Hùng",
    dept: "Phòng Kế toán",
    title: "Thủ quỹ",
    salaryRate: 12000000,
    allowance: 1000000,
    bankAcc: "1500205888891 - Techcombank",
    taxCode: "109876543-004",
    dependents: 1,
    insuranceSalary: 12000000,
    joinDate: "01/08/2022",
    status: "Đang làm việc",
  },
  {
    id: "HOANGBACUNG",
    name: "Hoàng Bá Cung",
    dept: "Phòng HC Nhân sự",
    title: "Nhân viên",
    salaryRate: 11000000,
    allowance: 1000000,
    bankAcc: "1500205888892 - Techcombank",
    taxCode: "109876543-005",
    dependents: 0,
    insuranceSalary: 11000000,
    joinDate: "15/09/2022",
    status: "Đang làm việc",
  },
  {
    id: "LUONGMINHTHANH",
    name: "Lương Minh Thành",
    dept: "Phòng Kỹ thuật",
    title: "Trưởng phòng",
    salaryRate: 22000000,
    allowance: 3000000,
    bankAcc: "1500205888898 - Techcombank",
    taxCode: "109876543-006",
    dependents: 1,
    insuranceSalary: 22000000,
    joinDate: "01/02/2021",
    status: "Đang làm việc",
  },
  {
    id: "DANGTHUAN",
    name: "Đặng Thuận",
    dept: "Phòng Kỹ thuật",
    title: "Nhân viên",
    salaryRate: 14000000,
    allowance: 1500000,
    bankAcc: "1500205888899 - Techcombank",
    taxCode: "109876543-007",
    dependents: 0,
    insuranceSalary: 14000000,
    joinDate: "10/05/2023",
    status: "Đang làm việc",
  },
  {
    id: "BUIDUCDUNG",
    name: "Bùi Đức Dũng",
    dept: "Phòng Kỹ thuật",
    title: "Nhân viên",
    salaryRate: 14000000,
    allowance: 1500000,
    bankAcc: "1500205888900 - Techcombank",
    taxCode: "109876543-008",
    dependents: 0,
    insuranceSalary: 14000000,
    joinDate: "01/07/2023",
    status: "Đang làm việc",
  },
  {
    id: "PHAMDINHTAI",
    name: "Phạm Đình Tài",
    dept: "Phòng Kỹ thuật",
    title: "Nhân viên",
    salaryRate: 13000000,
    allowance: 1000000,
    bankAcc: "1500205888901 - Techcombank",
    taxCode: "109876543-009",
    dependents: 0,
    insuranceSalary: 13000000,
    joinDate: "15/10/2023",
    status: "Đang làm việc",
  },
];

// ============================================================================
// SAMPLE DATA: KÝ HIỆU CHẤM CÔNG
// ============================================================================
export const ATTENDANCE_SYMBOLS = [
  { code: "+", name: "Làm việc đủ ngày", rate: 100, type: "Hưởng lương", color: "#16a34a" },
  { code: "1/2", name: "Làm việc nửa ngày", rate: 50, type: "Hưởng lương", color: "#2563eb" },
  { code: "P", name: "Nghỉ phép năm", rate: 100, type: "Hưởng lương", color: "#0d9488" },
  { code: "Ô", name: "Nghỉ ốm đau hưởng BHXH", rate: 75, type: "BHXH trả", color: "#ea580c" },
  { code: "TS", name: "Nghỉ thai sản hưởng BHXH", rate: 100, type: "BHXH trả", color: "#db2777" },
  { code: "KL", name: "Nghỉ không lương", rate: 0, type: "Không lương", color: "#dc2626" },
  { code: "Ro", name: "Nghỉ ngừng việc", rate: 100, type: "Hưởng lương", color: "#ca8a04" },
  { code: "CT", name: "Đi công tác", rate: 100, type: "Hưởng lương", color: "#7c3aed" },
  { code: "L", name: "Nghỉ lễ, Tết", rate: 100, type: "Hưởng lương", color: "#059669" },
];

// ============================================================================
// SAMPLE DATA: BẢNG LƯƠNG
// ============================================================================
export const SAMPLE_SALARY_SHEETS = [
  {
    id: "BL-2026-09-VP",
    name: "Bảng lương CBNV Khối Văn phòng - Tháng 09/2026",
    period: "Tháng 09/2026",
    dept: "Khối Văn phòng & Ban Giám đốc",
    employeeCount: 28,
    standardDays: 22,
    grossSalary: 385000000,
    insuranceAmount: 40425000,
    taxAmount: 24150000,
    netSalary: 320425000,
    status: "Đã duyệt chi",
    createdDate: "28/09/2026",
    approvedBy: "Nguyễn Văn An",
  },
  {
    id: "BL-2026-09-SX",
    name: "Bảng lương CBNV Phân xưởng Sản xuất - Tháng 09/2026",
    period: "Tháng 09/2026",
    dept: "Phân xưởng Sản xuất & Cơ điện",
    employeeCount: 45,
    standardDays: 22,
    grossSalary: 495000000,
    insuranceAmount: 51975000,
    taxAmount: 14200000,
    netSalary: 428825000,
    status: "Đã duyệt chi",
    createdDate: "28/09/2026",
    approvedBy: "Nguyễn Văn An",
  },
  {
    id: "BL-2026-08-VP",
    name: "Bảng lương CBNV Khối Văn phòng - Tháng 08/2026",
    period: "Tháng 08/2026",
    dept: "Khối Văn phòng & Ban Giám đốc",
    employeeCount: 28,
    standardDays: 22,
    grossSalary: 380000000,
    insuranceAmount: 39900000,
    taxAmount: 23500000,
    netSalary: 316600000,
    status: "Đã thanh toán",
    createdDate: "28/08/2026",
    approvedBy: "Nguyễn Văn An",
  },
];

// ============================================================================
// SAMPLE DATA: HẠCH TOÁN CHI PHÍ LƯƠNG
// ============================================================================
export const SAMPLE_POSTING_VOUCHERS = [
  {
    voucherNo: "PKT001",
    postDate: "30/09/2026",
    docDate: "30/09/2026",
    description: "Hạch toán chi phí lương tháng 09/2026 Khối Văn phòng",
    totalAmount: 385000000,
    refDoc: "BL-2026-09-VP",
    status: "Đã ghi sổ",
    lines: [
      { debitAcc: "6421", creditAcc: "3341", amount: 150000000, desc: "Lương bộ phận Bán hàng" },
      { debitAcc: "6422", creditAcc: "3341", amount: 235000000, desc: "Lương bộ phận Quản lý doanh nghiệp" },
      { debitAcc: "6421", creditAcc: "3383", amount: 26250000, desc: "BHXH công ty đóng (17.5%) Bán hàng" },
      { debitAcc: "6422", creditAcc: "3383", amount: 41125000, desc: "BHXH công ty đóng (17.5%) QLDN" },
      { debitAcc: "3341", creditAcc: "3335", amount: 24150000, desc: "Khấu trừ thuế TNCN từ lương" },
      { debitAcc: "3341", creditAcc: "3383", amount: 30800000, desc: "Khấu trừ BHXH (8%) người lao động" },
    ],
  },
  {
    voucherNo: "PKT002",
    postDate: "30/09/2026",
    docDate: "30/09/2026",
    description: "Hạch toán chi phí lương tháng 09/2026 Phân xưởng Sản xuất",
    totalAmount: 495000000,
    refDoc: "BL-2026-09-SX",
    status: "Đã ghi sổ",
    lines: [
      { debitAcc: "622", creditAcc: "3341", amount: 420000000, desc: "Lương nhân công trực tiếp sản xuất" },
      { debitAcc: "6271", creditAcc: "3341", amount: 75000000, desc: "Lương nhân viên quản lý phân xưởng" },
      { debitAcc: "622", creditAcc: "3383", amount: 73500000, desc: "BHXH công ty đóng (17.5%) NCTT" },
      { debitAcc: "6271", creditAcc: "3383", amount: 13125000, desc: "BHXH công ty đóng (17.5%) QLPX" },
      { debitAcc: "3341", creditAcc: "3335", amount: 14200000, desc: "Khấu trừ thuế TNCN từ lương" },
      { debitAcc: "3341", creditAcc: "3383", amount: 39600000, desc: "Khấu trừ BHXH (8%) người lao động" },
    ],
  },
];

// ============================================================================
// MAIN COMPONENT: MisaPayrollWorkspace
// ============================================================================
export default function MisaPayrollWorkspace({
  company = { id: "abc", name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC" },
  period: _period = "2026-12",
  tab = "process",
  href = (path) => path,
  notify,
}: MisaPayrollWorkspaceProps) {
  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(company.id, {
    salarySheets: "/api/v1/payroll/salary-sheets/",
  }, notify);
  const apiSave = useMisaApiSave(company.id, notify, reloadApi);
  const { token: apiToken } = useApiSession();
  const payrollWriter = () => createApiWriter(company.id, (path, init) => request(path, apiToken, init));
  const [apiEmployees, setApiEmployees] = useState<any[] | null>(null);
  // Navigation helper
  const navigateTo = (tabName: string) => {
    const url = href(`/payroll/${tabName}`);
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  // State Modals
  const [showSalaryPaymentModal, setShowSalaryPaymentModal] = useState(false);
  const [showInsurancePaymentModal, setShowInsurancePaymentModal] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  useEffect(() => {
    if (!apiConnected || !showEmployeesModal) return;
    payrollEmployees(payrollWriter()).then(setApiEmployees).catch((error) => notify(`Không tải được nhân viên: ${error instanceof Error ? error.message : String(error)}`));
  }, [apiConnected, showEmployeesModal]);
  const [showAttendanceSymbolsModal, setShowAttendanceSymbolsModal] = useState(false);
  const [showTaxBracketsModal, setShowTaxBracketsModal] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showSalaryDetailModal, setShowSalaryDetailModal] = useState<any | null>(null);
  const [previewReport, setPreviewReport] = useState<string | null>(null);

  // Attendance Mode & Add Attendance Sheet Form State
  const [attendanceMode, setAttendanceMode] = useState<"empty" | "sheet_view">("empty");
  const [showAddAttendanceModal, setShowAddAttendanceModal] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const action = sp.get("action");
      const path = window.location.pathname;
      return action === "add-attendance" || (action === "add" && path.includes("attendance") && !path.includes("attendance-summary"));
    }
    return false;
  });
  const [showAttTypeDropdown, setShowAttTypeDropdown] = useState(false);
  const [attendanceType, setAttendanceType] = useState("Chấm công theo buổi");
  const [attMonth, setAttMonth] = useState("10");
  const [attYear, setAttYear] = useState(2026);
  const [attFromDate, setAttFromDate] = useState("01/10/2026");
  const [attToDate, setAttToDate] = useState("31/10/2026");
  const [attSheetName, setAttSheetName] = useState("Bảng chấm công theo buổi tháng 10 năm 2026");
  const [isBasedOnOther, setIsBasedOnOther] = useState(false);
  const [selectAllUnits, setSelectAllUnits] = useState(false);
  const [orgUnits, setOrgUnits] = useState([
    { id: "81ehd8ngkphy", name: "Tung", level: "Tổng công ty/Công ty", checked: false },
    { id: "81ehd8ngkphy_01", name: "Tung", level: "Phòng ban", checked: false },
  ]);

  const handleToggleSelectAllUnits = (checked: boolean) => {
    setSelectAllUnits(checked);
    setOrgUnits((prev) => prev.map((u) => ({ ...u, checked })));
  };

  const handleToggleUnit = (id: string) => {
    setOrgUnits((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, checked: !u.checked } : u));
      setSelectAllUnits(updated.every((u) => u.checked));
      return updated;
    });
  };

  // Attendance Summary Mode & Add Summary Form State (Ảnh 1 & Ảnh 2)
  const [summaryMode, setSummaryMode] = useState<"empty" | "list_view">("empty");
  const [showAddSummaryModal, setShowAddSummaryModal] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const action = sp.get("action");
      const path = window.location.pathname;
      return action === "add-summary" || (action === "add" && path.includes("attendance-summary"));
    }
    return false;
  });
  const [showSummaryTypeDropdown, setShowSummaryTypeDropdown] = useState(false);
  const [summaryType, setSummaryType] = useState("Chấm công theo buổi");
  const [summaryMonth, setSummaryMonth] = useState("10");
  const [summaryYear, setSummaryYear] = useState(2026);
  const [summarySheetName, setSummarySheetName] = useState("Bảng tổng hợp chấm công theo buổi tháng 10 năm 2026");
  const [isAggregatedFromDetails, setIsAggregatedFromDetails] = useState(false);
  const [selectAllSummaryUnits, setSelectAllSummaryUnits] = useState(false);
  const [summaryOrgUnits, setSummaryOrgUnits] = useState([
    { id: "81ehd8ngkphy", name: "Tung", level: "Tổng công ty/Công ty", checked: false },
    { id: "81ehd8ngkphy_01", name: "Tung", level: "Phòng ban", checked: false },
  ]);

  const handleToggleSelectAllSummaryUnits = (checked: boolean) => {
    setSelectAllSummaryUnits(checked);
    setSummaryOrgUnits((prev) => prev.map((u) => ({ ...u, checked })));
  };

  const handleToggleSummaryUnit = (id: string) => {
    setSummaryOrgUnits((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, checked: !u.checked } : u));
      setSelectAllSummaryUnits(updated.every((u) => u.checked));
      return updated;
    });
  };

  // Calculation (Tính lương) Mode & Add Salary Sheet Form State (Ảnh 1 & Ảnh 2)
  const [calcMode, setCalcMode] = useState<"empty" | "sheet_view">("empty");
  const [showAddSalarySheetModal, setShowAddSalarySheetModal] = useState(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const action = sp.get("action");
      const path = window.location.pathname;
      return action === "add-salary" || (action === "add" && path.includes("calculation"));
    }
    return false;
  });
  const [showSalarySheetTypeDropdown, setShowSalarySheetTypeDropdown] = useState(false);
  const [salarySheetType, setSalarySheetType] = useState("Lương cố định (không dựa trên bảng chấm công)");
  const [calcMonth, setCalcMonth] = useState("10");
  const [calcYear, setCalcYear] = useState(2026);
  const [calcFromDate, setCalcFromDate] = useState("01/10/2026");
  const [calcToDate, setCalcToDate] = useState("31/10/2026");
  const [calcSheetName, setCalcSheetName] = useState("Bảng lương cố định tháng 10 năm 2026");
  const [isSalaryBasedOnOther, setIsSalaryBasedOnOther] = useState(false);
  const [selectAllCalcUnits, setSelectAllCalcUnits] = useState(false);
  const [calcOrgUnits, setCalcOrgUnits] = useState([
    { id: "81ehd8ngkphy", name: "Tung", level: "Tổng công ty/Công ty", checked: false },
    { id: "81ehd8ngkphy_01", name: "Tung", level: "Phòng ban", checked: false },
  ]);

  const handleToggleSelectAllCalcUnits = (checked: boolean) => {
    setSelectAllCalcUnits(checked);
    setCalcOrgUnits((prev) => prev.map((u) => ({ ...u, checked })));
  };

  const handleToggleCalcUnit = (id: string) => {
    setCalcOrgUnits((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, checked: !u.checked } : u));
      setSelectAllCalcUnits(updated.every((u) => u.checked));
      return updated;
    });
  };

  const [createdSalarySheets, setCreatedSalarySheets] = useState<any[]>([]);
  useEffect(() => {
    if (!apiConnected || !apiRows.salarySheets) return;
    const labels: Record<string, string> = { CALCULATED: "Chưa hạch toán", POSTED: "Đã hạch toán", PAID: "Đã thanh toán" };
    setCreatedSalarySheets(apiRows.salarySheets.map((row) => {
      const lines = row.lines || [];
      const sum = (field: string) => lines.reduce((total: number, line: any) => total + apiNumber(line[field]), 0);
      return {
        id: row.id, name: row.name, period: `Tháng ${String(row.period).slice(5, 7)}/${String(row.period).slice(0, 4)}`, dept: "Toàn công ty",
        employeeCount: lines.length, standardDays: apiNumber(row.standard_days), grossSalary: sum("gross"),
        insuranceAmount: sum("employee_insurance"), taxAmount: sum("personal_income_tax"), netSalary: sum("net"),
        status: labels[row.status] || row.status, createdDate: apiDate(row.created_at), approvedBy: row.journal_number || "",
      };
    }));
  }, [apiConnected, apiRows]);

  // Posting (Hạch toán chi phí) Mode & Select Salary Sheet Modal State (Ảnh 3)
  const [postingMode, setPostingMode] = useState<"empty" | "voucher_view">("empty");
  const [showSelectSalaryModal, setShowSelectSalaryModal] = useState(false);
  const [selectedSalarySheetForPosting, setSelectedSalarySheetForPosting] = useState("");
  const [isSelectSalaryDropdownOpen, setIsSelectSalaryDropdownOpen] = useState(true);

  // Tax Deduction (Khấu trừ thuế TNCN) Mode State (Ảnh 1)
  const [taxDeductionMode, setTaxDeductionMode] = useState<"empty" | "detail_view">("empty");

  // Filter states
  const [selectedDept, setSelectedDept] = useState("all");
  const [reportSearch, setReportSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [payrollOption, setPayrollOption] = useState("Tiền lương Sổ Việt ERP");
  const [accountingRule, setAccountingRule] = useState<"DETAIL" | "DEPARTMENT">("DETAIL");
  const [standardDaysOption, setStandardDaysOption] = useState(22);
  const [payrollSettings, setPayrollSettings] = useState<any>(null);
  useEffect(() => {
    if (!apiConnected || !apiToken) return;
    request<any>(`/api/v1/payroll/settings/?company_id=${encodeURIComponent(company.id)}`, apiToken)
      .then((settings) => {
        setPayrollSettings(settings);
        setPayrollOption(settings.integration_mode === "CLOUD" ? "Sổ Việt Tiền lương đám mây" : "Tiền lương Sổ Việt ERP");
        setAccountingRule(settings.accounting_rule === "DEPARTMENT" ? "DEPARTMENT" : "DETAIL");
        setStandardDaysOption(apiNumber(settings.standard_days) || 22);
      })
      .catch((error) => notify(`Không tải được thiết lập lương: ${error instanceof Error ? error.message : String(error)}`));
  }, [apiConnected, apiToken, company.id]);
  const [showPayrollOptionDropdown, setShowPayrollOptionDropdown] = useState(false);
  const [reportLanguage, setReportLanguage] = useState("Tiếng Việt");
  const [showReportVisibilityModal, setShowReportVisibilityModal] = useState(false);
  const [visibleReports, setVisibleReports] = useState<string[]>([
    "Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)",
    "Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)",
    "Báo cáo tổng hợp lương nhân viên",
  ]);
  const [reportVisibilitySearch, setReportVisibilitySearch] = useState("");

  const location = useLocation();

  // Check action query param on mount or URL change (from flyout menu shortcuts)
  useEffect(() => {
    const rawSearch = typeof window !== "undefined" ? window.location.search : location.search;
    const searchParams = new URLSearchParams(rawSearch || location.search);
    const action = searchParams.get("action");
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (action === "pay-salary") {
      setShowSalaryPaymentModal(true);
    } else if (action === "pay-insurance") {
      setShowInsurancePaymentModal(true);
    } else if (action === "tax-bracket") {
      setShowTaxBracketsModal(true);
    } else if (action === "regulations") {
      setShowRegulationsModal(true);
    } else if (action === "add-attendance" || (action === "add" && (tab === "attendance" || (path.includes("attendance") && !path.includes("attendance-summary"))))) {
      setShowAddAttendanceModal(true);
    } else if (action === "add-summary" || (action === "add" && (tab === "attendance-summary" || path.includes("attendance-summary")))) {
      setShowAddSummaryModal(true);
    } else if (action === "add-salary" || (action === "add" && (tab === "calculation" || path.includes("calculation")))) {
      setShowAddSalarySheetModal(true);
    }
  }, [location.search, tab]);

  // Filtered employees for Attendance tab
  const filteredEmployees = SAMPLE_EMPLOYEES.filter((emp) => {
    const matchDept = selectedDept === "all" || emp.dept.toLowerCase().includes(selectedDept.toLowerCase());
    const matchSearch =
      !attendanceSearch ||
      emp.name.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
      emp.id.toLowerCase().includes(attendanceSearch.toLowerCase());
    return matchDept && matchSearch;
  });

  // =========================================================================
  // RENDER POPUPS & MODALS
  // =========================================================================
  const renderModals = () => {
    return (
      <>
        {/* 1. Trả lương Modal */}
        {showSalaryPaymentModal && (
          <SalaryPaymentModal
            onClose={() => setShowSalaryPaymentModal(false)}
            loadRecords={apiConnected ? () => salaryPaymentRows(payrollWriter()) : undefined}
            onSubmit={async (data) => {
              if (apiConnected) {
                if (await apiSave((writer) => savePayrollPayment(writer, data, false))) setShowSalaryPaymentModal(false);
                return;
              }
              setShowSalaryPaymentModal(false);
              notify(`Đã lập thành công chứng từ Trả lương - Số tiền: ${formatVND(data.totalAmount)}đ!`);
            }}
          />
        )}

        {/* 2. Nộp bảo hiểm Modal */}
        {showInsurancePaymentModal && (
          <InsurancePaymentModal
            onClose={() => setShowInsurancePaymentModal(false)}
            loadRecords={apiConnected ? () => insurancePaymentRows(payrollWriter()) : undefined}
            onSubmit={async (data) => {
              if (apiConnected) {
                if (await apiSave((writer) => savePayrollPayment(writer, data, true))) setShowInsurancePaymentModal(false);
                return;
              }
              setShowInsurancePaymentModal(false);
              notify(`Đã lập chứng từ Nộp bảo hiểm thành công - Số tiền: ${formatVND(data.totalAmount)}đ!`);
            }}
          />
        )}

        {/* 3. Danh mục Nhân viên Modal */}
        {showEmployeesModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 1000, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserCheck size={20} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Danh mục Cán bộ Nhân viên</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmployeesModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", background: "#ffffff" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ position: "relative", width: 260 }}>
                    <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#94a3b8" }} />
                    <input
                      type="text"
                      placeholder="Tìm theo mã, tên CBNV..."
                      style={{ width: "100%", height: 32, paddingLeft: 30, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13 }}
                    />
                  </div>
                  <select
                    style={{ height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, background: "#ffffff" }}
                  >
                    <option value="">Tất cả phòng ban</option>
                    <option value="vp">Khối Văn phòng</option>
                    <option value="sx">Phân xưởng Sản xuất</option>
                    <option value="kd">Phòng Kinh doanh</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => notify(apiConnected ? "Thêm nhân viên mới tại Danh mục > Nhân viên, sau đó nhập lương trong bảng này." : "Thêm mới hồ sơ nhân viên thành công")}
                    style={{ height: 32, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <Plus size={15} /> Thêm nhân viên
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("Xuất danh sách nhân viên ra Excel")}
                    style={{ height: 32, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <Download size={14} /> Xuất khẩu
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
                <table className="misa-table" style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginTop: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "2px solid #cbd5e1", height: 36 }}>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã NV</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Họ và tên</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Phòng ban</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Chức danh</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Lương cơ bản</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Phụ cấp</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Số tài khoản ngân hàng</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>NPT</th>
                      <th style={{ padding: "8px 10px", textAlign: "center" }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apiConnected && apiEmployees ? apiEmployees : SAMPLE_EMPLOYEES).map((emp: any) => (
                      <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9", height: 38 }}>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{emp.id}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>{emp.name}</td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>{emp.dept}</td>
                        <td style={{ padding: "8px 10px", color: "#475569" }}>{emp.title}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{apiConnected && apiEmployees ? <input value={emp.salaryRate} onChange={(e) => setApiEmployees((rows) => (rows || []).map((row) => row.id === emp.id ? { ...row, salaryRate: e.target.value, dirty: true } : row))} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box", textAlign: "right" }} /> : formatVND(emp.salaryRate)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>{apiConnected && apiEmployees ? <input value={emp.allowance} onChange={(e) => setApiEmployees((rows) => (rows || []).map((row) => row.id === emp.id ? { ...row, allowance: e.target.value, dirty: true } : row))} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box", textAlign: "right" }} /> : formatVND(emp.allowance)}</td>
                        <td style={{ padding: "8px 10px", color: "#64748b" }}>{apiConnected && apiEmployees ? <input value={emp.bankAcc} onChange={(e) => setApiEmployees((rows) => (rows || []).map((row) => row.id === emp.id ? { ...row, bankAcc: e.target.value, dirty: true } : row))} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box", textAlign: "left" }} /> : emp.bankAcc}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>{apiConnected && apiEmployees ? <input value={emp.dependents} onChange={(e) => setApiEmployees((rows) => (rows || []).map((row) => row.id === emp.id ? { ...row, dependents: e.target.value, dirty: true } : row))} style={{ width: "100%", height: 28, padding: "0 8px", borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 12.5, boxSizing: "border-box", textAlign: "center" }} /> : emp.dependents}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 500 }}>
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>Tổng số nhân sự: {(apiConnected && apiEmployees ? apiEmployees : SAMPLE_EMPLOYEES).length} người</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (apiConnected && apiEmployees?.some((row) => row.dirty)) {
                      if (!(await apiSave((writer) => savePayProfiles(writer, apiEmployees)))) return;
                    }
                    setShowEmployeesModal(false);
                  }}
                  style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Ký hiệu chấm công Modal */}
        {showAttendanceSymbolsModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 680, maxWidth: "95vw" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Ký hiệu chấm công</h3>
                <button
                  type="button"
                  onClick={() => setShowAttendanceSymbolsModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", height: 36, borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 80 }}>Ký hiệu</th>
                      <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên loại công</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 120 }}>Tính chất</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", width: 100 }}>% Hưởng lương</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ATTENDANCE_SYMBOLS.map((sym) => (
                      <tr key={sym.code} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                        <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: sym.color, fontSize: 14 }}>
                          {sym.code}
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 500, color: "#1e293b" }}>{sym.name}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center", color: "#475569" }}>{sym.type}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>{sym.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setShowAttendanceSymbolsModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Biểu thuế TNCN Modal */}
        {showTaxBracketsModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 750, maxWidth: "95vw" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Scale size={20} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Biểu thuế lũy tiến từng phần Thuế Thu nhập cá nhân (TNCN)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTaxBracketsModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13, color: "#065f46" }}>
                  <strong>Mức giảm trừ đang cấu hình cho doanh nghiệp:</strong>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    <li>Giảm trừ cho bản thân người nộp thuế: <strong>{formatVND(apiNumber(payrollSettings?.personal_deduction))} đ/tháng</strong></li>
                    <li>Giảm trừ cho mỗi người phụ thuộc: <strong>{formatVND(apiNumber(payrollSettings?.dependent_deduction))} đ/tháng</strong></li>
                  </ul>
                </div>

                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", height: 36, borderBottom: "1px solid #cbd5e1", color: "#475569" }}>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: 60 }}>Bậc</th>
                      <th style={{ padding: "8px 10px", textAlign: "left" }}>Phần thu nhập tính thuế / tháng</th>
                      <th style={{ padding: "8px 10px", textAlign: "center", width: 100 }}>Thuế suất</th>
                      <th style={{ padding: "8px 10px", textAlign: "right" }}>Cách tính từng bậc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payrollSettings?.tax_brackets || []).map((bracket: any, index: number, brackets: any[]) => ({
                      step: index + 1,
                      range: bracket.up_to == null ? `Trên ${formatVND(Number(brackets[index - 1]?.up_to || 0))} đ` : `Đến ${formatVND(Number(bracket.up_to))} đ`,
                      rate: `${bracket.rate}%`,
                      formula: `Phần thu nhập trong bậc × ${bracket.rate}%`,
                    })).map((b: { step: number; range: string; rate: string; formula: string }) => (
                      <tr key={b.step} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "#00a862" }}>{b.step}</td>
                        <td style={{ padding: "8px 10px", color: "#1e293b", fontWeight: 500 }}>{b.range}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: "#d97706" }}>{b.rate}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569", fontFamily: "monospace" }}>{b.formula}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setShowTaxBracketsModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Quy định lương, BHXH Modal */}
        {showRegulationsModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 750, maxWidth: "95vw" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={20} style={{ color: "#00a862" }} />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Quy định mức lương, Bảo hiểm & Thuế TNCN
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRegulationsModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "16px 20px", maxHeight: "70vh", overflowY: "auto" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 13.5, color: "#1e293b" }}>1. Tỷ lệ trích nộp các khoản theo lương</h4>
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", height: 34, borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left" }}>Khoản trích</th>
                      <th style={{ padding: "6px 10px", textAlign: "center" }}>Doanh nghiệp đóng</th>
                      <th style={{ padding: "6px 10px", textAlign: "center" }}>Người lao động đóng</th>
                      <th style={{ padding: "6px 10px", textAlign: "center" }}>Tổng cộng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([['social', 'Bảo hiểm xã hội'], ['health', 'Bảo hiểm y tế'], ['unemployment', 'Bảo hiểm thất nghiệp'], ['union', 'Kinh phí công đoàn']] as const).map(([fund, label]) => {
                      const employer = apiNumber(payrollSettings?.insurance_rates?.employer?.[fund]);
                      const employee = apiNumber(payrollSettings?.insurance_rates?.employee?.[fund]);
                      return <tr key={fund} style={{ borderBottom: "1px solid #f1f5f9", height: 32 }}>
                        <td style={{ padding: "6px 10px" }}>{label}</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>{employer}%</td>
                        <td style={{ padding: "6px 10px", textAlign: "center" }}>{employee}%</td>
                        <td style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700 }}>{employer + employee}%</td>
                      </tr>;
                    })}
                  </tbody>
                </table>

                <p style={{ fontSize: 13, color: "#64748b" }}>Mức lương cơ sở và trần đóng bảo hiểm chưa được cấu hình trong hệ thống.</p>
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setShowRegulationsModal(false)}
                  style={{ height: 32, padding: "0 20px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Tùy chọn tiền lương Modal */}
        {showOptionsModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 600, maxWidth: "95vw" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Tùy chọn phân hệ Tiền lương</h3>
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
                <div>
                  <label style={{ fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Ứng dụng quản lý tính lương:</label>
                  <select
                    value={payrollOption}
                    onChange={(e) => setPayrollOption(e.target.value)}
                    style={{ width: "100%", height: 34, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1" }}
                  >
                    <option value="Tiền lương Sổ Việt ERP">Tiền lương Sổ Việt ERP (Tính trực tiếp trên phần mềm)</option>
                    <option value="Sổ Việt Tiền lương đám mây">Sổ Việt Tiền lương (Kết nối bộ ứng dụng quản trị nhân sự)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Phương pháp hạch toán chi phí lương mặc định:</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="radio" name="accountingRule" checked={accountingRule === "DETAIL"} onChange={() => setAccountingRule("DETAIL")} style={{ accentColor: "#00a862" }} />
                      <span>Hạch toán chi tiết theo từng nhân viên và phòng ban</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input type="radio" name="accountingRule" checked={accountingRule === "DEPARTMENT"} onChange={() => setAccountingRule("DEPARTMENT")} style={{ accentColor: "#00a862" }} />
                      <span>Hạch toán tổng hợp theo từng bộ phận tính giá thành & chi phí</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Số ngày công chuẩn trong tháng:</label>
                  <input type="number" min={1} max={31} value={standardDaysOption} onChange={(e) => setStandardDaysOption(Number(e.target.value))} style={{ width: 120, height: 32, padding: "0 10px", borderRadius: 4, border: "1px solid #cbd5e1" }} />
                </div>
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(false)}
                  style={{ height: 32, padding: "0 16px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (apiConnected) {
                      if (standardDaysOption < 1 || standardDaysOption > 31) { notify("Số ngày công chuẩn phải từ 1 đến 31."); return; }
                      void apiSave(async () => {
                        const settings = await request<any>(`/api/v1/payroll/settings/?company_id=${encodeURIComponent(company.id)}`, apiToken, {
                          method: "PUT", body: JSON.stringify({
                            integration_mode: payrollOption === "AMIS Tiền lương đám mây" ? "CLOUD" : "LOCAL",
                            accounting_rule: accountingRule, standard_days: standardDaysOption,
                          }),
                        });
                        setPayrollSettings(settings);
                        return { message: "Đã lưu thiết lập tùy chọn phân hệ Tiền lương." };
                      }).then((saved) => { if (saved) setShowOptionsModal(false); });
                      return;
                    }
                    notify("Cần kết nối API để lưu thiết lập Tiền lương.");
                  }}
                  style={{ height: 32, padding: "0 20px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Lưu thiết lập
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. Chi tiết Bảng lương Modal */}
        {showSalaryDetailModal && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 1100, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{showSalaryDetailModal.name}</h3>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>Mã: {showSalaryDetailModal.id} • Đơn vị: {showSalaryDetailModal.dept} • Người duyệt: {showSalaryDetailModal.approvedBy}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSalaryDetailModal(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "12px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div><span style={{ color: "#64748b", fontSize: 12 }}>Tổng quỹ lương:</span> <strong style={{ color: "#1e293b", fontSize: 14 }}>{formatVND(showSalaryDetailModal.grossSalary)} đ</strong></div>
                  <div><span style={{ color: "#64748b", fontSize: 12 }}>BHXH khấu trừ:</span> <strong style={{ color: "#ea580c", fontSize: 14 }}>{formatVND(showSalaryDetailModal.insuranceAmount)} đ</strong></div>
                  <div><span style={{ color: "#64748b", fontSize: 12 }}>Thuế TNCN:</span> <strong style={{ color: "#d97706", fontSize: 14 }}>{formatVND(showSalaryDetailModal.taxAmount)} đ</strong></div>
                  <div><span style={{ color: "#64748b", fontSize: 12 }}>Thực lĩnh:</span> <strong style={{ color: "#00a862", fontSize: 14 }}>{formatVND(showSalaryDetailModal.netSalary)} đ</strong></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSalaryDetailModal(null);
                      setShowSalaryPaymentModal(true);
                    }}
                    style={{ height: 32, padding: "0 14px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <DollarSign size={15} /> Chi trả lương
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("Xuất bảng tính lương sang file Excel")}
                    style={{ height: 32, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                  >
                    <Download size={14} /> Xuất Excel
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
                <table className="misa-table" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginTop: 10 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569", borderBottom: "2px solid #cbd5e1", height: 36 }}>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>Mã NV</th>
                      <th style={{ padding: "6px 8px", textAlign: "left" }}>Họ và tên</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Lương cơ bản</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Công chuẩn</th>
                      <th style={{ padding: "6px 8px", textAlign: "center" }}>Công TT</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Lương TT</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Phụ cấp</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Tổng thu nhập</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>BHXH (10.5%)</th>
                      <th style={{ padding: "6px 8px", textAlign: "right" }}>Thuế TNCN</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", color: "#00a862" }}>Thực lĩnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAMPLE_EMPLOYEES.map((emp) => {
                      const base = emp.salaryRate;
                      const allowance = emp.allowance;
                      const gross = base + allowance;
                      const insurance = Math.round(base * 0.105);
                      const tax = Math.max(0, Math.round((gross - insurance - 11000000 - emp.dependents * 4400000) * 0.1));
                      const net = gross - insurance - tax;
                      return (
                        <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#00a862" }}>{emp.id}</td>
                          <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1e293b" }}>{emp.name}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(base)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "center" }}>22</td>
                          <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 600 }}>22</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(base)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatVND(allowance)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>{formatVND(gross)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#ea580c" }}>{formatVND(insurance)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "#d97706" }}>{formatVND(tax)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={() => setShowSalaryDetailModal(null)}
                  style={{ height: 32, padding: "0 20px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, cursor: "pointer" }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 9. Report Preview Modal */}
        {previewReport && (
          <div className="misa-modal-overlay">
            <div className="misa-modal-card" style={{ width: 950, maxWidth: "95vw", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
              <div className="misa-modal-header" style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{previewReport}</h3>
                  <span style={{ fontSize: 12.5, color: "#64748b" }}>Kỳ báo cáo: Tháng 09/2026 • Đơn vị: {company.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => notify("Đang gửi lệnh in báo cáo ra máy in...")}
                  style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <Printer size={14} /> In báo cáo
                </button>
                <button
                  type="button"
                  onClick={() => notify("Xuất báo cáo thành công (dạng Excel XLSX)")}
                  style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                >
                  <Download size={14} /> Xuất Excel
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "24px 30px", background: "#ffffff" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 700, color: "#111827", textTransform: "uppercase" }}>{previewReport}</h2>
                  <div style={{ fontSize: 13, color: "#4b5563" }}>Kỳ tính lương: Tháng 09 năm 2026</div>
                  <div style={{ fontSize: 12.5, color: "#6b7280", fontStyle: "italic", marginTop: 4 }}>Đơn vị tính: Đồng Việt Nam (VND)</div>
                </div>

                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse", border: "1px solid #cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", height: 36, borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px" }}>STT</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "left" }}>Khối / Phòng ban</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>Số lao động</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>Tổng quỹ lương</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>BHXH & Các khoản trừ</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>Thuế TNCN</th>
                      <th style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>Thực lĩnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>1</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", fontWeight: 600 }}>Khối Văn phòng & Ban Giám đốc</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>28</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>385.000.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>40.425.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>24.150.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>320.425.000</td>
                    </tr>
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>2</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", fontWeight: 600 }}>Phân xưởng Sản xuất & Cơ điện</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "center" }}>45</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>495.000.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>51.975.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right" }}>14.200.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>428.825.000</td>
                    </tr>
                    <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                      <td colSpan={2} style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "center" }}>TỔNG CỘNG</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "center" }}>73</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#111827" }}>880.000.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#ea580c" }}>92.400.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#d97706" }}>38.350.000</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 10px", textAlign: "right", color: "#00a862" }}>749.250.000</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signatures */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 40, textAlign: "center", fontSize: 13 }}>
                  <div>
                    <strong>Người lập biểu</strong>
                    <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>(Ký, họ tên)</div>
                    <div style={{ marginTop: 60, fontWeight: 600 }}>Hoàng Thu Thảo</div>
                  </div>
                  <div>
                    <strong>Kế toán trưởng</strong>
                    <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>(Ký, họ tên)</div>
                    <div style={{ marginTop: 60, fontWeight: 600 }}>Trần Thị Bích</div>
                  </div>
                  <div>
                    <strong>Giám đốc</strong>
                    <div style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>(Ký, họ tên, đóng dấu)</div>
                    <div style={{ marginTop: 60, fontWeight: 600 }}>Nguyễn Văn An</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10. Thêm bảng chấm công Modal (Ảnh 1) */}
        {showAddAttendanceModal && (
          <div
            id="modal-add-attendance"
            className="misa-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              className="misa-modal-card"
              style={{
                width: "98vw",
                maxWidth: 1400,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 6,
                overflow: "hidden",
                background: "#f2f5f8",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                  flexShrink: 0,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Thêm bảng chấm công
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    title="Hướng dẫn thêm bảng chấm công"
                    onClick={() => notify("Hướng dẫn lập bảng chấm công chi tiết theo buổi hoặc theo giờ")}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <CircleHelp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddAttendanceModal(false)}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div style={{ padding: "16px 20px", background: "#f2f5f8", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Row 1: Loại chấm công */}
                <div>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Loại chấm công</div>
                  <div style={{ position: "relative", width: 320 }}>
                    <div
                      onClick={() => setShowAttTypeDropdown(!showAttTypeDropdown)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: showAttTypeDropdown ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxSizing: "border-box",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ color: "#1e293b" }}>{attendanceType}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          color: "#64748b",
                          transform: showAttTypeDropdown ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      />
                    </div>

                    {showAttTypeDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "100%",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                          zIndex: 1000,
                          marginTop: 2,
                          overflow: "hidden",
                        }}
                      >
                        {["Chấm công theo buổi", "Chấm công theo giờ"].map((opt) => {
                          const isSelected = attendanceType === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setAttendanceType(opt);
                                setAttSheetName(`Bảng ${opt.toLowerCase()} tháng ${attMonth} năm ${attYear}`);
                                setShowAttTypeDropdown(false);
                              }}
                              style={{
                                padding: "8px 12px",
                                fontSize: 13,
                                cursor: "pointer",
                                background: isSelected ? "#00a862" : "#ffffff",
                                color: isSelected ? "#ffffff" : "#1e293b",
                                fontWeight: isSelected ? 500 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#ffffff";
                              }}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Tháng, Năm, Từ ngày, Đến ngày */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  {/* Tháng */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tháng</div>
                    <div style={{ position: "relative", width: 70 }}>
                      <select
                        value={attMonth}
                        onChange={(e) => {
                          const m = e.target.value;
                          setAttMonth(m);
                          setAttSheetName(`Bảng ${attendanceType.toLowerCase()} tháng ${m} năm ${attYear}`);
                        }}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 20px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          appearance: "none",
                          cursor: "pointer",
                        }}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 10, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Năm */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Năm</div>
                    <input
                      type="number"
                      value={attYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setAttYear(y);
                        setAttSheetName(`Bảng ${attendanceType.toLowerCase()} tháng ${attMonth} năm ${y}`);
                      }}
                      style={{
                        width: 80,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  {/* Từ ngày */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Từ ngày</div>
                    <div style={{ position: "relative", width: 140 }}>
                      <input
                        type="text"
                        value={attFromDate}
                        onChange={(e) => setAttFromDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 28px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar size={15} style={{ position: "absolute", right: 8, top: 8, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Đến ngày */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Đến ngày</div>
                    <div style={{ position: "relative", width: 140 }}>
                      <input
                        type="text"
                        value={attToDate}
                        onChange={(e) => setAttToDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 28px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar size={15} style={{ position: "absolute", right: 8, top: 8, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Tên bảng chấm công */}
                <div>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tên bảng chấm công</div>
                  <input
                    type="text"
                    value={attSheetName}
                    onChange={(e) => setAttSheetName(e.target.value)}
                    style={{
                      width: 320,
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Row 4: Checkbox tạo dựa trên bảng khác */}
                <div style={{ marginTop: 2 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={isBasedOnOther}
                      onChange={(e) => setIsBasedOnOther(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Tạo bảng chấm công dựa trên bảng chấm công khác</span>
                  </label>
                </div>

                {/* Table of Units matching Screenshot 1 */}
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                  {/* Select all header line */}
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectAllUnits}
                      onChange={(e) => handleToggleSelectAllUnits(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, color: "#374151" }}>Chọn tất cả</span>
                  </div>

                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 34, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                        <th style={{ width: 36, textAlign: "center", padding: "4px", borderRight: "1px solid #c4d7cd" }}></th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 180, borderRight: "1px solid #c4d7cd" }}>Mã đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 280, borderRight: "1px solid #c4d7cd" }}>Tên đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600 }}>Cấp tổ chức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgUnits.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                          <td style={{ textAlign: "center", padding: "4px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="checkbox"
                              checked={u.checked}
                              onChange={() => handleToggleUnit(u.id)}
                              style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", fontWeight: 500, borderRight: "1px dotted #cbd5e1" }}>{u.id}</td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", borderRight: "1px dotted #cbd5e1" }}>{u.name}</td>
                          <td style={{ padding: "6px 12px", color: "#475569" }}>{u.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table footer */}
                  <div style={{ padding: "8px 16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "#64748b" }}>
                    <span>Tổng số: <strong>{orgUnits.length}</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Số dòng/trang</span>
                        <select style={{ height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                          <option>20</option>
                          <option>50</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang đầu">|&lt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang trước">&lt;</span>
                        <span style={{ display: "inline-block", minWidth: 20, textAlign: "center", padding: "1px 5px", borderRadius: 3, background: "#00a862", color: "#ffffff", fontWeight: 700, fontSize: 12 }}>1</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang sau">&gt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang cuối">&gt;|</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ padding: "10px 20px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowAddAttendanceModal(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (apiConnected) {
                      if (!(await apiSave((writer) => saveAttendanceSheet(writer, { month: attMonth, year: attYear, type: attendanceType, name: attSheetName }, "DETAIL")))) return;
                      setShowAddAttendanceModal(false);
                      setAttendanceMode("sheet_view");
                      return;
                    }
                    notify(`Đã tạo thành công ${attSheetName}!`);
                    setShowAddAttendanceModal(false);
                    setAttendanceMode("sheet_view");
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}


        {/* 11. Thêm tổng hợp chấm công Modal (Ảnh 2) */}
        {showAddSummaryModal && (
          <div
            id="modal-add-summary"
            className="misa-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              className="misa-modal-card"
              style={{
                width: "98vw",
                maxWidth: 1400,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 4,
                overflow: "hidden",
                background: "#f2f5f8",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Thêm tổng hợp chấm công
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    title="Hướng dẫn thêm tổng hợp chấm công"
                    onClick={() => notify("Hướng dẫn lập và quản lý bảng tổng hợp chấm công")}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <CircleHelp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSummaryModal(false)}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div style={{ padding: "16px 20px", background: "#f2f5f8", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Row 1: Loại chấm công (Custom Dropdown matching Screenshot 2) */}
                <div>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Loại chấm công</div>
                  <div style={{ position: "relative", width: 320 }}>
                    <div
                      onClick={() => setShowSummaryTypeDropdown(!showSummaryTypeDropdown)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 28px 0 10px",
                        border: showSummaryTypeDropdown ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxSizing: "border-box",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ color: "#1e293b" }}>{summaryType}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          color: "#64748b",
                          transform: showSummaryTypeDropdown ? "rotate(180deg)" : "none",
                          transition: "transform 0.15s",
                        }}
                      />
                    </div>

                    {showSummaryTypeDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "100%",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                          zIndex: 1000,
                          marginTop: 2,
                          overflow: "hidden",
                        }}
                      >
                        {["Chấm công theo buổi", "Chấm công theo giờ"].map((opt) => {
                          const isSelected = summaryType === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setSummaryType(opt);
                                setSummarySheetName(`Bảng tổng hợp ${opt.toLowerCase()} tháng ${summaryMonth} năm ${summaryYear}`);
                                setShowSummaryTypeDropdown(false);
                              }}
                              style={{
                                padding: "8px 12px",
                                fontSize: 13,
                                cursor: "pointer",
                                background: isSelected ? "#00a862" : "#ffffff",
                                color: isSelected ? "#ffffff" : "#1e293b",
                                fontWeight: isSelected ? 500 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#ffffff";
                              }}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Tháng, Năm, Tên bảng tổng hợp chấm công (matching Screenshot 2) */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Tháng */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tháng</div>
                    <div style={{ position: "relative", width: 70 }}>
                      <select
                        value={summaryMonth}
                        onChange={(e) => {
                          const m = e.target.value;
                          setSummaryMonth(m);
                          setSummarySheetName(`Bảng tổng hợp ${summaryType.toLowerCase()} tháng ${m} năm ${summaryYear}`);
                        }}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 20px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          appearance: "none",
                          cursor: "pointer",
                        }}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 10, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Năm */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Năm</div>
                    <input
                      type="number"
                      value={summaryYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setSummaryYear(y);
                        setSummarySheetName(`Bảng tổng hợp ${summaryType.toLowerCase()} tháng ${summaryMonth} năm ${y}`);
                      }}
                      style={{
                        width: 80,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  {/* Tên bảng tổng hợp chấm công */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tên bảng tổng hợp chấm công</div>
                    <input
                      type="text"
                      value={summarySheetName}
                      onChange={(e) => setSummarySheetName(e.target.value)}
                      style={{
                        width: 380,
                        height: 32,
                        padding: "0 10px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Row 3: Checkbox Tổng hợp từ các bảng chấm công chi tiết */}
                <div style={{ marginTop: 2 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={isAggregatedFromDetails}
                      onChange={(e) => setIsAggregatedFromDetails(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Tổng hợp từ các bảng chấm công chi tiết</span>
                  </label>
                </div>

                {/* Table of Units matching Screenshot 2 */}
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                  {/* Select all header line */}
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectAllSummaryUnits}
                      onChange={(e) => handleToggleSelectAllSummaryUnits(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, color: "#374151" }}>Chọn tất cả</span>
                  </div>

                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 34, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                        <th style={{ width: 36, textAlign: "center", padding: "4px", borderRight: "1px solid #c4d7cd" }}></th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 180, borderRight: "1px solid #c4d7cd" }}>Mã đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 280, borderRight: "1px solid #c4d7cd" }}>Tên đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600 }}>Cấp tổ chức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryOrgUnits.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                          <td style={{ textAlign: "center", padding: "4px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="checkbox"
                              checked={u.checked}
                              onChange={() => handleToggleSummaryUnit(u.id)}
                              style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", fontWeight: 500, borderRight: "1px dotted #cbd5e1" }}>{u.id}</td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", borderRight: "1px dotted #cbd5e1" }}>{u.name}</td>
                          <td style={{ padding: "6px 12px", color: "#475569" }}>{u.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table footer */}
                  <div style={{ padding: "8px 16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "#64748b" }}>
                    <span>Tổng số: <strong>{summaryOrgUnits.length}</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Số dòng/trang</span>
                        <select style={{ height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                          <option>20</option>
                          <option>50</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang đầu">|&lt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang trước">&lt;</span>
                        <span style={{ display: "inline-block", minWidth: 20, textAlign: "center", padding: "1px 5px", borderRadius: 3, background: "#00a862", color: "#ffffff", fontWeight: 700, fontSize: 12 }}>1</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang sau">&gt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang cuối">&gt;|</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ padding: "10px 20px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowAddSummaryModal(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (apiConnected) {
                      if (!(await apiSave((writer) => saveAttendanceSheet(writer, { month: summaryMonth, year: summaryYear, type: summaryType, name: summarySheetName }, "SUMMARY")))) return;
                      setShowAddSummaryModal(false);
                      setSummaryMode("list_view");
                      return;
                    }
                    notify(`Đã tạo thành công ${summarySheetName}!`);
                    setShowAddSummaryModal(false);
                    setSummaryMode("list_view");
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 12. Thêm bảng lương Modal (Ảnh 3) */}
        {showAddSalarySheetModal && (
          <div
            id="modal-add-salary"
            className="misa-modal-overlay"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              className="misa-modal-card"
              style={{
                width: "98vw",
                maxWidth: 1400,
                height: "96vh",
                maxHeight: "96vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 4,
                overflow: "hidden",
                background: "#f2f5f8",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Thêm bảng lương
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    type="button"
                    title="Hướng dẫn thêm bảng lương"
                    onClick={() => notify("Hướng dẫn lập và tính toán bảng lương cố định hoặc theo thời gian")}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <CircleHelp size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSalarySheetModal(false)}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div style={{ padding: "16px 20px", background: "#f2f5f8", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Row 1: Loại bảng lương * (Custom Dropdown matching Screenshot 3) */}
                <div>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>
                    Loại bảng lương <span style={{ color: "#ef4444" }}>*</span>
                  </div>
                  <div style={{ position: "relative", width: 440 }}>
                    <div
                      onClick={() => setShowSalarySheetTypeDropdown(!showSalarySheetTypeDropdown)}
                      style={{
                        width: "100%",
                        height: 32,
                        padding: "0 10px",
                        border: showSalarySheetTypeDropdown ? "1px solid #00a862" : "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxSizing: "border-box",
                        userSelect: "none",
                      }}
                    >
                      <span style={{ color: "#1e293b" }}>{salarySheetType}</span>
                      {showSalarySheetTypeDropdown ? (
                        <ChevronUp size={16} style={{ color: "#64748b" }} />
                      ) : (
                        <ChevronDown size={14} style={{ color: "#64748b" }} />
                      )}
                    </div>

                    {showSalarySheetTypeDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "100%",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                          zIndex: 1000,
                          marginTop: 2,
                          overflow: "hidden",
                        }}
                      >
                        {[
                          "Lương cố định (không dựa trên bảng chấm công)",
                          "Lương thời gian theo buổi",
                          "Lương thời gian theo giờ",
                          "Lương tạm ứng",
                        ].map((opt) => {
                          const isSelected = salarySheetType === opt;
                          return (
                            <div
                              key={opt}
                              onClick={() => {
                                setSalarySheetType(opt);
                                let name = `Bảng lương cố định tháng ${calcMonth} năm ${calcYear}`;
                                if (opt.includes("theo buổi")) {
                                  name = `Bảng lương thời gian theo buổi tháng ${calcMonth} năm ${calcYear}`;
                                } else if (opt.includes("theo giờ")) {
                                  name = `Bảng lương thời gian theo giờ tháng ${calcMonth} năm ${calcYear}`;
                                } else if (opt.includes("tạm ứng")) {
                                  name = `Bảng lương tạm ứng tháng ${calcMonth} năm ${calcYear}`;
                                }
                                setCalcSheetName(name);
                                setShowSalarySheetTypeDropdown(false);
                              }}
                              style={{
                                padding: "8px 12px",
                                fontSize: 13,
                                cursor: "pointer",
                                background: isSelected ? "#00a862" : "#ffffff",
                                color: isSelected ? "#ffffff" : "#1e293b",
                                fontWeight: isSelected ? 500 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = "#ffffff";
                              }}
                            >
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Tháng, Năm, Từ ngày, Đến ngày */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  {/* Tháng */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tháng</div>
                    <div style={{ position: "relative", width: 70 }}>
                      <select
                        value={calcMonth}
                        onChange={(e) => {
                          const m = e.target.value;
                          setCalcMonth(m);
                          let name = `Bảng lương cố định tháng ${m} năm ${calcYear}`;
                          if (salarySheetType.includes("theo buổi")) {
                            name = `Bảng lương thời gian theo buổi tháng ${m} năm ${calcYear}`;
                          } else if (salarySheetType.includes("theo giờ")) {
                            name = `Bảng lương thời gian theo giờ tháng ${m} năm ${calcYear}`;
                          } else if (salarySheetType.includes("tạm ứng")) {
                            name = `Bảng lương tạm ứng tháng ${m} năm ${calcYear}`;
                          }
                          setCalcSheetName(name);
                        }}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 20px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          appearance: "none",
                          cursor: "pointer",
                        }}
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} style={{ position: "absolute", right: 6, top: 10, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Năm */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Năm</div>
                    <input
                      type="number"
                      value={calcYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setCalcYear(y);
                        let name = `Bảng lương cố định tháng ${calcMonth} năm ${y}`;
                        if (salarySheetType.includes("theo buổi")) {
                          name = `Bảng lương thời gian theo buổi tháng ${calcMonth} năm ${y}`;
                        } else if (salarySheetType.includes("theo giờ")) {
                          name = `Bảng lương thời gian theo giờ tháng ${calcMonth} năm ${y}`;
                        } else if (salarySheetType.includes("tạm ứng")) {
                          name = `Bảng lương tạm ứng tháng ${calcMonth} năm ${y}`;
                        }
                        setCalcSheetName(name);
                      }}
                      style={{
                        width: 80,
                        height: 32,
                        padding: "0 8px",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "#ffffff",
                      }}
                    />
                  </div>

                  {/* Từ ngày */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Từ ngày</div>
                    <div style={{ position: "relative", width: 140 }}>
                      <input
                        type="text"
                        value={calcFromDate}
                        onChange={(e) => setCalcFromDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 28px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar size={15} style={{ position: "absolute", right: 8, top: 8, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>

                  {/* Đến ngày */}
                  <div>
                    <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Đến ngày</div>
                    <div style={{ position: "relative", width: 140 }}>
                      <input
                        type="text"
                        value={calcToDate}
                        onChange={(e) => setCalcToDate(e.target.value)}
                        style={{
                          width: "100%",
                          height: 32,
                          padding: "0 28px 0 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 4,
                          fontSize: 13,
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                      />
                      <Calendar size={15} style={{ position: "absolute", right: 8, top: 8, color: "#64748b", pointerEvents: "none" }} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Tên bảng lương */}
                <div>
                  <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 5 }}>Tên bảng lương</div>
                  <input
                    type="text"
                    value={calcSheetName}
                    onChange={(e) => setCalcSheetName(e.target.value)}
                    style={{
                      width: 440,
                      height: 32,
                      padding: "0 10px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {/* Row 4: Checkbox Tạo bảng lương dựa trên bảng lương khác */}
                <div style={{ marginTop: 2 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={isSalaryBasedOnOther}
                      onChange={(e) => setIsSalaryBasedOnOther(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span>Tạo bảng lương dựa trên bảng lương khác</span>
                  </label>
                </div>

                {/* Table of Units matching Screenshot 3 */}
                <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 4, overflow: "hidden", marginTop: 4 }}>
                  {/* Select all header line */}
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectAllCalcUnits}
                      onChange={(e) => handleToggleSelectAllCalcUnits(e.target.checked)}
                      style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 13, color: "#374151" }}>Chọn tất cả</span>
                  </div>

                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#d6e4dc", height: 34, borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                        <th style={{ width: 36, textAlign: "center", padding: "4px", borderRight: "1px solid #c4d7cd" }}></th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 180, borderRight: "1px solid #c4d7cd" }}>Mã đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600, width: 280, borderRight: "1px solid #c4d7cd" }}>Tên đơn vị</th>
                        <th style={{ textAlign: "left", padding: "6px 12px", fontWeight: 600 }}>Cấp tổ chức</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcOrgUnits.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                          <td style={{ textAlign: "center", padding: "4px", borderRight: "1px dotted #cbd5e1" }}>
                            <input
                              type="checkbox"
                              checked={u.checked}
                              onChange={() => handleToggleCalcUnit(u.id)}
                              style={{ accentColor: "#00a862", width: 15, height: 15, cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", fontWeight: 500, borderRight: "1px dotted #cbd5e1" }}>{u.id}</td>
                          <td style={{ padding: "6px 12px", color: "#1e293b", borderRight: "1px dotted #cbd5e1" }}>{u.name}</td>
                          <td style={{ padding: "6px 12px", color: "#475569" }}>{u.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Table footer */}
                  <div style={{ padding: "8px 16px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "#64748b" }}>
                    <span>Tổng số: <strong>{calcOrgUnits.length}</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>Số dòng/trang</span>
                        <select style={{ height: 26, padding: "0 6px", border: "1px solid #cbd5e1", borderRadius: 3, fontSize: 12, background: "#ffffff" }}>
                          <option>20</option>
                          <option>50</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, userSelect: "none" }}>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang đầu">|&lt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang trước">&lt;</span>
                        <span style={{ display: "inline-block", minWidth: 20, textAlign: "center", padding: "1px 5px", borderRadius: 3, background: "#00a862", color: "#ffffff", fontWeight: 700, fontSize: 12 }}>1</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang sau">&gt;</span>
                        <span style={{ cursor: "pointer", padding: "2px 4px" }} title="Trang cuối">&gt;|</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ padding: "10px 20px", background: "#ffffff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowAddSalarySheetModal(false)}
                  style={{
                    height: 32,
                    padding: "0 18px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (apiConnected) {
                      if (!(await apiSave((writer) => saveSalarySheet(writer, { month: calcMonth, year: calcYear, type: salarySheetType, name: calcSheetName })))) return;
                      setShowAddSalarySheetModal(false);
                      setCalcMode("sheet_view");
                      return;
                    }
                    const newSheet = {
                      id: `BL-${calcYear}-${calcMonth}-${Date.now().toString().slice(-4)}`,
                      name: calcSheetName,
                      period: `Tháng ${calcMonth}/${calcYear}`,
                      dept: "Toàn công ty",
                      employeeCount: 73,
                      standardDays: 22,
                      grossSalary: 880000000,
                      insuranceAmount: 92400000,
                      taxAmount: 38350000,
                      netSalary: 749250000,
                      status: "Chưa duyệt",
                      createdDate: calcFromDate,
                      approvedBy: "Chưa duyệt",
                    };
                    setCreatedSalarySheets((prev) => [newSheet, ...prev]);
                    notify(`Đã tạo thành công ${calcSheetName}!`);
                    setShowAddSalarySheetModal(false);
                    setCalcMode("sheet_view");
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 13. Chọn bảng lương để hạch toán chi phí Modal (Ảnh 3) */}
        {showSelectSalaryModal && (
          <div className="misa-modal-overlay">
            <div
              className="misa-modal-card"
              style={{
                width: 500,
                maxWidth: "95vw",
                borderRadius: 4,
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                background: "#ffffff",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#ffffff",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Chọn bảng lương
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSelectSalaryModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", display: "grid", placeItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <div style={{ padding: "16px 20px 24px 20px", background: "#ffffff" }}>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>Bảng lương</div>
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => setIsSelectSalaryDropdownOpen(!isSelectSalaryDropdownOpen)}
                    style={{
                      width: "100%",
                      height: 34,
                      padding: "0 10px",
                      border: isSelectSalaryDropdownOpen ? "1px solid #00a862" : "1px solid #cbd5e1",
                      borderRadius: 4,
                      fontSize: 13,
                      background: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxSizing: "border-box",
                      userSelect: "none",
                      outline: "none",
                      boxShadow: isSelectSalaryDropdownOpen ? "0 0 0 1px rgba(0, 168, 98, 0.2)" : "none",
                    }}
                  >
                    <span style={{ color: selectedSalarySheetForPosting ? "#1e293b" : "#94a3b8" }}>
                      {selectedSalarySheetForPosting || ""}
                    </span>
                    {isSelectSalaryDropdownOpen ? (
                      <ChevronUp size={16} style={{ color: "#64748b" }} />
                    ) : (
                      <ChevronDown size={14} style={{ color: "#64748b" }} />
                    )}
                  </div>

                  {isSelectSalaryDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        width: "100%",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 4,
                        boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
                        zIndex: 1000,
                        marginTop: 2,
                        overflow: "hidden",
                      }}
                    >
                      {createdSalarySheets.length === 0 ? (
                        <div>
                          <div
                            style={{
                              padding: "14px 16px",
                              textAlign: "center",
                              color: "#64748b",
                              fontSize: 13,
                            }}
                          >
                            Không có dữ liệu hiển thị.
                          </div>
                          <div style={{ borderTop: "1px solid #e2e8f0", padding: "8px 12px", textAlign: "center", background: "#f8fafc" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSalarySheetForPosting("Bảng lương cố định tháng 10 năm 2026");
                                setIsSelectSalaryDropdownOpen(false);
                              }}
                              style={{ border: "none", background: "none", color: "#0073e6", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                            >
                              + Chọn bảng lương mẫu tháng 10/2026
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {createdSalarySheets.map((sheet: any) => {
                            const isSelected = selectedSalarySheetForPosting === sheet.name;
                            return (
                              <div
                                key={sheet.id || sheet.name}
                                onClick={() => {
                                  setSelectedSalarySheetForPosting(sheet.name);
                                  setIsSelectSalaryDropdownOpen(false);
                                }}
                                style={{
                                  padding: "9px 12px",
                                  fontSize: 13,
                                  cursor: "pointer",
                                  background: isSelected ? "#00a862" : "#ffffff",
                                  color: isSelected ? "#ffffff" : "#1e293b",
                                  fontWeight: isSelected ? 500 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = "#f1f5f9";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.background = "#ffffff";
                                }}
                              >
                                {sheet.name}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "12px 20px", background: "#ffffff", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowSelectSalaryModal(false)}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedSalarySheetForPosting && createdSalarySheets.length === 0) {
                      notify("Vui lòng chọn bảng lương để hạch toán chi phí!");
                      return;
                    }
                    if (apiConnected) {
                      const sheet = createdSalarySheets.find((row: any) => row.name === selectedSalarySheetForPosting);
                      if (!sheet) { notify("Chọn bảng lương cần hạch toán."); return; }
                      void apiSave((writer) => postSalarySheet(writer, sheet.id)).then((saved) => {
                        if (saved) { setShowSelectSalaryModal(false); setPostingMode("voucher_view"); }
                      });
                      return;
                    }
                    notify(`Đã lập chứng từ hạch toán chi phí lương cho ${selectedSalarySheetForPosting || "Bảng lương"} thành công!`);
                    setShowSelectSalaryModal(false);
                    setPostingMode("voucher_view");
                  }}
                  style={{
                    height: 32,
                    padding: "0 22px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0, 168, 98, 0.25)",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 14. Ẩn/hiện báo cáo Modal */}
        {showReportVisibilityModal && (
          <div className="misa-modal-overlay">
            <div
              className="misa-modal-card"
              style={{
                width: 580,
                maxWidth: "95vw",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00a862" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="23" x2="23" y2="1" />
                  </svg>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                    Ẩn/hiện báo cáo Tiền lương
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportVisibilityModal(false)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search & Tool */}
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #e2e8f0", background: "#ffffff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ position: "relative", width: 280 }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "#94a3b8" }} />
                  <input
                    type="text"
                    value={reportVisibilitySearch}
                    onChange={(e) => setReportVisibilitySearch(e.target.value)}
                    placeholder="Tìm tên báo cáo..."
                    style={{ width: "100%", height: 32, paddingLeft: 30, borderRadius: 4, border: "1px solid #cbd5e1", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleReports([
                      "Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)",
                      "Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)",
                      "Báo cáo tổng hợp lương nhân viên",
                    ])}
                    style={{ padding: "5px 10px", fontSize: 12, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleReports([])}
                    style={{ padding: "5px 10px", fontSize: 12, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer" }}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320 }}>
                {[
                  { title: "Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)", desc: "Mẫu cố định theo thang bảng lương doanh nghiệp" },
                  { title: "Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)", desc: "Mẫu tính lương theo thời gian và ngày công thực tế" },
                  { title: "Báo cáo tổng hợp lương nhân viên", desc: "Tổng hợp toàn bộ thu nhập và các khoản trích theo lương" },
                ]
                  .filter((r) => !reportVisibilitySearch || r.title.toLowerCase().includes(reportVisibilitySearch.toLowerCase()))
                  .map((r) => {
                    const isChecked = visibleReports.includes(r.title);
                    return (
                      <label
                        key={r.title}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: isChecked ? "1px solid #86efac" : "1px solid #e2e8f0",
                          background: isChecked ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setVisibleReports([...visibleReports, r.title]);
                            } else {
                              setVisibleReports(visibleReports.filter((t) => t !== r.title));
                            }
                          }}
                          style={{ marginTop: 3, accentColor: "#00a862", width: 16, height: 16 }}
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{r.title}</span>
                          <span style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{r.desc}</span>
                        </div>
                      </label>
                    );
                  })}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: "12px 20px",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderTop: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowReportVisibilityModal(false)}
                  style={{
                    height: 32,
                    padding: "0 16px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowReportVisibilityModal(false);
                    notify(`Đã lưu tùy chỉnh danh sách: ${visibleReports.length} báo cáo`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 20px",
                    background: "#00a862",
                    border: "none",
                    borderRadius: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
                  }}
                >
                  Đồng ý
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // =========================================================================
  // 1. TAB: QUY TRÌNH (ẢNH 1 EXACT MATCH)
  // =========================================================================
  if (tab === "process") {
    return (
      <div style={{ background: "#edf1f5", minHeight: "100%", padding: "16px 20px 24px 20px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Row 1: 2 Main Cards (Quy trình + Báo cáo) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "stretch" }}>
          
          {/* Card Trái: NGHIỆP VỤ TIỀN LƯƠNG */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
              display: "flex",
              flexDirection: "column",
              padding: 0,
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                textAlign: "center",
                padding: "14px 10px",
                margin: 0,
                borderBottom: "1px solid #f1f5f9",
                color: "#1e293b",
                letterSpacing: "0.5px",
              }}
            >
              NGHIỆP VỤ TIỀN LƯƠNG
            </h2>

            {/* Diagram Container */}
            <div style={{ position: "relative", minHeight: 320, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              
              {/* SVG Connecting Flow Lines */}
              <svg
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
              >
                <defs>
                  <marker
                    id="arrow-payroll"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 7 3.5, 0 7" fill="#94a3b8" />
                  </marker>
                </defs>
                {/* 1 -> Branch 1 */}
                <line x1="12%" y1="50%" x2="22%" y2="50%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="22%" y1="26%" x2="22%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="22%" y1="26%" x2="27%" y2="26%" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-payroll)" />
                <line x1="22%" y1="74%" x2="27%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-payroll)" />

                {/* Branch 1 -> 4 */}
                <line x1="37%" y1="26%" x2="43%" y2="26%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="37%" y1="74%" x2="43%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="43%" y1="26%" x2="43%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="43%" y1="50%" x2="47%" y2="50%" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-payroll)" />

                {/* 4 -> Branch 2 */}
                <line x1="59%" y1="50%" x2="66%" y2="50%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="66%" y1="26%" x2="66%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="66%" y1="26%" x2="70%" y2="26%" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-payroll)" />
                <line x1="66%" y1="74%" x2="70%" y2="74%" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow-payroll)" />
              </svg>

              {/* Interactive Flow Nodes */}
              <div style={{ position: "relative", width: "100%", height: 280, zIndex: 2 }}>
                
                {/* 1. Chấm công (Center Left) */}
                <div
                  onClick={() => navigateTo("attendance")}
                  style={{
                    position: "absolute",
                    left: "10%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 90,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Chấm công"
                >
                  <span className="ref-business-icon attendance" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>CC</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Calendar size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Chấm công
                  </span>
                </div>

                {/* 2. Tổng hợp chấm công (Top branch) */}
                <div
                  onClick={() => navigateTo("attendance-summary")}
                  style={{
                    position: "absolute",
                    left: "32%",
                    top: "26%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 100,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Tổng hợp chấm công"
                >
                  <span className="ref-business-icon summary" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>THC</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <FileText size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Tổng hợp<br />chấm công
                  </span>
                </div>

                {/* 3. Tính lương (Bottom branch) */}
                <div
                  onClick={() => navigateTo("calculation")}
                  style={{
                    position: "absolute",
                    left: "32%",
                    top: "74%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 90,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Tính lương"
                >
                  <span className="ref-business-icon calc" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>TL</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Calculator size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Tính lương
                  </span>
                </div>

                {/* 4. Hạch toán chi phí lương (Center Axis) */}
                <div
                  onClick={() => navigateTo("posting")}
                  style={{
                    position: "absolute",
                    left: "53%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 100,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Hạch toán chi phí lương"
                >
                  <span className="ref-business-icon post" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>HT</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <Coins size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Hạch toán chi<br />phí lương
                  </span>
                </div>

                {/* 5. Nộp bảo hiểm (Top Right branch) */}
                <div
                  onClick={() => setShowInsurancePaymentModal(true)}
                  style={{
                    position: "absolute",
                    left: "76%",
                    top: "26%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 95,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Nộp bảo hiểm"
                >
                  <span className="ref-business-icon insurance" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>BH</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#f59e0b", borderColor: "#fbbf24" }}
                    >
                      <ShieldCheck size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Nộp bảo hiểm
                  </span>
                </div>

                {/* 6. Trả lương (Bottom Right branch) */}
                <div
                  onClick={() => setShowSalaryPaymentModal(true)}
                  style={{
                    position: "absolute",
                    left: "76%",
                    top: "74%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    width: 90,
                    textAlign: "center",
                    zIndex: 2,
                  }}
                  title="Trả lương"
                >
                  <span className="ref-business-icon pay" style={{ marginBottom: 6 }}>
                    <span
                      className="ref-document-sheet"
                      style={{
                        background: "linear-gradient(90deg, #10b981, #059669)",
                        border: "1px solid #34d399",
                      }}
                    >
                      <b style={{ color: "#ffffff", fontWeight: 800 }}>TRL</b>
                      <i /><i /><i />
                    </span>
                    <span
                      className="ref-gold-icon"
                      style={{ background: "#ea580c", borderColor: "#fdba74" }}
                    >
                      <Coins size={14} strokeWidth={2.2} />
                    </span>
                  </span>
                  <span style={{ fontSize: 11.5, color: "#334155", fontWeight: 500, lineHeight: 1.3, textAlign: "center" }}>
                    Trả lương
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Card Phải: BÁO CÁO */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                BÁO CÁO
              </h3>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Bullet report 1 */}
              <div
                onClick={() => setPreviewReport("Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                  lineHeight: 1.45,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
              >
                <span style={{ fontSize: 16, lineHeight: 1, color: "#1e293b" }}>•</span>
                <span>Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)</span>
              </div>

              {/* Bullet report 2 */}
              <div
                onClick={() => setPreviewReport("Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                  lineHeight: 1.45,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
              >
                <span style={{ fontSize: 16, lineHeight: 1, color: "#1e293b" }}>•</span>
                <span>Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)</span>
              </div>

              {/* Bullet report 3 */}
              <div
                onClick={() => setPreviewReport("Báo cáo tổng hợp lương nhân viên")}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 13,
                  color: "#334155",
                  cursor: "pointer",
                  lineHeight: 1.45,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#00a862")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
              >
                <span style={{ fontSize: 16, lineHeight: 1, color: "#1e293b" }}>•</span>
                <span>Báo cáo tổng hợp lương nhân viên</span>
              </div>
            </div>

            {/* Bottom link: Tất cả báo cáo */}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <span
                onClick={() => navigateTo("reports")}
                style={{
                  color: "#0073e6",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                Tất cả báo cáo
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Thanh danh mục / Tiện ích dưới chân (Quick Links Bar) */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
            overflow: "hidden",
          }}
        >
          {/* 1. Nhân viên */}
          <div
            onClick={() => setShowEmployeesModal(true)}
            style={{
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              borderRight: "1px solid #f1f5f9",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#fef3c7",
                display: "grid",
                placeItems: "center",
                color: "#d97706",
              }}
            >
              <Users size={18} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Nhân viên</span>
          </div>

          {/* 2. Ký hiệu chấm công */}
          <div
            onClick={() => setShowAttendanceSymbolsModal(true)}
            style={{
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              borderRight: "1px solid #f1f5f9",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#e6f4ea",
                display: "grid",
                placeItems: "center",
                color: "#00a862",
              }}
            >
              <Layers size={18} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Ký hiệu chấm công</span>
          </div>

          {/* 3. Biểu thuế TNCN */}
          <div
            onClick={() => setShowTaxBracketsModal(true)}
            style={{
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              borderRight: "1px solid #f1f5f9",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#e6f4ea",
                display: "grid",
                placeItems: "center",
                color: "#00a862",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800 }}>%</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Biểu thuế TNCN</span>
          </div>

          {/* 4. Quy định lương,... */}
          <div
            onClick={() => setShowRegulationsModal(true)}
            style={{
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              borderRight: "1px solid #f1f5f9",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#e6f4ea",
                display: "grid",
                placeItems: "center",
                color: "#00a862",
              }}
            >
              <ShieldCheck size={18} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Quy định lương,...</span>
          </div>

          {/* 5. Tùy chọn */}
          <div
            onClick={() => setShowOptionsModal(true)}
            style={{
              padding: "16px 12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#fef3c7",
                display: "grid",
                placeItems: "center",
                color: "#d97706",
              }}
            >
              <Sliders size={18} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Tùy chọn</span>
          </div>
        </div>

        {/* Row 3: Banner AMIS Chân Trang */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, maxWidth: "72%" }}>
            <span>
              <strong>Tự động hóa chấm công, quản lý và tính lương nâng cao</strong> cùng bộ ứng dụng{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  notify("Mở liên kết Sổ Việt Chấm công");
                }}
                style={{ color: "#0073e6", fontWeight: 600, textDecoration: "none" }}
              >
                Sổ Việt Chấm công
              </a>
              ,{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  notify("Mở liên kết Sổ Việt Tiền lương");
                }}
                style={{ color: "#0073e6", fontWeight: 600, textDecoration: "none" }}
              >
                Sổ Việt Tiền lương
              </a>
              .{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  notify("Kết nối API tự động hóa giữa Sổ Việt Tiền lương và Kế toán...");
                }}
                style={{ color: "#0073e6", fontWeight: 600, textDecoration: "none" }}
              >
                Kết nối ngay
              </a>{" "}
              với Sổ Việt Tiền lương để nhận dữ liệu hạch toán
            </span>
          </div>

          {/* Right Visual Flow Diagram */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Chấm công */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#ea580c",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                }}
              >
                <Clock size={16} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#475569" }}>Chấm công</span>
            </div>

            <div style={{ color: "#10b981", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
              ·······▶
            </div>

            {/* Tiền lương */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#00a862",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                $
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#475569" }}>Tiền lương</span>
            </div>

            <div style={{ color: "#10b981", fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
              ·······▶
            </div>

            {/* Kế toán */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0284c7 0%, #10b981 100%)",
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                }}
              >
                <Calculator size={16} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#475569" }}>Kế toán</span>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 2. TAB: CHẤM CÔNG (attendance)
  // =========================================================================
  if (tab === "attendance") {
    // 2.1 MÀN HÌNH CHÍNH (ẢNH 1 - GHI NHẬN CÔNG LÀM VIỆC CHO NHÂN VIÊN)
    if (attendanceMode === "empty") {
      return (
        <div
          style={{
            background: "#edf1f5",
            minHeight: "100%",
            padding: "20px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Main White Card matching Image 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flex: 1,
              minHeight: "calc(100vh - 120px)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Center Vector Illustration (matching Image 1) */}
            <div style={{ width: 220, height: 160, position: "relative", marginBottom: 20 }}>
              <svg width="220" height="160" viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Decorative dots & starbursts */}
                <circle cx="36" cy="42" r="2" fill="#00a862" opacity="0.6" />
                <circle cx="192" cy="48" r="2.5" fill="#00a862" opacity="0.6" />
                <circle cx="28" cy="100" r="2" fill="#00a862" opacity="0.5" />
                <circle cx="196" cy="115" r="2" fill="#00a862" opacity="0.5" />
                {/* 4-point green sparkle */}
                <path d="M42 66 L44 62 L48 60 L44 58 L42 54 L40 58 L36 60 L40 62 Z" fill="#10b981" opacity="0.75" />
                <path d="M126 128 L128 124 L132 122 L128 120 L126 116 L124 120 L120 122 L124 124 Z" fill="#10b981" opacity="0.75" />

                {/* Fingerprint Scanner Container Box */}
                <rect x="80" y="16" width="50" height="50" rx="10" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5" />
                {/* Reticle / scanner brackets */}
                <path d="M85 28 L85 21 C85 21 85 21 85 21 L92 21" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M125 28 L125 21 C125 21 125 21 125 21 L118 21" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M85 54 L85 61 C85 61 85 61 85 61 L92 61" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M125 54 L125 61 C125 61 125 61 125 61 L118 61" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                
                {/* Fingerprint curves inside */}
                <path d="M105 30 C99.5 30 96 33.5 96 39 C96 44.5 99.5 48 105 48 C110.5 48 114 44.5 114 39" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M105 35 C101.5 35 100 37 100 40 C100 43 102 44.5 105 44.5 C108 44.5 110 43 110 40" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M105 40 L105 41" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />
                <path d="M92 40 C92 32 97.5 27 105 27 C112.5 27 118 32 118 40 C118 47 113 52 105 52" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="1.5 1.5" />

                {/* Dotted curve connecting fingerprint to document */}
                <path d="M130 41 C160 41 168 52 168 70" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

                {/* 3 Green Employees below */}
                {/* Person 1 (Left) */}
                <circle cx="68" cy="85" r="7" fill="#00a862" />
                <path d="M57 107 C57 97 62 95 68 95 C74 95 79 97 79 107 Z" fill="#00a862" />

                {/* Person 2 (Center) */}
                <circle cx="105" cy="85" r="7" fill="#00a862" />
                <path d="M94 107 C94 97 99 95 105 95 C111 95 116 97 116 107 Z" fill="#00a862" />

                {/* Person 3 (Right) */}
                <circle cx="142" cy="85" r="7" fill="#00a862" />
                <path d="M131 107 C131 97 136 95 142 95 C148 95 153 97 153 107 Z" fill="#00a862" />

                {/* Document on the right with folded corner */}
                <path d="M160 66 L186 66 L198 78 L198 114 C198 116 196 118 194 118 L160 118 C158 118 156 116 156 114 L156 70 C156 68 158 66 160 66 Z" fill="#00a862" />
                <path d="M186 66 L186 78 L198 78 Z" fill="#a7f3d0" />
                {/* Horizontal lines on document */}
                <line x1="163" y1="86" x2="191" y2="86" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="163" y1="94" x2="186" y2="94" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="163" y1="102" x2="180" y2="102" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 16.5,
                fontWeight: 700,
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              Ghi nhận công làm việc cho nhân viên
            </h3>

            {/* Button Thêm */}
            <button
              id="btn-add-attendance"
              type="button"
              onClick={() => setShowAddAttendanceModal(true)}
              style={{
                height: 36,
                padding: "0 30px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
              }}
            >
              Thêm
            </button>

            {/* Bottom Button: Xem danh sách chứng từ */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setAttendanceMode("sheet_view")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  color: "#00a862",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // 2.2 DANH SÁCH / BẢNG CHẤM CÔNG CHI TIẾT (KHI BẤM XEM DANH SÁCH CHỨNG TỪ HOẶC SAU KHI TẠO)
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Toolbar */}
        <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setAttendanceMode("empty")}
              style={{
                height: 30,
                padding: "0 10px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title="Quay lại màn hình giới thiệu"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>

            <div style={{ position: "relative", width: 200 }}>
              <Search size={14} style={{ position: "absolute", left: 9, top: 8, color: "#64748b" }} />
              <input
                type="text"
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                placeholder="Tìm nhân viên..."
                style={{ width: "100%", height: 30, padding: "0 10px 0 30px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5 }}
              />
            </div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ height: 30, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, background: "#ffffff" }}
            >
              <option value="all">Tất cả phòng ban</option>
              <option value="văn phòng">Khối Văn phòng</option>
              <option value="sản xuất">Phân xưởng Sản xuất</option>
              <option value="kinh doanh">Phòng Kinh doanh</option>
            </select>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Kỳ: <strong>Tháng 09/2026</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddAttendanceModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Plus size={14} /> Thêm bảng chấm công
            </button>
            <button
              type="button"
              onClick={() => notify("Đang đồng bộ dữ liệu từ máy chấm công vân tay...")}
              style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <RotateCw size={13} /> Đồng bộ máy chấm công
            </button>
            <button
              type="button"
              onClick={() => notify("Xuất bảng chấm công chi tiết ra Excel")}
              style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={13} /> Xuất Excel
            </button>
          </div>
        </div>

        {/* Attendance Matrix Table */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#334155", borderBottom: "2px solid #cbd5e1", height: 38 }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", width: 80, borderRight: "1px solid #e2e8f0" }}>Mã NV</th>
                  <th style={{ padding: "6px 12px", textAlign: "left", width: 160, borderRight: "1px solid #e2e8f0" }}>Họ và tên</th>
                  <th style={{ padding: "6px 12px", textAlign: "left", width: 140, borderRight: "1px solid #e2e8f0" }}>Phòng ban</th>
                  
                  {Array.from({ length: 20 }, (_, i) => (
                    <th key={i} style={{ padding: "4px 2px", textAlign: "center", width: 28, borderRight: "1px solid #f1f5f9", fontSize: 11 }}>
                      {i + 1}
                    </th>
                  ))}

                  <th style={{ padding: "6px 8px", textAlign: "center", background: "#f0fdf4", color: "#166534", fontWeight: 700, width: 60 }}>Tổng công</th>
                  <th style={{ padding: "6px 8px", textAlign: "center", background: "#eff6ff", color: "#1e40af", width: 50 }}>Phép</th>
                  <th style={{ padding: "6px 8px", textAlign: "center", background: "#fef2f2", color: "#991b1b", width: 50 }}>Nghỉ</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #e2e8f0", height: 34, background: idx % 2 === 0 ? "#ffffff" : "#fcfdfe" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: "#00a862", borderRight: "1px solid #e2e8f0" }}>{emp.id}</td>
                    <td style={{ padding: "6px 12px", fontWeight: 600, color: "#1e293b", borderRight: "1px solid #e2e8f0" }}>{emp.name}</td>
                    <td style={{ padding: "6px 12px", color: "#475569", borderRight: "1px solid #e2e8f0" }}>{emp.dept}</td>

                    {Array.from({ length: 20 }, (_, d) => {
                      const isWeekend = d % 7 === 5 || d % 7 === 6;
                      const symbol = isWeekend ? "" : d === 4 && idx === 1 ? "P" : d === 10 && idx === 3 ? "Ô" : "+";
                      return (
                        <td
                          key={d}
                          style={{
                            padding: "4px 2px",
                            textAlign: "center",
                            borderRight: "1px solid #f1f5f9",
                            background: isWeekend ? "#f8fafc" : "#ffffff",
                            fontWeight: 700,
                            color: symbol === "+" ? "#16a34a" : symbol === "P" ? "#2563eb" : symbol === "Ô" ? "#ea580c" : "#94a3b8",
                            cursor: "pointer",
                          }}
                          onClick={() => notify(`Chỉnh sửa công ngày ${d + 1}/09 của ${emp.name}`)}
                        >
                          {symbol}
                        </td>
                      );
                    })}

                    <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#166534", background: "#f0fdf4" }}>21.5</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", color: "#1e40af", background: "#eff6ff" }}>{idx === 1 ? 1 : 0}</td>
                    <td style={{ padding: "6px 8px", textAlign: "center", color: "#991b1b", background: "#fef2f2" }}>0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div style={{ height: 38, background: "#f8fafc", borderTop: "1px solid #cbd5e1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", fontSize: 12.5, color: "#475569" }}>
          <span>Số nhân sự đang hiển thị: <strong>{filteredEmployees.length}</strong></span>
          <div style={{ display: "flex", gap: 14 }}>
            <span><strong style={{ color: "#16a34a" }}>+</strong>: Làm đủ ngày</span>
            <span><strong style={{ color: "#2563eb" }}>P</strong>: Nghỉ phép năm</span>
            <span><strong style={{ color: "#ea580c" }}>Ô</strong>: Nghỉ ốm</span>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 3. TAB: TỔNG HỢP CHẤM CÔNG (attendance-summary)
  // =========================================================================
  if (tab === "attendance-summary") {
    // 3.1 MÀN HÌNH CHÍNH (ẢNH 1 - LẬP VÀ QUẢN LÝ BẢNG TỔNG HỢP CHẤM CÔNG NHÂN VIÊN)
    if (summaryMode === "empty") {
      return (
        <div
          style={{
            background: "#edf1f5",
            minHeight: "100%",
            padding: "20px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Main White Card matching Image 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flex: 1,
              minHeight: "calc(100vh - 120px)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Center Vector Illustration (matching Image 1) */}
            <div style={{ width: 220, height: 160, position: "relative", marginBottom: 20 }}>
              <svg width="220" height="160" viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Decorative dots & starbursts */}
                <circle cx="36" cy="42" r="2" fill="#00a862" opacity="0.6" />
                <circle cx="192" cy="48" r="2.5" fill="#00a862" opacity="0.6" />
                <circle cx="28" cy="100" r="2" fill="#00a862" opacity="0.5" />
                <circle cx="196" cy="115" r="2" fill="#00a862" opacity="0.5" />
                {/* 4-point green sparkle */}
                <path d="M42 66 L44 62 L48 60 L44 58 L42 54 L40 58 L36 60 L40 62 Z" fill="#10b981" opacity="0.75" />
                <path d="M126 128 L128 124 L132 122 L128 120 L126 116 L124 120 L120 122 L124 124 Z" fill="#10b981" opacity="0.75" />

                {/* Fingerprint Scanner Container Box */}
                <rect x="80" y="16" width="50" height="50" rx="10" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1.5" />
                {/* Reticle / scanner brackets */}
                <path d="M85 28 L85 21 C85 21 85 21 85 21 L92 21" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M125 28 L125 21 C125 21 125 21 125 21 L118 21" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M85 54 L85 61 C85 61 85 61 85 61 L92 61" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M125 54 L125 61 C125 61 125 61 125 61 L118 61" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                
                {/* Fingerprint curves inside */}
                <path d="M105 30 C99.5 30 96 33.5 96 39 C96 44.5 99.5 48 105 48 C110.5 48 114 44.5 114 39" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M105 35 C101.5 35 100 37 100 40 C100 43 102 44.5 105 44.5 C108 44.5 110 43 110 40" stroke="#00a862" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M105 40 L105 41" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />
                <path d="M92 40 C92 32 97.5 27 105 27 C112.5 27 118 32 118 40 C118 47 113 52 105 52" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="1.5 1.5" />

                {/* Dotted curve connecting fingerprint to document */}
                <path d="M130 41 C160 41 168 52 168 70" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

                {/* 3 Green Employees below */}
                {/* Person 1 (Left) */}
                <circle cx="68" cy="85" r="7" fill="#00a862" />
                <path d="M57 107 C57 97 62 95 68 95 C74 95 79 97 79 107 Z" fill="#00a862" />

                {/* Person 2 (Center) */}
                <circle cx="105" cy="85" r="7" fill="#00a862" />
                <path d="M94 107 C94 97 99 95 105 95 C111 95 116 97 116 107 Z" fill="#00a862" />

                {/* Person 3 (Right) */}
                <circle cx="142" cy="85" r="7" fill="#00a862" />
                <path d="M131 107 C131 97 136 95 142 95 C148 95 153 97 153 107 Z" fill="#00a862" />

                {/* Document on the right with folded corner */}
                <path d="M160 66 L186 66 L198 78 L198 114 C198 116 196 118 194 118 L160 118 C158 118 156 116 156 114 L156 70 C156 68 158 66 160 66 Z" fill="#00a862" />
                <path d="M186 66 L186 78 L198 78 Z" fill="#a7f3d0" />
                {/* Horizontal lines on document */}
                <line x1="163" y1="86" x2="191" y2="86" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="163" y1="94" x2="186" y2="94" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="163" y1="102" x2="180" y2="102" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 16.5,
                fontWeight: 700,
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              Lập và quản lý bảng tổng hợp chấm công nhân viên
            </h3>

            {/* Button Thêm */}
            <button
              id="btn-add-summary"
              type="button"
              onClick={() => setShowAddSummaryModal(true)}
              style={{
                height: 36,
                padding: "0 30px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
              }}
            >
              Thêm
            </button>

            {/* Bottom Button: Xem danh sách chứng từ */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setSummaryMode("list_view")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  color: "#00a862",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // 3.2 DANH SÁCH BẢNG TỔNG HỢP CHẤM CÔNG (KHI BẤM XEM DANH SÁCH CHỨNG TỪ HOẶC SAU KHI TẠO)
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Toolbar with Back Button */}
        <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setSummaryMode("empty")}
              style={{
                height: 30,
                padding: "0 10px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title="Quay lại màn hình giới thiệu"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Kỳ: <strong>Tháng 09/2026</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddSummaryModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Plus size={14} /> Thêm tổng hợp chấm công
            </button>
            <button
              type="button"
              onClick={() => navigateTo("calculation")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Calculator size={14} /> Chuyển sang Tính lương
            </button>
          </div>
        </div>

        {/* KPI Banner */}
        <div style={{ padding: "16px 20px 0 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng số nhân sự chấm công</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>73 CBNV</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Số ngày công chuẩn / tháng</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb", marginTop: 4 }}>22.0 ngày</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng số ngày công thực tế</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#00a862", marginTop: 4 }}>1.584,5 công</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng giờ làm thêm (OT)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706", marginTop: 4 }}>320 giờ</div>
          </div>
        </div>

        {/* Table summary */}
        <div style={{ flex: 1, padding: "14px 20px 16px 20px", overflow: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table className="misa-table" style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#334155", borderBottom: "2px solid #cbd5e1", height: 38 }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Mã bảng</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên bảng tổng hợp chấm công</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Khối / Phòng ban</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Số CBNV</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Tổng ngày công</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Ngày lập</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Người lập</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #f1f5f9", height: 40 }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>THCC-2026-09-VP</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>Tổng hợp chấm công Khối Văn phòng Tháng 09/2026</td>
                  <td style={{ padding: "8px 12px", color: "#475569" }}>Khối Văn phòng</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>28</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>612.5</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>28/09/2026</td>
                  <td style={{ padding: "8px 12px" }}>Hoàng Thu Thảo</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 500 }}>
                      Đã duyệt
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => navigateTo("calculation")}
                      style={{ border: "none", background: "transparent", color: "#0073e6", cursor: "pointer", fontWeight: 600 }}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #f1f5f9", height: 40 }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>THCC-2026-09-SX</td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>Tổng hợp chấm công Phân xưởng SX Tháng 09/2026</td>
                  <td style={{ padding: "8px 12px", color: "#475569" }}>Phân xưởng Sản xuất</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>45</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>972.0</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>28/09/2026</td>
                  <td style={{ padding: "8px 12px" }}>Vũ Đình Trọng</td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 500 }}>
                      Đã duyệt
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => navigateTo("calculation")}
                      style={{ border: "none", background: "transparent", color: "#0073e6", cursor: "pointer", fontWeight: 600 }}
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 4. TAB: TÍNH LƯƠNG (calculation)
  // =========================================================================
  if (tab === "calculation") {
    // 4.1 MÀN HÌNH CHÍNH (ẢNH 1 - THỰC HIỆN LẬP BẢNG LƯƠNG VÀ TÍNH LƯƠNG ĐỊNH KỲ CHO NHÂN VIÊN)
    if (calcMode === "empty") {
      return (
        <div
          style={{
            background: "#edf1f5",
            minHeight: "100%",
            padding: "20px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Main White Card matching Image 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flex: 1,
              minHeight: "calc(100vh - 120px)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Center Vector Illustration (matching Image 1) */}
            <div style={{ width: 240, height: 160, position: "relative", marginBottom: 20 }}>
              <svg width="240" height="160" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Decorative dots & plus marks */}
                <circle cx="28" cy="72" r="2" fill="#00a862" opacity="0.6" />
                <circle cx="120" cy="28" r="2.5" fill="#00a862" opacity="0.5" />
                <circle cx="126" cy="142" r="2" fill="#00a862" opacity="0.6" />
                <circle cx="218" cy="80" r="2" fill="#00a862" opacity="0.5" />
                {/* Small plus marks */}
                <path d="M48 36 L52 36 M50 34 L50 38" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M198 126 L202 126 M200 124 L200 128" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

                {/* 3 Horizontal track capsules */}
                {/* Track 1 (top) */}
                <rect x="75" y="44" width="90" height="16" rx="8" fill="#f1f5f9" />
                {/* Track 2 (middle) */}
                <rect x="75" y="72" width="90" height="16" rx="8" fill="#f1f5f9" />
                {/* Track 3 (bottom) */}
                <rect x="75" y="100" width="90" height="16" rx="8" fill="#f1f5f9" />

                {/* Document on the left */}
                <g>
                  {/* Base doc rect with folded top-right corner */}
                  <path d="M42 42 L68 42 L80 54 L80 114 C80 117 78 118 75 118 L42 118 C39 118 37 117 37 114 L37 47 C37 44 39 42 42 42 Z" fill="#e2e8f0" />
                  {/* Folded corner in green */}
                  <path d="M68 42 L68 54 L80 54 Z" fill="#00a862" />
                  {/* Horizontal lines on document */}
                  <line x1="45" y1="68" x2="68" y2="68" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="45" y1="78" x2="62" y2="78" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                  <line x1="45" y1="88" x2="56" y2="88" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                </g>

                {/* 3 Green Dollar Badges in the middle */}
                {/* Badge 1 (top) */}
                <circle cx="120" cy="52" r="11" fill="#00a862" />
                <text x="120" y="56" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">$</text>

                {/* Badge 2 (middle) */}
                <circle cx="120" cy="80" r="11" fill="#00a862" />
                <text x="120" y="84" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">$</text>

                {/* Badge 3 (bottom) */}
                <circle cx="120" cy="108" r="11" fill="#00a862" />
                <text x="120" y="112" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="sans-serif">$</text>

                {/* 3 Green Employee Avatars on the right */}
                {/* Avatar 1 (top) */}
                <g>
                  <circle cx="178" cy="46" r="6" fill="#00a862" />
                  <path d="M168 62 C168 55 172 54 178 54 C184 54 188 55 188 62 Z" fill="#00a862" />
                  {/* Mini dollar coin */}
                  <circle cx="187" cy="42" r="4.5" fill="#a7f3d0" />
                  <text x="187" y="44.5" textAnchor="middle" fill="#00a862" fontSize="7" fontWeight="bold">$</text>
                </g>

                {/* Avatar 2 (middle) */}
                <g>
                  <circle cx="178" cy="74" r="6" fill="#00a862" />
                  <path d="M168 90 C168 83 172 82 178 82 C184 82 188 83 188 90 Z" fill="#00a862" />
                  {/* Mini dollar coin */}
                  <circle cx="187" cy="70" r="4.5" fill="#a7f3d0" />
                  <text x="187" y="72.5" textAnchor="middle" fill="#00a862" fontSize="7" fontWeight="bold">$</text>
                </g>

                {/* Avatar 3 (bottom) */}
                <g>
                  <circle cx="178" cy="102" r="6" fill="#00a862" />
                  <path d="M168 118 C168 111 172 110 178 110 C184 110 188 111 188 118 Z" fill="#00a862" />
                  {/* Mini dollar coin */}
                  <circle cx="187" cy="98" r="4.5" fill="#a7f3d0" />
                  <text x="187" y="100.5" textAnchor="middle" fill="#00a862" fontSize="7" fontWeight="bold">$</text>
                </g>
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 16.5,
                fontWeight: 700,
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              Thực hiện lập bảng lương và tính lương định kỳ cho nhân viên
            </h3>

            {/* Button Thêm */}
            <button
              id="btn-add-salary"
              type="button"
              onClick={() => setShowAddSalarySheetModal(true)}
              style={{
                height: 36,
                padding: "0 30px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
              }}
            >
              Thêm
            </button>

            {/* Bottom Button: Xem danh sách chứng từ */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setCalcMode("sheet_view")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  color: "#00a862",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // 4.2 DANH SÁCH BẢNG LƯƠNG (KHI BẤM XEM DANH SÁCH CHỨNG TỪ HOẶC SAU KHI TẠO)
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Toolbar with Back Button */}
        <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setCalcMode("empty")}
              style={{
                height: 30,
                padding: "0 10px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title="Quay lại màn hình giới thiệu"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Kỳ tính lương: <strong>Tháng 09/2026</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAddSalarySheetModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Plus size={14} /> Thêm bảng lương
            </button>
            <button
              type="button"
              onClick={() => setShowSalaryPaymentModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <DollarSign size={14} /> Trả lương
            </button>
            <button
              type="button"
              onClick={() => navigateTo("posting")}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <FileText size={14} /> Hạch toán chi phí
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ padding: "16px 20px 0 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng quỹ lương tháng 09/2026</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>880.000.000 đ</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Trích nộp BHXH, BHYT, BHTN</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ea580c", marginTop: 4 }}>92.400.000 đ</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Thuế TNCN khấu trừ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706", marginTop: 4 }}>38.350.000 đ</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Thực lĩnh chuyển trả CBNV</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#00a862", marginTop: 4 }}>749.250.000 đ</div>
          </div>
        </div>

        {/* Salary Sheets List Table */}
        <div style={{ flex: 1, padding: "0 20px 16px 20px", overflow: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table className="misa-table" style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#334155", borderBottom: "2px solid #cbd5e1", height: 38 }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Mã bảng lương</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Tên bảng tính lương</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Phòng ban / Khối</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Số NV</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Tổng lương</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>BHXH khấu trừ</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Thuế TNCN</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Thực lĩnh</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái</th>
                  <th style={{ padding: "8px 12px", textAlign: "center" }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_SALARY_SHEETS.map((sheet) => (
                  <tr key={sheet.id} style={{ borderBottom: "1px solid #f1f5f9", height: 42 }}>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#00a862" }}>{sheet.id}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>{sheet.name}</td>
                    <td style={{ padding: "8px 12px", color: "#475569" }}>{sheet.dept}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>{sheet.employeeCount}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{formatVND(sheet.grossSalary)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#ea580c" }}>{formatVND(sheet.insuranceAmount)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#d97706" }}>{formatVND(sheet.taxAmount)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#00a862" }}>{formatVND(sheet.netSalary)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 500 }}>
                        {sheet.status}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => setShowSalaryDetailModal(sheet)}
                        style={{ border: "none", background: "transparent", color: "#0073e6", cursor: "pointer", fontWeight: 600 }}
                      >
                        Mở xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 5. TAB: HẠCH TOÁN CHI PHÍ (posting)
  // =========================================================================
  if (tab === "posting") {
    // 5.1 MÀN HÌNH CHÍNH (ẢNH 1 - THỰC HIỆN GHI NHẬN CHI PHÍ TIỀN LƯƠNG VÀO CÁC SỔ TƯƠNG ỨNG)
    if (postingMode === "empty") {
      return (
        <div
          style={{
            background: "#edf1f5",
            minHeight: "100%",
            padding: "20px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Main White Card matching Image 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flex: 1,
              minHeight: "calc(100vh - 120px)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Center Vector Illustration (matching Image 1) */}
            <div style={{ width: 220, height: 160, position: "relative", marginBottom: 20 }}>
              <svg width="220" height="160" viewBox="0 0 220 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Subtle soft backdrop shape */}
                <ellipse cx="110" cy="85" rx="70" ry="26" fill="#f8fafc" />

                {/* Decorative sparkles & dots */}
                <circle cx="28" cy="85" r="2" fill="#00a862" opacity="0.6" />
                <circle cx="198" cy="74" r="2" fill="#00a862" opacity="0.5" />
                <path d="M152 38 L156 38 M154 36 L154 40" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M158 122 L162 122 M160 120 L160 124" stroke="#00a862" strokeWidth="1.5" strokeLinecap="round" />

                {/* Arc of green dots & Dollar coin above calculator */}
                <circle cx="85" cy="52" r="2.5" fill="#00a862" />
                <circle cx="94" cy="46" r="3" fill="#00a862" />
                <circle cx="92" cy="74" r="9" fill="#00a862" />
                <text x="92" y="77.5" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">$</text>

                {/* Curved dotted line connecting calculator to ledger */}
                <path d="M85 96 C115 102 120 78 140 76" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />

                {/* Left: Calculator in green */}
                <g>
                  {/* Body */}
                  <rect x="52" y="74" width="34" height="46" rx="5" fill="#00a862" />
                  {/* Screen */}
                  <rect x="57" y="79" width="24" height="10" rx="2" fill="#ffffff" />
                  {/* Buttons 3x3 */}
                  <circle cx="62" cy="95" r="2" fill="#ffffff" />
                  <circle cx="69" cy="95" r="2" fill="#ffffff" />
                  <circle cx="76" cy="95" r="2" fill="#ffffff" />
                  <circle cx="62" cy="102" r="2" fill="#ffffff" />
                  <circle cx="69" cy="102" r="2" fill="#ffffff" />
                  <circle cx="76" cy="102" r="2" fill="#ffffff" />
                  <circle cx="62" cy="109" r="2" fill="#ffffff" />
                  <circle cx="69" cy="109" r="2" fill="#ffffff" />
                  <rect x="74" y="107" width="4" height="4" rx="1" fill="#a7f3d0" />
                </g>

                {/* Right: Ledger Book in green */}
                <g>
                  {/* Book outer */}
                  <rect x="138" y="52" width="42" height="48" rx="4" fill="#00a862" />
                  {/* Inner white display */}
                  <rect x="144" y="58" width="30" height="36" rx="2" fill="#ffffff" />
                  {/* Spine line */}
                  <line x1="144" y1="94" x2="174" y2="94" stroke="#00a862" strokeWidth="2" strokeLinecap="round" />
                  {/* Up and Down Arrows ⇵ inside ledger */}
                  {/* Down arrow (left) */}
                  <line x1="152" y1="66" x2="152" y2="78" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M149 74 L152 78 L155 74" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Up arrow (right) */}
                  <line x1="166" y1="66" x2="166" y2="78" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M163 70 L166 66 L169 70" stroke="#00a862" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </svg>
            </div>

            {/* Title */}
            <h3
              style={{
                margin: "0 0 20px 0",
                fontSize: 16.5,
                fontWeight: 700,
                color: "#1e293b",
                textAlign: "center",
              }}
            >
              Thực hiện ghi nhận chi phí tiền lương vào các sổ tương ứng
            </h3>

            {/* Button Thêm */}
            <button
              type="button"
              onClick={() => {
                setIsSelectSalaryDropdownOpen(true);
                setShowSelectSalaryModal(true);
              }}
              style={{
                height: 36,
                padding: "0 30px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
              }}
            >
              Thêm
            </button>

            {/* Bottom Button: Xem danh sách chứng từ */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => setPostingMode("voucher_view")}
                style={{
                  height: 36,
                  padding: "0 22px",
                  background: "#ffffff",
                  color: "#00a862",
                  border: "1px solid #10b981",
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0fdf4";
                  e.currentTarget.style.borderColor = "#059669";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff";
                  e.currentTarget.style.borderColor = "#10b981";
                }}
              >
                Xem danh sách chứng từ
              </button>
            </div>
          </div>

          {renderModals()}
        </div>
      );
    }

    // 5.2 DANH SÁCH CHỨNG TỪ HẠCH TOÁN CHI PHÍ (KHI BẤM XEM DANH SÁCH CHỨNG TỪ HOẶC SAU KHI TẠO)
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Toolbar with Back Button */}
        <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setPostingMode("empty")}
              style={{
                height: 30,
                padding: "0 10px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title="Quay lại màn hình giới thiệu"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Kỳ hạch toán: <strong>Tháng 09/2026</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setIsSelectSalaryDropdownOpen(true);
                setShowSelectSalaryModal(true);
              }}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Plus size={14} /> Hạch toán chi phí lương
            </button>
            <button
              type="button"
              onClick={() => notify("Đang in sổ nhật ký chứng từ hạch toán...")}
              style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
            >
              <Printer size={14} /> In chứng từ
            </button>
          </div>
        </div>

        {/* Posting Vouchers List */}
        <div style={{ flex: 1, padding: 16, overflow: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {SAMPLE_POSTING_VOUCHERS.map((v) => (
            <div key={v.voucherNo} style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#00a862" }}>{v.voucherNo}</span>
                  <span style={{ fontSize: 13, color: "#475569" }}>Ngày hạch toán: <strong>{v.postDate}</strong></span>
                  <span style={{ fontSize: 13, color: "#1e293b", fontWeight: 600 }}>{v.description}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Tổng tiền: {formatVND(v.totalAmount)} đ</span>
                  <span style={{ padding: "2px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 11.5, fontWeight: 500 }}>
                    {v.status}
                  </span>
                </div>
              </div>

              {/* Lines table */}
              <div style={{ padding: "8px 16px" }}>
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#64748b", borderBottom: "1px solid #e2e8f0", height: 30 }}>
                      <th style={{ textAlign: "left", padding: "4px 8px" }}>Diễn giải định khoản</th>
                      <th style={{ textAlign: "center", width: 90, padding: "4px 8px" }}>TK Nợ</th>
                      <th style={{ textAlign: "center", width: 90, padding: "4px 8px" }}>TK Có</th>
                      <th style={{ textAlign: "right", width: 140, padding: "4px 8px" }}>Số tiền (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.lines.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f8fafc", height: 32 }}>
                        <td style={{ padding: "4px 8px", color: "#334155" }}>{line.desc}</td>
                        <td style={{ textAlign: "center", padding: "4px 8px", fontWeight: 600, color: "#2563eb" }}>{line.debitAcc}</td>
                        <td style={{ textAlign: "center", padding: "4px 8px", fontWeight: 600, color: "#d97706" }}>{line.creditAcc}</td>
                        <td style={{ textAlign: "right", padding: "4px 8px", fontWeight: 600, color: "#1e293b" }}>{formatVND(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 6. TAB: KHẤU TRỪ THUẾ TNCN (tax-deduction)
  // =========================================================================
  if (tab === "tax-deduction") {
    // 6.1 MÀN HÌNH CHÍNH (ẢNH 1 - BẠN CHƯA KẾT NỐI VỚI ỨNG DỤNG AMIS THUẾ TNCN)
    if (taxDeductionMode === "empty") {
      return (
        <div
          style={{
            background: "#edf1f5",
            minHeight: "100%",
            padding: "20px 24px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Main White Card matching Image 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
              flex: 1,
              minHeight: "calc(100vh - 120px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px 60px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Center Vector Illustration (matching Image 1) */}
            <div style={{ width: 240, height: 160, position: "relative", marginBottom: 26 }}>
              <svg width="240" height="160" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Desktop Monitor Stand Base */}
                <ellipse cx="120" cy="144" rx="46" ry="6" fill="#e2e8f0" opacity="0.7" />
                <ellipse cx="120" cy="140" rx="36" ry="5" fill="#cbd5e1" />
                {/* Stand Neck */}
                <path d="M112 110 L128 110 L132 140 L108 140 Z" fill="#94a3b8" />

                {/* Monitor Bezel */}
                <rect x="42" y="24" width="156" height="96" rx="6" fill="#64748b" />
                {/* Inner Screen */}
                <rect x="45" y="27" width="150" height="88" rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                <circle cx="120" cy="116" r="1.5" fill="#cbd5e1" />

                {/* Inside Screen Content */}
                {/* Soft backdrop */}
                <ellipse cx="120" cy="71" rx="48" ry="18" fill="#f8fafc" />

                {/* Left: Blue App Icon (MISA Kế toán) */}
                <rect x="62" y="56" width="28" height="28" rx="7" fill="#2563eb" />
                <path d="M68 76 L72 65 L76 72 L80 65 L84 76" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Middle: Connection Plug & Sparks */}
                <line x1="93" y1="70" x2="104" y2="70" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="2 2" />
                <circle cx="120" cy="70" r="14" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5" />
                {/* Plug connector pins */}
                <line x1="113" y1="64" x2="117" y2="64" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="113" y1="76" x2="117" y2="76" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" />
                {/* Plug block */}
                <rect x="116" y="62" width="11" height="16" rx="3" fill="#f97316" />
                {/* Lightning bolt inside plug */}
                <path d="M122 65 L119 70 L122 70 L120 75" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="136" y1="70" x2="147" y2="70" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="2 2" />

                {/* Right: AMIS Colorful Ring Logo */}
                <circle cx="172" cy="70" r="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />
                {/* Segments */}
                <circle cx="172" cy="70" r="10" fill="none" stroke="#2563eb" strokeWidth="3" strokeDasharray="16 32" strokeDashoffset="0" />
                <circle cx="172" cy="70" r="10" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="16 32" strokeDashoffset="-16" />
                <circle cx="172" cy="70" r="10" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="16 32" strokeDashoffset="-32" />
                <circle cx="172" cy="70" r="10" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="16 32" strokeDashoffset="-48" />
                <circle cx="172" cy="70" r="5" fill="#3b82f6" />
              </svg>
            </div>

            {/* Title (2 lines bold, exactly matching Image 1) */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 16.5,
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: 6,
                }}
              >
                Bạn chưa kết nối với ứng dụng Sổ Việt Thuế TNCN.
              </div>
              <div
                style={{
                  fontSize: 16.5,
                  fontWeight: 700,
                  color: "#1e293b",
                }}
              >
                Kết nối ngay để bắt đầu lập chứng từ khấu trừ thuế TNCN.
              </div>
            </div>

            {/* Button Kết nối ngay */}
            <button
              type="button"
              onClick={() => {
                notify("Đã kết nối thành công với ứng dụng Sổ Việt Thuế TNCN!");
                setTaxDeductionMode("detail_view");
              }}
              style={{
                height: 36,
                padding: "0 30px",
                background: "#00a862",
                color: "#ffffff",
                border: "none",
                borderRadius: 4,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0, 168, 98, 0.2)",
              }}
            >
              Kết nối ngay
            </button>
          </div>

          {renderModals()}
        </div>
      );
    }

    // 6.2 DANH SÁCH KHẤU TRỪ THUẾ TNCN (KHI ĐÃ KẾT NỐI VỚI AMIS THUẾ TNCN)
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f1f5f9" }}>
        {/* Toolbar with Back Button */}
        <div style={{ padding: "10px 20px", background: "#ffffff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setTaxDeductionMode("empty")}
              style={{
                height: 30,
                padding: "0 10px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              title="Quay lại màn hình kết nối"
            >
              <ArrowLeft size={14} /> Quay lại
            </button>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Kỳ thuế: <strong>Quý 3/2026 (Tháng 09/2026)</strong> • <span style={{ color: "#00a862", fontWeight: 600 }}>● Đã kết nối Sổ Việt Thuế TNCN</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={() => notify("Lập tờ khai thuế TNCN mẫu 05/KK-TNCN thành công!")}
              style={{ height: 30, padding: "0 12px", background: "#00a862", color: "#ffffff", border: "none", borderRadius: 4, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Plus size={14} /> Lập tờ khai 05/KK-TNCN
            </button>
            <button
              type="button"
              onClick={() => notify("Kết xuất file XML tờ khai thuế nộp Cổng Tổng cục Thuế")}
              style={{ height: 30, padding: "0 12px", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 4, fontSize: 12.5, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
            >
              <Download size={14} /> Xuất XML nộp thuế
            </button>
            <button
              type="button"
              onClick={() => setShowTaxBracketsModal(true)}
              style={{ height: 30, padding: "0 12px", background: "#ffffff", color: "#00a862", border: "1px solid #00a862", borderRadius: 4, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              Xem biểu thuế lũy tiến
            </button>
          </div>
        </div>

        {/* KPI Header */}
        <div style={{ padding: "16px 20px 0 20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Số lao động nộp thuế</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>35 người</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng thu nhập chịu thuế</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>880.000.000 đ</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng giảm trừ gia cảnh & BH</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#2563eb", marginTop: 4 }}>496.500.000 đ</div>
          </div>
          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 6, border: "1px solid #cbd5e1" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>Tổng thuế TNCN đã khấu trừ</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706", marginTop: 4 }}>38.350.000 đ</div>
          </div>
        </div>

        {/* Deduction details table */}
        <div style={{ flex: 1, padding: "14px 20px 16px 20px", overflow: "auto" }}>
          <div style={{ background: "#ffffff", borderRadius: 6, border: "1px solid #cbd5e1", overflow: "hidden" }}>
            <table className="misa-table" style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", color: "#334155", borderBottom: "2px solid #cbd5e1", height: 38 }}>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã NV</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Họ và tên</th>
                  <th style={{ padding: "8px 10px", textAlign: "left" }}>Mã số thuế</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>TN chịu thuế</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Giảm trừ bản thân</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Giảm trừ NPT</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>Bảo hiểm trừ lương</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>TN tính thuế</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: "#d97706" }}>Thuế TNCN</th>
                </tr>
              </thead>
              <tbody>
                {(apiConnected ? (apiRows.salarySheets?.[0]?.lines || []).map((line: any) => ({
                  id: line.employee_code, name: line.employee_name, taxCode: "—", gross: apiNumber(line.gross),
                  insurance: apiNumber(line.employee_insurance), deductions: apiNumber(line.detail?.deductions),
                  taxable: apiNumber(line.taxable_income), tax: apiNumber(line.personal_income_tax),
                })) : SAMPLE_EMPLOYEES.map((emp) => ({
                  ...emp, gross: emp.salaryRate + emp.allowance,
                  insurance: Math.round(emp.salaryRate * 0.105), deductions: 11000000 + emp.dependents * 4400000,
                  taxable: Math.max(0, emp.salaryRate + emp.allowance - Math.round(emp.salaryRate * 0.105) - 11000000 - emp.dependents * 4400000),
                  tax: 0,
                }))).map((emp: any) => {
                  const gross = emp.gross, insurance = emp.insurance;
                  const selfDeduct = apiConnected ? apiNumber(payrollSettings?.personal_deduction) : 11000000;
                  const depDeduct = emp.deductions - selfDeduct;
                  const taxable = emp.taxable, tax = emp.tax;
                  return (
                    <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9", height: 36 }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#00a862" }}>{emp.id}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b" }}>{emp.name}</td>
                      <td style={{ padding: "8px 10px", color: "#64748b" }}>{emp.taxCode}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(gross)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(selfDeduct)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right" }}>{formatVND(depDeduct)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", color: "#ea580c" }}>{formatVND(insurance)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>{formatVND(taxable)}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#d97706" }}>{formatVND(tax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  // =========================================================================
  // 7. TAB: BÁO CÁO (reports) - EXACT MATCH USER SCREENSHOT
  // =========================================================================
  if (tab === "reports") {
    // Danh sách 3 báo cáo chuẩn xác theo ảnh chụp
    const reports = [
      {
        id: "R1",
        title: "Bảng tổng hợp thanh toán tiền lương (Bảng lương cố định)",
        col: 1,
      },
      {
        id: "R2",
        title: "Bảng tổng hợp thanh toán tiền lương (Bảng lương thời gian)",
        col: 2,
      },
      {
        id: "R3",
        title: "Báo cáo tổng hợp lương nhân viên",
        col: 1,
      },
    ];

    const filteredReports = reports.filter(
      (r) =>
        visibleReports.includes(r.title) &&
        (!reportSearch || r.title.toLowerCase().includes(reportSearch.toLowerCase()))
    );

    const col1Reports = filteredReports.filter((r) => r.col === 1);
    const col2Reports = filteredReports.filter((r) => r.col === 2);

    return (
      <div
        style={{
          background: "#f0f2f5",
          minHeight: "100%",
          padding: "16px 24px 30px 24px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Top Control Bar: Search & Options matching Screenshot */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Left: Input tìm kiếm & Link Sổ Việt AI cùng 1 dòng ngang */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative", width: 260 }}>
              {/* Purple Gradient Search Icon */}
              <div
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="url(#misaPurpleSearchGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <defs>
                    <linearGradient id="misaPurpleSearchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Tìm theo tên báo cáo"
                style={{
                  width: "100%",
                  height: 32,
                  padding: "0 10px 0 32px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  fontSize: 13,
                  color: "#1e293b",
                  background: "#ffffff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#8b5cf6")}
                onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
              />
            </div>

            {/* Dòng link Sổ Việt AI cùng 1 hàng */}
            <div
              onClick={() => {
                notify("Trợ lý Sổ Việt AI: Sẵn sàng tra cứu, phân tích quỹ lương và đề xuất biểu mẫu phù hợp");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#0073e6",
                cursor: "pointer",
                userSelect: "none",
                width: "fit-content",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              <span>Tìm kiếm nhanh báo cáo với Sổ Việt AI</span>
              <div
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #e0e7ff, #ede9fe)",
                  border: "1px solid #a5b4fc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                }}
              >
                <span style={{ fontSize: 10 }}>✨</span>
              </div>
            </div>
          </div>

          {/* Right: Ngôn ngữ báo cáo & Nút Ẩn/hiện báo cáo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>Ngôn ngữ báo cáo</span>
              <div style={{ position: "relative" }}>
                <select
                  value={reportLanguage}
                  onChange={(e) => {
                    setReportLanguage(e.target.value);
                    notify(`Đã chuyển đổi ngôn ngữ báo cáo sang: ${e.target.value}`);
                  }}
                  style={{
                    height: 32,
                    padding: "0 28px 0 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: 13,
                    color: "#1e293b",
                    background: "#ffffff",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                    minWidth: 150,
                  }}
                >
                  <option value="Tiếng Việt">Tiếng Việt</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Song ngữ Việt - Anh">Song ngữ Việt - Anh</option>
                </select>
                <ChevronDown
                  size={14}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    color: "#64748b",
                  }}
                />
              </div>
            </div>

            {/* Nút Ẩn/hiện báo cáo */}
            <button
              type="button"
              onClick={() => setShowReportVisibilityModal(true)}
              style={{
                height: 32,
                padding: "0 12px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                color: "#334155",
                display: "flex",
                alignItems: "center",
                gap: 6,
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
              {/* Icon mắt gạch chéo */}
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "#64748b" }}
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="23" x2="23" y2="1" />
              </svg>
              <span>Ẩn/hiện báo cáo</span>
            </button>

            {/* Nút icon layout vuông */}
            <button
              type="button"
              style={{
                height: 32,
                width: 32,
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                color: "#64748b",
              }}
              title="Chế độ hiển thị"
            >
              <Layers size={14} />
            </button>
          </div>
        </div>

        {/* Khung Card Lớn Màu Trắng Khớp 100% Ảnh Chụp */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            padding: "16px 20px",
            minHeight: 280,
            boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          }}
        >
          {filteredReports.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              <p style={{ fontSize: 13.5 }}>Không tìm thấy báo cáo phù hợp với từ khóa "{reportSearch}"</p>
              <button
                type="button"
                onClick={() => setReportSearch("")}
                style={{
                  padding: "6px 14px",
                  background: "#00a862",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Xóa tìm kiếm
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                columnGap: 48,
                rowGap: 4,
              }}
            >
              {/* Cột 1 (trái) */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {col1Reports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setPreviewReport(r.title)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const textEl = e.currentTarget.querySelector(".misa-report-name") as HTMLElement;
                      if (textEl) textEl.style.color = "#0073e6";
                      const imgBtn = e.currentTarget.querySelector(".misa-report-preview-btn") as HTMLElement;
                      if (imgBtn) {
                        imgBtn.style.borderColor = "#0073e6";
                        imgBtn.style.background = "#eff6ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const textEl = e.currentTarget.querySelector(".misa-report-name") as HTMLElement;
                      if (textEl) textEl.style.color = "#1e293b";
                      const imgBtn = e.currentTarget.querySelector(".misa-report-preview-btn") as HTMLElement;
                      if (imgBtn) {
                        imgBtn.style.borderColor = "#cbd5e1";
                        imgBtn.style.background = "#ffffff";
                      }
                    }}
                  >
                    <span
                      className="misa-report-name"
                      style={{
                        fontSize: 13,
                        color: "#1e293b",
                        fontWeight: 400,
                        transition: "color 0.15s",
                      }}
                    >
                      {r.title}
                    </span>

                    {/* Nút xem mẫu hình ảnh bên phải */}
                    <div
                      className="misa-report-preview-btn"
                      title="Xem mẫu báo cáo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewReport(r.title);
                      }}
                      style={{
                        width: 24,
                        height: 22,
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cột 2 (phải) */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {col2Reports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setPreviewReport(r.title)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const textEl = e.currentTarget.querySelector(".misa-report-name") as HTMLElement;
                      if (textEl) textEl.style.color = "#0073e6";
                      const imgBtn = e.currentTarget.querySelector(".misa-report-preview-btn") as HTMLElement;
                      if (imgBtn) {
                        imgBtn.style.borderColor = "#0073e6";
                        imgBtn.style.background = "#eff6ff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const textEl = e.currentTarget.querySelector(".misa-report-name") as HTMLElement;
                      if (textEl) textEl.style.color = "#1e293b";
                      const imgBtn = e.currentTarget.querySelector(".misa-report-preview-btn") as HTMLElement;
                      if (imgBtn) {
                        imgBtn.style.borderColor = "#cbd5e1";
                        imgBtn.style.background = "#ffffff";
                      }
                    }}
                  >
                    <span
                      className="misa-report-name"
                      style={{
                        fontSize: 13,
                        color: "#1e293b",
                        fontWeight: 400,
                        transition: "color 0.15s",
                      }}
                    >
                      {r.title}
                    </span>

                    {/* Nút xem mẫu hình ảnh bên phải */}
                    <div
                      className="misa-report-preview-btn"
                      title="Xem mẫu báo cáo"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewReport(r.title);
                      }}
                      style={{
                        width: 24,
                        height: 22,
                        borderRadius: 3,
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tab neo nhỏ mép phải màn hình màu xanh dương ‹ */}
        <div
          title="Mở tiện ích bổ sung"
          onClick={() => notify("Tiện ích trợ giúp & Báo cáo nâng cao Sổ Việt ERP")}
          style={{
            position: "fixed",
            right: 0,
            top: "42%",
            width: 14,
            height: 48,
            background: "#0073e6",
            borderTopLeftRadius: 4,
            borderBottomLeftRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0, 115, 230, 0.4)",
            zIndex: 40,
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, marginLeft: -2 }}>‹</span>
        </div>

        {renderModals()}
      </div>
    );
  }

  // Fallback
  return <div style={{ padding: 20 }}>{renderModals()}</div>;
}
