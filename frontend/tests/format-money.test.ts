import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMoneyInput,
  parseMoneyInput,
  parseMoneyInputString,
  toMoneyNumber,
} from "../src/formatMoney.ts";

function simulateTypingDigits(sequence: string): { numeric: number; displayed: string }[] {
  let current = "";
  const steps: { numeric: number; displayed: string }[] = [];
  for (const ch of sequence) {
    const rawFromDom = `${current}${ch}`;
    const parsed = parseMoneyInputString(rawFromDom);
    current = formatMoneyInput(parsed);
    steps.push({ numeric: parseMoneyInput(rawFromDom), displayed: current });
  }
  return steps;
}

test("typing consecutive zeros such as 730000 and 1000000 preserves every zero", () => {
  const steps730k = simulateTypingDigits("73000000");
  assert.deepEqual(
    steps730k.map((s) => s.numeric),
    [7, 73, 730, 7300, 73000, 730000, 7300000, 73000000],
  );
  assert.equal(steps730k[5].displayed, "730.000");
  assert.equal(steps730k[7].displayed, "73.000.000");

  const steps1m = simulateTypingDigits("1000000");
  assert.deepEqual(
    steps1m.map((s) => s.numeric),
    [1, 10, 100, 1000, 10000, 100000, 1000000],
  );
  assert.equal(steps1m[4].displayed, "10.000");
  assert.equal(steps1m[6].displayed, "1.000.000");
});

test("backspace on Vietnamese thousand-formatted numbers removes exactly one digit", () => {
  assert.equal(parseMoneyInput("730.00"), 73000);
  assert.equal(parseMoneyInput("73.00"), 7300);
  assert.equal(parseMoneyInput("10.00"), 1000);
  assert.equal(parseMoneyInput("-73.0000"), -730000);
});

test("pasted decimal and API strings parse accurately", () => {
  assert.equal(parseMoneyInput("730.000,00"), 730000);
  assert.equal(parseMoneyInput("730,000.00"), 730000);
  assert.equal(toMoneyNumber("730000.00"), 730000);
  assert.equal(toMoneyNumber("730.000"), 730000);
  assert.equal(toMoneyNumber("1.500.000"), 1500000);
  assert.equal(toMoneyNumber("12,50"), 12.5);
});
