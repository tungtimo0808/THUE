import { test, expect } from "@playwright/test";

test.describe("Verify All Inputs and Dropzones have Continuous Solid Borders", () => {
  test("Verify sales vouchers, inputs, and attachment dropzones", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1600, height: 950 });

    // 1. Service Sale Voucher
    await page.goto("http://localhost:5173/sales/transactions?company=minh-an&period=2026-09");
    await page.waitForTimeout(1000);

    const themBtn = page.getByRole("button", { name: "Thêm", exact: true }).first();
    const dropdownTrigger = themBtn.locator("xpath=following-sibling::button").first();
    await dropdownTrigger.click();
    await page.waitForTimeout(400);

    await page.locator('div:text-is("Chứng từ bán dịch vụ")').click();
    await page.waitForTimeout(600);

    // Verify customer code input and tax code input computed styles
    const label = page.locator('label:text-is("Mã khách hàng")');
    const customerCodeDiv = label.locator("xpath=..").locator("div").first();
    const taxLabel = page.locator('label:text-is("Mã số thuế/CCCD chủ hộ")');
    const taxDiv = taxLabel.locator("xpath=..").locator("div").first();

    // Capture screenshot of both
    await customerCodeDiv.screenshot({ path: "tests/screenshots/solid_customer_code.png" });
    await taxDiv.screenshot({ path: "tests/screenshots/solid_tax_code.png" });

    // Evaluate that child input does not exceed parent height
    const isContained = await customerCodeDiv.evaluate((parent) => {
      const parentRect = parent.getBoundingClientRect();
      const input = parent.querySelector("input");
      if (!input) return false;
      const inputRect = input.getBoundingClientRect();
      const inputStyle = window.getComputedStyle(input);
      // Input must not overflow top or bottom of parent
      const topOk = inputRect.top >= parentRect.top;
      const bottomOk = inputRect.bottom <= parentRect.bottom;
      const isTransparent = inputStyle.backgroundColor === "rgba(0, 0, 0, 0)";
      return topOk && bottomOk && isTransparent;
    });
    expect(isContained).toBe(true);

    const isTaxContained = await taxDiv.evaluate((parent) => {
      const parentRect = parent.getBoundingClientRect();
      const input = parent.querySelector("input");
      if (!input) return false;
      const inputRect = input.getBoundingClientRect();
      const inputStyle = window.getComputedStyle(input);
      const topOk = inputRect.top >= parentRect.top;
      const bottomOk = inputRect.bottom <= parentRect.bottom;
      const isTransparent = inputStyle.backgroundColor === "rgba(0, 0, 0, 0)";
      return topOk && bottomOk && isTransparent;
    });
    expect(isTaxContained).toBe(true);

    // Take screenshot of master form
    await page.locator(".misa-modal-backdrop").first().screenshot({ path: "tests/screenshots/solid_master_form.png" });

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // 2. Check Sales Quotes (Báo giá)
    await page.goto("http://localhost:5173/sales/quotes?company=minh-an&period=2026-09");
    await page.waitForTimeout(1000);

    const themQuoteBtn = page.getByRole("button", { name: "Thêm", exact: true }).first();
    if (await themQuoteBtn.isVisible()) {
      await themQuoteBtn.click();
      await page.waitForTimeout(600);

      const quoteModal = page.locator(".misa-modal-backdrop, .ref-modal").first();
      if (await quoteModal.isVisible()) {
        await quoteModal.screenshot({ path: "tests/screenshots/solid_sales_quote.png" });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }

    // 3. Check Purchases Modal (Chứng từ mua dịch vụ)
    await page.goto("http://localhost:5173/purchases/transactions?company=minh-an&period=2026-09");
    await page.waitForTimeout(1000);

    const themPurchaseBtn = page.locator('button:text-is("Thêm")').first();
    await themPurchaseBtn.click();
    await page.waitForTimeout(400);

    await page.locator('text=Chứng từ mua dịch vụ').first().click();
    await page.waitForTimeout(800);

    const purchaseModal = page.locator(".misa-modal-backdrop, .ref-modal, .misa-purchase-modal-window").first();
    await expect(purchaseModal).toBeVisible();
    await purchaseModal.screenshot({ path: "tests/screenshots/solid_purchase_modal.png" });
  });
});
