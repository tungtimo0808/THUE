import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify service sales voucher (Chứng từ bán dịch vụ BH00001 & PT00001) across all states', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/34228585-6a25-46bc-8dee-c2f4db7aac4a');

  console.log('Navigating to sales transactions...');
  await page.goto('http://127.0.0.1:5173/sales/transactions?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Open "+ Thêm" dropdown and select "Chứng từ bán dịch vụ"
  const themBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
  await expect(themBtn).toBeVisible();
  const dropdownTrigger = themBtn.locator('xpath=following-sibling::button').first();
  await dropdownTrigger.click();
  await page.waitForTimeout(400);

  const serviceSaleItem = page.locator('div:text-is("Chứng từ bán dịch vụ")');
  await expect(serviceSaleItem).toBeVisible();
  await serviceSaleItem.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-purchase-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // STATE 1: Bán dịch vụ - Chưa thu tiền + Chứng từ ghi nợ (BH00001)
  // =========================================================================
  console.log('Verifying Service State 1: Chưa thu tiền + Chứng từ ghi nợ (BH00001)');
  await expect(modal.locator('h2')).toContainText('Chứng từ bán dịch vụ BH00001');
  await expect(modal.locator('button:has-text("Chứng từ ghi nợ")')).toBeVisible();
  await expect(modal.locator('button:has-text("Hóa đơn")')).toBeVisible();
  await expect(modal.locator('button:has-text("Phiếu xuất")')).toHaveCount(0);
  await expect(modal.locator('label:has-text("Kiêm phiếu xuất")')).toHaveCount(0);
  await expect(modal.locator('label:has-text("Lập kèm hóa đơn")')).toBeVisible();

  // Master form fields
  await expect(modal.locator('label:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Người liên hệ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Địa chỉ")')).toBeVisible();
  await expect(modal.locator('label:has-text("Nhân viên bán hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Diễn giải")')).toBeVisible();
  await expect(modal.locator('button:has-text("Tham chiếu ...")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toBeVisible();

  // Accounts in table: TK công nợ (131) and TK doanh thu (511)
  await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK doanh thu")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK thuế GTGT")')).toHaveCount(0);
  await expect(modal.locator('table input[value="131"]')).toBeVisible();
  await expect(modal.locator('table input[value="511"]')).toBeVisible();

  // Summary box
  await expect(modal.locator('span:text-is("Tổng tiền dịch vụ")')).toBeVisible();
  await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(modal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_service_sale_1_ghi_no.png') });
  console.log('Captured state_service_sale_1_ghi_no.png');

  // =========================================================================
  // STATE 2: Bán dịch vụ - Chưa thu tiền + Hóa đơn (BH00001)
  // =========================================================================
  console.log('Verifying Service State 2: Chưa thu tiền + Hóa đơn (BH00001)');
  await modal.locator('button:has-text("Hóa đơn")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán dịch vụ BH00001');
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
  await expect(modal.locator('label:has-text("Tài khoản ngân hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_service_sale_2_hoa_don.png') });
  console.log('Captured state_service_sale_2_hoa_don.png');

  // =========================================================================
  // STATE 3: Bán dịch vụ - Thu tiền ngay + Phiếu thu (PT00001)
  // =========================================================================
  console.log('Verifying Service State 3: Thu tiền ngay + Phiếu thu (PT00001)');
  await modal.locator('label:has-text("Thu tiền ngay")').click();
  await page.waitForTimeout(400);

  await modal.locator('button:has-text("Phiếu thu")').click();
  await page.waitForTimeout(300);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán dịch vụ PT00001');
  await expect(modal.locator('label:has-text("Người nộp")')).toBeVisible();
  await expect(modal.locator('label:has-text("Lý do nộp")')).toBeVisible();
  await expect(modal.locator('input[value="Thu tiền bán hàng"]')).toBeVisible();
  await expect(modal.locator('label:has-text("Kèm theo")')).toBeVisible();
  await expect(modal.locator('label:has-text("Số phiếu thu")')).toBeVisible();
  await expect(modal.locator('input[value="PT00001"]')).toBeVisible();

  // Payment terms must NOT be visible when collected now
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toHaveCount(0);

  // Accounts in table: TK tiền (111) and TK doanh thu (5113)
  await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK doanh thu")')).toBeVisible();
  await expect(modal.locator('th:has-text("TK công nợ")')).toHaveCount(0);
  await expect(modal.locator('table input[value="111"]')).toBeVisible();
  await expect(modal.locator('table input[value="5113"]')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_service_sale_3_phieu_thu.png') });
  console.log('Captured state_service_sale_3_phieu_thu.png');

  // =========================================================================
  // STATE 4: Bán dịch vụ - Thu tiền ngay + Hóa đơn (PT00001)
  // =========================================================================
  console.log('Verifying Service State 4: Thu tiền ngay + Hóa đơn (PT00001)');
  await modal.locator('button:has-text("Hóa đơn")').click();
  await page.waitForTimeout(400);

  await expect(modal.locator('h2')).toContainText('Chứng từ bán dịch vụ PT00001');
  // For collected_now with Tiền mặt, bank account is omitted
  await expect(modal.locator('label:has-text("Tài khoản ngân hàng")')).toHaveCount(0);
  await expect(modal.locator('label:has-text("Điều khoản thanh toán")')).toHaveCount(0);
  await expect(modal.locator('table input[value="111"]')).toBeVisible();
  await expect(modal.locator('table input[value="5113"]')).toBeVisible();

  await page.screenshot({ path: path.join(artifactDir, 'state_service_sale_4_hoa_don_thu_ngay.png') });
  console.log('Captured state_service_sale_4_hoa_don_thu_ngay.png');
});
