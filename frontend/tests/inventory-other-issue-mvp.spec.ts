import { expect, test, type Page } from "@playwright/test";

// UC-INV-04 – Xuất kho khác: form type 3, object lookup / quick add, reference, multi-warehouse lines,
// attachments, "Cất" (save + post) and "Cất và In" against a mocked API.
const company = "11111111-1111-4111-8111-111111111111";
const k1 = "22222222-2222-4222-8222-222222222222";
const k2 = "21212121-2121-4212-8212-212121212121";
const item = "33333333-3333-4333-8333-333333333333";
const uom = "44444444-4444-4444-8444-444444444444";
const expense = "77777777-7777-4777-8777-777777777777";
const goods = "88888888-8888-4888-8888-888888888888";
const party = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const voucher = "55555555-5555-4555-8555-555555555555";

type Calls = {
  created: Record<string, any> | null; uploads: string[]; actions: string[];
  parties: Record<string, any>[]; addresses: Record<string, any>[];
};

async function mockApi(page: Page, calls: Calls, options: { postError?: string } = {}) {
  await page.addInitScript(({ company }) => {
    localStorage.setItem("erp_api_session", JSON.stringify({
      token: "inventory-other-issue-test", companyId: company,
      companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
    }));
    // The print frame calls print(); record it instead of opening the dialog.
    window.print = () => { (window.top as any).__printed = ((window.top as any).__printed || 0) + 1; };
  }, { company });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const posted = () => ({
      ...calls.created, id: voucher, status: "POSTED", warnings: [], document_date: calls.created?.document_date,
      document_metadata: { ...calls.created?.document_metadata, attachments: calls.uploads.map((name, index) => ({ id: `a${index}`, name, size: 10 })) },
      lines: calls.created?.lines.map((line: any) => ({ ...line, unit_cost: "20", line_value: String(Number(line.quantity) * 20), conversion_factor: "1" })),
    });
    if (path === "/api/v1/inventory/transactions/" && method === "POST") {
      calls.created = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...calls.created, id: voucher, status: "DRAFT" } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${voucher}/attachments/`) {
      const body = route.request().postDataBuffer()?.toString("latin1") || "";
      calls.uploads.push(/filename="([^"]+)"/.exec(body)?.[1] || "?");
      expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
      await route.fulfill({ status: 201, json: { ...calls.created, id: voucher, status: "DRAFT",
        document_metadata: { attachments: calls.uploads.map((name, index) => ({ id: `a${index}`, name, size: 10 })) } } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${voucher}/submit-and-post/`) {
      calls.actions.push("submit-and-post");
      if (options.postError) { await route.fulfill({ status: 400, json: [options.postError] }); return; }
      await route.fulfill({ json: posted() }); return;
    }
    if (path === "/api/v1/master-data/parties/" && method === "POST") {
      const body = route.request().postDataJSON();
      calls.parties.push(body);
      await route.fulfill({ status: 201, json: { ...body, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } }); return;
    }
    if (path === "/api/v1/master-data/party-addresses/" && method === "POST") {
      calls.addresses.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/organization/branches/": [{ id: "66666666-6666-4666-8666-666666666666", name: "Trụ sở", is_head_office: true, status: "ACTIVE" }],
      "/api/v1/master-data/warehouses/": [
        { id: k1, code: "K1", name: "Kho 1", status: "ACTIVE", allow_issue: true },
        { id: k2, code: "K2", name: "Kho 2", status: "ACTIVE", allow_issue: true },
      ],
      "/api/v1/master-data/items/": [{ id: item, code: "VT01", name: "Vật tư 01", status: "ACTIVE", track_inventory: true, base_uom: uom, valuation_method: "MOVING_AVERAGE" }],
      "/api/v1/inventory/balances/": [
        { item, warehouse: k1, quantity: "5", available_quantity: "5", average_cost: "20" },
        { item, warehouse: k2, quantity: "4", available_quantity: "4", average_cost: "30" },
      ],
      "/api/v1/inventory/transactions/": [{ id: "ffffffff-ffff-4fff-8fff-ffffffffffff", number: "NK00009", transaction_type: "RECEIPT",
        transaction_date: "2026-10-01", reason: "Nhập vật tư", status: "POSTED", lines: [] }],
      "/api/v1/master-data/units-of-measure/": [{ id: uom, code: "CAI", name: "Cái" }],
      "/api/v1/general-ledger/accounts/": [
        { id: expense, code: "642", name: "Chi phí quản lý", status: "ACTIVE", is_postable: true },
        { id: goods, code: "156", name: "Hàng hóa", status: "ACTIVE", is_postable: true },
      ],
      "/api/v1/master-data/parties/": [{ id: party, code: "PB01", name: "Phòng hành chính", status: "ACTIVE" },
        ...calls.parties.map((row) => ({ ...row, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }))],
      "/api/v1/master-data/party-addresses/": [{ id: "a1", party, address_line: "Tầng 3, Hà Nội", is_default: true, status: "ACTIVE" }],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
}

