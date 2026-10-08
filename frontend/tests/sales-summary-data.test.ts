import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SALES_SAMPLE_ROWS,
  salesSummaryRows,
  type SalesFilters,
} from "../src/sales-summary-data.ts";
const filters: SalesFilters = {
  from: "2026-10-01",
  to: "2026-10-31",
  items: ["HH001", "HH002"],
  customers: ["KH001", "KH002"],
  itemGroup: "",
  customerGroup: "",
  employee: "",
  unit: "",
  onlyActive: true,
};
test("sales net revenue subtracts discounts, returns and reductions", () => {
  const result = salesSummaryRows(SALES_SAMPLE_ROWS, filters, "items");
  assert.equal(
    result[0].net,
    result[0].sales -
      result[0].discount -
      result[0].returnedValue -
      result[0].reduction,
  );
  assert.equal(result[0].profit, result[0].net - result[0].cost);
  assert.equal(
    result[0].ratio,
    result[0].net ? (result[0].profit / result[0].net) * 100 : 0,
  );
});
test("combined reports keep item and customer groups separate", () => {
  const data = [
    SALES_SAMPLE_ROWS[0],
    {
      ...SALES_SAMPLE_ROWS[0],
      customer: "KH002",
      customerName: "Khách hàng mẫu 2",
    },
  ];
  assert.equal(salesSummaryRows(data, filters, "items").length, 1);
  assert.equal(salesSummaryRows(data, filters, "itemsCustomers").length, 2);
  assert.equal(
    salesSummaryRows(data, { ...filters, customers: ["KH002"] }, "customers")
      .length,
    1,
  );
  assert.equal(
    salesSummaryRows(
      data,
      { ...filters, from: "2026-11-01", to: "2026-11-30" },
      "customers",
    ).length,
    0,
  );
});
