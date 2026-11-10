import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  FileText,
  Landmark,
  Search,
  Users,
} from "lucide-react";
import { Modal } from "./components";

export function SmartSearchResults({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (label: string) => void;
}) {
  if (!query.trim()) return null;
  return (
    <section
      className="erp3-smart-results"
      role="region"
      aria-label="Kết quả tìm kiếm thông minh"
    >
      <header>
        <Search size={14} />
        <span>Kết quả cho “{query}”</span>
        <kbd>Enter</kbd>
      </header>
      <div className="erp3-search-groups">
        <section>
          <h3>Chứng từ</h3>
          <button onClick={() => onSelect("Phiếu chi PC-2609-014")}>
            <FileText size={15} />
            <span>
              <strong>Phiếu chi PC-2609-014</strong>
              <small>Công ty TNHH Gỗ Việt · 42.500.000 đ</small>
            </span>
          </button>
          <button onClick={() => onSelect("Đơn mua hàng PO-2609-001")}>
            <FileText size={15} />
            <span>
              <strong>Đơn mua hàng PO-2609-001</strong>
              <small>Đang thực hiện · 232.100.000 đ</small>
            </span>
          </button>
        </section>
        <section>
          <h3>Hàng hóa, dịch vụ</h3>
          <button onClick={() => onSelect("Gỗ sồi xẻ quy cách")}>
            <Box size={15} />
            <span>
              <strong>NVL-GO-01 · Gỗ sồi xẻ quy cách</strong>
              <small>Tồn 18,5 m³ · Kho Hà Nội</small>
            </span>
          </button>
        </section>
        <section>
          <h3>Danh mục</h3>
          <button onClick={() => onSelect("Công ty TNHH Gỗ Việt")}>
            <Users size={15} />
            <span>
              <strong>Công ty TNHH Gỗ Việt</strong>
              <small>Nhà cung cấp · MST 0108897261</small>
            </span>
          </button>
        </section>
      </div>
      <footer>
        <span>Dùng ↑ ↓ để di chuyển</span>
        <button onClick={() => onSelect("Tìm kiếm nâng cao")}>
          Xem tất cả kết quả
        </button>
      </footer>
    </section>
  );
}

export interface RoleWorkspaceSpec {
  code: string;
  name: string;
  shortLabel: string;
  group: "System" | "Management" | "Accounting" | "Operation" | "Approval" | "Control" | "View Only";
  groupVi: string;
  regimes: ("TT58" | "TT133" | "TT200" | "TT99")[];
  allowedModules: string[];
  allowedQuickCreateTitles: string[];
  capabilitiesSummary: string;
  isReadOnly?: boolean;
}

const ALL_MODULE_IDS = [
  "overview", "cash", "bank", "purchases", "sales", "invoices",
  "inventory", "tools", "assets", "payroll", "cost", "ledger",
  "budget", "tax", "reports", "directory", "opening",
];

