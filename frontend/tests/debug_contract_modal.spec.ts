import { test } from "@playwright/test";

test("Capture current state of sale contract modal", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("http://localhost:5173/sales/contracts?company=minh-an&period=2026-09");
  await page.waitForTimeout(1000);

  const themBtn = page.getByRole("button", { name: "Thêm", exact: true }).first();
  await themBtn.click();
  await page.waitForTimeout(600);

  // Take screenshot of Hợp đồng mode
  await page.locator(".misa-modal-backdrop").first().screenshot({ path: "tests/screenshots/contract_modal_current_hop_dong.png" });

  // Switch to Dự án mode
  await page.locator('label').filter({ hasText: /^Dự án$/ }).click();
  await page.waitForTimeout(400);

  // Take screenshot of Dự án mode
  await page.locator(".misa-modal-backdrop").first().screenshot({ path: "tests/screenshots/contract_modal_current_du_an.png" });
});
