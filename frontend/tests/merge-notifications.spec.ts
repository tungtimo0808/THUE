import { test, expect, type Page } from '@playwright/test';

// All API calls are intercepted: these checks never use a real account or database.
test.use({ storageState: { cookies: [], origins: [] } });
const company = { id: 'merge-company', code: 'MERGE', name: 'Doanh nghiệp kiểm thử', status: 'ACTIVE', accounting_regime: 'TT99', is_company_admin: true };
const payment = (id: string, code: string) => ({ id, code, date: '10/11/2026', requester: 'Người đề nghị', dept: 'Kế toán', purpose: `Chi kiểm thử ${code}`, amount: 100000, status: 'pending', voucherCode: '', branchId: '' });

async function fixture(page: Page) {
  const state = {
    notifications: [] as Record<string, unknown>[],
    payments: [] as ReturnType<typeof payment>[],
    settlements: [] as Record<string, unknown>[],
    failRead: false, failOpen: false, unavailable: false,
    read: false, opened: 0, loads: 0,
  };
  await page.addInitScript((company) => {
    localStorage.setItem('erp_api_session', JSON.stringify({ token: 'mock-merge-token', companyId: company.id, companies: [company], user: { id: 'merge-user', email: 'merge@example.invalid' } }));
    localStorage.setItem('ref_branch', 'all');
    localStorage.setItem('ref_dataset', 'accounting-2026');
    // Stale browser data must not override the server or produce fake alerts.
    localStorage.setItem('sv_pr_docs_sync', JSON.stringify([{ id: 'old-local', code: 'STALE-LOCAL', status: 'pending' }]));
    localStorage.setItem('sv_voucher_status_overrides', JSON.stringify({ 'API-SECOND': { status: 'approved' } }));
  }, company);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes('/companies/mine/')) return route.fulfill({ json: [company] });
    if (path.includes('/notifications/')) {
      if (path.endsWith('/read-all/')) {
        if (state.failRead) return route.fulfill({ status: 503, json: { detail: 'Không cập nhật được trạng thái đọc.' } });
        state.read = true;
        return route.fulfill({ json: { updated: state.notifications.length } });
      }
      if (path.endsWith('/open/')) {
        state.opened++;
        if (state.failOpen) return route.fulfill({ status: 403, json: { detail: 'Bạn không có quyền truy cập chứng từ này.' } });
        return route.fulfill({ json: { available: !state.unavailable, link: '/cash/payment-requests?document=second', detail: 'Chứng từ không còn khả dụng.' } });
      }
      state.loads++;
      return route.fulfill({ json: { results: state.notifications.map((n) => ({ ...n, read_at: state.read ? '2026-11-10T03:00:00Z' : null })) } });
    }
    if (path.includes('/cash/payment-requests/')) return route.fulfill({ json: { docs: state.payments } });
    if (path.includes('/cash/advance-settlement-docs/')) return route.fulfill({ json: { docs: state.settlements } });
    if (path.includes('/memberships/me/')) return route.fulfill({ json: { id: 'member', role_assignments: [] } });
    if (path.includes('/companies/switch/')) return route.fulfill({ json: { company } });
    if (path.includes('/settings/')) return route.fulfill({ json: { configuration: {} } });
    return route.fulfill({ json: { results: [], count: 0 } });
  });
  return state;
}

const notification = { id: 'notice-1', title: 'Chứng từ cần xem', message: 'Nội dung từ máy chủ', source_module: 'CASH', level: 'NORMAL', created_at: '2026-11-10T02:00:00Z', link: '/cash/payment-requests?document=second' };

async function openNotifications(page: Page) {
  await page.goto('/cash/payment-requests');
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await expect(page.locator('.notification-list')).toHaveAttribute('aria-busy', 'false');
}

test('empty API results do not show stale browser vouchers or sample alerts', async ({ page }) => {
  await fixture(page);
  await openNotifications(page);
  await expect(page.locator('.notification-row')).toHaveCount(0);
  await expect(page.locator('.notification-empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đọc tất cả', exact: true })).toBeDisabled();
});

test('failed read-all preserves unread state and successful retry updates it', async ({ page }) => {
  const state = await fixture(page);
  state.notifications = [notification];
  state.failRead = true;
  await openNotifications(page);
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  await expect(page.locator('.notification-error')).toContainText('Không cập nhật');
  await expect(page.locator('.notification-unread-dot')).toHaveCount(1);
  state.failRead = false;
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0);
});

test('server permissions are checked before opening a database notification', async ({ page }) => {
  const state = await fixture(page);
  state.notifications = [notification];
  state.failOpen = true;
  await openNotifications(page);
  await page.locator('.notification-row').click();
  await expect(page.locator('.notification-error')).toContainText('quyền');
  await expect(page.locator('.notification-panel')).toBeVisible();
  await expect(page.locator('.notification-unread-dot')).toHaveCount(1);
  expect(state.opened).toBe(1);
  expect(new URL(page.url()).searchParams.has('openDoc')).toBe(false);
});

