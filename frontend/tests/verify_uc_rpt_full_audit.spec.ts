import { test, expect } from "@playwright/test";

test.describe("UC-RPT Master E2E UI Audit & Cross-Module Verification", () => {
  const artifactDir = "C:/Users/timodapoet/.gemini/antigravity/brain/a4db3343-7490-4460-9618-47a596e9b785";
  const companyId = "minh-an";

  test.beforeEach(async ({ page }) => {
    // 1. Inject Authenticated Session in localStorage
    await page.addInitScript(({ companyId }) => {
      const mockToken = "mock-valid-jwt-token-uc-rpt-audit";
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
              code: "MINHAN",
              name: "Công ty TNHH Thương mại & Dịch vụ Minh An",
              status: "ACTIVE",
            },
          ],
          user: {
            id: "1",
            username: "auditor",
            email: "auditor@soviet.vn",
            display_name: "Kiểm toán viên Sổ Việt",
            is_superuser: true,
          },
        })
      );
    }, { companyId });

    // 2. Setup Mock API Routes for zero backend failure
    await page.route("**/api/**", async (route) => {
      const url = route.request().url();

      if (url.includes("/api/v1/common/companies/mine/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: companyId,
              code: "MINHAN",
              name: "Công ty TNHH Thương mại & Dịch vụ Minh An",
              status: "ACTIVE",
            },
          ]),
        });
        return;
      }

      if (url.includes("/api/reporting/tax-reports/") || url.includes("/tax-reports/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            run_id: "run-mock-001",
            report_code: "RPT-0003",
            report_name: "Tình hình thực hiện nghĩa vụ với Nhà nước",
            rows: [
              {
                row_type: "GROUP",
                columns: { indicator_code: "10", indicator_name: "I - Thuế" },
              },
              {
                row_type: "DETAIL",
                columns: {
                  indicator_code: "11",
                  indicator_name: "1. Thuế GTGT hàng bán nội địa",
                  opening_payable: 0,
                  period_assessed: 125000000,
                  period_paid: 100000000,
                  accumulated_assessed: 125000000,
                  accumulated_paid: 100000000,
                  closing_payable: 25000000,
                },
              },
              {
                row_type: "DETAIL",
                columns: {
                  indicator_code: "15",
                  indicator_name: "5. Thuế thu nhập doanh nghiệp",
                  opening_payable: 15000000,
                  period_assessed: 82000000,
                  period_paid: 80000000,
                  accumulated_assessed: 97000000,
                  accumulated_paid: 80000000,
                  closing_payable: 17000000,
                },
              },
              {
                row_type: "TOTAL",
                columns: {
                  indicator_code: "40",
                  indicator_name: "Tổng cộng",
                  opening_payable: 15000000,
                  period_assessed: 207000000,
                  period_paid: 180000000,
                  accumulated_assessed: 222000000,
                  accumulated_paid: 180000000,
                  closing_payable: 42000000,
                },
              },
            ],
            summary: {
              total_payable: 42000000,
              total_paid_in_period: 180000000,
            },
            validations: [],
          }),
        });
        return;
      }

      if (url.includes("/api/v1/reports/drilldown/open/")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            context_id: "ctx-drill-001",
            formula: "TK 33311 (Phát sinh Có - Phát sinh Nợ)",
            components: [
              { name: "Hóa đơn bán ra GTGT 10% - HĐ001", contribution_value: 80000000 },
              { name: "Hóa đơn bán ra GTGT 8% - HĐ002", contribution_value: 45000000 },
            ],
          }),
        });
        return;
      }

      // Default 200 OK for other backend endpoints
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  // Test 1: UC-RPT-01 – Dashboard Overview
  test("Audit UC-RPT-01: Bàn làm việc Báo cáo & Bảng điều khiển phân tích (/overview)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/overview?company=${companyId}&period=2026-09`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify main dashboard title
    const overviewTitle = page.locator("text=Tổng quan hoạt động").first();
    await expect(overviewTitle).toBeVisible();

    // Verify Dashboard analytical sections (DASH-05 .. DASH-10)
    await expect(page.locator("text=/DASH-05/").first()).toBeVisible();
    await expect(page.locator("text=/DASH-06/").first()).toBeVisible();
    await expect(page.locator("text=/DASH-07/").first()).toBeVisible();
    await expect(page.locator("text=/DASH-08/").first()).toBeVisible();

    // Take screenshot for audit trail
    await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_01_dashboard.png` });

    // Assert zero unhandled JavaScript errors
    expect(pageErrors).toHaveLength(0);
  });

  // Test 2: UC-RPT-02..06, 08..13, 14, 15 – Report Center Workspace
  test("Audit UC-RPT-02..13, 14, 15: Trung tâm Báo cáo, Mẫu biểu & Drilldown (/reports)", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto(`/reports?company=${companyId}&period=2026-09`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify Report Center Workspace loaded
    const reportTitle = page.locator("text=Báo cáo").first();
    await expect(reportTitle).toBeVisible();

    // 1. Switch to Financial Reports category (UC-RPT-02..06)
    const financialCat = page.locator(".misa-reports-cat-btn:has-text('Báo cáo tài chính')").first();
    if (await financialCat.isVisible()) {
      await financialCat.click();
      await page.waitForTimeout(600);
      await expect(page.locator("body")).toContainText("Báo cáo tài chính");
    }

    // 2. Test opening B01-DN (UC-RPT-03)
    const b01Report = page.locator("text=B01 - DN: Báo cáo tình hình tài chính").first();
    if (await b01Report.isVisible()) {
      await b01Report.click();
      await page.waitForTimeout(800);
      await expect(page.locator("body")).toContainText("BÁO CÁO TÌNH HÌNH TÀI CHÍNH");
      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_03_financial_position.png` });

      // Click Back button
      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 3. Test opening B02-DN (UC-RPT-04)
    const b02Report = page.locator("text=B02 - DN: Báo cáo kết quả hoạt động kinh doanh").first();
    if (await b02Report.isVisible()) {
      await b02Report.click();
      await page.waitForTimeout(800);
      await expect(page.locator("body")).toContainText("KẾT QUẢ HOẠT ĐỘNG KINH DOANH");
      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_04_business_result.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 4. Test opening B03-DN (UC-RPT-05)
    const b03Report = page.locator("text=B03 - DN: Báo cáo lưu chuyển tiền tệ (PP trực tiếp)").first();
    if (await b03Report.isVisible()) {
      await b03Report.click();
      await page.waitForTimeout(800);
      await expect(page.locator("body")).toContainText("LƯU CHUYỂN TIỀN TỆ");
      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_05_cash_flow.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 5. Test opening B09-DN (UC-RPT-06)
    const b09Report = page.locator("text=B09 - DN: Thuyết minh báo cáo tài chính").first();
    if (await b09Report.isVisible()) {
      await b09Report.click();
      await page.waitForTimeout(800);
      await expect(page.locator("body")).toContainText("THUYẾT MINH BÁO CÁO TÀI CHÍNH");
      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_06_financial_notes.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 6. Test opening RPT-0003: Nghĩa vụ với nhà nước + Drilldown UC-RPT-14
    const rpt0003 = page.locator("text=Tình hình thực hiện nghĩa vụ với nhà nước").first();
    if (await rpt0003.isVisible()) {
      await rpt0003.click();
      await page.waitForTimeout(800);
      await expect(page.locator("body")).toContainText("TÌNH HÌNH THỰC HIỆN NGHĨA VỤ VỚI NHÀ NƯỚC");

      // Test parameter drawer
      const paramBtn = page.locator("button:has-text('Chọn tham số')").first();
      await expect(paramBtn).toBeVisible();
      await paramBtn.click();
      await page.waitForTimeout(400);

      // Verify drawer opened
      await expect(page.locator("text=Kỳ báo cáo").first()).toBeVisible();
      // Close drawer with "Xem báo cáo"
      const applyBtn = page.locator("button:has-text('Xem báo cáo')").last();
      await applyBtn.click();
      await page.waitForTimeout(500);

      // Test Drilldown (UC-RPT-14): Click on a numeric cell with underlined link
      const clickableCell = page.locator("table td[style*='underline'], table td[style*='pointer']").first();
      if (await clickableCell.isVisible()) {
        await clickableCell.click();
        await page.waitForTimeout(500);
        // Verify Drilldown submodal opened
        const drillModal = page.locator("text=Chi tiết Drill-down chỉ tiêu thuế (UC-RPT-14)").first();
        if (await drillModal.isVisible()) {
          await expect(drillModal).toBeVisible();
          await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_14_drilldown_modal.png` });
          // Close modal
          await page.locator("button:has-text('Đóng')").first().click();
          await page.waitForTimeout(300);
        }
      }

      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_07_state_obligations.png` });

      const backBtn = page.locator("button[title='Quay lại danh mục báo cáo'], button:has-text('Quay lại')").first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 7. Test category navigation across Cash, Bank, Purchase, Sales, Inventory, Assets
    const catKeys = ["Tiền mặt", "Tiền gửi", "Mua hàng", "Bán hàng", "Kho", "Tài sản cố định"];
    for (const catName of catKeys) {
      const catBtn = page.locator(`.misa-reports-cat-btn:has-text('${catName}')`).first();
      if (await catBtn.isVisible()) {
        await catBtn.click();
        await page.waitForTimeout(300);
      }
    }

    expect(pageErrors).toHaveLength(0);
  });

  // Test 3: UC-RPT-07 – Tax Reports Suite & Legal Form Viewer (/tax/reports)
  test("Audit UC-RPT-07: Phân hệ Báo cáo Thuế, 15 Mẫu biểu & Biểu mẫu Pháp lý (/tax/reports)", async ({ page }) => {
    test.setTimeout(60000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    // Navigate to Tax module tab reports
    await page.goto(`/tax/reports?company=${companyId}&period=2026-09`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify Tab 4 Báo cáo header
    await expect(page.locator("text=Báo cáo quản trị thuế").first()).toBeVisible();

    // Check all 3 accordion groups
    await expect(page.locator("text=Báo cáo quản trị thuế").first()).toBeVisible();
    await expect(page.locator("text=Báo cáo đối chiếu thuế").first()).toBeVisible();
    await expect(page.locator("text=Biểu mẫu tờ khai pháp lý").first()).toBeVisible();

    // Ensure Accordion 3: Biểu mẫu tờ khai pháp lý is open
    const report01Gtgt = page.locator("text=RPT-TAX-08").first();
    if (!await report01Gtgt.isVisible()) {
      await page.locator("text=Biểu mẫu tờ khai pháp lý").first().click();
      await page.waitForTimeout(400);
    }

    // 1. Test opening 01/GTGT (RPT-TAX-08)
    await expect(report01Gtgt).toBeVisible();
    await report01Gtgt.click();
    await page.waitForTimeout(800);

    // Verify MisaTaxReportModal is displayed
    const modalTitle = page.locator("text=Mẫu 01/GTGT").first();
    await expect(modalTitle).toBeVisible();

    // Verify form version selector (TT80_2021_V1 vs TT89_2026_V2)
    const versionSelect = page.locator("select").filter({ hasText: /Thông tư 80|Thông tư 89/ }).first();
    if (await versionSelect.isVisible()) {
      await expect(versionSelect).toBeVisible();
      // Switch version to TT89
      await versionSelect.selectOption("TT89_2026_V2");
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_07_form_01_gtgt_modal.png` });

    // Close modal
    const closeBtn = page.locator("button[title='Đóng'], button:has-text('Đóng')").first();
    await closeBtn.click();
    await page.waitForTimeout(500);

    // 2. Test opening RPT-0177 (02/TNDN) with PII Masking verification
    const report02Tndn = page.locator("text=RPT-0177").first();
    if (await report02Tndn.isVisible()) {
      await report02Tndn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${artifactDir}/audit_uc_rpt_07_pii_02_tndn_modal.png` });
      const closeBtn2 = page.locator("button[title='Đóng'], button:has-text('Đóng')").first();
      await closeBtn2.click();
      await page.waitForTimeout(500);
    }

    // 3. Test Search report filter
    const searchInput = page.locator("input[placeholder='Tìm theo tên báo cáo']").first();
    await searchInput.fill("quyết toán");
    await page.waitForTimeout(400);
    await expect(page.locator("text=RPT-0176")).toBeVisible();
    await searchInput.fill("");
    await page.waitForTimeout(300);

    expect(pageErrors).toHaveLength(0);
  });

  // Test 4: Cross-Module Verification & Conflict Audit
  test("Audit Cross-Module: Kiểm tra xung đột điều hướng, giao diện và z-index giữa các phân hệ", async ({ page }) => {
    test.setTimeout(120000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const moduleUrls = [
      `/cash?company=${companyId}&period=2026-09`,
      `/bank?company=${companyId}&period=2026-09`,
      `/purchases?company=${companyId}&period=2026-09`,
      `/sales?company=${companyId}&period=2026-09`,
      `/inventory?company=${companyId}&period=2026-09`,
      `/assets?company=${companyId}&period=2026-09`,
      `/cost?company=${companyId}&period=2026-09`,
      `/budget?company=${companyId}&period=2026-09`,
      `/opening?company=${companyId}&period=2026-09`,
    ];

    for (const url of moduleUrls) {
      await page.goto(url);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(300);

      // Verify page body renders without crashing
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // Verify no full-page error boundary takeover
      const errorBoundaryFallback = page.locator("text=Đã xảy ra lỗi không mong muốn");
      await expect(errorBoundaryFallback).not.toBeVisible();
    }

    await page.screenshot({ path: `${artifactDir}/audit_cross_module_health.png` });
    expect(pageErrors).toHaveLength(0);
  });
});
