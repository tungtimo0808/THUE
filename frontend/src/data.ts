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
  { id: "abc", name: "Công ty TNHH Thương mại và Dịch vụ ABC", short: "ABC" },
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
  "Công ty TNHH Kinh doanh Minh Hạnh",
  "Công ty TNHH Thanh Hà",
  "Công ty TNHH Phát Mai Group",
  "Công ty TNHH Giải pháp Hiệp Phát",
  "Công ty TNHH Đầu tư Bảo Kim",
  "Công ty TNHH Thiết bị Thanh Trúc",
  "Công ty TNHH Phát triển Công nghệ KTS",
  "Công ty TNHH Phan Minh",
  "CTCP Vận tải và Thương mại Vạn Phát",
  "Phạm Đình Tài",
  "Lê Văn Hiếu",
  "Hoàng Bá Cung",
];

export const seedTransactions: Transaction[] = [
  {
    id: "abc-tx-01",
    company: "abc",
    code: "PT00001",
    kind: "receipt",
    date: "2025-01-06",
    partner: "Lê Văn Hiếu",
    description: "Rút tiền gửi ngân hàng Techcombank về nhập quỹ tiền mặt",
    amount: 50000000,
    status: "posted",
  },
  {
    id: "abc-tx-02",
    company: "abc",
    code: "PC00001",
    kind: "payment",
    date: "2025-01-07",
    partner: "Hoàng Bá Cung",
    description: "Mua văn phòng phẩm phục vụ hoạt động quản lý bộ phận HC-NS",
    amount: 3500000,
    status: "posted",
  },
  {
    id: "abc-tx-03",
    company: "abc",
    code: "BC00001",
    kind: "bank",
    date: "2025-01-08",
    partner: "Công ty TNHH Thanh Hà",
    description: "Công ty Thanh Hà ứng trước tiền mua hàng bằng TGNH Techcombank theo HĐ 2025001",
    amount: 50000000,
    status: "posted",
  },
  {
    id: "abc-tx-04",
    company: "abc",
    code: "MH00001",
    kind: "purchase",
    date: "2025-01-09",
    partner: "Công ty TNHH Phát Mai Group",
    description: "Mua hàng hóa nhập kho Công ty Phát Mai, thời hạn thanh toán 20 ngày",
    amount: 185000000,
    status: "posted",
  },
  {
    id: "abc-tx-05",
    company: "abc",
    code: "BH00001",
    kind: "sale",
    date: "2025-01-03",
    partner: "Công ty TNHH Kinh doanh Minh Hạnh",
    description: "Xuất bán điện thoại iPhone 15 & Samsung S24 kiêm xuất kho chưa thu tiền",
    amount: 148500000,
    status: "posted",
  },
  {
    id: "abc-tx-06",
    company: "abc",
    code: "BC00002",
    kind: "bank",
    date: "2025-01-08",
    partner: "Công ty TNHH Kinh doanh Minh Hạnh",
    description: "Minh Hạnh chuyển khoản thanh toán tiền mua hàng ngày 03/01/2025",
    amount: 148500000,
    status: "posted",
  },
  {
    id: "abc-tx-07",
    company: "abc",
    code: "MH00002",
    kind: "purchase",
    date: "2025-01-12",
    partner: "Công ty Cổ phần Minh Quân Logistics",
    description: "Mua hàng hóa nhập kho thanh toán ngay bằng TGNH Techcombank hưởng CKTM 5%",
    amount: 95000000,
    status: "posted",
  },
  {
    id: "abc-tx-08",
    company: "abc",
    code: "BH00002",
    kind: "sale",
    date: "2025-01-13",
    partner: "Công ty TNHH Giải pháp Hiệp Phát",
    description: "Cung cấp dịch vụ bảo dưỡng máy tính định kỳ, thanh toán bằng chuyển khoản",
    amount: 12000000,
    status: "posted",
  },
  {
    id: "abc-tx-09",
    company: "abc",
    code: "BH00003",
    kind: "sale",
    date: "2025-01-14",
    partner: "Công ty TNHH Thanh Hà",
    description: "Xuất bán hàng cho Công ty Thanh Hà, chiết khấu 5%, thanh toán qua TGNH",
    amount: 78000000,
    status: "posted",
  },
  {
    id: "abc-tx-10",
    company: "abc",
    code: "MH00003",
    kind: "purchase",
    date: "2025-01-15",
    partner: "Công ty TNHH Phát triển Công nghệ KTS",
    description: "Mua hàng hóa nhập kho phát sinh chi phí vận chuyển phân bổ theo giá trị",
    amount: 234000000,
    status: "posted",
  },
  {
    id: "abc-tx-11",
    company: "abc",
    code: "BC00003",
    kind: "bank",
    date: "2025-01-16",
    partner: "Công ty TNHH Đầu tư Bảo Kim",
    description: "Công ty Bảo Kim thanh toán nợ cũ qua ngân hàng được hưởng chiết khấu 2%",
    amount: 39200000,
    status: "posted",
  },
  {
    id: "abc-tx-12",
    company: "abc",
    code: "BC00004",
    kind: "bank",
    date: "2025-01-20",
    partner: "Ngân hàng Techcombank",
    description: "Bán 50.000 USD từ tài khoản USD nhập vào tài khoản VND tỷ giá 25.445",
    amount: 1272250000,
    status: "posted",
  },
  {
    id: "abc-tx-13",
    company: "abc",
    code: "BC00005",
    kind: "bank",
    date: "2025-01-22",
    partner: "Công ty TNHH Thiết bị Thanh Trúc",
    description: "Chuyển khoản thanh toán tiền nợ kỳ trước cho Thanh Trúc hưởng chiết khấu 5%",
    amount: 71250000,
    status: "posted",
  },
  {
    id: "abc-tx-14",
    company: "abc",
    code: "PC00002",
    kind: "payment",
    date: "2025-01-23",
    partner: "Phạm Đình Tài",
    description: "Chi tạm ứng cho nhân viên kỹ thuật Phạm Đình Tài đi công tác theo đề nghị",
    amount: 5000000,
    status: "posted",
  },
  {
    id: "abc-tx-15",
    company: "abc",
    code: "BC00006",
    kind: "bank",
    date: "2025-01-24",
    partner: "Kho bạc Nhà nước Hoàn Kiếm",
    description: "Nộp thuế môn bài năm 2025 bằng tiền gửi ngân hàng Techcombank",
    amount: 3000000,
    status: "posted",
  },
  {
    id: "abc-tx-16",
    company: "abc",
    code: "PT00002",
    kind: "receipt",
    date: "2025-01-28",
    partner: "Phạm Đình Tài",
    description: "Thu hoàn ứng thừa tiền mặt từ nhân viên Phạm Đình Tài sau khi quyết toán",
    amount: 1200000,
    status: "posted",
  },
  {
    id: "abc-tx-17",
    company: "abc",
    code: "PC00183",
    kind: "payment",
    date: "2025-12-22",
    partner: "Hoàng Bá Cung",
    description: "Chi tiền mặt bảo dưỡng hệ thống máy lạnh Daikin VRV A Series (Hóa đơn 128)",
    amount: 1320000,
    status: "posted",
  },
  {
    id: "abc-tx-18",
    company: "abc",
    code: "BH00157",
    kind: "sale",
    date: "2025-12-22",
    partner: "Công ty TNHH Phan Minh",
    description: "Xuất bán thiết bị công nghệ (Macbook Air M3, HP 15s, Màn hình LG) chưa thu tiền",
    amount: 526460000,
    status: "posted",
  },
  {
    id: "abc-tx-19",
    company: "abc",
    code: "BC00128",
    kind: "bank",
    date: "2025-12-22",
    partner: "CTCP Vận tải và Thương mại Vạn Phát",
    description: "Thanh toán chi phí vận chuyển hàng hóa cho Vạn Phát qua ngân hàng",
    amount: 4400000,
    status: "posted",
  },
  {
    id: "abc-tx-20",
    company: "abc",
    code: "PT00003",
    kind: "receipt",
    date: "2025-01-30",
    partner: "Khách hàng cá nhân",
    description: "Thu tiền bán lẻ điện thoại iPhone 15 kèm sạc dự phòng Anker",
    amount: 21500000,
    status: "posted",
  },
];

const storageKey = "soviet-documents-abc-tt99-v1";
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
    /* Fallback */
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
