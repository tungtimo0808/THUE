import { test, expect } from '@playwright/test';

test('Verify Cost Tabs: projects, orders, contracts, reports', async ({ page }) => {
  // 1. Direct navigate to Công trình
  await page.goto('http://localhost:5173/cost/projects');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check guide banner
  await expect(page.locator('text=Bạn chưa biết tính giá thành trên phần mềm?').first()).toBeVisible();

  // Check 5 subtabs
  await expect(page.locator('button:has-text("Kỳ tính giá")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Kết chuyển chi phí")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Nghiệm thu công trình")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Định mức nguyên vật liệu")').first()).toBeVisible();
  await expect(page.locator('button:has-text("Dự toán công trình")').first()).toBeVisible();

  // Open "Thêm kỳ tính giá thành" modal by clicking the green "Thêm" button in empty state
  const addBtn = page.locator('div:has-text("Thêm kỳ tính giá thành để tập hợp chi phí")').locator('button:text-is("Thêm")').first();
  await addBtn.click();
  await page.waitForTimeout(500);

  // Verify modal is open
  await expect(page.locator('h3:has-text("Thêm kỳ tính giá thành")').first()).toBeVisible();

  // Click "Lấy dữ liệu" inside modal
  const fetchBtn = page.locator('button:has-text("Lấy dữ liệu")').first();
  await fetchBtn.click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=CT-SKYTOWER').first()).toBeVisible();

  // Close modal with Hủy
  await page.locator('button:text-is("Hủy")').first().click();
  await page.waitForTimeout(400);

  // Click "Xem danh sách chứng từ"
  await page.locator('button:has-text("Xem danh sách chứng từ")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Danh sách kỳ tính giá thành công trình').first()).toBeVisible();
  await expect(page.locator('text=KGT-CT-2026-10').first()).toBeVisible();

  // Return to main
  await page.locator('button:has-text("Quay lại giao diện chính")').first().click();
  await page.waitForTimeout(400);

  // Switch to "Dự toán công trình" subtab
  await page.locator('button:has-text("Dự toán công trình")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Khai báo dự toán chi phí cho từng công trình').first()).toBeVisible();

  // 2. Direct navigate to Đơn hàng
  await page.goto('http://localhost:5173/cost/orders');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await expect(page.locator('text=Lũy kế phát sinh cho đơn hàng kỳ trước').first()).toBeVisible();
  await expect(page.locator('text=Thêm kỳ tính giá thành để tập hợp chi phí và tính giá thành cho từng đơn hàng').first()).toBeVisible();

  // 3. Direct navigate to Hợp đồng
  await page.goto('http://localhost:5173/cost/contracts');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await expect(page.locator('text=Lũy kế phát sinh cho hợp đồng kỳ trước').first()).toBeVisible();

  // Switch to Kết chuyển chi phí in Hợp đồng
  await page.locator('button:has-text("Kết chuyển chi phí")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Kết chuyển toàn bộ chi phí sản xuất đã phát sinh trong kỳ từ TK 621, 622, 627 sang TK 154 theo từng hợp đồng bán').first()).toBeVisible();

  // Switch to Nghiệm thu hợp đồng
  await page.locator('button:has-text("Nghiệm thu hợp đồng")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Kết chuyển giá vốn hợp đồng từ TK 154 sang TK 632 khi thực hiện nghiệm thu hợp đồng').first()).toBeVisible();

  // 4. Direct navigate to Báo cáo
  await page.goto('http://localhost:5173/cost/reports');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  await expect(page.locator('text=Yêu thích').first()).toBeVisible();
  await expect(page.locator('text=Sản xuất liên tục').first()).toBeVisible();
  await expect(page.locator('text=S36-DN: Sổ chi phí sản xuất, kinh doanh').first()).toBeVisible();
  await expect(page.locator('text=Giá thành công trình').first()).toBeVisible();
  await expect(page.locator('text=Giá thành đơn hàng').first()).toBeVisible();
  await expect(page.locator('text=Giá thành hợp đồng').first()).toBeVisible();
  await expect(page.locator('text=Báo cáo đối chiếu').first()).toBeVisible();

  console.log('ALL 4 TABS AND WORKFLOWS VALIDATED PERFECTLY!');
});
