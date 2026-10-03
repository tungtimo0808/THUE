import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sale discount modal all 4 screenshots (BGG00001 and PC00001 for 1. Bán hàng hóa, dịch vụ)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // 1. Navigate to sales discounts tab
  console.log('1. Navigating to sales discounts tab...');
  await page.goto('http://localhost:5173/sales/discounts?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Click "Thêm chứng từ giảm giá hàng bán" button
  const themBtn = page.getByRole('button', { name: 'Thêm chứng từ giảm giá hàng bán' });
  await expect(themBtn).toBeVisible();
  await themBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // SCREENSHOT 1: BGG00001 (Giảm trừ công nợ - Tab Giảm trừ công nợ)
  // =========================================================================
  console.log('2. Verifying Screenshot 1: BGG00001 (Giảm trừ công nợ - Tab Giảm trừ công nợ)...');
  await expect(modal.locator('h2')).toContainText('Chứng từ giảm giá hàng bán BGG00001');
  await expect(modal.locator('header select').first()).toHaveValue('1. Bán hàng hóa, dịch vụ');

  // Radios: Giảm trừ công nợ checked, Trả lại tiền mặt unchecked
  const debtRadio = modal.locator('input[type="radio"][value="debt"], input[type="radio"]').first();
  await expect(debtRadio).toBeChecked();

  // Active Upper Tab: Giảm trừ công nợ
  const debtTabBtn = modal.locator('button:text-is("Giảm trừ công nợ")');
  await expect(debtTabBtn).toBeVisible();

  // Master Fields
  await expect(modal.locator('text=Mã khách hàng')).toBeVisible();
  await expect(modal.locator('text=Tên khách hàng')).toBeVisible();
  await expect(modal.locator('text=Địa chỉ')).toBeVisible();
  await expect(modal.locator('text=Nhân viên bán hàng')).toBeVisible();
  await expect(modal.locator('text=Diễn giải')).toBeVisible();
  await expect(modal.locator('text=Số chứng từ')).toBeVisible();
  await expect(modal.locator('input[value="BGG00001"]')).toBeVisible();
  await expect(modal.locator('text=Tham chiếu ...')).toBeVisible();

  // Sub tab: Hàng tiền only
  await expect(modal.locator('button:text-is("Hàng tiền")')).toBeVisible();
  await expect(modal.locator('button:text-is("Giá vốn")')).not.toBeVisible();
  await expect(modal.locator('text=Gợi ý hồ sơ')).toBeVisible();
  await expect(modal.locator('span:text-is("Chiết khấu")')).toBeVisible();

  // Table columns & values
  await expect(modal.locator('th:has-text("TK Giảm giá")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số CT bán h...")')).toBeVisible();
  await expect(modal.locator('input[value="5213"]')).toBeVisible();
  await expect(modal.locator('input[value="131"]')).toBeVisible();
  await expect(modal.locator('input[value="33311"]')).toBeVisible();

  // Checkboxes
  const replaceInvCheckbox = modal.locator('input[type="checkbox"]').nth(0);
  await expect(replaceInvCheckbox).not.toBeChecked();
  await expect(modal.locator('text=Là hóa đơn thay thế')).toBeVisible();
  await expect(modal.locator('text=Không lên bảng kê thuế GTGT')).toBeVisible();

  // Action Buttons
  await expect(modal.locator('button:text-is("Hủy")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất và In")')).toBeVisible();

  // Capture Screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'sale_discount_bgg_debt.png') });
  console.log('Captured sale_discount_bgg_debt.png');

  // =========================================================================
  // SCREENSHOT 2: BGG00001 (Giảm trừ công nợ - Tab Hóa đơn)
  // =========================================================================
  console.log('3. Verifying Screenshot 2: BGG00001 (Giảm trừ công nợ - Tab Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  // Tab Hóa đơn fields
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('text=Người mua hàng')).toBeVisible();
  await expect(modal.locator('text=Hình thức thanh toán')).toBeVisible();
  await expect(modal.locator('label:text-is("Tài khoản ngân hàng")')).toBeVisible();
  await expect(modal.locator('text=Mẫu số HĐ')).toBeVisible();
  await expect(modal.locator('text=Ký hiệu HĐ')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();
  await expect(modal.locator('text=Ngày HĐ')).toBeVisible();

  // Capture Screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'sale_discount_bgg_invoice.png') });
  console.log('Captured sale_discount_bgg_invoice.png');

  // =========================================================================
  // SCREENSHOT 3: PC00001 (Trả lại tiền mặt - Tab Phiếu chi)
  // =========================================================================
  console.log('4. Verifying Screenshot 3: PC00001 (Trả lại tiền mặt - Tab Phiếu chi)...');
  // Click radio "Trả lại tiền mặt"
  await modal.locator('label:has-text("Trả lại tiền mặt") input').click();
  await page.waitForTimeout(300);

  // Header should now show PC00001
  await expect(modal.locator('h2')).toContainText('Chứng từ giảm giá hàng bán PC00001');

  // Upper tab is now "Phiếu chi"
  await expect(modal.locator('button:text-is("Phiếu chi")')).toBeVisible();

  // Tab Phiếu chi fields
  await expect(modal.locator('text=Người nhận')).toBeVisible();
  await expect(modal.locator('text=Lý do chi')).toBeVisible();
  await expect(modal.locator('text=Kèm theo')).toBeVisible();
  await expect(modal.locator('text=chứng từ gốc')).toBeVisible();
  await expect(modal.locator('text=Ngày phiếu chi')).toBeVisible();
  await expect(modal.locator('text=Số phiếu chi')).toBeVisible();
  await expect(modal.locator('input[value="PC00001"]')).toBeVisible();

  // Table columns & values for cash mode: TK Tiền (111)
  await expect(modal.locator('th:has-text("TK Tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).not.toBeVisible();
  await expect(modal.locator('input[value="111"]')).toBeVisible();

  // Capture Screenshot 3
  await page.screenshot({ path: path.join(artifactDir, 'sale_discount_pc_cash.png') });
  console.log('Captured sale_discount_pc_cash.png');

  // =========================================================================
  // SCREENSHOT 4: PC00001 (Trả lại tiền mặt - Tab Hóa đơn)
  // =========================================================================
  console.log('5. Verifying Screenshot 4: PC00001 (Trả lại tiền mặt - Tab Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  // Tab Hóa đơn under cash mode
  await expect(modal.locator('h2')).toContainText('Chứng từ giảm giá hàng bán PC00001');
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('text=Người mua hàng')).toBeVisible();
  await expect(modal.locator('text=Mẫu số HĐ')).toBeVisible();
  await expect(modal.locator('text=Ký hiệu HĐ')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();
  await expect(modal.locator('text=Ngày HĐ')).toBeVisible();

  // Payment method should be "Tiền mặt"
  const payMethodSelect = modal.locator('select:has(option:text-is("Tiền mặt"))').first();
  await expect(payMethodSelect).toHaveValue('Tiền mặt');

  // Table should still have TK Tiền (111)
  await expect(modal.locator('th:has-text("TK Tiền")')).toBeVisible();
  await expect(modal.locator('input[value="111"]')).toBeVisible();

  // Capture Screenshot 4
  await page.screenshot({ path: path.join(artifactDir, 'sale_discount_pc_invoice.png') });
  console.log('Captured sale_discount_pc_invoice.png');

  console.log('All 4 screenshots verified successfully!');
});
