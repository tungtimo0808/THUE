import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sales module taskbar wrapping to 2 lines when needed', async ({ page }) => {
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // Test at 1366px viewport width (typical laptop screen where single line overflowed)
  await page.setViewportSize({ width: 1366, height: 800 });

  console.log('1. Navigating to /sales/reports...');
  await page.goto('http://localhost:5173/sales/reports?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const navBar = page.locator('.ref-module-bar nav');
  await expect(navBar).toBeVisible();

  // Check all tabs are visible and not clipped
  const tabsToCheck = [
    'Quy trình',
    'Biểu đồ',
    'Báo giá',
    'Đơn đặt hàng',
    'Hợp đồng bán hàng',
    'Bán hàng',
    'Hóa đơn',
    'Tự động hạch toán HĐ',
    'Trả lại hàng bán',
    'Giảm giá hàng bán',
    'Báo cáo',
    'Công nợ',
    'Đối chiếu công nợ',
    'Hàng hóa, dịch vụ',
    'Khách hàng'
  ];

  for (const tabLabel of tabsToCheck) {
    const tabLink = navBar.locator(`a:has-text("${tabLabel}")`).first();
    await expect(tabLink).toBeVisible();
    const text = await tabLink.innerText();
    console.log(`Tab found: "${text.trim()}"`);
  }

  // Active tab "Báo cáo" should have active class and be visible
  const activeTab = navBar.locator('a.active');
  await expect(activeTab).toContainText('Báo cáo');

  // Take screenshot at 1366px
  await page.screenshot({ path: path.join(artifactDir, 'sales_taskbar_1366px.png') });
  console.log('Captured sales_taskbar_1366px.png');

  // Test at 1280px width
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifactDir, 'sales_taskbar_1280px.png') });
  console.log('Captured sales_taskbar_1280px.png');

  // Test clicking another tab on the 2nd line, e.g. "Công nợ" or "Khách hàng"
  const customerTab = navBar.locator('a:has-text("Khách hàng")').first();
  await customerTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifactDir, 'sales_taskbar_customer_tab.png') });
  console.log('Captured sales_taskbar_customer_tab.png');
});
