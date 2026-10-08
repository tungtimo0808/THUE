import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contractPeriodRange,
  filterContractRows,
  summarizeContractRows,
  contractLedgerRows,
  CONTRACT_SAMPLE_ROWS,
} from "../src/purchase-contract-data.ts";

test("period ranges respect leap years and quarter boundaries", () => {
  assert.deepEqual(contractPeriodRange("Tháng này", new Date(2024, 1, 15)), [
    "2024-02-01",
    "2024-02-29",
  ]);
  assert.deepEqual(contractPeriodRange("Quý trước", new Date(2026, 0, 8)), [
    "2025-10-01",
    "2025-12-31",
  ]);
});

test("detailed balances stay separate for each supplier and contract", () => {
  const rows = contractLedgerRows(CONTRACT_SAMPLE_ROWS, "2026-10-01", false);
  assert.equal(rows[0].balance, -15000000);
  assert.equal(rows[1].balance, -10000000);
});

test("combining identical postings preserves balances and totals", () => {
  const rows = contractLedgerRows(
    [CONTRACT_SAMPLE_ROWS[0], { ...CONTRACT_SAMPLE_ROWS[0] }],
    "2026-10-01",
    true,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].credit, 30000000);
  assert.equal(rows[0].balance, -30000000);
});

test("filters combine dates, suppliers, contracts and account", () => {
  const filters = {
    from: "2026-10-01",
    to: "2026-10-31",
    suppliers: ["NCC001"],
    contracts: ["HDM001"],
    items: ["HH001"],
    account: "331",
    employee: "",
    supplierGroup: "",
    itemGroup: "",
  };
  const rows = filterContractRows(CONTRACT_SAMPLE_ROWS, filters);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].contract, "HDM001");
  assert.equal(
    filterContractRows(CONTRACT_SAMPLE_ROWS, { ...filters, suppliers: [] })
      .length,
    0,
  );
  assert.equal(
    filterContractRows(CONTRACT_SAMPLE_ROWS, { ...filters, account: "131" })
      .length,
    0,
  );
});

test("opening balances include transactions before the selected period", () => {
  const rows = [
    { ...CONTRACT_SAMPLE_ROWS[0], date: "2026-09-15", debit: 0, credit: 100 },
    { ...CONTRACT_SAMPLE_ROWS[0], date: "2026-10-15", debit: 40, credit: 0 },
  ];
  const result = summarizeContractRows(rows, "2026-10-01", "2026-10-31");
  assert.equal(result[0].openingCredit, 100);
  assert.equal(result[0].debit, 40);
  assert.equal(result[0].closingCredit, 60);
});
