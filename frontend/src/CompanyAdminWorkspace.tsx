import React, { useEffect, useState, useMemo, useRef } from "react";
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
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useApiSession } from "./ApiSession";
import { request } from "./live-api";
import { humanizeErrorMessage, showGlobalPopup } from "./global-popup";
import { MisaModuleApiExtensionPanel } from "./MisaModuleApiExtensionDrawer";
import MisaDropdownSelect, { DropdownOption } from "./MisaDropdownSelect";
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
  if (!val || val === "TT99" || val === "CIRCULAR_99") return "Thông tư 99/2025/TT-BTC (Chuẩn mực mới - Đầy đủ)";
  if (val === "TT200" || val === "CIRCULAR_200") return "Thông tư 200/2014/TT-BTC (Doanh nghiệp vừa & lớn)";
  if (val === "TT133" || val === "CIRCULAR_133") return "Thông tư 133/2016/TT-BTC (Doanh nghiệp nhỏ & vừa - SME)";
  if (val === "TT58" || val === "CIRCULAR_58") return "Thông tư 58/2026/TT-BTC (Doanh nghiệp siêu nhỏ)";
  if (val === "TT88" || val === "CIRCULAR_88") return "Thông tư 88/2021/TT-BTC (Hộ kinh doanh)";
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
  role_group?: string;
  is_system_admin?: boolean;
  permission_count?: number;
  active_user_count?: number;
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
  data_scope_set_id?: string | null;
  data_scope_set_name?: string | null;
  allow_all_company_data?: boolean;
}

interface MemberItem {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  employee_code?: string;
  employee_branch_id?: string | null;
  employee_branch_name?: string;
  employee_department_name?: string;
  role_assignments: MemberRoleAssignment[];
  effective_permissions?: string[];
  access_status?: string;
  joined_at?: string;
}

