import { test, expect } from "@playwright/test";

test.describe("Chứng từ bán dịch vụ (Service Sale Voucher BH00001)", () => {
  test("Verify UI, layout, fields and behaviors for service sales voucher", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1600, height: 950 });

    // 1. Go to sales transactions tab
    await page.goto("http://localhost:5173/sales/transactions?company=minh-an&period=2026-09");
    await page.waitForTimeout(1000);

    // 2. Open "+ Thêm" dropdown and select "Chứng từ bán dịch vụ"
    const themBtn = page.getByRole('button', { name: 'Thêm', exact: true }).first();
    await expect(themBtn).toBeVisible();
    const dropdownTrigger = themBtn.locator('xpath=following-sibling::button').first();
    await dropdownTrigger.click();
    await page.waitForTimeout(400);

    const serviceSaleItem = page.locator('div:text-is("Chứng từ bán dịch vụ")');
    await expect(serviceSaleItem).toBeVisible();
    await serviceSaleItem.click();
    await page.waitForTimeout(600);

    // 3. Modal Header Check
    // Title
    const modal = page.locator('.misa-modal-backdrop');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toContainText(/Chứng từ bán dịch vụ BH\d+/);

    // saleType dropdown should NOT be visible when isService = true
    await expect(modal.locator('select').filter({ hasText: "Bán hàng hóa trong nước" })).not.toBeVisible();

    // Search placeholder should be "Nhập số hóa đơn"
    await expect(modal.locator('input[placeholder="Nhập số hóa đơn"]')).toBeVisible();

    // 4. Mode Bar Check
    // "Kiêm phiếu xuất" checkbox should be HIDDEN
    await expect(modal.locator('label:has-text("Kiêm phiếu xuất")')).not.toBeVisible();

    // "Lập kèm hóa đơn" checkbox should be checked
    const lapKemHd = modal.locator('label:has-text("Lập kèm hóa đơn") input[type="checkbox"]');
    await expect(lapKemHd).toBeVisible();
    await expect(lapKemHd).toBeChecked();

    // Sub-tabs: "Chứng từ ghi nợ" and "Hóa đơn" present, "Phiếu xuất" HIDDEN
    await expect(modal.locator('button:text-is("Chứng từ ghi nợ")')).toBeVisible();
    await expect(modal.locator('button:text-is("Hóa đơn")')).toBeVisible();
    await expect(modal.locator('button:text-is("Phiếu xuất")')).not.toBeVisible();

    // Badge "Đã lập hóa đơn"
    await expect(modal.locator('text=Đã lập hóa đơn')).toBeVisible();

    // Total label "Tổng tiền"
    await expect(modal.getByText("Tổng tiền", { exact: true })).toBeVisible();

    // 5. Master Form Fields Check
    await expect(modal.locator('label:text-is("Mã khách hàng")')).toBeVisible();
    await expect(modal.locator('label:text-is("Tên khách hàng")')).toBeVisible();
    await expect(modal.locator('label:has-text("Mã số thuế/CCCD chủ hộ")')).toBeVisible();
    await expect(modal.locator('label:text-is("Ngày hạch toán")')).toBeVisible();

    await expect(modal.locator('label:text-is("Người liên hệ")')).toBeVisible();
    await expect(modal.locator('label:text-is("Địa chỉ")')).toBeVisible();
    await expect(modal.locator('label:has-text("Ngày chứng từ")')).toBeVisible();

    await expect(modal.locator('label:text-is("Nhân viên bán hàng")')).toBeVisible();
    await expect(modal.locator('label:text-is("Diễn giải")')).toBeVisible();
    await expect(modal.locator('label:text-is("Số chứng từ")')).toBeVisible();
    await expect(modal.locator('input[value^="BH0000"]')).toBeVisible();

    // Reference and payment terms
    await expect(modal.locator('text=Tham chiếu ...')).toBeVisible();
    await expect(modal.locator('text=Điều khoản thanh toán').first()).toBeVisible();

    // 6. Detail Grid Check
    // Only "Hàng tiền" tab, NO "Giá vốn" tab
    await expect(modal.locator('button:text-is("Hàng tiền")')).toBeVisible();
    await expect(modal.locator('button:text-is("Giá vốn")')).not.toBeVisible();

    // AVA Kế toán button
    await expect(modal.locator('button:has-text("AVA Kế toán")')).toBeVisible();

    // Table Headers
    await expect(modal.locator('th:has-text("Mã hàng")')).toBeVisible();
    await expect(modal.locator('th:has-text("Tên dịch vụ")')).toBeVisible();
    await expect(modal.locator('th:has-text("TK công nợ")')).toBeVisible();
    await expect(modal.locator('th:has-text("TK doanh thu")')).toBeVisible();
    await expect(modal.locator('th:has-text("ĐVT")')).toBeVisible();
    await expect(modal.locator('th:has-text("Số lượng")')).toBeVisible();
    await expect(modal.locator('th:has-text("Đơn giá")')).toBeVisible();
    await expect(modal.locator('th:has-text("Thành tiền")')).toBeVisible();
    await expect(modal.locator('th:has-text("% Thuế GTGT")')).toBeVisible();
    await expect(modal.locator('th:has-text("Tiền thuế GTGT")')).toBeVisible();
    await expect(modal.locator('th:has-text("TK thuế GTGT")')).toBeVisible();

    // Default account values: TK công nợ = 131, TK doanh thu = 511, TK thuế GTGT = 33311
    await expect(modal.locator('table input[value="131"]')).toBeVisible();
    await expect(modal.locator('table input[value="511"]')).toBeVisible();
    await expect(modal.locator('table input[value="33311"]')).toBeVisible();

    // 7. Lower Section Check
    await expect(modal.locator('button:has-text("Thêm dòng")')).toBeVisible();
    await expect(modal.locator('button:has-text("Xóa hết dòng")')).toBeVisible();
    await expect(modal.locator('button:has-text("Thêm ghi chú")')).toBeVisible();

    // Service specific fields: Mã cửa hàng, Tên cửa hàng, Điều khoản khác, Mã tra cứu HĐĐT, Đường dẫn tra cứu HĐĐT
    await expect(modal.locator('label:text-is("Mã cửa hàng")')).toBeVisible();
    await expect(modal.locator('label:text-is("Tên cửa hàng")')).toBeVisible();
    await expect(modal.locator('label:text-is("Điều khoản khác")')).toBeVisible();
    await expect(modal.locator('label:text-is("Mã tra cứu HĐĐT")')).toBeVisible();
    await expect(modal.locator('label:text-is("Đường dẫn tra cứu HĐĐT")')).toBeVisible();

    // "Là hóa đơn thay thế" should NOT be visible in service sale
    await expect(modal.locator('label:has-text("Là hóa đơn thay thế")')).not.toBeVisible();

    // 8. Totals Summary Box Check
    await expect(modal.locator('span:text-is("Tổng tiền dịch vụ")')).toBeVisible();
    await expect(modal.locator('span:text-is("Thuế GTGT")')).toBeVisible();
    await expect(modal.locator('span:text-is("Tổng tiền thanh toán")')).toBeVisible();

    // 9. Modal Footer Check
    await expect(modal.locator('text=Hiển thị tài khoản')).toBeVisible();
    await expect(modal.locator('button:text-is("Hủy")')).toBeVisible();
    await expect(modal.locator('button:text-is("Cất")')).toBeVisible();
    await expect(modal.locator('button:has-text("Cất và In")')).toBeVisible();

    // Capture visual screenshot
    await page.screenshot({ path: "tests/screenshots/service_sale_voucher_uncollected.png" });

    // 10. Switch to "Thu tiền ngay"
    await modal.locator('label:has-text("Thu tiền ngay")').click();
    await page.waitForTimeout(400);

    // Title changes to PT
    await expect(modal.locator('h2')).toContainText(/Chứng từ bán dịch vụ PT\d+/);

    // Sub-tab changes to "Phiếu thu"
    await expect(modal.locator('button:text-is("Phiếu thu")')).toBeVisible();

    // Fields change to "Người nộp", "Lý do nộp", "Kèm theo"
    await expect(modal.locator('label:text-is("Người nộp")')).toBeVisible();
    await expect(modal.locator('label:text-is("Lý do nộp")')).toBeVisible();
    await expect(modal.locator('label:text-is("Số phiếu thu")')).toBeVisible();

    // Table now has TK tiền = 111
    await expect(modal.locator('th:has-text("TK tiền")')).toBeVisible();
    await expect(modal.locator('table input[value="111"]')).toBeVisible();

    // Capture paid screenshot
    await page.screenshot({ path: "tests/screenshots/service_sale_voucher_collected.png" });
  });
});
