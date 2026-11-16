import { useLocation, useNavigate } from "react-router-dom";
import MisaSaveSplitButton from "./components/MisaSaveSplitButton";
import DirectoryChoiceField from "./DirectoryChoiceField";
import VoucherDateField from "./VoucherDateField";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApiSession } from "./ApiSession";
import { useMisaApiLists } from "./misa-api-lists";
import { request } from "./live-api";
import { createApiWriter, directoryInput, toViDate } from "./misa-api-writes";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { MISA_DIRECTORY_DEFINITIONS } from "./misa-directory-definitions";
import type { DirectoryDefinition } from "./misa-directory-definitions";
import "./misa-directory.css";
import DirectoryTabContent from "./DirectoryTabContent";
import AccountCatalogWorkspace from "./AccountCatalogWorkspace";
import {
  requiredDirectoryField,
  validateDirectoryEntry,
  normalizeDirectoryValues,
} from "./directory-entry";

type DirectoryRow = { id: string; values: Record<string, string> };

const directoryApiPaths: Record<string, string> = {
  "Khách hàng": "/api/v1/master-data/customers/",
  "Nhà cung cấp": "/api/v1/master-data/parties/",
  "Nhân viên": "/api/v1/organization/employees/",
  "Vật tư hàng hóa": "/api/v1/master-data/items/",
  "Kho": "/api/v1/master-data/warehouses/",
  "Nhóm vật tư, hàng hóa, dịch vụ": "/api/v1/master-data/item-categories/",
  "Đơn vị tính": "/api/v1/master-data/units-of-measure/",
  "Ngân hàng": "/api/v1/master-data/banks/",
  "Tài khoản ngân hàng": "/api/v1/master-data/company-bank-accounts/",
  "Khoản mục chi phí": "/api/v1/master-data/expense-items/",
  "Mục thu/chi": "/api/v1/master-data/expense-items/",
  "Đối tượng tập hợp chi phí": "/api/v1/master-data/cost-centers/",
  "Công trình": "/api/v1/master-data/projects/",
  "Tài khoản kết chuyển": "/api/v1/general-ledger/closing-rules/",
  "Tài khoản ngầm định": "/api/v1/general-ledger/subledger-rules/",
  "Loại tài sản cố định": "/api/v1/fixed-assets/categories/",
  "Loại công cụ dụng cụ": "/api/v1/fixed-assets/categories/",
  "Mã thống kê": "/api/v1/master-data/statistical-codes/",
  "Loại tiền": "/api/v1/master-data/currencies/",
  "Loại chứng từ": "/api/v1/master-data/document-types/",
  "Điều khoản thanh toán": "/api/v1/master-data/payment-terms/",
  "Biểu thuế tiêu thụ đặc biệt": "/api/v1/master-data/tax-rates/",
  "Biểu thuế tài nguyên": "/api/v1/master-data/tax-rates/",
  "Loại tỷ giá": "/api/v1/master-data/exchange-rate-types/",
  "Bảng tỷ giá": "/api/v1/master-data/exchange-rates/",
  "Hồ sơ tín dụng KH": "/api/v1/master-data/customer-profiles/",
  "Vị trí lưu kho": "/api/v1/master-data/inventory-locations/",
  "Quy tắc đánh số": "/api/v1/master-data/document-numbering-rules/",
  "Cơ cấu tổ chức": "/api/v1/organization/branches/",
};

const writableDirectories = new Set([
  "Kho",
  "Khoản mục chi phí",
  "Mục thu/chi",
  "Đối tượng tập hợp chi phí",
  "Công trình",
  "Tài khoản kết chuyển",
  "Loại tài sản cố định",
  "Loại công cụ dụng cụ",
  "Mã thống kê",
  "Ngân hàng",
  "Nhóm vật tư, hàng hóa, dịch vụ",
  "Điều khoản thanh toán",
  "Loại tiền",
  "Loại chứng từ",
  "Nhà cung cấp",
  "Khách hàng",
  "Đơn vị tính",
  "Vật tư hàng hóa",
  "Tài khoản ngân hàng",
  "Nhân viên",
  "Cơ cấu tổ chức",
]);

const STANDARD_PIT_BRACKETS: DirectoryRow[] = [
  { id: "pit-1", values: { "Bậc": "1", "Biểu tính thuế theo tháng": "Đến 5 triệu đồng", "Biểu tính thuế theo năm": "Đến 60 triệu đồng", "Thuế suất (%)": "5" } },
  { id: "pit-2", values: { "Bậc": "2", "Biểu tính thuế theo tháng": "Trên 5 đến 10 triệu đồng", "Biểu tính thuế theo năm": "Trên 60 đến 120 triệu đồng", "Thuế suất (%)": "10" } },
  { id: "pit-3", values: { "Bậc": "3", "Biểu tính thuế theo tháng": "Trên 10 đến 18 triệu đồng", "Biểu tính thuế theo năm": "Trên 120 đến 216 triệu đồng", "Thuế suất (%)": "15" } },
  { id: "pit-4", values: { "Bậc": "4", "Biểu tính thuế theo tháng": "Trên 18 đến 32 triệu đồng", "Biểu tính thuế theo năm": "Trên 216 đến 384 triệu đồng", "Thuế suất (%)": "20" } },
  { id: "pit-5", values: { "Bậc": "5", "Biểu tính thuế theo tháng": "Trên 32 đến 52 triệu đồng", "Biểu tính thuế theo năm": "Trên 384 đến 624 triệu đồng", "Thuế suất (%)": "25" } },
  { id: "pit-6", values: { "Bậc": "6", "Biểu tính thuế theo tháng": "Trên 52 đến 80 triệu đồng", "Biểu tính thuế theo năm": "Trên 624 đến 960 triệu đồng", "Thuế suất (%)": "30" } },
  { id: "pit-7", values: { "Bậc": "7", "Biểu tính thuế theo tháng": "Trên 80 triệu đồng", "Biểu tính thuế theo năm": "Trên 960 triệu đồng", "Thuế suất (%)": "35" } },
];

