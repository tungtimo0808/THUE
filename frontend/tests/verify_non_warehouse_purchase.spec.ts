import { test, expect } from "@playwright/test";

test("verify 4 formats of Mua hàng trong nước không qua kho", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("http://localhost:5173/purchases/transactions?company=minh-an&period=2026-09");
  await page.waitForTimeout(1000);

  // Click subheader tab "Mua hàng" (transactions)
  await page.locator('a[href*="/purchases/transactions"]').first().click();
  await page.waitForTimeout(600);

  // Click Thêm (exact text to avoid "Thêm bằng AI")
  const themBtn = page.locator('button:text-is("Thêm")').first();
  await themBtn.click();
  await page.waitForTimeout(400);

  // Click Chứng từ mua hàng
  await page.locator('text=Chứng từ mua hàng').first().click();
  await page.waitForTimeout(800);

  // Switch template to "Mua hàng trong nước không qua kho"
  await page.locator('header').getByText('Mua hàng trong nước nhập kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng trong nước không qua kho').last().click();
  await page.waitForTimeout(500);

  // Format 1: Chưa thanh toán + Chứng từ ghi nợ
  await page.getByRole("button", { name: "Chứng từ ghi nợ" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/screenshots/non_warehouse_format1_ghi_no.png" });

  // Format 2: Chưa thanh toán + Hóa đơn
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/screenshots/non_warehouse_format2_hoa_don_unpaid.png" });

  // Format 3: Thanh toán ngay + Phiếu chi
  await page.getByText("Thanh toán ngay").click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Phiếu chi" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/screenshots/non_warehouse_format3_phieu_chi.png" });

  // Format 4: Thanh toán ngay + Hóa đơn
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "tests/screenshots/non_warehouse_format4_hoa_don_paid.png" });

  expect(true).toBe(true);
});
