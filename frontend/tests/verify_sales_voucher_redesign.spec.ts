import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sales voucher redesign across all 5 screenshot modes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // =========================================================================
  // 1. OPEN VOUCHER MODAL
  // =========================================================================
  console.log('1. Navigating to sales transactions tab...');
  await page.goto('http://localhost:5173/sales/transactions?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Click "Thêm" button in sales voucher toolbar
  const themBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await themBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // 2. SCREENSHOT 1: TYPE 1 (Bán hàng hóa trong nước) - CHƯA THU TIỀN
  // =========================================================================
  console.log('2. Verifying Mode 1: Bán hàng hóa trong nước - Chưa thu tiền (Screenshot 1)...');
  await expect(modal.locator('h2')).toContainText(/Chứng từ bán hàng BH/);
  await expect(modal.locator('text=Chưa thu tiền')).toBeVisible();
  await expect(modal.locator('text=Kiêm phiếu xuất')).toBeVisible();
  await expect(modal.locator('text=Lập kèm hóa đơn')).toBeVisible();
  await expect(modal.locator('text=Đã lập hóa đơn')).toBeVisible();
  await expect(modal.locator('text=Chứng từ ghi nợ')).toBeVisible();

  // Table columns check
  await expect(modal.locator('th:has-text("Chiết khấu thương mại")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK doanh thu")')).toBeVisible();
  await expect(modal.locator('th:has-text("% Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();

  // Capture screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode1_uncollected.png') });
  console.log('Captured sales_voucher_mode1_uncollected.png');

  // =========================================================================
  // 3. SCREENSHOT 2: TYPE 1 (Bán hàng hóa trong nước) - THU TIỀN NGAY
  // =========================================================================
  console.log('3. Verifying Mode 2: Bán hàng hóa trong nước - Thu tiền ngay (Screenshot 2)...');
  await modal.locator('label:has-text("Thu tiền ngay")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText(/Chứng từ bán hàng PT/);
  await expect(modal.getByRole('button', { name: 'Phiếu thu', exact: true })).toBeVisible();
  await expect(modal.locator('text=Người nộp')).toBeVisible();
  await expect(modal.locator('text=Lý do nộp')).toBeVisible();
  await expect(modal.locator('text=Kèm theo')).toBeVisible();
  await expect(modal.locator('text=Chứng từ gốc')).toBeVisible();
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();

  // Capture screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode2_collected.png') });
  console.log('Captured sales_voucher_mode2_collected.png');

  // =========================================================================
  // 4. SCREENSHOT 3: TYPE 2 (Bán hàng xuất khẩu) - CHƯA THU TIỀN
  // =========================================================================
  console.log('4. Verifying Mode 3: Bán hàng xuất khẩu - Chưa thu tiền (Screenshot 3)...');
  await modal.locator('label:has-text("Chưa thu tiền")').click();
  await modal.locator('select').first().selectOption('2'); // Select option 2
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText(/Chứng từ bán hàng BH/);
  await expect(modal.locator('th:has-text("TK công nợ/ chi phí")')).toBeVisible();
  await expect(modal.locator('th:has-text("Giá tính thuế XK")')).toBeVisible();
  await expect(modal.locator('th:has-text("% thuế xuất khẩu")')).toBeVisible();
  await expect(modal.locator('th:has-text("Tiền thuế XK")')).toBeVisible();
  await expect(modal.getByText('Thuế xuất khẩu', { exact: true })).toBeVisible();

  // Capture screenshot 3
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode3_export.png') });
  console.log('Captured sales_voucher_mode3_export.png');

  // =========================================================================
  // 5. SCREENSHOT 4: TYPE 3 (Bán hàng đại lý) - CHƯA THU TIỀN
  // =========================================================================
  console.log('5. Verifying Mode 4: Bán hàng đại lý - Chưa thu tiền (Screenshot 4)...');
  await modal.locator('select').first().selectOption('3'); // Select option 3
  await page.waitForTimeout(400);

  await expect(modal.locator('text=Đơn vị giao đại lý')).toBeVisible();
  await expect(modal.locator('th:has-text("TK nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK có")')).toBeVisible();

  // Capture screenshot 4
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode4_agency_uncollected.png') });
  console.log('Captured sales_voucher_mode4_agency_uncollected.png');

  // =========================================================================
  // 6. SCREENSHOT 5: TYPE 3 (Bán hàng đại lý) - THU TIỀN NGAY
  // =========================================================================
  console.log('6. Verifying Mode 5: Bán hàng đại lý - Thu tiền ngay (Screenshot 5)...');
  await modal.locator('label:has-text("Thu tiền ngay")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText(/Chứng từ bán hàng PT/);
  await expect(modal.locator('text=Đơn vị giao đại lý')).toBeVisible();
  await expect(modal.locator('text=Người nộp')).toBeVisible();
  await expect(modal.locator('text=Lý do nộp')).toBeVisible();
  await expect(modal.locator('th:has-text("TK nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK có")')).toBeVisible();

  // Capture screenshot 5
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode5_agency_collected.png') });
  console.log('Captured sales_voucher_mode5_agency_collected.png');

  // =========================================================================
  // 7. SCREENSHOT 6: TYPE 4 (Bán hàng ủy thác xuất khẩu) - CHƯA THU TIỀN
  // =========================================================================
  console.log('7. Verifying Mode 6: Bán hàng ủy thác xuất khẩu - Chưa thu tiền (Screenshot 6)...');
  await modal.locator('label:has-text("Chưa thu tiền")').click();
  await modal.locator('select').first().selectOption('4'); // Select option 4
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText(/Chứng từ bán hàng BH/);
  await expect(modal.locator('text=Đơn vị ủy thác')).toBeVisible();
  await expect(modal.locator('th:has-text("% Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Giá tính thuế XK")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền hàng")')).toBeVisible();
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();
  await expect(modal.locator('span:text-is("Thuế xuất khẩu")')).toBeVisible();

  // Capture screenshot 6
  await page.screenshot({ path: path.join(artifactDir, 'sales_voucher_mode6_trustee_export.png') });
  console.log('Captured sales_voucher_mode6_trustee_export.png');

  console.log('All 6 sales voucher modes verified successfully!');
});
