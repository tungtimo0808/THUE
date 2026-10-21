import { expect, test } from "@playwright/test";

test("bank balance report uses API rows, filters totals and exports Excel", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-report-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let exports = 0;
  let refreshed = 0;
  let failRefresh = false;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/balance-report/options/") {
      await route.fulfill({ json: [{ code: "112", name: "Tiền gửi không kỳ hạn" }, { code: "1121", name: "Tiền gửi VND" }] }); return;
    }
    if (path === "/api/v1/bank/balance-report/summary/") {
      refreshed++;
      if (failRefresh) { await route.fulfill({ status: 500, json: { detail: "Không thể cập nhật dữ liệu báo cáo." } }); return; }
      await route.fulfill({ json: { rows: [
        { id: "a1", bank_account_no: "19000001", bank_name: "Techcombank", currency: "VND", opening_balance: "100", debit_amount: "50", credit_amount: "10", closing_balance: "140" },
        { id: "a2", bank_account_no: "19000002", bank_name: "BIDV", currency: "VND", opening_balance: "20", debit_amount: "0", credit_amount: "5", closing_balance: "15" },
      ], warnings: [] } }); return;
    }
    if (path === "/api/v1/bank/balance-report/export/") {
      exports++;
      await route.fulfill({ body: Buffer.from("PKmock"), headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } }); return;
    }
    if (path === "/api/v1/bank/balance-report/save/") {
      await route.fulfill({ status: 201, json: { id: "preset-1", name: "Bảng kê" } }); return;
    }
    if (path === "/api/v1/bank/balance-report/presets/") {
      await route.fulfill({ json: [{ id: "preset-1", name: "Bảng kê", account_code: "112", date_from: "2026-10-01", date_to: "2026-10-31", period_preset: "Tháng này", search: "" }] }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto(`/bank/reports?company=${company}&report=${encodeURIComponent("Bảng kê số dư ngân hàng")}`);
  await expect(page.getByRole("heading", { name: "Bảng kê số dư ngân hàng", exact: true })).toBeVisible();
  await expect(page.getByText("19000001")).toBeVisible();
  await expect(page.getByText("Tổng cộng (VND)")).toBeVisible();
  await expect(page.getByText("155", { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder("Nhập từ khóa tìm kiếm").fill("19000001");
  await expect(page.getByText("19000002")).toHaveCount(0);
  await expect(page.getByText("140", { exact: true }).first()).toBeVisible();
  await page.getByTitle("Nạp lại").click();
  await expect.poll(() => refreshed).toBeGreaterThan(1);
  await page.getByTitle("Xuất khẩu Excel").click();
  await expect.poll(() => exports).toBe(1);
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await page.getByRole("button", { name: "Danh sách báo cáo đã lưu" }).click();
  await expect(page.getByText("Báo cáo đã lưu", { exact: true })).toBeVisible();
  failRefresh = true;
  await page.getByTitle("Nạp lại").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("19000001")).toBeVisible();
});