// Each case walks a whole use-case flow, which takes longer than the default 30 s.
test.describe.configure({ timeout: 90_000 });

async function openOtherIssue(page: Page) {
  await page.goto("/inventory/issues");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const modal = page.locator(".misa-purchase-modal-window").filter({ hasText: "Phiếu xuất kho" });
  await modal.getByRole("combobox", { name: "Loại xuất kho" }).selectOption("3. Khác (Xuất sử dụng, góp vốn, ...)");
  return modal;
}

async function fillLine(modal: ReturnType<Page["locator"]>, index: number, warehouse: string, quantity: string) {
  const row = modal.locator("tbody tr").nth(index);
  await row.locator("input").first().fill("VT01");
  await modal.getByRole("combobox", { name: `Kho xuất dòng ${index + 1}` }).selectOption({ label: warehouse });
  await row.locator("input").nth(2).fill("642");
  await row.locator("input").nth(3).fill("156");
  await modal.getByRole("spinbutton", { name: `Số lượng xuất dòng ${index + 1}` }).fill(quantity);
}

test("UC-INV-04 fills the other-issue voucher, attaches a file, saves + posts and prints", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], actions: [], parties: [], addresses: [] };
  await mockApi(page, calls);
  const modal = await openOtherIssue(page);
  // Step 3: defaults of type 3.
  await expect(modal.getByRole("textbox", { name: "Lý do xuất" })).toHaveValue("Xuất kho khác");
  const firstRow = modal.locator("tbody tr").first();
  await expect(firstRow.locator("input").nth(2)).toHaveValue("");
  await expect(firstRow.locator("input").nth(3)).toHaveValue("");

  // Step 4: object from the catalogue fills name and default address.
  await modal.getByRole("combobox", { name: "Mã đối tượng" }).fill("PB01");
  await expect(modal.getByRole("textbox", { name: "Tên đối tượng" })).toHaveValue("Phòng hành chính");
  await expect(modal.getByRole("textbox", { name: "Địa chỉ" })).toHaveValue("Tầng 3, Hà Nội");
  await modal.getByRole("textbox", { name: "Người nhận" }).fill("Nguyễn Văn A");
  await modal.getByRole("textbox", { name: "Lý do xuất" }).fill("Xuất vật tư sử dụng nội bộ");
  await modal.getByRole("textbox", { name: "Kèm theo" }).fill("2");
  // AF05: reference document.
  await modal.getByRole("button", { name: "Chọn chứng từ tham chiếu" }).click();
  const refDialog = page.getByRole("dialog", { name: "Chọn chứng từ tham chiếu" });
  await refDialog.getByRole("textbox").fill("NK0000");
  await refDialog.getByText("NK00009").click();
  await expect(refDialog).toBeHidden();

  // Steps 9-14 + AF06: suggested cost per warehouse, stock hint, read-only price, two warehouses.
  await fillLine(modal, 0, "Kho 1", "2");
  await expect(modal.getByText("Tồn khả dụng: 5")).toBeVisible();
  await expect(modal.getByRole("spinbutton", { name: "Đơn giá dòng 1" })).toHaveValue("20");
  await expect(modal.getByRole("spinbutton", { name: "Đơn giá dòng 1" })).toHaveAttribute("readonly", "");
  await modal.getByRole("button", { name: "Thêm dòng" }).click();
  await fillLine(modal, 1, "Kho 2", "1");
  await expect(modal.getByRole("spinbutton", { name: "Đơn giá dòng 2" })).toHaveValue("30");
  await expect(modal.getByText("70").first()).toBeVisible();

  // AF11 / EF19: a file over 5 MB is refused, a valid one waits for the save.
  await modal.getByLabel("Chọn tệp đính kèm").setInputFiles([
    { name: "qua-lon.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
    { name: "bien-ban.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
  ]);
  await expect(page.getByText(/Dung lượng tệp đính kèm vượt quá 5 MB\. \(qua-lon\.pdf\)/)).toBeVisible();
  await expect(modal.getByRole("list", { name: "Tệp đính kèm" })).toContainText("bien-ban.pdf");
  await expect(modal.getByRole("list", { name: "Tệp đính kèm" })).not.toContainText("qua-lon.pdf");

  // AF13 + AF12: pick the template, which runs Cất và In.
  await modal.getByRole("button", { name: "Chọn mẫu in" }).click();
  await page.getByRole("menuitem", { name: /không đơn giá/ }).click();
  await expect.poll(() => calls.actions).toEqual(["submit-and-post"]);
  expect(calls.uploads).toEqual(["bien-ban.pdf"]);
  expect(calls.created).toMatchObject({
    source_module: "INV_OTHER_ISSUE", transaction_type: "ISSUE", supplier: party, reason: "Xuất vật tư sử dụng nội bộ",
    delivery_person: "Nguyễn Văn A", source_reference: "NK00009",
    document_metadata: { partner_name: "Phòng hành chính", partner_address: "Tầng 3, Hà Nội", attached_documents: "2" },
  });
  expect(calls.created?.lines).toEqual([
    expect.objectContaining({ source_warehouse: k1, quantity: "2", debit_account: expense, credit_account: goods }),
    expect.objectContaining({ source_warehouse: k2, quantity: "1", debit_account: expense, credit_account: goods }),
  ]);
  await expect(page.getByText(/Đã lưu và ghi sổ Phiếu xuất kho XK\d+ thành công!/)).toBeVisible();
  await expect(modal).toBeHidden();
  const printed = page.frameLocator("#inventory-issue-print");
  // The print frame is invisible; its content is what the print dialog shows.
  await expect(printed.locator("h1")).toHaveText("PHIẾU XUẤT KHO");
  await expect(printed.locator("body")).toContainText("Lý do xuất kho: Xuất vật tư sử dụng nội bộ");
  await expect(printed.locator("body")).toContainText("Kho 1, Kho 2");
  await expect(printed.getByText("Đơn giá")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__printed || 0)).toBe(1);
});

