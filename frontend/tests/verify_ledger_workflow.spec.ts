import { test, expect } from '@playwright/test';

test('Verify General (Tổng hợp) Quy trình, Popups and Flyout', async ({ page }) => {
  // 1. Direct navigate to Tổng hợp Quy trình
  await page.goto('http://localhost:5173/ledger/process');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  // Check top tabs
  await expect(page.locator('a:has-text("Quy trình")').first()).toBeVisible();
  await expect(page.locator('a:has-text("Đề nghị quyết toán tạm ứng")').first()).toBeVisible();
  await expect(page.locator('a:has-text("Chứng từ nghiệp vụ khác")').first()).toBeVisible();
  await expect(page.locator('a:has-text("Kết chuyển lãi lỗ")').first()).toBeVisible();
  await expect(page.locator('a:has-text("Lập báo cáo tài chính")').first()).toBeVisible();
  await expect(page.locator('a:has-text("Báo cáo")').first()).toBeVisible();

  // Check main card "NGHIỆP VỤ TỔNG HỢP"
  await expect(page.locator('text=NGHIỆP VỤ TỔNG HỢP').first()).toBeVisible();

  // Check 6 Workflow Nodes
  await expect(page.locator('text=Đề nghị quyết').first()).toBeVisible();
  await expect(page.locator('text=Quyết toán').first()).toBeVisible();
  await expect(page.locator('text=Chứng từ').first()).toBeVisible();
  await expect(page.locator('text=Kết chuyển').first()).toBeVisible();
  await expect(page.locator('text=Khóa sổ kỳ').first()).toBeVisible();
  await expect(page.locator('text=Lập báo cáo').first()).toBeVisible();

  // Check Right Box "BÁO CÁO"
  await expect(page.locator('div:text-is("BÁO CÁO")').first()).toBeVisible();
  await expect(page.locator('text=Sổ chi tiết các tài khoản').first()).toBeVisible();
  await expect(page.locator('text=Sổ nhật ký chung').first()).toBeVisible();
  await expect(page.locator('text=Tổng hợp công nợ nhân viên').first()).toBeVisible();
  await expect(page.locator('text=Tổng hợp công nợ theo đối tượng').first()).toBeVisible();
  await expect(page.locator('text=B01a-DN: Báo cáo tình hình tài chính giữa niên độ (Dạng đầy đủ)').first()).toBeVisible();
  await expect(page.locator('a:has-text("Tất cả báo cáo")').first()).toBeVisible();

  // Check 5 Action Cards
  await expect(page.locator('text=Hệ thống tài khoản').first()).toBeVisible();
  await expect(page.locator('text=Mã thống kê').first()).toBeVisible();
  await expect(page.locator('text=Khoản mục chi phí').first()).toBeVisible();
  await expect(page.locator('span:text-is("Tiện ích")').first()).toBeVisible();
  await expect(page.locator('text=Tùy chọn').first()).toBeVisible();

  // Check AMIS Quy trình banner and 3 Story Cards
  await expect(page.locator('text=AMIS Quy trình').first()).toBeVisible();
  await expect(page.locator('text=CÂU CHUYỆN SỐ HÓA THÀNH CÔNG NỔI BẬT').first()).toBeVisible();
  await expect(page.locator('text=Doanh nghiệp nhỏ có thể tự động hóa nhờ...').first()).toBeVisible();
  await expect(page.locator('text=Lợi ích của việc tự động hóa quy trình đối v...').first()).toBeVisible();
  await expect(page.locator('text=Hành trình số hóa quy trình tại Đông Dươn...').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/ledger_process_overview.png', fullPage: true });

  // 2. Click Node "Khóa sổ kỳ kế toán" to open Popover 1 (Image 1)
  const lockNode = page.locator('div:has-text("Khóa sổ kỳ")').last();
  await lockNode.click();
  await page.waitForTimeout(300);

  // Verify popover items
  await expect(page.locator('text=Bỏ khóa sổ kỳ kế toán').first()).toBeVisible();
  await expect(page.locator('text=Khóa sổ/Bỏ khóa sổ theo Loại chứng từ').first()).toBeVisible();
  await expect(page.locator('text=Thiết lập khóa sổ tự động').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/ledger_lock_popover.png' });

  // Open modal from popover: "Khóa sổ kỳ kế toán"
  await page.locator('div:text-is("Khóa sổ kỳ kế toán")').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Khóa sổ đến ngày:').first()).toBeVisible();
  await page.locator('button:text-is("Hủy bỏ")').first().click();
  await page.waitForTimeout(300);

  // 3. Click Node "Lập báo cáo tài chính" to open Popover 2 (Image 2)
  const statementNode = page.locator('div:has-text("Lập báo cáo")').last();
  await statementNode.click();
  await page.waitForTimeout(300);

  // Verify popover items
  await expect(page.locator('div:text-is("Báo cáo tài chính")').first()).toBeVisible();
  await expect(page.locator('div:text-is("Thuyết minh báo cáo tài chính")').first()).toBeVisible();
  await expect(page.locator('div:text-is("Báo cáo tài chính giữa niên độ")').first()).toBeVisible();
  await expect(page.locator('div:text-is("Thuyết minh báo cáo tài chính giữa niên độ")').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/ledger_statement_popover.png' });

  // Close popover by clicking outside
  await page.mouse.click(50, 50);
  await page.waitForTimeout(300);

  // 4. Test Subtabs Navigation
  // Tab: Đề nghị quyết toán tạm ứng (Screenshot match)
  await page.locator('.ref-module-bar a[href*="/ledger/advance-settlement-request"]').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=LUỒNG QUY TRÌNH TỰ ĐỘNG HÓA ĐỀ NGHỊ QUYẾT TOÁN TẠM ỨNG').first()).toBeVisible();
  await expect(page.locator('text=Hệ thống liên thông thông suốt giữa AMIS Quy trình và AMIS Kế toán').first()).toBeVisible();
  await expect(page.locator('text=Nhân viên lập đề nghị quyết toán tạm ứng trên AMIS Quy trình').first()).toBeVisible();
  await expect(page.locator('text=Giám đốc/Kế toán phê duyệt').first()).toBeVisible();
  await expect(page.locator('text=Đồng bộ đề nghị về AMIS Kế toán').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/advance_settlement_workflow.png', fullPage: true });

  // Test modal "Thiết lập tự động"
  await page.locator('button:has-text("Thiết lập tự động")').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Thiết lập tự động hóa đề nghị quyết toán tạm ứng').first()).toBeVisible();
  await page.locator('button:text-is("Hủy bỏ")').first().click();
  await page.waitForTimeout(300);

  // Tab: Chứng từ nghiệp vụ khác
  await page.locator('.ref-module-bar a[href*="/ledger/transactions"]').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Lập chứng từ nghiệp vụ khác: Vay tiền ngân hàng để trả NCC').first()).toBeVisible();
  await page.locator('button:text-is("Xem danh sách chứng từ")').first().click({ force: true });
  await page.waitForTimeout(400);
  await expect(page.locator('text=PKT00001').first()).toBeVisible();
  await expect(page.locator('text=Trích khấu hao tài sản cố định tháng 10/2026').first()).toBeVisible();

  // Tab: Kết chuyển lãi lỗ
  await page.locator('a:has-text("Kết chuyển lãi lỗ")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=KC001').first()).toBeVisible();
  await expect(page.locator('text=Kết chuyển doanh thu bán hàng').first()).toBeVisible();

  // Tab: Lập báo cáo tài chính
  await page.locator('a:has-text("Lập báo cáo tài chính")').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=B01-DN').first()).toBeVisible();
  await expect(page.locator('text=B02-DN').first()).toBeVisible();

  // Tab: Báo cáo
  await page.locator('.ref-module-bar a[href*="/ledger/reports"]').first().click();
  await page.waitForTimeout(400);
  await expect(page.locator('text=Thư viện Báo cáo Tổng hợp & Sổ cái').first()).toBeVisible();

  // 5. Test Sidebar Flyout (Image 3)
  const sidebarLedgerItem = page.locator('.ref-nav-item:has-text("Tổng hợp")').first();
  await sidebarLedgerItem.hover();
  await page.waitForTimeout(500);

  // Verify flyout is visible
  const flyout = page.locator('.misa-flyout-card');
  if (await flyout.isVisible()) {
    await expect(flyout.locator('h4:text-is("Nghiệp vụ")')).toBeVisible();
    await expect(flyout.locator('h4:text-is("Tiện ích")')).toBeVisible();
    await expect(flyout.locator('text=Đánh giá lại tài khoản ngoại tệ')).toBeVisible();
    await expect(flyout.locator('text=Phân bổ chi phí bán hàng, quản lý doanh nghiệp, khác')).toBeVisible();
    await expect(flyout.locator('text=Khóa sổ/Bỏ khóa sổ theo Loại chứng từ')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/ledger_sidebar_flyout.png' });
  }
});
