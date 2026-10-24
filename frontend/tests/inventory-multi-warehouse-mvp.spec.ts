import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("UC-INV-09 opens live multi-warehouse report, detail, and real Excel", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const warehouseA = "22222222-2222-4222-8222-222222222222";
  const warehouseB = "33333333-3333-4333-8333-333333333333";
  const item = "44444444-4444-4444-8444-444444444444";
  const reportCalls: URL[] = [];
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "inventory-report-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/inventory/balances/summary-options/") {
      await route.fulfill({ json: { warehouses: [
        { id: warehouseA, code: "K1", name: "Kho A" }, { id: warehouseB, code: "K2", name: "Kho B" },
      ], categories: [{ id: "55555555-5555-4555-8555-555555555555", code: "HH", name: "Hàng hóa" }] } }); return;
    }
    if (url.pathname === "/api/v1/inventory/balances/multi-warehouse-summary/") {
      reportCalls.push(url);
      await route.fulfill({ json: { date_from: url.searchParams.get("date_from"), date_to: url.searchParams.get("date_to"),
        warehouse_ids: [warehouseA, warehouseB], currency: "VND", totals: { closing_value: "320" },
        rows: [{ item_id: item, item_code: "VT001", item_name: "Vật tư thật", uom: "Cái", warehouse_count: 2,
          opening_quantity: "5", opening_value: "50", receipt_quantity: "14", receipt_value: "320",
          issue_quantity: "3", issue_value: "50", closing_quantity: "16", closing_value: "320",
          valuation_incomplete: false }] } }); return;
    }
    if (url.pathname === "/api/v1/inventory/balances/movement-detail/") {
      await route.fulfill({ json: { item_code: "VT001", item_name: "Vật tư thật", uom: "Cái",
        opening: { [warehouseA]: { quantity: "5", value: "50" } }, movements: [
          { movement_id: "m1", date: "2026-10-21", transaction_number: "NK001", warehouse_id: warehouseA,
            warehouse_name: "Kho A", quantity_delta: "10", value_delta: "200", balance_quantity: "15", balance_value: "250" },
        ] } }); return;
    }
    if (url.pathname === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    await route.fulfill({ json: { results: [] } });
  });

  await page.goto("/inventory/reports");
  await page.getByText("Tổng hợp nhập xuất tồn trên nhiều kho", { exact: true }).click();
  await expect(page.getByText("Vật tư thật")).toBeVisible();
  await expect(page.getByText("Kho áp dụng: Kho A, Kho B")).toBeVisible();
  expect(reportCalls[0].searchParams.get("warehouse_ids")).toBe(`${warehouseA},${warehouseB}`);
  expect(reportCalls[0].searchParams.get("date_from")).toBe("2026-09-01");
  await page.getByRole("button", { name: "VT001" }).click();
  await expect(page.getByRole("dialog", { name: "Sổ chi tiết vật tư hàng hóa" })).toBeVisible();
  await expect(page.getByText("NK001")).toBeVisible();
  await page.getByRole("button", { name: "Đóng sổ chi tiết" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^tong-hop-nhap-xuat-ton-.*\.xlsx$/);
  const XLSX = await import("xlsx");
  const book = XLSX.read(await readFile(await download.path()), { type: "buffer" });
  const exported = XLSX.utils.sheet_to_json<(string | number)[]>(book.Sheets[book.SheetNames[0]], { header: 1 });
  expect(exported[0][0]).toBe("TỔNG HỢP NHẬP XUẤT TỒN TRÊN NHIỀU KHO");
  expect(exported[5][0]).toBe("VT001");
  expect(exported[5][7]).toBe(320);
  await page.getByRole("button", { name: "Chọn tham số" }).click();
  await expect(page.getByRole("dialog", { name: "Chọn tham số nhập xuất tồn" })).toBeVisible();
  await page.getByRole("checkbox", { name: "K2 · Kho B" }).uncheck();
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect.poll(() => reportCalls.length).toBe(2);
  expect(reportCalls[1].searchParams.get("warehouse_ids")).toBe(warehouseA);
  await page.getByRole("button", { name: "Đóng báo cáo" }).click();

  await page.goto("/reports");
  await page.getByRole("button", { name: "Kho", exact: true }).click();
  await page.getByText("Tổng hợp nhập xuất tồn trên nhiều kho", { exact: true }).first().click();
  await expect(page.getByText("Vật tư thật")).toBeVisible();
  expect(reportCalls).toHaveLength(3);
});
