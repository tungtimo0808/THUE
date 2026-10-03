import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sale invoices redesign across all 4 screenshot modes', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // =========================================================================
  // 1. OPEN SALE INVOICE MODAL
  // =========================================================================
  console.log('1. Navigating to sales invoices tab...');
  await page.goto('http://localhost:5173/sales/invoices?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Click "Thêm" button on invoices landing page
  const themBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await themBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // 2. SCREENSHOT 1: Hóa đơn bán hàng hóa, dịch vụ trong nước
  // =========================================================================
  console.log('2. Verifying Mode 1: Hóa đơn bán hàng hóa, dịch vụ trong nước (Screenshot 1)...');
  await expect(modal.locator('h2')).toContainText('Hóa đơn bán hàng hóa, dịch vụ trong nước');
  await expect(modal.locator('text=CHƯA PHÁT HÀNH')).toBeVisible();

  // Master Form Fields
  await expect(modal.locator('text=Mã khách hàng')).toBeVisible();
  await expect(modal.locator('text=Tên khách hàng')).toBeVisible();
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('text=Mã số ĐVQHNS')).toBeVisible();
  await expect(modal.locator('text=Số CCCD')).toBeVisible();
  await expect(modal.locator('text=Số hộ chiếu')).toBeVisible();
  await expect(modal.locator('text=Địa chỉ')).toBeVisible();
  await expect(modal.locator('text=Điện thoại')).toBeVisible();
  await expect(modal.locator('text=Email')).toBeVisible();
  await expect(modal.locator('text=Người mua hàng')).toBeVisible();
  await expect(modal.locator('text=Ngày sinh')).toBeVisible();
  await expect(modal.locator('text=Hình thức thanh toán')).toBeVisible();
  await expect(modal.locator('text=Tài khoản ngân hàng')).toBeVisible();
  await expect(modal.locator('text=Nhân viên bán hàng')).toBeVisible();
  await expect(modal.locator('text=Tỉnh/Thành phố')).toBeVisible();
  await expect(modal.locator('text=Xã/Phường')).toBeVisible();
  await expect(modal.locator('text=Tham chiếu')).toBeVisible();
  await expect(modal.locator('text=Đã hạch toán')).toBeVisible();

  // Invoice Metadata
  await expect(modal.locator('text=Mẫu số HĐ')).toBeVisible();
  await expect(modal.locator('text=Ký hiệu HĐ')).toBeVisible();
  await expect(modal.locator('text=Số hóa đơn')).toBeVisible();
  await expect(modal.locator('text=Ngày HĐ')).toBeVisible();

  // Table Columns Check for Mode 1
  await expect(modal.locator('th:has-text("Chiết khấu thương mại")')).toBeVisible();
  await expect(modal.locator('th:has-text("% thuế GTGT")')).toBeVisible();
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();

  // Below-table Controls Check
  await expect(modal.locator('text=Số đơn hàng từ hệ thống khác')).toBeVisible();
  await expect(modal.locator('text=Sàn thương mại điện tử')).toBeVisible();
  await expect(modal.locator('text=Tên shop')).toBeVisible();
  await expect(modal.locator('text=Ngày giao hàng thành công')).toBeVisible();
  await expect(modal.locator('text=Mã cửa hàng')).toBeVisible();
  await expect(modal.locator('text=Tên cửa hàng')).toBeVisible();
  await expect(modal.locator('text=Là hóa đơn thay thế')).toBeVisible();

  // Summary Totals
  await expect(modal.locator('span:text-is("Tổng tiền hàng")')).toBeVisible();
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();

  // Capture screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'sale_invoice_mode1_domestic.png') });
  console.log('Captured sale_invoice_mode1_domestic.png');

  // =========================================================================
  // 3. SCREENSHOT 2: Hóa đơn bán hàng xuất khẩu
  // =========================================================================
  console.log('3. Verifying Mode 2: Hóa đơn bán hàng xuất khẩu (Screenshot 2)...');
  await modal.locator('header select').first().selectOption('Hóa đơn bán hàng xuất khẩu');
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Hóa đơn bán hàng xuất khẩu');
  // Should NOT have Chiết khấu thương mại or Tiền thuế GTGT
  await expect(modal.locator('th:has-text("Chiết khấu thương mại")')).toHaveCount(0);
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toHaveCount(0);

  // Export specific: Số hợp đồng | Ngày hợp đồng
  await expect(modal.locator('text=Số hợp đồng')).toBeVisible();
  await expect(modal.locator('text=Ngày hợp đồng')).toBeVisible();

  // Summary Totals: Only Tổng tiền hàng and Tổng tiền thanh toán (NO Thuế GTGT)
  await expect(modal.locator('span:text-is("Tổng tiền hàng")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();

  // Capture screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'sale_invoice_mode2_export.png') });
  console.log('Captured sale_invoice_mode2_export.png');

  // =========================================================================
  // 4. SCREENSHOT 3: Hóa đơn bán hàng đại lý bán đúng giá
  // =========================================================================
  console.log('4. Verifying Mode 3: Hóa đơn bán hàng đại lý bán đúng giá (Screenshot 3)...');
  await modal.locator('header select').first().selectOption('Hóa đơn bán hàng đại lý bán đúng giá');
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Hóa đơn bán hàng đại lý bán đúng giá');
  // NO Chiết khấu thương mại, but HAS Tiền thuế GTGT
  await expect(modal.locator('th:has-text("Chiết khấu thương mại")')).toHaveCount(0);
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();
  await expect(modal.locator('text=Là hóa đơn thay thế')).toBeVisible();

  // Summary Totals has Thuế GTGT
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();

  // Capture screenshot 3
  await page.screenshot({ path: path.join(artifactDir, 'sale_invoice_mode3_agency.png') });
  console.log('Captured sale_invoice_mode3_agency.png');

  // =========================================================================
  // 5. SCREENSHOT 4: Hóa đơn bán hàng ủy thác xuất khẩu
  // =========================================================================
  console.log('5. Verifying Mode 4: Hóa đơn bán hàng ủy thác xuất khẩu (Screenshot 4)...');
  await modal.locator('header select').first().selectOption('Hóa đơn bán hàng ủy thác xuất khẩu');
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Hóa đơn bán hàng ủy thác xuất khẩu');
  // NO Chiết khấu thương mại, NO Tiền thuế GTGT
  await expect(modal.locator('th:has-text("Chiết khấu thương mại")')).toHaveCount(0);
  await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toHaveCount(0);
  // HAS Số hợp đồng | Ngày hợp đồng
  await expect(modal.locator('text=Số hợp đồng')).toBeVisible();
  await expect(modal.locator('text=Ngày hợp đồng')).toBeVisible();

  // Summary Totals has Thuế GTGT
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();

  // Capture screenshot 4
  await page.screenshot({ path: path.join(artifactDir, 'sale_invoice_mode4_trustee_export.png') });
  console.log('Captured sale_invoice_mode4_trustee_export.png');

  console.log('All 4 sale invoice modes verified successfully!');
});
