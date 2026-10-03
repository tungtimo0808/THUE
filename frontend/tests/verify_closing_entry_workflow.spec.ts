import { test, expect } from '@playwright/test';

test('Verify General (Tổng hợp) Kết chuyển lãi lỗ landing view, voucher modal and table view', async ({ page }) => {
  // 1. Direct navigate to Kết chuyển lãi lỗ
  await page.goto('http://localhost:5173/ledger/closing-entry');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check active subtab
  const activeTab = page.locator('.ref-module-bar a[href*="/ledger/closing-entry"]').first();
  await expect(activeTab).toBeVisible();

  // Verify Landing Page Elements (Matching Screenshot 2)
  await expect(
    page.locator('text=Lập chứng từ kết chuyển doanh thu, chi phí, lãi lỗ để xác định kết quả kinh doanh trong kỳ').first()
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm bằng AI' })).toBeVisible();
  const addBtn = page.getByRole('button', { name: 'Thêm', exact: true });
  await expect(addBtn).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xem danh sách chứng từ' })).toBeVisible();

  // Capture Landing Page Screenshot
  await page.screenshot({ path: 'tests/screenshots/closing_entry_landing_view.png', fullPage: true });

  // 2. Click "Thêm" button -> Opens Modal (Matching Screenshot 1)
  await addBtn.click();
  await page.waitForTimeout(400);

  // Verify Modal Elements (Matching Screenshot 1)
  await expect(page.locator('text=Kết chuyển lãi lỗ NVK00001').first()).toBeVisible();
  await expect(page.locator('text=Kết chuyển đến ngày').first()).toBeVisible();
  await expect(page.locator('button:has-text("Lấy dữ liệu")').first()).toBeVisible();
  await expect(page.locator('input[value="Kết chuyển lãi lỗ đến ngày 31/10/2026"]').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu ...').first()).toBeVisible();
  await expect(page.locator('text=Không có dữ liệu').first()).toBeVisible();
  await expect(page.locator('button:has-text("Cất và In")').first()).toBeVisible();

  // Capture Screenshot of Empty Modal (Matching Screenshot 1)
  await page.screenshot({ path: 'tests/screenshots/closing_entry_modal_empty.png' });

  // 3. Click "Lấy dữ liệu" -> Populates closing rows
  await page.locator('button:has-text("Lấy dữ liệu")').first().click();
  await page.waitForTimeout(400);

  await expect(page.locator('input[value*="Kết chuyển Doanh thu bán hàng"]').first()).toBeVisible();
  await expect(page.locator('input[value="511"]').first()).toBeVisible();
  await expect(page.locator('input[value="911"]').first()).toBeVisible();

  // Capture Screenshot of Populated Modal
  await page.screenshot({ path: 'tests/screenshots/closing_entry_modal_populated.png' });

  // 4. Close modal via "Hủy"
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(300);

  // 5. Click "Xem danh sách chứng từ"
  const viewTableBtn = page.getByRole('button', { name: 'Xem danh sách chứng từ' }).first();
  await viewTableBtn.scrollIntoViewIfNeeded();
  await viewTableBtn.click({ force: true });
  await page.waitForTimeout(400);

  // Verify Table View
  await expect(page.locator('text=KC001').first()).toBeVisible();
  await expect(page.locator('text=Quay lại giao diện chính').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/closing_entry_table_view.png' });

  // 6. Return to landing view
  await page.locator('button:has-text("Quay lại giao diện chính")').first().click();
  await page.waitForTimeout(300);
  await expect(
    page.locator('text=Lập chứng từ kết chuyển doanh thu, chi phí, lãi lỗ để xác định kết quả kinh doanh trong kỳ').first()
  ).toBeVisible();
});
