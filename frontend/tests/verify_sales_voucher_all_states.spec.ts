import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sales voucher modal across all 5 states', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/34228585-6a25-46bc-8dee-c2f4db7aac4a');

  console.log('Navigating to sales transactions...');
  await page.goto('http://127.0.0.1:5173/sales/transactions?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Click button "Thêm" or "Thêm chứng từ"
  const themBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await themBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // STATE 1: Chưa thu tiền + Chứng từ ghi nợ (BH00001)
  // =========================================================================
  console.log('Verifying State 1: Chưa thu tiền + Chứng từ ghi nợ');
  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng BH00001');
  await expect(modal.locator('button:has-text("Chứng từ ghi nợ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Người liên hệ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Diễn giải")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày hạch toán")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày chứng từ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số chứng từ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('text=F3 - Tìm nhanh, F9 - Thêm nhanh')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_1_chua_thu_tien_chung_tu_ghi_no.png') });
  console.log('Captured state_1_chua_thu_tien_chung_tu_ghi_no.png');

  // =========================================================================
  // STATE 2: Chưa thu tiền + Phiếu xuất (BH00001)
  // =========================================================================
  console.log('Verifying State 2: Chưa thu tiền + Phiếu xuất');
  await modal.locator('button:has-text("Phiếu xuất")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng BH00001');
  await expect(modal.locator('label:has-text("Người nhận")')).toBeVisible();
  await expect(modal.locator('label:has-text("Lý do xuất")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số phiếu xuất")')).toBeVisible();
  await expect(modal.locator('input[value="XK00001"]')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_2_chua_thu_tien_phieu_xuat.png') });
  console.log('Captured state_2_chua_thu_tien_phieu_xuat.png');

  // =========================================================================
  // STATE 3: Chưa thu tiền + Hóa đơn (BH00001)
  // =========================================================================
  console.log('Verifying State 3: Chưa thu tiền + Hóa đơn');
  await modal.locator('button:has-text("Hóa đơn")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng BH00001');
  await expect(modal.locator('label:has-text("Mã số ĐVQHNS")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số CCCD")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số hộ chiếu")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điện thoại")')).toBeVisible();
  await expect(modal.locator('label:has-text("Email")')).toBeVisible();
  await expect(modal.locator('label:has-text("Người mua hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Hình thức thanh toán")')).toBeVisible();
  await expect(modal.locator('label:has-text("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ký hiệu HĐ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số hóa đơn")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày HĐ")')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_3_chua_thu_tien_hoa_don.png') });
  console.log('Captured state_3_chua_thu_tien_hoa_don.png');

  // =========================================================================
  // STATE 4: Thu tiền ngay + Phiếu thu (PT00001)
  // =========================================================================
  console.log('Verifying State 4: Thu tiền ngay + Phiếu thu');
  await modal.locator('label:has-text("Thu tiền ngay")').click();
  await page.waitForTimeout(400);

  // Switch to main tab
  await modal.locator('button:has-text("Phiếu thu")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng PT00001');
  await expect(modal.locator('label:has-text("Người nộp")')).toBeVisible();
  await expect(modal.locator('label:has-text("Lý do nộp")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số phiếu thu")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày phiếu thu")')).toBeVisible();
  await expect(modal.locator('input[value="PT00001"]')).toBeVisible();
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  // Ensure Điều khoản thanh toán is NOT visible
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toHaveCount(0);

  await page.screenshot({ path: path.join(artifactDir, 'state_4_thu_tien_ngay_phieu_thu.png') });
  console.log('Captured state_4_thu_tien_ngay_phieu_thu.png');

  // =========================================================================
  // STATE 5: Thu tiền ngay + Phiếu xuất (PT00001)
  // =========================================================================
  console.log('Verifying State 5: Thu tiền ngay + Phiếu xuất');
  await modal.locator('button:has-text("Phiếu xuất")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng PT00001');
  await expect(modal.locator('label:has-text("Người nhận")')).toBeVisible();
  await expect(modal.locator('label:has-text("Lý do xuất")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số phiếu xuất")')).toBeVisible();
  await expect(modal.locator('input[value="XK00001"]')).toBeVisible();
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toHaveCount(0);

  await page.screenshot({ path: path.join(artifactDir, 'state_5_thu_tien_ngay_phieu_xuat.png') });
  console.log('Captured state_5_thu_tien_ngay_phieu_xuat.png');

  // =========================================================================
  // STATE 6: Thu tiền ngay + Hóa đơn (PT00001)
  // =========================================================================
  console.log('Verifying State 6: Thu tiền ngay + Hóa đơn');
  await modal.locator('button:has-text("Hóa đơn")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán hàng PT00001');
  await expect(modal.locator('text=Đã lập hóa đơn')).toBeVisible();
  await expect(modal.locator('label:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Mã số ĐVQHNS")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số CCCD")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số hộ chiếu")')).toBeVisible();
  await expect(modal.locator('label:has-text("Địa chỉ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điện thoại")')).toBeVisible();
  await expect(modal.locator('label:has-text("Email")')).toBeVisible();
  await expect(modal.locator('label:has-text("Người mua hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày sinh")')).toBeVisible();
  await expect(modal.locator('label:has-text("Hình thức thanh toán")')).toBeVisible();
  // In Thu tiền ngay + Tiền mặt, Tài khoản ngân hàng is hidden
  await expect(modal.locator('label:has-text("Tài khoản ngân hàng")')).toHaveCount(0);
  // Điều khoản thanh toán is hidden
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toHaveCount(0);
  // Right invoice box
  await expect(modal.locator('label:has-text("Mẫu số HĐ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ký hiệu HĐ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số hóa đơn")')).toBeVisible();
  await expect(modal.locator('label:has-text("Ngày HĐ")')).toBeVisible();
  // Table accounts
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_6_thu_tien_ngay_hoa_don.png') });
  console.log('Captured state_6_thu_tien_ngay_hoa_don.png');

  console.log('All 6 states verified and captured successfully!');
});

