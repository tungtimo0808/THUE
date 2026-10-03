import { test, expect } from '@playwright/test';

test('Verify General Ledger (Tổng hợp) - Báo cáo tab matching screenshot', async ({ page }) => {
  // 1. Direct navigate to Báo cáo tab in General Ledger
  await page.goto('http://localhost:5173/ledger/reports');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check active subtab
  const activeTab = page.locator('.ref-module-bar a[href*="/ledger/reports"]').first();
  await expect(activeTab).toBeVisible();

  // Verify Top Bar elements
  const searchInput = page.locator('input[placeholder="Tìm theo tên báo cáo"]').first();
  await expect(searchInput).toBeVisible();

  const aiLink = page.locator('text=Tìm kiếm nhanh báo cáo với AVA Kế toán').first();
  await expect(aiLink).toBeVisible();

  await expect(page.locator('text=Ngôn ngữ báo cáo').first()).toBeVisible();
  await expect(page.locator('button:has-text("Ẩn/hiện báo cáo")').first()).toBeVisible();

  // Verify Group 1: Yêu thích
  await expect(page.locator('h3:has-text("Yêu thích")').first()).toBeVisible();
  await expect(page.locator('text=Tổng hợp công nợ theo đối tượng').first()).toBeVisible();
  await expect(page.locator('text=Sổ nhật ký chung').first()).toBeVisible();
  await expect(page.locator('text=Tổng hợp công nợ nhân viên').first()).toBeVisible();
  await expect(page.locator('text=Sổ chi tiết các tài khoản').first()).toBeVisible();

  // Verify Group 2: Báo cáo tài chính (Expanded)
  await expect(page.locator('text=Báo cáo tài chính').first()).toBeVisible();
  await expect(page.locator('text=Bảng cân đối tài khoản (Mẫu quản trị)').first()).toBeVisible();
  await expect(page.locator('text=B09 - DN: Thuyết minh báo cáo tài chính').first()).toBeVisible();
  await expect(page.locator('text=Tình hình thực hiện nghĩa vụ với nhà nước').first()).toBeVisible();
  await expect(page.locator('text=B01a - DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)').first()).toBeVisible();
  await expect(page.locator('text=B01 - DN: Báo cáo tình hình tài chính').first()).toBeVisible();
  await expect(page.locator('text=B02a - DN: Báo cáo kết quả hoạt động kinh doanh giữa niên độ (Dạng đầy đủ)').first()).toBeVisible();
  await expect(page.locator('text=B02 - DN: Báo cáo kết quả hoạt động kinh doanh').first()).toBeVisible();
  await expect(page.locator('text=B03a - DN: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP trực tiếp)').first()).toBeVisible();
  await expect(page.locator('text=B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)').first()).toBeVisible();
  await expect(page.locator('text=B03a - DN - GT: Báo cáo lưu chuyển tiền tệ giữa niên độ (Dạng đầy đủ - PP gián tiếp)').first()).toBeVisible();

  // Verify Groups 3-6 headers
  await expect(page.locator('text=Sổ sách kế toán').first()).toBeVisible();
  await expect(page.locator('text=Báo cáo tổng hợp theo tài khoản').first()).toBeVisible();
  await expect(page.locator('text=Báo cáo chi phí, lãi lỗ').first()).toBeVisible();
  await expect(page.locator('text=Báo cáo công nợ').first()).toBeVisible();

  // Capture Full Page Screenshot Matching User Reference
  await page.screenshot({ path: 'tests/screenshots/ledger_reports_tab.png', fullPage: true });

  // Test expanding another group, e.g. "Sổ sách kế toán"
  await page.locator('text=Sổ sách kế toán').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Sổ cái các tài khoản').first()).toBeVisible();

  // Test Search Filter
  await searchInput.fill('lưu chuyển tiền tệ');
  await page.waitForTimeout(300);
  await expect(page.locator('text=B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)').first()).toBeVisible();
});
