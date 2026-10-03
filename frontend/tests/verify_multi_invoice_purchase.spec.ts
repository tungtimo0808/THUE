import { test, expect } from "@playwright/test";

test("verify all formats of Chứng từ mua hàng nhiều hóa đơn", async ({ page }) => {
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

  // Click "Chứng từ mua hàng nhiều hóa đơn"
  await page.locator('text=Chứng từ mua hàng nhiều hóa đơn').first().click();
  await page.waitForTimeout(800);

  // =========================================================================
  // 1. Mua hàng trong nước nhập kho (Format 1: Chưa thanh toán)
  // =========================================================================
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn NK00001")')).toBeVisible();
  await expect(page.getByText("Mua hàng trong nước nhập kho").first()).toBeVisible();

  // Sub-tab bar has ONLY "Phiếu nhập"
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).not.toBeVisible();

  // Detail table headers
  await expect(page.locator('th:has-text("TK Kho")')).toBeVisible();
  await expect(page.locator('th:has-text("TK Công nợ")')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Đối tượng', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Tên đối tượng', exact: true })).toBeVisible();

  // Summary
  await expect(page.locator('span:text-is("Giá trị nhập kho")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_domestic_warehouse_unpaid.png" });

  // Switch to Thanh toán ngay
  await page.getByRole("dialog").getByText("Thanh toán ngay").click();
  await page.waitForTimeout(400);
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toBeVisible();
  await expect(page.locator('th:has-text("TK Tiền")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_domestic_warehouse_paid.png" });

  // Test payment dropdown
  await page.locator('[data-testid="multi-payment-method-selector"]').click();
  await page.waitForTimeout(300);
  const popup = page.locator('[data-testid="multi-payment-dropdown-menu"]');
  await expect(popup.locator('div:text-is("Ủy nhiệm chi")')).toBeVisible();
  await popup.locator('div:text-is("Ủy nhiệm chi")').click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Ủy nhiệm chi" })).toBeVisible();
  await expect(page.locator('table input[value="1121"]')).toBeVisible();

  // Reset to Tiền mặt
  await page.locator('[data-testid="multi-payment-method-selector"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-testid="multi-payment-dropdown-menu"]').locator('div:text-is("Tiền mặt")').click();
  await page.waitForTimeout(300);

  // =========================================================================
  // 2. Mua hàng trong nước không qua kho (User Screenshots 1 & 2)
  // =========================================================================
  // Switch template to "Mua hàng trong nước không qua kho"
  await page.locator('header').getByText('Mua hàng trong nước nhập kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng trong nước không qua kho').last().click();
  await page.waitForTimeout(500);

  // 2A. Test Chưa thanh toán (Screenshot 1)
  await page.getByRole("dialog").getByText("Chưa thanh toán").click();
  await page.waitForTimeout(400);

  // Title has MH00001
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn MH00001")')).toBeVisible();

  // Subtab has ONLY "Chứng từ ghi nợ"
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).not.toBeVisible();

  // Master left has Diễn giải full width, no Người giao hàng
  await expect(page.locator('label:text-is("Diễn giải")')).toBeVisible();
  await expect(page.locator('label:text-is("Người giao hàng")')).not.toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toBeVisible();

  // Master right has Số chứng từ MH00001
  await expect(page.locator('label:text-is("Số chứng từ")')).toBeVisible();
  await expect(page.locator('input[value="MH00001"]')).toBeVisible();

  // Table headers have TK Chi phí & TK Công nợ, Chi phí mua hàng
  await expect(page.locator('th:has-text("TK Chi phí")')).toBeVisible();
  await expect(page.locator('th:has-text("TK Công nợ")')).toBeVisible();
  await expect(page.locator('th:has-text("Chi phí mua hàng")')).toBeVisible();

  // Summary has "Tổng giá trị"
  await expect(page.locator('span:text-is("Tổng giá trị")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_non_warehouse_unpaid.png" });

  // 2B. Test Thanh toán ngay (Screenshot 2)
  await page.getByRole("dialog").getByText("Thanh toán ngay").click();
  await page.waitForTimeout(400);

  // Title has PC00001
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn PC00001")')).toBeVisible();

  // Subtab has ONLY "Phiếu chi"
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).not.toBeVisible();

  // Master left has Người nhận, Lý do chi
  await expect(page.locator('label:text-is("Người nhận")')).toBeVisible();
  await expect(page.locator('label:text-is("Lý do chi")')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).not.toBeVisible();

  // Table header has TK Tiền
  await expect(page.locator('th:has-text("TK Tiền")')).toBeVisible();
  await expect(page.locator('table input[value="111"]')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_non_warehouse_paid.png" });

  // =========================================================================
  // 3. Mua hàng nhập khẩu nhập kho (User Screenshots 3, 4, 5)
  // =========================================================================
  // Switch template to "Mua hàng nhập khẩu nhập kho"
  await page.locator('header').getByText('Mua hàng trong nước không qua kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng nhập khẩu nhập kho').last().click();
  await page.waitForTimeout(500);

  // 3A. Test Chưa thanh toán (Screenshot 3)
  await page.getByRole("dialog").getByText("Chưa thanh toán").click();
  await page.waitForTimeout(400);

  // Title has NK00001
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn NK00001")')).toBeVisible();

  // Subtab has ONLY "Phiếu nhập"
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).not.toBeVisible();

  // Master left has Người giao hàng, Địa chỉ, Điều khoản thanh toán
  await expect(page.locator('label:text-is("Người giao hàng")')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toBeVisible();

  // 4 Detail tabs: Hàng tiền, Thuế, Phí trước hải quan, Phí hàng về kho
  await expect(page.getByRole("button", { name: "Hàng tiền" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thuế" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phí trước hải quan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phí hàng về kho" })).toBeVisible();

  // Summary has 10 import lines
  await expect(page.locator('span:text-is("Thuế nhập khẩu")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế CBBG")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế TTĐB")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế BVMT")')).toBeVisible();
  await expect(page.locator('span:text-is("Phí trước HQ")')).toBeVisible();
  await expect(page.locator('span:text-is("Phí hàng về kho")')).toBeVisible();
  await expect(page.locator('span:text-is("Giá trị nhập kho")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_import_warehouse_unpaid.png" });

  // 3B. Test Thanh toán ngay - Tab Phiếu nhập (Screenshot 4)
  await page.getByRole("dialog").getByText("Thanh toán ngay").click();
  await page.waitForTimeout(400);

  // Subtabs: both Phiếu nhập and Phiếu chi visible
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toBeVisible();

  // Master left has Người giao hàng, Điều khoản thanh toán is hidden
  await expect(page.locator('label:text-is("Người giao hàng")')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).not.toBeVisible();

  // Table header has TK Tiền
  await expect(page.locator('th:has-text("TK Tiền")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_import_warehouse_paid_receipt.png" });

  // 3C. Test Thanh toán ngay - Tab Phiếu chi (Screenshot 5)
  await page.getByRole("button", { name: "Phiếu chi" }).click();
  await page.waitForTimeout(400);

  // Master left has Người nhận, Lý do chi
  await expect(page.locator('label:text-is("Người nhận")')).toBeVisible();
  await expect(page.locator('label:text-is("Lý do chi")')).toBeVisible();

  // Master right has Số chứng từ PC00001
  await expect(page.locator('label:text-is("Số chứng từ")')).toBeVisible();
  await expect(page.locator('input[value="PC00001"]')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_import_warehouse_paid_payment.png" });

  // =========================================================================
  // 4. Mua hàng nhập khẩu không qua kho (User Screenshots 1, 2, 3)
  // =========================================================================
  // Switch template to "Mua hàng nhập khẩu không qua kho"
  await page.locator('header').getByText('Mua hàng nhập khẩu nhập kho').click();
  await page.waitForTimeout(300);
  await page.locator('text=Mua hàng nhập khẩu không qua kho').last().click();
  await page.waitForTimeout(500);

  // 4A. Test Chưa thanh toán (Screenshot 1)
  await page.getByRole("dialog").getByText("Chưa thanh toán").click();
  await page.waitForTimeout(400);

  // Title has MH00001
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn MH00001")')).toBeVisible();

  // Subtab has ONLY "Chứng từ ghi nợ"
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu chi" })).not.toBeVisible();

  // Master left has Diễn giải full width, Nhân viên mua hàng, Tham chiếu, Điều khoản thanh toán
  await expect(page.locator('label:text-is("Diễn giải")')).toBeVisible();
  await expect(page.locator('label:text-is("Người nhận")')).not.toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).toBeVisible();

  // Master right has Số chứng từ MH00001
  await expect(page.locator('label:text-is("Số chứng từ")')).toBeVisible();
  await expect(page.locator('input[value="MH00001"]')).toBeVisible();

  // 4 Detail tabs: Hàng tiền, Thuế, Phí trước hải quan, Chi phí mua hàng
  await expect(page.getByRole("button", { name: "Hàng tiền" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thuế" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phí trước hải quan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chi phí mua hàng" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Phí hàng về kho" })).not.toBeVisible();

  // Table headers have TK Chi phí, TK Công nợ, Phí trước HQ
  await expect(page.locator('th:has-text("TK Chi phí")')).toBeVisible();
  await expect(page.locator('th:has-text("TK Công nợ")')).toBeVisible();
  await expect(page.locator('th:has-text("Phí trước HQ")')).toBeVisible();
  await expect(page.locator('table input[value="331"]')).toBeVisible();

  // Summary lines
  await expect(page.locator('span:text-is("Thuế nhập khẩu")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế CBBG")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế TTĐB")')).toBeVisible();
  await expect(page.locator('span:text-is("Thuế BVMT")')).toBeVisible();
  await expect(page.locator('span:text-is("Phí trước HQ")')).toBeVisible();
  await expect(page.locator('div:has-text("Chi phí mua hàng") span:text-is("Chi phí mua hàng")')).toBeVisible();
  await expect(page.locator('span:text-is("Tổng giá trị")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_import_non_warehouse_unpaid.png" });

  // 4B. Test Thanh toán ngay (Screenshot 2)
  await page.getByRole("dialog").getByText("Thanh toán ngay").click();
  await page.waitForTimeout(400);

  // Title has PC00001
  await expect(page.locator('h2:has-text("Chứng từ mua hàng nhiều hóa đơn PC00001")')).toBeVisible();

  // Subtab has ONLY "Phiếu chi"
  await expect(page.getByRole("button", { name: "Phiếu chi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chứng từ ghi nợ" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Phiếu nhập" })).not.toBeVisible();

  // Master left has Người nhận, Địa chỉ, Lý do chi, Kèm theo chứng từ gốc
  await expect(page.locator('label:text-is("Người nhận")')).toBeVisible();
  await expect(page.locator('label:text-is("Lý do chi")')).toBeVisible();
  await expect(page.locator('span:text-is("Kèm theo")')).toBeVisible();
  await expect(page.locator('span:text-is("Chứng từ gốc")')).toBeVisible();
  await expect(page.locator('text=Điều khoản thanh toán')).not.toBeVisible();

  // Table headers have TK Tiền
  await expect(page.locator('th:has-text("TK Tiền")')).toBeVisible();
  await expect(page.locator('table input[value="111"]')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_import_non_warehouse_paid.png" });

  // 4C. Test Payment Dropdown (Screenshot 3)
  await page.locator('[data-testid="multi-payment-method-selector"]').click();
  await page.waitForTimeout(300);
  const importPopup = page.locator('[data-testid="multi-payment-dropdown-menu"]');
  await expect(importPopup.locator('div:text-is("Tiền mặt")')).toBeVisible();
  await expect(importPopup.locator('div:text-is("Ủy nhiệm chi")')).toBeVisible();
  await expect(importPopup.locator('div:text-is("Séc chuyển khoản")')).toBeVisible();
  await expect(importPopup.locator('div:text-is("Séc tiền mặt")')).toBeVisible();
  await page.screenshot({ path: "tests/screenshots/multi_invoice_payment_dropdown.png" });

  // Close dropdown by selecting Tiền mặt
  await importPopup.locator('div:text-is("Tiền mặt")').click();
  await page.waitForTimeout(300);

  // Close modal
  await page.getByRole("button", { name: "Cất và Đóng" }).click();
  await page.waitForTimeout(500);
});
