import { expect, test } from "@playwright/test";

test("bank deposit ledger loads posted rows and applies report controls", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "deposit-ledger-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  let summaries = 0;
  let exports = 0;
  let lastSummary = "";
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/deposit-ledger/options/") {
      await route.fulfill({ json: { accounts: [{ code: "1121", name: "Tiền gửi VND" }, { code: "112", name: "Tiền gửi" }],
        bank_accounts: [{ id: "b1", number: "19000001", bank_name: "BIDV", gl_account_code: "1121", currency: "VND" }] } }); return;
    }
    if (path === "/api/v1/bank/deposit-ledger/summary/") {
      summaries++;
      lastSummary = route.request().url();
      await route.fulfill({ json: { warnings: [], groups: [{ id: "p1", bank_account_id: "b1", bank_account_no: "19000001", bank_name: "BIDV", currency: "VND", opening_balance: "100", receipt_total: "20", payment_total: "70", closing_balance: "50", rows: [
        { journal_entry_id: "e1", journal_line_ids: ["l1"], source_entity_type: "", source_entity_id: "", posting_date: "2026-10-06", document_date: "2026-10-06", voucher_number: "PAY-01", description: "Thanh toán", counter_account: "331", receipt: "0", payment: "70", balance: "30" },
        { journal_entry_id: "e2", journal_line_ids: ["l2"], source_entity_type: "", source_entity_id: "", posting_date: "2026-10-06", document_date: "2026-10-06", voucher_number: "REC-01", description: "Thu tiền", counter_account: "131", receipt: "20", payment: "0", balance: "50" },
      ] }] } }); return;
    }
    if (path === "/api/v1/bank/deposit-ledger/export/") { exports++; await route.fulfill({ body: Buffer.from("PKmock") }); return; }
    if (path === "/api/v1/bank/deposit-ledger/save/") { await route.fulfill({ status: 201, json: { id: "one", name: "Sổ tháng" } }); return; }
    if (path === "/api/v1/bank/deposit-ledger/presets/") { await route.fulfill({ json: [{ id: "one", name: "Sổ tháng", parameters: { account_code: "1121", date_from: "2026-10-01", date_to: "2026-10-31" } }] }); return; }
    if (path.startsWith("/api/v1/bank/deposit-ledger/voucher/")) { await route.fulfill({ json: { number: "PAY-01", posting_date: "2026-10-06", document_date: "2026-10-06", description: "Thanh toán", lines: [{ line_no: 1, account_code: "1121", description: "Thanh toán", debit: "0", credit: "70" }, { line_no: 2, account_code: "331", description: "Thanh toán", debit: "70", credit: "0" }] } }); return; }
    if (path === "/api/v1/common/companies/mine/") { await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return; }
    await route.fulfill({ json: { results: [] } });
  });
  await page.goto(`/bank/reports?company=${company}&report=${encodeURIComponent("Sổ tiền gửi ngân hàng")}`);
  await expect(page.getByText("Tài khoản ngân hàng: 19000001 - BIDV (VND)").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "PAY-01" }).first()).toBeVisible();
  await page.getByRole("button", { name: "PAY-01" }).first().click();
  await expect(page.getByText("Chi tiết chứng từ PAY-01")).toBeVisible();
  await expect(page.getByText("331", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByLabel("Nhập từ khóa tìm kiếm").fill("REC");
  await expect(page.getByText("Tổng các dòng tìm kiếm").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "PAY-01" })).toHaveCount(0);
  await page.getByTitle("Xuất khẩu Excel").click();
  await expect.poll(() => exports).toBe(1);
  await page.getByRole("button", { name: "Lưu báo cáo" }).click();
  await page.getByRole("button", { name: "Danh sách báo cáo đã lưu" }).click();
  await expect(page.getByRole("button", { name: "Sổ tháng" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByTitle("Nạp lại").click();
  await expect.poll(() => summaries).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Chọn tham số" }).click();
  await page.getByLabel("Từ ngày").fill("31/02/2026");
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect(page.getByRole("alert")).toContainText("ngày hợp lệ");
  await page.getByLabel("Từ ngày").fill("01/10/2026");
  await page.getByLabel("Tài khoản ngân hàng").selectOption("b1");
  await page.getByText("Sắp xếp chứng từ thu trước chứng từ chi trong cùng một ngày").click();
  await page.getByRole("button", { name: "Xem báo cáo" }).click();
  await expect.poll(() => new URL(lastSummary).searchParams.get("bank_account_id")).toBe("b1");
  expect(new URL(lastSummary).searchParams.get("receipt_first")).toBe("true");
});
