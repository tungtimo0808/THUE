import { expect, test, type Page } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

function preview(usesGl: boolean) {
  return {
    voucher_no: "KH00001", suggested_voucher_no: "KH00001", voucher_date: "31/03/2026", posting_date: "31/03/2026",
    accounting_regime: usesGl ? "TT99" : "TT58", account_regime: usesGl ? "TT99" : null,
    bookkeeping_method: usesGl ? "DOUBLE_ENTRY" : "SIMPLE", uses_general_ledger: usesGl,
    period_month: 3, period_year: 2026, period_code: "2026-03", description: "Khấu hao TSCĐ tháng 3 năm 2026",
    total_amount: "1000000", total_deductible_amount: "1000000", total_non_deductible_amount: "0",
    lines: [{
      asset_id: assetId, asset_code: "TS001", asset_name: "Máy tính văn phòng", category_name: "Máy móc", department_name: "Kế toán",
      original_cost: "12000000", depreciable_amount: "12000000", opening_accumulated_depreciation: "0", closing_accumulated_depreciation: "1000000",
      opening_value: "12000000", amount: "1000000", closing_value: "11000000", deductible_amount: "1000000", non_deductible_amount: "0",
      eligible_days: 31, total_days_in_period: 31, annual_depreciation_rate: "100.00", monthly_depreciation_amount: "1000000", asset_version: 1,
    }],
    allocations: [{
      asset_id: assetId, asset_code: "TS001", asset_name: "Máy tính văn phòng", department_name: "Kế toán", rate: "100.00",
      allocated_amount: "1000000", expense_account_code: usesGl ? "642" : "", credit_account_code: usesGl ? "214" : "", expense_item: "CPQL", cost_item: "CPQL",
    }],
    accounting_entries: usesGl ? [{
      asset_id: assetId, asset_code: "TS001", description: "Trích khấu hao TSCĐ TS001 tháng 03/2026 (Kế toán)",
      debit_account_code: "642", credit_account_code: "214", amount: "1000000", department_name: "Kế toán", cost_item: "CPQL",
    }] : [],
  };
}

async function openDepreciation(page: Page, usesGl: boolean) {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-depr-test", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" },
  })), { company });
  const calls = { preview: [] as any[], save: [] as any[] };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path === "/api/v1/fixed-assets/calculations/default-period/") return route.fulfill({ json: { month: 3, year: 2026 } });
    if (path === "/api/v1/fixed-assets/calculations/preview/") {
      calls.preview.push(route.request().postDataJSON());
      return route.fulfill({ json: preview(usesGl) });
    }
    if (path === "/api/v1/fixed-assets/calculations/save-voucher/") {
      calls.save.push(route.request().postDataJSON());
      const run = { id: "33333333-3333-4333-8333-333333333333", number: "KH00001", status: "CALCULATED", period_code: "2026-03", period_month: 3, period_year: 2026, total_amount: "1000000", lines: [] };
      return route.fulfill({ status: 201, json: { ...run, run, posted: false, message: "Lưu chứng từ tính khấu hao thành công." } });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto("/assets/depreciation");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  return calls;
}

test("UC-FA-03 chọn kỳ mặc định theo kỳ làm việc, hiển thị kết quả backend và lưu Chưa ghi sổ", async ({ page }) => {
  const calls = await openDepreciation(page, true);
  await expect(page.getByText("Chọn kỳ tính khấu hao")).toBeVisible();
  await expect(page.getByTestId("depr-period-month")).toHaveValue("3");
  await expect(page.getByTestId("depr-period-year")).toHaveValue("2026");
  await page.getByTestId("depr-period-confirm").click();

  await expect.poll(() => calls.preview.length).toBe(1);
  expect(calls.preview[0]).toMatchObject({ month: 3, year: 2026 });
  expect(calls.preview[0]).not.toHaveProperty("prorate_by_days");
  await expect(page.locator('input[value="KH00001"]')).toBeVisible();
  await expect(page.getByText("TS001").first()).toBeVisible();
  await expect(page.getByText("Tính khấu hao (1)")).toBeVisible();
  await expect(page.getByText("Hạch toán (1)")).toBeVisible();

  await page.getByTestId("depr-save").click();
  await expect.poll(() => calls.save.length).toBe(1);
  expect(calls.save[0]).toMatchObject({ month: 3, year: 2026, voucher_no: "KH00001", post_now: false, posting_date: "2026-03-31" });
  expect(String(calls.save[0].idempotency_key)).toMatch(/^FA-DEPR-/);
  await expect(page.getByText("Lưu chứng từ tính khấu hao thành công.")).toBeVisible();
});

