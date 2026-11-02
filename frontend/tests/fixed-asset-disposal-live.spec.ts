import { expect, test } from "@playwright/test";

const companyId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const referenceId = "33333333-3333-4333-8333-333333333333";

test("UC-FA-07 saves a TT58 disposal from the live screen with a selected reference", async ({ page }) => {
  const company = { id: companyId, name: "Công ty A", accounting_regime: "TT58", bookkeeping_method: "SIMPLE" };
  await page.addInitScript(({ companyId, company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "disposal-test", companyId, companies: [company], user: { id: "tester" },
  })), { companyId, company });
  let submitted: Record<string, any> | null = null;
  let uploads = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [company] });
    if (path === "/api/v1/fixed-assets/transactions/next-disposal-number/") return route.fulfill({ json: { voucher_no: "GGTS00007" } });
    if (path === "/api/v1/fixed-assets/transactions/disposal-references/") return route.fulfill({ json: [{
      id: referenceId, number: "BB-TL-58", posting_date: "2026-12-01", document_date: "2026-12-01",
      description: "Biên bản thanh lý", entry_type: "MANUAL",
    }] });
    if (path === "/api/v1/fixed-assets/transactions/dispose/" && route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: {
        voucher_no: "GGTS00007", status: "POSTED", reason: "Nhượng bán, thanh lý", posting_date: "2026-12-31",
        reference: "BB-TL-58", total_original_cost: "120000000", rows: [], accounting_entries: [], attachments: [],
        message: "Ghi giảm tài sản cố định thành công.",
      } });
    }
    if (path === "/api/v1/fixed-assets/transactions/disposal-attachments/" && route.request().method() === "POST") {
      uploads += 1;
      return route.fulfill({ status: 201, json: { voucher_no: "GGTS00007", status: "POSTED", attachments: [{ name: "quyet-dinh.pdf" }] } });
    }
    if (path === "/api/v1/fixed-assets/assets/") return list([{
      id: assetId, company: companyId, code: "TS001", name: "Máy CNC", asset_type: "FIXED_ASSET", status: "ACTIVE",
      original_cost: "120000000", accumulated_depreciation: "20000000", remaining_value: "100000000",
      depreciable_amount: "120000000", department_name: "Phòng kỹ thuật", version: 3,
    }]);
    return list([]);
  });

  await page.goto("/assets/decrease");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await page.getByRole("button", { name: "Tham chiếu (...)" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn chứng từ tham chiếu" });
  await expect(picker.getByText("BB-TL-58")).toBeVisible();
  await picker.getByRole("checkbox", { name: "Chọn chứng từ BB-TL-58" }).check();
  await picker.getByRole("button", { name: "Đồng ý" }).click();
  await page.locator('select:has(option[value="TS001"])').selectOption("TS001");
  await page.locator('input[type="file"]').last().setInputFiles({ name: "quyet-dinh.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({
    voucher_no: "GGTS00007", reference_journal_ids: [referenceId], reference: "BB-TL-58",
    require_supporting_docs: true, rows: [{ asset_id: assetId, asset_code: "TS001", original_cost: "120000000",
      accumulated_depreciation: "20000000", remaining_value: "100000000", asset_account: "", accumulated_account: "", disposal_account: "" }],
  });
  expect(submitted!.accounting_entries).toBeUndefined();
  expect(String(submitted!.idempotency_key)).toBeTruthy();
  await expect.poll(() => uploads).toBe(1);
});
