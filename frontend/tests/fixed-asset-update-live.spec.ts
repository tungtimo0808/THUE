import { expect, test } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

test("UC-FA-02 sửa tên từ Sổ tài sản chỉ gửi trường thay đổi, không cần lý do", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-update-test", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" },
  })), { company });
  let assetName = "Máy đóng gói";
  let saved: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path === `/api/v1/fixed-assets/assets/${assetId}/update-info/` && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      assetName = String(saved?.name || assetName);
      return route.fulfill({ json: { asset: { id: assetId, name: assetName, version: 2 }, changes: { changed_fields: ["name"] }, no_changes: false, message: "Cập nhật thông tin tài sản thành công." } });
    }
    if (path === `/api/v1/fixed-assets/assets/${assetId}/history/`) return route.fulfill({ json: { transactions: [], audit_logs: [] } });
    if (path === "/api/v1/fixed-assets/assets/") return route.fulfill({ json: { results: [{
      id: assetId, company, code: "TSCD001", name: assetName, asset_type: "FIXED_ASSET", status: "ACTIVE", version: assetName === "Máy đóng gói" ? 1 : 2,
      acquisition_voucher_no: "GT001", acquisition_date: "2026-10-01", in_service_date: "2026-10-01", original_cost: "30000000",
      accumulated_depreciation: "0", remaining_value: "30000000", department_name: "Kế toán", category_name: "Máy móc", origins: [], components: [], accessories: [],
    }] } });
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto("/assets/register");
  await expect(page.getByRole("button", { name: "Chức năng tài sản TSCD001" })).toBeVisible();
  await page.getByRole("button", { name: "Chức năng tài sản TSCD001" }).click();
  await page.getByRole("button", { name: "Sửa tài sản TSCD001" }).click();
  const nameInput = page.locator("label", { hasText: "Tên tài sản" }).locator("..").locator("input").first();
  await expect(nameInput).toHaveValue("Máy đóng gói");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  expect(saved).toBeNull();
  await expect(page.getByText("Không có thông tin thay đổi.")).toBeVisible();
  await nameInput.fill("Máy đóng gói mới");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({ name: "Máy đóng gói mới", version: 1, expected_status: "ACTIVE" });
  expect(saved).not.toHaveProperty("origins");
  expect(saved).not.toHaveProperty("update_reason");
  expect(saved).not.toHaveProperty("original_cost");
  await expect(nameInput).toHaveValue("Máy đóng gói mới");
});
