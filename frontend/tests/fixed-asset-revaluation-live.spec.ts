import { expect, test } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

test("UC-FA-06 opens the live revaluation form and saves a TT58 life adjustment", async ({ page }) => {
  const company = { id: companyId, name: "Công ty A", accounting_regime: "TT58", bookkeeping_method: "SIMPLE" };
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "revaluation-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });
  let saved: Record<string, any> | null = null;
  let posted = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/revaluations/candidates/") return route.fulfill({ json: [{
      id: assetId, code: "MAY01", name: "Máy CNC", department_name: "Phòng kỹ thuật", original_cost: "300000000",
      remaining_periods: "48", accumulated_depreciation: "60000000", depreciable_value: "300000000",
      monthly_depreciation: "5000000", tax_monthly_depreciation: null, asset_account_code: "",
      accumulated_account_code: "", expense_account_code: "", blocked: "",
    }] });
    if (path === "/api/v1/fixed-assets/revaluations/" && route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: "33333333-3333-4333-8333-333333333333", number: saved!.number, status: "DRAFT", attachments: [] } });
    }
    if (path.endsWith("/post/") && route.request().method() === "POST") {
      posted = true;
      return route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", number: "ĐGL00001", status: "POSTED", attachments: [] } });
    }
    if (path === "/api/v1/fixed-assets/assets/") return list([{ id: assetId, company: companyId, code: "MAY01", name: "Máy CNC", asset_type: "FIXED_ASSET", status: "ACTIVE" }]);
    return list([]);
  });

  await page.goto("/assets/revaluation");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Mã tài sản dòng 1" })).toBeVisible();
  await page.getByRole("combobox", { name: "Mã tài sản dòng 1" }).selectOption("MAY01");
  await page.getByRole("spinbutton", { name: "Thời gian còn lại sau điều chỉnh dòng 1" }).fill("60");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({
    lines: [{ asset: assetId, before_remaining_periods: 48, after_remaining_periods: 60, tax_monthly_depreciation_after: null }],
    entries: [],
  });
  await expect.poll(() => posted).toBe(true);
});
