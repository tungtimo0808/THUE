import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  ShieldCheck,
  Settings,
  Sparkles,
  Plus,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  FileText,
  Calendar,
  Layers,
  Check,
  X,
  ExternalLink,
  Briefcase,
  UserCheck,
  KeyRound,
  ShieldAlert,
  Search,
  Wallet,
  Landmark,
  ShoppingBag,
  ShoppingCart,
  Package,
  BarChart3,
  Receipt,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { MisaModuleApiExtensionPanel } from "./MisaModuleApiExtensionDrawer";
import "./admin-workspaces.css";

type TabKey = "overview" | "personnel" | "roles" | "config";

interface CompanyInfo {
  id: string;
  code: string;
  name: string;
  tax_code: string;
  status: string;
  legal_representative?: string;
  representative_title?: string;
  address?: string;
  accounting_regime?: string;
}

export function formatAccountingRegime(val?: string) {
  if (!val || val === "TT99" || val === "CIRCULAR_99") return "Thông tư 99/2025/TT-BTC";
  if (val === "TT200" || val === "CIRCULAR_200") return "Thông tư 200/2014/TT-BTC";
  if (val === "TT133" || val === "CIRCULAR_133") return "Thông tư 133/2016/TT-BTC";
  if (val === "TT88" || val === "CIRCULAR_88") return "Thông tư 88/2021/TT-BTC";
  return val;
}

interface EmployeeItem {
  id: string;
  code: string;
  full_name: string;
  email?: string;
  phone?: string;
  department_name?: string;
  department_id?: string;
  position_name?: string;
  position_id?: string;
  status: string;
  hire_date?: string;
}

interface OrgUnit {
  id: string;
  code: string;
  name: string;
}

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string;
  role_type: string;
  status: string;
  updated_at: string;
}

interface MatrixData {
  version: string;
  permission_codes: string[];
  affected_users: number;
}

interface PermissionItem {
  id: string;
  code: string;
  description: string;
  module_code?: string;
}

