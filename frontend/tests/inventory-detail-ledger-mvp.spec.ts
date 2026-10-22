import { expect, test } from "@playwright/test";

test("UC-INV-13 opens the full stock ledger from Kho and refreshes real report rows", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const warehouse = "22222222-2222-4222-8222-222222222222";
  const item = "33333333-3333-4333-8333-333333333333";
  let balance = "7";
  let calls = 0;
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "ledger-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    if (path === "/api/v1/inventory/balances/summary-options/") {
      await route.fulfill({ json: { warehouses: [{ id: warehouse, code: "K1", name: "Kho chính" }], categories: [] } }); return;
    }
    if (path === "/api/v1/master-data/items/") {
      await route.fulfill({ json: [{ id: item, code: "HH01", name: "Hàng hóa thử", status: "ACTIVE", track_inventory: true }] }); return;
    }
    if (path === "/api/v1/inventory/balances/detail-ledger/") {
      calls++;
      const url = new URL(route.request().url());
      expect(url.searchParams.get("warehouse_ids")).toBe(warehouse);
      expect(url.searchParams.get("item_ids")).toBe(item);
      await route.fulfill({ json: { company_id: company, date_from: "2026-10-01", date_to: "2026-10-31", currency: "VND",
        groups: [{ warehouse_id: warehouse, warehouse_name: "Kho chính", item_id: item, item_code: "HH01",
          item_name: "Hàng hóa thử", item_description: "", uom: "Cái", opening_quantity: "6",
          opening_value: "60", closing_quantity: balance, closing_value: "70", reconciled: true,
          movements: [{ movement_id: "m1", posting_date: "2026-10-06", document_date: "2026-10-05",
            transaction_number: "NK-01", description: "Nhập thử", unit_price: "10",
            receipt_quantity: "3", receipt_value: "30", issue_quantity: "0", issue_value: "0",
            balance_quantity: "9", balance_value: "90", negative_stock: false, valuation_incomplete: false },
          { movement_id: "m2", posting_date: "2026-10-08", document_date: "2026-10-08",
            transaction_number: "XK-01", description: "Xuất thử", unit_price: "10",
            receipt_quantity: "0", receipt_value: "0", issue_quantity: "2", issue_value: "20",
            balance_quantity: balance, balance_value: "70", negative_stock: false, valuation_incomplete: false }] }] } }); return;
    }
    await route.fulfill({ json: [] });
  });
  await page.goto("/inventory/reports");
  await page.getByText("Báo cáo chi tiết kho", { exact: true }).click();
  await page.getByText("Sổ chi tiết vật tư hàng hóa", { exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Chọn tham số sổ chi tiết" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Hàng hóa thử").check();
  await dialog.getByRole("button", { name: "Xem báo cáo" }).click();
  const table = page.getByRole("table", { name: "Sổ chi tiết vật tư hàng hóa" });
  await expect(table.getByText("NK-01")).toBeVisible();
  await expect(table.getByText("XK-01")).toBeVisible();
  await expect(table.getByText("Tồn đầu kỳ")).toBeVisible();
  await expect(table.getByText("Tồn cuối kỳ")).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm trong báo cáo" }).fill("XK-01");
  await expect(table.getByText("NK-01")).toHaveCount(0);
  await expect(table.getByText("XK-01")).toBeVisible();
  await expect(table.getByText("Tồn đầu kỳ")).toBeVisible();
  balance = "5";
  await page.getByRole("button", { name: "Nạp lại" }).click();
  await expect.poll(() => calls).toBe(2);
  await expect(table.getByRole("row", { name: /Tồn cuối kỳ/ })).toContainText("5");
  await page.getByRole("button", { name: "Ẩn hiện cột" }).click();
  await page.getByLabel("Mô tả", { exact: true }).uncheck();
  await expect(table.getByRole("columnheader", { name: "Mô tả" })).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất báo cáo" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^so-chi-tiet-vat-tu-.*\.csv$/);
});