test('API pending notification opens its exact voucher and can reopen after closing', async ({ page }) => {
  const state = await fixture(page);
  state.payments = [payment('first', 'API-FIRST'), payment('second', 'API-SECOND')];
  await openNotifications(page);
  await expect(page.locator('.notification-row')).toHaveCount(2);
  await page.locator('.notification-row').filter({ hasText: 'API-SECOND' }).click();
  await expect(page).toHaveURL(/openDoc=second/);
  const modal = page.locator('div[style*="position: fixed"]').filter({ has: page.getByRole('heading', { name: 'Giấy đề nghị chi tiền — API-SECOND', exact: true }) });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await page.locator('.notification-row').filter({ hasText: 'API-SECOND' }).click();
  await expect(modal).toBeVisible();
});

test('voucher updates reload API notifications and server unread status wins', async ({ page }) => {
  const state = await fixture(page);
  state.notifications = [notification];
  await openNotifications(page);
  await page.getByRole('button', { name: 'Đọc tất cả', exact: true }).click();
  await expect(page.locator('.notification-unread-dot')).toHaveCount(0);
  const before = state.loads;
  state.read = false;
  state.notifications = [{ ...notification, message: 'Chứng từ được gửi duyệt lại' }];
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('sv_vouchers_updated')));
  await expect.poll(() => state.loads).toBeGreaterThan(before);
  await expect(page.locator('.notification-row')).toContainText('Chứng từ được gửi duyệt lại');
  await expect(page.locator('.notification-unread-dot')).toHaveCount(1);
});

test('unknown notification document does not open an unrelated voucher', async ({ page }) => {
  const state = await fixture(page);
  state.payments = [payment('first', 'API-FIRST')];
  await page.goto('/cash/payment-requests?openDoc=missing');
  await expect(page.getByText('API-FIRST', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Giấy đề nghị chi tiền —/ })).toHaveCount(0);
});

test('registration legal links preserve consent and checkbox size', async ({ page }) => {
  await fixture(page);
  await page.goto('/account');
  const checkbox = page.locator('.auth-checkbox-label input').first();
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: 'Điều khoản sử dụng hệ thống', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  const size = await checkbox.boundingBox();
  expect(size?.width).toBe(18);
  await page.screenshot({ path: 'test-results/merge-registration.png', fullPage: true });
});

test('server-approved legacy notification link opens the exact payment document', async ({ page }) => {
  const state = await fixture(page);
  state.notifications = [notification];
  state.payments = [payment('first', 'API-FIRST'), payment('second', 'API-SECOND')];
  await openNotifications(page);
  await page.locator('.notification-row').filter({ hasText: notification.title }).click();
  await expect(page.getByRole('heading', { name: 'Giấy đề nghị chi tiền — API-SECOND', exact: true })).toBeVisible();
  expect(state.opened).toBe(1);
  expect(new URL(page.url()).searchParams.get('document')).toBe('second');
});

test('settlement notification opens the requested record and can reopen', async ({ page }) => {
  const state = await fixture(page);
  state.settlements = ['FIRST', 'SECOND'].map((suffix) => ({ id: `qt-${suffix}`, code: `QT-${suffix}`, date: '10/11/2026', person: 'Nhân viên kiểm thử', dept: 'Kế toán', reason: 'Quyết toán kiểm thử', advanceAmount: 100000, spentAmount: 90000, refundAmount: 10000, extraAmount: 0, status: 'pending', receiptCode: '' }));
  await openNotifications(page);
  await page.locator('.notification-row').filter({ hasText: 'QT-SECOND' }).click();
  const heading = page.getByRole('heading', { name: 'Bảng thanh toán tiền tạm ứng — QT-SECOND', exact: true });
  const modal = page.locator('div[style*="position: fixed"]').filter({ has: heading });
  await expect(heading).toBeVisible();
  await modal.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await page.locator('.notification-row').filter({ hasText: 'QT-SECOND' }).click();
  await expect(heading).toBeVisible();
});

test('company list uses main layout and keeps per-company admin visibility', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/v1/common/companies/mine/', (route) => route.fulfill({ json: [company, { ...company, id: 'member-only', name: 'Doanh nghiệp chỉ là thành viên', is_company_admin: false }] }));
  await page.goto('/select-company');
  await expect(page.locator('.company-list-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: `Quản trị ${company.name}`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quản trị Doanh nghiệp chỉ là thành viên', exact: true })).toHaveCount(0);
});

test('invoice workflow retains the local intake route with main diagram geometry', async ({ page }) => {
  await fixture(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/invoices/process');
  await expect(page.locator('.iw-flow > a')).toHaveCount(8);
  await expect(page.locator('.iw-flow > svg')).toHaveAttribute('viewBox', '0 0 1000 460');
  await expect(page.locator('.iw-flow').getByRole('link', { name: 'Tiếp nhận hóa đơn đầu vào' })).toHaveAttribute('href', /\/invoices\/incoming\/inbox\?/);
  await page.screenshot({ path: 'test-results/merge-invoice-workflow.png', fullPage: true });
  expect(errors).toEqual([]);
});
