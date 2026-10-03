import { test } from '@playwright/test';
import * as path from 'path';

test('capture sales transactions and vouchers screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });

  console.log('Navigating to sales transactions tab...');
  await page.goto('http://localhost:5173/sales/transactions?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/3b231631-0c60-4249-b62a-7cafc7c0454a');

  // 1. Landing page screenshot (Image 5)
  await page.screenshot({ path: path.join(artifactDir, 'sales_landing_screenshot.png') });
  console.log('Captured sales_landing_screenshot.png');

  // 2. Click "Thêm" button to open modal with Type 1 (Image 1)
  const themBtn = page.locator('button:has-text("Thêm")').nth(1);
  await themBtn.click();
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(artifactDir, 'sales_modal_type1_screenshot.png') });
  console.log('Captured sales_modal_type1_screenshot.png');

  // 3. Switch to Type 2: Bán hàng xuất khẩu (Image 2)
  const typeSelect = page.locator('.misa-sale-voucher-modal-window select').first();
  await typeSelect.selectOption('2');
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(artifactDir, 'sales_modal_type2_screenshot.png') });
  console.log('Captured sales_modal_type2_screenshot.png');

  // 4. Switch to Type 3: Bán hàng đại lý bán đúng giá (Image 3)
  await typeSelect.selectOption('3');
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(artifactDir, 'sales_modal_type3_screenshot.png') });
  console.log('Captured sales_modal_type3_screenshot.png');

  // 5. Switch to Type 4: Bán hàng ủy thác xuất khẩu (Image 4)
  await typeSelect.selectOption('4');
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(artifactDir, 'sales_modal_type4_screenshot.png') });
  console.log('Captured sales_modal_type4_screenshot.png');

  // 6. Close modal and test list view
  const closeBtn = page.locator('.misa-sale-voucher-modal-window button:has-text("Hủy")').first();
  await closeBtn.click();
  await page.waitForTimeout(400);

  const listBtn = page.locator('button:has-text("Xem danh sách chứng từ")').first();
  await listBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(artifactDir, 'sales_list_screenshot.png') });
  console.log('Captured sales_list_screenshot.png');
});