interface AdminJoinRequestItem {
  id: string;
  requester: string;
  requester_name: string;
  requester_email?: string;
  requester_phone?: string;
  message: string;
  status: string;
  status_display?: string;
  decision_reason?: string;
  internal_note?: string;
  decided_by_name?: string | null;
  decided_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

const ROLE_RANK_MAP: Record<string, number> = {
  ROLE_SUPER_ADMIN: 1,
  ROLE_ADMIN: 10,
  COMPANY_ADMIN: 10,
  ADMIN: 10,
  ROLE_DIRECTOR: 15,
  ROLE_CHIEF_ACCOUNTANT: 20,
  KT_TRUONG: 20,
  ROLE_GENERAL_ACCOUNTANT: 25,
  ROLE_TAX_ACCOUNTANT: 30,
  ROLE_AP_ACCOUNTANT: 35,
  ROLE_AR_ACCOUNTANT: 36,
  ROLE_PURCHASE_ACCOUNTANT: 40,
  KT_MUAHANG: 40,
  ROLE_SALES_ACCOUNTANT: 42,
  KT_BANHANG: 42,
  ROLE_CASH_ACCOUNTANT: 45,
  ROLE_BANK_ACCOUNTANT: 46,
  ROLE_INVENTORY_ACCOUNTANT: 50,
  ROLE_ASSET_ACCOUNTANT: 52,
  ROLE_CCDC_ACCOUNTANT: 54,
  ROLE_TREASURER: 60,
  THU_QUY: 60,
  ROLE_STOREKEEPER: 65,
  KT_KHO: 65,
  ROLE_PURCHASER: 70,
  ROLE_SALESPERSON: 72,
  NVKD: 72,
  ROLE_APPROVER: 80,
  ROLE_AUDITOR: 85,
  ROLE_REPORT_VIEWER: 90,
};

const isAdminRoleCode = (code?: string) =>
  code === "ROLE_ADMIN" || code === "COMPANY_ADMIN" || code === "ADMIN" || code === "ROLE_SUPER_ADMIN";

const getMemberRank = (m: MemberItem): number => {
  if (m.role_assignments?.some((r) => isAdminRoleCode(r.role_code))) return 1;
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
  ROLE_SUPER_ADMIN: "Super Admin (Quản trị Nền tảng)",
  ROLE_ADMIN: "Quản trị doanh nghiệp",
  COMPANY_ADMIN: "Quản trị doanh nghiệp",
  ADMIN: "Quản trị doanh nghiệp",
  ROLE_DIRECTOR: "Giám đốc",
  ROLE_CHIEF_ACCOUNTANT: "Kế toán trưởng",
  KT_TRUONG: "Kế toán trưởng",
  ROLE_GENERAL_ACCOUNTANT: "Kế toán tổng hợp",
  ROLE_TAX_ACCOUNTANT: "Kế toán thuế",
  ROLE_AP_ACCOUNTANT: "Kế toán phải trả",
  ROLE_AR_ACCOUNTANT: "Kế toán phải thu",
  ROLE_PURCHASE_ACCOUNTANT: "Kế toán mua hàng",
  KT_MUAHANG: "Kế toán mua hàng",
  ROLE_SALES_ACCOUNTANT: "Kế toán bán hàng",
  KT_BANHANG: "Kế toán bán hàng",
  ROLE_CASH_ACCOUNTANT: "Kế toán tiền mặt",
  ROLE_BANK_ACCOUNTANT: "Kế toán ngân hàng",
  ROLE_INVENTORY_ACCOUNTANT: "Kế toán kho",
  ROLE_ASSET_ACCOUNTANT: "Kế toán tài sản (TSCĐ)",
  ROLE_CCDC_ACCOUNTANT: "Kế toán CCDC",
  ROLE_TREASURER: "Thủ quỹ",
  THU_QUY: "Thủ quỹ",
  ROLE_STOREKEEPER: "Thủ kho",
  KT_KHO: "Thủ kho",
  ROLE_PURCHASER: "Nhân viên mua hàng",
  ROLE_SALESPERSON: "Nhân viên bán hàng",
  NVKD: "Nhân viên bán hàng",
  ROLE_APPROVER: "Người phê duyệt",
  ROLE_AUDITOR: "Kiểm tra / Kiểm toán",
  ROLE_REPORT_VIEWER: "Người xem báo cáo",
};

const ROLE_GROUP_MAP: Record<
  string,
  { group: string; label: string; groupVi: string; color: string; bg: string; badgeColor: string; badgeBg: string }
> = {
  ROLE_ADMIN: { group: "System", label: "Quản trị hệ thống", groupVi: "Quản trị hệ thống", color: "#92400e", bg: "#fef3c7", badgeColor: "#92400e", badgeBg: "#fef3c7" },
  COMPANY_ADMIN: { group: "System", label: "Quản trị hệ thống", groupVi: "Quản trị hệ thống", color: "#92400e", bg: "#fef3c7", badgeColor: "#92400e", badgeBg: "#fef3c7" },
  ROLE_DIRECTOR: { group: "Management", label: "Ban Giám đốc", groupVi: "Ban Giám đốc", color: "#6b21a8", bg: "#f3e8ff", badgeColor: "#6b21a8", badgeBg: "#f3e8ff" },
  ROLE_CHIEF_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_GENERAL_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_TAX_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_AP_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_AR_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_PURCHASE_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_SALES_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_CASH_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_BANK_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_INVENTORY_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_ASSET_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_CCDC_ACCOUNTANT: { group: "Accounting", label: "Kế toán", groupVi: "Kế toán", color: "#1e40af", bg: "#dbeafe", badgeColor: "#1e40af", badgeBg: "#dbeafe" },
  ROLE_TREASURER: { group: "Operation", label: "Vận hành", groupVi: "Vận hành", color: "#065f46", bg: "#d1fae5", badgeColor: "#065f46", badgeBg: "#d1fae5" },
  ROLE_STOREKEEPER: { group: "Operation", label: "Vận hành", groupVi: "Vận hành", color: "#065f46", bg: "#d1fae5", badgeColor: "#065f46", badgeBg: "#d1fae5" },
  ROLE_PURCHASER: { group: "Operation", label: "Vận hành", groupVi: "Vận hành", color: "#065f46", bg: "#d1fae5", badgeColor: "#065f46", badgeBg: "#d1fae5" },
  ROLE_SALESPERSON: { group: "Operation", label: "Vận hành", groupVi: "Vận hành", color: "#065f46", bg: "#d1fae5", badgeColor: "#065f46", badgeBg: "#d1fae5" },
  ROLE_APPROVER: { group: "Approval", label: "Phê duyệt", groupVi: "Phê duyệt", color: "#9a3412", bg: "#ffedd5", badgeColor: "#9a3412", badgeBg: "#ffedd5" },
  ROLE_AUDITOR: { group: "Control", label: "Kiểm soát", groupVi: "Kiểm soát", color: "#3730a3", bg: "#e0e7ff", badgeColor: "#3730a3", badgeBg: "#e0e7ff" },
  ROLE_REPORT_VIEWER: { group: "View Only", label: "Chỉ xem", groupVi: "Chỉ xem", color: "#475569", bg: "#f1f5f9", badgeColor: "#475569", badgeBg: "#f1f5f9" },
};

const REGIME_ROLE_PRESETS = [
  {
    key: "TT58",
    label: "TT58/2026 — DN Siêu nhỏ",
    title: "TT58/2026 — DN Siêu nhỏ",
    subtitle: "3 Vai trò cốt lõi (Gọn nhẹ, kiêm nhiệm)",
    badge: "3 Vai trò",
    activeCount: 3,
    count: 3,
    color: "#047857",
    badgeColor: "#047857",
    badgeBg: "#ecfdf5",
    desc: "Phù hợp doanh nghiệp siêu nhỏ / hộ kinh doanh: Quản trị DN, Giám đốc và Kế toán phụ trách chung.",
  },
  {
    key: "TT133",
    label: "TT133/2016 — DN Nhỏ & Vừa (SME)",
    title: "TT133/2016 — DN Nhỏ & Vừa (SME)",
    subtitle: "8 Vai trò tiêu chuẩn SME",
    badge: "8 Vai trò",
    activeCount: 8,
    count: 8,
    color: "#0284c7",
    badgeColor: "#0284c7",
    badgeBg: "#f0f9ff",
    desc: "Phù hợp doanh nghiệp nhỏ và vừa: tách Kế toán trưởng, KT Tổng hợp, KT Thuế, KT Bán hàng, Thủ quỹ, Thủ kho.",
  },
  {
    key: "TT200",
    label: "TT200/2014 — DN Vừa & Lớn",
    title: "TT200/2014 — DN Vừa & Lớn",
    subtitle: "14 Vai trò chuyên môn hóa",
    badge: "14 Vai trò",
    activeCount: 14,
    count: 14,
    color: "#7c3aed",
    badgeColor: "#7c3aed",
    badgeBg: "#f5f3ff",
    desc: "Phù hợp doanh nghiệp có phòng kế toán tách biệt Công nợ Phải thu, Phải trả, Tiền mặt, Ngân hàng, Kho.",
  },
  {
    key: "TT99",
    label: "TT99/2025 — Chuẩn mực Đầy đủ",
    title: "TT99/2025 — Chuẩn mực Đầy đủ",
    subtitle: "Toàn bộ 21 Vai trò chuyên trách",
    badge: "21 Vai trò",
    activeCount: 21,
    count: 21,
    color: "#b45309",
    badgeColor: "#b45309",
    badgeBg: "#fffbeb",
    desc: "Bộ máy đầy đủ 21 vai trò: Quản trị, Giám đốc, 12 vị trí Kế toán chuyên sâu, 4 Vận hành, Phê duyệt, Kiểm toán & Xem báo cáo.",
  },
];

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

export type PermTierKey = "VIEW" | "EDIT" | "APPROVE" | "EXPORT" | "ADMIN";

export const PERM_TIER_META: Record<
  PermTierKey,
  { label: string; shortLabel: string; color: string; bg: string; border: string }
> = {
  VIEW: {
    label: "Xem & Tra cứu",
    shortLabel: "Xem",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  EDIT: {
    label: "Lập & Sửa chứng từ",
    shortLabel: "Lập & Sửa",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  APPROVE: {
    label: "Duyệt & Ghi sổ",
    shortLabel: "Duyệt / Ghi sổ",
    color: "#6d28d9",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  EXPORT: {
    label: "In & Xuất / Nhập file",
    shortLabel: "In & Xuất file",
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
  },
  ADMIN: {
    label: "Xóa / Khóa / Thiết lập",
    shortLabel: "Xóa / Khóa",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
};

const MODULE_NAMES_VI: Record<string, string> = {
  CASH: "Quỹ tiền mặt",
  BANK: "Tiền gửi ngân hàng",
  SAL: "Bán hàng & Doanh thu",
  PUR: "Mua hàng & Chi phí",
  INV: "Kho & Vật tư hàng hóa",
  AR: "Công nợ phải thu",
  AP: "Công nợ phải trả",
  FA: "Tài sản cố định & CCDC",
  PAYROLL: "Tiền lương & Nhân sự",
  COST: "Giá thành sản xuất",
  TAX: "Thuế & Hóa đơn điện tử",
  GL: "Sổ cái & Tổng hợp",
  RPT: "Báo cáo & Phân tích",
  MD: "Danh mục dùng chung",
  SYS: "Quản trị & Hệ thống",
  COM: "Quản trị & Hệ thống",
};

const FEATURE_NAMES_VI: Record<string, string> = {
  ADJUSTMENT: "Điều chỉnh công nợ & số liệu",
  ADJUSTMENT_VOUCHER: "Chứng từ điều chỉnh công nợ",
  ALLOCATION: "Phân bổ thanh toán & chi phí",
  ALLOCATION_VOUCHER: "Chứng từ phân bổ công nợ",
  APPROVAL: "Phê duyệt chứng từ nghiệp vụ",
  DOCUMENT: "Chứng từ & Hồ sơ đính kèm",
  INVOICE: "Hóa đơn & Chứng từ thanh toán",
  INPUT_INVOICE: "Hóa đơn mua vào (Đầu vào)",
  COMMERCIAL_INVOICE: "Hóa đơn thương mại",
  DISCOUNT_INVOICE: "Hóa đơn chiết khấu thương mại",
  SALES_INVOICE: "Hóa đơn bán hàng (Đầu ra)",
  INVOICE_REQUEST: "Đề nghị xuất hóa đơn",
  NETTING: "Bù trừ công nợ hai chiều",
  NETTING_VOUCHER: "Chứng từ bù trừ công nợ",
  OFFSET: "Đối trừ chứng từ thanh toán",
  PAYABLE: "Tổng hợp công nợ phải trả NCC",
  RECEIVABLE: "Tổng hợp công nợ phải thu khách hàng",
  PAYMENT: "Phiếu chi & Thanh toán tiền",
  PAYMENT_REQUEST: "Đề nghị thanh toán",
  PAYMENT_REMINDER: "Thông báo nhắc nợ khách hàng",
  RECONCILIATION: "Đối chiếu công nợ & Sao kê",
  REPORT: "Báo cáo chuyên đề phân hệ",
  TRACKING: "Theo dõi tiến độ & Tuổi nợ",
  DUE_TRACKING: "Theo dõi công nợ đến hạn / quá hạn",
  COLLECTION_PLAN: "Kế hoạch thu hồi công nợ",
  CONFIRMATION: "Biên bản xác nhận công nợ",
  CREDIT_POLICY: "Chính sách hạn mức tín dụng",
  RECEIPT: "Phiếu thu & Nhận tiền",
  RECEIPT_VOUCHER: "Chứng từ phiếu thu tiền",
  ACCOUNT: "Danh mục tài khoản",
  BANK_ACCOUNT: "Tài khoản ngân hàng doanh nghiệp",
  INTEGRATION: "Kết nối ngân hàng điện tử",
  LOAN: "Khế ước vay & Theo dõi khoản vay",
  REVALUATION: "Đánh giá lại chênh lệch tỷ giá",
  FX_REVALUATION: "Đánh giá lại ngoại tệ cuối kỳ",
  STATEMENT: "Sao kê ngân hàng & Sổ phụ",
  TRANSACTION: "Giao dịch thu / chi tiền",
  TRANSFER: "Chuyển tiền nội bộ / Chuyển kho",
  ADVANCE: "Tạm ứng nhân viên",
  ADVANCE_REQUEST: "Đề nghị tạm ứng",
  ADVANCE_SETTLEMENT: "Quyết toán tạm ứng",
  COUNT: "Kiểm kê thực tế định kỳ",
  FUND: "Danh mục quỹ & Tồn quỹ tiền mặt",
  AI: "Trợ lý thông minh AI Kế toán",
  DASHBOARD: "Bảng điều khiển & Chỉ số tài chính",
  JOIN_REQUEST: "Phê duyệt yêu cầu gia nhập công ty",
  NOTIFICATION: "Thông báo nghiệp vụ hệ thống",
  SEARCH: "Tra cứu nhanh dữ liệu toàn hệ thống",
  SETTING: "Thiết lập tham số hệ thống",
  PERIOD: "Kỳ kế toán & Khóa sổ định kỳ",
  ASSET: "Hồ sơ Tài sản cố định & CCDC",
  CALCULATION: "Tính khấu hao & Tính giá thành",
  CATEGORY: "Nhóm phân loại tài sản / danh mục",
  GL: "Hạch toán bút toán Sổ cái",
  BALANCE: "Số dư tài khoản & Bảng cân đối",
  BUDGET: "Ngân sách & Dự toán thu chi",
  CLOSING: "Bút toán kết chuyển lãi lỗ cuối kỳ",
  GENERAL_VOUCHER: "Chứng từ nghiệp vụ khác (NVK)",
  JOURNAL: "Sổ nhật ký chung & Định khoản",
  LEDGER: "Sổ cái & Sổ chi tiết tài khoản",
  SUBLEDGER_INGESTION: "Đồng bộ chứng từ phân hệ vào Sổ cái",
  ASSEMBLY: "Lệnh lắp ráp & Tháo dỡ hàng hóa",
  LOT_SERIAL: "Quản lý Số lô & Hạn sử dụng",
  POLICY: "Chính sách giá & Định mức tồn kho",
  PRODUCTION: "Nhập kho thành phẩm & Xuất sản xuất",
  VALUATION: "Tính giá xuất kho tự động",
  COMMON: "Danh mục chuẩn dùng chung",
  EMPLOYEE: "Hồ sơ Nhân sự & Nhân viên",
  EXPENSE_ITEM: "Danh mục Khoản mục chi phí",
  ITEM: "Danh mục Vật tư, Hàng hóa, Dịch vụ",
  ITEM_GROUP: "Nhóm Vật tư, Hàng hóa",
  ORGANIZATION: "Cơ cấu tổ chức (Chi nhánh / Phòng ban)",
  PARTY: "Danh mục Khách hàng & Nhà cung cấp",
  PAYMENT_METHOD: "Phương thức thanh toán",
  PAYMENT_TERM: "Điều khoản thanh toán",
  STATISTICAL_CODE: "Mã thống kê / Dự án / Hợp đồng",
  TAX_RATE: "Danh mục Thuế suất",
  TAX_TYPE: "Danh mục sắc thuế",
  UOM: "Danh mục Đơn vị tính",
  WAREHOUSE: "Danh mục Kho hàng",
  ATTENDANCE: "Bảng chấm công nhân sự",
  PROFILE: "Hồ sơ lương & Hợp đồng lao động",
  SHEET: "Bảng tính lương & Phiếu lương",
  CONTRACT: "Hợp đồng kinh tế (Mua / Bán)",
  COST: "Chi phí mua hàng & Phân bổ",
  DISCOUNT: "Chiết khấu thương mại",
  GOODS: "Chứng từ mua hàng hóa",
  ORDER: "Đơn đặt hàng (PO / SO)",
  REQUEST: "Đề nghị mua sắm vật tư",
  RETURN: "Trả lại hàng mua",
  SERVICE: "Chứng từ mua dịch vụ & Chi phí",
  SUPPLIER_RISK: "Kiểm soát rủi ro Hóa đơn & MST",
  BUSINESS_RESULT: "Báo cáo Kết quả HĐKD (B02-DN)",
  "BUSINESS_RESULT.DETAIL": "Chi tiết Kết quả HĐKD",
  CASH_FLOW: "Báo cáo Lưu chuyển tiền tệ (B03-DN)",
  "CASH_FLOW.DETAIL": "Chi tiết Lưu chuyển tiền tệ",
  CENTER: "Báo cáo theo Trung tâm chi phí",
  COMMERCE: "Báo cáo Bán hàng & Thương mại",
  CONFIG: "Thiết lập mẫu & công thức báo cáo",
  DEBT: "Báo cáo Tổng hợp & Chi tiết Công nợ",
  FINANCIAL: "Bảng Cân đối kế toán & Bộ BCTC",
  "FINANCIAL.DETAIL": "Chi tiết chỉ tiêu Báo cáo tài chính",
  FINANCIAL_NOTES: "Thuyết minh Báo cáo tài chính (B09-DN)",
  INVENTORY: "Báo cáo Xuất - Nhập - Tồn kho",
  MANAGEMENT: "Báo cáo Quản trị & Phân tích tài chính",
  MONEY: "Sổ quỹ tiền mặt & Sổ tiền gửi",
  TAX: "Báo cáo & Bảng kê Thuế GTGT, TNDN",
  COGS: "Tính & Kết chuyển Giá vốn hàng bán",
  DELIVERY: "Phiếu xuất kho kiêm vận chuyển",
  GOODS_SALE: "Chứng từ bán hàng hóa",
  QUOTATION: "Báo giá khách hàng",
  SALES_ALLOWANCE: "Giảm giá hàng bán",
  SALES_RETURN: "Hàng bán bị trả lại",
  SERVICE_SALE: "Chứng từ bán dịch vụ",
  LINK: "Liên kết chứng từ gốc",
  AUDIT: "Nhật ký kiểm toán & Truy vết hệ thống",
  COMPANY_PROFILE: "Hồ sơ pháp lý Doanh nghiệp",
  MEMBERSHIP: "Hồ sơ thành viên doanh nghiệp",
  MODULE: "Cấu hình bật / tắt phân hệ",
  NUMBERING: "Quy tắc sinh số chứng từ tự động",
  ORG_ASSIGNMENT: "Phân công chi nhánh / phòng ban",
  ORG_STRUCTURE: "Sơ đồ tổ chức doanh nghiệp",
  PERMISSION: "Danh mục quyền hạn hệ thống",
  ROLE: "Vai trò nghiệp vụ & Phân quyền",
  ROLE_ASSIGNMENT: "Bổ nhiệm & Đổi vai trò nhân sự",
  USER: "Tài khoản người dùng",
  WORKFLOW: "Quy trình phê duyệt đa cấp",
  CONNECTOR: "Kết nối Thuế điện tử & Hóa đơn điện tử",
  EXPORT: "Kết xuất XML / Excel tờ khai thuế",
  FILING: "Lập & Nộp tờ khai thuế định kỳ",
  OBLIGATION: "Theo dõi nghĩa vụ thuế phải nộp",
  SUMMARY: "Bảng tổng hợp nghĩa vụ thuế",
  OPENING_BALANCE: "Khai báo Số dư đầu kỳ",
};

const ACTION_NAMES_VI: Record<string, { label: string; tier: PermTierKey }> = {
  VIEW: { label: "Xem & tra cứu", tier: "VIEW" },
  DETAIL_VIEW: { label: "Xem chi tiết chứng từ", tier: "VIEW" },
  DRILLDOWN: { label: "Truy vết chứng từ gốc", tier: "VIEW" },
  VIEW_HISTORY: { label: "Xem lịch sử thay đổi", tier: "VIEW" },
  VIEW_USERS: { label: "Xem danh sách nhân sự", tier: "VIEW" },
  VIEW_IMPACT: { label: "Xem phạm vi ảnh hưởng", tier: "VIEW" },
  VIEW_SECURITY: { label: "Xem thiết lập bảo mật", tier: "VIEW" },
  VIEW_SENSITIVE: { label: "Xem dữ liệu nhạy cảm", tier: "VIEW" },
  VIEW_UNMASKED: { label: "Xem đầy đủ thông tin", tier: "VIEW" },
  TRACK: { label: "Theo dõi tiến độ", tier: "VIEW" },
  CHECK: { label: "Kiểm tra đối chiếu", tier: "VIEW" },
  CHECK_TX: { label: "Kiểm tra giao dịch", tier: "VIEW" },
  CHECK_EFFECTIVE: { label: "Kiểm tra quyền thực tế", tier: "VIEW" },
  SEARCH: { label: "Tìm kiếm dữ liệu", tier: "VIEW" },
  STATUS: { label: "Xem trạng thái", tier: "VIEW" },

  CREATE: { label: "Tạo mới chứng từ", tier: "EDIT" },
  CREATE_FOR_OTHERS: { label: "Lập hộ chứng từ", tier: "EDIT" },
  EDIT: { label: "Chỉnh sửa thông tin", tier: "EDIT" },
  EDIT_PAYMENT_TERM: { label: "Sửa điều khoản thanh toán", tier: "EDIT" },
  EDIT_SUSPENDED: { label: "Sửa bản ghi tạm dừng", tier: "EDIT" },
  SUBMIT: { label: "Trình duyệt chứng từ", tier: "EDIT" },
  PREPARE: { label: "Lập dự thảo báo cáo", tier: "EDIT" },
  CLONE: { label: "Sao chép mẫu", tier: "EDIT" },
  GENERATE: { label: "Tổng hợp số liệu tự động", tier: "EDIT" },
  CALCULATE: { label: "Chạy tính toán số liệu", tier: "EDIT" },
  COUNT: { label: "Nhập số liệu kiểm kê", tier: "EDIT" },
  ADJUST: { label: "Lập điều chỉnh chênh lệch", tier: "EDIT" },
  ALLOCATE: { label: "Phân bổ số liệu", tier: "EDIT" },
  MATCH: { label: "Khớp đúng chứng từ", tier: "EDIT" },
  RECONCILE: { label: "Đối soát sao kê", tier: "EDIT" },
  TRANSFER: { label: "Thực hiện điều chuyển", tier: "EDIT" },
  SETTLE: { label: "Quyết toán khoản mục", tier: "EDIT" },
  RECEIVE: { label: "Xác nhận tiếp nhận", tier: "EDIT" },
  PAY: { label: "Thực hiện chi trả", tier: "EDIT" },
  PAYMENT: { label: "Lập thanh toán", tier: "EDIT" },
  ISSUE: { label: "Phát hành chứng từ / hóa đơn", tier: "EDIT" },
  SEND: { label: "Gửi chứng từ / thông báo", tier: "EDIT" },
  SEND_EMAIL: { label: "Gửi email thông báo", tier: "EDIT" },
  REMIND: { label: "Gửi thư nhắc nợ", tier: "EDIT" },
  RESPOND: { label: "Phản hồi yêu cầu", tier: "EDIT" },
  ANNEX: { label: "Lập phụ lục hợp đồng", tier: "EDIT" },
  EXTEND: { label: "Gia hạn hợp đồng", tier: "EDIT" },
  USE: { label: "Sử dụng tính năng", tier: "EDIT" },
  RUN: { label: "Chạy quy trình", tier: "EDIT" },
  AGGREGATE: { label: "Tổng hợp dữ liệu", tier: "EDIT" },
  BULK: { label: "Thao tác hàng loạt", tier: "EDIT" },
  MOVE: { label: "Di chuyển phân nhóm", tier: "EDIT" },
  MERGE: { label: "Gộp bản ghi trùng", tier: "EDIT" },
  LINK: { label: "Liên kết chứng từ", tier: "EDIT" },
  UNLINK: { label: "Gỡ liên kết chứng từ", tier: "EDIT" },
  REPLACE: { label: "Thay thế hóa đơn / chứng từ", tier: "EDIT" },

  APPROVE: { label: "Phê duyệt chứng từ", tier: "APPROVE" },
  REJECT: { label: "Từ chối phê duyệt", tier: "APPROVE" },
  POST: { label: "Ghi sổ cái kế toán", tier: "APPROVE" },
  POST_DIRECT: { label: "Ghi sổ trực tiếp", tier: "APPROVE" },
  UNPOST: { label: "Bỏ ghi sổ kế toán", tier: "APPROVE" },
  REVERSE: { label: "Đảo bút toán ghi sổ", tier: "APPROVE" },
  CONFIRM: { label: "Xác nhận thực thu / thực xuất", tier: "APPROVE" },
  SIGN: { label: "Ký số điện tử", tier: "APPROVE" },
  VALIDATE: { label: "Kiểm duyệt tính hợp lệ", tier: "APPROVE" },
  REVIEW: { label: "Soát xét số liệu", tier: "APPROVE" },
  ACCEPT: { label: "Chấp thuận nghiệm thu", tier: "APPROVE" },
  PUBLISH: { label: "Công bố ban hành", tier: "APPROVE" },
  REQUEST_REVISION: { label: "Yêu cầu chỉnh sửa lại", tier: "APPROVE" },
  ADJUST_CONFIRMED: { label: "Điều chỉnh phiếu đã xác nhận", tier: "APPROVE" },

  PRINT: { label: "In chứng từ & sổ sách", tier: "EXPORT" },
  EXPORT: { label: "Xuất file Excel / PDF / XML", tier: "EXPORT" },
  IMPORT: { label: "Nhập khẩu dữ liệu từ Excel", tier: "EXPORT" },

  DELETE: { label: "Xóa chứng từ nháp", tier: "ADMIN" },
  CANCEL: { label: "Hủy bỏ chứng từ", tier: "ADMIN" },
  CANCEL_POSTED: { label: "Hủy chứng từ đã ghi sổ", tier: "ADMIN" },
  DEACTIVATE: { label: "Ngừng sử dụng danh mục", tier: "ADMIN" },
  REACTIVATE: { label: "Kích hoạt lại bản ghi", tier: "ADMIN" },
  DISPOSE: { label: "Thanh lý / Ghi giảm tài sản", tier: "ADMIN" },
  LIQUIDATE: { label: "Thanh lý hợp đồng", tier: "ADMIN" },
  TERMINATE: { label: "Chấm dứt hiệu lực", tier: "ADMIN" },
  CLOSE: { label: "Đóng / Tất toán", tier: "ADMIN" },
  CLOSE_PERIOD: { label: "Khóa kỳ kế toán", tier: "ADMIN" },
  REOPEN_PERIOD: { label: "Mở lại kỳ kế toán đã khóa", tier: "ADMIN" },
  LOCK: { label: "Khóa bảo vệ dữ liệu", tier: "ADMIN" },
  UNLOCK: { label: "Mở khóa dữ liệu", tier: "ADMIN" },
  REFUND: { label: "Hoàn tiền giao dịch", tier: "ADMIN" },
  CONFIGURE: { label: "Thiết lập cấu hình", tier: "ADMIN" },
  CONFIG: { label: "Cấu hình tham số", tier: "ADMIN" },
  CONNECT: { label: "Thiết lập kết nối tích hợp", tier: "ADMIN" },
  SYNC: { label: "Đồng bộ dữ liệu tích hợp", tier: "ADMIN" },
  ASSIGN_ROLE: { label: "Gán vai trò nhân sự", tier: "ADMIN" },
  REVOKE_ROLE: { label: "Thu hồi vai trò", tier: "ADMIN" },
  ASSIGN_SCOPE: { label: "Phân quyền phạm vi dữ liệu", tier: "ADMIN" },
  ASSIGN_UNIT: { label: "Phân công đơn vị phụ trách", tier: "ADMIN" },
  DIRECT_PERMISSION: { label: "Cấp quyền đặc thù riêng", tier: "ADMIN" },
  LINK_USER: { label: "Liên kết tài khoản đăng nhập", tier: "ADMIN" },
  LINK_EMPLOYEE: { label: "Liên kết hồ sơ nhân viên", tier: "ADMIN" },
  EXIT_REQUEST: { label: "Xử lý thôi việc / thu hồi quyền", tier: "ADMIN" },
  MANAGE: { label: "Quản trị toàn diện", tier: "ADMIN" },
  MANUAL_OVERRIDE: { label: "Ghi đè kiểm soát đặc biệt", tier: "ADMIN" },
  OVERRIDE: { label: "Vượt hạn mức kiểm soát", tier: "ADMIN" },
  RETRY: { label: "Thực hiện lại tác vụ", tier: "ADMIN" },
  RETRY_ISSUE: { label: "Phát hành lại hóa đơn lỗi", tier: "ADMIN" },
  RESOLVE: { label: "Xử lý sự cố nghiệp vụ", tier: "ADMIN" },
  INCIDENT: { label: "Quản lý cảnh báo rủi ro", tier: "ADMIN" },
  REFRESH: { label: "Làm mới dữ liệu", tier: "VIEW" },
};

const parsePermissionDetails = (
  code: string
): {
  moduleKey: string;
  module: string;
  featureKey: string;
  featureName: string;
  tier: PermTierKey;
  actionLabel: string;
  name: string;
  desc: string;
} => {
  // Handle special standalone codes like OPENING_BALANCE_VIEW or RPT_FINANCIAL_VIEW
  if (code.startsWith("OPENING_BALANCE_")) {
    const act = code.replace("OPENING_BALANCE_", "");
    const actInfo = ACTION_NAMES_VI[act] || { label: "Thao tác số dư đầu kỳ", tier: "EDIT" as PermTierKey };
    return {
      moduleKey: "GL",
      module: "Sổ cái & Tổng hợp",
      featureKey: "GL.OPENING_BALANCE",
      featureName: "Khai báo Số dư đầu kỳ",
      tier: actInfo.tier,
      actionLabel: actInfo.label,
      name: `${actInfo.label} — Số dư đầu kỳ`,
      desc: `${actInfo.label} đối với số dư tài khoản, công nợ và tồn kho đầu kỳ`,
    };
  }

  if (code.startsWith("RPT_") && !code.includes(".")) {
    const rest = code.replace("RPT_", "");
    let fKey = "FINANCIAL";
    let act = "VIEW";
    for (const candidate of ["BUSINESS_RESULT", "CASH_FLOW", "FINANCIAL_NOTES", "FINANCIAL"]) {
      if (rest.startsWith(candidate + "_")) {
        fKey = candidate;
        act = rest.slice(candidate.length + 1).replace("DETAIL_VIEW", "DETAIL_VIEW");
        break;
      }
    }
    const fName = FEATURE_NAMES_VI[fKey] || "Bộ Báo cáo tài chính";
    const actInfo = ACTION_NAMES_VI[act] || { label: "Xem & xử lý báo cáo", tier: "VIEW" as PermTierKey };
    return {
      moduleKey: "RPT",
      module: "Báo cáo & Phân tích",
      featureKey: `RPT.${fKey}`,
      featureName: fName,
      tier: actInfo.tier,
      actionLabel: actInfo.label,
      name: `${actInfo.label} — ${fName}`,
      desc: `${actInfo.label} trong ${fName}`,
    };
  }

  const parts = code.split(".");
  const rawPrefix = parts[0] || "SYS";
  const moduleKey = rawPrefix === "COM" ? "SYS" : rawPrefix;
  const module = MODULE_NAMES_VI[moduleKey] || "Nghiệp vụ kế toán";
  const action = parts[parts.length - 1] || "VIEW";
  const midKey = parts.slice(1, -1).join(".") || rawPrefix;

  const featureName =
    FEATURE_NAMES_VI[midKey] ||
    FEATURE_NAMES_VI[parts[1] || ""] ||
    (PERMISSION_TRANSLATION_MAP[code] ? PERMISSION_TRANSLATION_MAP[code].name : `Nghiệp vụ ${module}`);

  const actInfo = ACTION_NAMES_VI[action] || { label: "Thực hiện nghiệp vụ", tier: "EDIT" as PermTierKey };

  if (PERMISSION_TRANSLATION_MAP[code]) {
    return {
      moduleKey,
      module,
      featureKey: `${moduleKey}.${midKey}`,
      featureName,
      tier: actInfo.tier,
      actionLabel: actInfo.label,
      name: PERMISSION_TRANSLATION_MAP[code].name,
      desc: PERMISSION_TRANSLATION_MAP[code].desc,
    };
  }

  return {
    moduleKey,
    module,
    featureKey: `${moduleKey}.${midKey}`,
    featureName,
    tier: actInfo.tier,
    actionLabel: actInfo.label,
    name: `${actInfo.label} — ${featureName}`,
    desc: `Cho phép ${actInfo.label.toLowerCase()} tại mục ${featureName.toLowerCase()} (${module})`,
  };
};

const translatePermissionCode = (code: string): { module: string; name: string; desc: string } => {
  const d = parsePermissionDetails(code);
  return { module: d.module, name: d.name, desc: d.desc };
};

export interface GroupedFeaturePermission {
  featureKey: string;
  featureName: string;
  module: string;
  codes: string[];
  tiers: Record<PermTierKey, string[]>;
}

const groupPermissionCodesByModuleAndFeature = (
  codes: string[],
  searchQuery = ""
): Record<string, GroupedFeaturePermission[]> => {
  const q = searchQuery.toLowerCase().trim();
  const byModule: Record<string, Record<string, GroupedFeaturePermission>> = {};

  codes.forEach((code) => {
    const d = parsePermissionDetails(code);
    if (
      q &&
      !d.featureName.toLowerCase().includes(q) &&
      !d.module.toLowerCase().includes(q) &&
      !d.name.toLowerCase().includes(q) &&
      !d.actionLabel.toLowerCase().includes(q)
    ) {
      return;
    }
    if (!byModule[d.module]) byModule[d.module] = {};
    if (!byModule[d.module][d.featureKey]) {
      byModule[d.module][d.featureKey] = {
        featureKey: d.featureKey,
        featureName: d.featureName,
        module: d.module,
        codes: [],
        tiers: { VIEW: [], EDIT: [], APPROVE: [], EXPORT: [], ADMIN: [] },
      };
    }
    const fg = byModule[d.module][d.featureKey];
    fg.codes.push(code);
    fg.tiers[d.tier].push(code);
  });

  const result: Record<string, GroupedFeaturePermission[]> = {};
  Object.entries(byModule).forEach(([mod, featMap]) => {
    result[mod] = Object.values(featMap);
  });
  return result;
};

const summarizeMemberPermissions = (
  codes: string[] | undefined,
  isCompanyAdmin: boolean
): { buttonLabel: string; badgeSummary: string; moduleCount: number; featureCount: number } => {
  const list = codes || [];
  if (isCompanyAdmin || list.length >= 600) {
    return {
      buttonLabel: "Toàn quyền",
      badgeSummary: "Toàn quyền (15 phân hệ)",
      moduleCount: 15,
      featureCount: 65,
    };
  }
  if (list.length === 0) {
    return {
      buttonLabel: "Chưa cấp quyền",
      badgeSummary: "Chưa có quyền",
      moduleCount: 0,
      featureCount: 0,
    };
  }
  const modules = new Set<string>();
  const features = new Set<string>();
  list.forEach((c) => {
    const d = parsePermissionDetails(c);
    modules.add(d.moduleKey);
    features.add(d.featureKey);
  });
  return {
    buttonLabel: `Quyền hạn (${modules.size} phân hệ)`,
    badgeSummary: `${modules.size} phân hệ · ${features.size} nghiệp vụ`,
    moduleCount: modules.size,
    featureCount: features.size,
  };
};

const formatRoleScopeSummary = (role: RoleItem): string => {
  if (isAdminRoleCode(role.code) || role.code === "ROLE_CHIEF_ACCOUNTANT" || (role.permission_count || 0) >= 600) {
    return "Toàn quyền (15 phân hệ)";
  }
  if (role.code === "ROLE_DIRECTOR") return "Giám sát & Phê duyệt toàn công ty";
  if (role.code === "ROLE_GENERAL_ACCOUNTANT") return "Sổ cái, BCTC & Tổng hợp số liệu";
  if (role.code === "ROLE_TAX_ACCOUNTANT") return "Chuyên trách Thuế & Hóa đơn";
  if (role.code === "ROLE_AP_ACCOUNTANT") return "Chuyên trách Công nợ Phải trả";
  if (role.code === "ROLE_AR_ACCOUNTANT") return "Chuyên trách Công nợ Phải thu";
  if (role.code === "ROLE_PURCHASE_ACCOUNTANT") return "Chuyên trách Kế toán Mua hàng";
  if (role.code === "ROLE_SALES_ACCOUNTANT") return "Chuyên trách Kế toán Bán hàng";
  if (role.code === "ROLE_CASH_ACCOUNTANT") return "Chuyên trách Kế toán Tiền mặt";
  if (role.code === "ROLE_BANK_ACCOUNTANT") return "Chuyên trách Kế toán Ngân hàng";
  if (role.code === "ROLE_INVENTORY_ACCOUNTANT") return "Chuyên trách Kế toán Kho";
  if (role.code === "ROLE_ASSET_ACCOUNTANT") return "Chuyên trách Tài sản cố định";
  if (role.code === "ROLE_CCDC_ACCOUNTANT") return "Chuyên trách Công cụ dụng cụ";
  if (role.code === "ROLE_TREASURER") return "Vận hành Thu / Chi & Tồn quỹ";
  if (role.code === "ROLE_STOREKEEPER") return "Vận hành Nhập / Xuất & Tồn kho";
  if (role.code === "ROLE_PURCHASER") return "Lập đơn mua & Theo dõi NCC";
  if (role.code === "ROLE_SALESPERSON") return "Báo giá & Lập đơn bán hàng";
  if (role.code === "ROLE_APPROVER") return "Phê duyệt chứng từ theo luồng";
  if (role.code === "ROLE_AUDITOR") return "Kiểm toán & Tra cứu độc lập";
  if (role.code === "ROLE_REPORT_VIEWER") return "Xem báo cáo & Chỉ số quản trị";
  if (!role.permission_count) return "Chưa thiết lập quyền";
  return "Vai trò nghiệp vụ tùy chỉnh";
};

export default function CompanyAdminWorkspace() {
  const { token, companyId, companies, selectCompany, restoring } = useApiSession();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [_loading, setLoading] = useState<boolean>(false);
  const [alertMsg, setRawAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const setAlertMsg = (val: { type: "success" | "error"; text: string } | null) => {
    if (!val) {
      setRawAlertMsg(null);
      return;
    }
    const cleanText = humanizeErrorMessage(val.text);
    setRawAlertMsg({ type: val.type, text: cleanText });
    showGlobalPopup({
      type: val.type,
      title: val.type === "error" ? "Thông báo lỗi" : "Lưu dữ liệu thành công",
      message: cleanText,
    });
  };

  // Data states
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; code: string; name: string; is_head_office?: boolean }>>([]);
  const [departments, setDepartments] = useState<OrgUnit[]>([]);
  const [positions, setPositions] = useState<OrgUnit[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [modules, setModules] = useState<ModuleSetting[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [numberingRules, setNumberingRules] = useState<NumberingRule[]>([]);
  const [joinRequests, setJoinRequests] = useState<AdminJoinRequestItem[]>([]);
  const [joinStatusFilter, setJoinStatusFilter] = useState<string>("PENDING");
  const [decidingJoinReq, setDecidingJoinReq] = useState<{
    item: AdminJoinRequestItem;
    decision: "APPROVED" | "REJECTED";
    roleId: string;
    reason: string;
    internalNote: string;
    reactivate: boolean;
  } | null>(null);
  const [joinDecideSaving, setJoinDecideSaving] = useState<boolean>(false);

  // Search & Filter
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>("");
  const [memberScopeFilter, setMemberScopeFilter] = useState<"all" | "admin" | "staff">("all");
  const [roleSearch, setRoleSearch] = useState<string>("");
  const [roleStatusFilter, setRoleStatusFilter] = useState<"ACTIVE" | "AVAILABLE" | "ALL">("ALL");
  const [roleGroupFilter, setRoleGroupFilter] = useState<string>("ALL");

  // Role Matrix Management
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [roleMatrix, setRoleMatrix] = useState<MatrixData | null>(null);
  const [selectedPermCodes, setSelectedPermCodes] = useState<Set<string>>(new Set());
  const [matrixSaving, setMatrixSaving] = useState<boolean>(false);
  const [permSearch, setPermSearch] = useState<string>("");

  // Modals
  const [assignModalMember, setAssignModalMember] = useState<MemberItem | null>(null);
  const [targetRoleCode, setTargetRoleCode] = useState<string>("");
  const [targetBranchScope, setTargetBranchScope] = useState<string>("all");
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
    branch_id: "all",
    department_id: "",
    position_id: "",
    role_code: "ROLE_CHIEF_ACCOUNTANT",
  });

  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [roleFormData, setRoleFormData] = useState({
    code: "",
    name: "",
    description: "",
  });

  // Custom Company Switcher Popover state
  const [switcherOpen, setSwitcherOpen] = useState<boolean>(false);
  const [switcherSearch, setSwitcherSearch] = useState<string>("");
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [switcherOpen]);

  const filteredSwitcherCompanies = useMemo(() => {
    const q = switcherSearch.trim().toLowerCase();
    const activeId = companyId || companyInfo?.id;
    const base = !q
      ? [...companies]
      : companies.filter(
          (c) =>
            c.name?.toLowerCase().includes(q) ||
            c.code?.toLowerCase().includes(q) ||
            c.tax_code?.toLowerCase().includes(q)
        );
    return base.sort((a, b) => {
      if (a.id === activeId) return -1;
      if (b.id === activeId) return 1;
      return (a.name || "").localeCompare(b.name || "", "vi");
    });
  }, [companies, switcherSearch, companyId, companyInfo?.id]);

  // Load Initial Data (Fast essential load for Tab 1 & Tab 2)
  const loadWorkspaceData = async () => {
    const parsedSession = (() => {
      try {
        return JSON.parse(localStorage.getItem("erp_api_session") || "{}");
      } catch {
        return {};
      }
    })();
    const effectiveToken = token || localStorage.getItem("erp_token") || parsedSession.token || parsedSession.access || "";
    const effectiveCompanyId =
      companyId ||
      localStorage.getItem("erp_company_id") ||
      parsedSession.companyId ||
      (companies.length > 0 ? companies[0].id : "");
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
      const [memRes, empRes, branchRes, deptRes, posRes, roleRes, joinRes] = await Promise.allSettled([
        request<MemberItem[] | { results: MemberItem[] }>(`/api/v1/iam/memberships/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<EmployeeItem[] | { results: EmployeeItem[] }>(`/api/v1/organization/employees/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<any[] | { results: any[] }>(`/api/v1/organization/branches/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<OrgUnit[] | { results: OrgUnit[] }>(`/api/v1/organization/departments/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<OrgUnit[] | { results: OrgUnit[] }>(`/api/v1/organization/positions/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<RoleItem[] | { results: RoleItem[] }>(`/api/v1/iam/roles/?company_id=${effectiveCompanyId}`, effectiveToken),
        request<AdminJoinRequestItem[] | { results: AdminJoinRequestItem[] }>(`/api/v1/common/company-join-requests/?company_id=${effectiveCompanyId}`, effectiveToken),
      ]);

      if (memRes.status === "fulfilled") {
        const val = memRes.value;
        setMembers(Array.isArray(val) ? val : val.results || []);
      }
      if (empRes.status === "fulfilled") {
        const val = empRes.value;
        setEmployees(Array.isArray(val) ? val : val.results || []);
      }
      if (branchRes.status === "fulfilled") {
        const val = branchRes.value;
        setBranches(Array.isArray(val) ? val : val.results || []);
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
        const roleList: RoleItem[] = Array.isArray(val) ? val : val.results || [];
        setRoles(roleList);
        setSelectedRole((prev) =>
          prev && roleList.some((r) => r.id === prev.id) ? prev : roleList[0] || null
        );
      }
      if (joinRes.status === "fulfilled") {
        const val = joinRes.value;
        setJoinRequests(Array.isArray(val) ? val : val.results || []);
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
    if (!token || !companyId || !selectedRole || !roles.some((r) => r.id === selectedRole.id)) {
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
  }, [selectedRole, roles, token, companyId]);

  // Handle Seeding 21 Standard Business Roles & Applying Regime Role Presets
  const handleSeedStandardRoles = async (presetKey?: string) => {
    if (!token || !companyId) return;
    setLoading(true);
    setAlertMsg(null);
    try {
      const res: any = await request(`/api/v1/iam/roles/seed-standard/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify(
          presetKey
            ? { company_id: companyId, preset: presetKey, force_preset: true }
            : { company_id: companyId }
        ),
      });
      setAlertMsg({ type: "success", text: res.message || "Đã đồng bộ danh mục 21 vai trò chuẩn theo quy mô doanh nghiệp!" });
      await loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Lỗi khi đồng bộ vai trò mẫu." });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRoleStatus = async (role: RoleItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!token || !companyId) return;
    try {
      const res: any = await request(`/api/v1/iam/roles/seed-standard/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          toggle_role_id: role.id,
        }),
      });
      setAlertMsg({ type: "success", text: res.message || `Đã cập nhật trạng thái vai trò ${role.name}.` });
      await loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể đổi trạng thái vai trò." });
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

  const [matrixViewMode, setMatrixViewMode] = useState<"grouped" | "detailed">("grouped");
  const [modalPermViewMode, setModalPermViewMode] = useState<"grouped" | "detailed">("grouped");

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

  // Toggle a batch of permission codes (for 1-click feature/tier/module assignment)
  const togglePermissionBatch = (codes: string[], forceState?: boolean) => {
    if (!codes.length) return;
    setSelectedPermCodes((prev) => {
      const next = new Set(prev);
      const allSelected = codes.every((c) => next.has(c));
      const shouldAdd = forceState !== undefined ? forceState : !allSelected;
      codes.forEach((c) => {
        if (shouldAdd) next.add(c);
        else next.delete(c);
      });
      return next;
    });
  };

  // Create Employee & Member Account
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !companyId) return;
    try {
      const res: any = await request(`/api/v1/iam/members/create-staff/?company_id=${companyId}`, token, {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          employee_code: employeeFormData.code.trim().toUpperCase(),
          code: employeeFormData.code.trim().toUpperCase(),
          full_name: employeeFormData.full_name.trim(),
          email: employeeFormData.email.trim(),
          phone: employeeFormData.phone.trim(),
          branch_id: employeeFormData.branch_id === "all" ? null : employeeFormData.branch_id,
          all_branches: employeeFormData.branch_id === "all",
          department_id: employeeFormData.department_id || null,
          position_id: employeeFormData.position_id || null,
          role_code: employeeFormData.role_code || "",
        }),
      });
      setAlertMsg({
        type: "success",
        text: res.message || `Đã thêm thành công nhân viên ${employeeFormData.full_name}.`,
      });
      setShowEmployeeModal(false);
      setEmployeeFormData({
        code: "",
        full_name: "",
        email: "",
        phone: "",
        branch_id: "all",
        department_id: "",
        position_id: "",
        role_code: "ROLE_CHIEF_ACCOUNTANT",
      });
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

  // Group permissions by clean Vietnamese module for detailed view
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionItem[]> = {};
    const q = permSearch.toLowerCase().trim();

    allPermissions.forEach((p) => {
      const d = parsePermissionDetails(p.code);
      if (
        q &&
        !d.name.toLowerCase().includes(q) &&
        !d.featureName.toLowerCase().includes(q) &&
        !d.module.toLowerCase().includes(q) &&
        !(p.description || "").toLowerCase().includes(q)
      ) {
        return;
      }
      if (!groups[d.module]) groups[d.module] = [];
      groups[d.module].push(p);
    });

    return groups;
  }, [allPermissions, permSearch]);

  // Group 941 atomic permissions into ~65 clean accounting features by module
  const groupedMatrixFeatures = useMemo(() => {
    return groupPermissionCodesByModuleAndFeature(
      allPermissions.map((p) => p.code),
      permSearch
    );
  }, [allPermissions, permSearch]);

  const selectedRoleSummary = useMemo(() => {
    const codes = Array.from(selectedPermCodes);
    const modules = new Set<string>();
    const features = new Set<string>();
    codes.forEach((c) => {
      const d = parsePermissionDetails(c);
      modules.add(d.moduleKey);
      features.add(d.featureKey);
    });
    return {
      moduleCount: modules.size,
      featureCount: features.size,
    };
  }, [selectedPermCodes]);

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
          branch_id: targetBranchScope === "all" ? null : targetBranchScope,
          all_branches: targetBranchScope === "all",
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

  const ownerMember = useMemo(() => {
    return (
      members.find((m) =>
        m.role_assignments?.some((r) => isAdminRoleCode(r.role_code))
      ) || members[0]
    );
  }, [members]);

  const adminMembersCount = useMemo(() => {
    return members.filter(
      (m) =>
        m.role_assignments?.some((r) => isAdminRoleCode(r.role_code))
    ).length;
  }, [members]);

  const activeRoles = useMemo(() => {
    return roles
      .filter((r) => r.status === "ACTIVE")
      .sort((a, b) => (ROLE_RANK_MAP[a.code] || 500) - (ROLE_RANK_MAP[b.code] || 500));
  }, [roles]);

  const availableRolesCount = useMemo(() => {
    return roles.filter((r) => r.status === "AVAILABLE" || r.status === "INACTIVE").length;
  }, [roles]);

  const filteredJoinRequests = useMemo(() => {
    if (!joinStatusFilter) return joinRequests;
    return joinRequests.filter((jr) => jr.status === joinStatusFilter);
  }, [joinRequests, joinStatusFilter]);

  const openDecideJoinModal = (item: AdminJoinRequestItem, decision: "APPROVED" | "REJECTED") => {
    const defaultRole =
      roles.find((r) => r.status === "ACTIVE" && (r.code === "ROLE_GENERAL_ACCOUNTANT" || r.code === "ROLE_SALES_ACCOUNTANT" || r.code === "ROLE_CHIEF_ACCOUNTANT")) ||
      roles.find((r) => r.status === "ACTIVE" && !isAdminRoleCode(r.code)) ||
      null;
    setDecidingJoinReq({
      item,
      decision,
      roleId: defaultRole ? defaultRole.id : "",
      reason: "",
      internalNote: "",
      reactivate: false,
    });
  };

  const handleDecideJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decidingJoinReq) return;
    const effectiveToken = token || localStorage.getItem("erp_token") || "";
    const effectiveCompanyId = companyId || localStorage.getItem("erp_company_id") || (companies.length > 0 ? companies[0].id : "");
    if (!effectiveToken || !effectiveCompanyId) return;

    if (decidingJoinReq.decision === "REJECTED" && !decidingJoinReq.reason.trim()) {
      setAlertMsg({ type: "error", text: "Vui lòng nhập lý do từ chối yêu cầu tham gia." });
      return;
    }

    setJoinDecideSaving(true);
    setAlertMsg(null);
    try {
      const payload: Record<string, any> = {
        company: effectiveCompanyId,
        decision: decidingJoinReq.decision,
        reason: decidingJoinReq.reason.trim(),
        internal_note: decidingJoinReq.internalNote.trim(),
      };
      if (decidingJoinReq.decision === "APPROVED") {
        if (decidingJoinReq.roleId) {
          payload.role_assignments = [{ role: decidingJoinReq.roleId }];
        }
        payload.reactivate_membership = decidingJoinReq.reactivate;
      }

      await request(
        `/api/v1/common/company-join-requests/${decidingJoinReq.item.id}/decide/?company_id=${encodeURIComponent(effectiveCompanyId)}`,
        effectiveToken,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setAlertMsg({
        type: "success",
        text:
          decidingJoinReq.decision === "APPROVED"
            ? `Đã chấp thuận ${decidingJoinReq.item.requester_name} gia nhập doanh nghiệp và cấp quyền thành viên!`
            : `Đã từ chối yêu cầu gia nhập của ${decidingJoinReq.item.requester_name}.`,
      });
      setDecidingJoinReq(null);
      await loadWorkspaceData();
    } catch (err: any) {
      setAlertMsg({ type: "error", text: err.message || "Không thể xử lý yêu cầu tham gia." });
    } finally {
      setJoinDecideSaving(false);
    }
  };

  const pendingJoinRequestsCount = useMemo(() => {
    return joinRequests.filter((jr) => jr.status === "PENDING").length;
  }, [joinRequests]);

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
        m.role_assignments?.some((r) => isAdminRoleCode(r.role_code)) ||
        m.id === ownerMember?.id;

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
  }, [members, memberSearch, memberScopeFilter, memberRoleFilter, ownerMember]);

  if (restoring) {
    return (
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", zIndex: 9999 }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTopColor: "#00b06b", borderRadius: "50%", animation: "sv-spin 0.8s linear infinite" }} />
        <span style={{ marginTop: 12, fontSize: 13, color: "#64748b", fontWeight: 500 }}>Đang tải không gian quản trị...</span>
        <style>{`@keyframes sv-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="admin-workspace">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div>
            <div className="admin-header-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Building2 size={24} />
              <h1>Quản trị Doanh nghiệp: {companyInfo?.name || "Đang tải..."}</h1>
              {companies.length > 1 && (
                <div className="admin-company-switcher" ref={switcherRef}>
                  <button
                    type="button"
                    className={`admin-company-switcher-trigger ${switcherOpen ? "is-open" : ""}`}
                    onClick={() => setSwitcherOpen((prev) => !prev)}
                    title="Chuyển đổi nhanh doanh nghiệp đang quản trị"
                  >
                    <span className="admin-switcher-label">Chuyển DN</span>
                    <span className="admin-switcher-code">{companyInfo?.code || companies[0]?.code}</span>
                    <span className="admin-switcher-name">{companyInfo?.name || companies[0]?.name}</span>
                    <ChevronDown size={14} className={`admin-switcher-chevron ${switcherOpen ? "is-open" : ""}`} />
                  </button>

                  {switcherOpen && (
                    <div className="admin-company-switcher-popover">
                      <div className="admin-switcher-popover-header">
                        <span className="admin-switcher-popover-title">
                          Chọn doanh nghiệp quản trị ({companies.length})
                        </span>
                        <Link
                          to="/select-company"
                          style={{ fontSize: 11.5, fontWeight: 600, color: "#0052cc", display: "inline-flex", alignItems: "center", gap: 4 }}
                          onClick={() => setSwitcherOpen(false)}
                        >
                          Tất cả DN <ExternalLink size={11} />
                        </Link>
                      </div>

                      {companies.length >= 2 && (
                        <div className="admin-switcher-search-wrap">
                          <Search size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                          <input
                            type="text"
                            className="admin-switcher-search-input"
                            placeholder="Tìm theo tên, mã DN hoặc MST..."
                            value={switcherSearch}
                            onChange={(e) => setSwitcherSearch(e.target.value)}
                            autoFocus
                          />
                          {switcherSearch && (
                            <button
                              type="button"
                              onClick={() => setSwitcherSearch("")}
                              style={{ background: "none", border: "none", padding: 2, color: "#94a3b8", cursor: "pointer" }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="admin-switcher-list admin-custom-scroll">
                        {filteredSwitcherCompanies.length === 0 ? (
                          <div style={{ padding: "18px 12px", textAlign: "center", fontSize: 12.5, color: "#64748b" }}>
                            Không tìm thấy doanh nghiệp phù hợp.
                          </div>
                        ) : (
                          filteredSwitcherCompanies.map((c) => {
                            const isCurrent = c.id === (companyId || companyInfo?.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`admin-switcher-item ${isCurrent ? "is-active" : ""}`}
                                onClick={() => {
                                  setSwitcherOpen(false);
                                  setSwitcherSearch("");
                                  if (selectCompany && c.id !== companyId) {
                                    selectCompany(c.id);
                                  }
                                }}
                              >
                                <div className="admin-switcher-item-icon">
                                  <Building2 size={17} />
                                </div>
                                <div className="admin-switcher-item-body">
                                  <div className="admin-switcher-item-name">{c.name}</div>
                                  <div className="admin-switcher-item-meta">
                                    <span className="admin-switcher-item-code">{c.code}</span>
                                    <span>MST: {c.tax_code || "Chưa thiết lập"}</span>
                                    <span style={{ color: "#10b981", fontWeight: 600 }}>• Hoạt động</span>
                                  </div>
                                </div>
                                {isCurrent && (
                                  <div className="admin-switcher-item-check" title="Đang chọn">
                                    <Check size={13} strokeWidth={3} />
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <span className="admin-badge admin-badge-active">
                <CheckCircle2 size={12} /> {companyInfo?.status === "ACTIVE" || !companyInfo?.status ? "Hoạt động" : companyInfo?.status}
              </span>
            </div>
            <div className="admin-header-subtitle">
              <span>Mã DN: <strong>{companyInfo?.code}</strong></span>
              <span>MST: <strong>{companyInfo?.tax_code || "Chưa thiết lập"}</strong></span>
              <span>Chủ sở hữu (Admin): <strong>{ownerMember ? (ownerMember.full_name || ownerMember.email) : (companyInfo?.legal_representative || "Chưa gán")}</strong></span>
              <span>Chế độ: <strong>{formatAccountingRegime(companyInfo?.accounting_regime || "TT99")}</strong></span>
            </div>
          </div>
          <div className="admin-header-actions">
            <Link to="/opening" className="admin-btn admin-btn-light" title="Khai báo số dư ban đầu cho doanh nghiệp này">
              <FileSpreadsheet size={15} /> Số dư ban đầu
            </Link>
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
          {pendingJoinRequestsCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                padding: "1px 7px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: "#ef4444",
                color: "#ffffff",
              }}
            >
              {pendingJoinRequestsCount} chờ duyệt
            </span>
          )}
        </button>
        <button
          className={`admin-nav-tab ${activeTab === "roles" ? "active" : ""}`}
          onClick={() => setActiveTab("roles")}
        >
          <ShieldCheck size={16} /> 3. Vai trò & Ma trận phân quyền ({activeRoles.length}/{roles.length})
        </button>
        <button
          className={`admin-nav-tab ${activeTab === "config" ? "active" : ""}`}
          onClick={() => setActiveTab("config")}
        >
          <Settings size={16} /> 4. Cấu hình Hệ thống & Kế toán
        </button>
      </nav>

      {/* Alert Notification handled via GlobalFeedbackPopupHost */}
      <div className="admin-container">

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
                  <h4>Vai trò đang bật</h4>
                  <p>{activeRoles.length} <span style={{ fontSize: "13.6px", fontWeight: 500, color: "#64748b" }}>/ {roles.length} chuẩn</span></p>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "stretch" }}>
              <div className="admin-card" style={{ height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
                <div className="admin-card-header" style={{ minHeight: 56, boxSizing: "border-box" }}>
                  <h3>
                    <Building2 size={18} /> Thông tin Pháp lý & Hồ sơ Doanh nghiệp
                  </h3>
                  <Link to="/company-profile" className="admin-btn admin-btn-secondary admin-btn-sm">
                    Sửa hồ sơ
                  </Link>
                </div>
                <div className="admin-card-body" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <table className="admin-table" style={{ height: "100%" }}>
                    <tbody>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Tên doanh nghiệp</td>
                        <td><strong>{companyInfo?.name}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Mã doanh nghiệp / MST</td>
                        <td>
                          <strong>{companyInfo?.code || "TUNG_TIMO"}</strong> · MST: <strong>{companyInfo?.tax_code || "Chưa đăng ký"}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Người đại diện pháp luật</td>
                        <td><strong>{companyInfo?.legal_representative || "Chưa cập nhật"}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Chế độ kế toán áp dụng</td>
                        <td><strong>{formatAccountingRegime(companyInfo?.accounting_regime || "TT99")}</strong></td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)" }}>Địa chỉ trụ sở</td>
                        <td>{companyInfo?.address || "198 Trần Quang Khải, P. Hoàn Kiếm, Hà Nội"}</td>
                      </tr>
                      <tr>
                        <td style={{ width: 200, minWidth: 200, whiteSpace: "nowrap", color: "var(--admin-text-muted)", borderBottom: "none" }}>Trạng thái vận hành</td>
                        <td style={{ borderBottom: "none" }}>
                          <span className="admin-badge admin-badge-active" style={{ textTransform: "none", fontSize: 12 }}>
                            Đang hoạt động · Đầy đủ 12 phân hệ
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card" style={{ height: "100%", marginBottom: 0, display: "flex", flexDirection: "column" }}>
                <div className="admin-card-header" style={{ minHeight: 56, boxSizing: "border-box" }}>
                  <h3>
                    <KeyRound size={18} /> Phím tắt Thao tác Nhanh cho Admin
                  </h3>
                </div>
                <div className="admin-card-body" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.65rem" }}>
                  <Link
                    to="/opening"
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}
                  >
                    <FileSpreadsheet size={16} /> Khai báo & Đối chiếu Số dư ban đầu (Số dư độc lập của công ty)
                  </Link>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40 }}
                    onClick={() => handleSeedStandardRoles()}
                  >
                    <Sparkles size={16} style={{ color: "var(--admin-primary)" }} /> Đồng bộ danh mục 21 vai trò chuẩn & Preset theo Chế độ kế toán (TT58 / TT133 / TT200 / TT99)
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40 }}
                    onClick={() => {
                      setActiveTab("personnel");
                      setShowEmployeeModal(true);
                    }}
                  >
                    <Plus size={16} /> Thêm nhân viên mới vào công ty
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40 }}
                    onClick={() => setActiveTab("roles")}
                  >
                    <ShieldCheck size={16} /> Tinh chỉnh ma trận quyền cho từng Role
                  </button>
                  <button
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40 }}
                    onClick={() => setActiveTab("personnel")}
                  >
                    <UserCheck size={16} /> Duyệt nhân sự xin gia nhập doanh nghiệp
                    {pendingJoinRequestsCount > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                        }}
                      >
                        {pendingJoinRequestsCount} yêu cầu mới
                      </span>
                    )}
                  </button>
                  <Link
                    to="/fiscal-periods"
                    className="admin-btn admin-btn-secondary"
                    style={{ justifyContent: "flex-start", minHeight: 40 }}
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
                    <span style={{ fontWeight: 700, fontSize: "15.2px", color: "#1e293b" }}>
                      Quản trị viên Doanh nghiệp (Chủ tài khoản):
                    </span>
                    <span className="admin-badge admin-badge-gold">
                      👑 {members.find(m => m.role_assignments?.some(r => isAdminRoleCode(r.role_code)))?.email || companyInfo?.legal_representative || "Admin Doanh nghiệp"}
                    </span>
                  </div>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "13.2px", color: "#475569" }}>
                    Quản trị viên Doanh nghiệp nắm toàn quyền quản trị và phân bổ vai trò cho toàn bộ nhân sự trong doanh nghiệp <strong>{companyInfo?.name}</strong>. Các tài khoản còn lại thuộc doanh nghiệp và được cấp quyền theo vai trò nghiệp vụ.
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="admin-btn admin-btn-light"
                  style={{ background: "#ffffff", color: "var(--admin-primary)", border: "1px solid #bfdbfe" }}
                  onClick={() => handleSeedStandardRoles()}
                  title="Đồng bộ danh mục 21 vai trò chuẩn theo Chế độ kế toán"
                >
                  <Sparkles size={14} /> Đồng bộ Role theo Thông tư
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
                  <h4>Bộ vai trò đang bật</h4>
                  <p>{activeRoles.length} <span style={{ fontSize: "13.1px", fontWeight: 500, color: "#64748b" }}>/ {roles.length} chuẩn</span></p>
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
                    <MisaDropdownSelect
                      value={memberScopeFilter}
                      onChange={(val) => setMemberScopeFilter(val as any)}
                      minWidth={195}
                      searchable={false}
                      options={[
                        { value: "all", label: "Tất cả phân cấp" },
                        { value: "admin", label: "👑 Chỉ Admin Doanh nghiệp" },
                        { value: "staff", label: "👤 Chỉ Nhân sự nghiệp vụ" },
                      ]}
                    />
                    <MisaDropdownSelect
                      value={memberRoleFilter}
                      onChange={(val) => setMemberRoleFilter(val)}
                      minWidth={220}
                      searchPlaceholder="Tìm vai trò nghiệp vụ..."
                      options={[
                        { value: "", label: "Tất cả vai trò đang dùng" },
                        ...activeRoles.map((r) => {
                          const gInfo = ROLE_GROUP_MAP[r.code];
                          return {
                            value: r.code,
                            label: formatRoleDisplayName(r.code, r.name),
                            badge: gInfo?.groupVi,
                            badgeBg: gInfo?.badgeBg,
                            badgeColor: gInfo?.badgeColor,
                          };
                        }),
                      ]}
                    />
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
                          m.role_assignments?.some((r) => isAdminRoleCode(r.role_code)) ||
                          m.id === ownerMember?.id;

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
                                    fontSize: "14.4px",
                                    boxShadow: isCompanyAdmin ? "0 1px 3px rgba(234, 179, 8, 0.4)" : "none",
                                    border: isCompanyAdmin ? "2px solid #eab308" : "1px solid #93c5fd",
                                    flexShrink: 0,
                                  }}
                                >
                                  {m.full_name ? m.full_name.charAt(0).toUpperCase() : "U"}
                                </div>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                                    <strong style={{ fontSize: "14.4px", color: isCompanyAdmin ? "#92400e" : "#1e293b" }}>
                                      {m.full_name || m.email}
                                    </strong>
                                    {isCompanyAdmin && <Sparkles size={13} color="#eab308" />}
                                  </div>
                                  <div style={{ fontSize: "12.8px", color: "#64748b", fontFamily: "monospace" }}>
                                    {m.email}
                                  </div>
                                  {m.phone && (
                                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
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
                                    if (isAdminRoleCode(ra.role_code)) {
                                      badgeClass = "admin-badge-gold";
                                      icon = <Sparkles size={12} />;
                                    } else if (ra.role_code === "ROLE_DIRECTOR") {
                                      badgeClass = "admin-badge-gold";
                                      icon = <ShieldCheck size={12} />;
                                    } else if (ra.role_code === "ROLE_CHIEF_ACCOUNTANT" || ra.role_code === "KT_TRUONG") {
                                      badgeClass = "admin-badge-purple";
                                      icon = <ShieldCheck size={12} />;
                                    } else if (ra.role_code === "ROLE_TREASURER" || ra.role_code === "THU_QUY" || ra.role_code === "ROLE_CASH_ACCOUNTANT" || ra.role_code === "ROLE_BANK_ACCOUNTANT") {
                                      badgeClass = "admin-badge-active";
                                    } else if (ra.role_code === "ROLE_SALES_ACCOUNTANT" || ra.role_code === "KT_BANHANG" || ra.role_code === "ROLE_AR_ACCOUNTANT") {
                                      badgeClass = "admin-badge-blue";
                                    } else if (ra.role_code === "ROLE_PURCHASE_ACCOUNTANT" || ra.role_code === "KT_MUAHANG" || ra.role_code === "ROLE_AP_ACCOUNTANT") {
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
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                  {m.employee_branch_name || "Trụ sở chính"}
                                </span>
                                <span style={{ fontSize: "12px", color: "#475569" }}>
                                  {m.employee_department_name || "Phòng Kế toán - Tài chính"}
                                  {m.employee_code ? ` · Mã NV: ${m.employee_code}` : ""}
                                </span>
                                <div>
                                  {isCompanyAdmin || m.role_assignments?.[0]?.allow_all_company_data !== false ? (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: 6,
                                        background: "#eff6ff",
                                        color: "#1d4ed8",
                                        border: "1px solid #bfdbfe",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      🏢 Toàn doanh nghiệp
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "2px 8px",
                                        borderRadius: 6,
                                        background: "#ecfdf5",
                                        color: "#047857",
                                        border: "1px solid #a7f3d0",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      📍 Chỉ xem: {m.employee_branch_name || m.role_assignments?.[0]?.data_scope_set_name || "Chi nhánh riêng"}
                                    </span>
                                  )}
                                </div>
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
                                    setTargetRoleCode(m.role_assignments[0]?.role_code || "ROLE_CHIEF_ACCOUNTANT");
                                    const isAll = m.role_assignments?.[0]?.allow_all_company_data !== false;
                                    setTargetBranchScope(
                                      !isAll && m.employee_branch_id ? String(m.employee_branch_id) : "all"
                                    );
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
                                  title="Xem phạm vi phân hệ và quyền nghiệp vụ được cấp"
                                >
                                  <KeyRound size={13} /> {summarizeMemberPermissions(m.effective_permissions, isCompanyAdmin).buttonLabel}
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
                          <span style={{ marginLeft: "0.5rem", color: "var(--admin-text-muted)", fontSize: "12.8px" }}>
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
                <div className="admin-card-header" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <UserCheck size={18} /> Phê duyệt Gia nhập Doanh nghiệp ({joinRequests.length})
                    {pendingJoinRequestsCount > 0 && (
                      <span className="admin-badge admin-badge-pending">
                        {pendingJoinRequestsCount} chờ duyệt
                      </span>
                    )}
                  </h3>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                    <MisaDropdownSelect
                      value={joinStatusFilter}
                      onChange={(val) => setJoinStatusFilter(val)}
                      minWidth={175}
                      searchable={false}
                      options={[
                        { value: "PENDING", label: `Chờ xử lý (${pendingJoinRequestsCount})` },
                        { value: "APPROVED", label: `Đã duyệt (${joinRequests.filter((j) => j.status === "APPROVED").length})` },
                        { value: "REJECTED", label: `Từ chối (${joinRequests.filter((j) => j.status === "REJECTED").length})` },
                        { value: "", label: `Tất cả (${joinRequests.length})` },
                      ]}
                    />
                    <Link to="/join-requests-admin" className="admin-btn admin-btn-secondary admin-btn-sm">
                      Mở trang riêng
                    </Link>
                  </div>
                </div>
                <div className="admin-card-body">
                  {filteredJoinRequests.length === 0 ? (
                    <div style={{ padding: "1.25rem 0.5rem", textAlign: "center", color: "var(--admin-text-muted)", fontSize: "13.6px" }}>
                      {joinStatusFilter === "PENDING"
                        ? "Hiện không có yêu cầu xin gia nhập nào đang chờ duyệt."
                        : "Không có yêu cầu gia nhập nào ở trạng thái này."}
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {filteredJoinRequests.map((req) => (
                        <li
                          key={req.id}
                          style={{
                            padding: "0.85rem 1rem",
                            border: req.status === "PENDING" ? "1px solid #fde68a" : "1px solid #e2e8f0",
                            background: req.status === "PENDING" ? "#fffbeb" : "#f8fafc",
                            borderRadius: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "0.75rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 220 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <strong style={{ fontSize: "14.7px", color: "#0f172a" }}>{req.requester_name}</strong>
                              <span
                                className={`admin-badge ${
                                  req.status === "APPROVED"
                                    ? "admin-badge-active"
                                    : req.status === "PENDING"
                                    ? "admin-badge-pending"
                                    : "admin-badge-suspended"
                                }`}
                              >
                                {req.status_display || (req.status === "PENDING" ? "Chờ xử lý" : req.status === "APPROVED" ? "Đã duyệt" : req.status)}
                              </span>
                            </div>
                            <div style={{ fontSize: "12.8px", color: "#475569", marginTop: 3 }}>
                              Email: <strong>{req.requester_email || "—"}</strong>
                              {req.requester_phone ? <> · SĐT: <strong>{req.requester_phone}</strong></> : null}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: 2 }}>
                              Gửi lúc: {new Date(req.created_at).toLocaleString("vi-VN")}
                            </div>
                            {req.message && (
                              <div style={{ fontSize: "13.1px", color: "#1e293b", marginTop: 6, background: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                                <strong>Lời nhắn:</strong> {req.message}
                              </div>
                            )}
                            {req.decision_reason && (
                              <div style={{ fontSize: "12.5px", color: req.status === "REJECTED" ? "#b91c1c" : "#047857", marginTop: 4 }}>
                                <strong>Lý do xử lý:</strong> {req.decision_reason}
                              </div>
                            )}
                          </div>
                          {req.status === "PENDING" && (
                            <div style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                              <button
                                type="button"
                                className="admin-btn admin-btn-primary admin-btn-sm"
                                style={{ background: "#059669", borderColor: "#047857" }}
                                onClick={() => openDecideJoinModal(req, "APPROVED")}
                              >
                                <Check size={14} /> Chấp thuận
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary admin-btn-sm"
                                style={{ color: "#b91c1c", borderColor: "#fca5a5", background: "#ffffff" }}
                                onClick={() => openDecideJoinModal(req, "REJECTED")}
                              >
                                <X size={14} /> Từ chối
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ROLES & PERMISSION MATRIX ================= */}
        {activeTab === "roles" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18.4px", fontWeight: 700 }}>
                  Ma trận 21 Vai trò Chuẩn & Phân bổ theo 4 Thông tư Chế độ Kế toán
                </h2>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "13.2px", color: "var(--admin-text-muted)" }}>
                  Hệ thống cung cấp đủ <strong>21 vai trò chuẩn</strong> nhưng chỉ bật số lượng Role phù hợp với quy mô doanh nghiệp (tránh rối cho DN siêu nhỏ TT58). Bạn có thể chuyển đổi Preset hoặc Bật/Tắt từng Role bất kỳ lúc nào.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button className="admin-btn admin-btn-primary" onClick={() => handleSeedStandardRoles()}>
                  <Sparkles size={15} /> Đồng bộ theo Thông tư công ty ({companyInfo?.accounting_regime || "TT99"})
                </button>
                <button className="admin-btn admin-btn-secondary" onClick={() => setShowRoleModal(true)}>
                  <Plus size={15} /> Tạo vai trò tùy chỉnh
                </button>
              </div>
            </div>

            {/* 4-REGIME ROLE PRESET SELECTOR CARDS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
                gap: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              {REGIME_ROLE_PRESETS.map((preset) => {
                const companyRegime = (companyInfo?.accounting_regime || "").toUpperCase();
                const isCompanyRegime =
                  (preset.key === "TT58" && companyRegime.includes("58")) ||
                  (preset.key === "TT133" && companyRegime.includes("133")) ||
                  (preset.key === "TT200" && companyRegime.includes("200")) ||
                  (preset.key === "TT99" && (companyRegime.includes("99") || !companyRegime));
                const isCurrentCountMatch = activeRoles.length === preset.activeCount;
                return (
                  <div
                    key={preset.key}
                    style={{
                      background: isCurrentCountMatch ? "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)" : "#ffffff",
                      border: isCurrentCountMatch ? `2px solid ${preset.color}` : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "0.9rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.55rem",
                      boxShadow: isCurrentCountMatch ? "0 4px 12px rgba(37, 99, 235, 0.08)" : "0 1px 2px rgba(15, 23, 42, 0.03)",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: `${preset.color}15`,
                            color: preset.color,
                          }}
                        >
                          {preset.badge}
                        </span>
                        {isCompanyRegime && (
                          <span style={{ fontSize: "11.2px", fontWeight: 700, color: "#059669", background: "#ecfdf5", padding: "2px 6px", borderRadius: 4 }}>
                            Thông tư hiện tại
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: "14.7px", color: "#0f172a" }}>{preset.label}</div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: preset.color, marginTop: 2 }}>{preset.subtitle}</div>
                      <p style={{ fontSize: "12.2px", color: "#64748b", margin: "0.35rem 0 0", lineHeight: 1.4 }}>{preset.desc}</p>
                    </div>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      style={{
                        width: "100%",
                        justifyContent: "center",
                        background: isCurrentCountMatch ? preset.color : "#f8fafc",
                        color: isCurrentCountMatch ? "#ffffff" : "#1e293b",
                        border: isCurrentCountMatch ? `1px solid ${preset.color}` : "1px solid #cbd5e1",
                        fontWeight: 600,
                      }}
                      onClick={() => handleSeedStandardRoles(preset.key)}
                    >
                      {isCurrentCountMatch ? `✓ Đang áp dụng (${preset.activeCount} Role)` : `Áp dụng bộ ${preset.activeCount} Role (${preset.key})`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="admin-matrix-layout">
              {/* Role Sidebar */}
              <div className="admin-role-sidebar">
                <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--admin-border)", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input
                    type="text"
                    className="admin-input"
                    style={{ width: "100%" }}
                    placeholder="Tìm kiếm vai trò nghiệp vụ..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button
                      type="button"
                      onClick={() => setRoleStatusFilter("ALL")}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "11.7px",
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: roleStatusFilter === "ALL" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                        background: roleStatusFilter === "ALL" ? "#eff6ff" : "#ffffff",
                        color: roleStatusFilter === "ALL" ? "#1d4ed8" : "#475569",
                      }}
                    >
                      Tất cả ({roles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleStatusFilter("ACTIVE")}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "11.7px",
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: roleStatusFilter === "ACTIVE" ? "1px solid #059669" : "1px solid #cbd5e1",
                        background: roleStatusFilter === "ACTIVE" ? "#ecfdf5" : "#ffffff",
                        color: roleStatusFilter === "ACTIVE" ? "#047857" : "#475569",
                      }}
                    >
                      Đang bật ({activeRoles.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleStatusFilter("AVAILABLE")}
                      style={{
                        flex: 1,
                        padding: "4px 6px",
                        fontSize: "11.7px",
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: "pointer",
                        border: roleStatusFilter === "AVAILABLE" ? "1px solid #d97706" : "1px solid #cbd5e1",
                        background: roleStatusFilter === "AVAILABLE" ? "#fffbeb" : "#ffffff",
                        color: roleStatusFilter === "AVAILABLE" ? "#b45309" : "#475569",
                      }}
                    >
                      Dự phòng ({availableRolesCount})
                    </button>
                  </div>
                  <MisaDropdownSelect
                    fullWidth
                    searchable={false}
                    value={roleGroupFilter}
                    onChange={(val) => setRoleGroupFilter(val)}
                    buttonStyle={{ height: 34, fontSize: "12.8px" }}
                    options={[
                      { value: "ALL", label: "Tất cả nhóm vai trò (7 nhóm)" },
                      { value: "System", label: "Nhóm Quản trị Hệ thống", badge: "Quản trị", badgeBg: "#fef3c7", badgeColor: "#92400e" },
                      { value: "Management", label: "Nhóm Ban Giám đốc", badge: "Điều hành", badgeBg: "#f3e8ff", badgeColor: "#6b21a8" },
                      { value: "Accounting", label: "Nhóm Kế toán Chuyên môn (12 vai trò)", badge: "Kế toán", badgeBg: "#dbeafe", badgeColor: "#1e40af" },
                      { value: "Operation", label: "Nhóm Vận hành Kho / Quỹ / Mua / Bán", badge: "Vận hành", badgeBg: "#d1fae5", badgeColor: "#065f46" },
                      { value: "Approval", label: "Nhóm Phê duyệt chứng từ", badge: "Phê duyệt", badgeBg: "#ffedd5", badgeColor: "#9a3412" },
                      { value: "Control", label: "Nhóm Kiểm soát / Kiểm toán", badge: "Kiểm soát", badgeBg: "#e0e7ff", badgeColor: "#3730a3" },
                      { value: "View Only", label: "Nhóm Xem báo cáo", badge: "Chỉ xem", badgeBg: "#f1f5f9", badgeColor: "#475569" },
                    ]}
                  />
                </div>
                <div style={{ maxHeight: "650px", overflowY: "auto" }}>
                  {roles
                    .filter((r) => {
                      if (roleStatusFilter === "ACTIVE" && r.status !== "ACTIVE") return false;
                      if (roleStatusFilter === "AVAILABLE" && r.status === "ACTIVE") return false;
                      const rGroup = r.role_group || ROLE_GROUP_MAP[r.code]?.group || "Custom";
                      if (roleGroupFilter !== "ALL" && rGroup !== roleGroupFilter) return false;
                      if (!roleSearch) return true;
                      const q = roleSearch.toLowerCase();
                      return (
                        r.name.toLowerCase().includes(q) ||
                        r.code.toLowerCase().includes(q) ||
                        formatRoleDisplayName(r.code, r.name).toLowerCase().includes(q)
                      );
                    })
                    .map((r) => {
                      const groupInfo = ROLE_GROUP_MAP[r.code] || {
                        group: r.role_group || "Custom",
                        groupVi: "Tùy chỉnh",
                        badgeBg: "#f1f5f9",
                        badgeColor: "#475569",
                      };
                      const isActiveRole = r.status === "ACTIVE";
                      return (
                        <div
                          key={r.id}
                          className={`admin-role-item ${selectedRole?.id === r.id ? "active" : ""}`}
                          onClick={() => setSelectedRole(r)}
                          style={{ opacity: isActiveRole ? 1 : 0.78 }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.4rem" }}>
                            <div className="admin-role-code" style={{ fontSize: "13.8px" }}>
                              {formatRoleDisplayName(r.code, r.name)}
                            </div>
                            {!isAdminRoleCode(r.code) && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleRoleStatus(r, e)}
                                title={isActiveRole ? "Tạm ẩn vai trò này khỏi danh sách phân công" : "Kích hoạt vai trò này để sử dụng trong công ty"}
                                style={{
                                  fontSize: "10.9px",
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  cursor: "pointer",
                                  border: isActiveRole ? "1px solid #bbf7d0" : "1px solid #cbd5e1",
                                  background: isActiveRole ? "#dcfce7" : "#f1f5f9",
                                  color: isActiveRole ? "#166534" : "#475569",
                                  flexShrink: 0,
                                }}
                              >
                                {isActiveRole ? "Đang bật" : "+ Bật dùng"}
                              </button>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: "10.9px",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: groupInfo.badgeBg,
                                color: groupInfo.badgeColor,
                              }}
                            >
                              {groupInfo.groupVi}
                            </span>
                            <span style={{ fontSize: "11.2px", color: "#64748b" }}>
                              {formatRoleScopeSummary(r)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Permission Matrix for Selected Role */}
              <div className="admin-card" style={{ marginBottom: 0 }}>
                <div className="admin-card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
                  <div>
                    <h3>
                      <ShieldCheck size={18} /> Phân quyền cho vai trò:{" "}
                      <strong>{formatRoleDisplayName(selectedRole?.code || "", selectedRole?.name)}</strong>
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        {selectedRoleSummary.moduleCount}/15 phân hệ nghiệp vụ
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#f0fdf4",
                          color: "#15803d",
                          border: "1px solid #bbf7d0",
                        }}
                      >
                        {selectedRoleSummary.featureCount} nhóm nghiệp vụ được cấp
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <div
                      style={{
                        display: "inline-flex",
                        background: "#f1f5f9",
                        padding: 3,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setMatrixViewMode("grouped")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          background: matrixViewMode === "grouped" ? "#ffffff" : "transparent",
                          color: matrixViewMode === "grouped" ? "#1d4ed8" : "#64748b",
                          boxShadow: matrixViewMode === "grouped" ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                        }}
                      >
                        Theo nghiệp vụ (Gọn)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrixViewMode("detailed")}
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          fontWeight: 600,
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          background: matrixViewMode === "detailed" ? "#ffffff" : "transparent",
                          color: matrixViewMode === "detailed" ? "#1d4ed8" : "#64748b",
                          boxShadow: matrixViewMode === "detailed" ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                        }}
                      >
                        Chi tiết thao tác
                      </button>
                    </div>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Tìm nghiệp vụ / phân hệ..."
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      style={{ width: 200 }}
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

                <div className="admin-card-body admin-custom-scroll" style={{ maxHeight: "620px", overflowY: "auto" }}>
                  {matrixViewMode === "grouped" ? (
                    Object.keys(groupedMatrixFeatures).length === 0 ? (
                      <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: "2rem" }}>
                        Không tìm thấy nghiệp vụ phù hợp.
                      </p>
                    ) : (
                      Object.entries(groupedMatrixFeatures).map(([moduleTitle, features]) => {
                        const moduleAllCodes = features.flatMap((f) => f.codes);
                        const moduleSelectedCount = moduleAllCodes.filter((c) => selectedPermCodes.has(c)).length;
                        const isModuleAllSelected = moduleAllCodes.length > 0 && moduleSelectedCount === moduleAllCodes.length;
                        const moduleViewCodes = features.flatMap((f) => f.tiers.VIEW);

                        return (
                          <div
                            key={moduleTitle}
                            style={{
                              marginBottom: "1.1rem",
                              border: "1px solid #e2e8f0",
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "#ffffff",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: "0.5rem",
                                padding: "0.55rem 0.85rem",
                                backgroundColor: "#f8fafc",
                                borderBottom: "1px solid #e2e8f0",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <strong style={{ fontSize: "14.1px", color: "#0f172a" }}>{moduleTitle}</strong>
                                <span
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    padding: "1px 7px",
                                    borderRadius: 999,
                                    background: moduleSelectedCount > 0 ? "#dbeafe" : "#f1f5f9",
                                    color: moduleSelectedCount > 0 ? "#1e40af" : "#64748b",
                                  }}
                                >
                                  {features.length} nghiệp vụ
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                {moduleViewCodes.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      togglePermissionBatch(moduleAllCodes, false);
                                      togglePermissionBatch(moduleViewCodes, true);
                                    }}
                                    style={{
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      border: "1px solid #bfdbfe",
                                      background: "#eff6ff",
                                      color: "#1d4ed8",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Chỉ cấp quyền Xem
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => togglePermissionBatch(moduleAllCodes, !isModuleAllSelected)}
                                  style={{
                                    fontSize: "11.5px",
                                    fontWeight: 600,
                                    padding: "3px 8px",
                                    borderRadius: 6,
                                    border: isModuleAllSelected ? "1px solid #fca5a5" : "1px solid #bbf7d0",
                                    background: isModuleAllSelected ? "#fef2f2" : "#f0fdf4",
                                    color: isModuleAllSelected ? "#b91c1c" : "#15803d",
                                    cursor: "pointer",
                                  }}
                                >
                                  {isModuleAllSelected ? "Bỏ chọn phân hệ" : "Chọn cả phân hệ"}
                                </button>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {features.map((feat, fIdx) => {
                                const featSelectedCount = feat.codes.filter((c) => selectedPermCodes.has(c)).length;
                                const isFeatAll = feat.codes.length > 0 && featSelectedCount === feat.codes.length;
                                const isFeatPartial = featSelectedCount > 0 && !isFeatAll;

                                return (
                                  <div
                                    key={feat.featureKey}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: "0.75rem",
                                      flexWrap: "wrap",
                                      padding: "0.6rem 0.85rem",
                                      borderBottom: fIdx === features.length - 1 ? "none" : "1px solid #f1f5f9",
                                      background: featSelectedCount > 0 ? "#fcfdff" : "#ffffff",
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.55rem",
                                        cursor: "pointer",
                                        minWidth: 220,
                                        flex: 1,
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isFeatAll}
                                        ref={(el) => {
                                          if (el) el.indeterminate = isFeatPartial;
                                        }}
                                        onChange={() => togglePermissionBatch(feat.codes, !isFeatAll)}
                                      />
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "13.3px",
                                          color: featSelectedCount > 0 ? "#0f172a" : "#475569",
                                        }}
                                      >
                                        {feat.featureName}
                                      </span>
                                    </label>

                                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                      {(["VIEW", "EDIT", "APPROVE", "EXPORT", "ADMIN"] as PermTierKey[]).map((tierKey) => {
                                        const tierCodes = feat.tiers[tierKey];
                                        if (!tierCodes || tierCodes.length === 0) return null;
                                        const tierMeta = PERM_TIER_META[tierKey];
                                        const activeCount = tierCodes.filter((c) => selectedPermCodes.has(c)).length;
                                        const isActive = activeCount > 0;
                                        const isAllTier = activeCount === tierCodes.length;

                                        return (
                                          <button
                                            key={tierKey}
                                            type="button"
                                            onClick={() => togglePermissionBatch(tierCodes, !isAllTier)}
                                            title={`${tierMeta.label} (${activeCount}/${tierCodes.length} thao tác)`}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              padding: "3px 9px",
                                              borderRadius: 999,
                                              fontSize: "11.7px",
                                              fontWeight: 600,
                                              cursor: "pointer",
                                              transition: "all 0.15s ease",
                                              border: isActive ? `1px solid ${tierMeta.border}` : "1px solid #e2e8f0",
                                              background: isActive ? tierMeta.bg : "#f8fafc",
                                              color: isActive ? tierMeta.color : "#94a3b8",
                                            }}
                                          >
                                            {isActive ? <Check size={11} strokeWidth={3} /> : null}
                                            <span>{tierMeta.shortLabel}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : Object.keys(groupedPermissions).length === 0 ? (
                    <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: "2rem" }}>
                      Không tìm thấy quyền phù hợp.
                    </p>
                  ) : (
                    Object.entries(groupedPermissions).map(([groupTitle, perms]) => (
                      <div key={groupTitle} style={{ marginBottom: "1.5rem" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "14.4px",
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
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "0.6rem",
                                  padding: "0.55rem 0.75rem",
                                  borderRadius: "6px",
                                  border: isChecked ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                                  backgroundColor: isChecked ? "#eff6ff" : "#ffffff",
                                  cursor: "pointer",
                                  fontSize: "12.8px",
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
                                    {permInfo.name}
                                  </div>
                                  <div style={{ fontSize: "11.8px", color: "#64748b", marginTop: "0.2rem", lineHeight: 1.35 }}>
                                    {permInfo.desc}
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
              {/* Opening Balances Control */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3>
                    <FileSpreadsheet size={18} /> Số dư Ban đầu & Hạch toán Khởi tạo
                  </h3>
                  <Link to="/opening" className="admin-btn admin-btn-primary admin-btn-sm">
                    Mở số dư đầu kỳ
                  </Link>
                </div>
                <div className="admin-card-body">
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "13.6px", marginBottom: "1rem" }}>
                    Khai báo và đối chiếu số dư ban đầu cho riêng doanh nghiệp <strong>{companyInfo?.name}</strong>. Dữ liệu số dư hoàn toàn biệt lập theo từng workspace.
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13.6px" }}>
                    <li style={{ padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
                      <span>Phạm vi lưu trữ:</span>
                      <strong style={{ color: "var(--admin-primary)" }}>Workspace riêng biệt</strong>
                    </li>
                    <li style={{ padding: "0.5rem 0", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
                      <span>Kiểm soát cân đối:</span>
                      <span className="admin-badge admin-badge-active">Chuẩn TT99/2025/TT-BTC</span>
                    </li>
                    <li style={{ padding: "0.5rem 0", display: "flex", justifyContent: "space-between" }}>
                      <span>Thao tác trực tiếp:</span>
                      <Link to="/opening" style={{ color: "var(--admin-primary)", textDecoration: "none", fontWeight: 600 }}>
                        Vào trung tâm khai báo số dư &rarr;
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

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
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "13.6px", marginBottom: "1rem" }}>
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
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "13.6px", marginBottom: "1rem" }}>
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
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "13.6px", marginBottom: "1rem" }}>
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
                  <p style={{ color: "var(--admin-text-muted)", fontSize: "13.6px", marginBottom: "1rem" }}>
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
                  <label>Chi nhánh làm việc &amp; Phạm vi dữ liệu (*)</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={employeeFormData.branch_id}
                    onChange={(val) => setEmployeeFormData({ ...employeeFormData, branch_id: val })}
                    searchPlaceholder="Tìm chi nhánh..."
                    options={[
                      { value: "all", label: "🏢 Toàn doanh nghiệp (Xem tất cả chi nhánh)" },
                      ...branches.map((b) => ({
                        value: b.id,
                        label: `📍 ${b.code} - ${b.name}${b.is_head_office ? " (Trụ sở chính)" : ""} — Chỉ xem dữ liệu chi nhánh này`,
                      })),
                    ]}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Phòng ban / Đơn vị trực thuộc</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={employeeFormData.department_id}
                    onChange={(val) => setEmployeeFormData({ ...employeeFormData, department_id: val })}
                    searchPlaceholder="Tìm phòng ban..."
                    options={[
                      { value: "", label: "Chọn phòng ban" },
                      ...departments.map((d) => ({
                        value: d.id,
                        label: d.name,
                      })),
                    ]}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Chức danh / Vị trí công việc</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={employeeFormData.position_id}
                    onChange={(val) => setEmployeeFormData({ ...employeeFormData, position_id: val })}
                    searchPlaceholder="Tìm chức danh..."
                    options={[
                      { value: "", label: "Chọn chức danh" },
                      ...positions.map((p) => ({
                        value: p.id,
                        label: p.name,
                      })),
                    ]}
                  />
                </div>
                <div className="admin-form-group">
                  <label>Vai trò Phân quyền Nghiệp vụ (theo Chế độ kế toán {companyInfo?.accounting_regime || "TT99"})</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={employeeFormData.role_code}
                    onChange={(val) => setEmployeeFormData({ ...employeeFormData, role_code: val })}
                    searchPlaceholder="Tìm nhanh vai trò nghiệp vụ..."
                    options={[
                      { value: "", label: "-- Chưa gán vai trò (Phân quyền sau) --" },
                      ...activeRoles.map((r) => {
                        const gInfo = ROLE_GROUP_MAP[r.code];
                        return {
                          value: r.code,
                          label: formatRoleDisplayName(r.code, r.name),
                          group: `Vai trò đang bật tại doanh nghiệp (${activeRoles.length})`,
                          badge: gInfo?.groupVi || "Chuẩn",
                          badgeBg: gInfo?.badgeBg || "#f1f5f9",
                          badgeColor: gInfo?.badgeColor || "#475569",
                        };
                      }),
                      ...roles
                        .filter((r) => r.status !== "ACTIVE")
                        .map((r) => {
                          const gInfo = ROLE_GROUP_MAP[r.code];
                          return {
                            value: r.code,
                            label: formatRoleDisplayName(r.code, r.name),
                            group: `Vai trò chuyên sâu dự phòng (${availableRolesCount})`,
                            badge: gInfo?.groupVi ? `${gInfo.groupVi} · Dự phòng` : "Dự phòng",
                            badgeBg: "#fffbeb",
                            badgeColor: "#b45309",
                          };
                        }),
                    ]}
                  />
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
                    <span style={{ color: "#64748b", fontSize: "13.2px" }}>Nhân sự được phân vai trò:</span>
                    <strong style={{ fontSize: "14.4px", color: "#1e293b" }}>{assignModalMember.full_name || assignModalMember.email}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                    <span style={{ color: "#64748b", fontSize: "13.2px" }}>Email đăng nhập:</span>
                    <code style={{ fontSize: "13.2px" }}>{assignModalMember.email}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b", fontSize: "13.2px" }}>Vai trò hiện tại:</span>
                    <span style={{ fontWeight: 600, color: "var(--admin-primary)", fontSize: "13.2px" }}>
                      {formatRoleDisplayName(assignModalMember.role_assignments[0]?.role_code, assignModalMember.role_assignments[0]?.role_name) || "Chưa gán vai trò"}
                    </span>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label>Chọn Vai trò Nghiệp vụ Mới (*)</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={targetRoleCode}
                    onChange={(val) => setTargetRoleCode(val)}
                    searchPlaceholder="Tìm nhanh vai trò nghiệp vụ (VD: Kế toán thuế, Thủ quỹ...)"
                    options={[
                      { value: "", label: "-- Chọn vai trò nghiệp vụ --" },
                      ...activeRoles.map((r) => {
                        const gInfo = ROLE_GROUP_MAP[r.code];
                        return {
                          value: r.code,
                          label: formatRoleDisplayName(r.code, r.name),
                          group: `Vai trò đang bật tại doanh nghiệp (${activeRoles.length})`,
                          badge: gInfo?.groupVi || "Đang bật",
                          badgeBg: gInfo?.badgeBg || "#f0fdf4",
                          badgeColor: gInfo?.badgeColor || "#166534",
                        };
                      }),
                      ...roles
                        .filter((r) => r.status !== "ACTIVE")
                        .map((r) => {
                          const gInfo = ROLE_GROUP_MAP[r.code];
                          return {
                            value: r.code,
                            label: formatRoleDisplayName(r.code, r.name),
                            group: `Vai trò chuyên sâu dự phòng (${availableRolesCount})`,
                            badge: gInfo?.groupVi ? `${gInfo.groupVi} · Dự phòng` : "Dự phòng",
                            badgeBg: "#fffbeb",
                            badgeColor: "#b45309",
                          };
                        }),
                    ]}
                  />
                </div>

                {/* Role Description Preview */}
                {targetRoleCode && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      fontSize: "12.8px",
                      color: "#166534",
                      marginBottom: "1rem",
                    }}
                  >
                    <strong>Phạm vi nhiệm vụ:</strong>{" "}
                    {roles.find((r) => r.code === targetRoleCode)?.description || "Vai trò nghiệp vụ tiêu chuẩn của doanh nghiệp."}
                  </div>
                )}

                <div className="admin-form-group">
                  <label>Phạm vi Chi nhánh được phép truy cập dữ liệu (*)</label>
                  <MisaDropdownSelect
                    fullWidth
                    value={targetBranchScope}
                    onChange={(val) => setTargetBranchScope(val)}
                    searchPlaceholder="Tìm chi nhánh..."
                    options={[
                      { value: "all", label: "🏢 Toàn doanh nghiệp (Tất cả chi nhánh)" },
                      ...branches.map((b) => ({
                        value: b.id,
                        label: `📍 Chỉ Chi nhánh: ${b.code} - ${b.name}${b.is_head_office ? " (Trụ sở chính)" : ""}`,
                      })),
                    ]}
                  />
                </div>

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

      {/* MODAL: Xem danh sách quyền thực tế của Member (Đã Việt hóa & Gom gọn theo Nghiệp vụ) */}
      {viewingPermsMember && (() => {
        const rawPerms = viewingPermsMember.effective_permissions || [];
        const q = viewingPermSearch.toLowerCase().trim();
        const isViewingMemberAdmin = viewingPermsMember.role_assignments?.some((r) => isAdminRoleCode(r.role_code));
        const memberPermSummary = summarizeMemberPermissions(rawPerms, !!isViewingMemberAdmin);
        const groupedModalFeatures = groupPermissionCodesByModuleAndFeature(rawPerms, viewingPermSearch);

        const translated = rawPerms.map((code) => {
          const info = translatePermissionCode(code);
          return { code, ...info };
        });

        const filtered = translated.filter((p) => {
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            p.desc.toLowerCase().includes(q) ||
            p.module.toLowerCase().includes(q)
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

        const allModules = Object.keys(modalPermViewMode === "grouped" ? groupedModalFeatures : grouped);
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

        const totalGroupedFeatures = Object.values(groupedModalFeatures).reduce((acc, arr) => acc + arr.length, 0);

        return (
          <div className="admin-modal-backdrop" onClick={() => setViewingPermsMember(null)}>
            <div
              className="admin-modal admin-modal-lg"
              style={{
                maxWidth: 940,
                width: "95vw",
                maxHeight: "88vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "14px",
                boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="admin-modal-header" style={{ flexShrink: 0, padding: "1.1rem 1.5rem" }}>
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <KeyRound size={20} color="var(--admin-primary)" />
                    Phạm vi quyền hạn: {viewingPermsMember.full_name || viewingPermsMember.email}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "12.8px", color: "#64748b", marginTop: "0.3rem", flexWrap: "wrap" }}>
                    <span>
                      Vai trò: <strong style={{ color: "var(--admin-primary)" }}>{roleNames}</strong>
                    </span>
                    <span>•</span>
                    <span
                      style={{
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "12px",
                      }}
                    >
                      {memberPermSummary.badgeSummary}
                    </span>
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
                {/* Search bar, View Mode Toggle & Collapse All button inside modal */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexShrink: 0, flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Tìm kiếm theo nghiệp vụ (VD: Hóa đơn bán hàng, Phiếu thu, Tờ khai thuế)..."
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
                  <div
                    style={{
                      display: "inline-flex",
                      background: "#f1f5f9",
                      padding: 3,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setModalPermViewMode("grouped")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: modalPermViewMode === "grouped" ? "#ffffff" : "transparent",
                        color: modalPermViewMode === "grouped" ? "#1d4ed8" : "#64748b",
                        boxShadow: modalPermViewMode === "grouped" ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                      }}
                    >
                      Theo nghiệp vụ ({totalGroupedFeatures})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalPermViewMode("detailed")}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        background: modalPermViewMode === "detailed" ? "#ffffff" : "transparent",
                        color: modalPermViewMode === "detailed" ? "#1d4ed8" : "#64748b",
                        boxShadow: modalPermViewMode === "detailed" ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                      }}
                    >
                      Chi tiết thao tác
                    </button>
                  </div>
                  {allModules.length > 1 && (
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      style={{ fontSize: "12px", padding: "0 0.75rem", whiteSpace: "nowrap", flexShrink: 0 }}
                      onClick={toggleCollapseAll}
                    >
                      {isAllCollapsed ? "Mở rộng tất cả" : "Thu gọn tất cả"}
                    </button>
                  )}
                </div>

                {/* Module Quick Filter Chips */}
                {allModules.length > 1 && (
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
                      Tất cả ({allModules.length} phân hệ)
                    </button>
                    {allModules.map((modName) => {
                      const countLabel =
                        modalPermViewMode === "grouped"
                          ? `${groupedModalFeatures[modName]?.length || 0} nghiệp vụ`
                          : `${grouped[modName]?.length || 0}`;
                      return (
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
                          {modName} ({countLabel})
                        </button>
                      );
                    })}
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
                    borderRadius: "10px",
                    padding: "0.85rem",
                    background: "#f8fafc",
                  }}
                >
                  {rawPerms.length === 0 ? (
                    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#94a3b8" }}>
                      Chưa có quyền hạn nào được kích hoạt cho tài khoản này. Vui lòng dùng nút "Đổi vai trò" để phân bổ vai trò nghiệp vụ.
                    </div>
                  ) : allModules.length === 0 ? (
                    <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#94a3b8" }}>
                      Không tìm thấy nghiệp vụ nào khớp với từ khóa "<strong>{viewingPermSearch}</strong>".
                    </div>
                  ) : modalPermViewMode === "grouped" ? (
                    Object.entries(groupedModalFeatures)
                      .filter(([moduleName]) => selectedModalModule === "ALL" || selectedModalModule === moduleName)
                      .map(([moduleName, features]) => {
                        const isCollapsed = collapsedModules[moduleName];
                        return (
                          <div
                            key={moduleName}
                            style={{
                              background: "#ffffff",
                              borderRadius: "10px",
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
                                padding: "0.6rem 0.9rem",
                                borderBottom: isCollapsed ? "none" : "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                cursor: "pointer",
                                userSelect: "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "13.8px", color: "#1e293b" }}>
                                {getModuleIcon(moduleName)}
                                <span>{moduleName}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span className="admin-badge admin-badge-blue" style={{ fontSize: "11.5px", padding: "0.15rem 0.55rem" }}>
                                  {features.length} nghiệp vụ
                                </span>
                                {isCollapsed ? <ChevronDown size={16} color="#64748b" /> : <ChevronUp size={16} color="#64748b" />}
                              </div>
                            </div>
                            {!isCollapsed && (
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                {features.map((feat, fIdx) => (
                                  <div
                                    key={feat.featureKey}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: "0.75rem",
                                      flexWrap: "wrap",
                                      padding: "0.6rem 0.9rem",
                                      borderBottom: fIdx === features.length - 1 ? "none" : "1px solid #f1f5f9",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 220, flex: 1 }}>
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
                                        }}
                                      >
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                      <span style={{ fontWeight: 600, fontSize: "13.4px", color: "#0f172a" }}>
                                        {feat.featureName}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                      {(["VIEW", "EDIT", "APPROVE", "EXPORT", "ADMIN"] as PermTierKey[]).map((tierKey) => {
                                        const tierCodes = feat.tiers[tierKey];
                                        if (!tierCodes || tierCodes.length === 0) return null;
                                        const tierMeta = PERM_TIER_META[tierKey];
                                        return (
                                          <span
                                            key={tierKey}
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4,
                                              padding: "2px 9px",
                                              borderRadius: 999,
                                              fontSize: "11.7px",
                                              fontWeight: 600,
                                              border: `1px solid ${tierMeta.border}`,
                                              background: tierMeta.bg,
                                              color: tierMeta.color,
                                            }}
                                          >
                                            <Check size={10} strokeWidth={3} />
                                            {tierMeta.shortLabel}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
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
                              borderRadius: "10px",
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
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "13.6px", color: "#1e293b" }}>
                                {getModuleIcon(moduleName)}
                                <span>{moduleName}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span className="admin-badge admin-badge-blue" style={{ fontSize: "11.2px", padding: "0.15rem 0.5rem" }}>
                                  {items.length} thao tác
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
                                      <div style={{ fontWeight: 600, fontSize: "13.2px", color: "#0f172a", lineHeight: 1.3 }}>
                                        {item.name}
                                      </div>
                                      <div style={{ fontSize: "11.8px", color: "#64748b", marginTop: "0.2rem", lineHeight: 1.3 }}>
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
                <div style={{ marginRight: "auto", fontSize: "12.8px", color: "#64748b" }}>
                  Phạm vi được cấp: <strong>{memberPermSummary.badgeSummary}</strong>
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

      {/* MODAL: Phê duyệt / Từ chối Yêu cầu Gia nhập Doanh nghiệp */}
      {decidingJoinReq && (
        <div className="admin-modal-backdrop" onClick={() => setDecidingJoinReq(null)}>
          <div className="admin-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                {decidingJoinReq.decision === "APPROVED" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#047857" }}>
                    <UserCheck size={20} /> Chấp thuận gia nhập doanh nghiệp
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, color: "#b91c1c" }}>
                    <ShieldAlert size={20} /> Từ chối yêu cầu gia nhập
                  </span>
                )}
              </h3>
              <button className="admin-modal-close" onClick={() => setDecidingJoinReq(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDecideJoinRequest}>
              <div className="admin-modal-body" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                <div style={{ padding: "0.75rem 1rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: "15.2px", color: "#0f172a" }}>
                    {decidingJoinReq.item.requester_name}
                  </div>
                  <div style={{ fontSize: "13.1px", color: "#475569", marginTop: 2 }}>
                    Email: <strong>{decidingJoinReq.item.requester_email || "—"}</strong>
                    {decidingJoinReq.item.requester_phone ? <> · SĐT: <strong>{decidingJoinReq.item.requester_phone}</strong></> : null}
                  </div>
                  {decidingJoinReq.item.message && (
                    <div style={{ fontSize: "13.1px", color: "#334155", marginTop: 6 }}>
                      <strong>Lời nhắn:</strong> {decidingJoinReq.item.message}
                    </div>
                  )}
                </div>

                {decidingJoinReq.decision === "APPROVED" && (
                  <div className="admin-form-group">
                    <label className="admin-label">Phân bổ Vai trò nghiệp vụ ngay khi gia nhập</label>
                    <MisaDropdownSelect
                      fullWidth
                      value={decidingJoinReq.roleId}
                      onChange={(val) => setDecidingJoinReq({ ...decidingJoinReq, roleId: val })}
                      searchPlaceholder="Tìm nhanh vai trò nghiệp vụ..."
                      options={[
                        { value: "", label: "-- Chưa gán vai trò cụ thể (Phân công sau) --" },
                        ...roles
                          .filter((r) => r.status === "ACTIVE")
                          .map((r) => {
                            const gInfo = ROLE_GROUP_MAP[r.code];
                            return {
                              value: r.id,
                              label: formatRoleDisplayName(r.code, r.name),
                              badge: gInfo?.groupVi || "Đang bật",
                              badgeBg: gInfo?.badgeBg || "#f0fdf4",
                              badgeColor: gInfo?.badgeColor || "#166534",
                            };
                          }),
                      ]}
                    />
                  </div>
                )}

                <div className="admin-form-group">
                  <label className="admin-label">
                    {decidingJoinReq.decision === "APPROVED" ? "Ghi chú / Lý do chấp thuận (gửi cho nhân sự)" : "Lý do từ chối (bắt buộc) *"}
                  </label>
                  <textarea
                    className="admin-input"
                    rows={3}
                    required={decidingJoinReq.decision === "REJECTED"}
                    placeholder={
                      decidingJoinReq.decision === "APPROVED"
                        ? "Ví dụ: Chào mừng bạn gia nhập phòng kế toán doanh nghiệp..."
                        : "Nhập lý do từ chối để thông báo cho người gửi..."
                    }
                    value={decidingJoinReq.reason}
                    onChange={(e) => setDecidingJoinReq({ ...decidingJoinReq, reason: e.target.value })}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Ghi chú nội bộ (chỉ Admin nhìn thấy)</label>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Ghi chú hồ sơ nội bộ (nếu có)..."
                    value={decidingJoinReq.internalNote}
                    onChange={(e) => setDecidingJoinReq({ ...decidingJoinReq, internalNote: e.target.value })}
                  />
                </div>

                {decidingJoinReq.decision === "APPROVED" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13.3px", color: "#475569", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={decidingJoinReq.reactivate}
                      onChange={(e) => setDecidingJoinReq({ ...decidingJoinReq, reactivate: e.target.checked })}
                    />
                    Kích hoạt lại nếu tài khoản này từng là thành viên cũ của công ty
                  </label>
                )}
              </div>
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setDecidingJoinReq(null)}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  style={
                    decidingJoinReq.decision === "APPROVED"
                      ? { background: "#059669", borderColor: "#047857" }
                      : { background: "#dc2626", borderColor: "#b91c1c" }
                  }
                  disabled={joinDecideSaving}
                >
                  {joinDecideSaving
                    ? "Đang xử lý..."
                    : decidingJoinReq.decision === "APPROVED"
                    ? "Xác nhận Chấp thuận"
                    : "Xác nhận Từ chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
