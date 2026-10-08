import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeReportHeaders,
  reportColumns,
  canonicalReportName,
} from "../src/audited-report-schema.ts";
import {
  auditedPeriodRange,
  isAuditedParameters,
} from "../src/audited-report-parameters.ts";

test("saved report parameters reject malformed browser storage", () => {
  const valid = {
    fields: { Năm: "2026" },
    selected: { "0": ["1"] },
    checks: { Total: true },
    radio: "",
  };
  assert.equal(isAuditedParameters(valid), true);
  assert.equal(isAuditedParameters({ ...valid, fields: null }), false);
  assert.equal(
    isAuditedParameters({ ...valid, selected: { "0": null } }),
    false,
  );
  assert.equal(
    isAuditedParameters({ ...valid, checks: { Total: "true" } }),
    false,
  );
});

test("fixed-column clones do not duplicate grouped report headers", () => {
  const headers = normalizeReportHeaders([
    [
      { text: "Tên khách hàng", colSpan: 1, rowSpan: 2 },
      { text: "Phát sinh", colSpan: 2, rowSpan: 1 },
    ],
    [
      { text: "Tên khách hàng", colSpan: 1, rowSpan: 1 },
      { text: "Nợ", colSpan: 1, rowSpan: 1 },
      { text: "Có", colSpan: 1, rowSpan: 1 },
    ],
  ]);
  assert.deepEqual(
    headers[1].map((cell) => cell.text),
    ["Nợ", "Có"],
  );
  assert.deepEqual(
    reportColumns(headers).map((column) => column.path),
    ["Tên khách hàng", "Phát sinh / Nợ", "Phát sinh / Có"],
  );
});

test("MISA periods handle week, semester and explicit quarter choices", () => {
  const today = new Date(2026, 9, 8);
  assert.deepEqual(auditedPeriodRange("Tuần này", today), [
    "2026-10-05",
    "2026-10-11",
  ]);
  assert.deepEqual(auditedPeriodRange("Đầu quý đến hiện tại", today), [
    "2026-10-01",
    "2026-10-08",
  ]);
  assert.deepEqual(auditedPeriodRange("Sáu tháng đầu năm", today), [
    "2026-01-01",
    "2026-06-30",
  ]);
  assert.deepEqual(auditedPeriodRange("Quý 2", today), [
    "2026-04-01",
    "2026-06-30",
  ]);
  assert.deepEqual(auditedPeriodRange("Tháng 2", new Date(2024, 9, 8)), [
    "2024-02-01",
    "2024-02-29",
  ]);
});

test("simple cloned headers collapse to a single row", () => {
  const headers = normalizeReportHeaders([
    [{ text: "Ngày chứng từ", colSpan: 1, rowSpan: 2 }],
    [{ text: "Ngày chứng từ", colSpan: 1, rowSpan: 1 }],
  ]);
  assert.equal(headers.length, 1);
  assert.equal(headers[0][0].rowSpan, 1);
});

test("legacy catalogue aliases resolve without deleting old names", () => {
  assert.equal(
    canonicalReportName("S35 - DN: Số chi tiết bán hàng"),
    canonicalReportName("S35-DN: Sổ chi tiết bán hàng"),
  );
  assert.equal(
    canonicalReportName("Chi tiết công nợ phải thu theo mặt hàng (tỉnh)"),
    canonicalReportName("Chi tiết công nợ phải thu theo mặt hàng (tĩnh)"),
  );
});
