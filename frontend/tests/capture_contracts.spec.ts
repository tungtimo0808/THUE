import { test } from '@playwright/test';
import * as path from 'path';

test('capture sale contracts screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });

  console.log('Navigating to contracts tab...');
  await page.goto('http://localhost:5173/sales/contracts?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/3b231631-0c60-4249-b62a-7cafc7c0454a');

  // 1. Landing page screenshot
  await page.screenshot({ path: path.join(artifactDir, 'contracts_landing_screenshot.png') });
  console.log('Captured contracts_landing_screenshot.png');

  // 2. Click "Thêm" button to open modal
  const themBtn = page.locator('button:has-text("Thêm")').nth(1);
  await themBtn.click();
  await page.waitForTimeout(800);

  // Modal screenshot
  await page.screenshot({ path: path.join(artifactDir, 'contracts_modal_screenshot.png') });
  console.log('Captured contracts_modal_screenshot.png');

  // 3. Close modal and test list view
  const closeBtn = page.locator('button:has-text("Hủy")').first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  const listBtn = page.locator('button:has-text("Xem danh sách chứng từ")').first();
  await listBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(artifactDir, 'contracts_list_screenshot.png') });
  console.log('Captured contracts_list_screenshot.png');
});
