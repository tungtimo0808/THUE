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
  {
    id: "abc",
    name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
    short: "ABC",
    taxCode: "109876543",
    address: "198 Trần Quang Khải. P. Hoàn Kiếm, TP. Hà Nội",
    regime: "Thông tư 99/2025/TT-BTC",
    charterCapital: 5000000000,
  },
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
  "Công ty TNHH Thanh Hà",
  "CTCP Nội thất Nhật Minh",
  "Công ty TNHH Kinh doanh Minh Hạnh",
  "Công ty TNHH Công nghệ số Anh Tuấn",
  "CTCP Thương mại Cầu Giấy",
  "Công ty TNHH Giải pháp Hiệp Phát",
  "Công ty TNHH Đầu tư Bảo Kim",
  "Công ty TNHH Thương mại Thuận Phát",
  "Công ty TNHH Xây dựng Duy Vinh",
  "CTCP Đầu tư Kiến Quân Việt Nam",
  "Công ty TNHH Việt Hùng",
  "Công ty TNHH Thái Bình",
  "Công ty CP Hoàng Long computer",
  "Khách hàng cá nhân",
  "Công ty TNHH Phát Mai Group",
  "Công ty Cổ phần Minh Quân Logistics",
  "Công ty TNHH Thiết bị Thanh Trúc",
  "CTCP Tư vấn và Dịch vụ Bất động sản Maison",
  "CTCP Vận tải và Thương mại Vạn Phát",
  "Công ty TNHH Truyền thông AZ Việt Nam",
  "Công ty TNHH Dịch vụ Logistics Việt Hưng",
  "Công ty Cổ phần Công nghệ Việt Gia",
  "Công ty TNHH Phát triển Công nghệ KTS",
  "Công ty TNHH Thương mại Máy tính An Lộc",
  "Công ty cổ phần đại lý giao nhận vận tải xếp dỡ tân cảng",
  "Công ty Liên Khương",
  "Công ty Mạnh Thắng",
  "Công ty Thành Đạt",
];
const descriptions: Record<Kind, string[]> = {
  receipt: [
    "Thu tiền bán hàng tháng 12",
    "Khách hàng thanh toán công nợ",
    "Thu tiền bán chứng khoán/thanh lý",
  ],
  payment: [
    "Thanh toán chi phí bảo dưỡng văn phòng",
    "Chi tiền tiếp khách bán hàng",
    "Thanh toán chi phí mua văn phòng phẩm",
  ],
  bank: [
    "Khách hàng chuyển khoản thanh toán",
    "Ủy nhiệm chi trả tiền nhà cung cấp",
    "Báo có thu lãi tiền gửi ngân hàng",
  ],
  purchase: [
    "Mua hàng hóa nhập kho theo PNK",
    "Xuất sử dụng vật tư kỹ thuật",
    "Mua tài sản/CCDC phục vụ quản lý",
  ],
  sale: [
    "Bán hàng hóa theo hóa đơn GTGT",
    "Xuất kho gửi bán đại lý hưởng hoa hồng",
    "Hàng bán bị trả lại giảm trừ doanh thu",
  ],
};
export const seedTransactions: Transaction[] = [
  {
    id: "abc-1",
    company: "abc",
    code: "PXKDL001",
    kind: "sale",
    date: "2026-12-01",
    partner: "Công ty CP Hoàng Long computer",
    description: "Xuất kho gửi bán đại lý Hoàng Long: Laptop Dell Ins 15 & HP 15s (hoa hồng 10%)",
    amount: 280000000,
    status: "posted",
  },
  {
    id: "abc-2",
    company: "abc",
    code: "PNK00060",
    kind: "purchase",
    date: "2026-12-03",
    partner: "Công ty TNHH Phát Mai Group",
    description: "Mua hàng hóa nhập kho (Laptop Dell, HP, Macbook Air) theo PNK số 60",
    amount: 893200000,
    status: "posted",
  },
  {
    id: "abc-3",
    company: "abc",
    code: "UNC00015",
    kind: "bank",
    date: "2026-12-05",
    partner: "Cán bộ công nhân viên",
    description: "Ủy nhiệm chi thanh toán lương tháng 11/N qua Techcombank",
    amount: 154200000,
    status: "posted",
  },
  {
    id: "abc-4",
    company: "abc",
    code: "UNC00016",
    kind: "bank",
    date: "2026-12-05",
    partner: "Cơ quan Bảo hiểm Xã hội",
    description: "Ủy nhiệm chi nộp bảo hiểm xã hội, BHYT, BHTN cho cơ quan BHXH",
    amount: 48600000,
    status: "posted",
  },
  {
    id: "abc-5",
    company: "abc",
    code: "HDBH00080",
    kind: "sale",
    date: "2026-12-05",
    partner: "Công ty TNHH Kinh doanh Minh Hạnh",
    description: "Xuất bán hàng hóa theo PXK số 80 (Laptop Dell, Macbook Air)",
    amount: 474320000,
    status: "posted",
  },
  {
    id: "abc-6",
    company: "abc",
    code: "PXK00081",
    kind: "purchase",
    date: "2026-12-06",
    partner: "Phòng Kỹ thuật",
    description: "Xuất kho vật tư (dây cáp điện, keo dán, vải lau) sử dụng cho phòng kỹ thuật",
    amount: 11000000,
    status: "posted",
  },
  {
    id: "abc-7",
    company: "abc",
    code: "PC00045",
    kind: "payment",
    date: "2026-12-08",
    partner: "Công ty TNHH Thiết bị Thanh Trúc",
    description: "Chi tiền mặt mua văn phòng phẩm dùng cho phòng hành chính",
    amount: 1842500,
    status: "posted",
  },
  {
    id: "abc-8",
    company: "abc",
    code: "PC00046",
    kind: "payment",
    date: "2026-12-09",
    partner: "Phạm Quang Hòa",
    description: "Chi tạm ứng cho nhân viên Phạm Quang Hòa kỹ thuật đi công tác",
    amount: 5000000,
    status: "posted",
  },
  {
    id: "abc-9",
    company: "abc",
    code: "GBC00030",
    kind: "bank",
    date: "2026-12-09",
    partner: "Công ty TNHH Thái Bình",
    description: "Báo có Công ty TNHH Thái Bình ứng trước tiền mua hàng qua ngân hàng",
    amount: 50000000,
    status: "posted",
  },
  {
    id: "abc-10",
    company: "abc",
    code: "GBN00028",
    kind: "bank",
    date: "2026-12-10",
    partner: "Công ty Cổ phần Công nghệ Việt Gia",
    description: "Ủy nhiệm chi mua máy chủ phục vụ quản lý bán hàng",
    amount: 58300000,
    status: "posted",
  },
  {
    id: "abc-11",
    company: "abc",
    code: "GBN00029",
    kind: "bank",
    date: "2026-12-12",
    partner: "Công ty TNHH Thương mại Máy tính An Lộc",
    description: "Ủy nhiệm chi mua máy in về dùng ngay cho phòng kế toán (phân bổ 18 tháng)",
    amount: 6600000,
    status: "posted",
  },
  {
    id: "abc-12",
    company: "abc",
    code: "HDBH00082",
    kind: "sale",
    date: "2026-12-12",
    partner: "Công ty TNHH Thái Bình",
    description: "Bán hàng cho công ty Thái Bình theo PXK số 82 (Laptop Dell, HP, Chuột Dell)",
    amount: 229900000,
    status: "posted",
  },
  {
    id: "abc-13",
    company: "abc",
    code: "PT00032",
    kind: "receipt",
    date: "2026-12-12",
    partner: "Phạm Quang Hòa",
    description: "Nhân viên Phạm Quang Hòa thanh toán tạm ứng (chi 2.300.000đ, nộp quỹ 2.700.000đ)",
    amount: 2700000,
    status: "posted",
  },
  {
    id: "abc-14",
    company: "abc",
    code: "GBN00030",
    kind: "bank",
    date: "2026-12-13",
    partner: "Công ty Thành Đạt",
    description: "Thanh toán nợ cho Công ty Thành Đạt hưởng chiết khấu thanh toán 5% (7.500.000đ)",
    amount: 142500000,
    status: "posted",
  },
  {
    id: "abc-15",
    company: "abc",
    code: "GBC00031",
    kind: "bank",
    date: "2026-12-15",
    partner: "Ngân hàng Techcombank",
    description: "Ngân hàng báo có thu lãi tiền gửi tiết kiệm tháng 11/N",
    amount: 2150000,
    status: "posted",
  },
  {
    id: "abc-16",
    company: "abc",
    code: "HDBH00083",
    kind: "sale",
    date: "2026-12-16",
    partner: "Khách hàng cá nhân",
    description: "Bán hàng cho khách lẻ theo PXK số 83 (Laptop HP 15s) thu tiền ngay qua chuyển khoản",
    amount: 12320000,
    status: "posted",
  },
  {
    id: "abc-17",
    company: "abc",
    code: "PC00047",
    kind: "payment",
    date: "2026-12-16",
    partner: "Nhà hàng Sen Tây Hồ",
    description: "Chi tiền mặt tiếp khách phục vụ hoạt động bán hàng",
    amount: 2420000,
    status: "posted",
  },
  {
    id: "abc-18",
    company: "abc",
    code: "GBC00032",
    kind: "bank",
    date: "2026-12-17",
    partner: "Công ty Cổ phần Chứng khoán SSI",
    description: "Thu tiền bán chứng khoán kinh doanh (giá gốc 50tr, giá bán 55tr)",
    amount: 55000000,
    status: "posted",
  },
  {
    id: "abc-19",
    company: "abc",
    code: "PT00033",
    kind: "receipt",
    date: "2026-12-17",
    partner: "Nguyễn Văn Hùng",
    description: "Thanh lý máy tính xách tay Dell XPS 15 thu bằng tiền mặt",
    amount: 2200000,
    status: "posted",
  },
  {
    id: "abc-20",
    company: "abc",
    code: "GBC00033",
    kind: "bank",
    date: "2026-12-18",
    partner: "Công ty CP Hoàng Long computer",
    description: "Đại lý Hoàng Long chuyển khoản trả tiền bán hàng sau cấn trừ hoa hồng 10%",
    amount: 277200000,
    status: "posted",
  },
  {
    id: "abc-21",
    company: "abc",
    code: "GBN00031",
    kind: "bank",
    date: "2026-12-20",
    partner: "CTCP Vận tải và Thương mại Vạn Phát",
    description: "Ủy nhiệm chi thanh toán nợ cho Công ty Vạn Phát qua Techcombank",
    amount: 12000000,
    status: "posted",
  },
  {
    id: "abc-22",
    company: "abc",
    code: "PC00048",
    kind: "payment",
    date: "2026-12-22",
    partner: "Công ty TNHH Cơ điện Lạnh Daikin",
    description: "Chi tiền mặt thanh toán dịch vụ bảo dưỡng định kỳ máy lạnh Daikin",
    amount: 1320000,
    status: "posted",
  },
  {
    id: "abc-23",
    company: "abc",
    code: "HDBH00085",
    kind: "sale",
    date: "2026-12-22",
    partner: "CTCP Thương mại Cầu Giấy",
    description: "Bán hàng chưa thu tiền cho Cầu Giấy theo PXK 85 (Dell 15c, HP 10c, Màn hình LG 7c)",
    amount: 526460000,
    status: "posted",
  },
  {
    id: "abc-24",
    company: "abc",
    code: "PNK00061",
    kind: "purchase",
    date: "2026-12-23",
    partner: "Công ty TNHH Thiết bị Thanh Trúc",
    description: "Mua hàng nhập kho theo PNK 61 (Laptop Dell, Màn hình LG, Bàn phím, Tai nghe)",
    amount: 388850000,
    status: "posted",
  },
  {
    id: "abc-25",
    company: "abc",
    code: "HDBTL001",
    kind: "sale",
    date: "2026-12-24",
    partner: "CTCP Thương mại Cầu Giấy",
    description: "Khách hàng Cầu Giấy trả lại sản phẩm màn hình bị cháy theo biên bản",
    amount: 8580000,
    status: "posted",
  },
  {
    id: "abc-26",
    company: "abc",
    code: "BBGG001",
    kind: "purchase",
    date: "2026-12-26",
    partner: "Công ty TNHH Thiết bị Thanh Trúc",
    description: "Thỏa thuận giảm giá 10% hàng mua ngày 23/12 bị lỗi với NCC Thanh Trúc",
    amount: 858000,
    status: "posted",
  },
  {
    id: "abc-27",
    company: "abc",
    code: "PXK00086",
    kind: "purchase",
    date: "2026-12-29",
    partner: "Phòng Kế toán",
    description: "Xuất kho ghế xoay và bàn làm việc cho phòng kế toán (phân bổ 1 lần)",
    amount: 4100000,
    status: "posted",
  },
  {
    id: "abc-28",
    company: "abc",
    code: "PKT00001",
    kind: "payment",
    date: "2026-12-31",
    partner: "Cán bộ công nhân viên",
    description: "Trích lập bảng tính lương và các khoản trích theo lương tháng 12/N",
    amount: 168500000,
    status: "posted",
  },
  {
    id: "abc-29",
    company: "abc",
    code: "PKT00002",
    kind: "payment",
    date: "2026-12-31",
    partner: "Phân bổ CCDC",
    description: "Phân bổ chi phí công cụ dụng cụ xuất dùng tính vào chi phí tháng 12",
    amount: 18450000,
    status: "posted",
  },
  {
    id: "abc-30",
    company: "abc",
    code: "PKT00003",
    kind: "payment",
    date: "2026-12-31",
    partner: "Khấu hao TSCĐ",
    description: "Tính và phân bổ chi phí khấu hao tài sản cố định tháng 12",
    amount: 13600000,
    status: "posted",
  },
  {
    id: "abc-31",
    company: "abc",
    code: "PKT00004",
    kind: "receipt",
    date: "2026-12-31",
    partner: "Cơ quan Thuế",
    description: "Khấu trừ và xác định thuế GTGT được khấu trừ và phải nộp tháng 12",
    amount: 128537500,
    status: "posted",
  },
  {
    id: "abc-32",
    company: "abc",
    code: "PKT00005",
    kind: "sale",
    date: "2026-12-31",
    partner: "Kết chuyển KQKD",
    description: "Kết chuyển doanh thu, chi phí xác định kết quả kinh doanh năm N",
    amount: 1400000000,
    status: "posted",
  },
];
const storageKey = "abc-tmdv-real-data-tt99-v1";
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
