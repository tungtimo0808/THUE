import { expect, test } from "@playwright/test";

test("bank statement matches two vouchers and can unmatch one", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const account = "33333333-3333-4333-8333-333333333333";
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "bank-match-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  const vouchers = [
    { id: "voucher-1", number: "BC-001", transaction_date: "2026-10-20", transaction_type: "RECEIPT", counterparty_name: "Khách A", description: "Thu đơn hàng", bank_reference: "REF-001", amount: "100", remaining_amount: "100", score: 100 },
    { id: "voucher-2", number: "BC-002", transaction_date: "2026-10-19", transaction_type: "RECEIPT", counterparty_name: "Khách A", description: "Thu phần còn lại", bank_reference: "REF-002", amount: "100", remaining_amount: "100", score: 50 },
  ];
  let links: Array<{ link_id: string; id: string; number: string; amount: string; gl_status: string; status: string }> = [];
  let submitted: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/bank/reconciliations/candidates/") {
      await route.fulfill({ json: { statement_line: "line-1", remaining_amount: "150", candidates: vouchers } }); return;
    }
    if (path === "/api/v1/bank/reconciliations/match-batch/" && route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      links = submitted.allocations.map((entry: any, index: number) => ({ link_id: `link-${index + 1}`, id: entry.transaction,
        number: vouchers.find((voucher) => voucher.id === entry.transaction)!.number, amount: entry.matched_amount,
        gl_status: "POSTED", status: "POSTED" }));
      await route.fulfill({ json: { status: "MATCHED", matched_amount: "150", remaining_amount: "0", links } }); return;
    }
    if (path.endsWith("/unmatch/") && route.request().method() === "POST") {
      const id = path.split("/")[5]; links = links.filter((link) => link.link_id !== id);
      await route.fulfill({ json: { id, status: "PARTIALLY_MATCHED", matched_amount: "100", remaining_amount: "50" } }); return;
    }
    const matched = links.reduce((sum, link) => sum + Number(link.amount), 0);
    const line = { id: "line-1", statement: "statement-1", account, account_number: "123456789", external_id: "LINE-001", reference: "REF-001", transaction_date: "2026-10-20", value_date: "2026-10-20", direction: "CREDIT", amount: "150", currency_code: "VND", description: "Khách A chuyển tiền", counterparty: "Khách A", source: "FILE", file_name: "sao-ke.xlsx", period_from: "2026-10-01", period_to: "2026-10-31", match_status: matched === 150 ? "MATCHED" : matched > 0 ? "PARTIALLY_MATCHED" : "UNMATCHED", tracking_status: "NORMAL", processing_note: "", review_reason: "", matched_amount: String(matched), remaining_amount: String(150 - matched), linked_vouchers: links, raw_data: {}, updated_at: null };
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/bank/accounts/": [{ id: account, account_number: "123456789", bank_name: "Techcombank", currency_code: "VND" }],
      "/api/v1/bank/statements/": [], "/api/v1/bank/statement-lines/": [line],
      "/api/v1/bank/transactions/": [], "/api/v1/bank/reconciliations/": [],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/bank/reconciliation");
  await page.getByRole("button", { name: "Đối chiếu offline" }).click();
  await page.getByLabel("TK ngân hàng").selectOption(account);
  const section = page.getByRole("region", { name: "Quản lý giao dịch sao kê" });
  await section.getByRole("button", { name: "Chi tiết" }).click();
  await page.getByRole("dialog", { name: "Chi tiết giao dịch sao kê" }).getByRole("button", { name: "Ghép chứng từ" }).click();
  const dialog = page.getByRole("dialog", { name: "Ghép chứng từ" });
  await expect(dialog.getByText("BC-001")).toBeVisible();
  await dialog.getByLabel("Chọn chứng từ BC-001").check();
  await dialog.getByLabel("Chọn chứng từ BC-002").check();
  await expect(dialog.getByLabel("Số tiền ghép BC-001")).toHaveValue("100");
  await expect(dialog.getByLabel("Số tiền ghép BC-002")).toHaveValue("50");
  await dialog.getByRole("button", { name: "Xác nhận ghép" }).click();
  await expect.poll(() => submitted?.allocations?.length).toBe(2);
  await expect(section.getByRole("cell", { name: "Đã ghép" })).toBeVisible();
  await section.getByRole("button", { name: "Chi tiết" }).click();
  const detail = page.getByRole("dialog", { name: "Chi tiết giao dịch sao kê" });
  await expect(detail.getByText(/BC-002/)).toBeVisible();
  page.once("dialog", (confirmation) => confirmation.accept());
  await detail.getByRole("button", { name: "Hủy ghép" }).first().click();
  await expect.poll(() => links.length).toBe(1);
  await expect(section.getByRole("cell", { name: "Ghép một phần" })).toBeVisible();
});
