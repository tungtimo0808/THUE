import { test } from "node:test";
import assert from "node:assert/strict";
import { reconciliationAmounts } from "../src/bank-reconciliation.ts";
test("bank reconciliation uses only checked transactions and preserves signed differences", () => {
  const rows = [
    {
      id: "1",
      code: "BC1",
      dateHachToan: "01/09/2026",
      kind: "receipt",
      amount: 100,
      partner: "",
    },
    {
      id: "2",
      code: "UNC1",
      dateHachToan: "02/09/2026",
      kind: "payment",
      amount: 40,
      partner: "",
    },
  ];
  assert.deepEqual(reconciliationAmounts(rows, ["1", "2"], 10, 80), {
    opening: 10,
    receipts: 100,
    payments: 40,
    closing: 70,
    statement: 80,
    difference: -10,
  });
  assert.equal(reconciliationAmounts(rows, ["2"], 10, 0).closing, -30);
  assert.equal(reconciliationAmounts(rows, [], 10, 10).difference, 0);
});