test("UC-INV-04 validates before saving, keeps the draft open when posting fails, and quick-adds an object", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], actions: [], parties: [], addresses: [] };
  await mockApi(page, calls, { postError: "Tồn kho đã thay đổi, không đủ số lượng để xuất. Vui lòng kiểm tra lại." });
  const modal = await openOtherIssue(page);

  // AF01: quick add of an object that is not in the catalogue.
  await modal.getByRole("button", { name: "Thêm đối tượng" }).click();
  const partyDialog = page.getByRole("dialog", { name: "Thêm đối tượng" });
  await partyDialog.getByRole("button", { name: "Lưu đối tượng" }).click();
  await expect(page.getByText("Vui lòng nhập Mã đối tượng.")).toBeVisible();
  await partyDialog.getByRole("textbox", { name: "Mã đối tượng" }).fill("CTY-GV");
  await partyDialog.getByRole("textbox", { name: "Tên đối tượng" }).fill("Công ty nhận góp vốn");
  await partyDialog.getByRole("textbox", { name: "Địa chỉ đối tượng" }).fill("Đà Nẵng");
  await partyDialog.getByRole("button", { name: "Lưu đối tượng" }).click();
  await expect(partyDialog).toBeHidden();
  expect(calls.parties[0]).toMatchObject({ code: "CTY-GV", name: "Công ty nhận góp vốn", party_type: "ORGANIZATION" });
  expect(calls.addresses[0]).toMatchObject({ party: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", address_line: "Đà Nẵng", is_default: true });
  await expect(modal.getByRole("combobox", { name: "Mã đối tượng" })).toHaveValue("CTY-GV");
  await expect(modal.getByRole("textbox", { name: "Tên đối tượng" })).toHaveValue("Công ty nhận góp vốn");

  // EF08 / EF09 / EF11 / EF05 are reported before calling the API.
  const row = modal.locator("tbody tr").first();
  await row.locator("input").first().fill("VT01");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText("Dòng 1: vui lòng chọn kho xuất cho hàng hóa.")).toBeVisible();
  await modal.getByRole("combobox", { name: "Kho xuất dòng 1" }).selectOption({ label: "Kho 1" });
  await modal.getByRole("spinbutton", { name: "Số lượng xuất dòng 1" }).fill("0");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText("Dòng 1: số lượng xuất kho phải lớn hơn 0.")).toBeVisible();
  await modal.getByRole("spinbutton", { name: "Số lượng xuất dòng 1" }).fill("1");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText("Dòng 1: vui lòng chọn tài khoản hạch toán hợp lệ.")).toBeVisible();
  await row.locator("input").nth(2).fill("642");
  await row.locator("input").nth(3).fill("156");
  await modal.getByRole("textbox", { name: "Lý do xuất" }).fill("");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText("Vui lòng nhập lý do xuất kho.")).toBeVisible();
  expect(calls.created).toBeNull();

  // EF17: saved, but posting is refused → the form stays open on the draft.
  await modal.getByRole("textbox", { name: "Lý do xuất" }).fill("Xuất hàng hóa góp vốn");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText(/Không thể ghi sổ phiếu xuất kho: .*Tồn kho đã thay đổi, không đủ số lượng để xuất/)).toBeVisible();
  expect(calls.created?.supplier).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  expect(calls.created?.document_metadata.partner_name).toBe("Công ty nhận góp vốn");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("issue-status")).toHaveText("Chưa ghi sổ");

  // AF10: hiding the account columns keeps the data.
  await modal.getByText("Hiển thị tài khoản").click();
  await expect(modal.getByRole("columnheader", { name: "TK Nợ" })).toHaveCount(0);
  await modal.getByText("Hiển thị tài khoản").click();
  await expect(row.locator("input").nth(2)).toHaveValue("642");
});
