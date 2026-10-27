import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(err.message));

console.log('1. Navigating to login...');
await page.goto('http://127.0.0.1:2601/login', { waitUntil: 'networkidle', timeout: 30000 });

console.log('2. Logging in as superadmin...');
await page.fill('#auth-identifier', 'superadmin@soviet.vn');
await page.fill('#auth-password', 'SuperAdmin@2026');
await page.click('button[type="submit"]');

await page.waitForTimeout(3000);
console.log('Current URL after login:', page.url());

// Click on company ABC on select-company
console.log('Selecting company ABC...');
const companyCard = page.locator('text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC').first();
if (await companyCard.isVisible()) {
  await companyCard.click();
  await page.waitForTimeout(2000);
}

console.log('3. Navigating to /company-admin ...');
await page.goto('http://127.0.0.1:2601/company-admin', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

// Click Tab 2: Nhân sự & Phân quyền
const tab2 = page.locator('text=2. Nhân sự & Phân quyền');
if (await tab2.isVisible()) {
  await tab2.click();
  await page.waitForTimeout(1500);
}

await page.screenshot({ path: 'frontend/tests/screenshots/local_company_admin_tab2.png', fullPage: true });

// Check permission buttons and stats
const pageText = await page.innerText('body');
console.log('Company Admin body snippet:\n', pageText.slice(0, 1000));

const permButtons = await page.$$eval('button, .admin-btn', btns =>
  btns.map(b => b.innerText.trim()).filter(t => t.includes('Quyền') || t.includes('vai trò'))
);
console.log('Detected permission & role buttons in UI:', permButtons);

console.log('Console Errors:', consoleErrors);
await browser.close();

