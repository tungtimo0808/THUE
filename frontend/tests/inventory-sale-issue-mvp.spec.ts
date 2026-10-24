import { expect, test, type Page } from "@playwright/test";

// UC-INV-03 – Xuất kho bán hàng: picker → form → save draft → post, against a mocked API.
const company = "11111111-1111-4111-8111-111111111111";
const k1 = "22222222-2222-4222-8222-222222222222";
const k2 = "21212121-2121-4212-8212-212121212121";
const item = "33333333-3333-4333-8333-333333333333";
const item2 = "34343434-3434-4343-8343-343434343434";
const uom = "44444444-4444-4444-8444-444444444444";
const sale = "99999999-9999-4999-8999-999999999999";
const line1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const line2 = "abababab-abab-4bab-8bab-abababababab";
const cogs = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const stockAccount = "88888888-8888-4888-8888-888888888888";
const voucher = "55555555-5555-4555-8555-555555555555";

type Calls = { created: Record<string, any> | null; actions: string[]; sourceQueries: URLSearchParams[] };

async function mockApi(page: Page, calls: Calls, postFails = false) {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "inventory-sale-issue-test", companyId: company,
    companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), { company });
  const saleSource = {
    id: sale, number: "BH00015", posting_date: "2026-10-20", document_date: "2026-10-20", customer: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    customer_code: "CUS01", customer_name: "Công ty ABC", customer_address: "Hà Nội", description: "Bán hàng Công ty ABC",
    issue_status: "PARTIAL", issue_status_label: "Xuất một phần",
    lines: [
      { id: line1, line_no: 1, item, item_code: "SP01", item_name: "Sản phẩm 01", uom, uom_name: "Cái", warehouse: null,
        quantity: "5", issued_quantity: "2", remaining_quantity: "3", cogs_account: cogs, cogs_account_code: "632",
        inventory_account: stockAccount, inventory_account_code: "156" },
      { id: line2, line_no: 2, item: item2, item_code: "SP02", item_name: "Sản phẩm 02", uom, uom_name: "Cái", warehouse: null,
        quantity: "4", issued_quantity: "4", remaining_quantity: "0", cogs_account: cogs, cogs_account_code: "632",
        inventory_account: stockAccount, inventory_account_code: "156" },
    ],
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === "/api/v1/inventory/transactions/sale-sources/") {
      calls.sourceQueries.push(url.searchParams);
      const number = url.searchParams.get("search") || "";
      await route.fulfill({ json: number && !"BH00015".includes(number) ? [] : [saleSource] }); return;
    }
    if (path === "/api/v1/inventory/transactions/" && method === "POST") {
      calls.created = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...calls.created, id: voucher, status: "DRAFT" } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${voucher}/submit-and-post/`) {
      calls.actions.push("submit-and-post");
      if (postFails) {
        await route.fulfill({ status: 400, json: ["Dòng 1 (SP01 tại K2): số lượng tồn kho không đủ để xuất. Vui lòng kiểm tra lại."] }); return;
      }
      await route.fulfill({ json: { ...calls.created, id: voucher, status: "POSTED", warnings: [] } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/organization/branches/": [{ id: "66666666-6666-4666-8666-666666666666", name: "Trụ sở", is_head_office: true, status: "ACTIVE" }],
      "/api/v1/master-data/warehouses/": [
        { id: k1, code: "K1", name: "Kho 1", status: "ACTIVE", allow_issue: true },
        { id: k2, code: "K2", name: "Kho 2", status: "ACTIVE", allow_issue: true },
      ],
      "/api/v1/master-data/items/": [
        { id: item, code: "SP01", name: "Sản phẩm 01", status: "ACTIVE", track_inventory: true, base_uom: uom },
        { id: item2, code: "SP02", name: "Sản phẩm 02", status: "ACTIVE", track_inventory: true, base_uom: uom },
      ],
      "/api/v1/inventory/balances/": [
        { item, warehouse: k1, quantity: "10", available_quantity: "10", average_cost: "20" },
        { item, warehouse: k2, quantity: "1", available_quantity: "1", average_cost: "30" },
      ],
      "/api/v1/master-data/units-of-measure/": [{ id: uom, code: "CAI", name: "Cái" }],
      "/api/v1/general-ledger/accounts/": [
        { id: cogs, code: "632", name: "Giá vốn", status: "ACTIVE", is_postable: true },
        { id: stockAccount, code: "156", name: "Hàng hóa", status: "ACTIVE", is_postable: true },
      ],
      "/api/v1/master-data/parties/": [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", code: "CUS01", name: "Công ty ABC", status: "ACTIVE" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
}

async function openSaleIssue(page: Page) {
  await page.goto("/inventory/issues");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const modal = page.locator(".misa-purchase-modal-window").filter({ hasText: "Phiếu xuất kho" });
  await expect(modal.getByRole("combobox", { name: "Loại xuất kho" })).toHaveValue("1. Bán hàng");
  return modal;
}

test("UC-INV-03 picks sale lines, validates remaining quantity, saves a draft and posts", async ({ page }) => {
  const calls: Calls = { created: null, actions: [], sourceQueries: [] };
  await mockApi(page, calls);
  const modal = await openSaleIssue(page);
  await expect(modal.getByTestId("issue-status")).toHaveText("Phiếu mới");

  await modal.getByRole("button", { name: "Chọn chứng từ bán hàng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn chứng từ bán hàng" });
  // EF-02: no match keeps the dialog open with a message.
  await picker.getByLabel("Lọc số chứng từ").fill("KHONGCO");
  await picker.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect(picker.getByText("Không tìm thấy chứng từ bán hàng phù hợp")).toBeVisible();
  // AF-01: number + customer + period.
  await picker.getByLabel("Lọc số chứng từ").fill("BH000");
  await picker.getByLabel("Lọc khách hàng").fill("ABC");
  await picker.getByLabel("Từ ngày").fill("2026-10-01");
  await picker.getByLabel("Đến ngày").fill("2026-10-31");
  await picker.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect(picker.getByText("Xuất một phần")).toBeVisible();
  const query = calls.sourceQueries.at(-1)!;
  expect([query.get("search"), query.get("customer"), query.get("date_from"), query.get("date_to")]).toEqual(["BH000", "ABC", "2026-10-01", "2026-10-31"]);
  // Step 8 / EF-04: sold, issued and remaining; the fully issued line cannot be picked.
  await expect(picker.getByLabel("Chọn hàng SP02")).toBeDisabled();
  await expect(picker.getByRole("row").filter({ hasText: "SP02" })).toContainText("Đã xuất đủ");
  await picker.getByRole("button", { name: "Đồng ý" }).click();
  await expect(picker).toBeHidden();

  // Steps 9-21: customer, reference, line, stock-based warehouse and cost, accounts.
  await expect(modal.getByRole("textbox", { name: "Số chứng từ tham chiếu" })).toHaveValue("BH00015");
  await expect(modal.locator("input[value='Công ty ABC']").first()).toBeVisible();
  await expect(modal.getByRole("combobox", { name: "Kho xuất dòng 1" })).toHaveValue("Kho 1");
  await expect(modal.getByText("Còn được xuất: 3")).toBeVisible();
  await expect(modal.getByText("Tồn khả dụng: 10")).toBeVisible();

  // EF-12: more than the remaining quantity is refused before calling the API.
  await modal.getByRole("spinbutton", { name: "Số lượng xuất dòng 1" }).fill("4");
  await modal.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Dòng 1: số lượng xuất vượt số lượng còn lại của chứng từ bán hàng.")).toBeVisible();
  expect(calls.created).toBeNull();

  // AF-02 + AF-04: issue part of it from another warehouse; the cost follows that warehouse.
  await modal.getByRole("spinbutton", { name: "Số lượng xuất dòng 1" }).fill("1");
  await modal.getByRole("combobox", { name: "Kho xuất dòng 1" }).selectOption({ label: "Kho 2" });
  await expect(modal.getByText("Tồn khả dụng: 1")).toBeVisible();
  await modal.getByRole("button", { name: "Ghi sổ", exact: true }).click();
  await expect.poll(() => calls.actions).toEqual(["submit-and-post"]);
  expect(calls.created).toMatchObject({
    source_module: "INV_SALE_ISSUE", source_reference: sale, transaction_type: "ISSUE",
    supplier: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    reason: "Xuất kho hàng hóa bán cho Công ty ABC theo chứng từ BH00015",
  });
  expect(calls.created?.lines).toEqual([expect.objectContaining({
    sale_line: line1, source_warehouse: k2, quantity: "1", unit_cost: "30", debit_account: cogs, credit_account: stockAccount,
  })]);
  await expect(page.getByText(/Ghi sổ thành công phiếu xuất kho/)).toBeVisible();
  await expect(modal).toBeHidden();
});

test("UC-INV-03 keeps the voucher open and unposted when posting fails; cancel asks before discarding", async ({ page }) => {
  const calls: Calls = { created: null, actions: [], sourceQueries: [] };
  await mockApi(page, calls, true);
  const modal = await openSaleIssue(page);
  await modal.getByRole("button", { name: "Chọn chứng từ bán hàng" }).click();
  const picker = page.getByRole("dialog", { name: "Chọn chứng từ bán hàng" });
  await picker.getByRole("button", { name: "Đồng ý" }).click();
  await modal.getByRole("spinbutton", { name: "Số lượng xuất dòng 1" }).fill("2");
  await modal.getByRole("button", { name: "Ghi sổ", exact: true }).click();
  // EF-13 / EF-21: error is shown, the form stays open on the saved voucher, still not posted.
  await expect(page.getByText(/Ghi sổ không thành công: .*số lượng tồn kho không đủ để xuất/)).toBeVisible();
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("issue-status")).toHaveText("Chưa ghi sổ");
  expect(calls.created?.lines[0].quantity).toBe("2");

  // AF-10: closing with unsaved edits asks for confirmation; dismissing keeps the form.
  await modal.getByRole("textbox", { name: "Số chứng từ tham chiếu" }).fill("thay đổi");
  page.once("dialog", (dialog) => dialog.dismiss());
  await modal.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(modal).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await modal.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(modal).toBeHidden();
});