test("UC-FA-03 AF17 TT58 sổ đơn: không có bút toán Nợ/Có vẫn lưu được", async ({ page }) => {
  const calls = await openDepreciation(page, false);
  await page.getByTestId("depr-period-confirm").click();
  await expect(page.getByText("Hạch toán (0)")).toBeVisible();
  await page.getByText("Hạch toán (0)").click();
  await expect(page.getByTestId("depr-no-gl-note")).toBeVisible();
  await page.getByTestId("depr-save").click();
  await expect.poll(() => calls.save.length).toBe(1);
  await expect(page.getByText("Lưu chứng từ tính khấu hao thành công.")).toBeVisible();
});

function savedRun(usesGl: boolean, status = "CALCULATED") {
  const p = preview(usesGl);
  return {
    id: "44444444-4444-4444-8444-444444444444", number: "KH00001", status, period_code: "2026-03", period_month: 3, period_year: 2026,
    period_start: "2026-03-01", period_end: "2026-03-31", voucher_date: "2026-03-31", posting_date: "2026-03-31",
    description: p.description, reference: "", total_amount: "1000000", total_deductible_amount: "1000000", total_non_deductible_amount: "0",
    lines: p.lines.map((l) => ({ ...l, asset: l.asset_id })), allocations_snapshot: p.allocations, accounting_entries: p.accounting_entries, attachments: [],
  };
}

async function openSavedVoucher(page: Page, usesGl: boolean) {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-post-test", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" },
  })), { company });
  const posts: any[] = [];
  let run = savedRun(usesGl);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path === `/api/v1/fixed-assets/calculations/${run.id}/post/`) {
      posts.push(route.request().postDataJSON());
      run = { ...run, status: "POSTED" };
      return route.fulfill({ json: { ...run, posted: true, message: "Ghi sổ chứng từ khấu hao thành công." } });
    }
    if (path === "/api/v1/fixed-assets/calculations/") return route.fulfill({ json: { results: [run] } });
    return route.fulfill({ json: { results: [] } });
  });
  await page.goto("/assets/depreciation");
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  await page.getByRole("cell", { name: "KH00001", exact: true }).click();
  return posts;
}

test("UC-FA-04 ghi sổ chứng từ Chưa ghi sổ từ danh sách theo dữ liệu đã lưu", async ({ page }) => {
  const posts = await openSavedVoucher(page, true);
  await expect(page.getByText("Hạch toán (1)")).toBeVisible();
  await page.getByTestId("depr-post").click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ voucher_no: "KH00001", posting_date: "31/03/2026" });
  for (const key of ["lines", "custom_lines", "allocations", "accounting_entries"]) expect(posts[0]).not.toHaveProperty(key);
  await expect(page.getByText("Ghi sổ chứng từ khấu hao thành công.")).toBeVisible();
});

test("UC-FA-04 AF17 TT58 sổ đơn ghi sổ không cần định khoản Nợ/Có", async ({ page }) => {
  const posts = await openSavedVoucher(page, false);
  await page.getByText("Hạch toán (0)").click();
  await expect(page.getByTestId("depr-no-gl-note")).toBeVisible();
  await page.getByTestId("depr-post").click();
  await expect.poll(() => posts.length).toBe(1);
  await expect(page.getByText("Ghi sổ chứng từ khấu hao thành công.")).toBeVisible();
});
