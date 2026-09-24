import {
  LayoutDashboard,
  Wallet,
  Landmark,
  ShoppingCart,
  ShoppingBag,
  FileCheck2,
  Package,
  Building2,
  Users,
  Calculator,
  ChartNoAxesCombined,
  BookOpen,
  Settings2,
  FolderKanban,
  ReceiptText,
} from "lucide-react";

export const modules = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard, group: "" },
  {
    id: "purchases",
    label: "Mua hàng",
    icon: ShoppingCart,
    group: "Giao dịch",
  },
  { id: "sales", label: "Bán hàng", icon: ShoppingBag, group: "Giao dịch" },
  { id: "inventory", label: "Kho hàng", icon: Package, group: "Giao dịch" },
  { id: "cash", label: "Tiền mặt", icon: Wallet, group: "Tài chính" },
  {
    id: "bank",
    label: "Tiền gửi ngân hàng",
    icon: Landmark,
    group: "Tài chính",
  },
  {
    id: "ledger",
    label: "Kế toán tổng hợp",
    icon: BookOpen,
    group: "Tài chính",
  },
  {
    id: "assets",
    label: "Tài sản & công cụ",
    icon: Building2,
    group: "Tài chính",
  },
  { id: "payroll", label: "Tiền lương", icon: Users, group: "Tài chính" },
  {
    id: "invoices",
    label: "Quản lý hóa đơn",
    icon: FileCheck2,
    group: "Thuế & báo cáo",
  },
  {
    id: "tax",
    label: "Thuế & tờ khai",
    icon: Calculator,
    group: "Thuế & báo cáo",
  },
  {
    id: "reports",
    label: "Báo cáo",
    icon: ChartNoAxesCombined,
    group: "Thuế & báo cáo",
  },
  { id: "directory", label: "Danh mục", icon: FolderKanban, group: "Hệ thống" },
  { id: "settings", label: "Thiết lập", icon: Settings2, group: "Hệ thống" },
];
export const companies = [
  { id: "minh-an", name: "Công ty TNHH Minh An", short: "MA" },
  { id: "an-phat", name: "Công ty CP An Phát", short: "AP" },
];
export const kinds = {
  receipt: "Phiếu thu",
  payment: "Phiếu chi",
  bank: "Thu tiền gửi",
  purchase: "Mua hàng",
  sale: "Bán hàng",
};
export type Kind = keyof typeof kinds;
export type Status = "draft" | "pending" | "posted";
export const statuses: Record<Status, string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  posted: "Đã ghi sổ",
};
export type Transaction = {
  id: string;
  code: string;
  company: string;
  kind: Kind;
  date: string;
  partner: string;
  description: string;
  amount: number;
  status: Status;
  lines?: { description: string; amount: number }[];
};
export const partners = [
  "Công ty TNHH Phúc Long",
  "Công ty CP Công nghệ Sao Việt",
  "Công ty TNHH An Khang",
  "Công ty CP Thương mại Hòa Bình",
  "Nguyễn Minh Anh",
  "Công ty TNHH Hoàng Gia",
];
const descriptions: Record<Kind, string[]> = {
  receipt: [
    "Thu tiền bán hàng tháng 9",
    "Khách hàng thanh toán công nợ",
    "Thu tiền dịch vụ tư vấn",
  ],
  payment: [
    "Thanh toán chi phí văn phòng",
    "Chi phí vận chuyển hàng hóa",
    "Thanh toán tiền thuê mặt bằng",
  ],
  bank: [
    "Khách hàng chuyển khoản thanh toán",
    "Thu tiền hợp đồng dịch vụ",
    "Thu công nợ qua ngân hàng",
  ],
  purchase: [
    "Mua thiết bị văn phòng",
    "Nhập hàng theo đơn mua",
    "Mua hàng hóa từ nhà cung cấp",
  ],
  sale: [
    "Bán hàng theo hợp đồng",
    "Cung cấp dịch vụ phần mềm",
    "Xuất bán thiết bị văn phòng",
  ],
};
const prefixes: Record<Kind, string> = {
  receipt: "PT",
  payment: "PC",
  bank: "BC",
  purchase: "MH",
  sale: "BH",
};
export const seedTransactions: Transaction[] = companies.flatMap(
  (company, ci) =>
    Array.from({ length: 54 }, (_, i) => {
      const kind = (Object.keys(kinds) as Kind[])[i % 5];
      const month = 9 - Math.floor(i / 9);
      return {
        id: `${company.id}-${i}`,
        company: company.id,
        code: `${prefixes[kind]}${String(126 + i).padStart(5, "0")}`,
        kind,
        date: `2026-${String(month).padStart(2, "0")}-${String(24 - (i % 9) * 2).padStart(2, "0")}`,
        partner: partners[(i + ci) % partners.length],
        description: descriptions[kind][i % 3],
        amount: (12 + ((i * 17 + ci * 11) % 83)) * 1250000,
        status: i < 3 ? "pending" : i % 7 === 0 ? "draft" : "posted",
      };
    }),
);
const storageKey = "soviet-demo-documents-v1";
export function readTransactions(): Transaction[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (
      Array.isArray(raw) &&
      raw.every(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.code === "string" &&
          companies.some((c) => c.id === x.company) &&
          x.kind in kinds &&
          x.status in statuses &&
          typeof x.partner === "string" &&
          typeof x.description === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
          Number.isSafeInteger(x.amount) &&
          x.amount > 0,
      )
    )
      return raw;
  } catch {
    /* Corrupt or unavailable browser storage: use the bundled demo. */
  }
  return seedTransactions;
}
export function persistTransactions(items: Transaction[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}
export function money(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}
export function shortMoney(value: number) {
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(
      value / 1000000,
    ) + " tr"
  );
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(date + "T12:00:00"));
}
export function matchesModule(item: Transaction, module: string) {
  if (module === "cash")
    return item.kind === "receipt" || item.kind === "payment";
  if (module === "bank") return item.kind === "bank";
  if (module === "purchases") return item.kind === "purchase";
  if (module === "sales") return item.kind === "sale";
  if (module === "invoices")
    return item.kind === "purchase" || item.kind === "sale";
  return true;
}
export function downloadCsv(items: Transaction[]) {
  const escape = (s: string) =>
    '"' + (/^[=+@\-\t\r]/.test(s) ? "'" + s : s).replaceAll('"', '""') + '"';
  const rows = [
    [
      "Số chứng từ",
      "Ngày",
      "Loại",
      "Đối tượng",
      "Diễn giải",
      "Số tiền (VND)",
      "Trạng thái",
    ],
    ...items.map((t) => [
      t.code,
      t.date,
      kinds[t.kind],
      t.partner,
      t.description,
      String(t.amount),
      statuses[t.status],
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    ),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "so-viet-chung-tu-mau.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const documentIcon = ReceiptText;
