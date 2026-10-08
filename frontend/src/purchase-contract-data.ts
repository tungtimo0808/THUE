export type ContractReportType = "summary" | "execution" | "detail";
export const CONTRACT_REPORT_TITLES = {
  summary: "Tổng hợp công nợ phải trả theo hợp đồng mua",
  execution: "Tình hình thực hiện hợp đồng mua",
  detail: "Chi tiết công nợ phải trả theo hợp đồng mua",
} as const;
export interface ContractRow {
  supplier: string;
  supplierName: string;
  supplierGroup: string;
  contract: string;
  signed: string;
  due: string;
  date: string;
  voucher: string;
  item: string;
  itemName: string;
  itemGroup: string;
  unit: string;
  employee: string;
  quantity: number;
  received: number;
  value: number;
  completedValue: number;
  account: string;
  counterpart: string;
  debit: number;
  credit: number;
  description: string;
}
// Frontend fixtures only; independent of the MISA account's business records.
export const CONTRACT_SAMPLE_ROWS: ContractRow[] = [
  {
    supplier: "NCC001",
    supplierName: "Công ty TNHH Thiết bị Minh An",
    supplierGroup: "Thiết bị",
    contract: "HDM001",
    signed: "2026-10-02",
    due: "2026-10-25",
    date: "2026-10-06",
    voucher: "MH001",
    item: "HH001",
    itemName: "Màn hình LG 24 inch",
    itemGroup: "Thiết bị",
    unit: "Chiếc",
    employee: "NV001",
    quantity: 10,
    received: 5,
    value: 30000000,
    completedValue: 15000000,
    account: "331",
    counterpart: "156",
    debit: 0,
    credit: 15000000,
    description: "Mua thiết bị theo hợp đồng HDM001",
  },
  {
    supplier: "NCC002",
    supplierName: "Công ty CP Văn phòng An Phát",
    supplierGroup: "Văn phòng",
    contract: "HDM002",
    signed: "2026-09-15",
    due: "2026-10-15",
    date: "2026-10-12",
    voucher: "MH002",
    item: "HH002",
    itemName: "Giấy A4",
    itemGroup: "Văn phòng",
    unit: "Thùng",
    employee: "NV002",
    quantity: 20,
    received: 20,
    value: 10000000,
    completedValue: 10000000,
    account: "331",
    counterpart: "156",
    debit: 0,
    credit: 10000000,
    description: "Mua văn phòng phẩm theo hợp đồng HDM002",
  },
];
export interface ContractFilters {
  from: string;
  to: string;
  suppliers: string[];
  contracts: string[];
  items: string[];
  account: string;
  employee: string;
  supplierGroup: string;
  itemGroup: string;
}
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function contractPeriodRange(
  period: string,
  today = new Date(),
): [string, string] {
  const year = today.getFullYear(),
    month = today.getMonth();
  let start: Date, end: Date;
  switch (period) {
    case "Tháng trước":
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0);
      break;
    case "Quý này":
      start = new Date(year, Math.floor(month / 3) * 3, 1);
      end = new Date(year, Math.floor(month / 3) * 3 + 3, 0);
      break;
    case "Quý trước":
      start = new Date(year, Math.floor(month / 3) * 3 - 3, 1);
      end = new Date(year, Math.floor(month / 3) * 3, 0);
      break;
    case "Năm nay":
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      break;
    case "Năm trước":
      start = new Date(year - 1, 0, 1);
      end = new Date(year - 1, 11, 31);
      break;
    default:
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
  }
  return [isoDate(start), isoDate(end)];
}
export function filterContractRows(
  rows: ContractRow[],
  filters: ContractFilters,
  includeOpening = false,
) {
  return rows.filter(
    (row) =>
      (includeOpening || row.date >= filters.from) &&
      row.date <= filters.to &&
      filters.suppliers.includes(row.supplier) &&
      filters.contracts.includes(row.contract) &&
      filters.items.includes(row.item) &&
      (!filters.account || row.account === filters.account) &&
      (!filters.employee || row.employee === filters.employee) &&
      (!filters.supplierGroup || row.supplierGroup === filters.supplierGroup) &&
      (!filters.itemGroup || row.itemGroup === filters.itemGroup),
  );
}
export function summarizeContractRows(
  rows: ContractRow[],
  from: string,
  to: string,
) {
  const groups = new Map<
    string,
    {
      supplier: string;
      supplierName: string;
      account: string;
      opening: number;
      debit: number;
      credit: number;
    }
  >();
  for (const row of rows) {
    if (row.date > to) continue;
    const key = `${row.supplier}:${row.account}`;
    const group = groups.get(key) ?? {
      supplier: row.supplier,
      supplierName: row.supplierName,
      account: row.account,
      opening: 0,
      debit: 0,
      credit: 0,
    };
    if (row.date < from) group.opening += row.debit - row.credit;
    else {
      group.debit += row.debit;
      group.credit += row.credit;
    }
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const closing = group.opening + group.debit - group.credit;
    return {
      ...group,
      openingDebit: Math.max(group.opening, 0),
      openingCredit: Math.max(-group.opening, 0),
      closingDebit: Math.max(closing, 0),
      closingCredit: Math.max(-closing, 0),
    };
  });
}
export function contractLedgerRows(
  rows: ContractRow[],
  from: string,
  combine: boolean,
) {
  const balanceKey = (row: ContractRow) =>
    `${row.supplier}:${row.contract}:${row.account}`;
  const balances = new Map<string, number>();
  rows
    .filter((row) => row.date < from)
    .forEach((row) =>
      balances.set(
        balanceKey(row),
        (balances.get(balanceKey(row)) ?? 0) + row.debit - row.credit,
      ),
    );
  const grouped = new Map<string, ContractRow>();
  rows
    .filter((row) => row.date >= from)
    .forEach((row) => {
      const key = combine
        ? [
            balanceKey(row),
            row.date,
            row.voucher,
            row.description,
            row.counterpart,
          ].join("|")
        : `${grouped.size}`;
      const previous = grouped.get(key);
      grouped.set(
        key,
        previous
          ? {
              ...previous,
              debit: previous.debit + row.debit,
              credit: previous.credit + row.credit,
            }
          : row,
      );
    });
  return [...grouped.values()]
    .sort(
      (a, b) =>
        balanceKey(a).localeCompare(balanceKey(b)) ||
        a.date.localeCompare(b.date),
    )
    .map((row) => {
      const balance =
        (balances.get(balanceKey(row)) ?? 0) + row.debit - row.credit;
      balances.set(balanceKey(row), balance);
      return { ...row, balance };
    });
}
