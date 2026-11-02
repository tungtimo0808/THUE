import { expect, test } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const category = "22222222-2222-4222-8222-222222222222";
const department = "33333333-3333-4333-8333-333333333333";
const branch = "44444444-4444-4444-8444-444444444444";

test("UC-FA-01 ghi tăng từ màn hình, yêu cầu căn cứ không khấu hao và gửi API", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-test", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" },
  })), { company });
  let payload: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/fixed-assets/assets/acquire/" && route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { asset: { id: "asset-1", ...payload }, transaction: { id: "tx-1" }, message: "Ghi tăng tài sản cố định thành công." } });
    }
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    const rows: Record<string, any[]> = {
      "/api/v1/fixed-assets/categories/": [{ id: category, code: "TSCD", name: "Máy móc, thiết bị", asset_type: "FIXED_ASSET", asset_account_code: "211", accumulated_account_code: "214" }],
      "/api/v1/organization/departments/": [{ id: department, code: "KT", name: "Kế toán", status: "ACTIVE" }],
      "/api/v1/organization/branches/": [{ id: branch, code: "HN", name: "Hà Nội", status: "ACTIVE", is_head_office: true }],
      "/api/v1/general-ledger/accounts/": [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", code: "211", name: "TSCĐ", status: "ACTIVE", is_postable: true }],
      "/api/v1/fixed-assets/assets/": [],
      "/api/v1/fixed-assets/transactions/": [],
    };
    return route.fulfill({ json: { results: rows[path] || [] } });
  });

  await page.goto("/assets/increase");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await expect(page.getByText(/Ghi tăng tài sản cố định GTTS/)).toBeVisible();
  await page.getByPlaceholder("Nhập mã định danh tài sản...").fill("TSCD-TEST");
  await page.locator("label", { hasText: "Loại tài sản" }).locator("..").locator("select").selectOption({ label: "Máy móc, thiết bị" });
  await page.locator("label", { hasText: "Đơn vị sử dụng" }).locator("..").locator("select").first().selectOption({ label: "Kế toán" });
  await page.locator("label", { hasText: "Tên tài sản" }).locator("..").locator("input").fill("Máy kiểm thử");
  await page.getByRole("checkbox", { name: "Không tính khấu hao" }).check();
  await page.locator("label", { hasText: "Nguyên giá" }).locator("..").locator("input").first().fill("30000000");
  await page.getByRole("button", { name: "Ghi tăng", exact: true }).last().click();
  await expect(page.getByPlaceholder("Nhập căn cứ áp dụng cho tài sản")).toBeVisible();
  expect(payload).toBeNull();
  await page.getByPlaceholder("Nhập căn cứ áp dụng cho tài sản").fill("Tài sản không thuộc diện trích khấu hao");
  await page.locator("label", { hasText: "TK nguyên giá" }).locator("..").locator("select").selectOption("211");
  await page.getByRole("button", { name: "Ghi tăng và Thêm", exact: true }).click();
  await expect.poll(() => payload).not.toBeNull();
  expect(payload).toMatchObject({ code: "TSCD-TEST", no_depreciation: true, no_depreciation_reason: "Tài sản không thuộc diện trích khấu hao", asset_account: "211" });
  await expect(page.getByPlaceholder("Nhập mã định danh tài sản...")).toHaveValue("");
  await expect(page.getByText(/Ghi tăng tài sản cố định GTTS/)).toBeVisible();
});

test("UC-FA-01 TT58 sổ đơn ghi tăng từ màn hình không cần tài khoản GL", async ({ page }) => {
  const simpleCompany = { id: company, name: "Công ty TT58", accounting_regime: "TT58", bookkeeping_method: "SIMPLE" };
  await page.addInitScript(({ company, simpleCompany }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-tt58-test", companyId: company, companies: [simpleCompany], user: { id: "tester" },
  })), { company, simpleCompany });
  let payload: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/fixed-assets/assets/acquire/" && route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { asset: { id: "asset-simple", ...payload }, transaction: { gl_status: "NOT_REQUIRED" } } });
    }
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [simpleCompany] });
    const rows: Record<string, any[]> = {
      "/api/v1/fixed-assets/categories/": [{ id: category, code: "TSCD", name: "Máy móc, thiết bị", asset_type: "FIXED_ASSET" }],
      "/api/v1/organization/departments/": [{ id: department, code: "KT", name: "Kế toán", status: "ACTIVE" }],
      "/api/v1/organization/branches/": [{ id: branch, code: "HN", name: "Hà Nội", status: "ACTIVE", is_head_office: true }],
    };
    return route.fulfill({ json: { results: rows[path] || [] } });
  });
  await page.goto("/assets/increase");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  await page.getByPlaceholder("Nhập mã định danh tài sản...").fill("TSCD-TT58");
  await page.locator("label", { hasText: "Loại tài sản" }).locator("..").locator("select").selectOption({ label: "Máy móc, thiết bị" });
  await page.locator("label", { hasText: "Đơn vị sử dụng" }).locator("..").locator("select").first().selectOption({ label: "Kế toán" });
  await page.locator("label", { hasText: "Tên tài sản" }).locator("..").locator("input").fill("Máy sổ đơn");
  await page.getByRole("checkbox", { name: "Không tính khấu hao" }).check();
  await page.getByPlaceholder("Nhập căn cứ áp dụng cho tài sản").fill("Quyền sử dụng lâu dài");
  await page.locator("label", { hasText: "Nguyên giá" }).locator("..").locator("input").first().fill("30000000");
  await expect(page.locator("label", { hasText: "TK nguyên giá" }).locator("..").locator("select")).toBeDisabled();
  await page.getByRole("button", { name: "Ghi tăng", exact: true }).last().click();
  await expect.poll(() => payload).not.toBeNull();
  expect(payload).toMatchObject({ code: "TSCD-TT58", asset_account: "", accumulated_account: "" });
});
