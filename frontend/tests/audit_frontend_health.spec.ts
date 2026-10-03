import { test, expect } from "@playwright/test";

test.describe("Frontend Comprehensive Audit & Regression Testing", () => {
  test("Fix 1: Verify Cost Step 1 & Step 5 dropdown z-index and click-outside dismissal", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("http://localhost:5173/cost/process");
    await page.waitForLoadState("networkidle");

    // Click Step 1 node to open dropdown
    const step1 = page.locator('text=1. Khai báo NVL và thành phẩm').first();
    await expect(step1).toBeVisible();
    await step1.click();
    await page.waitForTimeout(300);

    // Verify dropdown is open and both menu items are visible
    const addMaterial = page.locator('text=Thêm nguyên vật liệu');
    const addProduct = page.locator('text=Thêm thành phẩm');
    await expect(addMaterial).toBeVisible();
    await expect(addProduct).toBeVisible();

    // Verify Step 6 node is visible underneath without masking
    const step6 = page.locator('text=6. Nhập kho thành phẩm sản xuất');
    await expect(step6).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/audit_cost_step1_dropdown.png" });

    // Click backdrop to close
    await page.mouse.click(10, 10);
    await page.waitForTimeout(200);
    await expect(addMaterial).not.toBeVisible();

    // Now test Step 5 dropdown
    const step5 = page.locator('text=5. Hạch toán chi phí phát sinh').first();
    await expect(step5).toBeVisible();
    await step5.click();
    await page.waitForTimeout(300);

    await expect(page.locator('text=Tính khấu hao TSCĐ')).toBeVisible();
    await expect(page.locator('text=Phân bổ CCDC')).toBeVisible();
    await expect(page.locator('text=Phân bổ chi phí trả trước')).toBeVisible();
    await expect(page.locator('text=Hạch toán lương')).toBeVisible();
    await expect(page.locator('text=Hạch toán chi phí khác')).toBeVisible();

    // Click outside to close
    await page.mouse.click(10, 10);
    await page.waitForTimeout(200);
    await expect(page.locator('text=Tính khấu hao TSCĐ')).not.toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("Fix 2: Verify Opening Balance Supplier Modal layout, sections & scrolling", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("http://localhost:5173/opening");
    await page.waitForLoadState("networkidle");

    // Click "Công nợ nhà cung cấp"
    await page.locator('.misa-opening-tile:has-text("Công nợ nhà cung cấp")').click();
    await page.waitForTimeout(300);

    // Click "Nhập số dư"
    await page.locator('button.misa-opening-btn-primary:has-text("Nhập số dư")').click();
    await page.waitForTimeout(300);

    // Modal title
    await expect(page.locator('.misa-opening-modal-title:has-text("Nhập chi tiết công nợ nhà cung cấp")')).toBeVisible();

    // Check top row fields: Số tài khoản, Nhà cung cấp, Dư Nợ, Dư Có
    await expect(page.locator('.misa-opening-label:has-text("Số tài khoản")')).toBeVisible();
    await expect(page.locator('.misa-opening-label:has-text("Nhà cung cấp")')).toBeVisible();
    await expect(page.locator('.misa-opening-label:has-text("Dư Nợ")')).toBeVisible();
    await expect(page.locator('.misa-opening-label:has-text("Dư Có")')).toBeVisible();

    // Verify both collapsible sections
    await expect(page.locator('text=Chi tiết theo Hóa đơn')).toBeVisible();
    await expect(page.locator('text=Chi tiết theo nhân viên, đơn vị, công trình, đơn hàng, hợp đồng')).toBeVisible();

    // Verify buttons in section 1
    const addRowBtn = page.locator('button:has-text("+ Thêm dòng")').first();
    const clearRowBtn = page.locator('button:has-text("Xóa hết dòng")').first();
    await expect(addRowBtn).toBeVisible();
    await expect(clearRowBtn).toBeVisible();

    // Check no horizontal scroll on modal body
    const bodyOverflow = await page.evaluate(() => {
      const body = document.querySelector('.misa-opening-modal-body');
      if (!body) return false;
      return body.scrollWidth > body.clientWidth;
    });
    expect(bodyOverflow).toBe(false);

    await page.screenshot({ path: "tests/screenshots/audit_opening_supplier_fixed.png" });

    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    expect(errors).toHaveLength(0);
  });

  test("Health Audit: All main navigation routes load cleanly without exceptions", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    const routes = [
      "/overview",
      "/cash",
      "/cash/process",
      "/bank",
      "/bank/process",
      "/purchases",
      "/sales",
      "/inventory",
      "/tools",
      "/assets",
      "/payroll",
      "/tax",
      "/cost",
      "/ledger",
      "/budget",
      "/reports",
      "/analysis",
      "/opening",
      "/directory",
    ];

    for (const route of routes) {
      await page.goto(`http://localhost:5173${route}`);
      await page.waitForTimeout(200);
      await expect(page.locator("#reference-main")).toBeVisible();
    }

    expect(pageErrors).toHaveLength(0);
  });
});
