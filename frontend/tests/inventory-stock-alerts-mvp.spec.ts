import { expect, test } from "@playwright/test";

test("UC-INV-12 shows live alerts, refreshes them and saves the item minimum", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const itemId = "22222222-2222-4222-8222-222222222222";
  const warehouseId = "33333333-3333-4333-8333-333333333333";
  const uom = "44444444-4444-4444-8444-444444444444";
  let minimum = "5";
  let quantity = "2";
  let savedMinimum = "";
  let failAlerts = false;
  const alertData = () => ({ company_id: company, warehouse_ids: [warehouseId],
    low_count: Number(quantity) > 0 && Number(quantity) <= Number(minimum) ? 1 : 0,
    out_count: Number(quantity) <= 0 ? 1 : 0,
    low_rows: Number(quantity) > 0 && Number(quantity) <= Number(minimum) ? [{ item_id: itemId,
      item_code: "HH01", item_name: "Hàng hóa thử", warehouse_name: "Kho chính",
      quantity, minimum_quantity: minimum, negative_stock: false }] : [],
    out_rows: Number(quantity) <= 0 ? [{ item_id: itemId, item_code: "HH01",
      item_name: "Hàng hóa thử", warehouse_name: "Kho chính", quantity,
      minimum_quantity: minimum, negative_stock: Number(quantity) < 0 }] : [],
    updated_at: "2026-10-22T09:30:00+07:00" });
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "alerts-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    if (path === "/api/v1/inventory/balances/alerts/") {
      if (failAlerts) { await route.fulfill({ status: 500, json: { detail: "Temporary failure" } }); return; }
      await route.fulfill({ json: alertData() }); return;
    }
    if (path === "/api/v1/master-data/items/" && route.request().method() === "GET") {
      await route.fulfill({ json: [{ id: itemId, code: "HH01", name: "Hàng hóa thử",
        item_type: "GOODS", track_inventory: true, status: "ACTIVE", base_uom: uom,
        min_stock: minimum, version: "2026-10-22T00:00:00Z" }] }); return;
    }
    if (path === `/api/v1/master-data/items/${itemId}/` && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      savedMinimum = body.min_stock;
      minimum = body.min_stock;
      await route.fulfill({ json: { ...body, id: itemId, version: "2026-10-22T01:00:00Z" } }); return;
    }
    if (path === "/api/v1/master-data/units-of-measure/") {
      await route.fulfill({ json: [{ id: uom, code: "PCS", name: "Cái", symbol: "cái" }] }); return;
    }
    if (path === "/api/v1/inventory/balances/") {
      await route.fulfill({ json: [{ item: itemId, warehouse: warehouseId, quantity }] }); return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto("/inventory/chart");
  await expect(page.getByText("Hàng hóa thử")).toBeVisible();
  await expect(page.getByText("Kho chính")).toBeVisible();
  failAlerts = true;
  await page.getByRole("button", { name: "Tải lại" }).first().click();
  await expect(page.getByRole("alert")).toContainText("Số liệu hiển thị có thể đã cũ.");
  await expect(page.getByText("Hàng hóa thử")).toBeVisible();
  failAlerts = false;
  quantity = "0";
  await page.getByRole("button", { name: "Tải lại" }).first().click();
  await expect(page.getByText("Không có hàng hóa sắp hết.")).toBeVisible();

  quantity = "2";
  await page.goto("/inventory/items");
  await expect(page.getByRole("button", { name: /Hàng hóa sắp hết hàng/ })).toContainText("1");
  await page.getByRole("button", { name: /Hàng hóa hết hàng/ }).click();
  await expect(page.getByRole("row", { name: /Hàng hóa thử/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Hàng hóa hết hàng/ }).click();
  await page.getByRole("button", { name: /Sửa/ }).first().click();
  const minimumInput = page.getByText("Số lượng tồn tối thiểu").locator("..").locator("input");
  await expect(minimumInput).toHaveValue("5");
  await minimumInput.fill("1");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => savedMinimum).toBe("1");
  await expect(page.getByText("Số lượng tồn tối thiểu", { exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Sửa/ }).first().click();
  await expect(page.getByText("Số lượng tồn tối thiểu", { exact: true }).locator("..").locator("input")).toHaveValue("1");
  await page.goto("/inventory/chart");
  await expect(page.getByText("Không có hàng hóa sắp hết.")).toBeVisible();
});
