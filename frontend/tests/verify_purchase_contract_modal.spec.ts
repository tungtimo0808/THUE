import { test, expect } from "@playwright/test";
import * as path from "path";

test("Capture Purchase Contract Modal with extended info and payment terms", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("http://localhost:5173/purchases/contracts?company=minh-an&period=2026-09");
  await page.waitForTimeout(1500);

  // Click "Thêm hợp đồng mua"
  const addBtn = page.getByRole("button", { name: "Thêm hợp đồng mua" });
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();
  await page.waitForTimeout(1000);

  // Verify modal is visible
  const modal = page.locator(".misa-modal-backdrop");
  await expect(modal).toBeVisible();

  // Verify "Thông tin mở rộng" section exists
  await expect(page.locator("text=Thông tin mở rộng")).toBeVisible();
  await expect(page.locator("text=Trích yếu")).toBeVisible();
  await expect(page.locator("text=Nhân viên mua hàng")).toBeVisible();
  await expect(page.locator("text=Là hợp đồng phát sinh trước khi sử dụng phần mềm")).toBeVisible();
  await expect(page.locator("text=Giá trị thanh lý")).toBeVisible();
  await expect(page.locator("text=Ngày thanh lý/hủy bỏ")).toBeVisible();
  await expect(page.locator("text=Lý do thanh lý/hủy bỏ")).toBeVisible();
  await expect(page.locator("text=Điều khoản khác")).toBeVisible();
  await expect(page.locator("text=Địa chỉ giao hàng")).toBeVisible();

  // Verify "Điều khoản thanh toán" section exists
  await expect(page.locator("text=Điều khoản thanh toán")).toBeVisible();
  await expect(page.locator("text=Đợt thanh toán")).toBeVisible();
  await expect(page.locator("text=Tỷ lệ thanh toán (%)")).toBeVisible();
  await expect(page.locator("text=Giá trị thanh toán")).toBeVisible();
  await expect(page.locator("text=Số đã trả năm trước")).toBeVisible();
  await expect(page.locator("text=Số còn phải trả")).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm dòng" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Xóa hết dòng" }).first()).toBeVisible();

  // Verify "Danh sách hàng hóa dịch vụ"
  await expect(page.locator("text=Danh sách hàng hóa dịch vụ")).toBeVisible();

  // Save screenshot to artifact directory
  const artifactPath = "C:/Users/timodapoet/.gemini/antigravity-ide/brain/a0afd306-2c44-4875-b676-447f4cdfee04/purchase_contract_modal_verified.png";
  await modal.screenshot({ path: artifactPath });
  console.log("Screenshot successfully saved to " + artifactPath);
});
