import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify customer modal (Thông tin khách hàng) both Tổ chức and Cá nhân modes', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // 1. Navigate to sales customers tab
  console.log('1. Navigating to /sales/customers...');
  await page.goto('http://localhost:5173/sales/customers?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // Verify background elements
  await expect(page.locator('text=Tất cả danh mục')).toBeVisible();
  await expect(page.locator('button:text-is("Xem danh sách chứng từ")')).toBeVisible();

  // Click "+ Thêm" button in customer workspace
  console.log('2. Clicking + Thêm button to open customer modal...');
  const addBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await page.waitForTimeout(600);

  const modal = page.locator('.misa-customer-modal-window');
  await expect(modal).toBeVisible();

  // =========================================================================
  // SCREENSHOT 1: MODE TỔ CHỨC
  // =========================================================================
  console.log('3. Verifying Screenshot 1: Thông tin khách hàng (Tổ chức)...');
  await expect(modal.locator('h2')).toContainText('Thông tin khách hàng');

  // Radios: Tổ chức is checked
  const orgRadio = modal.locator('input[type="radio"]').first();
  await expect(orgRadio).toBeChecked();
  await expect(modal.locator('text=Là nhà cung cấp')).toBeVisible();

  // Master fields
  await expect(modal.locator('text=Mã số thuế/CCCD chủ hộ')).toBeVisible();
  await expect(modal.locator('text=Mã số ĐVQHNS')).toBeVisible();
  await expect(modal.locator('text=Mã khách hàng')).toBeVisible();
  await expect(modal.locator('text=Điện thoại')).toBeVisible();
  await expect(modal.locator('label:text-is("Website")')).toBeVisible();
  await expect(modal.locator('label:has-text("Tên khách hàng")')).toBeVisible();
  await expect(modal.locator('label:text-is("Nhóm khách hàng")')).toBeVisible();
  await expect(modal.locator('label:text-is("Địa chỉ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Nhân viên bán hàng")')).toBeVisible();
  await expect(modal.locator('text=Là Đối tượng nội bộ')).toBeVisible();

  // Tabs
  await expect(modal.locator('button:text-is("Thông tin liên hệ")')).toBeVisible();
  await expect(modal.locator('button:text-is("Điều khoản thanh toán")')).toBeVisible();
  await expect(modal.locator('button:text-is("Tài khoản ngân hàng")')).toBeVisible();
  await expect(modal.locator('button:text-is("Địa chỉ khác")')).toBeVisible();
  await expect(modal.locator('button:text-is("Ghi chú")')).toBeVisible();
  await expect(modal.locator('button:text-is("Thông tin bổ sung")')).toBeVisible();

  // Lower section content: Organization contact
  await expect(modal.locator('label:text-is("Người liên hệ")')).toBeVisible();
  await expect(modal.locator('label:text-is("Đại diện theo PL")')).toBeVisible();
  await expect(modal.locator('label:text-is("Người nhận hóa đơn điện tử")')).toBeVisible();
  await expect(modal.locator('input[placeholder*="Ngăn cách nhiều email"]')).toBeVisible();

  // Footer buttons
  await expect(modal.locator('button:text-is("Hủy")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất")')).toBeVisible();
  await expect(modal.locator('button:text-is("Cất và Thêm")')).toBeVisible();

  // Capture Screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'customer_modal_organization.png') });
  console.log('Captured customer_modal_organization.png');

  // =========================================================================
  // SCREENSHOT 2: MODE CÁ NHÂN
  // =========================================================================
  console.log('4. Verifying Screenshot 2: Thông tin khách hàng (Cá nhân)...');
  const indRadio = modal.locator('input[type="radio"]').nth(1);
  await indRadio.click();
  await page.waitForTimeout(400);

  await expect(indRadio).toBeChecked();

  // Master fields for Individual
  await expect(modal.locator('label:text-is("Số CCCD")')).toBeVisible();
  await expect(modal.locator('label:text-is("Ngày cấp")')).toBeVisible();
  await expect(modal.locator('label:text-is("Nơi cấp")')).toBeVisible();
  await expect(modal.locator('label:text-is("Nhóm khách hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Mã khách hàng")')).toBeVisible();
  await expect(modal.locator('label:text-is("Mã số thuế")')).toBeVisible();
  await expect(modal.locator('label:text-is("Nhân viên bán hàng")')).toBeVisible();
  await expect(modal.locator('label:has-text("Tên khách hàng")')).toBeVisible();
  await expect(modal.locator('text=Là Đối tượng nội bộ')).toBeVisible();
  await expect(modal.locator('label:text-is("Địa chỉ")')).toBeVisible();

  // Lower section content: Individual contact
  await expect(modal.locator('label:text-is("Thông tin liên hệ")')).toBeVisible();
  await expect(modal.locator('input[placeholder="Điện thoại di động"]')).toBeVisible();
  await expect(modal.locator('input[placeholder="Điện thoại cố định"]')).toBeVisible();
  await expect(modal.locator('label:text-is("Đại diện theo PL")')).toBeVisible();
  await expect(modal.locator('label:text-is("Số hộ chiếu")')).toBeVisible();

  // Capture Screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'customer_modal_individual.png') });
  console.log('Captured customer_modal_individual.png');

  console.log('All customer modal tests verified successfully!');
});
