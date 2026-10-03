import { test } from "@playwright/test";

test("inspect children of parent", async ({ page }) => {
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
  const div = parent.locator("div").first();

  const taxLabel = page.locator('label:text-is("Mã số thuế/CCCD chủ hộ")');
  const taxDiv = taxLabel.locator("xpath=..").locator("div").first();
  await taxDiv.screenshot({ path: "tests/screenshots/debug_tax_code.png" });

  const modalMaster = page.locator('.misa-modal-backdrop').first();
  await modalMaster.screenshot({ path: "tests/screenshots/debug_modal_master.png" });

  const taxDetails = await taxDiv.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const children = Array.from(el.children).map((c) => {
      const crect = c.getBoundingClientRect();
      const cs = window.getComputedStyle(c);
      return {
        tag: c.tagName,
        rect: { x: crect.x, y: crect.y, w: crect.width, h: crect.height },
        bg: cs.backgroundColor,
        padding: cs.padding,
      };
    });
    return { rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, children };
  });
  console.log("TAX DETAILS:\n", JSON.stringify(taxDetails, null, 2));
});
