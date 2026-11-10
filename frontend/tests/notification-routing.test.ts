import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationRoute } from '../src/notification-routing.ts';

test('cash notification links preserve the requested document and current company scope', () => {
  const url = new URL(notificationRoute('/cash/advance-settlement-request?document=qt-42&company=old', 'company-a', '2026-11'), 'http://erp.local');
  assert.equal(url.pathname, '/cash/advance-settlement');
  assert.equal(url.searchParams.get('document'), 'qt-42');
  assert.equal(url.searchParams.get('openDoc'), 'qt-42');
  assert.equal(url.searchParams.get('company'), 'company-a');
  assert.equal(url.searchParams.get('period'), '2026-11');
});

test('explicit document links are preserved and unrelated routes are not rewritten', () => {
  const url = new URL(notificationRoute('/cash/payment-requests?openDoc=chosen&document=old', 'a', '2026-11'), 'http://erp.local');
  assert.equal(url.searchParams.get('openDoc'), 'chosen');
  const other = new URL(notificationRoute('/reports?document=report-1', 'a', '2026-11'), 'http://erp.local');
  assert.equal(other.searchParams.has('openDoc'), false);
});

test('notification links reject external destinations', () => {
  for (const link of ['https://other.example/path', '//other.example/path', 'javascript:alert(1)']) {
    assert.throws(() => notificationRoute(link, 'a', '2026-11'));
  }
});
