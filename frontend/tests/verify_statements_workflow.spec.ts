import { test, expect } from '@playwright/test';

test('Verify General Ledger (Tổng hợp) - Lập báo cáo tài chính landing page & 4 categories', async ({ page }) => {
  // 1. Direct navigate to Lập báo cáo tài chính
  await page.goto('http://localhost:5173/ledger/statements');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check active subtab
  const activeTab = page.locator('.ref-module-bar a[href*="/ledger/statements"]').first();
  await expect(activeTab).toBeVisible();

  // Verify Landing Page Elements (Matching Screenshot 1)
  const heading = page.locator('text=Lập báo cáo tài chính cuối kỳ để cung cấp thông tin về tình hình tài chính, kết quả kinh doanh và các luồng tiền trong kỳ').first();
  await expect(heading).toBeVisible();

  const splitBtn = page.locator('[data-testid="statement-split-btn"]');
  await expect(splitBtn).toBeVisible();

  const viewRecordsBtn = page.getByRole('button', { name: 'Xem danh sách chứng từ' }).first();
  await expect(viewRecordsBtn).toBeVisible();

  // Open the dropdown menu on Landing Page
  await splitBtn.click();
  await page.waitForTimeout(300);

  // Verify 4 dropdown items (Matching Screenshot 1)
  const opt1 = page.locator('[data-testid="statement-opt-bctc"]');
  const opt2 = page.locator('[data-testid="statement-opt-thuyet-minh"]');
  const opt3 = page.locator('[data-testid="statement-opt-midyear"]');
  const opt4 = page.locator('[data-testid="statement-opt-midyear-thuyet-minh"]');

  await expect(opt1).toBeVisible();
  await expect(opt2).toBeVisible();
  await expect(opt3).toBeVisible();
  await expect(opt4).toBeVisible();

  // Capture Screenshot 1: Landing Page with 4-Item Dropdown
  await page.screenshot({ path: 'tests/screenshots/statement_01_landing_view.png', fullPage: true });

  // ---------------------------------------------------------------------------
  // 2. Click Option 1: "Báo cáo tài chính" (Matching Screenshot 2)
  // ---------------------------------------------------------------------------
  await opt1.click();
  await page.waitForTimeout(400);

  // Verify Modal 1 Title & Content
  await expect(page.locator('text=Chọn tham số: Báo cáo tài chính').first()).toBeVisible();
  await expect(page.locator('text=Doanh nghiệp đáp ứng giả định hoạt động liên tục').first()).toBeVisible();
  await expect(page.locator('text=Doanh nghiệp không đáp ứng giả định hoạt động liên tục').first()).toBeVisible();
  await expect(page.locator('text=Chọn báo cáo tài chính').first()).toBeVisible();
  await expect(page.locator('text=B01 - DN').first()).toBeVisible();
  await expect(page.locator('text=B02 - DN').first()).toBeVisible();
  await expect(page.locator('text=B03 - DN').first()).toBeVisible();
  await expect(page.locator('text=B03 - DN - GT').first()).toBeVisible();
  await expect(page.locator('button:text-is("Hủy")').last()).toBeVisible();
  await expect(page.locator('button:text-is("Đồng ý")').last()).toBeVisible();

  // Capture Screenshot 2: Modal Option 1
  await page.screenshot({ path: 'tests/screenshots/statement_02_bctc_modal.png' });

  // Close modal via "Hủy"
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------------------
  // 3. Open Dropdown & Click Option 2: "Thuyết minh báo cáo tài chính" (Matching Screenshot 3)
  // ---------------------------------------------------------------------------
  await splitBtn.click();
  await page.waitForTimeout(300);
  await opt2.click();
  await page.waitForTimeout(400);

  // Verify Modal 2 Title & Content
  await expect(page.locator('text=Chọn tham số: Thuyết minh báo cáo tài chính').first()).toBeVisible();
  await expect(page.locator('text=Lấy thông tin chung từ lần nhập gần nhất').first()).toBeVisible();

  // Capture Screenshot 3: Modal Option 2
  await page.screenshot({ path: 'tests/screenshots/statement_03_thuyet_minh_bctc_modal.png' });

  // Close modal via "Hủy"
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------------------
  // 4. Open Dropdown & Click Option 3: "Báo cáo tài chính giữa niên độ" (Matching Screenshot 4)
  // ---------------------------------------------------------------------------
  await splitBtn.click();
  await page.waitForTimeout(300);
  await opt3.click();
  await page.waitForTimeout(400);

  // Verify Modal 3 Title & Content
  await expect(page.locator('text=Chọn tham số: Báo cáo tài chính giữa niên độ').first()).toBeVisible();
  await expect(page.locator('text=B01a - DN').first()).toBeVisible();
  await expect(page.locator('text=B02a - DN').first()).toBeVisible();
  await expect(page.locator('text=B03a - DN').first()).toBeVisible();
  await expect(page.locator('text=B03a - DN - GT').first()).toBeVisible();
  await expect(page.locator('text=Từ ngày').first()).toBeVisible();
  await expect(page.locator('text=Đến ngày').first()).toBeVisible();

  // Capture Screenshot 4: Modal Option 3
  await page.screenshot({ path: 'tests/screenshots/statement_04_bctc_giua_nien_do_modal.png' });

  // Close modal via "Hủy"
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------------------
  // 5. Open Dropdown & Click Option 4: "Thuyết minh báo cáo tài chính giữa niên độ" (Matching Screenshot 5)
  // ---------------------------------------------------------------------------
  await splitBtn.click();
  await page.waitForTimeout(300);
  await opt4.click();
  await page.waitForTimeout(400);

  // Verify Modal 4 Title & Content
  await expect(page.locator('text=Chọn tham số: Thuyết minh báo cáo tài chính giữa niên độ').first()).toBeVisible();
  await expect(page.locator('text=Lấy thông tin chung từ lần nhập gần nhất').first()).toBeVisible();

  // Capture Screenshot 5: Modal Option 4
  await page.screenshot({ path: 'tests/screenshots/statement_05_thuyet_minh_giua_nien_do_modal.png' });

  // Close modal via "Hủy"
  await page.locator('button:text-is("Hủy")').last().click();
  await page.waitForTimeout(300);

  // ---------------------------------------------------------------------------
  // 6. Test Toggle: Landing View -> Statement Table -> Landing View
  // ---------------------------------------------------------------------------
  await viewRecordsBtn.scrollIntoViewIfNeeded();
  await viewRecordsBtn.click();
  await page.waitForTimeout(400);

  await expect(page.locator('text=Danh sách Báo cáo tài chính đã lập').first()).toBeVisible();
  await expect(page.locator('text=B01-DN').first()).toBeVisible();
  await expect(page.locator('text=B02-DN').first()).toBeVisible();

  // Capture Screenshot 6: Statement Table View
  await page.screenshot({ path: 'tests/screenshots/statement_06_table_view.png', fullPage: true });

  // Click back to Landing View
  const backBtn = page.getByRole('button', { name: 'Quay lại giao diện chính' }).first();
  await backBtn.click();
  await page.waitForTimeout(300);

  await expect(heading).toBeVisible();
});
