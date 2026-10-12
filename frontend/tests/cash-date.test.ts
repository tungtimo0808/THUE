import test from 'node:test';
import assert from 'node:assert/strict';
import { currentCashDate, cashDateRange, isCashDateInRange } from '../src/cash-date.ts';

test('cash forms use the current calendar date instead of a fixed fixture date', () => {
  assert.equal(currentCashDate(new Date(2026, 9, 9)), '09/10/2026');
  assert.equal(currentCashDate(new Date(2027, 0, 1)), '01/01/2027');
});
test('cash report dates include both endpoints and exclude a different month or an impossible date', () => {
  assert.equal(isCashDateInRange('06/10/2026','01/10/2026','31/10/2026'), true);
  assert.equal(isCashDateInRange('2026-10-31','01/10/2026','31/10/2026'), true);
  assert.equal(isCashDateInRange('06/10/2026','01/09/2026','30/09/2026'), false);
  assert.equal(isCashDateInRange('31/02/2026','01/01/2026','31/12/2026'), false);
  assert.equal(isCashDateInRange('09/10/2026','31/10/2026','01/10/2026'), false);
});
test('cash month and quarter presets follow the selected calendar period', () => {
  const today = new Date(2026, 9, 9);
  assert.deepEqual(cashDateRange('Tháng này', today), ['01/10/2026', '31/10/2026']);
  assert.deepEqual(cashDateRange('Quý này', today), ['01/10/2026', '31/12/2026']);
  assert.deepEqual(cashDateRange('Đầu năm tới hiện tại', today), ['01/01/2026', '09/10/2026']);
});
test('cash presets handle leap years and weeks across a year boundary', () => {
  assert.deepEqual(cashDateRange('Tháng này', new Date(2024, 1, 20)), ['01/02/2024', '29/02/2024']);
  assert.deepEqual(cashDateRange('Tuần này', new Date(2027, 0, 1)), ['28/12/2026', '03/01/2027']);
  assert.equal(cashDateRange('Tùy chọn', new Date(2026, 9, 9)), null);
});
