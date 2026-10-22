import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({ actionTimeout: 15000 });

test("E2E Chrome Visual Test: UC-FA-09 to UC-FA-16 on MisaToolsWorkspace", async ({ page }) => {
  test.setTimeout(240000);
  const artifactDir = "C:/Users/timodapoet/.gemini/antigravity/brain/a4db3343-7490-4460-9618-47a596e9b785";

  const realAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkzMjU2Njg5LCJpYXQiOjE3OTI2NTE4ODksImp0aSI6Ijk5Y2JkYjFmYzgwZDRjNmI4NmJiNWVlZTM4YjQ2ZTg4IiwidXNlcl9pZCI6IjcifQ.sLQ6Z71OqNjsZHJ00dtZEpsLmlr2HFj3F5JJaFszPgY";
  const realRefreshToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NTI0Mzg4OSwiaWF0IjoxNzkyNjUxODg5LCJqdGkiOiI1MmIwNmFkYWJmNTU0NGNiYjY0YTRmZTczMWU0ODVhNyIsInVzZXJfaWQiOiI3In0.Ns0Ty8AvHGY54umizreThGiimwaRcBW_QAmb1Lm4QOw";

  await page.addInitScript(
    ({ token, refresh }) => {
      localStorage.setItem("erp_token", token);
      localStorage.setItem("erp_refresh", refresh);
      localStorage.setItem("erp_company_id", "minh-an");
      localStorage.setItem(
        "erp_api_session",
        JSON.stringify({
          token,
          access: token,
          access_token: token,
          refresh,
          companyId: "minh-an",
          companies: [
            {
              id: "minh-an",
              code: "MINHAN",
              name: "Công ty TNHH Thương mại & Dịch vụ Minh An",
            },
          ],
          user: {
            id: "7",
            username: "superadmin",
            email: "superadmin@soviet.vn",
            display_name: "Nguyễn Thị Mai",
            is_superuser: true,
          },
        })
      );
    },
    { token: realAccessToken, refresh: realRefreshToken }
  );

  await page.route("**/api/v1/common/companies/mine/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "minh-an",
          code: "MINHAN",
          name: "Công ty TNHH Thương mại & Dịch vụ Minh An",
        },
      ]),
    });
  });

  // ---------------------------------------------------------------------------
  // 1. UC-FA-09 & UC-FA-16: Sổ theo dõi CCDC & Khai báo CCDC đầu kỳ
  // ---------------------------------------------------------------------------
  await page.goto("http://localhost:5173/tools/register?company=minh-an&period=2026-09");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900);

  await expect(page.getByRole("button", { name: "Khai báo CCDC đầu kỳ" })).toBeVisible();
  await page.getByRole("button", { name: "Khai báo CCDC đầu kỳ" }).click();
  await page.waitForTimeout(900);

  await expect(page.locator("text=Ghi tăng công cụ dụng cụ").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc09_ccdc_opening_modal.png` });

  // Switch tabs inside CCDC modal (UC-FA-09 / UC-FA-10)
  await page.locator("text=Thiết lập phân bổ").first().click();
  await page.waitForTimeout(600);
  await page.locator("text=Nguồn gốc hình thành").first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(600);

  // Open Register List & Trace Modal (UC-FA-16)
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  await page.waitForTimeout(900);
  await page.locator("td:has-text('PD001')").first().click();
  await page.waitForTimeout(900);
  await expect(page.locator("text=Hồ sơ & Lịch sử biến động CCDC").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc16_ccdc_trace_modal.png` });
  await page.getByRole("button", { name: "Đóng" }).last().click();
  await page.waitForTimeout(600);

  // ---------------------------------------------------------------------------
  // 2. UC-FA-10: Quản lý CCDC -> Ghi tăng CCDC đơn lẻ & hàng loạt
  // ---------------------------------------------------------------------------
  await page.goto("http://localhost:5173/tools/management?company=minh-an&period=2026-09");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900);

  await page.locator("div:text-is('Ghi tăng')").first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.locator("text=Ghi tăng CCDC hàng loạt").first().click();
  await page.waitForTimeout(900);
  await expect(page.getByRole("heading", { name: "Ghi tăng CCDC hàng loạt" })).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc10_ccdc_batch_increase.png` });
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(600);

  // ---------------------------------------------------------------------------
  // 3. UC-FA-11 & UC-FA-12 Main Flow A: Phân bổ chi phí CCDC
  // ---------------------------------------------------------------------------
  await page.locator("div:text-is('Phân bổ chi phí')").first().click();
  await page.waitForTimeout(800);

  // UC-FA-11 Flow A: Chọn kỳ phân bổ CCDC
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(900);
  await expect(page.locator("text=Chọn kỳ phân bổ").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc11_ccdc_period_modal.png` });

  // Confirm period -> Opens UC-FA-12 CCDC Allocation Voucher Modal
  await page.getByRole("button", { name: "Đồng ý" }).last().click();
  await page.waitForTimeout(1000);
  await expect(page.locator("text=Phân bổ chi phí CCDC").first()).toBeVisible();
  await expect(page.locator("text=Xác định chi phí").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_ccdc_tab1_identify.png` });

  // Test Reference Voucher Picker (AF01-AF03)
  await page.locator("span:text-is('...')").first().click();
  await page.waitForTimeout(900);
  await expect(page.locator("text=Chọn chứng từ tham chiếu (ALLOC_CCDC)").first()).toBeVisible();
  const firstCheckbox = page.locator("table input[type='checkbox']").first();
  if (await firstCheckbox.isVisible()) {
    await firstCheckbox.check();
  }
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_ref_voucher_modal.png` });
  await page.getByRole("button", { name: "Đồng ý" }).last().click();
  await page.waitForTimeout(700);

  // Switch to Tab 2: Phân bổ (Main Flow A Step 9-14)
  await page.locator("div:text-is('Phân bổ')").last().click();
  await page.waitForTimeout(900);
  await expect(page.locator("th:has-text('Đơn vị sử dụng')").first()).toBeVisible();
  await expect(page.locator("th:has-text('PB kỳ này')").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_ccdc_tab2_allocation.png` });

  // Switch to Tab 3: Hạch toán (Main Flow A Step 15-18)
  await page.locator("div:text-is('Hạch toán')").last().click();
  await page.waitForTimeout(900);
  await expect(page.locator("th:has-text('Diễn giải định khoản')").first()).toBeVisible();
  await expect(page.locator("th:has-text('TK Nợ')").first()).toBeVisible();
  await expect(page.locator("th:has-text('TK Có')").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_ccdc_tab3_accounting.png` });

  // Click Lưu / Cất (Main Flow A Step 21-29)
  await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_ccdc_saved_list.png` });

  // ---------------------------------------------------------------------------
  // 4. UC-FA-13, UC-FA-14, UC-FA-15: Điều chuyển, Ghi giảm, Kiểm kê CCDC
  // ---------------------------------------------------------------------------
  await page.locator("div:text-is('Điều chuyển')").first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${artifactDir}/chrome_uc13_transfer_modal.png` });
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(500);

  await page.locator("div:text-is('Ghi giảm')").first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${artifactDir}/chrome_uc14_decrease_modal.png` });
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(500);

  await page.locator("div:text-is('Kiểm kê')").first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Đồng ý" }).last().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${artifactDir}/chrome_uc15_stocktake_modal.png` });
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(500);

  // ---------------------------------------------------------------------------
  // 5. UC-FA-09, UC-FA-10, UC-FA-11 & UC-FA-12 Main Flow B: Chi phí trả trước
  // ---------------------------------------------------------------------------
  await page.goto("http://localhost:5173/tools/prepaid?company=minh-an&period=2026-09");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900);

  // Open Thêm dropdown -> Thêm chi phí trả trước (UC-FA-10 Flow B)
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.locator("text=Thêm chi phí trả trước").first().click();
  await page.waitForTimeout(900);
  await expect(page.locator("text=Mã chi phí trả trước").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc10_prepaid_new_modal.png` });
  await page.getByRole("button", { name: "Hủy" }).last().click();
  await page.waitForTimeout(600);

  // Switch to subtab: Phân bổ chi phí trả trước (UC-FA-11 & UC-FA-12 Flow B)
  await page.locator("div:text-is('Phân bổ chi phí trả trước')").first().click();
  await page.waitForTimeout(900);

  // Click Thêm -> Opens Chọn kỳ phân bổ (UC-FA-11 Flow B)
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.waitForTimeout(900);
  await expect(page.locator("text=Chọn kỳ phân bổ").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc11_prepaid_period_modal.png` });

  // Click Đồng ý -> Opens Phân bổ chi phí trả trước (UC-FA-12 Flow B)
  await page.getByRole("button", { name: "Đồng ý" }).last().click();
  await page.waitForTimeout(1000);
  await expect(page.locator("text=Phân bổ chi phí trả trước").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_prepaid_tab1_identify.png` });

  // Switch to Tab 2: Phân bổ (Main Flow B Step 9-13)
  await page.locator("div:text-is('Phân bổ')").last().click();
  await page.waitForTimeout(900);
  await expect(page.locator("th:has-text('Đối tượng phân bổ')").first()).toBeVisible();
  await expect(page.locator("th:has-text('Số tiền chưa phân bổ')").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_prepaid_tab2_allocation.png` });

  // Switch to Tab 3: Hạch toán (Main Flow B Step 14-16)
  await page.locator("div:text-is('Hạch toán')").last().click();
  await page.waitForTimeout(900);
  await expect(page.locator("th:has-text('Diễn giải định khoản')").first()).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_prepaid_tab3_accounting.png` });

  // Click Xuất khẩu bảng phân bổ ra Excel (AF18)
  await page.getByRole("button", { name: "Xuất khẩu bảng phân bổ ra Excel" }).click();
  await page.waitForTimeout(700);

  // Click Lưu (Main Flow B Step 18-25)
  await page.getByRole("button", { name: "Lưu", exact: true }).last().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${artifactDir}/chrome_uc12_prepaid_saved_list.png` });

  // ---------------------------------------------------------------------------
  // 6. UC-FA-16: Báo cáo CCDC & Chi phí trả trước
  // ---------------------------------------------------------------------------
  await page.goto("http://localhost:5173/tools/reports?company=minh-an&period=2026-09");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${artifactDir}/chrome_uc16_reports_view.png` });
});
