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
  "Công ty cổ phần đầu tư thương mại và dịch vụ quốc tế",
  "Công ty Liên Khương",
  "Công ty Mạnh Thắng",
  "Công ty TNHH Thành Đạt",
  "Công ty TNHH Phan Minh",
  "CÔNG TY CỔ PHẦN VĂN PHÒNG PHẨM AN TÂM",
  "CTCP THƯƠNG MẠI BÌNH PHÁT",
  "CÔNG TY CỔ PHẦN ĐẦU TƯ GIANG MỸ",
  "Chi cục Thuế Hoàn Kiếm",
  "Bảo hiểm xã hội Hoàn Kiếm",
  "Kho bạc nhà nước Hoàn Kiếm",
  "Tổng công ty Điện lực TP. Hà Nội",
  "Công ty CP SXKD Nước sạch Số 3 Hà Nội",
  "Phạm Đình Tài",
  "Lê Văn Hiếu",
  "Hoàng Bá Cung",
  "Phạm Quang Hòa",
  "Đặng Thuận",
];
export const seedTransactions: Transaction[] = [
  {
    id: "abc-1",
    company: "abc",
    code: "PXKDL001",
    kind: "sale",
    date: "2026-12-01",
    partner: "Công ty CP Hoàng Long computer",
    description: "Xuất kho gửi bán đại lý Hoàng Long theo PXK 79: Laptop Dell Ins 15 (10c) & HP 15s (10c)",
    amount: 200000000,
    status: "posted",
  },
  {
    id: "abc-2",
    company: "abc",
    code: "PNK00060",
    kind: "purchase",
    date: "2026-12-03",
    partner: "CTCP Vận tải và Thương mại Vạn Phát",
    description: "Mua hàng hóa nhập kho (Laptop Dell 25c, HP 15s 20c, Macbook Air M3 18c) theo PNK 60, HĐ 120",
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
    description: "Giấy báo nợ FT25339791951533 thanh toán tiền lương tháng 11/N cho nhân viên qua Techcombank",
    amount: 250600000,
    status: "posted",
  },
  {
    id: "abc-4",
    company: "abc",
    code: "UNC00016",
    kind: "bank",
    date: "2026-12-05",
    partner: "Bảo hiểm xã hội Hoàn Kiếm",
    description: "Giấy báo nợ FT25339791951534 nộp bảo hiểm tháng 11/N cho cơ quan BHXH Hoàn Kiếm",
    amount: 30500000,
    status: "posted",
  },
  {
    id: "abc-5",
    company: "abc",
    code: "HDBH00080",
    kind: "sale",
    date: "2026-12-05",
    partner: "Công ty TNHH Kinh doanh Minh Hạnh",
    description: "Bán hàng hóa theo PXK 80, HĐ 152 (Dell 10c, Macbook Air M3 10c) thu ngay bằng TGNH",
    amount: 474320000,
    status: "posted",
  },
  {
    id: "abc-6",
    company: "abc",
    code: "PXK00081",
    kind: "purchase",
    date: "2026-12-06",
    partner: "Đặng Thuận - Phòng Kỹ thuật",
    description: "Xuất kho vật tư theo PXK 81 (2 cuộn dây cáp điện, 1 lọ keo dán đa năng) cho phòng kỹ thuật",
    amount: 3020000,
    status: "posted",
  },
  {
    id: "abc-7",
    company: "abc",
    code: "PC00045",
    kind: "payment",
    date: "2026-12-08",
    partner: "CÔNG TY CỔ PHẦN VĂN PHÒNG PHẨM AN TÂM",
    description: "Chi tiền mặt PC 180 mua văn phòng phẩm theo HĐ 320 dùng cho phòng hành chính",
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
    description: "Phiếu chi PC 181 tạm ứng tiền công tác cho nhân viên Phạm Quang Hòa - Phòng kỹ thuật",
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
    description: "Giấy báo có FT25339791951600 Công ty TNHH Thái Bình ứng trước tiền mua hàng qua Techcombank",
    amount: 100000000,
    status: "posted",
  },
  {
    id: "abc-10",
    company: "abc",
    code: "GBN00028",
    kind: "bank",
    date: "2026-12-10",
    partner: "Công ty TNHH Thành Đạt",
    description: "Giấy báo nợ FT25339791951625 mua máy chủ Dell PowerEdge R350 theo HĐ 145 từ Công ty TNHH Thành Đạt",
    amount: 58300000,
    status: "posted",
  },
  {
    id: "abc-11",
    company: "abc",
    code: "GBN00029",
    kind: "bank",
    date: "2026-12-12",
    partner: "CTCP THƯƠNG MẠI BÌNH PHÁT",
    description: "Giấy báo nợ FT25339791951650 mua máy in Canon imageCLASS MF275dw theo HĐ 120 (phân bổ 18 tháng)",
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
    description: "Bán hàng cho Công ty TNHH Thái Bình theo PXK 82, HĐ 153 (Dell 7c, HP 15s 7c, Chuột Dell 20c)",
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
    description: "Quyết toán tạm ứng công tác phí Phạm Quang Hòa (chi 2.300.000đ, thu hoàn quỹ PT 185: 2.700.000đ)",
    amount: 2700000,
    status: "posted",
  },
  {
    id: "abc-14",
    company: "abc",
    code: "GBN00030",
    kind: "bank",
    date: "2026-12-13",
    partner: "Công ty TNHH Thành Đạt",
    description: "Thanh toán HĐ 140 (100tr) cho Công ty TNHH Thành Đạt, chiết khấu thanh toán 5% (5tr), thực chuyển 95tr",
    amount: 95000000,
    status: "posted",
  },
  {
    id: "abc-15",
    company: "abc",
    code: "GBC00031",
    kind: "bank",
    date: "2026-12-15",
    partner: "Ngân hàng Techcombank",
    description: "Giấy báo có FT25339791951720 Ngân hàng Techcombank trả lãi tiền gửi tháng 11/N",
    amount: 1500000,
    status: "posted",
  },
  {
    id: "abc-16",
    company: "abc",
    code: "HDBH00083",
    kind: "sale",
    date: "2026-12-16",
    partner: "Khách hàng cá nhân",
    description: "Bán lẻ 01 Laptop HP 15s cho Trương Minh Tuấn theo PXK 83, HĐ 154 thu ngay qua chuyển khoản",
    amount: 12320000,
    status: "posted",
  },
  {
    id: "abc-17",
    company: "abc",
    code: "PC00047",
    kind: "payment",
    date: "2026-12-16",
    partner: "CÔNG TY CỔ PHẦN ĐẦU TƯ GIANG MỸ",
    description: "Phiếu chi PC 182 chi tiền mặt tiếp khách theo HĐ 420 của CTCP Đầu tư Giang Mỹ",
    amount: 2420000,
    status: "posted",
  },
  {
    id: "abc-18",
    company: "abc",
    code: "GBC00032",
    kind: "bank",
    date: "2026-12-17",
    partner: "Ngân hàng Techcombank",
    description: "Giấy báo có FT25339791951795 thu tiền bán chứng khoán kinh doanh (giá gốc 50tr, giá bán 60tr)",
    amount: 60000000,
    status: "posted",
  },
  {
    id: "abc-19",
    company: "abc",
    code: "PT00033",
    kind: "receipt",
    date: "2026-12-17",
    partner: "Công ty TNHH Công nghệ số Anh Tuấn",
    description: "Thanh lý máy tính xách tay Dell XPS 15 theo HĐ 155, thu bằng tiền mặt PT 186",
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
    description: "Đại lý Hoàng Long chuyển khoản trả tiền bán hàng (HĐ 156) sau cấn trừ hoa hồng 10% (HĐ 89)",
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
    description: "Giấy báo nợ FT25339791951886 thanh toán 50% HĐ 120 ngày 03/12 cho Công ty Vạn Phát",
    amount: 446600000,
    status: "posted",
  },
  {
    id: "abc-22",
    company: "abc",
    code: "PC00048",
    kind: "payment",
    date: "2026-12-22",
    partner: "Công ty TNHH Thiết bị Thanh Trúc",
    description: "Phiếu chi PC 183 thanh toán dịch vụ bảo dưỡng máy lạnh Daikin theo HĐ 189 của Công ty Thanh Trúc",
    amount: 1320000,
    status: "posted",
  },
  {
    id: "abc-23",
    company: "abc",
    code: "HDBH00085",
    kind: "sale",
    date: "2026-12-22",
    partner: "Công ty TNHH Phan Minh",
    description: "Bán hàng chưa thu tiền cho Công ty TNHH Phan Minh theo PXK 85, HĐ 157 (Dell 15c, HP 15s 15c, LG 5c, Bàn phím 5c, Tai nghe 5c)",
    amount: 526460000,
    status: "posted",
  },
  {
    id: "abc-24",
    company: "abc",
    code: "PNK00061",
    kind: "purchase",
    date: "2026-12-23",
    partner: "Công ty TNHH Thành Đạt",
    description: "Mua hàng nhập kho theo PNK 61, HĐ 150 từ Công ty TNHH Thành Đạt (Dell 15c, HP 15c, LG 10c + vận chuyển)",
    amount: 388850000,
    status: "posted",
  },
  {
    id: "abc-25",
    company: "abc",
    code: "HDBTL001",
    kind: "sale",
    date: "2026-12-24",
    partner: "Công ty TNHH Phan Minh",
    description: "Công ty TNHH Phan Minh trả lại 01 Màn hình LG 27UL500 bị cháy theo BBTH 10/BBTH, HĐ 158, PNK 62",
    amount: 8580000,
    status: "posted",
  },
  {
    id: "abc-26",
    company: "abc",
    code: "BBGG001",
    kind: "purchase",
    date: "2026-12-26",
    partner: "Công ty TNHH Thành Đạt",
    description: "Giảm giá 02 chiếc Laptop HP 15s (500.000đ/chiếc) mua ngày 23/12 theo HĐ điều chỉnh giảm số 160",
    amount: 1100000,
    status: "posted",
  },
  {
    id: "abc-27",
    company: "abc",
    code: "PXK00086",
    kind: "purchase",
    date: "2026-12-29",
    partner: "Phòng Kế toán",
    description: "Xuất kho 02 ghế xoay và 01 bàn làm việc theo PXK 86 cho phòng kế toán (phân bổ 1 lần)",
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
    description: "Hạch toán bảng tính lương (80.260.000đ) và các khoản trích theo lương tính vào CP (14.512.500đ) tháng 12/N",
    amount: 94772500,
    status: "posted",
  },
  {
    id: "abc-29",
    company: "abc",
    code: "PKT00002",
    kind: "payment",
    date: "2026-12-31",
    partner: "Phân bổ CCDC",
    description: "Phân bổ chi phí công cụ dụng cụ tháng 12/N (7 mã CCDC: TK 6413 400.000đ, TK 6423 2.603.333đ)",
    amount: 3003333,
    status: "posted",
  },
  {
    id: "abc-30",
    company: "abc",
    code: "PKT00003",
    kind: "payment",
    date: "2026-12-31",
    partner: "Khấu hao TSCĐ",
    description: "Tính và phân bổ chi phí khấu hao TSCĐ tháng 12/N (8 TSCĐ: TK 6414 1.060.887đ, TK 6424 14.844.713đ)",
    amount: 15905600,
    status: "posted",
  },
  {
    id: "abc-31",
    company: "abc",
    code: "PKT00004",
    kind: "receipt",
    date: "2026-12-31",
    partner: "Chi cục Thuế Hoàn Kiếm",
    description: "Khấu trừ và xác định thuế GTGT được khấu trừ và phải nộp tháng 12/N",
    amount: 125657500,
    status: "posted",
  },
  {
    id: "abc-32",
    company: "abc",
    code: "PKT00005",
    kind: "sale",
    date: "2026-12-31",
    partner: "Kết chuyển KQKD",
    description: "Kết chuyển doanh thu, chi phí xác định kết quả kinh doanh tháng 12/N",
    amount: 1402200000,
    status: "posted",
  },
];
const storageKey = "abc-tmdv-real-data-tt99-v2";
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