const STANDARD_ATTENDANCE_SYMBOLS: DirectoryRow[] = [
  { id: "att-1", values: { "Ký hiệu chấm công": "+", "Diễn giải": "Đi làm đủ ngày công chuẩn", "Tỷ lệ hưởng lương (%)": "100", "Là ký hiệu mặc định": "Có", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-2", values: { "Ký hiệu chấm công": "N/2", "Diễn giải": "Đi làm nửa ngày công", "Tỷ lệ hưởng lương (%)": "50", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "Có", "Trạng thái": "Đang sử dụng" } },
  { id: "att-3", values: { "Ký hiệu chấm công": "P", "Diễn giải": "Nghỉ phép năm hưởng nguyên lương", "Tỷ lệ hưởng lương (%)": "100", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-4", values: { "Ký hiệu chấm công": "L", "Diễn giải": "Nghỉ Lễ, Tết hưởng nguyên lương", "Tỷ lệ hưởng lương (%)": "100", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-5", values: { "Ký hiệu chấm công": "CT", "Diễn giải": "Đi công tác theo điều động", "Tỷ lệ hưởng lương (%)": "100", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-6", values: { "Ký hiệu chấm công": "O", "Diễn giải": "Nghỉ ốm hưởng chế độ BHXH", "Tỷ lệ hưởng lương (%)": "0", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-7", values: { "Ký hiệu chấm công": "TS", "Diễn giải": "Nghỉ thai sản hưởng chế độ BHXH", "Tỷ lệ hưởng lương (%)": "0", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
  { id: "att-8", values: { "Ký hiệu chấm công": "KL", "Diễn giải": "Nghỉ việc riêng không hưởng lương", "Tỷ lệ hưởng lương (%)": "0", "Là ký hiệu mặc định": "", "Là ký hiệu nửa ngày": "", "Trạng thái": "Đang sử dụng" } },
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  GOODS: "Hàng hóa",
  SERVICE: "Dịch vụ",
  MATERIAL: "Nguyên vật liệu",
  FINISHED_GOOD: "Thành phẩm",
};

const fmtViNum = (val: number) =>
  Number.isFinite(val) ? val.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : "0";

const directoryValue = (
  row: Record<string, any>,
  header: string,
  ctx?: {
    itemStock?: Map<string, { qty: number; val: number }>;
    taxRateMap?: Map<string, Record<string, any>>;
  },
): string => {
  // Exact column matches first (prevents broad /^Tên/ collisions)
  if (header === "Tên chi nhánh ngân hàng") return String(row.bank_branch || row.branch_name || "");
  if (header === "Tên ngân hàng") return String(row.bank_name || row.payment_account?.bank_name || row.name || "");
  if (header === "Chủ tài khoản") return String(row.account_name || row.account_holder || "");
  if (header === "Tên đầy đủ") return String(row.name || "");
  if (header === "Tên viết tắt") return String(row.code || row.short_name || "");
  if (header === "Tính chất") return ITEM_TYPE_LABELS[String(row.item_type || "")] || String(row.item_type || "Hàng hóa");
  if (header === "Giảm thuế theo quy định") {
    const rateObj = ctx?.taxRateMap?.get(String(row.sales_tax_rate || row.default_tax_rate || ""));
    if (rateObj && Number(rateObj.rate_percent) === 8) return "Giảm thuế GTGT (8%)";
    return "Theo quy định chung";
  }
  if (header === "Số lượng tồn") {
    if (row.item_type === "SERVICE" || row.track_inventory === false) return "—";
    const st = ctx?.itemStock?.get(String(row.id));
    return fmtViNum(st?.qty ?? 0);
  }
  if (header === "Giá trị tồn") {
    if (row.item_type === "SERVICE" || row.track_inventory === false) return "—";
    const st = ctx?.itemStock?.get(String(row.id));
    return fmtViNum(st?.val ?? 0);
  }
  if (header === "Số ngày được nợ") return String(row.due_days ?? 0);
  if (header === "Thời hạn hưởng CK (Ngày)") return row.discount_days != null ? String(row.discount_days) : "";
  if (header === "Tỉ lệ CK (%)") return row.discount_rate != null ? String(Number(row.discount_rate)) : "";
  if (header === "Thứ tự kết chuyển") return String(row.sequence ?? row.step_order ?? "");
  if (header === "Mã kết chuyển") return String(row.code || "");
  if (header === "Kết chuyển từ") return String(row.source_account_code || "");
  if (header === "Kết chuyển đến") return String(row.destination_account_code || "");
  if (header === "Bên kết chuyển") return String(row.direction_label || row.direction || "");
  if (header === "Loại kết chuyến" || header === "Loại kết chuyển") return String(row.result_type_label || row.result_type || "");
  if (header === "TK Nợ") return String(row.debit_account_code || "");
  if (header === "TK Có") return String(row.credit_account_code || "");
  if (header === "TK nguyên giá") return String(row.asset_account_code || "");
  if (header === "TK khấu hao") return String(row.accumulated_account_code || "");
  if (header === "Ngày bắt đầu" || header === "Ngày hiệu lực từ") return toViDate(row.start_date || row.effective_from || "");
  if (header === "Ngày kết thúc" || header === "Ngày hiệu lực đến") return toViDate(row.end_date || row.effective_to || "");
  if (header === "Thuế suất (%)" || header === "Thuế suất(%)") return row.rate_percent != null ? String(Number(row.rate_percent)) : "";
  if (header === "Tỷ giá quy đổi") return row.code === "VND" ? "1" : String(row.exchange_rate || "");
  if (header === "Loại" && (row.source_module_label || row.expense_type)) {
    return String(row.name || row.source_module_label || row.expense_type || "");
  }

  // Generic fallbacks
  if (/^Mã số thuế/.test(header)) return String(row.tax_code || "");
  if (/^Mã/.test(header)) return String(row.code || row.number || "");
  if (/^Số tài khoản/.test(header)) return String(row.account_number || "");
  if (/^Tên/.test(header)) return String(row.name || row.full_name || row.bank_name || "");
  if (/^Địa chỉ/.test(header)) return String(row.address || row.addresses?.[0]?.address_line || "");
  if (/^Điện thoại|^ĐT di động/.test(header)) return String(row.phone || row.contacts?.[0]?.phone || "");
  if (/^Mô tả|^Diễn giải/.test(header)) return String(row.description || row.notes || "");
  if (/^Đơn vị tính/.test(header)) return String(row.symbol || row.name || row.code || "");
  if (/^Cấp tổ chức/.test(header)) return row.is_head_office ? "Trụ sở chính" : "Chi nhánh";
  if (/^Đơn vị cha/.test(header)) return row.parent_name || (row.is_head_office ? "Trụ sở chính (Gốc)" : "Đơn vị trực thuộc");
  if (/^Trạng thái/.test(header)) {
    if (typeof row.is_active === "boolean") return row.is_active ? "Đang sử dụng" : "Ngừng sử dụng";
    return row.status === "ACTIVE" || !row.status ? "Đang sử dụng" : "Ngừng sử dụng";
  }
  return "";
};

const SECTION_GROUP_MAP: Record<string, string[]> = {
  partners: ["Đối tượng"],
  items: ["Vật tư hàng hóa"],
  organization: ["Chi nhánh, phòng ban", "Tiền lương"],
  accounting: ["Tài khoản", "Chi phí", "Ngân hàng", "Tài sản", "Thuế", "Khác"],
};

const MANAGE_TARGET_BY_FIELD: Record<string, string> = {
  "Đơn vị": "Cơ cấu tổ chức",
  "Chi nhánh quản lý": "Cơ cấu tổ chức",
  "Đơn vị tính chính": "Đơn vị tính",
  "Nhóm VTHH": "Nhóm vật tư, hàng hóa, dịch vụ",
  "Kho ngầm định": "Kho",
  "Tên ngân hàng": "Ngân hàng",
  "Điều khoản thanh toán": "Điều khoản thanh toán",
  "Tài khoản kho": "Hệ thống tài khoản",
  "TK doanh thu": "Hệ thống tài khoản",
  "TK chiết khấu": "Hệ thống tài khoản",
  "TK giảm giá": "Hệ thống tài khoản",
  "TK trả lại": "Hệ thống tài khoản",
  "TK Chi phí": "Hệ thống tài khoản",
  "Tài khoản công nợ phải thu": "Hệ thống tài khoản",
  "Tài khoản công nợ phải trả": "Hệ thống tài khoản",
};

export default function MisaDirectoryWorkspace({
  legacy,
  initialName,
  initialCreate = false,
  sectionTab,
  onEntrySaved,
  onEditorClose,
  notify,
}: {
  legacy: ReactNode;
  initialName?: string | null;
  initialCreate?: boolean;
  sectionTab?: string | null;
  onEntrySaved?: (values: Record<string, string>) => void;
  onEditorClose?: () => void;
  notify: (text: string) => void;
}) {
  const directoryNavigate = useNavigate();
  const location = useLocation();
  const { companyId, token } = useApiSession();
  const [definition, setDefinition] = useState<DirectoryDefinition | null>(
    MISA_DIRECTORY_DEFINITIONS.find((item) => item.name === initialName) || null,
  );

  const hasExplicitTabParam = useMemo(
    () => new URLSearchParams(location.search).has("tab"),
    [location.search],
  );
  const [groupFilter, setGroupFilter] = useState<string>("all");
  useEffect(() => {
    if (hasExplicitTabParam && sectionTab && SECTION_GROUP_MAP[sectionTab]) {
      setGroupFilter(sectionTab);
    } else if (!hasExplicitTabParam) {
      setGroupFilter("all");
    }
  }, [hasExplicitTabParam, sectionTab]);

  const apiPath = definition ? directoryApiPaths[definition.name] : undefined;
  const employeeDirectory = definition?.name === "Nhân viên";
  const itemDirectory = definition?.name === "Vật tư hàng hóa";
  const vendorDirectory = definition?.name === "Nhà cung cấp";
  const warehouseDirectory = definition?.name === "Kho";
  const bankAccDirectory = definition?.name === "Tài khoản ngân hàng";
  const customerOrVendor = definition?.name === "Khách hàng" || vendorDirectory;

  const auxEndpoints = useMemo(() => {
    if (!definition || !apiPath) return {};
    const map: Record<string, string> = { entries: apiPath };
    if (employeeDirectory) {
      map.branches = "/api/v1/organization/branches/";
      map.departments = "/api/v1/organization/departments/";
    }
    if (warehouseDirectory) {
      map.branches = "/api/v1/organization/branches/";
      map.accounts = "/api/v1/general-ledger/accounts/";
    }
    if (itemDirectory) {
      map.balances = "/api/v1/inventory/balances/";
      map.units = "/api/v1/master-data/units-of-measure/";
      map.categories = "/api/v1/master-data/item-categories/";
      map.warehouses = "/api/v1/master-data/warehouses/";
      map.accounts = "/api/v1/general-ledger/accounts/";
      map.taxRates = "/api/v1/master-data/tax-rates/";
    }
    if (bankAccDirectory) {
      map.banks = "/api/v1/master-data/banks/";
    }
    if (vendorDirectory) {
      map.partyRoles = "/api/v1/master-data/party-roles/";
      map.paymentTerms = "/api/v1/master-data/payment-terms/";
      map.accounts = "/api/v1/general-ledger/accounts/";
    }
    if (definition.name === "Khách hàng") {
      map.paymentTerms = "/api/v1/master-data/payment-terms/";
      map.accounts = "/api/v1/general-ledger/accounts/";
    }
    if (
      definition.name === "Loại tài sản cố định" ||
      definition.name === "Loại công cụ dụng cụ" ||
      definition.name === "Tài khoản kết chuyển"
    ) {
      map.accounts = "/api/v1/general-ledger/accounts/";
    }
    return map;
  }, [definition, apiPath, employeeDirectory, warehouseDirectory, itemDirectory, bankAccDirectory, vendorDirectory]);

  const { rows: apiRows, connected: apiConnected, reload: reloadApi } = useMisaApiLists(
    companyId,
    auxEndpoints,
    notify,
  );

  const [legacyView, setLegacyView] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Record<string, DirectoryRow[]>>({});
  useEffect(() => setRecords({}), [companyId]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [taxLookingUp, setTaxLookingUp] = useState(false);
  const [editor, setEditor] = useState<DirectoryRow | null>((): DirectoryRow | null =>
    initialCreate && definition
      ? { id: crypto.randomUUID(), values: definition.radios.length ? { Loại: definition.radios[0] } : {} }
      : null,
  );
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState(initialCreate ? definition?.tabs[0] || "" : "");
  const editorRef = useRef<HTMLDivElement>(null);

  const closeEditor = () => {
    setEditor(null);
    onEditorClose?.();
  };
  const updateEditor = (key: string, value: string) =>
    setEditor((previous) =>
      previous ? { ...previous, values: { ...previous.values, [key]: value } } : previous,
    );

  useEffect(() => {
    if (!editor) return;
    const previous = document.activeElement as HTMLElement | null;
    editorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEditor();
      if (event.key === "Tab") {
        const items = [
          ...editorRef.current!.querySelectorAll<HTMLElement>("button,input,select,textarea"),
        ].filter((element) => !element.hasAttribute("disabled"));
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [!!editor]);

  const open = (next: DirectoryDefinition) => {
    setDefinition(next);
    setQuery("");
    setSelected([]);
    setHidden([]);
    setColumnsOpen(false);
    setPage(1);
  };

  const itemStockMap = useMemo(() => {
    const map = new Map<string, { qty: number; val: number }>();
    for (const b of apiRows.balances || []) {
      const id = String(b.item || "");
      if (!id) continue;
      const cur = map.get(id) || { qty: 0, val: 0 };
      cur.qty += Number(b.quantity || 0);
      cur.val += Number(b.inventory_value || 0);
      map.set(id, cur);
    }
    return map;
  }, [apiRows.balances]);

  const taxRateMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const r of apiRows.taxRates || []) map.set(String(r.id), r);
    return map;
  }, [apiRows.taxRates]);

  const uomMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const u of apiRows.units || []) map.set(String(u.id), u);
    return map;
  }, [apiRows.units]);

  const catMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const c of apiRows.categories || []) map.set(String(c.id), c);
    return map;
  }, [apiRows.categories]);

  const accMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const a of apiRows.accounts || []) map.set(String(a.id), a);
    return map;
  }, [apiRows.accounts]);

  const branchMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const b of apiRows.branches || []) map.set(String(b.id), b);
    return map;
  }, [apiRows.branches]);

  const filteredRawEntries = useMemo(() => {
    const list = apiRows.entries || [];
    if (!definition) return list;
    if (definition.name === "Loại tài sản cố định") {
      return list.filter((r) => !r.asset_type || r.asset_type === "FIXED_ASSET");
    }
    if (definition.name === "Loại công cụ dụng cụ") {
      return list.filter((r) => r.asset_type === "TOOL");
    }
    if (definition.name === "Biểu thuế tiêu thụ đặc biệt") {
      return list.filter((r) => /TTDB|EXCISE|SCT/i.test(`${r.tax_type || ""} ${r.code || ""} ${r.name || ""}`));
    }
    if (definition.name === "Biểu thuế tài nguyên") {
      return list.filter((r) => /TN|RESOURCE|NRT/i.test(`${r.tax_type || ""} ${r.code || ""} ${r.name || ""}`));
    }
    if (vendorDirectory && Array.isArray(apiRows.partyRoles) && apiRows.partyRoles.length > 0) {
      const vendorIds = new Set<string>();
      const customerOnlyIds = new Set<string>();
      for (const pr of apiRows.partyRoles) {
        const pid = String(pr.party || "");
        if (pr.role_type === "VENDOR") vendorIds.add(pid);
        if (pr.role_type === "CUSTOMER") customerOnlyIds.add(pid);
      }
      return list.filter((r) => vendorIds.has(String(r.id)) || !customerOnlyIds.has(String(r.id)));
    }
    return list;
  }, [apiRows.entries, apiRows.partyRoles, definition, vendorDirectory]);

  const buildRowValues = (row: Record<string, any>, def: DirectoryDefinition): Record<string, string> => {
    if (def.name === "Nhân viên") {
      const unitName = String(
        (apiRows.departments || []).find((item) => item.id === row.department)?.name ||
          (apiRows.branches || []).find((item) => item.id === row.branch)?.name ||
          "",
      );
      return {
        Mã: String(row.employee_code || ""),
        Tên: String(row.full_name || ""),
        "Đơn vị": unitName,
        "Chức danh": String(row.job_title || ""),
        "Ngày sinh": String(row.date_of_birth || ""),
        "Số CCCD": String(row.identity_number || ""),
        Loại: row.gender === "FEMALE" ? "Nữ" : "Nam",
        "Thông tin tiền lương:Lương thỏa thuận": String(row.agreed_salary ?? ""),
        "Thông tin tiền lương:Hệ số lương": String(row.salary_coefficient ?? ""),
        "Thông tin tiền lương:Lương đóng bảo hiểm": String(row.insurance_salary ?? ""),
        "Thông tin tiền lương:Mã số thuế": String(row.personal_tax_code || ""),
        "Thông tin tiền lương:Loại hợp đồng":
          ({
            RESIDENT_LONG: "Cư trú và có HĐLĐ từ 3 tháng trở lên",
            RESIDENT_SHORT: "Cư trú và không ký HĐLĐ/HĐLĐ dưới 3 tháng",
            NON_RESIDENT: "Không cư trú",
          } as Record<string, string>)[row.contract_type] || "",
        "Thông tin tiền lương:Số người phụ thuộc": String(row.dependent_count ?? ""),
        "Thông tin liên hệ:Địa chỉ": String(row.address || ""),
        "Thông tin liên hệ:Email": String(row.email || ""),
        "Thông tin liên hệ:Điện thoại di động": String(row.phone || ""),
        "Tài khoản ngân hàng:grid:0": JSON.stringify(
          row.payment_account
            ? [
                {
                  "Số tài khoản": row.payment_account.account_number,
                  "Tên ngân hàng": row.payment_account.bank_name,
                  "Chủ tài khoản": row.payment_account.account_holder,
                  "Chi nhánh": row.payment_account.bank_branch,
                },
              ]
            : [],
        ),
        "Mã nhân viên": String(row.employee_code || ""),
        "Tên nhân viên": String(row.full_name || ""),
        "Trạng thái người dùng": row.linked_user ? "Đã liên kết" : "Chưa liên kết",
        "Tên đơn vị": unitName,
        "Số tài khoản": String(row.payment_account?.account_number || ""),
        "Tên ngân hàng": String(row.payment_account?.bank_name || ""),
        "Trạng thái": row.status === "ACTIVE" || !row.status ? "Đang sử dụng" : "Ngừng sử dụng",
      };
    }

    const base = Object.fromEntries(
      def.headers.map((header) => [header, directoryValue(row, header, { itemStock: itemStockMap, taxRateMap })]),
    );

    if (def.name === "Vật tư hàng hóa") {
      const uom = uomMap.get(String(row.base_uom || ""));
      const cat = catMap.get(String(row.category || ""));
      const invAcc = accMap.get(String(row.inventory_account || ""));
      const revAcc = accMap.get(String(row.revenue_account || ""));
      const cogsAcc = accMap.get(String(row.cogs_account || row.expense_account || ""));
      const tr = taxRateMap.get(String(row.sales_tax_rate || row.default_tax_rate || ""));
      Object.assign(base, {
        Mã: String(row.code || ""),
        Tên: String(row.name || ""),
        "Tính chất": ITEM_TYPE_LABELS[String(row.item_type || "")] || "Hàng hóa",
        "Đơn vị tính chính": uom ? String(uom.name || uom.code || "") : "",
        "Nhóm VTHH": cat ? `${cat.code} — ${cat.name}` : "",
        "Số lượng tồn tối thiểu": row.min_stock != null ? String(Number(row.min_stock)) : "",
        "Đơn giá mua cố định": row.purchase_price != null ? String(Number(row.purchase_price)) : "",
        "Đơn giá bán": row.sales_price != null ? String(Number(row.sales_price)) : "",
        "Tài khoản kho": invAcc ? String(invAcc.code) : "",
        "TK doanh thu": revAcc ? String(revAcc.code) : "",
        "TK Chi phí": cogsAcc ? String(cogsAcc.code) : "",
        "Thuế suất GTGT (%)": tr?.rate_percent != null ? `${Number(tr.rate_percent)}%` : "",
        "Diễn giải khi bán": String(row.description || ""),
      });
    } else if (def.name === "Kho") {
      const br = branchMap.get(String(row.branch || ""));
      Object.assign(base, {
        Mã: String(row.code || ""),
        Tên: String(row.name || ""),
        "Chi nhánh quản lý": br ? String(br.name || br.code || "") : "",
        "Địa chỉ": String(row.address || ""),
      });
    } else if (def.name === "Tài khoản ngân hàng") {
      Object.assign(base, {
        "Số tài khoản": String(row.account_number || ""),
        "Tên ngân hàng": String(row.bank_name || ""),
        "Tên chi nhánh ngân hàng": String(row.bank_branch || ""),
        "Chủ tài khoản": String(row.account_name || ""),
        "Diễn giải": String(row.notes || ""),
        "Trạng thái": row.status === "ACTIVE" || !row.status ? "Đang sử dụng" : "Ngừng sử dụng",
      });
    } else if (def.name === "Khách hàng" || def.name === "Nhà cung cấp") {
      const contact = row.contacts?.[0];
      const addressLine = row.address || row.addresses?.[0]?.address_line || "";
      Object.assign(base, {
        Loại: row.party_type === "INDIVIDUAL" ? "Cá nhân" : "Tổ chức",
        "Mã số thuế/CCCD chủ hộ": String(row.tax_code || row.identity_no || ""),
        ...(def.name === "Khách hàng"
          ? { "Mã khách hàng": String(row.code || ""), "Tên khách hàng": String(row.name || "") }
          : { "Mã nhà cung cấp": String(row.code || ""), "Tên nhà cung cấp": String(row.name || "") }),
        "Địa chỉ": String(addressLine),
        "Điện thoại": String(row.phone || contact?.phone || ""),
        "Thông tin liên hệ:Đại diện theo PL": String(row.representative || ""),
        "Thông tin liên hệ:Họ và tên": String(contact?.contact_name || ""),
        "Thông tin liên hệ:Email": String(contact?.email || row.profile?.invoice_email || ""),
        "Thông tin liên hệ:Số điện thoại": String(contact?.phone || ""),
        "Điều khoản thanh toán:Số ngày được nợ": row.profile?.credit_days != null ? String(row.profile.credit_days) : "",
        "Điều khoản thanh toán:Số nợ tối đa": row.profile?.credit_limit != null ? String(Number(row.profile.credit_limit)) : "",
        "Ghi chú:Ghi chú": String(row.notes || ""),
      });
    } else if (def.name === "Điều khoản thanh toán") {
      Object.assign(base, {
        Mã: String(row.code || ""),
        Tên: String(row.name || ""),
        "Số ngày được nợ": String(row.due_days ?? 0),
        "Thời hạn hưởng chiết khấu": row.discount_days != null ? String(row.discount_days) : "",
        "Tỷ lệ chiết khấu": row.discount_rate != null ? String(Number(row.discount_rate)) : "",
      });
    } else if (def.name === "Cơ cấu tổ chức") {
      Object.assign(base, {
        "Mã đơn vị": String(row.code || ""),
        "Tên đơn vị": String(row.name || ""),
        "Mã số thuế": String(row.tax_code || ""),
        "Địa chỉ": String(row.address || ""),
        "Cấp tổ chức": row.is_head_office ? "Trụ sở chính" : "Chi nhánh",
      });
    }
    return base;
  };

  const staticCatalogRows = (def: DirectoryDefinition): DirectoryRow[] => {
    if (def.name === "Biểu tính thuế thu nhập") return STANDARD_PIT_BRACKETS;
    if (def.name === "Ký hiệu chấm công") return STANDARD_ATTENDANCE_SYMBOLS;
    return [];
  };

  const allRows = definition
    ? (
        records[definition.name] ||
        (apiPath && apiConnected
          ? filteredRawEntries.map((row) => ({
              id: String(row.id),
              values: buildRowValues(row, definition),
            }))
          : staticCatalogRows(definition))
      ).map((row) => ({
        ...row,
        values: normalizeDirectoryValues(definition.fields, definition.headers, row.values),
      }))
    : [];

  const rows = allRows.filter((row) =>
    Object.values(row.values).join(" ").toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const headers = definition?.headers.filter((header) => !hidden.includes(header)) || [];
  const editFields = definition?.fields.length
    ? definition.fields
    : definition?.headers
        .filter(
          (header) =>
            header !== "Chức năng" &&
            !/Công nợ|Số tiền nợ|Giá trị tồn|Số lượng tồn/.test(header),
        )
        .map((label) => ({ label, kind: "text" })) || [];

  const comboOptionsForField = (label: string): string[] => {
    if (employeeDirectory && label === "Đơn vị") {
      return [...(apiRows.branches || []), ...(apiRows.departments || [])]
        .filter((r) => r.status === "ACTIVE")
        .map((r) => String(r.name));
    }
    if (label === "Chi nhánh quản lý") {
      return (apiRows.branches || [])
        .filter((r) => r.status === "ACTIVE")
        .map((r) => String(r.name));
    }
    if (label === "Đơn vị tính chính") {
      return (apiRows.units || [])
        .filter((r) => r.status === "ACTIVE")
        .map((r) => String(r.name || r.code));
    }
    if (label === "Nhóm VTHH") {
      return (apiRows.categories || [])
        .filter((r) => r.status === "ACTIVE")
        .map((r) => `${r.code} — ${r.name}`);
    }
    if (label === "Kho ngầm định") {
      return (apiRows.warehouses || [])
        .filter((r) => r.status === "ACTIVE")
        .map((r) => `${r.code} — ${r.name}`);
    }
    if (label === "Tên ngân hàng") {
      return (apiRows.banks || [])
        .filter((r) => !r.status || r.status === "ACTIVE")
        .map((r) => String(r.name));
    }
    if (label === "Điều khoản thanh toán") {
      return (apiRows.paymentTerms || [])
        .filter((r) => r.status === "ACTIVE")
        .map((r) => `${r.code} — ${r.name}`);
    }
    if (label === "Thuế suất GTGT (%)") {
      return ["0%", "5%", "8%", "10%", "KCT", "KKKNT"];
    }
    if (label === "Giảm thuế theo quy định") {
      return ["Theo quy định chung", "Giảm thuế GTGT (8%)", "Không giảm thuế"];
    }
    if (/Tài khoản|TK |Kết chuyển từ|Kết chuyển đến/.test(label)) {
      const postable = (apiRows.accounts || []).filter((r) => r.status === "ACTIVE" && r.is_postable);
      const prefix =
        label === "Tài khoản kho"
          ? "15"
          : label === "TK doanh thu"
            ? "511"
            : label === "TK Chi phí"
              ? "6"
              : label === "Tài khoản công nợ phải thu"
                ? "131"
                : label === "Tài khoản công nợ phải trả"
                  ? "331"
                  : "";
      const prioritized = prefix
        ? [
            ...postable.filter((r) => String(r.code).startsWith(prefix)),
            ...postable.filter((r) => !String(r.code).startsWith(prefix)),
          ]
        : postable;
      return prioritized.map((r) => `${r.code} — ${r.name}`);
    }
    return [];
  };

  const showEditor = (row?: DirectoryRow) => {
    setEditor(
      row
        ? structuredClone(row)
        : {
            id: crypto.randomUUID(),
            values: definition?.radios.length
              ? {
                  Loại:
                    definition.name === "Mục thu/chi"
                      ? definition.radios.at(-1)!
                      : definition.radios[0],
                }
              : definition?.name === "Vật tư hàng hóa"
                ? { "Tính chất": "Hàng hóa" }
                : {},
          },
    );
    setError("");
    setTab(definition?.tabs[0] || "");
  };

  const lookupTaxInfo = async () => {
    if (!editor || !companyId || !token) return;
    const rawTax = String(editor.values["Mã số thuế/CCCD chủ hộ"] || editor.values["Mã số thuế"] || "")
      .trim()
      .replace(/[\s-]/g, "");
    if (!/^\d{10}(\d{3})?$/.test(rawTax)) {
      setError("Vui lòng nhập Mã số thuế hợp lệ (10 hoặc 13 chữ số) trước khi tra cứu.");
      return;
    }
    setTaxLookingUp(true);
    setError("");
    try {
      const info = await request<Record<string, any>>(
        `/api/v1/master-data/customers/lookup-tax-info/?company_id=${encodeURIComponent(companyId)}&tax_code=${encodeURIComponent(rawTax)}`,
        token,
      );
      if (info && (info.legal_name || info.name || info.company_name)) {
        const foundName = String(info.legal_name || info.name || info.company_name || "");
        const foundAddr = String(info.address || info.address_line || "");
        const foundRep = String(info.representative || info.legal_representative || "");
        setEditor((prev) => {
          if (!prev) return prev;
          const nextVals = { ...prev.values };
          if (definition?.name === "Khách hàng") nextVals["Tên khách hàng"] = foundName;
          if (definition?.name === "Nhà cung cấp") nextVals["Tên nhà cung cấp"] = foundName;
          if (foundAddr) nextVals["Địa chỉ"] = foundAddr;
          if (foundRep) nextVals["Thông tin liên hệ:Đại diện theo PL"] = foundRep;
          return { ...prev, values: nextVals };
        });
        notify(`Đã điền thông tin doanh nghiệp cho MST ${rawTax}.`);
      } else {
        notify(`Không tìm thấy dữ liệu đăng ký tự động cho MST ${rawTax}, vui lòng nhập thủ công.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tra cứu Mã số thuế lúc này.");
    } finally {
      setTaxLookingUp(false);
    }
  };

  const changeEmployeeStatus = async (
    id: string,
    next: "ACTIVE" | "INACTIVE" | "TERMINATED",
    confirm = true,
  ) => {
    const employee = (apiRows.entries || []).find((row) => String(row.id) === id);
    if (!employee) throw new Error("Không tìm thấy hồ sơ nhân viên. Hãy làm mới danh sách.");
    if (
      confirm &&
      !window.confirm(
        next === "ACTIVE"
          ? "Kích hoạt lại nhân viên?"
          : next === "INACTIVE"
            ? "Ngừng sử dụng nhân viên?"
            : "Kết thúc làm việc của nhân viên?",
      )
    )
      return false;
    let terminationDate: string | null = null;
    if (next === "TERMINATED") {
      terminationDate = window.prompt(
        "Ngày kết thúc (YYYY-MM-DD):",
        new Date().toISOString().slice(0, 10),
      );
      if (!terminationDate) return false;
    }
    const path = `/api/v1/organization/employees/${id}/change_status/?company_id=${encodeURIComponent(companyId)}`;
    const body = { status: next, version: employee.version, termination_date: terminationDate };
    try {
      await request(path, token, { method: "POST", body: JSON.stringify(body) });
    } catch (reason) {
      if (!(reason instanceof Error) || !reason.message.includes("confirm_assets")) throw reason;
      if (
        !window.confirm(
          "Nhân viên còn tài sản đang quản lý. Bạn đã kiểm tra việc bàn giao và muốn tiếp tục?",
        )
      )
        return false;
      await request(path, token, {
        method: "POST",
        body: JSON.stringify({ ...body, confirm_assets: true }),
      });
    }
    reloadApi();
    return true;
  };

  const toggleCatalogRowStatus = async (rowId: string, confirmPrompt = true) => {
    if (!definition || !apiPath || !apiConnected) return false;
    const raw = (apiRows.entries || []).find((entry) => String(entry.id) === rowId);
    if (!raw) return false;
    const isCurrentlyActive =
      typeof raw.is_active === "boolean" ? raw.is_active : (raw.status || "ACTIVE") === "ACTIVE";
    const nextLabel = isCurrentlyActive ? "Ngừng sử dụng" : "Kích hoạt lại";
    if (confirmPrompt && !window.confirm(`${nextLabel} bản ghi này?`)) return false;
    const payload: Record<string, any> =
      typeof raw.is_active === "boolean"
        ? { is_active: !isCurrentlyActive }
        : { status: isCurrentlyActive ? "INACTIVE" : "ACTIVE" };
    if (raw.version !== undefined) payload.version = raw.version;
    await request(
      `${apiPath}${rowId}/?company_id=${encodeURIComponent(companyId)}`,
      token,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    reloadApi();
    return true;
  };

  const exportEmployees = async () => {
    try {
      const response = await fetch(
        `/api/v1/organization/employees/export-xlsx/?company_id=${encodeURIComponent(companyId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(`Không thể xuất Excel (HTTP ${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "nhan-vien.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : "Không thể xuất Excel.");
    }
  };

  const exportCurrentDirectoryCsv = (onlySelected = false) => {
    if (!definition) return;
    if (employeeDirectory && !onlySelected) {
      void exportEmployees();
      return;
    }
    const exportHeaders = headers.filter((h) => h !== "Chức năng");
    const targetRows = onlySelected ? rows.filter((r) => selected.includes(r.id)) : rows;
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csvLines = [
      exportHeaders.map(esc).join(","),
      ...targetRows.map((r) => exportHeaders.map((h) => esc(r.values[h] || "")).join(",")),
    ];
    const blob = new Blob(["\ufeff" + csvLines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = definition.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${slug || "danh-muc"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    notify(`Đã xuất ${targetRows.length} dòng danh mục "${definition.name}".`);
  };

  const save = async (addAnother = false) => {
    if (!definition || !editor) return;
    if (employeeDirectory && !apiConnected) {
      setError("Cần đăng nhập và chọn doanh nghiệp để quản lý nhân viên.");
      return;
    }
    const normalized = {
      ...editor,
      values: normalizeDirectoryValues(editFields, definition.headers, editor.values),
    };
    const problem = validateDirectoryEntry(editFields, normalized.values, allRows, editor.id);
    if (problem) {
      setError(problem);
      return;
    }
    if (employeeDirectory && !normalized.values["Đơn vị"]?.trim()) {
      setError("Vui lòng chọn Đơn vị.");
      return;
    }
    if (employeeDirectory && !normalized.values["Thông tin tiền lương:Loại hợp đồng"]?.trim()) {
      setError("Vui lòng chọn Loại hợp đồng.");
      return;
    }
    if (apiConnected && apiPath && writableDirectories.has(definition.name)) {
      const original = apiRows.entries?.find((row) => String(row.id) === editor.id);
      const existing = Boolean(original);
      const values = normalized.values;
      const code =
        definition.name === "Ngân hàng"
          ? values["Tên viết tắt"]
          : Object.entries(values).find(([label]) => /^Mã(?! số)(?: |$)/.test(label))?.[1] ||
            values["Mã khách hàng"] ||
            values["Mã nhà cung cấp"] ||
            values["Mã"] ||
            (definition.name === "Khách hàng" ? "AUTO" : "");
      const name =
        definition.name === "Ngân hàng"
          ? values["Tên đầy đủ"]
          : Object.entries(values).find(([label]) => /^Tên(?: |$)|^Họ và tên$/.test(label))?.[1] ||
            Object.entries(values).find(([label]) => /^Tên/.test(label))?.[1] ||
            values["Tên"];
      try {
        const baseInput: Record<string, any> = {
          ...(definition.name === "Ngân hàng" ||
          definition.name === "Loại tiền" ||
          (employeeDirectory && existing)
            ? {}
            : { company: companyId }),
          code,
          name,
          ...(original?.version !== undefined ? { version: original.version } : {}),
        };
        if (definition.name === "Cơ cấu tổ chức") {
          Object.assign(baseInput, {
            address: values["Địa chỉ"] || "",
            tax_code: values["Mã số thuế"] || "",
            is_head_office: (values["Cấp tổ chức"] || "").includes("Trụ sở"),
            status: "ACTIVE",
          });
        }
        if (definition.name === "Nhà cung cấp" || definition.name === "Khách hàng") {
          const rawTax = String(
            values["Mã số thuế"] || values["Mã số thuế/CCCD chủ hộ"] || "",
          )
            .trim()
            .replace(/[\s-]/g, "");
          baseInput.party_type = values["Loại"] === "Cá nhân" ? "INDIVIDUAL" : "ORGANIZATION";
          baseInput.tax_code = /^\d{10}(\d{3})?$/.test(rawTax) ? rawTax : null;
          baseInput.legal_name = name;
        }
        if (definition.name === "Điều khoản thanh toán") {
          baseInput.due_days = Math.max(0, Number(values["Số ngày được nợ"] || 0));
          const hasDisc = Boolean(
            values["Tỷ lệ chiết khấu"] && Number(values["Tỷ lệ chiết khấu"]) > 0,
          );
          baseInput.has_discount = hasDisc;
          baseInput.discount_days = hasDisc
            ? Number(values["Thời hạn hưởng chiết khấu"] || 0)
            : null;
          baseInput.discount_rate = hasDisc ? Number(values["Tỷ lệ chiết khấu"]) : null;
          baseInput.scope = "BOTH";
          baseInput.due_base = "DOCUMENT";
        }
        if (definition.name === "Loại chứng từ") {
          baseInput.module_code = "GL";
          baseInput.status = "ACTIVE";
        }
        const special = await directoryInput(
          createApiWriter(companyId, (path, init) => request(path, token, init)),
          definition.name,
          values,
        );
        if (special) Object.assign(baseInput, special);
        const saved = await request<Record<string, any>>(
          existing
            ? `${apiPath}${editor.id}/?company_id=${encodeURIComponent(companyId)}`
            : `${apiPath}?company_id=${encodeURIComponent(companyId)}`,
          token,
          {
            method: existing ? "PATCH" : "POST",
            body: JSON.stringify(baseInput),
          },
        );
        // Ensure newly created Vendor also receives explicit VENDOR PartyRole + optional contact/address
        if (vendorDirectory && !existing && saved?.id) {
          const today = new Date().toISOString().slice(0, 10);
          try {
            await request(
              `/api/v1/master-data/party-roles/?company_id=${encodeURIComponent(companyId)}`,
              token,
              {
                method: "POST",
                body: JSON.stringify({
                  party: saved.id,
                  role_type: "VENDOR",
                  active_from: today,
                }),
              },
            );
          } catch {
            /* ignore if role already exists */
          }
          if (values["Địa chỉ"]?.trim()) {
            try {
              await request(
                `/api/v1/master-data/party-addresses/?company_id=${encodeURIComponent(companyId)}`,
                token,
                {
                  method: "POST",
                  body: JSON.stringify({
                    party: saved.id,
                    address_type: "HEAD_OFFICE",
                    country_code: "VN",
                    address_line: values["Địa chỉ"].trim(),
                    is_default: true,
                    status: "ACTIVE",
                  }),
                },
              );
            } catch {
              /* optional */
            }
          }
          const phone =
            values["Điện thoại"]?.trim() || values["Thông tin liên hệ:Số điện thoại"]?.trim();
          const email = values["Thông tin liên hệ:Email"]?.trim();
          if (phone || email) {
            try {
              await request(
                `/api/v1/master-data/party-contacts/?company_id=${encodeURIComponent(companyId)}`,
                token,
                {
                  method: "POST",
                  body: JSON.stringify({
                    party: saved.id,
                    contact_type: "PRIMARY",
                    contact_name:
                      values["Thông tin liên hệ:Họ và tên"]?.trim() || name || "Liên hệ NCC",
                    phone: phone || "",
                    email: email || "",
                    is_default: true,
                    status: "ACTIVE",
                  }),
                },
              );
            } catch {
              /* optional */
            }
          }
        }
        normalized.id = String(saved.id);
        if (saved.code) {
          for (const key of Object.keys(normalized.values)) {
            if (/^Mã(?! số)(?: |$)/.test(key)) normalized.values[key] = String(saved.code);
          }
          normalized.values["Mã"] = String(saved.code);
        }
        setRecords((prev) => {
          const copy = { ...prev };
          delete copy[definition.name];
          return copy;
        });
        reloadApi();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Không lưu được danh mục.");
        return;
      }
    } else {
      setRecords((previous) => ({
        ...previous,
        [definition.name]: allRows.some((row) => row.id === editor.id)
          ? allRows.map((row) => (row.id === editor.id ? normalized : row))
          : [...allRows, normalized],
      }));
    }
    notify(
      apiConnected && apiPath && writableDirectories.has(definition.name)
        ? "Đã lưu danh mục lên hệ thống."
        : "Đã cập nhật dữ liệu hiển thị.",
    );
    onEntrySaved?.(normalized.values);
    if (addAnother) {
      setEditor({
        id: crypto.randomUUID(),
        values: definition.radios.length
          ? {
              Loại:
                definition.name === "Mục thu/chi"
                  ? definition.radios.at(-1)!
                  : definition.radios[0],
            }
          : {},
      });
      setError("");
    } else closeEditor();
  };

  if (legacyView)
    return (
      <div>
        <div className="md-legacy-bar">
          <button onClick={() => setLegacyView(false)}>
            <ArrowLeft size={14} /> Danh mục Sổ Việt
          </button>
        </div>
        {legacy}
      </div>
    );

  if (definition?.name === "Hệ thống tài khoản")
    return <AccountCatalogWorkspace onBack={() => setDefinition(null)} />;

  if (!definition) {
    const allGroups = [...new Set(MISA_DIRECTORY_DEFINITIONS.map((item) => item.group))];
    const allowedGroups =
      groupFilter !== "all" && SECTION_GROUP_MAP[groupFilter]
        ? SECTION_GROUP_MAP[groupFilter]
        : allGroups;
    const groups = allGroups.filter((g) => allowedGroups.includes(g));
    return (
      <div className="md-home">
        <header>
          <h1>Danh mục</h1>
          <label>
            <Search size={16} />
            <input
              aria-label="Tìm danh mục"
              placeholder="Tìm danh mục"
              value={menuQuery}
              onInput={(e) => setMenuQuery(e.currentTarget.value)}
              onChange={(e) => setMenuQuery(e.target.value)}
            />
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[
              ["all", "Tất cả"],
              ["partners", "Đối tượng"],
              ["items", "Hàng hóa, dịch vụ"],
              ["organization", "Tổ chức & Nhân sự"],
              ["accounting", "Tài khoản & Kế toán"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGroupFilter(key)}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: groupFilter === key ? 600 : 500,
                  border: groupFilter === key ? "1px solid #1d4ed8" : "1px solid #dbe3ef",
                  background: groupFilter === key ? "#eff6ff" : "#ffffff",
                  color: groupFilter === key ? "#1d4ed8" : "#475569",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setLegacyView(true)}>Danh sách hiện có</button>
        </header>
        <div className="md-groups">
          {groups.map((group) => {
            const items = MISA_DIRECTORY_DEFINITIONS.filter(
              (item) =>
                item.group === group &&
                item.name
                  .toLocaleLowerCase("vi")
                  .includes(menuQuery.toLocaleLowerCase("vi")),
            );
            return items.length ? (
              <section key={group}>
                <h2>{group}</h2>
                {items.map((item) => (
                  <button key={item.name} onClick={() => open(item)}>
                    {item.name}
                  </button>
                ))}
              </section>
            ) : null;
          })}
        </div>
      </div>
    );
  }

  const canWriteApi = Boolean(apiConnected && apiPath && writableDirectories.has(definition.name));

  return (
    <div className={`md-list${initialCreate ? " md-editor-only" : ""}`}>
      <header>
        <button aria-label="Về danh mục" onClick={() => setDefinition(null)}>
          <ArrowLeft size={18} />
        </button>
        <h1>{definition.name}</h1>
        {definition.canAdd && writableDirectories.has(definition.name) && (
          <button disabled={employeeDirectory && !apiConnected} onClick={() => showEditor()}>
            <Plus size={15} /> Thêm
          </button>
        )}
      </header>
      <div className="md-toolbar">
        <label>
          <Search size={15} />
          <input
            aria-label={`Tìm ${definition.name.toLocaleLowerCase("vi")}`}
            placeholder="Tìm kiếm"
            value={query}
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {apiPath && (
          <button
            type="button"
            onClick={reloadApi}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={13} /> Làm mới
          </button>
        )}
        <button
          type="button"
          onClick={() => exportCurrentDirectoryCsv(false)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Download size={13} /> Xuất Excel
        </button>
        <span />
        {selected.length > 0 && (
          <>
            <b>Đã chọn {selected.length}</b>
            <button type="button" onClick={() => exportCurrentDirectoryCsv(true)}>
              Xuất đã chọn
            </button>
            {employeeDirectory ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Ngừng sử dụng ${selected.length} nhân viên đã chọn?`))
                    return;
                  const failures: string[] = [];
                  let done = 0;
                  for (const id of selected) {
                    try {
                      if (await changeEmployeeStatus(id, "INACTIVE", false)) done++;
                    } catch (reason) {
                      failures.push(
                        `${id}: ${reason instanceof Error ? reason.message : "Lỗi"}`,
                      );
                    }
                  }
                  notify(
                    `Đã ngừng sử dụng ${done}/${selected.length} nhân viên.${failures.length ? ` Thất bại: ${failures.join("; ")}` : ""}`,
                  );
                  setSelected([]);
                }}
              >
                Ngừng sử dụng đã chọn
              </button>
            ) : (
              canWriteApi &&
              definition.headers.includes("Trạng thái") &&
              definition.name !== "Ngân hàng" &&
              definition.name !== "Loại tiền" && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Đổi trạng thái ${selected.length} dòng đã chọn?`))
                      return;
                    let done = 0;
                    for (const id of selected) {
                      try {
                        if (await toggleCatalogRowStatus(id, false)) done++;
                      } catch {
                        /* ignore row without status endpoint */
                      }
                    }
                    notify(`Đã cập nhật trạng thái ${done}/${selected.length} bản ghi.`);
                    setSelected([]);
                  }}
                >
                  Đổi trạng thái đã chọn
                </button>
              )
            )}
          </>
        )}
        <button
          aria-label="Ẩn hiện cột danh mục"
          onClick={() => setColumnsOpen(!columnsOpen)}
        >
          <Settings size={16} />
          <ChevronDown size={13} />
        </button>
      </div>
      {columnsOpen && (
        <div className="md-column-picker">
          {definition.headers.map((header) => (
            <label key={header}>
              <input
                type="checkbox"
                checked={!hidden.includes(header)}
                onChange={() =>
                  setHidden((previous) =>
                    previous.includes(header)
                      ? previous.filter((value) => value !== header)
                      : [...previous, header],
                  )
                }
              />
              {header}
            </label>
          ))}
        </div>
      )}
      <div className="md-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Chọn tất cả danh mục"
                  type="checkbox"
                  checked={
                    rows.length > 0 && rows.every((row) => selected.includes(row.id))
                  }
                  onChange={(e) =>
                    setSelected(e.target.checked ? rows.map((row) => row.id) : [])
                  }
                />
              </th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
              .map((row) => (
                <tr
                  key={row.id}
                  onDoubleClick={() => {
                    if (writableDirectories.has(definition.name)) showEditor(row);
                  }}
                >
                  <td>
                    <input
                      aria-label={`Chọn dòng ${row.id}`}
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((previous) =>
                          e.target.checked
                            ? [...previous, row.id]
                            : previous.filter((id) => id !== row.id),
                        )
                      }
                    />
                  </td>
                  {headers.map((header) => (
                    <td key={header}>
                      {header === "Chức năng" ? (
                        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          {writableDirectories.has(definition.name) ? (
                            <button onClick={() => showEditor(row)}>Sửa</button>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: 12 }}>Chuẩn hệ thống</span>
                          )}
                          {employeeDirectory &&
                            (() => {
                              const item = (apiRows.entries || []).find(
                                (entry) => String(entry.id) === row.id,
                              );
                              const target =
                                item?.status === "ACTIVE"
                                  ? "INACTIVE"
                                  : item?.status === "INACTIVE"
                                    ? "ACTIVE"
                                    : null;
                              return (
                                <>
                                  {target && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        changeEmployeeStatus(row.id, target).catch((reason) =>
                                          notify(
                                            reason instanceof Error
                                              ? reason.message
                                              : "Không đổi được trạng thái.",
                                          ),
                                        )
                                      }
                                    >
                                      {target === "ACTIVE" ? "Kích hoạt lại" : "Ngừng sử dụng"}
                                    </button>
                                  )}
                                  {item?.status === "ACTIVE" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        changeEmployeeStatus(row.id, "TERMINATED").catch(
                                          (reason) =>
                                            notify(
                                              reason instanceof Error
                                                ? reason.message
                                                : "Không kết thúc được nhân viên.",
                                            ),
                                        )
                                      }
                                    >
                                      Kết thúc
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          {!employeeDirectory &&
                            canWriteApi &&
                            definition.headers.includes("Trạng thái") &&
                            definition.name !== "Ngân hàng" &&
                            definition.name !== "Loại tiền" && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCatalogRowStatus(row.id).catch((reason) =>
                                    notify(
                                      reason instanceof Error
                                        ? reason.message
                                        : "Không đổi được trạng thái.",
                                    ),
                                  )
                                }
                              >
                                {row.values["Trạng thái"] === "Ngừng sử dụng"
                                  ? "Kích hoạt lại"
                                  : "Ngừng sử dụng"}
                              </button>
                            )}
                        </div>
                      ) : (
                        row.values[header]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            {!rows.length && (
              <tr>
                <td colSpan={headers.length + 1} className="md-empty">
                  Không có dữ liệu phù hợp với điều kiện tìm kiếm
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer>
        <span>
          Tổng số: <b>{rows.length}</b>
        </span>
        <label>
          Số dòng/trang{" "}
          <select
            aria-label="Số dòng/trang danh mục"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[20, 50, 100].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          disabled={visiblePage === 1}
          aria-label="Trang trước danh mục"
          onClick={() => setPage(visiblePage - 1)}
        >
          ‹
        </button>
        <span>
          {visiblePage}/{pageCount}
        </span>
        <button
          disabled={visiblePage === pageCount}
          aria-label="Trang sau danh mục"
          onClick={() => setPage(visiblePage + 1)}
        >
          ›
        </button>
      </footer>
      {editor && (
        <div
          className="md-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div
            className="md-editor"
            ref={editorRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Thông tin ${definition.name.toLocaleLowerCase("vi")}`}
          >
            <header>
              <h2>Thông tin {definition.name.toLocaleLowerCase("vi")}</h2>
              <button
                aria-label="Đóng thông tin danh mục"
                onClick={() => closeEditor()}
              >
                <X size={20} />
              </button>
            </header>
            <div className="md-editor-body">
              {definition.radios.length > 0 && (
                <div
                  className="md-radio-types"
                  role="radiogroup"
                  aria-label={
                    definition.name === "Nhân viên" ? "Giới tính" : "Loại đối tượng"
                  }
                >
                  {definition.radios.map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="directory-type"
                        checked={editor.values.Loại === value}
                        onChange={() => updateEditor("Loại", value)}
                      />
                      {value}
                    </label>
                  ))}
                  {customerOrVendor && (
                    <button
                      type="button"
                      disabled={taxLookingUp}
                      onClick={() => void lookupTaxInfo()}
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        height: 30,
                        padding: "0 12px",
                        borderRadius: 6,
                        border: "1px solid #bfdbfe",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Sparkles size={13} />
                      {taxLookingUp ? "Đang tra cứu..." : "Lấy thông tin theo MST"}
                    </button>
                  )}
                </div>
              )}
              <div className="md-fields">
                {editFields.map((field) => {
                  const dynOpts = comboOptionsForField(field.label);
                  const mergedOpts =
                    dynOpts.length > 0
                      ? dynOpts
                      : "options" in field
                        ? (field.options as string[])
                        : [];
                  const manageTarget = MANAGE_TARGET_BY_FIELD[field.label];
                  return (
                    <label key={field.label}>
                      {field.label}
                      {(definition.name === "Tài khoản ngân hàng"
                        ? ["Số tài khoản", "Tên ngân hàng"].includes(field.label)
                        : requiredDirectoryField(field.label) ||
                          (employeeDirectory && field.label === "Đơn vị")) && <em>*</em>}
                      {field.kind === "combo" ? (
                        <DirectoryChoiceField
                          onManage={
                            manageTarget
                              ? () => {
                                  const q = new URLSearchParams(window.location.search);
                                  q.set("directory", manageTarget);
                                  directoryNavigate("/directory?" + q.toString());
                                }
                              : undefined
                          }
                          label={field.label}
                          value={editor.values[field.label] || ""}
                          onChange={(value) => updateEditor(field.label, value)}
                          options={mergedOpts}
                        />
                      ) : ["Ngày sinh", "Ngày cấp", "Ngày bắt đầu", "Ngày kết thúc"].includes(
                          field.label,
                        ) ? (
                        <VoucherDateField
                          value={editor.values[field.label] || ""}
                          onChange={(value) => updateEditor(field.label, value)}
                          label={field.label}
                        />
                      ) : field.kind === "textarea" ? (
                        <textarea
                          value={editor.values[field.label] || ""}
                          onChange={(e) => updateEditor(field.label, e.target.value)}
                        />
                      ) : (
                        <input
                          value={editor.values[field.label] || ""}
                          type={field.kind === "number" ? "number" : "text"}
                          onInput={(e) =>
                            updateEditor(field.label, e.currentTarget.value)
                          }
                          onChange={(e) => updateEditor(field.label, e.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="md-checks">
                {definition.checks.map((label) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={editor.values[label] === "true"}
                      onChange={(e) =>
                        setEditor((previous) =>
                          previous
                            ? {
                                ...previous,
                                values: {
                                  ...previous.values,
                                  [label]: String(e.target.checked),
                                },
                              }
                            : previous,
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {definition.tabs.length > 0 && (
                <>
                  <nav aria-label="Thông tin danh mục">
                    {definition.tabs.map((label) => (
                      <button
                        key={label}
                        className={tab === label ? "active" : ""}
                        onClick={() => setTab(label)}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  <DirectoryTabContent
                    tab={tab}
                    data={definition.tabData[tab]}
                    values={editor.values}
                    onChange={updateEditor}
                  />
                </>
              )}
            </div>
            {definition.name === "Tài khoản ngân hàng" && (
              <div
                style={{
                  padding: "12px 18px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <span>
                  Tự động đối chiếu sao kê và giao dịch với phân hệ Ngân hàng điện tử
                </span>
                <button
                  type="button"
                  onClick={() => {
                    closeEditor();
                    directoryNavigate("/bank?tab=ebanking");
                  }}
                >
                  Mở Ngân hàng điện tử
                </button>
              </div>
            )}
            {error && (
              <p role="alert" className="md-error">
                {error}
              </p>
            )}
            <footer>
              <button onClick={() => closeEditor()}>Hủy</button>
              <button onClick={() => save()}>Lưu</button>
              <MisaSaveSplitButton
                defaultMode="save_and_add"
                showPrint={false}
                height={32}
                onSaveAndClose={() => save(false)}
                onSaveAndAdd={() => save(true)}
              />
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
