import { test, expect } from '@playwright/test';

test('Verify General (Tổng hợp) Chứng từ nghiệp vụ khác landing, dropdown and 6 voucher types', async ({ page }) => {
  // 1. Direct navigate to Chứng từ nghiệp vụ khác
  await page.goto('http://localhost:5173/ledger/transactions');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check active subtab
  const activeTab = page.locator('.ref-module-bar a[href*="/ledger/transactions"]').first();
  await expect(activeTab).toBeVisible();

  // Verify Landing Page Elements (Matching Screenshot 1)
  await expect(page.locator('text=Lập chứng từ nghiệp vụ khác: Vay tiền ngân hàng để trả NCC').first()).toBeVisible();
  await expect(page.locator('button:has-text("Thêm bằng AI")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Thêm")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Nhập từ Excel")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Xem danh sách chứng từ")').first()).toBeVisible();

  // Capture Landing Page Screenshot
  await page.screenshot({ path: 'tests/screenshots/transactions_landing_view.png', fullPage: true });

  // 2. Click "Thêm" button to open Popover (Matching Screenshot 2 & the 6 types)
  const addBtn = page.locator('[data-testid="add-voucher-dropdown-btn"]').first();
  await addBtn.click();
  await page.waitForTimeout(300);

  // Verify Popover Items
  await expect(page.locator('div:text-is("Chứng từ nghiệp vụ khác")').first()).toBeVisible();
  await expect(page.locator('text=1. Hạch toán thuế TNDN phải nộp').first()).toBeVisible();
  await expect(page.locator('text=2. Vay ngân hàng chuyển trả cho nhà cung cấp').first()).toBeVisible();
  await expect(page.locator('text=3. Hạch toán chi phí lương').first()).toBeVisible();
  await expect(page.locator('text=4. Khác').first()).toBeVisible();
  await expect(page.locator('text=5. Kết chuyển lãi lỗ đầu năm').first()).toBeVisible();
  await expect(page.locator('text=6. Khấu trừ thuế tiêu thụ đặc biệt').first()).toBeVisible();
  await expect(page.locator('div:text-is("Quyết toán tạm ứng")').first()).toBeVisible();

  // Capture Dropdown Popover Screenshot
  await page.screenshot({ path: 'tests/screenshots/transactions_dropdown_popover.png' });

  // 3. Test Type 1: Click "1. Hạch toán thuế TNDN phải nộp" -> opens modal matching Screenshot 1
  await page.locator('text=1. Hạch toán thuế TNDN phải nộp').first().click();
  await page.waitForTimeout(400);

  // Verify Modal 1
  await expect(page.locator('text=Chứng từ nghiệp vụ khác NVK00001').first()).toBeVisible();
  await expect(page.locator('input[value="8211"]').first()).toBeVisible();
  await expect(page.locator('input[value="3334"]').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_1_tndn.png' });

  // 4. Test Switching to Type 2 via Selector Pill (Matching Screenshot 2)
  const pillBtn = page.locator('[data-testid="voucher-type-pill"]').first();
  await pillBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:has-text("2. Vay ngân hàng chuyển trả cho nhà cung cấp")').last().click();
  await page.waitForTimeout(400);

  await expect(page.locator('text=Hạn thanh toán').first()).toBeVisible();
  await expect(page.locator('text=Khế ước vay').first()).toBeVisible();
  await expect(page.locator('input[value="331"]').first()).toBeVisible();
  await expect(page.locator('input[value="3411"]').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_2_bank_loan.png' });

  // 5. Test Switching to Type 3 (Matching Screenshot 3)
  await pillBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:has-text("3. Hạch toán chi phí lương")').last().click();
  await page.waitForTimeout(400);

  await expect(page.locator('text=Khoản mục CP').first()).toBeVisible();
  await expect(page.locator('text=Đơn vị').first()).toBeVisible();
  await expect(page.locator('text=Đối tượng THCP').first()).toBeVisible();
  await expect(page.locator('input[value="334"]').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_3_salary.png' });

  // 6. Test Switching to Type 4 (Matching Screenshot 4 & 5)
  await pillBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:has-text("4. Khác")').last().click();
  await page.waitForTimeout(400);

  await expect(page.locator('text=Kê khai hóa đơn và hạch toán thuế').first()).toBeVisible();
  await expect(page.locator('text=Hạch toán gộp nhiều hóa đơn').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_4_other.png' });

  // Click second tab in Type 4
  await page.locator('text=Kê khai hóa đơn và hạch toán thuế').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Tiền chưa thuế').first()).toBeVisible();
  await expect(page.locator('text=Tiền thuế GTGT').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_4_tax_invoices.png' });

  // 7. Test Switching to Type 5 (Kết chuyển lãi lỗ đầu năm)
  await pillBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:has-text("5. Kết chuyển lãi lỗ đầu năm")').last().click();
  await page.waitForTimeout(400);
  await expect(page.locator('input[value="4212"]').first()).toBeVisible();
  await expect(page.locator('input[value="4211"]').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_5_profit_loss.png' });

  // 8. Test Switching to Type 6 (Khấu trừ thuế tiêu thụ đặc biệt - Matching Screenshot 6)
  await pillBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:has-text("6. Khấu trừ thuế tiêu thụ đặc biệt")').last().click();
  await page.waitForTimeout(400);
  await expect(page.locator('input[value="3332"]').first()).toBeVisible();
  await expect(page.locator('input[value="1383"]').first()).toBeVisible();
  await expect(page.locator('text=Hạn thanh toán').first()).toBeVisible();
  await expect(page.locator('text=Nghiệp vụ').first()).toBeVisible();
  await expect(page.locator('text=Đối tượng Nợ').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/voucher_type_6_excise_tax.png' });

  // Close modal via Hủy button
  await page.locator('button:text-is("Hủy")').first().click();
  await page.waitForTimeout(300);

  // 9. Click "Thêm" button again and select "Quyết toán tạm ứng" -> opens advance settlement modal
  await addBtn.click();
  await page.waitForTimeout(300);
  await page.locator('div:text-is("Quyết toán tạm ứng")').first().click();
  await page.waitForTimeout(400);

  // Verify elements matching the user screenshot
  await expect(page.locator('text=Chứng từ quyết toán tạm ứng').first()).toBeVisible();
  await expect(page.locator('text=QTTU00001').first()).toBeVisible();
  await expect(page.locator('text=Quyết toán cho từng lần tạm ứng').first()).toBeVisible();
  await expect(page.locator('input[value="141"]').first()).toBeVisible();
  await expect(page.locator('text=F9 - Thêm nhanh').first()).toBeVisible();
  await expect(page.locator('button:has-text("Cất và Thêm")').first()).toBeVisible();

  // Capture Screenshot of Advance Settlement Modal
  await page.screenshot({ path: 'tests/screenshots/voucher_advance_settlement.png' });

  // Close modal via Hủy
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(400);

  // 10. Test "Xem danh sách chứng từ" bottom button -> switches to table view
  const viewTableBtn = page.locator('button:text-is("Xem danh sách chứng từ")').first();
  await viewTableBtn.scrollIntoViewIfNeeded();
  await viewTableBtn.click({ force: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tests/screenshots/after_click_view_table.png' });
  await expect(page.locator('text=PKT00001').first()).toBeVisible();
  await expect(page.locator('text=Trích khấu hao tài sản cố định tháng 10/2026').first()).toBeVisible();

  // Test "Quay lại giao diện chính"
  await page.locator('button:has-text("Quay lại giao diện chính")').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Lập chứng từ nghiệp vụ khác: Vay tiền ngân hàng để trả NCC').first()).toBeVisible();

  // 11. Test "Thêm bằng AI" modal
  await page.locator('button:has-text("Thêm bằng AI")').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Trợ lý AI AVA - Tự động lập chứng từ').first()).toBeVisible();
  await page.locator('button:text-is("Hủy bỏ")').first().click();
});
