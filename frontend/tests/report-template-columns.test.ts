import { test } from "node:test";
import assert from "node:assert/strict";
import { templateColumnLabels } from "../src/report-template-columns.ts";

test("opening and closing debit/credit columns remain independently selectable", () => {
  const labels = templateColumnLabels([
    [
      { text: "Đầu kỳ", colSpan: 2, rowSpan: 1 },
      { text: "Cuối kỳ", colSpan: 2, rowSpan: 1 },
    ],
    ["Nợ", "Có", "Nợ", "Có"].map((text) => ({ text, colSpan: 1, rowSpan: 1 })),
  ]);
  assert.deepEqual(labels, [
    "Đầu kỳ / Nợ",
    "Đầu kỳ / Có",
    "Cuối kỳ / Nợ",
    "Cuối kỳ / Có",
  ]);
  assert.equal(new Set(labels).size, 4);
});

test("ordinary labels stay compatible with existing column selections", () => {
  assert.deepEqual(
    templateColumnLabels([[{ text: "Mã hàng", colSpan: 1, rowSpan: 1 }]]),
    ["Mã hàng"],
  );
});

test("unnamed account slots in printed journals retain separate column choices", () => {
  const labels = templateColumnLabels([
    [{ text: "Ghi có các TK", colSpan: 4, rowSpan: 1 }],
    Array.from({ length: 4 }, () => ({
      text: ".....",
      colSpan: 1,
      rowSpan: 1,
    })),
  ]);
  assert.deepEqual(labels, [
    "Ghi có các TK / ..... (1)",
    "Ghi có các TK / ..... (2)",
    "Ghi có các TK / ..... (3)",
    "Ghi có các TK / ..... (4)",
  ]);
});

test("audited template labels can name grouped leaves differently from their table headings", () => {
  assert.deepEqual(templateColumnLabels([], ["Dư Nợ đầu kỳ", "Dư Có đầu kỳ"]), [
    "Dư Nợ đầu kỳ",
    "Dư Có đầu kỳ",
  ]);
});
