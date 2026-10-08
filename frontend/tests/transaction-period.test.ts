import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesTransactionPeriod } from "../src/transaction-period.ts";
test("cash and bank periods include only dates in the chosen range", () => {
  const now = new Date(2026, 9, 8);
  assert.equal(matchesTransactionPeriod("2026-09-03", "ytd", now), true);
  assert.equal(matchesTransactionPeriod("2026-09-03", "month", now), false);
  assert.equal(matchesTransactionPeriod("01/10/2026", "quarter", now), true);
  assert.equal(matchesTransactionPeriod("09/10/2026", "ytd", now), false);
  assert.equal(matchesTransactionPeriod("31/02/2026", "year", now), false);
  assert.equal(matchesTransactionPeriod("01/01/2025", "year", now), false);
});
