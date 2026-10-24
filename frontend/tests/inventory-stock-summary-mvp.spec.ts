import { expect, test } from "@playwright/test";

test("UC-INV-08 uses the live stock summary in both report entry points", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const warehouse = "22222222-2222-4222-8222-222222222222";
  const calls: URL[] = [];
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "stock-summary-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/inventory/balances/summary-options/") {
      await route.fulfill({ json: { warehouses: [{ id: warehouse, code: "K1", name: "Kho chính" }],
        categories: [{ id: "33333333-3333-4333-8333-333333333333", code: "HH", name: "Hàng hóa" }] } }); return;
    }
    if (url.pathname === "/api/v1/inventory/balances/summary/") {
      calls.push(url);
      await route.fulfill({ json: { date_from: url.searchParams.get("date_from"), date_to: url.searchParams.get("date_to"),
        warehouse_ids: [warehouse], totals: { opening_value: "100", receipt_value: "50", issue_value: "20", closing_value: "130" },
        rows: [{ warehouse_id: warehouse, warehouse_name: "Kho chính", item_id: "item-1", item_code: "VT001",
          item_name: "Vật tư thật", uom: "Cái", opening_quantity: "10", opening_value: "100", receipt_quantity: "5",
          receipt_value: "50", issue_quantity: "2", issue_value: "20", closing_quantity: "13", closing_value: "130",
          valuation_incomplete: false }] } }); return;
    }
    if (url.pathname === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    await route.fulfill({ json: { results: [] } });
  });
  await page.goto("/reports");
  await page.getByText("Tổng hợp tồn kho", { exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "Chọn tham số" })).toBeVisible();
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect(page.getByText("Vật tư thật")).toBeVisible();
  await expect(page.getByText("VT001")).toBeVisible();
  expect(calls[0].searchParams.get("warehouse_ids")).toBe(warehouse);
  await page.getByPlaceholder("Nhập từ khóa tìm kiếm").fill("không có");
  await expect(page.getByText("Không có dữ liệu phù hợp với điều kiện đã chọn.")).toBeVisible();
  await page.getByPlaceholder("Nhập từ khóa tìm kiếm").fill("");
  await expect(page.getByText("Vật tư thật")).toBeVisible();
  await page.getByRole("button", { name: "Nạp lại" }).click();
  await expect.poll(() => calls.length).toBe(2);
  await page.goto("/inventory/reports");
  await page.getByText("Tổng hợp tồn kho", { exact: true }).first().click();
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect(page.getByText("Vật tư thật")).toBeVisible();
  expect(calls).toHaveLength(3);
});
