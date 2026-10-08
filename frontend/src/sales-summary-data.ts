export const SALES_SUMMARY_TITLES = {
  items: "Tổng hợp bán hàng theo mặt hàng",
  customers: "Tổng hợp bán hàng theo khách hàng",
  itemsCustomers: "Tổng hợp bán hàng theo mặt hàng và khách hàng",
} as const;
export type SalesSummaryType = keyof typeof SALES_SUMMARY_TITLES;
export interface SalesRow {
  date: string;
  item: string;
  itemName: string;
  itemGroup: string;
  customer: string;
  customerName: string;
  customerGroup: string;
  employee: string;
  unit: string;
  measure: string;
  quantity: number;
  sales: number;
  discount: number;
  returnedQuantity: number;
  returnedValue: number;
  reduction: number;
  cost: number;
}
export interface SalesFilters {
  from: string;
  to: string;
  items: string[];
  customers: string[];
  itemGroup: string;
  customerGroup: string;
  employee: string;
  unit: string;
  onlyActive: boolean;
}
export const SALES_SAMPLE_ROWS: SalesRow[] = [
  {
    date: "2026-10-06",
    item: "HH001",
    itemName: "Màn hình LG 24 inch",
    itemGroup: "Thiết bị",
    customer: "KH001",
    customerName: "Công ty TNHH Hoàng Minh",
    customerGroup: "Doanh nghiệp",
    employee: "NV001",
    unit: "Trụ sở chính",
    measure: "Chiếc",
    quantity: 5,
    sales: 20000000,
    discount: 500000,
    returnedQuantity: 1,
    returnedValue: 4000000,
    reduction: 100000,
    cost: 12000000,
  },
  {
    date: "2026-10-12",
    item: "HH002",
    itemName: "Giấy A4",
    itemGroup: "Văn phòng",
    customer: "KH002",
    customerName: "Nguyễn Văn An",
    customerGroup: "Cá nhân",
    employee: "NV002",
    unit: "Chi nhánh TP. Hồ Chí Minh",
    measure: "Thùng",
    quantity: 10,
    sales: 6000000,
    discount: 0,
    returnedQuantity: 0,
    returnedValue: 0,
    reduction: 0,
    cost: 4000000,
  },
];
export function salesSummaryRows(
  data: SalesRow[],
  filters: SalesFilters,
  type: SalesSummaryType,
) {
  const groups = new Map<string, SalesRow>();
  const eligible = data.filter(
    (row) =>
      row.date >= filters.from &&
      row.date <= filters.to &&
      filters.items.includes(row.item) &&
      filters.customers.includes(row.customer) &&
      (!filters.itemGroup || filters.itemGroup === row.itemGroup) &&
      (!filters.customerGroup || filters.customerGroup === row.customerGroup) &&
      (!filters.employee || filters.employee === row.employee) &&
      (!filters.unit || filters.unit === row.unit),
  );
  for (const row of eligible) {
    const key =
      type === "items"
        ? `${row.item}:${row.measure}`
        : type === "customers"
          ? row.customer
          : `${row.item}:${row.customer}:${row.measure}`;
    const previous = groups.get(key);
    groups.set(
      key,
      previous
        ? {
            ...previous,
            quantity: previous.quantity + row.quantity,
            sales: previous.sales + row.sales,
            discount: previous.discount + row.discount,
            returnedQuantity: previous.returnedQuantity + row.returnedQuantity,
            returnedValue: previous.returnedValue + row.returnedValue,
            reduction: previous.reduction + row.reduction,
            cost: previous.cost + row.cost,
          }
        : { ...row },
    );
  }
  const result = [...groups.values()].map((row) => {
    const net = row.sales - row.discount - row.returnedValue - row.reduction;
    const profit = net - row.cost;
    return { ...row, net, profit, ratio: net ? (profit / net) * 100 : 0 };
  });
  if (type === "customers" && !filters.onlyActive) {
    const customers = [
      ...new Map(data.map((row) => [row.customer, row])).values(),
    ];
    for (const row of customers) {
      if (
        !filters.customers.includes(row.customer) ||
        result.some((current) => current.customer === row.customer) ||
        (filters.customerGroup && row.customerGroup !== filters.customerGroup)
      )
        continue;
      result.push({
        ...row,
        quantity: 0,
        sales: 0,
        discount: 0,
        returnedQuantity: 0,
        returnedValue: 0,
        reduction: 0,
        cost: 0,
        net: 0,
        profit: 0,
        ratio: 0,
      });
    }
  }
  return result;
}
