import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify agency sale return modal (2. Bán hàng đại lý bán đúng giá)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // 1. Navigate directly to sales returns tab
  console.log('1. Navigating to sales returns tab...');
  await page.goto('http://localhost:5173/sales/returns?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Click "Thêm chứng từ trả lại hàng bán" button
  const themBtn = page.getByRole('button', { name: 'Thêm chứng từ trả lại hàng bán' });
  await expect(themBtn).toBeVisible();
  await themBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // 2. Select "2. Bán hàng đại lý bán đúng giá"
  console.log('2. Selecting 2. Bán hàng đại lý bán đúng giá...');
  const formTypeSelect = modal.locator('header select').first();
  await formTypeSelect.selectOption('2. Bán hàng đại lý bán đúng giá');
  await page.waitForTimeout(400);

  // =========================================================================
  // SCREENSHOT 1: BTL00001 (Giảm trừ công nợ - Tab Giảm trừ công nợ)
  // =========================================================================
  console.log('3. Verifying Screenshot 1: BTL00001 (Agency - Giảm trừ công nợ)...');
  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại BTL00001');
  await expect(modal.locator('text=Đơn vị giao đại lý')).toBeVisible();
  await expect(modal.locator('th:has-text("TK trả lại")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số CT bán hàng")')).toBeVisible();
  await expect(modal.locator('input[value="331"]')).toBeVisible();
  await expect(modal.locator('input[value="131"]')).toBeVisible();

  // Capture Screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_btl_debt.png') });
  console.log('Captured sale_return_agency_btl_debt.png');

  // =========================================================================
  // SCREENSHOT 2: BTL00001 (Giảm trừ công nợ - Tab Phiếu nhập)
  // =========================================================================
  console.log('4. Verifying Screenshot 2: BTL00001 (Agency - Phiếu nhập)...');
  await modal.locator('button:text-is("Phiếu nhập")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Người giao hàng')).toBeVisible();
  await expect(modal.locator('text=Số phiếu nhập')).toBeVisible();
  await expect(modal.locator('input[value="NK00001"]')).toBeVisible();

  // Capture Screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_btl_inward.png') });
  console.log('Captured sale_return_agency_btl_inward.png');

  // =========================================================================
  // SCREENSHOT 3: BTL00001 (Giảm trừ công nợ - Tab Hóa đơn)
  // =========================================================================
  console.log('5. Verifying Screenshot 3: BTL00001 (Agency - Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('label:text-is("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();

  // Capture Screenshot 3
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_btl_invoice.png') });
  console.log('Captured sale_return_agency_btl_invoice.png');

  // =========================================================================
  // SCREENSHOT 4: PC00001 (Trả lại tiền mặt - Tab Phiếu chi)
  // =========================================================================
  console.log('6. Verifying Screenshot 4: PC00001 (Agency - Phiếu chi)...');
  await modal.locator('input[type="radio"]').nth(1).check();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại PC00001');
  await expect(modal.locator('button:text-is("Phiếu chi")')).toBeVisible();
  await expect(modal.locator('text=Người nhận')).toBeVisible();
  await expect(modal.locator('text=Lý do chi')).toBeVisible();
  await expect(modal.locator('text=Đơn vị giao đại lý')).toBeVisible();
  await expect(modal.locator('input[value="PC00001"]')).toBeVisible();

  // Table columns for agency cash return
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số CT bán hàng")')).toBeVisible();
  await expect(modal.locator('input[value="331"]')).toBeVisible();
  await expect(modal.locator('input[value="111"]')).toBeVisible();

  // Capture Screenshot 4
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_pc_cash.png') });
  console.log('Captured sale_return_agency_pc_cash.png');

  // =========================================================================
  // SCREENSHOT 5: PC00001 (Trả lại tiền mặt - Tab Phiếu nhập)
  // =========================================================================
  console.log('7. Verifying Screenshot 5: PC00001 (Agency - Phiếu nhập)...');
  await modal.locator('button:text-is("Phiếu nhập")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Người giao hàng')).toBeVisible();
  await expect(modal.locator('text=Số phiếu nhập')).toBeVisible();
  await expect(modal.locator('input[value="NK00001"]')).toBeVisible();

  // Capture Screenshot 5
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_pc_inward.png') });
  console.log('Captured sale_return_agency_pc_inward.png');

  // =========================================================================
  // SCREENSHOT 6: PC00001 (Trả lại tiền mặt - Tab Hóa đơn)
  // =========================================================================
  console.log('8. Verifying Screenshot 6: PC00001 (Agency - Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại PC00001');
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('label:text-is("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();

  // Table columns for agency cash return in invoice tab
  await expect(modal.locator('th:has-text("TK trả lại")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số CT bán hàng")')).toBeVisible();
  await expect(modal.locator('input[value="331"]')).toBeVisible();
  await expect(modal.locator('input[value="111"]')).toBeVisible();

  // Capture Screenshot 6
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_agency_pc_invoice.png') });
  console.log('Captured sale_return_agency_pc_invoice.png');
});
