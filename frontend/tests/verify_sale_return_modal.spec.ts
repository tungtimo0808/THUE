import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sale return modal (BTL00001 & PC00001) matching all 5 user screenshots', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // =========================================================================
  // 1. NAVIGATE TO SALES RETURNS TAB
  // =========================================================================
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

  // =========================================================================
  // 2. SCREENSHOT 1: BTL00001 (Giảm trừ công nợ - Tab Giảm trừ công nợ)
  // =========================================================================
  console.log('2. Verifying Screenshot 1: BTL00001 (Giảm trừ công nợ)...');
  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại BTL00001');
  await expect(modal.locator('header select').first()).toHaveValue('1. Bán hàng hóa, dịch vụ');
  await expect(modal.locator('input[placeholder*="Nhập chứng từ bán hàng, dịch"]')).toBeVisible();

  // Mode Radios & Checks
  await expect(modal.locator('label:has-text("Giảm trừ công nợ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Trả lại tiền mặt")')).toBeVisible();
  await expect(modal.locator('label:has-text("Kiêm phiếu nhập kho")')).toBeVisible();
  await expect(modal.locator('select:has(option[value="Người bán xuất hóa đơn điều chỉnh"])')).toHaveValue('Người bán xuất hóa đơn điều chỉnh');

  // Upper Tab: Giảm trừ công nợ
  await expect(modal.locator('button:text-is("Giảm trừ công nợ")')).toBeVisible();
  await expect(modal.locator('text=Mã khách hàng')).toBeVisible();
  await expect(modal.locator('text=Tên khách hàng')).toBeVisible();
  await expect(modal.locator('text=Địa chỉ')).toBeVisible();
  await expect(modal.locator('text=Nhân viên bán hàng')).toBeVisible();
  await expect(modal.locator('text=Diễn giải')).toBeVisible();
  await expect(modal.locator('text=Tham chiếu ...')).toBeVisible();

  // Right Column
  await expect(modal.locator('text=Ngày hạch toán')).toBeVisible();
  await expect(modal.locator('text=Ngày chứng từ')).toBeVisible();
  await expect(modal.locator('text=Số chứng từ')).toBeVisible();
  await expect(modal.locator('input[value="BTL00001"]')).toBeVisible();

  // Sub-tabs: Hàng tiền
  await expect(modal.locator('button:text-is("Hàng tiền")')).toBeVisible();
  await expect(modal.locator('button:text-is("Giá vốn")')).toBeVisible();
  await expect(modal.locator('text=Gợi ý hồ sơ')).toBeVisible();
  await expect(modal.locator('span:text-is("Chiết khấu")')).toBeVisible();

  // Table Columns
  await expect(modal.locator('th:has-text("Mã hàng")')).toBeVisible();
  await expect(modal.locator('th:has-text("Tên hàng")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK trả lại")')).toBeVisible();
  await expect(modal.locator('th:has-text("ĐVT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số lượng")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("Đơn giá")')).toBeVisible();
  await expect(modal.locator('th:has-text("Thành tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("% thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Số CT bán h...")')).toBeVisible();

  // Controls Below Table
  await expect(modal.locator('button:has-text("Thêm dòng")')).toBeVisible();
  await expect(modal.locator('button:has-text("Xóa hết dòng")')).toBeVisible();
  await expect(modal.locator('button:has-text("Thêm ghi chú")')).toBeVisible();
  await expect(modal.locator('text=Số đơn hàng từ hệ thống khác')).toBeVisible();
  await expect(modal.locator('text=Sàn thương mại điện tử')).toBeVisible();
  await expect(modal.locator('text=Tên shop')).toBeVisible();
  await expect(modal.locator('text=Mã cửa hàng')).toBeVisible();
  await expect(modal.locator('text=Tên cửa hàng')).toBeVisible();
  await expect(modal.locator('text=Không lên bảng kê thuế GTGT')).toBeVisible();
  await expect(modal.locator('text=Mã tra cứu HĐĐT')).toBeVisible();
  await expect(modal.locator('text=Đường dẫn tra cứu HĐĐT')).toBeVisible();
  await expect(modal.locator('text=Đính kèm')).toBeVisible();

  // Right Totals
  await expect(modal.locator('span:text-is("Tổng tiền hàng")')).toBeVisible();
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền thanh toán")').first()).toBeVisible();

  // Footer
  await expect(modal.locator('text=Hiển thị tài khoản')).toBeVisible();
  await expect(modal.locator('button:text-is("Hủy")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất và Thêm")')).toBeVisible();

  // Capture Screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_btl_debt.png') });
  console.log('Captured sale_return_btl_debt.png');

  // =========================================================================
  // 3. SCREENSHOT 2: BTL00001 (Giảm trừ công nợ - Tab Phiếu nhập)
  // =========================================================================
  console.log('3. Verifying Screenshot 2: BTL00001 (Phiếu nhập)...');
  await modal.locator('button:text-is("Phiếu nhập")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Người giao hàng')).toBeVisible();
  await expect(modal.locator('text=Số phiếu nhập')).toBeVisible();
  await expect(modal.locator('input[value="NK00001"]')).toBeVisible();
  await expect(modal.locator('text=Kèm theo')).toBeVisible();
  await expect(modal.locator('text=Chứng từ gốc')).toBeVisible();

  // Capture Screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_btl_inward.png') });
  console.log('Captured sale_return_btl_inward.png');

  // =========================================================================
  // 4. SCREENSHOT 3: BTL00001 (Giảm trừ công nợ - Tab Hóa đơn)
  // =========================================================================
  console.log('4. Verifying Screenshot 3: BTL00001 (Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('label:text-is("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Ký hiệu HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Ngày HĐ")')).toBeVisible();

  // Capture Screenshot 3
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_btl_invoice.png') });
  console.log('Captured sale_return_btl_invoice.png');

  // =========================================================================
  // 5. SCREENSHOT 4: PC00001 (Trả lại tiền mặt - Tab Phiếu chi)
  // =========================================================================
  console.log('5. Verifying Screenshot 4: PC00001 (Trả lại tiền mặt - Phiếu chi)...');
  await modal.locator('input[type="radio"]').nth(1).check();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại PC00001');
  await expect(modal.locator('button:text-is("Phiếu chi")')).toBeVisible();

  await expect(modal.locator('text=Người nhận')).toBeVisible();
  await expect(modal.locator('text=Lý do chi')).toBeVisible();
  await expect(modal.locator('text=Ngày phiếu chi')).toBeVisible();
  await expect(modal.locator('input[value="PC00001"]')).toBeVisible();

  // Check Cash Table Columns (TK trả lại, TK tiền, Diễn giải thuế)
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("Diễn giải thuế")')).toBeVisible();

  // Capture Screenshot 4
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_pc_cash.png') });
  console.log('Captured sale_return_pc_cash.png');

  // =========================================================================
  // 6. SCREENSHOT 5: PC00001 (Trả lại tiền mặt - Tab Phiếu nhập)
  // =========================================================================
  console.log('6. Verifying Screenshot 5: PC00001 (Trả lại tiền mặt - Phiếu nhập)...');
  await modal.locator('button:text-is("Phiếu nhập")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('text=Người giao hàng')).toBeVisible();
  await expect(modal.locator('text=Số phiếu nhập')).toBeVisible();
  await expect(modal.locator('input[value="NK00001"]')).toBeVisible();

  // Capture Screenshot 5
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_pc_inward.png') });
  console.log('Captured sale_return_pc_inward.png');

  // =========================================================================
  // 7. SCREENSHOT 6: PC00001 (Trả lại tiền mặt - Tab Hóa đơn - new screenshot)
  // =========================================================================
  console.log('7. Verifying Screenshot 6: PC00001 (Trả lại tiền mặt - Tab Hóa đơn)...');
  await modal.locator('button:text-is("Hóa đơn")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng bị trả lại PC00001');
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('label:text-is("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Ký hiệu HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Số HĐ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Ngày HĐ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("Diễn giải thuế")')).toBeVisible();

  // Capture Screenshot 6
  await page.screenshot({ path: path.join(artifactDir, 'sale_return_pc_invoice.png') });
  console.log('Captured sale_return_pc_invoice.png');
});