export const STANDARD_ROLES_WORKSPACE_SPEC: RoleWorkspaceSpec[] = [
  {
    code: "ROLE_ADMIN",
    name: "Quản trị doanh nghiệp",
    shortLabel: "Quản trị doanh nghiệp",
    group: "System",
    groupVi: "Quản trị hệ thống",
    regimes: ["TT58", "TT133", "TT200", "TT99"],
    allowedModules: ALL_MODULE_IDS,
    allowedQuickCreateTitles: ["TIỀN MẶT", "TIỀN GỬI", "KHO", "MUA HÀNG", "BÁN HÀNG", "TỔNG HỢP"],
    capabilitiesSummary: "Toàn quyền cấu hình doanh nghiệp, quản lý người dùng, phân quyền 21 Role và truy cập tất cả 15 phân hệ.",
  },
  {
    code: "ROLE_DIRECTOR",
    name: "Giám đốc",
    shortLabel: "Giám đốc",
    group: "Management",
    groupVi: "Ban Giám đốc",
    regimes: ["TT58", "TT133", "TT200", "TT99"],
    allowedModules: ["overview", "cash", "bank", "sales", "purchases", "budget", "reports", "analysis"],
    allowedQuickCreateTitles: [],
    capabilitiesSummary: "Xem Dashboard điều hành, dòng tiền, công nợ, báo cáo tài chính & Phê duyệt chứng từ theo thẩm quyền (không trực tiếp nhập liệu).",
    isReadOnly: true,
  },
  {
    code: "ROLE_CHIEF_ACCOUNTANT",
    name: "Kế toán trưởng",
    shortLabel: "Kế toán trưởng",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT58", "TT133", "TT200", "TT99"],
    allowedModules: ALL_MODULE_IDS,
    allowedQuickCreateTitles: ["TIỀN MẶT", "TIỀN GỬI", "KHO", "MUA HÀNG", "BÁN HÀNG", "TỔNG HỢP"],
    capabilitiesSummary: "Kiểm soát toàn bộ nghiệp vụ kế toán, duyệt chứng từ, ghi/bỏ ghi sổ, khóa kỳ kế toán và lập Báo cáo tài chính.",
  },
  {
    code: "ROLE_GENERAL_ACCOUNTANT",
    name: "Kế toán tổng hợp",
    shortLabel: "KT Tổng hợp",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT133", "TT200", "TT99"],
    allowedModules: ["overview", "cost", "ledger", "tax", "budget", "reports", "directory", "opening", "analysis"],
    allowedQuickCreateTitles: ["TỔNG HỢP"],
    capabilitiesSummary: "Tổng hợp số liệu Sổ cái, bút toán kết chuyển cuối kỳ, tính giá thành, đối chiếu số liệu và lập báo cáo tài chính.",
  },
  {
    code: "ROLE_TAX_ACCOUNTANT",
    name: "Kế toán thuế",
    shortLabel: "KT Thuế",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT133", "TT200", "TT99"],
    allowedModules: ["overview", "invoices", "tax", "purchases", "sales", "ledger", "reports", "directory"],
    allowedQuickCreateTitles: ["MUA HÀNG", "BÁN HÀNG", "TỔNG HỢP"],
    capabilitiesSummary: "Quản lý hóa đơn điện tử đầu ra/đầu vào, kê khai thuế GTGT, TNDN, TNCN, đối chiếu bảng kê thuế và sổ cái.",
  },
  {
    code: "ROLE_AP_ACCOUNTANT",
    name: "Kế toán phải trả",
    shortLabel: "Kế toán phải trả",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "purchases", "invoices", "cash", "bank", "reports", "directory"],
    allowedQuickCreateTitles: ["MUA HÀNG", "TIỀN MẶT", "TIỀN GỬI"],
    capabilitiesSummary: "Quản lý hóa đơn đầu vào, nhà cung cấp, theo dõi tuổi nợ phải trả, đối chiếu công nợ và lập đề nghị thanh toán.",
  },
  {
    code: "ROLE_AR_ACCOUNTANT",
    name: "Kế toán phải thu",
    shortLabel: "Kế toán phải thu",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "sales", "invoices", "cash", "bank", "reports", "directory"],
    allowedQuickCreateTitles: ["BÁN HÀNG", "TIỀN MẶT", "TIỀN GỬI"],
    capabilitiesSummary: "Quản lý hóa đơn bán hàng, khách hàng, theo dõi công nợ phải thu, đối chiếu và đôn đốc thu hồi nợ.",
  },
  {
    code: "ROLE_PURCHASE_ACCOUNTANT",
    name: "Kế toán mua hàng",
    shortLabel: "KT Mua hàng",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "purchases", "invoices", "inventory", "reports", "directory"],
    allowedQuickCreateTitles: ["MUA HÀNG", "KHO"],
    capabilitiesSummary: "Hạch toán chứng từ mua hàng hóa, mua dịch vụ, phân bổ chi phí mua hàng và theo dõi công nợ nhà cung cấp.",
  },
  {
    code: "ROLE_SALES_ACCOUNTANT",
    name: "Kế toán bán hàng",
    shortLabel: "KT Bán hàng",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT133", "TT200", "TT99"],
    allowedModules: ["overview", "sales", "invoices", "inventory", "reports", "directory"],
    allowedQuickCreateTitles: ["BÁN HÀNG"],
    capabilitiesSummary: "Ghi nhận chứng từ bán hàng, doanh thu, giảm trừ doanh thu, phát hành hóa đơn đầu ra và theo dõi phải thu khách hàng.",
  },
  {
    code: "ROLE_CASH_ACCOUNTANT",
    name: "Kế toán tiền mặt",
    shortLabel: "KT Tiền mặt",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "cash", "ledger", "reports", "directory"],
    allowedQuickCreateTitles: ["TIỀN MẶT"],
    capabilitiesSummary: "Lập và hạch toán Phiếu thu, Phiếu chi tiền mặt, đề nghị/quyết toán tạm ứng và đối chiếu Sổ kế toán tiền mặt.",
  },
  {
    code: "ROLE_BANK_ACCOUNTANT",
    name: "Kế toán ngân hàng",
    shortLabel: "KT Ngân hàng",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "bank", "reports", "directory"],
    allowedQuickCreateTitles: ["TIỀN GỬI"],
    capabilitiesSummary: "Hạch toán thu/chi tiền gửi ngân hàng (Báo Có / Ủy nhiệm chi), chuyển tiền nội bộ và đối soát sao kê ngân hàng.",
  },
  {
    code: "ROLE_INVENTORY_ACCOUNTANT",
    name: "Kế toán kho",
    shortLabel: "KT Kho",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT200", "TT99"],
    allowedModules: ["overview", "inventory", "cost", "purchases", "sales", "reports", "directory"],
    allowedQuickCreateTitles: ["KHO"],
    capabilitiesSummary: "Hạch toán phiếu nhập kho, xuất kho, chuyển kho, tính giá xuất kho và đối chiếu sổ chi tiết vật tư hàng hóa.",
  },
  {
    code: "ROLE_ASSET_ACCOUNTANT",
    name: "Kế toán tài sản",
    shortLabel: "KT Tài sản (TSCĐ)",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT99"],
    allowedModules: ["overview", "assets", "ledger", "reports", "directory"],
    allowedQuickCreateTitles: ["TỔNG HỢP"],
    capabilitiesSummary: "Ghi tăng, ghi giảm, đánh giá lại, điều chuyển, tính khấu hao và kiểm kê Tài sản cố định (TSCĐ).",
  },
  {
    code: "ROLE_CCDC_ACCOUNTANT",
    name: "Kế toán CCDC",
    shortLabel: "KT CCDC",
    group: "Accounting",
    groupVi: "Kế toán",
    regimes: ["TT99"],
    allowedModules: ["overview", "tools", "ledger", "reports", "directory"],
    allowedQuickCreateTitles: ["TỔNG HỢP"],
    capabilitiesSummary: "Quản lý Công cụ dụng cụ (CCDC), ghi tăng/giảm, xuất dùng và phân bổ chi phí trả trước định kỳ.",
  },
  {
    code: "ROLE_TREASURER",
    name: "Thủ quỹ",
    shortLabel: "Thủ quỹ",
    group: "Operation",
    groupVi: "Vận hành",
    regimes: ["TT133", "TT200", "TT99"],
    allowedModules: ["overview", "cash", "reports"],
    allowedQuickCreateTitles: ["TIỀN MẶT"],
    capabilitiesSummary: "Thực hiện và xác nhận thu/chi tiền mặt thực tế, ghi Sổ quỹ tiền mặt và kiểm kê tồn quỹ (Không có quyền ghi Sổ cái).",
  },
  {
    code: "ROLE_STOREKEEPER",
    name: "Thủ kho",
    shortLabel: "Thủ kho",
    group: "Operation",
    groupVi: "Vận hành",
    regimes: ["TT133", "TT200", "TT99"],
    allowedModules: ["overview", "inventory", "reports"],
    allowedQuickCreateTitles: ["KHO"],
    capabilitiesSummary: "Xác nhận nhập/xuất kho thực tế, theo dõi Thẻ kho và kiểm kê số lượng hàng tồn kho (Không hạch toán giá thành/Sổ cái).",
  },
  {
    code: "ROLE_PURCHASER",
    name: "Nhân viên mua hàng",
    shortLabel: "NV Mua hàng",
    group: "Operation",
    groupVi: "Vận hành",
    regimes: ["TT99"],
    allowedModules: ["overview", "purchases", "inventory", "directory"],
    allowedQuickCreateTitles: ["MUA HÀNG"],
    capabilitiesSummary: "Lập đề nghị mua hàng, đơn mua hàng (PO), hợp đồng mua và theo dõi tiến độ giao hàng nhà cung cấp (Không ghi sổ kế toán).",
  },
  {
    code: "ROLE_SALESPERSON",
    name: "Nhân viên bán hàng",
    shortLabel: "NV Bán hàng",
    group: "Operation",
    groupVi: "Vận hành",
    regimes: ["TT99"],
    allowedModules: ["overview", "sales", "inventory", "directory"],
    allowedQuickCreateTitles: ["BÁN HÀNG"],
    capabilitiesSummary: "Lập báo giá, đơn đặt hàng bán (SO), quản lý khách hàng và tra cứu tồn kho (Không ghi sổ cái / xóa hóa đơn thuế).",
  },
  {
    code: "ROLE_APPROVER",
    name: "Người phê duyệt",
    shortLabel: "Người phê duyệt",
    group: "Approval",
    groupVi: "Phê duyệt",
    regimes: ["TT99"],
    allowedModules: ["overview", "cash", "bank", "purchases", "sales", "ledger", "reports"],
    allowedQuickCreateTitles: [],
    capabilitiesSummary: "Thực hiện phê duyệt hoặc từ chối chứng từ/đề nghị thanh toán theo quy trình (Workflow) được cấu hình.",
    isReadOnly: true,
  },
  {
    code: "ROLE_AUDITOR",
    name: "Kiểm tra / Kiểm toán",
    shortLabel: "Kiểm tra / Kiểm toán",
    group: "Control",
    groupVi: "Kiểm soát",
    regimes: ["TT99"],
    allowedModules: [
      "overview", "cash", "bank", "purchases", "sales", "invoices",
      "inventory", "tools", "assets", "cost", "ledger", "tax", "reports",
    ],
    allowedQuickCreateTitles: [],
    capabilitiesSummary: "Tra cứu độc lập toàn bộ chứng từ, sổ kế toán, báo cáo tài chính và lịch sử thay đổi (Audit Log) — Chế độ Chỉ đọc.",
    isReadOnly: true,
  },
  {
    code: "ROLE_REPORT_VIEWER",
    name: "Người xem báo cáo",
    shortLabel: "Người xem báo cáo",
    group: "View Only",
    groupVi: "Chỉ xem",
    regimes: ["TT99"],
    allowedModules: ["overview", "reports", "budget", "analysis"],
    allowedQuickCreateTitles: [],
    capabilitiesSummary: "Chỉ được xem các bảng điều khiển (Dashboard) và báo cáo được cấp quyền, không tạo/sửa/xóa chứng từ.",
    isReadOnly: true,
  },
];

