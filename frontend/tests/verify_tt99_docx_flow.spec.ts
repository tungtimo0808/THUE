import { test, expect } from "@playwright/test";

test.describe("E2E UI Flow: Kiểm thử luồng chạy BCTC Công ty ABC theo Thông tư 99/2025/TT-BTC (test1 & test2)", () => {
  const artifactDir = "C:/Users/timodapoet/.gemini/antigravity/brain/a4db3343-7490-4460-9618-47a596e9b785";
  const companyId = "abc-tt99";

  test.beforeEach(async ({ page }) => {
    // 1. Inject Authenticated Session cho CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC
    await page.addInitScript(({ companyId }) => {
      const mockToken = "mock-token-abc-tt99-test";
      localStorage.setItem("erp_token", mockToken);
      localStorage.setItem("erp_refresh", mockToken);
      localStorage.setItem("erp_company_id", companyId);
      localStorage.setItem(
        "erp_api_session",
        JSON.stringify({
          token: mockToken,
          access: mockToken,
          access_token: mockToken,
          refresh: mockToken,
          companyId,
          companies: [
            {
              id: companyId,
              code: "ABC",
              name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
              tax_code: "0109876543",
              regime: "TT99",
              status: "ACTIVE",
            },
          ],
          user: {
            id: "1",
            username: "ketoan_abc",
            email: "ketoan@abc.com.vn",
            display_name: "Kế toán trưởng Cty ABC (TT99)",
            is_superuser: true,
          },
        })
      );
    }, { companyId });

    // 2. Setup Mock API Routes với số liệu thực tế đã chuẩn hóa theo TT 99 từ test1 & test2
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();

      if (url.includes("/api/v1/common/companies/mine/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: companyId,
              code: "ABC",
              name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
              tax_code: "0109876543",
              accounting_regime: "TT99",
              status: "ACTIVE",
            },
          ]),
        });
        return;
      }

      if (url.includes("/api/v1/reports/dashboard/overview/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            cards: {
              revenue: { label: "Tổng doanh thu bán hàng (TT99)", value: 345454545, change_rate: 8.5 },
              gross_profit: { label: "Lợi nhuận gộp", value: 112954545, change_rate: 6.2 },
              net_profit: { label: "Lợi nhuận sau thuế (TT99)", value: 8029636, change_rate: 10.1 },
              cash_and_bank: { label: "Tiền mặt & Tiền gửi không kỳ hạn", value: 7123985750, change_rate: 2.3 },
            },
            regime: "TT99",
            company_name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
          }),
        });
        return;
      }

      // Mặc định 200 OK cho các API khác để tránh gián đoạn
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  // Test 1: Bàn làm việc Báo cáo & Bảng điều khiển phân tích Cty ABC theo TT 99
  test("1. Kiểm tra Dashboard phân tích chỉ số tài chính Công ty ABC (TT 99)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/overview?company=${companyId}&period=2026-12`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    // Chụp ảnh xác thực Dashboard
    await page.screenshot({ path: `${artifactDir}/audit_tt99_abc_dashboard.png` });
    expect(pageErrors).toHaveLength(0);
  });

  // Test 2: Báo cáo tình hình tài chính B01-DN & Báo cáo kết quả hoạt động B02-DN theo TT 99
  test("2. Kiểm tra B01-DN Báo cáo tình hình tài chính & B02-DN KQKD theo TT 99", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/reports?company=${companyId}&period=2026-12`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    // Chuyển sang danh mục Báo cáo tài chính
    const financialCat = page.locator(".misa-reports-cat-btn:has-text('Báo cáo tài chính')").first();
    if (await financialCat.isVisible()) {
      await financialCat.click();
      await page.waitForTimeout(600);
    }

    // Mở Báo cáo tình hình tài chính B01-DN
    const b01Card = page.locator("text=B01 - DN: Báo cáo tình hình tài chính").first();
    if (await b01Card.isVisible()) {
      await b01Card.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${artifactDir}/audit_tt99_abc_b01_financial_position.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Mở B02-DN Báo cáo kết quả hoạt động kinh doanh
    const b02Card = page.locator("text=B02 - DN: Báo cáo kết quả hoạt động kinh doanh").first();
    if (await b02Card.isVisible()) {
      await b02Card.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${artifactDir}/audit_tt99_abc_b02_business_result.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    expect(pageErrors).toHaveLength(0);
  });

  // Test 3: Phân hệ Thuế Công ty ABC - Biểu mẫu tờ khai 01/GTGT & 03/TNDN
  test("3. Kiểm tra Phân hệ Thuế Cty ABC: Tờ khai 01/GTGT & Quyết toán TNDN", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/tax/reports?company=${companyId}&period=2026-12`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    // Mở Tờ khai 01/GTGT (RPT-TAX-08)
    const gtgtCard = page.locator("text=RPT-TAX-08").first();
    if (await gtgtCard.isVisible()) {
      await gtgtCard.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${artifactDir}/audit_tt99_abc_tax_01_gtgt.png` });

      const closeBtn = page.locator("button[title='Đóng'], button:has-text('Đóng')").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }
    }

    expect(pageErrors).toHaveLength(0);
  });
});
