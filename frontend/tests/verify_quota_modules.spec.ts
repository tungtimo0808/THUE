import { test, expect } from "@playwright/test";

test.describe("MISA Reports, Financial Analysis & Opening Balances Modules", () => {
  test("Verify Báo cáo (Report Center)", async ({ page }) => {
    await page.goto("http://localhost:5173/reports");
    await page.waitForLoadState("networkidle");

    // Check subtabs
    await expect(page.locator('.misa-reports-subtab-btn.active')).toHaveText("Tất cả");
    await expect(page.locator('.misa-reports-subtab-btn:has-text("Báo cáo đã lưu")')).toBeVisible();
    await expect(page.locator('.misa-reports-subtab-btn:has-text("Lịch gửi báo cáo định kỳ")')).toBeVisible();

    // Check banner
    await expect(page.locator(".misa-reports-banner")).toBeVisible();

    // Check categories
    await expect(page.locator('.misa-reports-cat-btn:has-text("Yêu thích")')).toBeVisible();
    await expect(page.locator('.misa-reports-cat-btn:has-text("Báo cáo tài chính")')).toBeVisible();
    await expect(page.locator('.misa-reports-cat-btn:has-text("Báo cáo phân tích")')).toBeVisible();
    await expect(page.locator('.misa-reports-cat-btn:has-text("Báo cáo đối chiếu")')).toBeVisible();

    // Check 2-column reports list in Favorites
    await expect(page.locator('.misa-reports-item-link:has-text("Tổng hợp mua hàng theo mặt hàng")')).toBeVisible();
    await expect(page.locator('.misa-reports-item-link:has-text("S37-DN: Thẻ tính giá thành")')).toBeVisible();
    await expect(page.locator('.misa-reports-star-btn.starred').first()).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/misa_reports_full.png" });

    // Open a report preview
    await page.locator('.misa-reports-item-link:has-text("Tổng hợp mua hàng theo mặt hàng")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('h3:has-text("Tổng hợp mua hàng theo mặt hàng")')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/misa_report_preview.png" });
    await page.locator('button:has-text("Đóng")').click();
  });

  test("Verify Phân tích tài chính (Financial Analysis)", async ({ page }) => {
    await page.goto("http://localhost:5173/analysis");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('.misa-analysis-page-title')).toHaveText("Các chỉ số phân tích");
    await expect(page.locator('.misa-analysis-card-title')).toHaveText("Các chỉ số tài chính cơ bản");

    // Check 4 groups
    await expect(page.locator('text=Cơ cấu tài chính và cơ cấu tài sản')).toBeVisible();
    await expect(page.locator('text=Hệ số thanh toán')).toBeVisible();
    await expect(page.locator('text=Khả năng hoạt động')).toBeVisible();
    await expect(page.locator('text=Khả năng sinh lời')).toBeVisible();

    // Check specific ratios
    await expect(page.locator('text=1. Hệ số nợ')).toBeVisible();
    await expect(page.locator('text=1. Hệ số khả năng thanh toán hiện hành')).toBeVisible();
    await expect(page.locator('text=1. Vòng quay hàng tồn kho')).toBeVisible();
    await expect(page.locator('text=1. Tỷ suất lợi nhuận sau thuế trên doanh thu (ROS)')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/misa_financial_analysis.png" });
  });

  test("Verify Nhập số dư ban đầu (Opening Balances Hub & Details)", async ({ page }) => {
    await page.goto("http://localhost:5173/opening");
    await page.waitForLoadState("networkidle");

    // Check Hub title & 10 tiles
    await expect(page.locator('.misa-opening-hub-title')).toHaveText("Nhập số dư ban đầu");
    await expect(page.locator('.misa-opening-tile-label:has-text("Số dư tài khoản")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Số dư TK ngân hàng")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Công nợ khách hàng")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Công nợ nhà cung cấp")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Công nợ nhân viên")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Tồn kho vật tư, hàng hóa và CCDC")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("CCDC đang sử dụng đầu kỳ")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Tài sản cố định đầu kỳ")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Chi phí trả trước đầu kỳ")')).toBeVisible();
    await expect(page.locator('.misa-opening-tile-label:has-text("Chi phí dở dang")')).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/misa_opening_hub.png" });

    // 1. Click "Số dư tài khoản"
    await page.locator('.misa-opening-tile:has-text("Số dư tài khoản")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.misa-opening-heading')).toContainText("nhập số dư đầu kỳ cho các tài khoản");
    await page.screenshot({ path: "tests/screenshots/misa_opening_accounts_landing.png" });

    // Open accounts modal table
    await page.locator('button.misa-opening-btn-primary:has-text("Nhập số dư")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.misa-opening-modal-title:has-text("Nhập số dư tài khoản")')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/misa_opening_accounts_modal.png" });
    await page.getByRole("button", { name: "Đóng", exact: true }).click();

    // Close to return to hub
    await page.locator('.misa-opening-close-btn').click();
    await page.waitForTimeout(200);

    // 2. Click "Công nợ khách hàng"
    await page.locator('.misa-opening-tile:has-text("Công nợ khách hàng")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.misa-opening-heading')).toContainText("nhập số dư công nợ khách hàng");

    // Open customer modal
    await page.locator('button.misa-opening-btn-primary:has-text("Nhập số dư")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.misa-opening-modal-title:has-text("Nhập chi tiết công nợ khách hàng")')).toBeVisible();
    await expect(page.locator('text=Chi tiết theo Hóa đơn')).toBeVisible();
    await expect(page.locator('text=Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/misa_opening_customer_modal.png" });
    await page.locator('button:has-text("Đóng")').click();

    // Close to return to hub
    await page.locator('.misa-opening-close-btn').click();
    await page.waitForTimeout(200);

    // 3. Click "Chi phí dở dang"
    await page.locator('.misa-opening-tile:has-text("Chi phí dở dang")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('button:has-text("Đối tượng tập hợp chi phí")')).toBeVisible();
    await expect(page.locator('button:has-text("Công trình")')).toBeVisible();
    await expect(page.locator('button:has-text("Đơn hàng")')).toBeVisible();
    await expect(page.locator('button:has-text("Hợp đồng")')).toBeVisible();

    await page.locator('button.misa-opening-btn-primary:has-text("Nhập số dư")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.misa-opening-modal-title:has-text("Khai báo chi phí dở dang đầu kỳ")')).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/misa_opening_wip_modal.png" });
  });
});