interface ModuleSetting {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface NumberingRule {
  id: string;
  voucher_type: string;
  prefix: string;
  padding_length: number;
}

interface FiscalPeriod {
  id: string;
  period_number: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface MemberRoleAssignment {
  id: string;
  role_id: string;
  role_code: string;
  role_name: string;
}

interface MemberItem {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  employee_code?: string;
  employee_branch_name?: string;
  employee_department_name?: string;
  role_assignments: MemberRoleAssignment[];
  effective_permissions?: string[];
  access_status?: string;
  joined_at?: string;
}

const ROLE_RANK_MAP: Record<string, number> = {
  COMPANY_ADMIN: 10,
  ADMIN: 10,
  KT_TRUONG: 20,
  THU_QUY: 30,
  KT_BANHANG: 40,
  KT_MUAHANG: 50,
  KT_KHO: 60,
  NVKD: 70,
};

const getMemberRank = (m: MemberItem): number => {
  if (m.email === "tungtimo0808@gmail.com") return 1;
  const assignments = m.role_assignments || [];
  let best = 999;
  for (const a of assignments) {
    const r = ROLE_RANK_MAP[a.role_code];
    if (r !== undefined && r < best) {
      best = r;
    }
  }
  if (best < 999) return best;
  if (assignments.length > 0) return 800;
  return 900;
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  COMPANY_ADMIN: "Quản trị viên Doanh nghiệp (Chủ sở hữu)",
  ADMIN: "Quản trị viên Doanh nghiệp",
  KT_TRUONG: "Kế toán trưởng",
  THU_QUY: "Thủ quỹ",
  KT_BANHANG: "Kế toán bán hàng & Công nợ phải thu",
  KT_MUAHANG: "Kế toán mua hàng & Công nợ phải trả",
  KT_KHO: "Thủ kho & Kế toán kho",
  NVKD: "Nhân viên kinh doanh",
};

const formatRoleDisplayName = (code: string, originalName?: string): string => {
  if (ROLE_DISPLAY_NAMES[code]) {
    return ROLE_DISPLAY_NAMES[code];
  }
  if (originalName) {
    return originalName.replace(/\s*\([A-Z0-9_-]+\)\s*$/gi, "").trim();
  }
  return code;
};

const PERMISSION_TRANSLATION_MAP: Record<string, { module: string; name: string; desc: string }> = {
  // Quỹ tiền mặt (CASH)
  "CASH.COUNT.ADJUST": { module: "Quỹ tiền mặt", name: "Xử lý chênh lệch quỹ tiền mặt", desc: "Lập và duyệt bút toán điều chỉnh chênh lệch tiền mặt sau kiểm kê" },
  "CASH.COUNT.COUNT": { module: "Quỹ tiền mặt", name: "Thực hiện kiểm kê quỹ tiền mặt", desc: "Nhập số lượng thực tế các mệnh giá tiền mặt trong két" },
  "CASH.COUNT.CREATE": { module: "Quỹ tiền mặt", name: "Lập biên bản kiểm kê quỹ", desc: "Tạo biên bản kiểm kê quỹ tiền mặt định kỳ hoặc đột xuất" },
  "CASH.COUNT.EDIT": { module: "Quỹ tiền mặt", name: "Chỉnh sửa biên bản kiểm kê quỹ", desc: "Cập nhật dữ liệu biên bản kiểm kê quỹ khi chưa chốt sổ" },
  "CASH.COUNT.VIEW": { module: "Quỹ tiền mặt", name: "Xem biên bản kiểm kê quỹ", desc: "Tra cứu danh sách và biên bản các đợt kiểm kê quỹ tiền mặt" },
  "CASH.FUND.VIEW": { module: "Quỹ tiền mặt", name: "Xem danh mục quỹ & số dư tiền mặt", desc: "Xem số dư tiền mặt tức thời theo từng quỹ và từng chi nhánh" },
  "CASH.TRANSACTION.CONFIRM": { module: "Quỹ tiền mặt", name: "Xác nhận thu / chi quỹ (Ký thủ quỹ)", desc: "Xác nhận thực thu hoặc thực xuất tiền mặt khỏi quỹ" },
  "CASH.TRANSACTION.VIEW": { module: "Quỹ tiền mặt", name: "Xem phiếu thu & phiếu chi tiền mặt", desc: "Tra cứu chứng từ thu chi tiền mặt trong hệ thống" },
  "CASH.PAYMENT.CREATE": { module: "Quỹ tiền mặt", name: "Lập phiếu chi tiền mặt", desc: "Tạo mới chứng từ phiếu chi thanh toán bằng tiền mặt" },
  "CASH.RECEIPT.CREATE": { module: "Quỹ tiền mặt", name: "Lập phiếu thu tiền mặt", desc: "Tạo mới chứng từ phiếu thu tiền vào quỹ" },
  "CASH.PAYMENT.EDIT": { module: "Quỹ tiền mặt", name: "Sửa phiếu chi tiền mặt", desc: "Chỉnh sửa thông tin phiếu chi chưa ghi sổ" },
  "CASH.RECEIPT.EDIT": { module: "Quỹ tiền mặt", name: "Sửa phiếu thu tiền mặt", desc: "Chỉnh sửa thông tin phiếu thu chưa ghi sổ" },

  // Báo cáo & Thống kê (RPT)
  "RPT.ASSET.EXPORT": { module: "Báo cáo & Thống kê", name: "Xuất file báo cáo tài sản cố định", desc: "Xuất khẩu file Excel / PDF báo cáo tình hình tài sản cố định" },
  "RPT.ASSET.PRINT": { module: "Báo cáo & Thống kê", name: "In báo cáo tài sản cố định", desc: "In trực tiếp bảng trích khấu hao và danh mục tài sản cố định" },
  "RPT.ASSET.VIEW": { module: "Báo cáo & Thống kê", name: "Xem báo cáo tài sản cố định", desc: "Tra cứu danh mục và phân bổ khấu hao tài sản cố định" },
  "RPT.CENTER.VIEW": { module: "Báo cáo & Thống kê", name: "Xem báo cáo theo trung tâm chi phí", desc: "Xem báo cáo doanh thu & chi phí theo từng phòng ban, bộ phận" },
  "RPT.COMMERCE.EXPORT": { module: "Báo cáo & Thống kê", name: "Xuất báo cáo bán hàng thương mại", desc: "Xuất dữ liệu doanh số và phân tích thương mại ra Excel" },
  "RPT.COMMERCE.PRINT": { module: "Báo cáo & Thống kê", name: "In báo cáo bán hàng thương mại", desc: "In bảng kê bán hàng và doanh thu theo mặt hàng / khách hàng" },
  "RPT.COMMERCE.VIEW": { module: "Báo cáo & Thống kê", name: "Xem báo cáo thương mại & bán hàng", desc: "Tra cứu báo cáo tổng hợp bán hàng và biên lợi nhuận" },
  "RPT.CONFIG.CREATE": { module: "Báo cáo & Thống kê", name: "Thiết lập mẫu báo cáo quản trị mới", desc: "Tạo cấu hình mẫu báo cáo quản trị nội bộ theo nhu cầu" },
  "RPT.CONFIG.DELETE": { module: "Báo cáo & Thống kê", name: "Xóa mẫu báo cáo quản trị", desc: "Gỡ bỏ các mẫu báo cáo quản trị tùy biến không sử dụng" },
  "RPT.CONFIG.EDIT": { module: "Báo cáo & Thống kê", name: "Chỉnh sửa mẫu báo cáo quản trị", desc: "Tùy biến chỉ tiêu, công thức và cột hiển thị báo cáo" },
  "RPT.CONFIG.VIEW": { module: "Báo cáo & Thống kê", name: "Xem danh mục cấu hình báo cáo", desc: "Xem danh sách và cấu trúc các mẫu báo cáo hiện có" },
  "RPT.DEBT.EXPORT": { module: "Báo cáo & Thống kê", name: "Xuất file báo cáo công nợ", desc: "Xuất khẩu bảng tổng hợp và chi tiết công nợ ra file Excel" },
  "RPT.DEBT.PRINT": { module: "Báo cáo & Thống kê", name: "In báo cáo công nợ", desc: "In biên bản đối chiếu công nợ và sổ chi tiết công nợ" },
  "RPT.DEBT.VIEW": { module: "Báo cáo & Thống kê", name: "Xem báo cáo tổng hợp công nợ", desc: "Tra cứu công nợ phải thu khách hàng và phải trả nhà cung cấp" },
  "RPT.FINANCE.VIEW": { module: "Báo cáo tài chính", name: "Xem Báo cáo Tài chính (BCTC)", desc: "Xem Bảng cân đối kế toán, Báo cáo KQKD, Lưu chuyển tiền tệ" },
  "RPT.FINANCE.EXPORT": { module: "Báo cáo tài chính", name: "Xuất bộ Báo cáo Tài chính", desc: "Xuất khẩu bộ Báo cáo tài chính đầy đủ theo chuẩn Thông tư 99/2025/TT-BTC" },
  "RPT.TAX.VIEW": { module: "Báo cáo thuế", name: "Xem tờ khai & Báo cáo thuế", desc: "Xem bảng kê thuế GTGT mua vào, bán ra và tờ khai tạm tính" },
  "RPT.INVENTORY.VIEW": { module: "Kho & Hàng tồn", name: "Xem báo cáo xuất nhập tồn kho", desc: "Xem thẻ kho, sổ chi tiết vật tư hàng hóa" },

  // Bán hàng & Công nợ (SAL & AR)
  "SAL.INVOICE.CREATE": { module: "Bán hàng", name: "Lập hóa đơn bán hàng", desc: "Tạo mới chứng từ bán hàng và xuất hóa đơn đầu ra" },
  "SAL.INVOICE.VIEW": { module: "Bán hàng", name: "Xem hóa đơn bán hàng", desc: "Tra cứu danh sách hóa đơn bán hàng và doanh thu" },
  "SAL.INVOICE.EDIT": { module: "Bán hàng", name: "Sửa hóa đơn bán hàng", desc: "Chỉnh sửa thông tin hóa đơn khi chưa phát hành hoặc ghi sổ" },
  "SAL.ORDER.CREATE": { module: "Bán hàng", name: "Lập đơn đặt hàng của khách", desc: "Tiếp nhận và lập đơn hàng từ khách hàng" },
  "SAL.ORDER.VIEW": { module: "Bán hàng", name: "Xem danh sách đơn đặt hàng", desc: "Theo dõi tiến độ thực hiện đơn bán hàng" },
  "AR.DEBT.VIEW": { module: "Công nợ phải thu", name: "Xem công nợ khách hàng", desc: "Theo dõi hạn mức nợ và tuổi nợ của từng khách hàng" },
  "AR.COLLECTION.CREATE": { module: "Công nợ phải thu", name: "Lập chứng từ thu nợ khách hàng", desc: "Ghi nhận thu tiền công nợ khách hàng" },

  // Mua hàng & Công nợ (PUR & AP)
  "PUR.INVOICE.CREATE": { module: "Mua hàng", name: "Lập chứng từ mua hàng & hóa đơn", desc: "Nhập thông tin hóa đơn và chi phí mua hàng đầu vào" },
  "PUR.INVOICE.VIEW": { module: "Mua hàng", name: "Xem chứng từ mua hàng", desc: "Tra cứu danh sách đơn mua và hóa đơn mua hàng" },
  "PUR.ORDER.CREATE": { module: "Mua hàng", name: "Lập đơn đặt mua hàng", desc: "Tạo đơn đặt mua vật tư hàng hóa gửi nhà cung cấp" },
  "AP.DEBT.VIEW": { module: "Công nợ phải trả", name: "Xem công nợ nhà cung cấp", desc: "Theo dõi các khoản phải thanh toán cho đối tác cung cấp" },
  "AP.PAYMENT.CREATE": { module: "Công nợ phải trả", name: "Lập chứng từ trả nợ nhà cung cấp", desc: "Thanh toán nợ cho nhà cung cấp" },

  // Kho (INV)
  "INV.INWARD.CREATE": { module: "Kho hàng hóa", name: "Lập phiếu nhập kho", desc: "Nhập vật tư hàng hóa vào các kho của công ty" },
  "INV.INWARD.VIEW": { module: "Kho hàng hóa", name: "Xem phiếu nhập kho", desc: "Tra cứu phiếu nhập kho và lịch sử nhập hàng" },
  "INV.OUTWARD.CREATE": { module: "Kho hàng hóa", name: "Lập phiếu xuất kho", desc: "Xuất hàng bán hoặc xuất chuyển kho nội bộ" },
  "INV.OUTWARD.VIEW": { module: "Kho hàng hóa", name: "Xem phiếu xuất kho", desc: "Tra cứu phiếu xuất kho và lịch sử xuất hàng" },
  "INV.STOCK.VIEW": { module: "Kho hàng hóa", name: "Xem tồn kho tức thời", desc: "Tra cứu số lượng và giá trị tồn kho tại từng kho" },

  // Ngân hàng (BANK)
  "BANK.STATEMENT.VIEW": { module: "Ngân hàng", name: "Xem sao kê & sổ tiền gửi ngân hàng", desc: "Xem số dư và các giao dịch chuyển khoản ngân hàng" },
  "BANK.PAYMENT.CREATE": { module: "Ngân hàng", name: "Lập ủy nhiệm chi (UNC)", desc: "Tạo lệnh chuyển tiền thanh toán qua ngân hàng" },
  "BANK.RECEIPT.CREATE": { module: "Ngân hàng", name: "Lập báo có ngân hàng", desc: "Ghi nhận tiền vào tài khoản ngân hàng" },

  // Sổ cái & Kế toán tổng hợp (GL)
  "GL.JOURNAL.CREATE": { module: "Sổ cái & Tổng hợp", name: "Lập chứng từ nghiệp vụ khác", desc: "Tạo các bút toán kết chuyển, điều chỉnh kế toán" },
  "GL.JOURNAL.VIEW": { module: "Sổ cái & Tổng hợp", name: "Xem sổ cái & chứng từ chung", desc: "Tra cứu toàn bộ bút toán định khoản kế toán" },
  "GL.PERIOD.CLOSE": { module: "Sổ cái & Tổng hợp", name: "Khóa sổ kế toán kỳ", desc: "Chốt số liệu kế toán cuối tháng hoặc cuối năm" },

  // Hệ thống & Quản trị (SYS)
  "SYS.USER.VIEW": { module: "Quản trị hệ thống", name: "Xem danh sách người dùng", desc: "Xem hồ sơ nhân sự và tài khoản trong doanh nghiệp" },
  "SYS.USER.CREATE": { module: "Quản trị hệ thống", name: "Thêm tài khoản nhân sự", desc: "Tạo tài khoản và mời thành viên vào doanh nghiệp" },
  "SYS.USER.EDIT": { module: "Quản trị hệ thống", name: "Phân quyền & Đổi vai trò", desc: "Cấp quyền hoặc thay đổi vai trò công việc cho nhân sự" },
  "SYS.ROLE.VIEW": { module: "Quản trị hệ thống", name: "Xem danh sách vai trò", desc: "Tra cứu danh mục vai trò và ma trận phân quyền" },
  "SYS.ROLE.EDIT": { module: "Quản trị hệ thống", name: "Chỉnh sửa ma trận quyền", desc: "Thiết lập quyền hạn chi tiết cho từng vai trò" },
};

const translatePermissionCode = (code: string): { module: string; name: string; desc: string } => {
  if (PERMISSION_TRANSLATION_MAP[code]) {
    return PERMISSION_TRANSLATION_MAP[code];
  }
  const parts = code.split(".");
  const prefix = parts[0] || "KHAC";
  const action = parts[parts.length - 1] || "VIEW";
  const mid = parts.slice(1, -1).join(" ");

  const MODULE_NAMES: Record<string, string> = {
    CASH: "Quỹ tiền mặt",
    BANK: "Tiền gửi ngân hàng",
    SAL: "Bán hàng & Doanh thu",
    PUR: "Mua hàng & Chi phí",
    INV: "Kho hàng hóa",
    AR: "Công nợ phải thu",
    AP: "Công nợ phải trả",
    GL: "Sổ cái & Tổng hợp",
    TAX: "Thuế & Kê khai",
    RPT: "Báo cáo & Phân tích",
    MD: "Danh mục dùng chung",
    SYS: "Quản trị hệ thống",
  };

  const ACTION_NAMES: Record<string, string> = {
    VIEW: "Xem và tra cứu",
    CREATE: "Thêm mới chứng từ / bản ghi",
    EDIT: "Chỉnh sửa thông tin",
    DELETE: "Xóa dữ liệu",
    CONFIRM: "Xác nhận nghiệp vụ",
    APPROVE: "Phê duyệt chứng từ",
    PRINT: "In ấn chứng từ & sổ sách",
    EXPORT: "Xuất dữ liệu Excel / PDF",
    ADJUST: "Điều chỉnh chênh lệch",
    COUNT: "Kiểm kê số liệu",
    POST: "Ghi sổ cái kế toán",
    UNPOST: "Bỏ ghi sổ cái kế toán",
  };

  const module = MODULE_NAMES[prefix] || `Phân hệ ${prefix}`;
  const actionName = ACTION_NAMES[action] || action;
  const name = `${actionName} (${module}${mid ? ` - ${mid}` : ""})`;
  const desc = `Quyền ${actionName.toLowerCase()} trong ${module.toLowerCase()}`;

  return { module, name, desc };
};

export default function CompanyAdminWorkspace() {
  const { token, companyId, companies, restoring } = useApiSession();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [_loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (restoring) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        <span style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải không gian quản trị...</span>
        <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Data states
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [positions, setPositions] = useState<OrgUnit[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [modules, setModules] = useState<ModuleSetting[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [numberingRules, setNumberingRules] = useState<NumberingRule[]>([]);

  // Search & Filter
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>("");
  const [memberScopeFilter, setMemberScopeFilter] = useState<"all" | "admin" | "staff">("all");
  const [roleSearch, setRoleSearch] = useState<string>("");

  // Role Matrix Management
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [roleMatrix, setRoleMatrix] = useState<MatrixData | null>(null);
  const [selectedPermCodes, setSelectedPermCodes] = useState<Set<string>>(new Set());
  const [matrixSaving, setMatrixSaving] = useState<boolean>(false);
  const [permSearch, setPermSearch] = useState<string>("");

  // Modals
  const [assignModalMember, setAssignModalMember] = useState<MemberItem | null>(null);
  const [targetRoleCode, setTargetRoleCode] = useState<string>("");
  const [assignReason, setAssignReason] = useState<string>("");
  const [assignSaving, setAssignSaving] = useState<boolean>(false);
  const [viewingPermsMember, setViewingPermsMember] = useState<MemberItem | null>(null);
  const [viewingPermSearch, setViewingPermSearch] = useState<string>("");
  const [selectedModalModule, setSelectedModalModule] = useState<string>("ALL");
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [employeeFormData, setEmployeeFormData] = useState({
    code: "",
    full_name: "",
    email: "",
    phone: "",
    department_id: "",
    position_id: "",
  });

  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [roleFormData, setRoleFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  // Load Initial Data (Fast essential load for Tab 1 & Tab 2)
  const loadWorkspaceData = async () => {
    const effectiveToken = token || localStorage.getItem("erp_token") || "";
    const effectiveCompanyId = companyId || localStorage.getItem("erp_company_id") || (companies.length > 0 ? companies[0].id : "");
    if (!effectiveToken || !effectiveCompanyId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      let activeComp = companies.find((c) => c.id === effectiveCompanyId);
      if (!activeComp) {
        try {
          activeComp = await request<any>(`/api/v1/organization/companies/${effectiveCompanyId}/`, effectiveToken);
        } catch {}
      }
      if (activeComp) {
        setCompanyInfo({
          id: activeComp.id,
          code: activeComp.code,
          name: activeComp.name,
          tax_code: activeComp.tax_code || "",
          status: activeComp.status || "ACTIVE",
          legal_representative: activeComp.legal_representative || "",
          accounting_regime: activeComp.accounting_regime || "TT99",
        });
      }

      // Load essential personnel & org data
      const [memRes, empRes, deptRes, posRes, roleRes] = await Promise.allSettled([
        request<MemberItem[] | { results: MemberItem[] }>(`/api/v1/iam/memberships/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<EmployeeItem[] | { results: EmployeeItem[] }>(`/api/v1/organization/employees/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<OrgUnit[] | { results: OrgUnit[] }>(`/api/v1/organization/departments/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<OrgUnit[] | { results: OrgUnit[] }>(`/api/v1/organization/positions/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<RoleItem[] | { results: RoleItem[] }>(`/api/v1/iam/roles/?company_id=${effectiveCompanyId}`, effectiveToken),
      ]);

      if (memRes.status === "fulfilled") {
        const val = memRes.value;
        setMembers(Array.isArray(val) ? val : val.results || []);
      }
      if (empRes.status === "fulfilled") {
        const val = empRes.value;
        setEmployees(Array.isArray(val) ? val : val.results || []);
      }
      if (deptRes.status === "fulfilled") {
        const val = deptRes.value;
        setDepartments(Array.isArray(val) ? val : val.results || []);
      }
      if (posRes.status === "fulfilled") {
        const val = posRes.value;
        setPositions(Array.isArray(val) ? val : val.results || []);
      }
      if (roleRes.status === "fulfilled") {
        const val = roleRes.value;
        const roleList = Array.isArray(val) ? val : val.results || [];
        setRoles(roleList);
        if (roleList.length > 0 && !selectedRole) {
          setSelectedRole(roleList[0]);
        }
      }
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể tải dữ liệu nhân sự doanh nghiệp." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [token, companyId, companies.length]);

  // Lazy load permissions when Tab 3 is clicked
  useEffect(() => {
    const effectiveToken = token || localStorage.getItem("erp_token") || "";
    const effectiveCompanyId = companyId || localStorage.getItem("erp_company_id") || (companies.length > 0 ? companies[0].id : "");
    if (activeTab === "roles" && allPermissions.length === 0 && effectiveToken && effectiveCompanyId) {
      request<PermissionItem[] | { results: PermissionItem[] }>(`/api/v1/iam/permissions/?company_id=${effectiveCompanyId}`, effectiveToken)
        .then((val) => {
          setAllPermissions(Array.isArray(val) ? val : val.results || []);
        })
        .catch(() => {});
    }
  }, [activeTab, allPermissions.length, token, companyId, companies.length]);

  // Lazy load config when Tab 4 is clicked
  useEffect(() => {
    const effectiveToken = token || localStorage.getItem("erp_token") || "";
    const effectiveCompanyId = companyId || localStorage.getItem("erp_company_id") || (companies.length > 0 ? companies[0].id : "");
    if (activeTab === "config" && modules.length === 0 && effectiveToken && effectiveCompanyId) {
      Promise.allSettled([
        request<ModuleSetting[] | { results: ModuleSetting[] }>(`/api/v1/common/modules/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<FiscalPeriod[] | { results: FiscalPeriod[] }>(`/api/v1/common/fiscal-periods/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<NumberingRule[] | { results: NumberingRule[] }>(`/api/v1/common/numbering-rules/?company_id=${effectiveCompanyId}`, effectiveToken),
      ]).then(([modRes, periodRes, ruleRes]) => {
        if (modRes.status === "fulfilled") {
          const val = modRes.value;
          setModules(Array.isArray(val) ? val : val.results || []);
        }
        if (periodRes.status === "fulfilled") {
          const val = periodRes.value;
          setPeriods(Array.isArray(val) ? val : val.results || []);
        }
        if (ruleRes.status === "fulfilled") {
          const val = ruleRes.value;
          setNumberingRules(Array.isArray(val) ? val : val.results || []);
        }
      });
    }
  }, [activeTab, modules.length, token, companyId]);

  // Load Role Matrix when selectedRole changes
  useEffect(() => {
    if (!token || !companyId || !selectedRole) {
      setRoleMatrix(null);
      setSelectedPermCodes(new Set());
      return;
    }
    request<MatrixData>(`/api/v1/iam/roles/${selectedRole.id}/matrix/?company_id=${companyId}`, token)
      .then((data) => {
        setRoleMatrix(data);
        setSelectedPermCodes(new Set(data.permission_codes || []));
      })
      .catch((err) => {
        setAlertMsg({ type: "error", text: `Không tải được quyền của vai trò ${selectedRole.name}: ${err.message}` });
      });
  }, [selectedRole, token, companyId]);

  // Handle Seeding 6 Standard Business Roles
  const handleSeedStandardRoles = async () => {
    if (!token || !companyId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      const res: any = await request(`/api/v1/iam/roles/seed-standard/?company_id=${companyId}`, token, {
        method: "POST",
      });
      setAlertMsg({ type: "success", text: res.message || "Đã khởi tạo thành công bộ vai trò mẫu nghiệp vụ!" });
      loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Lỗi khi khởi tạo vai trò mẫu." });
    } finally {
      setLoading(false);
    }
  };

  // Save Role Matrix
  const handleSaveMatrix = async () => {
    if (!token || !companyId || !selectedRole || !roleMatrix) return;
    setMatrixSaving(true);
    setAlertMsg(null);
    try {
      await request(`/api/v1/iam/roles/${selectedRole.id}/set-matrix/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          version: roleMatrix.version,
          permission_codes: Array.from(selectedPermCodes),
          bundle_ids: [],
        }),
      });
      setAlertMsg({ type: "success", text: `Đã cập nhật quyền thành công cho vai trò ${selectedRole.name}.` });
      // Reload matrix
      const refreshed = await request<MatrixData>(`/api/v1/iam/roles/${selectedRole.id}/matrix/?company_id=${companyId}`, token);
      setRoleMatrix(refreshed);
      setSelectedPermCodes(new Set(refreshed.permission_codes || []));
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Lỗi khi lưu phân quyền cho Role." });
    } finally {
      setMatrixSaving(false);
    }
  };

  // Toggle single permission code
  const togglePermission = (code: string) => {
    setSelectedPermCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  // Create Employee
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !companyId) return;
    try {
      await request(`/api/v1/organization/employees/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          company: companyId,
          code: employeeFormData.code.trim().toUpperCase(),
          full_name: employeeFormData.full_name.trim(),
          email: employeeFormData.email.trim(),
          phone: employeeFormData.phone.trim(),
          department: employeeFormData.department_id || null,
          position: employeeFormData.position_id || null,
          status: "ACTIVE",
        }),
      });
      setAlertMsg({ type: "success", text: `Đã thêm thành công nhân viên ${employeeFormData.full_name}.` });
      setShowEmployeeModal(false);
      setEmployeeFormData({ code: "", full_name: "", email: "", phone: "", department_id: "", position_id: "" });
      loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể tạo nhân viên mới." });
    }
  };

  // Create Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !companyId) return;
    try {
      const newRole: any = await request(`/api/v1/iam/roles/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          code: roleFormData.code.trim().toUpperCase(),
          name: roleFormData.name.trim(),
          description: roleFormData.description.trim(),
        }),
      });
      setAlertMsg({ type: "success", text: `Đã tạo vai trò mới: ${roleFormData.name}.` });
      setShowRoleModal(false);
      setRoleFormData({ code: "", name: "", description: "" });
      setSelectedRole(newRole);
      loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể tạo vai trò mới." });
    }
  };

  // Group permissions by prefix/module for intuitive matrix view
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    const q = permSearch.toLowerCase().trim();

    allPermissions.forEach((p) => {
      if (q && !p.code.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
        return;
      }
      const prefix = p.code.split(".")[0] || "KHAC";
      let groupName = "Chức năng khác";
      if (prefix === "SYS") groupName = "Hệ thống & Người dùng (SYS)";
      else if (prefix === "CASH") groupName = "Quỹ tiền mặt (CASH)";
      else if (prefix === "BANK") groupName = "Tiền gửi ngân hàng (BANK)";
      else if (prefix === "SAL") groupName = "Bán hàng & Hóa đơn đầu ra (SAL)";
      else if (prefix === "PUR") groupName = "Mua hàng & Chi phí (PUR)";
      else if (prefix === "INV") groupName = "Kho & Hàng tồn kho (INV)";
      else if (prefix === "GL") groupName = "Sổ cái & Tổng hợp (GL)";
      else if (prefix === "TAX") groupName = "Thuế & Kê khai (TAX)";
      else if (prefix === "RPT") groupName = "Báo cáo & Phân tích (RPT)";
      else if (prefix === "MD") groupName = "Danh mục đối tượng, kho, hàng (MD)";
      else if (prefix === "AP") groupName = "Công nợ phải trả (AP)";
      else if (prefix === "AR") groupName = "Công nợ phải thu (AR)";

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });

    return groups;
  }, [allPermissions, permSearch]);

  // Handle Assign Role to Member
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !companyId || !assignModalMember || !targetRoleCode) return;
    setAssignSaving(true);
    setAlertMsg(null);
    try {
      const res: any = await request(`/api/v1/iam/members/assign-role/`, token, {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          membership_id: assignModalMember.id,
          role_code: targetRoleCode,
          reason: assignReason || `Admin đổi vai trò sang ${targetRoleCode}`,
        }),
      });
      setAlertMsg({ type: "success", text: res.message || "Đã phân vai trò thành công!" });
      setAssignModalMember(null);
      setTargetRoleCode("");
      setAssignReason("");
      // Refresh members
      const fresh: any = await request(`/api/v1/iam/memberships/?company_id=${companyId}`, token);
      setMembers(Array.isArray(fresh) ? fresh : fresh.results || []);
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể phân vai trò cho nhân sự." });
    } finally {
      setAssignSaving(false);
    }
  };

  // Filtered and sorted members for Tab 2 (sorted from HIGHEST rank to LOWEST rank)
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      const q = memberSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        (m.phone && m.phone.includes(q)) ||
        (m.employee_code && m.employee_code.toLowerCase().includes(q));

      const isCompanyAdmin =
        m.role_assignments?.some((r) => r.role_code === "COMPANY_ADMIN" || r.role_code === "ADMIN") ||
        m.email === "tungtimo0808@gmail.com";

      const matchScope =
        memberScopeFilter === "all" ||
        (memberScopeFilter === "admin" && isCompanyAdmin) ||
        (memberScopeFilter === "staff" && !isCompanyAdmin);

      const matchRole =
        !memberRoleFilter ||
        m.role_assignments?.some((r) => r.role_code === memberRoleFilter);

      return matchSearch && matchScope && matchRole;
    });

    return list.sort((a, b) => {
      const rankA = getMemberRank(a);
      const rankB = getMemberRank(b);
      if (rankA !== rankB) return rankA - rankB;
      return (a.full_name || a.email).localeCompare(b.full_name || b.email, "vi");
    });
  }, [members, memberSearch, memberScopeFilter, memberRoleFilter]);

  const adminMembersCount = useMemo(() => {
    return members.filter(
      (m) =>
        m.email === "tungtimo0808@gmail.com" ||
        m.role_assignments?.some((r) => r.role_code === "COMPANY_ADMIN" || r.role_code === "ADMIN")
    ).length;
  }, [members]);

  return (
    <div className="admin-workspace">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <div className="admin-header-title">
              <Building2 size={24} />
              <h1>Quản trị Doanh nghiệp: {companyInfo?.name || "Đang tải..."}</h1>
              <span className="admin-badge admin-badge-active">
                <CheckCircle2 size={12} /> {companyInfo?.status === "ACTIVE" || !companyInfo?.status ? "Hoạt động" : companyInfo?.status}
              </span>
            </div>
            <div className="admin-header-subtitle">
              <span>Mã DN: <strong>{companyInfo?.code}</strong></span>
              <span>MST: <strong>{companyInfo?.tax_code || "Chưa thiết lập"}</strong></span>
              <span>Đại diện: <strong>{companyInfo?.legal_representative || "Chưa có"}</strong></span>
              <span>Chế độ: <strong>{formatAccountingRegime(companyInfo?.accounting_regime || "TT99")}</strong></span>
            </div>
          </div>
          <div className="admin-header-actions">
            <button
              className="admin-btn admin-btn-light"
              onClick={handleSeedStandardRoles}
              title="Khởi tạo sẵn 6 vai trò mẫu: Kế toán trưởng, Kế toán bán hàng, Mua hàng, Thủ quỹ, Kế toán kho, NVKD"
            >
              <Sparkles size={15} /> Khởi tạo 6 vai trò mẫu
            </button>
            <Link to="/" className="admin-btn admin-btn-light">
              <ExternalLink size={15} /> Bàn làm việc Kế toán
            </Link>
            <Link to="/select-company" className="admin-btn admin-btn-light">
              <RefreshCw size={15} /> Đổi công ty
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="admin-nav-bar">
        <button
          className={`admin-nav-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          <Layers size={16} /> 1. Tổng quan Doanh nghiệp
        </button>
        <button
          className={`admin-nav-tab ${activeTab === "personnel" ? "active" : ""}`}
          onClick={() => setActiveTab("personnel")}
        >
          <Users size={16} /> 2. Nhân sự & Phân quyền ({members.length})
        </button>
        <button
          className={`admin-nav-tab ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          <ShieldCheck size={16} /> 3. Vai trò & Ma trận phân quyền ({roles.length})
        </button>
        <button
          className={`admin-nav-tab ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          <Settings size={16} /> 4. Cấu hình Hệ thống & Kế toán
        </button>
      </nav>

      {/* Alert Notification */}
      <div className="admin-container">
        {alertMsg && (
          <div className={`admin-alert ${alertMsg.type === "success" ? "admin-alert-success" : "admin-alert-error"}`}>
            <span>{alertMsg.text}</span>
            <button
              onClick={() => setAlertMsg(null)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === "overview" && (
          <div>
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-blue">
                  <Users size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Tổng nhân sự</h4>
                  <p>{Math.max(members.length, employees.length)}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-purple">
                  <ShieldCheck size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Vai trò phân quyền</h4>
                  <p>{roles.length}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-green">
                  <Briefcase size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Phòng ban / Đơn vị</h4>
                  <p>{departments.length}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-amber">
                  <Calendar size={22} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Kỳ kế toán</h4>
                  <p>{periods.length ? `${periods.length} kỳ` : "Đang mở"}</p>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <Building2 size={18} /> Thông tin Pháp lý & Hồ sơ Doanh nghiệp
                  </h3>
                  <Link to="/company-profile" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Sửa hồ sơ
                  </Link>
                </div>
                <div className="admin-card-body">
                  <table className="admin-table">
                    <tbody>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Tên doanh nghiệp</td>
                        <td><strong>{companyInfo?.name}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Mã số thuế</td>
                        <td><strong>{companyInfo?.tax_code || "Chưa đăng ký"}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Người đại diện pháp luật</td>
                        <td>{companyInfo?.legal_representative || "Chưa cập nhật"}</td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Chế độ kế toán áp dụng</td>
                        <td><strong>{formatAccountingRegime(companyInfo?.accounting_regime || "TT99")}</strong> (Áp dụng chính thức từ 01/01/2026 theo Bộ Tài chính)</td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Địa chỉ trụ sở</td>
                        <td>{companyInfo?.address || "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <KeyRound size={18} /> Phím tắt Thao tác Nhanh cho Admin
                  </h3>
                </div>
                <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                    onClick={handleSeedStandardRoles}
                  >
                    <Sparkles size={16} style={{ color: "var(--admin-primary)" }} /> Khởi tạo sẵn 6 vai trò mẫu nghiệp vụ (Kế toán trưởng, Thủ quỹ, Bán hàng, Mua hàng...)
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => {
                      setActiveTab("personnel");
                      setShowEmployeeModal(true);
                    }}
                  >
                    <Plus size={16} /> Thêm nhân viên mới vào công ty
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                    onClick={() => setActiveTab("roles")}
                  >
                    <ShieldCheck size={16} /> Tinh chỉnh ma trận quyền cho từng Role
                  </button>
                  <Link
                    to="/join-requests-admin"
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                  >
                    <UserCheck size={16} /> Duyệt nhân sự xin gia nhập doanh nghiệp
                  </Link>
                  <Link
                    to="/fiscal-periods"
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start" }}
                  >
                    <Calendar size={16} /> Khóa / Mở kỳ kế toán theo tháng & quý
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: PERSONNEL & ROLE ASSIGNMENTS ================= */}
        {activeTab === "personnel" && (
          <div>
            {/* Phân định Danh tính & Vai trò Doanh nghiệp */}
            <div
              style={{
                background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "1rem 1.25rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #fef08a 0%, #facc15 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#854d0e",
                    boxShadow: "0 2px 4px rgba(234, 179, 8, 0.3)",
                    border: "2px solid #ffffff",
                  }}
                >
                  <Sparkles size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                      Quản trị viên Doanh nghiệp (Chủ tài khoản):
                    </span>
                    <span className="admin-badge admin-badge-gold">
                      👑 {members.find(m => m.role_assignments?.some(r => r.role_code === "COMPANY_ADMIN"))?.email || companyInfo?.legal_representative || "Admin Doanh nghiệp"}
                    </span>
                  </div>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.825rem", color: "#475569" }}>
                    Quản trị viên Doanh nghiệp nắm toàn quyền quản trị và phân bổ vai trò cho toàn bộ nhân sự trong doanh nghiệp <strong>{companyInfo?.name}</strong>. Các tài khoản còn lại thuộc doanh nghiệp và được cấp quyền theo vai trò nghiệp vụ.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="admin-btn admin-btn-light"
                  style={{ background: "#ffffff", color: "var(--admin-primary)", border: "1px solid #bfdbfe" }}
                  onClick={handleSeedStandardRoles}
                  title="Khởi tạo sẵn 6 vai trò mẫu"
                >
                  <Sparkles size={14} /> Khởi tạo 6 vai trò mẫu
                </button>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={() => setShowEmployeeModal(true)}
                >
                  <Plus size={14} /> Thêm nhân viên
                </button>
              </div>
            </div>

            {/* Quick KPI stats for personnel */}
            <div className="admin-kpi-grid" style={{ marginBottom: "1.25rem" }}>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-blue">
                  <Users size={20} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Thành viên tài khoản</h4>
                  <p>{members.length}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-amber">
                  <Sparkles size={20} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Admin Doanh nghiệp</h4>
                  <p>{adminMembersCount}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-purple">
                  <UserCheck size={20} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Nhân sự nghiệp vụ</h4>
                  <p>{Math.max(0, members.length - adminMembersCount)}</p>
                </div>
              </div>
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon admin-kpi-icon-green">
                  <ShieldCheck size={20} />
                </div>
                <div className="admin-kpi-data">
                  <h4>Bộ vai trò hiện có</h4>
                  <p>{roles.length} vai trò</p>
                </div>
              </div>
            </div>

            {/* BẢNG CHÍNH: Danh sách Nhân sự & Phân bổ Vai trò */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3>
                  <ShieldCheck size={18} /> Danh sách Tài khoản & Phân quyền Vai trò ({filteredMembers.length})
                </h3>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                  <div className="admin-search-bar">
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Tìm theo tên, email, sđt..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      style={{ minWidth: 220 }}
                    />
                    <select
                      className="admin-select"
                      value={memberScopeFilter}
                      onChange={(e) => setMemberScopeFilter(e.target.value as any)}
                    >
                      <option value="all">Tất cả phân cấp</option>
                      <option value="admin">👑 Chỉ Admin Doanh nghiệp</option>
                      <option value="staff">👤 Chỉ Nhân sự nghiệp vụ</option>
                    </select>
                    <select
                      className="admin-select"
                      value={memberRoleFilter}
                      onChange={(e) => setMemberRoleFilter(e.target.value)}
                    >
                      <option value="">Tất cả vai trò</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.code}>
                          {formatRoleDisplayName(r.code, r.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 260, whiteSpace: "nowrap" }}>Thành viên / Tài khoản đăng nhập</th>
                      <th style={{ minWidth: 190, whiteSpace: "nowrap" }}>Phân cấp Quản trị</th>
                      <th style={{ minWidth: 240, whiteSpace: "nowrap" }}>Vai trò Nghiệp vụ hiện tại</th>
                      <th style={{ minWidth: 170, whiteSpace: "nowrap" }}>Phòng ban / Đơn vị</th>
                      <th style={{ minWidth: 110, whiteSpace: "nowrap" }}>Trạng thái</th>
                      <th style={{ width: 220, minWidth: 220, textAlign: "center", whiteSpace: "nowrap" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "2.5rem", color: "var(--admin-text-muted)" }}>
                          Không có thành viên nào phù hợp với bộ lọc tìm kiếm.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((m) => {
                        const isCompanyAdmin =
                          m.email === "tungtimo0808@gmail.com" ||
                          m.role_assignments?.some((r) => r.role_code === "COMPANY_ADMIN" || r.role_code === "ADMIN");

                        return (
                          <tr key={m.id} style={isCompanyAdmin ? { backgroundColor: "#fffbeb" } : undefined}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <div
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: "50%",
                                    background: isCompanyAdmin
                                      ? "linear-gradient(135deg, #fef08a 0%, #facc15 100%)"
                                      : "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
                                    color: isCompanyAdmin ? "#854d0e" : "#1e40af",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 700,
                                    fontSize: "0.9rem",
                                    boxShadow: isCompanyAdmin ? "0 1px 3px rgba(234, 179, 8, 0.4)" : "none",
                                    border: isCompanyAdmin ? "2px solid #eab308" : "1px solid #93c5fd",
                                    flexShrink: 0,
                                  }}
                                >
                                  {m.full_name ? m.full_name.charAt(0).toUpperCase() : "U"}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    <strong style={{ fontSize: "0.9rem", color: isCompanyAdmin ? "#92400e" : "#1e293b" }}>
                                      {m.full_name || m.email}
                                    </strong>
                                    {isCompanyAdmin && <Sparkles size={13} color="#eab308" />}
                                  </div>
                                  <div style={{ fontSize: "0.8rem", color: "#64748b", fontFamily: "monospace" }}>
                                    {m.email}
                                  </div>
                                  {m.phone && (
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                      SĐT: {m.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              {isCompanyAdmin ? (
                                <span className="admin-badge admin-badge-gold">
                                  👑 ADMIN DOANH NGHIỆP
                                </span>
                              ) : (
                                <span className="admin-badge admin-badge-blue">
                                  👤 NHÂN SỰ DOANH NGHIỆP
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                {m.role_assignments && m.role_assignments.length > 0 ? (
                                  m.role_assignments.map((ra) => {
                                    let badgeClass = "admin-badge-role";
                                    let icon = <Briefcase size={12} />;
                                    if (ra.role_code === "COMPANY_ADMIN" || ra.role_code === "ADMIN") {
                                      badgeClass = "admin-badge-gold";
                                      icon = <Sparkles size={12} />;
                                    } else if (ra.role_code === "KT_TRUONG") {
                                      badgeClass = "admin-badge-purple";
                                      icon = <ShieldCheck size={12} />;
                                    } else if (ra.role_code === "THU_QUY") {
                                      badgeClass = "admin-badge-active";
                                    } else if (ra.role_code === "KT_BANHANG") {
                                      badgeClass = "admin-badge-blue";
                                    } else if (ra.role_code === "KT_MUAHANG") {
                                      badgeClass = "admin-badge-pending";
                                    }
                                    return (
                                      <span key={ra.id || ra.role_code} className={`admin-badge ${badgeClass}`} style={{ whiteSpace: "nowrap" }}>
                                        {icon} {formatRoleDisplayName(ra.role_code, ra.role_name)}
                                      </span>
                                    );
                                  })
                                ) : (
                                  <span className="admin-badge admin-badge-suspended" style={{ whiteSpace: "nowrap" }}>
                                    Chưa phân vai trò
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div>
                                <span style={{ fontWeight: 500 }}>
                                  {m.employee_department_name || "Phòng Kế toán - Tài chính"}
                                </span>
                                {m.employee_code && (
                                  <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>
                                    Mã NV: {m.employee_code}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="admin-badge admin-badge-active">Hoạt động</span>
                            </td>
                            <td style={{ textAlign: "center", width: 220, minWidth: 220, whiteSpace: "nowrap" }}>
                              <div style={{ display: "inline-flex", gap: "0.45rem", alignItems: "center", justifyContent: "center", flexWrap: "nowrap" }}>
                                <button
                                  className="admin-btn admin-btn-primary admin-btn-sm"
                                  style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                                  onClick={() => {
                                    setAssignModalMember(m);
                                    setTargetRoleCode(m.role_assignments[0]?.role_code || "KT_TRUONG");
                                    setAssignReason(`Admin phân công vai trò cho ${m.full_name || m.email}`);
                                  }}
                                  title="Đổi vai trò và phân quyền nghiệp vụ cho nhân sự này"
                                >
                                  <SlidersHorizontal size={13} /> Đổi vai trò
                                </button>
                                <button
                                  className="admin-btn admin-btn-secondary admin-btn-sm"
                                  style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                                  onClick={() => {
                                    setViewingPermsMember(m);
                                    setViewingPermSearch("");
                                    setSelectedModalModule("ALL");
                                    setCollapsedModules({});
                                  }}
                                  title="Xem danh sách quyền thực tế"
                                >
                                  <KeyRound size={13} /> Quyền ({m.effective_permissions?.length || 0})
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sơ đồ phòng ban & Chức danh */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <Briefcase size={18} /> Danh sách Phòng ban / Đơn vị ({departments.length})
                  </h3>
                  <Link to="/organization-structure" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Quản lý cơ cấu
                  </Link>
                </div>
                <div className="admin-card-body">
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {departments.map((dept) => (
                      <li
                        key={dept.id}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <strong>{dept.name}</strong>
                          <span style={{ marginLeft: "0.5rem", color: "var(--admin-text-muted)", fontSize: "0.8rem" }}>
                            ({dept.code})
                          </span>
                        </div>
                        <span className="admin-badge admin-badge-active">Hoạt động</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <UserCheck size={18} /> Phê duyệt Gia nhập Doanh nghiệp
                  </h3>
                  <Link to="/join-requests-admin" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Xem toàn bộ
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Nhân viên khi đăng ký tài khoản có thể gửi yêu cầu gia nhập vào doanh nghiệp. Admin có quyền duyệt để nhân viên chính thức truy cập hệ thống.
                  </p>
                  <Link to="/join-requests-admin" className="admin-btn admin-btn-primary">
                    Mở trang xét duyệt yêu cầu gia nhập
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ROLES & PERMISSION MATRIX ================= */}
        {activeTab === "roles" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
                  Ma trận Vai trò & Phân quyền Chi tiết (RBAC)
                </h2>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "var(--admin-text-muted)" }}>
                  Chọn một vai trò bên trái để cấu hình chi tiết danh mục quyền được phép Xem, Lập, Sửa, Duyệt, Ghi sổ...
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="admin-btn admin-btn-primary" onClick={handleSeedStandardRoles}>
                  <Sparkles size={15} /> Khởi tạo 6 vai trò mẫu
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={() => setShowRoleModal(true)}>
                  <Plus size={15} /> Tạo vai trò mới
                </button>
              </div>
            </div>

            <div className="admin-matrix-layout">
              {/* Role Sidebar */}
              <div className="admin-role-sidebar">
                <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--admin-border)", backgroundColor: "#f8fafc" }}>
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: "100%" }}
                    placeholder="Tìm vai trò..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                  />
                </div>
                <div style={{ maxHeight: "650px", overflowY: "auto" }}>
                  {roles
                    .filter((r) => !roleSearch || r.name.toLowerCase().includes(roleSearch.toLowerCase()) || r.code.toLowerCase().includes(roleSearch.toLowerCase()))
                    .map((r) => (
                      <div
                        key={r.id}
                        className={`admin-role-item ${selectedRole?.id === r.id ? "active" : ""}`}
                        onClick={() => setSelectedRole(r)}
                      >
                        <div className="admin-role-code">{formatRoleDisplayName(r.code, r.name)}</div>
                        <div className="admin-role-name">
                          {r.role_type === "STANDARD" ? "Mẫu nghiệp vụ chuẩn" : "Vai trò tùy biến"}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Permission Matrix for Selected Role */}
              <div className="admin-card" style={{ marginBottom: 0 }}>
                <div className="admin-card-header">
                  <div>
                    <h3>
                      <ShieldCheck size={18} /> Phân quyền cho vai trò: <strong>{formatRoleDisplayName(selectedRole?.code || "", selectedRole?.name)}</strong>
                    </h3>
                    <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
                      Đang cấp <strong>{selectedPermCodes.size}</strong> quyền trong hệ thống.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Lọc mã quyền / mô tả..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                    />
                    <button
                      className="admin-btn admin-btn-success"
                      onClick={handleSaveMatrix}
                      disabled={matrixSaving}
                    >
                      <Check size={16} /> {matrixSaving ? "Đang lưu..." : "Lưu quyền"}
                    </button>
                  </div>
                </div>

                <div className="admin-card-body" style={{ maxHeight: "600px", overflowY: "auto" }}>
                  {Object.keys(groupedPermissions).length === 0 ? (
                    <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: "2rem" }}>
                      Không tìm thấy quyền phù hợp.
                    </p>
                  ) : (
                    Object.entries(groupedPermissions).map(([groupTitle, perms]) => (
                      <div key={groupTitle} style={{ marginBottom: "1.5rem" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            padding: "0.4rem 0.6rem",
                            backgroundColor: "#f1f5f9",
                            borderRadius: "4px",
                            marginBottom: "0.5rem",
                            color: "#1e293b",
                          }}
                        >
                          {groupTitle} ({perms.length})
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                          {perms.map((perm) => {
                            const isChecked = selectedPermCodes.has(perm.code);
                            const permInfo = translatePermissionCode(perm.code);
                            return (
                              <label
                                key={perm.id}
                                title={`Mã hệ thống: ${perm.code}`}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "0.6rem",
                                  padding: "0.55rem 0.75rem",
                                  borderRadius: "6px",
                                  border: isChecked ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                                  backgroundColor: isChecked ? "#eff6ff" : "#ffffff",
                                  cursor: "pointer",
                                  fontSize: "0.8rem",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(perm.code)}
                                  style={{ marginTop: "0.2rem" }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: isChecked ? "var(--admin-primary)" : "#1e293b", lineHeight: 1.35 }}>
                                    {permInfo.name || perm.description || perm.code}
                                  </div>
                                  <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.2rem", lineHeight: 1.35 }}>
                                    {permInfo.desc || perm.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: CONFIGURATION ================= */}
        {activeTab === "config" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {/* Modules Control */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <SlidersHorizontal size={18} /> Phân hệ Tính năng Doanh nghiệp
                  </h3>
                  <Link to="/modules" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Quản lý chi tiết
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Bật hoặc tắt các phân hệ nghiệp vụ tùy theo mô hình hoạt động (thương mại, dịch vụ, sản xuất).
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {modules.slice(0, 8).map((mod) => (
                      <li
                        key={mod.id || mod.code}
                        style={{
                          padding: "0.6rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong>{mod.name || mod.code}</strong>
                        <span className="admin-badge admin-badge-active">Đang bật</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Fiscal Periods */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <Calendar size={18} /> Quản lý Kỳ Kế toán & Năm Tài chính
                  </h3>
                  <Link to="/fiscal-periods" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Mở / Khóa kỳ
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Kiểm soát việc ghi sổ chứng từ theo từng tháng. Khi khóa kỳ, người dùng không thể lập hoặc sửa chứng từ trước ngày khóa.
                  </p>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Kỳ số</th>
                          <th>Ngày bắt đầu</th>
                          <th>Ngày kết thúc</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.slice(0, 6).map((p) => (
                          <tr key={p.id}>
                            <td>Kỳ {p.period_number}</td>
                            <td>{p.start_date}</td>
                            <td>{p.end_date}</td>
                            <td>
                              <span className={`admin-badge ${p.status === "OPEN" ? "admin-badge-active" : "admin-badge-pending"}`}>
                                {p.status === "OPEN" ? "Đang mở" : "Đã khóa"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Numbering Rules */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <FileText size={18} /> Quy tắc Sinh mã Chứng từ Tự động
                  </h3>
                  <Link to="/numbering-rules" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Tùy chỉnh mã
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Quy định định dạng tiền tố và độ dài số thứ tự cho các loại phiếu thu, phiếu chi, hóa đơn, phiếu nhập/xuất kho.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {numberingRules.slice(0, 5).map((rule) => (
                      <li
                        key={rule.id}
                        style={{
                          padding: "0.5rem 0",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{rule.voucher_type}</span>
                        <code>
                          {rule.prefix || "CT"}-{String(1).padStart(rule.padding_length || 5, "0")}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Audit Logs Link */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <ShieldAlert size={18} /> Nhật ký Kiểm toán & Bảo mật (Audit Log)
                  </h3>
                  <Link to="/audit-logs" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Tra cứu Log
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Ghi vết toàn bộ hành vi: Ai đã thêm, sửa, xóa, duyệt chứng từ, thay đổi tài khoản ngân hàng hoặc đổi cấu hình phân quyền trong công ty.
                  </p>
                  <Link to="/audit-logs" className="admin-btn admin-btn-primary">
                    Xem toàn bộ lịch sử thao tác
                  </Link>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <MisaModuleApiExtensionPanel
                moduleKey="iam_system"
                companyId={companyId || "abc"}
                notify={(text) => setAlertMsg({ type: "success", text })}
              />
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Thêm nhân viên mới */}
      {showEmployeeModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Thêm Nhân viên Mới</h3>
              <button className="admin-modal-close" onClick={() => setShowEmployeeModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateEmployee}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Mã nhân viên (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: NV001, KT01..."
                    required
                    value={employeeFormData.code}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Họ và tên (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: Nguyễn Văn A"
                    required
                    value={employeeFormData.full_name}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Email liên hệ</label>
                  <input
                    type="email"
                    className="admin-input"
                    placeholder="email@company.com"
                    value={employeeFormData.email}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="0987654321"
                    value={employeeFormData.phone}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Phòng ban / Đơn vị trực thuộc</label>
                  <select
                    className="admin-select"
                    value={employeeFormData.department_id}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, department_id: e.target.value })}
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label>Chức danh / Vị trí công việc</label>
                  <select
                    className="admin-select"
                    value={employeeFormData.position_id}
                    onChange={(e) => setEmployeeFormData({ ...employeeFormData, position_id: e.target.value })}
                  >
                    <option value="">Chọn chức danh</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Lưu nhân viên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tạo vai trò mới */}
      {showRoleModal && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>Tạo Vai trò Mới</h3>
              <button className="admin-modal-close" onClick={() => setShowRoleModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label>Mã vai trò (IN HOA, số hoặc gạch dưới) (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: KT_THANHTOAN, THUKHO..."
                    required
                    value={roleFormData.code}
                    onChange={(e) => setRoleFormData({ ...roleFormData, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Tên vai trò (*)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: Kế toán thanh toán"
                    required
                    value={roleFormData.name}
                    onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Mô tả nhiệm vụ của vai trò</label>
                  <textarea
                    className="admin-input"
                    rows={3}
                    placeholder="Mô tả phạm vi quyền hạn và trách nhiệm..."
                    value={roleFormData.description}
                    onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setShowRoleModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="admin-btn admin-btn-primary">
                  Tạo vai trò
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Phân công / Đổi vai trò cho Thành viên */}
      {assignModalMember && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3>
                <ShieldCheck size={20} color="var(--admin-primary)" /> Phân công / Đổi Vai trò Nhân sự
              </h3>
              <button
                className="admin-modal-close"
                onClick={() => setAssignModalMember(null)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAssignRole}>
              <div className="admin-modal-body">
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: "0.85rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ color: "#64748b", fontSize: "0.825rem" }}>Nhân sự được phân vai trò:</span>
                    <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>{assignModalMember.full_name || assignModalMember.email}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ color: "#64748b", fontSize: "0.825rem" }}>Email đăng nhập:</span>
                    <code style={{ fontSize: "0.825rem" }}>{assignModalMember.email}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontSize: "0.825rem" }}>Vai trò hiện tại:</span>
                    <span style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "0.825rem" }}>
                      {formatRoleDisplayName(assignModalMember.role_assignments[0]?.role_code, assignModalMember.role_assignments[0]?.role_name) || "Chưa gán vai trò"}
                    </span>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label>Chọn Vai trò Nghiệp vụ Mới (*)</label>
                  <select
                    className="admin-select"
                    required
                    value={targetRoleCode}
                    onChange={(e) => setTargetRoleCode(e.target.value)}
                  >
                    <option value="">-- Chọn vai trò nghiệp vụ --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.code}>
                        {formatRoleDisplayName(r.code, r.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Role Description Preview */}
                {targetRoleCode && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      fontSize: "0.8rem",
                      color: "#166534",
                      marginBottom: "1rem",
                    }}
                  >
                    <strong>Phạm vi nhiệm vụ:</strong>{" "}
                    {roles.find((r) => r.code === targetRoleCode)?.description || "Vai trò nghiệp vụ tiêu chuẩn của doanh nghiệp."}
                  </div>
                )}

                <div className="admin-form-group">
                  <label>Lý do phân công / Ghi chú</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="VD: Điều chuyển nhân sự, bổ nhiệm Kế toán trưởng..."
                    value={assignReason}
                    onChange={(e) => setAssignReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setAssignModalMember(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={assignSaving || !targetRoleCode}
                >
                  {assignSaving ? "Đang lưu..." : "Xác nhận & Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Xem danh sách quyền thực tế của Member (Đã Việt hóa & Nhóm nghiệp vụ) */}
      {viewingPermsMember && (() => {
        const rawPerms = viewingPermsMember.effective_permissions || [];
        const q = viewingPermSearch.toLowerCase().trim();

        const translated = rawPerms.map((code) => {
          const info = translatePermissionCode(code);
          return { code, ...info };
        });

        const filtered = translated.filter((p) => {
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            p.desc.toLowerCase().includes(q) ||
            p.module.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q)
          );
        });

        // Group by module
        const grouped: Record<string, typeof filtered> = {};
        filtered.forEach((p) => {
          if (!grouped[p.module]) grouped[p.module] = [];
          grouped[p.module].push(p);
        });

        const getModuleIcon = (mod: string) => {
          if (mod.includes("tiền mặt")) return <Wallet size={16} color="#16a34a" />;
          if (mod.includes("ngân hàng")) return <Landmark size={16} color="#0284c7" />;
          if (mod.includes("Bán hàng")) return <ShoppingBag size={16} color="#2563eb" />;
          if (mod.includes("Mua hàng")) return <ShoppingCart size={16} color="#d97706" />;
          if (mod.includes("Kho")) return <Package size={16} color="#7c3aed" />;
          if (mod.includes("Báo cáo")) return <BarChart3 size={16} color="#0d9488" />;
          if (mod.includes("Công nợ")) return <Receipt size={16} color="#b45309" />;
          if (mod.includes("Sổ cái") || mod.includes("Tổng hợp")) return <BookOpen size={16} color="#475569" />;
          return <ShieldCheck size={16} color="#0052cc" />;
        };

        const roleNames = viewingPermsMember.role_assignments.map((r) => formatRoleDisplayName(r.role_code, r.role_name)).join(", ") || "Chưa phân vai trò";

        const allModules = Object.keys(grouped);
        const isAllCollapsed = allModules.length > 0 && allModules.every((m) => !!collapsedModules[m]);

        const toggleCollapseAll = () => {
          if (isAllCollapsed) {
            setCollapsedModules({});
          } else {
            const next: Record<string, boolean> = {};
            allModules.forEach((m) => {
              next[m] = true;
            });
            setCollapsedModules(next);
          }
        };

        const toggleModuleCollapse = (moduleName: string) => {
          setCollapsedModules((prev) => ({
            ...prev,
            [moduleName]: !prev[moduleName],
          }));
        };

        return (
          <div className="admin-modal-backdrop" onClick={() => setViewingPermsMember(null)}>
            <div
              className="admin-modal admin-modal-lg"
              style={{
                maxWidth: 920,
                width: "95vw",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "12px",
                boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal-header" style={{ flexShrink: 0, padding: "1.1rem 1.5rem" }}>
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <KeyRound size={20} color="var(--admin-primary)" />
                    Quyền hạn thực tế: {viewingPermsMember.full_name || viewingPermsMember.email}
                  </h3>
                  <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Vai trò nghiệp vụ: <strong style={{ color: "var(--admin-primary)" }}>{roleNames}</strong> • Tổng cộng: <strong>{rawPerms.length} quyền nghiệp vụ</strong>
                  </div>
                </div>
                <button
                  className="admin-modal-close"
                  onClick={() => setViewingPermsMember(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div
                className="admin-modal-body"
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                }}
              >
                {/* Search bar & Collapse All button inside modal */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexShrink: 0 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Tìm kiếm quyền theo tên chức năng, nghiệp vụ hoặc phân hệ..."
                      value={viewingPermSearch}
                      onChange={(e) => setViewingPermSearch(e.target.value)}
                      style={{ width: "100%", paddingLeft: "2.35rem" }}
                    />
                    <Search size={15} color="#94a3b8" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)" }} />
                    {viewingPermSearch && (
                      <button
                        type="button"
                        onClick={() => setViewingPermSearch("")}
                        style={{
                          position: "absolute",
                          right: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#94a3b8",
                          display: "flex",
                          padding: 2,
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {allModules.length > 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      style={{ fontSize: "0.75rem", padding: "0 0.75rem", whiteSpace: "nowrap", flexShrink: 0 }}
                      onClick={toggleCollapseAll}
                    >
                      {isAllCollapsed ? "Mở rộng tất cả" : "Thu gọn tất cả"}
                    </button>
                  )}
                </div>

                {/* Module Quick Filter Chips */}
                {Object.keys(grouped).length > 1 && (
                  <div
                    className="admin-chips-scroll"
                    style={{ flexShrink: 0 }}
                  >
                    <button
                      type="button"
                      style={{
                        padding: "4px 10px",
                        borderRadius: "14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: selectedModalModule === "ALL" ? "1px solid #0284c7" : "1px solid #e2e8f0",
                        background: selectedModalModule === "ALL" ? "#eff6ff" : "#ffffff",
                        color: selectedModalModule === "ALL" ? "#0284c7" : "#64748b",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                      onClick={() => setSelectedModalModule("ALL")}
                    >
                      Tất cả ({filtered.length})
                    </button>
                    {Object.entries(grouped).map(([modName, items]) => (
                      <button
                        type="button"
                        key={modName}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "14px",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          border: selectedModalModule === modName ? "1px solid #0284c7" : "1px solid #e2e8f0",
                          background: selectedModalModule === modName ? "#eff6ff" : "#ffffff",
                          color: selectedModalModule === modName ? "#0284c7" : "#64748b",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          transition: "all 0.15s ease",
                        }}
                        onClick={() => setSelectedModalModule(modName)}
                      >
                        {modName} ({items.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Content list */}
                <div
                  className="admin-custom-scroll"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "0.85rem",
                    background: "#f8fafc",
                  }}
                >
                  {rawPerms.length === 0 ? (
                    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#94a3b8" }}>
                      Chưa có quyền hạn nào được kích hoạt cho tài khoản này. Vui lòng dùng nút "Đổi vai trò" để phân bổ vai trò nghiệp vụ.
                    </div>
                  ) : filtered.length === 0 ? (
                    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#94a3b8" }}>
                      Không tìm thấy quyền hạn nào khớp với từ khóa "<strong>{viewingPermSearch}</strong>".
                    </div>
                  ) : (
                    Object.entries(grouped)
                      .filter(([moduleName]) => selectedModalModule === "ALL" || selectedModalModule === moduleName)
                      .map(([moduleName, items]) => {
                        const isCollapsed = collapsedModules[moduleName];
                        return (
                          <div
                            key={moduleName}
                            style={{
                              background: "#ffffff",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                              marginBottom: "0.85rem",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              onClick={() => toggleModuleCollapse(moduleName)}
                              style={{
                                background: "#f1f5f9",
                                padding: "0.6rem 0.85rem",
                                borderBottom: isCollapsed ? "none" : "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>
                                {getModuleIcon(moduleName)}
                                <span>{moduleName}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span className="admin-badge admin-badge-blue" style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}>
                                  {items.length} quyền
                                </span>
                                {isCollapsed ? <ChevronDown size={16} color="#64748b" /> : <ChevronUp size={16} color="#64748b" />}
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div
                                style={{
                                  padding: "0.75rem",
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                                  gap: "0.6rem",
                                }}
                              >
                                {items.map((item) => (
                                  <div
                                    key={item.code}
                                    style={{
                                      background: "#f8fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "6px",
                                      padding: "0.55rem 0.75rem",
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "0.55rem",
                                      transition: "all 0.15s ease",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        background: "#dcfce7",
                                        color: "#166534",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        marginTop: 1,
                                      }}
                                    >
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: "0.825rem", color: "#0f172a", lineHeight: 1.3 }}>
                                        {item.name}
                                      </div>
                                      <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.2rem", lineHeight: 1.3 }}>
                                        {item.desc}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="admin-modal-footer" style={{ flexShrink: 0 }}>
                <div style={{ marginRight: "auto", fontSize: "0.8rem", color: "#64748b" }}>
                  Đang hiển thị <strong>{filtered.length}</strong> / {rawPerms.length} quyền được cấp
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => setViewingPermsMember(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
