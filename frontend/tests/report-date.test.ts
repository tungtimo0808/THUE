import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReportDate } from "../src/report-date.ts";
test("report date entry uses day/month/year and rejects impossible dates", () => {
  assert.equal(parseReportDate("08/10/2026"), "2026-10-08");
  assert.equal(parseReportDate("29/02/2024"), "2024-02-29");
  assert.equal(parseReportDate("29/02/2026"), "");
  assert.equal(parseReportDate("31/04/2026"), "");
  assert.equal(parseReportDate("2026-11-01"), "2026-11-01");
  assert.equal(parseReportDate(""), "");
});
