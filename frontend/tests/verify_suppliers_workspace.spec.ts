import { test, expect } from "@playwright/test";

test("verify suppliers tab, individual form, item mapping, and utility modals in purchases", async ({ page }) => {
  // Navigate to purchases/suppliers
  await page.goto("http://localhost:5173/purchases/suppliers");

  // Check tab 'Nhà cung cấp' is visible and selected
  const supplierTab = page.locator('nav a:has-text("Nhà cung cấp")');
  await expect(supplierTab).toBeVisible();
  await expect(supplierTab).toHaveClass(/active/);

  // Check breadcrumb
  await expect(page.locator('text=Tất cả danh mục')).toBeVisible();

  // Check summary statistics cards
  await expect(page.locator('text=Nợ quá hạn')).toBeVisible();
  await expect(page.locator('text=Tổng nợ phải trả')).toBeVisible();
  await expect(page.locator('text=17.000.000').first()).toBeVisible();
  await expect(page.locator('text=Đã thanh toán (30 ngày gần đây)')).toBeVisible();
  await expect(page.locator('text=10.000.000')).toBeVisible();

  // Check table columns
  await expect(page.locator('th:has-text("Mã nhà cung cấp")')).toBeVisible();
  await expect(page.locator('th:has-text("Tên nhà cung cấp")')).toBeVisible();
  await expect(page.locator('th:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
  await expect(page.locator('th:has-text("Điện thoại")')).toBeVisible();
  await expect(page.locator('th:has-text("Chức năng")')).toBeVisible();

  // Check sample row
  await expect(page.locator('td:has-text("NCC00001")')).toBeVisible();
  await expect(page.locator('td:has-text("Tran Thi Huong")')).toBeVisible();
  await expect(page.locator('td:has-text("030178006908")')).toBeVisible();
  await expect(page.locator('td:has-text("097775611")')).toBeVisible();

  // Take screenshot of table
  await page.screenshot({ path: "tests/screenshots/suppliers_table.png" });

  // Click "Thêm" button to open "Thông tin nhà cung cấp" modal
  await page.locator('[data-testid="btn-add-supplier"]').click();

  // Check modal header and fields (Tổ chức)
  await expect(page.locator('h3:has-text("Thông tin nhà cung cấp")')).toBeVisible();
  await expect(page.locator('label:has-text("Tổ chức")')).toBeVisible();
  await expect(page.locator('label:has-text("Cá nhân")')).toBeVisible();
  await expect(page.locator('label:has-text("Là khách hàng")')).toBeVisible();
  await expect(page.locator('label:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
  await expect(page.locator('label:has-text("Mã nhà cung cấp")')).toBeVisible();
  await expect(page.locator('label:has-text("Tên nhà cung cấp")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_modal_org.png" });

  // Switch to "Cá nhân" (Individual) radio
  await page.locator('label:has-text("Cá nhân")').click();
  await expect(page.locator('label:has-text("Số CCCD/CMND")')).toBeVisible();
  await expect(page.locator('label:has-text("Ngày cấp")')).toBeVisible();
  await expect(page.locator('label:has-text("Nơi cấp")')).toBeVisible();
  await expect(page.locator('label:has-text("Mã số thuế cá nhân")')).toBeVisible();
  await expect(page.locator('label:has-text("ĐT di động")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_modal_individual.png" });

  // Check Subtab: "Hàng hóa, dịch vụ cung cấp"
  const itemTabBtn = page.locator('button:has-text("Hàng hóa, dịch vụ cung cấp")');
  await expect(itemTabBtn).toBeVisible();
  await itemTabBtn.click();
  await expect(page.locator('text=Danh mục Hàng hóa, dịch vụ cung cấp')).toBeVisible();
  await expect(page.locator('button:has-text("Thêm hàng hóa, dịch vụ")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_modal_items.png" });

  // Close modal
  await page.locator('button:has-text("Hủy")').click();

  // Check "Tiện ích ▾" dropdown on suppliers toolbar
  const utilityBtn = page.locator('button:has-text("Tiện ích")').first();
  await expect(utilityBtn).toBeVisible();
  await utilityBtn.click();
  await expect(page.getByText('Đối trừ chứng từ', { exact: true })).toBeVisible();
  await expect(page.getByText('Đối trừ chứng từ nhiều đối tượng', { exact: true })).toBeVisible();
  await expect(page.getByText('Bỏ đối trừ', { exact: true })).toBeVisible();
  await expect(page.getByText('Bỏ đối trừ chứng từ nhiều đối tượng', { exact: true })).toBeVisible();
  await expect(page.getByText('Bù trừ công nợ', { exact: true })).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_utilities_menu.png" });

  // Click "Đối trừ chứng từ"
  await page.getByText('Đối trừ chứng từ', { exact: true }).click();
  await expect(page.locator('h2:has-text("Đối trừ chứng từ")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_debt_offset_modal.png" });
  await page.locator('button[title*="Đóng"]').click();

  // Open "Bù trừ công nợ"
  await utilityBtn.click();
  await page.getByText('Bù trừ công nợ', { exact: true }).click();
  await expect(page.locator('h2:has-text("Bù trừ công nợ")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/supplier_debt_clearing_modal.png" });
  await page.locator('button[title*="Đóng"]').click();
});
