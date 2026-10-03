import { test, expect } from "@playwright/test";

test("verify 5 formats of Mua hàng nhập khẩu nhập kho", async ({ page }) => {
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

  // Switch template to "Mua hàng nhập khẩu nhập kho"
  await page.locator('header').getByText('Mua hàng trong nước nhập kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng nhập khẩu nhập kho').last().click();
  await page.waitForTimeout(500);

  // -------------------------------------------------------------
  // Format 1: Chưa thanh toán + Phiếu nhập
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Phiếu nhập" }).click();
  await page.waitForTimeout(300);

  // Check table header has "TK Công nợ", "Giá FOB", "Phí trước hải quan"
  await expect(page.locator('th:text-is("TK Công nợ")')).toBeVisible();
  await expect(page.locator('th:text-is("Giá FOB")')).toBeVisible();
  await expect(page.locator('th:text-is("Phí trước hải quan")')).toBeVisible();
  // Check import summary list has 10 lines
  await expect(page.locator('text=Thuế nhập khẩu').first()).toBeVisible();
  await expect(page.locator('text=Thuế CBPG').first()).toBeVisible();
  await expect(page.locator('text=Thuế TTĐB').first()).toBeVisible();
  await expect(page.locator('text=Thuế BVMT').first()).toBeVisible();
  await expect(page.locator('text=Phí trước HQ').first()).toBeVisible();
  await expect(page.locator('text=Giá trị nhập kho').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_format1_unpaid_phieu_nhap.png" });

  // -------------------------------------------------------------
  // Format 2: Chưa thanh toán + Hóa đơn
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Mẫu số hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Ký hiệu hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu --').first()).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_format2_unpaid_hoa_don.png" });

  // -------------------------------------------------------------
  // Format 3: Thanh toán ngay + Phiếu nhập
  // -------------------------------------------------------------
  await page.getByText("Thanh toán ngay").click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Phiếu nhập" }).click();
  await page.waitForTimeout(300);

  // In paid mode, table header changes to "TK Tiền", "Phí trước hải quan", "Phí hàng về kho"
  await expect(page.locator('th:text-is("TK Tiền")')).toBeVisible();
  await expect(page.locator('th:text-is("Phí trước hải quan")')).toBeVisible();
  await expect(page.locator('th:text-is("Phí hàng về kho")')).toBeVisible();
  await expect(page.locator('text=Tham chiếu ...').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_format3_paid_phieu_nhap.png" });

  // -------------------------------------------------------------
  // Format 4: Thanh toán ngay + Phiếu chi
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Phiếu chi" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Người nhận').first()).toBeVisible();
  await expect(page.locator('text=Lý do chi').first()).toBeVisible();
  await expect(page.locator('text=Số chứng từ').first()).toBeVisible();

  await page.screenshot({ path: "tests/screenshots/import_format4_paid_phieu_chi.png" });

  // -------------------------------------------------------------
  // Format 5: Thanh toán ngay + Hóa đơn
  // -------------------------------------------------------------
  await page.getByRole("button", { name: "Hóa đơn" }).click();
  await page.waitForTimeout(300);
  await expect(page.locator('text=Mẫu số hóa đơn').first()).toBeVisible();
  await expect(page.locator('text=Tham chiếu --').first()).toBeVisible();
  // In paid invoice format, no credit terms
  await expect(page.locator('text=Điều khoản thanh toán')).toHaveCount(0);

  await page.screenshot({ path: "tests/screenshots/import_format5_paid_hoa_don.png" });

  expect(true).toBe(true);
});