export function getRoleWorkspaceSpec(roleOrMode: string): RoleWorkspaceSpec {
  const clean = String(roleOrMode || "").trim();
  const byCode = STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === clean);
  if (byCode) return byCode;
  const byName = STANDARD_ROLES_WORKSPACE_SPEC.find(
    (r) => r.name.toLowerCase() === clean.toLowerCase() || r.shortLabel.toLowerCase() === clean.toLowerCase()
  );
  if (byName) return byName;
  if (clean === "Thủ kho" || clean === "KT_KHO") {
    return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_STOREKEEPER")!;
  }
  if (clean === "Thủ quỹ" || clean === "THU_QUY") {
    return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_TREASURER")!;
  }
  if (clean === "KT_BANHANG") {
    return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_SALES_ACCOUNTANT")!;
  }
  if (clean === "KT_MUAHANG") {
    return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_PURCHASE_ACCOUNTANT")!;
  }
  if (clean === "NVKD") {
    return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_SALESPERSON")!;
  }
  // Default: Kế toán trưởng / Toàn bộ nghiệp vụ kế toán
  return STANDARD_ROLES_WORKSPACE_SPEC.find((r) => r.code === "ROLE_CHIEF_ACCOUNTANT")!;
}

export function WorkModeModal({
  current,
  activeRegime = "TT99",
  assignedRoleCodes = [],
  onChange,
  onClose,
}: {
  current: string;
  activeRegime?: "TT58" | "TT133" | "TT200" | "TT99" | string;
  assignedRoleCodes?: string[];
  onChange: (mode: string) => void;
  onClose: () => void;
}) {
  const normRegime = (
    String(activeRegime).includes("58")
      ? "TT58"
      : String(activeRegime).includes("133")
      ? "TT133"
      : String(activeRegime).includes("200")
      ? "TT200"
      : "TT99"
  ) as "TT58" | "TT133" | "TT200" | "TT99";

  const [showAll21, setShowAll21] = useState(false);
  const currentSpec = getRoleWorkspaceSpec(current);

  const visibleRoles = showAll21
    ? STANDARD_ROLES_WORKSPACE_SPEC
    : STANDARD_ROLES_WORKSPACE_SPEC.filter(
        (r) => r.regimes.includes(normRegime) || assignedRoleCodes.includes(r.code)
      );

  const regimePresetTitle =
    normRegime === "TT58"
      ? "Thông tư 58/2026/TT-BTC (DN siêu nhỏ — 3 Role tinh gọn)"
      : normRegime === "TT133"
      ? "Thông tư 133/2016/TT-BTC (DN nhỏ & vừa SME — 8 Role cốt lõi)"
      : normRegime === "TT200"
      ? "Thông tư 200/2014/TT-BTC (DN vừa & lớn — 14 Role chuyên môn)"
      : "Thông tư 99/2025/TT-BTC (DN lớn / Chuẩn mới — Đầy đủ 21 Role)";

  return (
    <Modal title="Chế độ làm việc & Phân quyền theo Vai trò (RBAC)" onClose={onClose} wide>
      <div style={{ padding: "4px 4px 12px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12.5, color: "#166534" }}>
            <strong>Bộ vai trò theo Chế độ kế toán:</strong> {regimePresetTitle}
          </div>
          {normRegime !== "TT99" && (
            <button
              type="button"
              onClick={() => setShowAll21((v) => !v)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid #16a34a",
                background: showAll21 ? "#16a34a" : "#ffffff",
                color: showAll21 ? "#ffffff" : "#166534",
                cursor: "pointer",
              }}
            >
              {showAll21 ? `Chỉ hiện ${visibleRoles.length} Role của ${normRegime}` : "Xem đủ 21 Role chuẩn"}
            </button>
          )}
        </div>

        <div
          className="erp3-mode-list"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 8,
            maxHeight: "62vh",
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {visibleRoles.map((role) => {
            const isActive = currentSpec.code === role.code;
            const isAssigned = assignedRoleCodes.includes(role.code);
            return (
              <button
                className={isActive ? "active" : ""}
                key={role.code}
                onClick={() => {
                  onChange(role.code);
                  onClose();
                }}
                style={{
                  textAlign: "left",
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: isActive ? "2px solid var(--brand)" : "1px solid #e2e8f0",
                  background: isActive ? "#f0fdf4" : "#ffffff",
                  display: "flex",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{role.name}</strong>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 999,
                        background: "#f1f5f9",
                        color: "#475569",
                      }}
                    >
                      {role.groupVi}
                    </span>
                    {isAssigned && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "#dbeafe",
                          color: "#1d4ed8",
                        }}
                      >
                        Role của bạn
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 600, marginTop: 2 }}>
                    Mở {role.allowedModules.length} phân hệ nghiệp vụ
                  </div>
                  <small style={{ display: "block", fontSize: 11.5, color: "#334155", marginTop: 4, lineHeight: 1.35 }}>
                    {role.capabilitiesSummary}
                  </small>
                </div>
                {isActive && <b style={{ color: "var(--brand)", fontSize: 16 }}>✓</b>}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export function TabSettingsModal({
  moduleName,
  tabs,
  visibleTabIds = [],
  onSave,
  onClose,
  onResetDefault,
}: {
  moduleName: string;
  tabs: [string, string][];
  visibleTabIds?: string[];
  onSave?: (newVisibleTabIds: string[]) => void;
  onClose: () => void;
  onResetDefault?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(visibleTabIds.length > 0 ? visibleTabIds : tabs.map(([id]) => id)));
  const [orderedTabs, setOrderedTabs] = useState<[string, string][]>(() => {
    if (!visibleTabIds || visibleTabIds.length === 0) return [...tabs];
    const visibleSet = new Set(visibleTabIds);
    const visibleList: [string, string][] = [];
    visibleTabIds.forEach((id) => {
      const found = tabs.find(([tId]) => tId === id);
      if (found) visibleList.push(found);
    });
    const hiddenList = tabs.filter(([id]) => !visibleSet.has(id));
    return [...visibleList, ...hiddenList];
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return; // Keep at least 1 tab visible
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedTabs.length) return;
    const next = [...orderedTabs];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setOrderedTabs(next);
  };

  const selectAll = () => {
    setSelected(new Set(tabs.map(([id]) => id)));
  };

  const handleSave = () => {
    if (onSave) {
      const result = orderedTabs
        .map(([id]) => id)
        .filter((id) => selected.has(id));
      onSave(result);
    }
    onClose();
  };

  return (
    <Modal title={`Thiết lập tab — ${moduleName}`} onClose={onClose}>
      <div className="erp3-tab-settings">
        <p>
          Chọn các tab cần hiển thị trực tiếp trên thanh tác vụ (1 dòng duy nhất) và sắp xếp theo nhu cầu công việc của bạn. Các tab không được chọn sẽ nằm trong mục <strong>"Khác ▾"</strong> hoặc nút <strong>Tùy chọn</strong>.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="erp3-drag-hint" style={{ margin: 0, padding: "6px 12px" }}>
            Dùng nút mũi tên ↑ ↓ để sắp xếp thứ tự
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={selectAll}
              style={{
                background: "transparent",
                border: "1px solid #cbd5e1",
                borderRadius: 4,
                padding: "4px 8px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--brand)",
              }}
            >
              Chọn tất cả
            </button>
            {onResetDefault && (
              <button
                type="button"
                onClick={() => {
                  onResetDefault();
                  onClose();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 12,
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                Đặt lại mặc định
              </button>
            )}
          </div>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 8px" }}>
          {orderedTabs.map(([id, label], index) => {
            const isChecked = selected.has(id);
            return (
              <div className="erp3-tab-setting" key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px" }}>
                <span aria-hidden="true" style={{ color: "#94a3b8", cursor: "grab" }}>⋮⋮</span>
                <label style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: isChecked ? "#0f172a" : "#64748b", fontWeight: isChecked ? 600 : 400 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(id)}
                    aria-label={`Hiển thị ${label}`}
                  />{" "}
                  {label}
                  {isChecked && <span style={{ fontSize: 10, color: "var(--brand)", background: "#f0f9ff", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>Hiển thị trên thanh</span>}
                </label>
                <button
                  type="button"
                  aria-label={`Chuyển ${label} lên`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  style={{ opacity: index === 0 ? 0.3 : 1 }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Chuyển ${label} xuống`}
                  disabled={index === orderedTabs.length - 1}
                  onClick={() => move(index, 1)}
                  style={{ opacity: index === orderedTabs.length - 1 ? 0.3 : 1 }}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Đóng</button>
          <button type="button" className="erp3-primary" onClick={handleSave}>
            Lưu thiết lập
          </button>
        </footer>
      </div>
    </Modal>
  );
}
