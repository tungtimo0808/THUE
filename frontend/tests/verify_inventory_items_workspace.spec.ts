import { test, expect } from '@playwright/test';
import * as path from 'path';

test('verify sales inventory items workspace (Hàng hóa, dịch vụ) and nature drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const artifactDir = path.resolve('C:/Users/timodapoet/.gemini/antigravity-ide/brain/43251ce8-0215-4e8b-8307-1aa88ffee55b');

  // 1. Navigate to sales inventory-items tab
  console.log('1. Navigating to /sales/inventory-items...');
  await page.goto('http://localhost:5173/sales/inventory-items?company=minh-an&period=2026-09');
  await page.waitForTimeout(1000);

  // =========================================================================
  // SCREENSHOT 1: LISTING & STAT CARDS
  // =========================================================================
  console.log('2. Verifying Screenshot 1: Hàng hóa, dịch vụ listing...');

  // Breadcrumb
  await expect(page.locator('text=Lấy lại danh mục')).toBeVisible();

  // Stat cards
  await expect(page.locator('text=Hàng hóa sắp hết hàng')).toBeVisible();
  await expect(page.locator('button:text-is("Bấm vào để lọc")')).toBeVisible();
  await expect(page.locator('text=Hàng hóa hết hàng')).toBeVisible();

  // Toolbar search & buttons
  const searchInput = page.locator('input[placeholder="Tìm kiếm"]').first();
  await expect(searchInput).toBeVisible();

  const addBtn = page.locator('button:has(span:text-is("Thêm"))');
  await expect(addBtn).toBeVisible();

  // Table headers
  await expect(page.locator('th:text-is("Tên")')).toBeVisible();
  await expect(page.locator('th:text-is("Mã")')).toBeVisible();
  await expect(page.locator('th:text-is("Giảm thuế theo quy định")')).toBeVisible();
  await expect(page.locator('th:text-is("Tính chất")')).toBeVisible();
  await expect(page.locator('th:text-is("Số lượng tồn")')).toBeVisible();
  await expect(page.locator('th:text-is("Giá trị tồn")')).toBeVisible();
  await expect(page.locator('th:text-is("Chức năng")')).toBeVisible();

  // Table row: CPMH
  await expect(page.locator('td:text-is("Chi phí mua hàng")')).toBeVisible();
  await expect(page.locator('td:text-is("CPMH")')).toBeVisible();
  await expect(page.locator('td:has-text("Chưa xác định")')).toBeVisible();
  await expect(page.locator('td:text-is("Dịch vụ")')).toBeVisible();
  await expect(page.locator('td:text-is("0,00")').first()).toBeVisible();

  // Total summary row
  await expect(page.locator('td:text-is("Tổng")')).toBeVisible();

  // Footer total
  await expect(page.locator('text=Tổng số:')).toBeVisible();

  // Capture Screenshot 1
  await page.screenshot({ path: path.join(artifactDir, 'inventory_items_listing.png') });
  console.log('Captured inventory_items_listing.png');

  // =========================================================================
  // SCREENSHOT 2: NATURE DRAWER (Chọn tính chất hàng hóa dịch vụ)
  // =========================================================================
  console.log('3. Clicking Thêm to open Chọn tính chất hàng hóa dịch vụ drawer...');
  await addBtn.click();
  await page.waitForTimeout(400);

  const drawer = page.locator('.misa-nature-drawer-window');
  await expect(drawer).toBeVisible();

  // Verify Drawer Title
  await expect(drawer.locator('h2')).toContainText('Chọn tính chất hàng hóa dịch vụ');

  // Verify all 6 nature cards
  await expect(drawer.locator('h4:text-is("Hàng hóa")')).toBeVisible();
  await expect(drawer.locator('text=Sản phẩm bạn mua và bán lại cho khách hàng')).toBeVisible();

  await expect(drawer.locator('h4:text-is("Dịch vụ")')).toBeVisible();
  await expect(drawer.locator('text=Dịch vụ mà bạn cung cấp cho khách hàng')).toBeVisible();

  await expect(drawer.locator('h4:text-is("Nguyên vật liệu")')).toBeVisible();
  await expect(drawer.locator('text=Nguyên liệu đầu vào dùng cho hoạt động sản xuất, xây dựng, cung cấp dịch vụ')).toBeVisible();

  await expect(drawer.locator('h4:text-is("Thành phẩm")')).toBeVisible();
  await expect(drawer.locator('text=Là sản phẩm đầu ra của quá trình sản xuất')).toBeVisible();

  await expect(drawer.locator('h4:text-is("Công cụ dụng cụ")')).toBeVisible();
  await expect(drawer.locator('text=Công cụ dụng cụ mua về nhập kho chưa đưa vào sử dụng')).toBeVisible();

  await expect(drawer.locator('h4:text-is("Combo sản phẩm")')).toBeVisible();
  await expect(drawer.locator('text=Các sản phẩm, hàng hóa được bán theo combo')).toBeVisible();

  // Capture Screenshot 2
  await page.screenshot({ path: path.join(artifactDir, 'inventory_items_nature_drawer.png') });
  console.log('Captured inventory_items_nature_drawer.png');

  console.log('All inventory items workspace tests verified successfully!');
});
