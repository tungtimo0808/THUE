import { test, expect } from "@playwright/test";

test.describe("MISA Budget (Ngân sách) Module Workflow", () => {
  test("Budget flyout, charts, planning landing, period modal, and reports", async ({ page }) => {
    // 1. Navigate to main page
    await page.goto("http://localhost:5173/budget");
    await page.waitForLoadState("networkidle");

    // 2. Test Left Sidebar Flyout Popover on "Ngân sách" (Screenshot 1)
    const budgetNav = page.locator('a.ref-nav-item:has-text("Ngân sách")');
    await expect(budgetNav).toBeVisible();
    await budgetNav.hover();
    await page.waitForTimeout(400);

    // Verify Flyout Popover is visible
    const flyout = page.locator(".misa-flyout-card");
    await expect(flyout).toBeVisible();
    await expect(flyout.locator('h4:has-text("Nghiệp vụ")')).toBeVisible();
    await expect(flyout.locator('a:has-text("Biểu đồ")')).toBeVisible();
    await expect(flyout.locator('a:has-text("Kế hoạch ngân sách")')).toBeVisible();
    await expect(flyout.locator('h4:has-text("Tiện ích")')).toBeVisible();
    await expect(flyout.locator('a:has-text("Thiết lập ngày bắt đầu năm ngân sách")')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/budget_1_flyout.png" });

    // Click "Biểu đồ" to navigate to charts view (Screenshot 2)
    await flyout.locator('a:has-text("Biểu đồ")').click();
    await page.waitForTimeout(300);

    // Verify subtabs: Biểu đồ (active), Kế hoạch ngân sách, Báo cáo
    const navBar = page.locator('.ref-module-bar nav');
    const chartsSubtab = navBar.locator('a:has-text("Biểu đồ")');
    await expect(chartsSubtab).toHaveClass(/active/);
    await expect(navBar.locator('a:has-text("Kế hoạch ngân sách")')).toBeVisible();
    await expect(navBar.locator('a:has-text("Báo cáo")')).toBeVisible();

    // Verify Filters Bar: Đơn vị (Tung), Năm (2026), Tùy chỉnh button
    await expect(page.locator('.misa-budget-filter-item:has-text("Đơn vị")')).toBeVisible();
    await expect(page.locator('.misa-budget-year-input')).toHaveValue("2026");
    await expect(page.locator('.misa-budget-btn-custom:has-text("Tùy chỉnh")')).toBeVisible();

    // Verify Semicircle Gauges in Row 1
    await expect(page.getByRole("heading", { name: "Tình hình thực hiện doanh thu", exact: true })).toBeVisible();
    await expect(page.locator('.misa-budget-card-title:has-text("Tình hình thực hiện chi phí")')).toBeVisible();
    await expect(page.locator('.misa-budget-card-title:has-text("Tình hình thực hiện lợi nhuận")')).toBeVisible();

    // Verify Monthly Charts in Row 2 & 3
    await expect(page.locator('.misa-budget-card-title:has-text("Doanh thu thực hiện so với kế hoạch")')).toBeVisible();
    await expect(page.locator('.misa-budget-card-title:has-text("Chi phí thực hiện so với kế hoạch")')).toBeVisible();
    await expect(page.locator('.misa-budget-card-title:has-text("Lợi nhuận thực hiện so với kế hoạch")')).toBeVisible();
    await expect(page.locator('.misa-budget-card-title:has-text("Tình hình thực hiện doanh thu theo đơn vị")')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/budget_2_charts.png" });

    // 3. Tab 2: Kế hoạch ngân sách (Screenshot 3)
    await navBar.locator('a:has-text("Kế hoạch ngân sách")').click();
    await page.waitForTimeout(300);

    // Verify Landing View
    await expect(page.locator(".misa-budget-landing-title")).toContainText(
      "Lập kế hoạch ngân sách để theo dõi tình hình doanh thu, chi phí, lợi nhuận thực tế so với kế hoạch"
    );
    const addBtn = page.locator('.misa-budget-btn-primary:has-text("Thêm")');
    await expect(addBtn).toBeVisible();
    const viewListBtn = page.locator('.misa-budget-landing-bottom-btn:has-text("Xem danh sách chứng từ")');
    await expect(viewListBtn).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/budget_3_planning_landing.png" });

    // 4. Modal: Chọn kỳ lập kế hoạch (Screenshot 4)
    await addBtn.click();
    await page.waitForTimeout(300);

    const modal = page.locator(".misa-budget-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator('.misa-budget-modal-title:has-text("Chọn kỳ lập kế hoạch")')).toBeVisible();
    await expect(modal.locator('.misa-budget-field-label:has-text("Năm")')).toBeVisible();
    await expect(modal.locator('.misa-budget-field-label:has-text("Từ")')).toBeVisible();
    await expect(modal.locator('.misa-budget-field-label:has-text("Đến")')).toBeVisible();
    await expect(modal.locator('.misa-budget-field-label:has-text("Lập kế hoạch theo *")')).toBeVisible();
    await expect(modal.locator('text=Kế hoạch ngân sách chi tiết theo đơn vị')).toBeVisible();
    await expect(modal.locator('button:has-text("Hủy")')).toBeVisible();
    await expect(modal.locator('button:has-text("Đồng ý")')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/budget_4_period_modal.png" });

    // Click "Đồng ý"
    await modal.locator('button:has-text("Đồng ý")').click();
    await page.waitForTimeout(300);

    // Verify it opened the 12-month spreadsheet plan editor
    await expect(page.locator("text=Bảng kế hoạch ngân sách năm 2027")).toBeVisible();
    await expect(page.locator("text=I. TỔNG DOANH THU & THU NHẬP")).toBeVisible();
    await expect(page.locator("text=II. TỔNG CHI PHÍ HOẠT ĐỘNG")).toBeVisible();
    await expect(page.locator("text=III. LỢI NHUẬN DỰ KIẾN (I - II)")).toBeVisible();

    // Click "Lưu kế hoạch"
    await page.locator('button:has-text("Lưu kế hoạch")').click();
    await page.waitForTimeout(300);

    // Verify voucher list view
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("td:has-text('KHNS00')").first()).toBeVisible();

    // 5. Tab 3: Báo cáo (Screenshot 5)
    await navBar.locator('a:has-text("Báo cáo")').click();
    await page.waitForTimeout(300);

    // Verify Search, AVA AI, and Reports grid
    await expect(page.locator('input[placeholder="Tìm theo tên báo cáo"]')).toBeVisible();
    await expect(page.locator('text=Tìm kiếm nhanh báo cáo với AVA Kế toán')).toBeVisible();
    await expect(page.locator('text=Ngôn ngữ báo cáo')).toBeVisible();

    // Verify the 4 exact reports
    await expect(page.locator('.misa-budget-report-name:has-text("Kế hoạch ngân sách")')).toBeVisible();
    await expect(page.locator('.misa-budget-report-name:has-text("Tình hình thực hiện ngân sách")')).toBeVisible();
    await expect(page.locator('.misa-budget-report-name:has-text("Tình hình thực hiện doanh thu so với kế hoạch")')).toBeVisible();
    await expect(page.locator('.misa-budget-report-name:has-text("Tình hình chi phí thực tế so với kế hoạch")')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/budget_5_reports.png" });

    // Click report to view modal preview
    await page.locator('.misa-budget-report-name:has-text("Kế hoạch ngân sách")').click();
    await page.waitForTimeout(300);

    const reportModal = page.locator(".misa-budget-modal");
    await expect(reportModal.locator('h3:has-text("Kế hoạch ngân sách")')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/budget_6_report_preview.png" });

    await reportModal.locator('button:has-text("Đóng")').click();
    await page.waitForTimeout(200);

    // 6. Test Settings Modal (Thiết lập ngày bắt đầu năm ngân sách)
    await page.goto("http://localhost:5173/budget/charts?action=settings");
    await page.waitForTimeout(300);
    const settingsModal = page.locator(".misa-budget-modal");
    await expect(settingsModal.locator('h3:has-text("Thiết lập ngày bắt đầu năm ngân sách")')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/budget_7_settings_modal.png" });

    await settingsModal.locator('button:has-text("Lưu")').click();
    await page.waitForTimeout(300);
  });
});
