import { test, expect } from "@playwright/test";

test("verify 4 formats of Mua hàng nhập khẩu không qua kho", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("http://localhost:5173/purchases/transactions?company=minh-an&period=2026-09");
  await page.waitForTimeout(1000);

  // Click subheader tab "Mua hàng" (transactions)
  await page.locator('a[href*="/purchases/transactions"]').first().click();
  await page.waitForTimeout(600);

  // Click Thêm
  const themBtn = page.locator('button:text-is("Thêm")').first();
  await themBtn.click();
  await page.waitForTimeout(400);

  // Click Chứng từ mua hàng
  await page.locator('text=Chứng từ mua hàng').first().click();
  await page.waitForTimeout(800);

  // Switch template to "Mua hàng nhập khẩu không qua kho"
  await page.locator('header').getByText('Mua hàng trong nước nhập kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng nhập khẩu không qua kho').last().click();
  await page.waitForTimeout(500);

  // -------------------------------------------------------------
  // Format 1: Chưa thanh toán + Chứng từ ghi nợ
  // -------------------------------------------------------------
  await expect(page.locator('h2:has-text("MH00001")')).toBeVisible();
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hóa đơn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).toHaveCount(0);

  // Check table header has "TK chi phí", "TK Công nợ", "Phí trước hải quan", "Chi phí mua hàng", "Tổng giá trị"
  await expect(page.locator('th:text-is("TK chi phí")')).toBeVisible();
  await expect(page.locator('th:text-is("TK Công nợ")')).toBeVisible();
  await expect(page.locator('th:text-is("Phí trước hải quan")')).toBeVisible();
  await expect(page.locator('th:text-is("Chi phí mua hàng")')).toBeVisible();
  await expect(page.locator('th:text-is("Tổng giá trị")')).toBeVisible();

  // Check master form
  await expect(page.locator('text=Tham chiếu --').first()).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán').first()).toBeVisible();

  // Check summary
  await expect(page.locator('text=Phí trước HQ').first()).toBeVisible();
  await expect(page.locator('text=Chi phí mua hàng').first()).toBeVisible();
  await expect(page.locator('text=Tổng giá trị').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_non_warehouse_f1_ghi_no.png" });

  // -------------------------------------------------------------
  // Format 2: Chưa thanh toán + Hóa đơn
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Mẫu số hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Ký hiệu hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu --').first()).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_non_warehouse_f2_hoa_don_unpaid.png" });

  // -------------------------------------------------------------
  // Format 3: Thanh toán ngay + Phiếu chi
  // -------------------------------------------------------------
  await page.getByText("Thanh toán ngay").click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Phiếu chi" }).click();
  await page.waitForTimeout(300);

  // Voucher title changes to PC00001
  await expect(page.locator('h2:has-text("PC00001")')).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Hóa đơn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).toHaveCount(0);

  // Table header changes to "TK tiền"
  await expect(page.locator('th:text-is("TK tiền")')).toBeVisible();
  await expect(page.locator('text=Người nhận').first()).toBeVisible();
  await expect(page.locator('text=Lý do chi').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu ...').first()).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toHaveCount(0);

  await page.screenshot({ path: "tests/screenshots/import_non_warehouse_f3_phieu_chi.png" });

  // -------------------------------------------------------------
  // Format 4: Thanh toán ngay + Hóa đơn
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Mẫu số hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu --').first()).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toHaveCount(0);

  await page.screenshot({ path: "tests/screenshots/import_non_warehouse_f4_hoa_don_paid.png" });

  expect(true).toBe(true);
});
