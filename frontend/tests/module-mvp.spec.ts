import { expect, test } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const supplierId = "22222222-2222-4222-8222-222222222222";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ companyId }) => {
    localStorage.setItem("erp_api_session", JSON.stringify({
      token: "ui-test-token", companyId,
      companies: [{ id: companyId, code: "ABC", name: "Công ty ABC", status: "ACTIVE" }],
    }));
  }, { companyId });
  await page.route("**/api/v1/common/companies/mine/", route => route.fulfill({ json: [{ id: companyId, code: "ABC", name: "Công ty ABC", status: "ACTIVE" }] }));
});

test("payment terms page saves monthly due date through API", async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/v1/master-data/payment-terms/**", async route => {
    if (route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { id: "new-term", code: payload?.code, name: payload?.name, status: "ACTIVE", version: 1, due_mode: "MONTHLY", due_day_of_month: 25, due_after_months: 2 } });
    } else await route.fulfill({ json: [] });
  });
  await page.goto("/payment-terms");
  await page.getByRole("button", { name: "Thêm mới" }).click();
  await page.getByLabel("Mã", { exact: true }).fill("NET25");
  await page.getByLabel("Tên", { exact: true }).fill("Ngày 25 sau hai tháng");
  await page.getByLabel("Cách tính hạn thanh toán").selectOption("MONTHLY");
  await page.getByLabel("Ngày thanh toán trong tháng (1–31)").fill("25");
  await page.getByLabel("Sau số tháng").fill("2");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => payload?.due_mode).toBe("MONTHLY");
  expect(payload?.due_day_of_month).toBe(25);
  expect(payload?.due_after_months).toBe(2);
});

test("supplier risk screen lists and checks a supplier", async ({ page }) => {
  let checked = false;
  await page.route("**/api/v1/purchases/supplier-risk/**", async route => {
    const url = route.request().url();
    if (url.includes("/check/") && route.request().method() === "POST") {
      checked = route.request().postDataJSON().supplier_id === supplierId;
      await route.fulfill({ json: { message: "OK", data: {} } });
    } else if (url.includes(`${supplierId}/`)) {
      await route.fulfill({ json: { latest_assessment: null, history: [] } });
    } else {
      await route.fulfill({ json: { results: [{ supplier_id: supplierId, supplier_code: "NCC01", supplier_name: "Nhà cung cấp A", tax_code: "0123456789", operating_status: "Đang hoạt động", latest_risk_level: null, latest_score: null, latest_check_date: null, is_valid: false }] } });
    }
  });
  await page.goto("/purchases/invoice-processing/supplier-risk");
  await expect(page.getByText("NCC01")).toBeVisible();
  await page.getByRole("button", { name: "Xem / kiểm tra" }).click();
  await page.getByRole("button", { name: "Kiểm tra rủi ro" }).click();
  await expect.poll(() => checked).toBe(true);
});
