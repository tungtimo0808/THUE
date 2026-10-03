import { test } from "@playwright/test";

test("debug element screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("http://localhost:5173/sales/transactions?company=minh-an&period=2026-09");
  await page.waitForTimeout(1000);

  const themBtn = page.getByRole("button", { name: "Thêm", exact: true }).first();
  const dropdownTrigger = themBtn.locator("xpath=following-sibling::button").first();
  await dropdownTrigger.click();
  await page.waitForTimeout(400);

  await page.locator('div:text-is("Chứng từ bán dịch vụ")').click();
  await page.waitForTimeout(600);

  const label = page.locator('label:text-is("Mã khách hàng")');
  const parent = label.locator("xpath=..");

  await parent.screenshot({ path: "tests/screenshots/debug_ma_khach_hang.png" });
});
