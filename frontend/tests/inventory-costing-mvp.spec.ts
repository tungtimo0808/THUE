import { expect, test } from "@playwright/test";

test("UC-INV-10 uses accounting period and policy, confirms recalculation, then runs API", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const period = "22222222-2222-4222-8222-222222222222";
  const warehouse = "33333333-3333-4333-8333-333333333333";
  const posted: Record<string, unknown>[] = [];
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "costing-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/inventory/valuations/options/") {
      await route.fulfill({ json: { warehouses: [{ id: warehouse, code: "K1", name: "Kho chính" }],
        periods: [{ id: period, code: "K9.2026", from: "2026-09-01", to: "2026-09-30", status: "OPEN" }],
        methods: [{ code: "PERIODIC_AVERAGE", name: "Bình quân gia quyền cuối kỳ" },
          { code: "MOVING_AVERAGE", name: "Bình quân liên hoàn" }, { code: "FIFO", name: "Nhập trước xuất trước" }],
        default_method: "PERIODIC_AVERAGE" } }); return;
    }
    if (url.pathname === "/api/v1/inventory/valuations/" && route.request().method() === "GET") {
      await route.fulfill({ json: [] }); return;
    }
    if (url.pathname === "/api/v1/inventory/valuations/" && route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      posted.push(body);
      if (!body.recalculate) {
        await route.fulfill({ status: 400, json: { detail: "Kỳ và phạm vi này đã tính giá. Hãy xác nhận tính lại để thay thế kết quả." } });
      } else {
        await route.fulfill({ status: 201, json: { id: "run-1", valuation_date: "2026-09-30", warehouse,
          method: "PERIODIC_AVERAGE", status: "COMPLETED", details: { period_start: "2026-09-01", updated_lines: 2,
            adjustments: 1, recalculated: true }, created_at: "2026-10-22T00:00:00Z" } });
      }
      return;
    }
    if (url.pathname === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    await route.fulfill({ json: { results: [] } });
  });
  await page.goto("/inventory/process");
  await page.getByText("Tính giá xuất kho", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tính giá xuất kho" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Kỳ tính giá")).toHaveValue(period);
  await expect(dialog.getByLabel("Phương pháp tính giá")).toHaveValue("PERIODIC_AVERAGE");
  await dialog.getByLabel("Phạm vi tính giá").selectOption(warehouse);
  await dialog.getByRole("button", { name: "Thực hiện tính giá" }).click();
  await expect(dialog.getByRole("button", { name: "Xác nhận tính lại" })).toBeVisible();
  await dialog.getByRole("button", { name: "Xác nhận tính lại" }).click();
  await expect(dialog).not.toBeVisible();
  expect(posted).toHaveLength(2);
  expect(posted[1]).toMatchObject({ company, period, warehouse, method: "PERIODIC_AVERAGE", recalculate: true });
});
