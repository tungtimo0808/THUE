import { test, expect } from "@playwright/test";

test("verify all formats of Chứng từ mua dịch vụ", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("http://localhost:5173/purchases/transactions?company=minh-an&period=2026-09");
  await page.waitForTimeout(1000);

  // Click subheader tab "Mua hàng" (transactions)
  await page.locator('a[href*="/purchases/transactions"]').first().click();
  await page.waitForTimeout(600);

  // Click "Thêm" button to open dropdown menu
  const themBtn = page.locator('button:text-is("Thêm")').first();
  await themBtn.click();
  await page.waitForTimeout(400);

  // Click "Chứng từ mua dịch vụ"
  await page.locator('text=Chứng từ mua dịch vụ').first().click();
  await page.waitForTimeout(800);

  // =========================================================================
  // 1. Chưa thanh toán (User Screenshot 1 - MDV00001)
  // =========================================================================
  await expect(page.locator('h2:has-text("Chứng từ mua dịch vụ MDV00001")')).toBeVisible();

  // Master left labels
  await expect(page.locator('label:text-is("Mã nhà cung cấp")')).toBeVisible();
  await expect(page.locator('label:text-is("Tên nhà cung cấp")')).toBeVisible();
  await expect(page.locator('label:text-is("Địa chỉ")')).toBeVisible();
  await expect(page.locator('label:text-is("Nhân viên mua hàng")')).toBeVisible();
  await expect(page.locator('label:text-is("Diễn giải")')).toBeVisible();
  await expect(page.locator('input[value="Mua dịch vụ"]')).toBeVisible();
  await expect(page.locator('text=Tham chiếu ...')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toBeVisible();
  await expect(page.locator('span:text-is("Số ngày được nợ")')).toBeVisible();
  await expect(page.locator('span:text-is("Hạn thanh toán")')).toBeVisible();

  // Master right labels
  await expect(page.locator('label:text-is("Ngày hạch toán")')).toBeVisible();
  await expect(page.locator('label:text-is("Ngày chứng từ")')).toBeVisible();
  await expect(page.locator('label:text-is("Số chứng từ")')).toBeVisible();
  await expect(page.locator('input[value="MDV00001"]')).toBeVisible();

  // Detail tabs: Hạch toán, Thuế
  await expect(page.getByRole("button", { name: "Hạch toán" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thuế" })).toBeVisible();

  // Table headers
  await expect(page.locator('th:has-text("Mã dịch vụ")')).toBeVisible();
  await expect(page.locator('th:has-text("Tên dịch vụ")')).toBeVisible();
  await expect(page.locator('th:has-text("TK chi phí/TK kho")')).toBeVisible();
  await expect(page.locator('th:has-text("TK Công nợ")')).toBeVisible();
  await expect(page.locator('table input[value="331"]')).toBeVisible();

  // Bottom section
  await expect(page.locator('label:text-is("Sàn thương mại điện tử")')).toBeVisible();
  await expect(page.locator('label:text-is("Tên shop")')).toBeVisible();
  await expect(page.locator('span:text-is("Tổng tiền dịch vụ")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế GTGT")')).toBeVisible();
  await expect(page.locator('div:has-text("Tổng tiền thanh toán")').last()).toBeVisible();

  // Screenshot unpaid
  await page.screenshot({ path: "tests/screenshots/service_purchase_unpaid.png" });

  // =========================================================================
  // 2. Thanh toán ngay (User Screenshot 2 - PC00001)
  // =========================================================================
  await page.getByRole("dialog").getByText("Thanh toán ngay").click();
  await page.waitForTimeout(400);

  // Title changes to PC00001
  await expect(page.locator('h2:has-text("Chứng từ mua dịch vụ PC00001")')).toBeVisible();

  // Master left has Người nhận, Địa chỉ, Lý do chi, Kèm theo ... chứng từ gốc
  await expect(page.locator('label:text-is("Người nhận")')).toBeVisible();
  await expect(page.locator('label:text-is("Lý do chi")')).toBeVisible();
  await expect(page.locator('input[value="Chi tiền mua dịch vụ"]')).toBeVisible();
  await expect(page.locator('span:text-is("Kèm theo")')).toBeVisible();
  await expect(page.locator('span:text-is("chứng từ gốc")')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).not.toBeVisible();

  // Master right has Ngày phiếu chi & Số phiếu chi
  await expect(page.locator('label:text-is("Ngày phiếu chi")')).toBeVisible();
  await expect(page.locator('label:text-is("Số phiếu chi")')).toBeVisible();
  await expect(page.locator('input[value="PC00001"]')).toBeVisible();

  // Table header has TK tiền with value 111
  await expect(page.locator('th:has-text("TK tiền")')).toBeVisible();
  await expect(page.locator('table input[value="111"]')).toBeVisible();

  // Screenshot paid
  await page.screenshot({ path: "tests/screenshots/service_purchase_paid.png" });

  // =========================================================================
  // 3. Payment Method Dropdown (User Screenshot 3)
  // =========================================================================
  await page.locator('[data-testid="service-payment-method-selector"]').click();
  await page.waitForTimeout(300);
  const payPopup = page.locator('[data-testid="service-payment-dropdown-menu"]');
  await expect(payPopup.locator('div:text-is("Tiền mặt")')).toBeVisible();
  await expect(payPopup.locator('div:text-is("Ủy nhiệm chi")')).toBeVisible();
  await expect(payPopup.locator('div:text-is("Séc chuyển khoản")')).toBeVisible();
  await expect(payPopup.locator('div:text-is("Séc tiền mặt")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/service_purchase_payment_dropdown.png" });

  // Select Ủy nhiệm chi to test UNC code
  await payPopup.locator('div:text-is("Ủy nhiệm chi")').click();
  await page.waitForTimeout(300);
  await expect(page.locator('h2:has-text("Chứng từ mua dịch vụ UNC00001")')).toBeVisible();
  await expect(page.locator('label:text-is("Ngày ủy nhiệm chi")')).toBeVisible();
  await expect(page.locator('label:text-is("Số ủy nhiệm chi")')).toBeVisible();
  await expect(page.locator('table input[value="1121"]')).toBeVisible();

  // Reset to Tiền mặt
  await page.locator('[data-testid="service-payment-method-selector"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="service-payment-dropdown-menu"]').locator('div:text-is("Tiền mặt")').click();
  await page.waitForTimeout(300);

  // =========================================================================
  // 4. Invoice Option Dropdown (User Screenshot 4 / media_1790912466058)
  // =========================================================================
  await page.locator('[data-testid="service-invoice-option-selector"]').click();
  await page.waitForTimeout(300);
  const invPopup = page.locator('[data-testid="service-invoice-dropdown-menu"]');
  await expect(invPopup.locator('div:text-is("Nhận kèm hóa đơn")')).toBeVisible();
  await expect(invPopup.locator('div:text-is("Không kèm hóa đơn")')).toBeVisible();
  await expect(invPopup.locator('div:text-is("Không có hóa đơn")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/service_purchase_invoice_dropdown.png" });

  // Select Nhận kèm hóa đơn to close
  await invPopup.locator('div:text-is("Nhận kèm hóa đơn")').click();
  await page.waitForTimeout(300);

  // Close modal
  await page.getByRole("button", { name: "Cất và Đóng" }).click();
  await page.waitForTimeout(500);
});
