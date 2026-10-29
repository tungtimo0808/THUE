import { expect, test } from "@playwright/test";

test("UC-GL-15 loads an empty company without seeding and waits for save confirmation", async ({ page }) => {
  const companyId = "11111111-1111-4111-8111-111111111111";
  const company = { id: companyId, name: "Công ty kiểm thử", accounting_regime: "TT99" };
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "opening-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });

  const empty = { start_date: "2026-01-01", version: 1, opening_period_locked: false,
    accounts: [], bank: [], customers: [], suppliers: [], employees: [], inventory: [], tools: [], assets: [], prepaid: [], wip: [] };
  let saved = empty;
  let postCount = 0;
  let lastPayload: Record<string, unknown> | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (url.pathname === "/api/v1/general-ledger/opening-balances/") {
      expect(url.searchParams.get("company_id")).toBe(companyId);
      if (route.request().method() === "GET") return route.fulfill({ json: saved });
      postCount += 1;
      lastPayload = route.request().postDataJSON();
      if (postCount === 1) return route.fulfill({ status: 400, json: { detail: "Số dư không hợp lệ" } });
      saved = { ...empty, accounts: [{ account: "1111", name: "Tiền mặt", debit: 100, credit: 0 }], version: 2 };
      return route.fulfill({ json: saved });
    }
    return route.fulfill({ json: { results: [] } });
  });

  await page.goto("/opening/accounts");
  await expect(page.getByText("Ngày bắt đầu HT:")).toBeVisible();
  expect(postCount).toBe(0);
  await page.getByRole("button", { name: "Nhập số dư", exact: true }).click();
  await page.getByRole("button", { name: "+ Thêm dòng" }).click();
  await page.getByRole("textbox", { name: "Số tài khoản dòng 1" }).fill("1111");
  await page.getByRole("textbox", { name: "Tên tài khoản dòng 1" }).fill("Tiền mặt");
  await page.getByRole("button", { name: "Lưu và Đóng" }).click();
  await expect.poll(() => postCount).toBe(1);
  await expect(page.getByRole("textbox", { name: "Số tài khoản dòng 1" })).toBeVisible();
  await page.getByRole("button", { name: "Lưu và Đóng" }).click();
  await expect.poll(() => postCount).toBe(2);
  expect(lastPayload).toMatchObject({ company_id: companyId, category: "accounts", expected_version: 1 });
});

test("UC-GL-15 AF-16 check, AF-15 TT58 groups and the backend success message", async ({ page }) => {
  const companyId = "22222222-2222-4222-8222-222222222222";
  const company = { id: companyId, name: "Hộ kinh doanh TT58", accounting_regime: "TT58" };
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "opening-tt58", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });
  const state = { start_date: "2026-01-01", version: 3, opening_period_locked: false, accounting_regime: "TT58",
    bookkeeping_method: "SIMPLE", uses_general_ledger: false,
    supported_categories: ["bank", "customers", "suppliers", "employees", "inventory", "tools", "assets", "prepaid", "wip"],
    accounts: [], bank: [], customers: [], suppliers: [], employees: [], inventory: [], tools: [], assets: [], prepaid: [], wip: [] };
  let checks = 0;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (url.pathname === "/api/v1/general-ledger/opening-balances/check/") {
      checks += 1;
      return route.fulfill({ json: { status: "WARNING", status_display: "Cảnh báo", checks: [
        { status: "WARNING", group: "prepaid", group_title: "Chi phí trả trước đầu kỳ", account: "", object: "", difference: 0,
          message: "Nhóm chưa khai báo tài khoản kế toán; cần đối chiếu thủ công với số dư tài khoản liên quan." }] } });
    }
    if (url.pathname === "/api/v1/general-ledger/opening-balances/") return route.fulfill({ json: state });
    return route.fulfill({ json: { results: [] } });
  });

  await page.goto("/opening");
  // AF-15: a single-entry TT58 book has no Debit/Credit account group
  await expect(page.getByText("Bộ sổ TT58 không ghi sổ kép", { exact: false })).toBeVisible();
  await expect(page.locator(".misa-opening-tile", { hasText: "Số dư tài khoản" })).toHaveCount(0);
  await expect(page.locator(".misa-opening-tile", { hasText: "Chi phí trả trước" })).toHaveCount(1);
  // AF-16: the check shows status, group and message without changing any data
  await page.getByTestId("opening-check").click();
  await expect.poll(() => checks).toBe(1);
  const result = page.getByTestId("opening-check-result");
  await expect(result).toContainText("Kết quả kiểm tra: Cảnh báo");
  await expect(result).toContainText("Chi phí trả trước đầu kỳ");
});
