import { expect, test, type Page } from "@playwright/test";

// UC-INV-05 – Chuyển kho: internal transfer, goods sent to an agent and receipt of goods in transit, against a mocked API.
const company = "11111111-1111-4111-8111-111111111111";
const k1 = "22222222-2222-4222-8222-222222222222";
const k2 = "21212121-2121-4212-8212-212121212121";
const agentStore = "23232323-2323-4232-8232-232323232323";
const transit = "24242424-2424-4242-8242-242424242424";
const item = "33333333-3333-4333-8333-333333333333";
const uom = "44444444-4444-4444-8444-444444444444";
const goods = "88888888-8888-4888-8888-888888888888";
const consigned = "89898989-8989-4898-8898-898989898989";
const transporter = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const agent = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const voucher = "55555555-5555-4555-8555-555555555555";
const onRoad = "56565656-5656-4565-8565-565656565656";
const onRoadLine = "57575757-5757-4575-8575-575757575757";

test.describe.configure({ timeout: 90_000 });

type Calls = { created: Record<string, any> | null; uploads: string[]; actions: string[]; received: Record<string, any> | null };

async function mockApi(page: Page, calls: Calls) {
  await page.addInitScript(({ company }) => {
    localStorage.setItem("erp_api_session", JSON.stringify({
      token: "inventory-transfer-test", companyId: company,
      companies: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
    }));
    window.print = () => { (window.top as any).__printed = ((window.top as any).__printed || 0) + 1; };
  }, { company });
  const inTransitVoucher = {
    id: onRoad, number: "CK00007", transaction_type: "TRANSFER", source_module: "INV_TRANSFER", status: "POSTED",
    transaction_date: "2026-10-20", document_date: "2026-10-20", reason: "Điều chuyển sang kho 2", delivery_person: "Nguyễn Văn B",
    source_warehouse: k1, destination_warehouse: k2, total_value: "40", source_warehouse_name: "Kho 1", destination_warehouse_name: "Kho 2",
    document_metadata: { transfer_kind: "TRANSPORT", in_transit: true, receipt_status: "IN_TRANSIT", transit_warehouse: transit },
    lines: [{ id: onRoadLine, line_no: 1, item, uom, quantity: "2", conversion_factor: "1", unit_cost: "20", line_value: "40",
      source_warehouse: k1, destination_warehouse: k2, debit_account: null, credit_account: null }],
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (path === "/api/v1/inventory/transactions/" && method === "POST") {
      calls.created = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { ...calls.created, id: voucher, status: "DRAFT", document_metadata: { ...calls.created?.document_metadata, attachments: [] } } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${voucher}/attachments/`) {
      const body = route.request().postDataBuffer()?.toString("latin1") || "";
      calls.uploads.push(/filename="([^"]+)"/.exec(body)?.[1] || "?");
      await route.fulfill({ status: 201, json: { ...calls.created, id: voucher, status: "DRAFT",
        document_metadata: { ...calls.created?.document_metadata, attachments: calls.uploads.map((name, index) => ({ id: `a${index}`, name, size: 10 })) } } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${voucher}/submit-and-post/`) {
      calls.actions.push("submit-and-post");
      await route.fulfill({ json: { ...calls.created, id: voucher, status: "POSTED", warnings: [],
        document_metadata: { ...calls.created?.document_metadata, receipt_status: "RECEIVED" },
        lines: calls.created?.lines.map((line: any, index: number) => ({ ...line, id: `l${index}`, conversion_factor: "1",
          unit_cost: index ? "30" : "20", line_value: String(Number(line.quantity) * (index ? 30 : 20)) })) } }); return;
    }
    if (path === `/api/v1/inventory/transactions/${onRoad}/receive/`) {
      calls.received = route.request().postDataJSON();
      await route.fulfill({ json: { ...inTransitVoucher, document_metadata: { ...inTransitVoucher.document_metadata, receipt_status: "RECEIVED",
        received_lines: { [onRoadLine]: "1.5" }, discrepancies: [{ line: onRoadLine, item_code: "VT01", shipped: "2", received: "1.5", difference: "0.5" }] } } }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/organization/branches/": [{ id: "66666666-6666-4666-8666-666666666666", name: "Trụ sở", is_head_office: true, status: "ACTIVE" }],
      "/api/v1/master-data/warehouses/": [
        { id: k1, code: "K1", name: "Kho 1", status: "ACTIVE", allow_transfer: true, warehouse_type: "PHYSICAL", address: "Hà Nội" },
        { id: k2, code: "K2", name: "Kho 2", status: "ACTIVE", allow_transfer: true, warehouse_type: "PHYSICAL", address: "Hải Phòng" },
        { id: agentStore, code: "KG", name: "Kho hàng gửi bán", status: "ACTIVE", allow_transfer: true, warehouse_type: "CONSIGNMENT" },
        { id: transit, code: "KT", name: "Hàng đi đường", status: "ACTIVE", allow_transfer: true, warehouse_type: "TRANSIT" },
      ],
      "/api/v1/master-data/items/": [{ id: item, code: "VT01", name: "Vật tư 01", status: "ACTIVE", track_inventory: true, base_uom: uom, valuation_method: "MOVING_AVERAGE" }],
      "/api/v1/inventory/balances/": [
        { item, warehouse: k1, quantity: "5", available_quantity: "5", average_cost: "20" },
        { item, warehouse: k2, quantity: "4", available_quantity: "4", average_cost: "30" },
      ],
      "/api/v1/inventory/transactions/": [inTransitVoucher],
      "/api/v1/master-data/units-of-measure/": [{ id: uom, code: "CAI", name: "Cái" }],
      "/api/v1/general-ledger/accounts/": [
        { id: goods, code: "1561", name: "Hàng hóa", status: "ACTIVE", is_postable: true },
        { id: consigned, code: "157", name: "Hàng gửi bán", status: "ACTIVE", is_postable: true },
      ],
      "/api/v1/master-data/parties/": [
        { id: transporter, code: "NV01", name: "Nguyễn Văn B", status: "ACTIVE" },
        { id: agent, code: "DL01", name: "Đại lý Minh Phát", tax_code: "0101234567", status: "ACTIVE" },
      ],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
}

async function openNewTransfer(page: Page) {
  await page.goto("/inventory/transfers");
  await page.getByRole("button", { name: "Thêm", exact: true }).first().click();
  const modal = page.locator(".misa-purchase-modal-window").filter({ hasText: "Hàng tiền" });
  // Step 2: the default kind is "Xuất kho kiêm vận chuyển nội bộ".
  await expect(modal.getByRole("radio", { name: "Xuất kho kiêm vận chuyển nội bộ" })).toBeChecked();
  return modal;
}

test("UC-INV-05 records an internal transfer between two pairs of warehouses, attaches a file, posts and prints", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], actions: [], received: null };
  await mockApi(page, calls);
  const modal = await openNewTransfer(page);
  await modal.getByRole("radio", { name: "Xuất chuyển kho nội bộ" }).check();
  await expect(modal.getByTestId("transfer-status")).toHaveText("Chứng từ mới");

  // Steps 4-6.
  await modal.getByRole("combobox", { name: "Mã người vận chuyển" }).fill("NV01");
  await expect(modal.getByRole("textbox", { name: "Tên người vận chuyển" })).toHaveValue("Nguyễn Văn B");
  await modal.getByRole("textbox", { name: "Diễn giải" }).fill("Điều chuyển vật tư từ kho tổng sang kho nguyên vật liệu");
  // AF04.
  await modal.getByRole("button", { name: "Chọn chứng từ tham chiếu chuyển kho" }).click();
  await page.getByRole("dialog", { name: "Chọn chứng từ tham chiếu" }).getByText("CK00007").click();

  // Steps 8-16: the destination list holds neither transit nor consignment stores; book value is suggested and read-only.
  await modal.getByRole("combobox", { name: "Mã hàng dòng 1" }).fill("VT01");
  await modal.getByRole("combobox", { name: "Xuất tại kho dòng 1" }).selectOption({ label: "Kho 1" });
  await expect(modal.getByText("Tồn khả dụng: 5")).toBeVisible();
  await expect(modal.getByRole("combobox", { name: "Nhập tại kho dòng 1" }).locator("option")).toHaveText(["-- Kho nhập --", "Kho 1", "Kho 2"]);
  // EF09 is caught before the API is called.
  await modal.getByRole("combobox", { name: "Nhập tại kho dòng 1" }).selectOption({ label: "Kho 1" });
  await modal.getByRole("spinbutton", { name: "Số lượng chuyển dòng 1" }).fill("2");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect(page.getByText("Dòng 1: kho nhập phải khác kho xuất.")).toBeVisible();
  expect(calls.created).toBeNull();
  await modal.getByRole("combobox", { name: "Nhập tại kho dòng 1" }).selectOption({ label: "Kho 2" });
  await expect(modal.getByRole("spinbutton", { name: "Đơn giá chuyển dòng 1" })).toHaveValue("20");
  await expect(modal.getByRole("spinbutton", { name: "Đơn giá chuyển dòng 1" })).toHaveAttribute("readonly", "");
  // AF06: second line from another source warehouse.
  await modal.getByRole("button", { name: "Thêm dòng" }).click();
  await modal.getByRole("combobox", { name: "Mã hàng dòng 2" }).fill("VT01");
  await modal.getByRole("combobox", { name: "Xuất tại kho dòng 2" }).selectOption({ label: "Kho 2" });
  await modal.getByRole("combobox", { name: "Nhập tại kho dòng 2" }).selectOption({ label: "Kho 1" });
  await modal.getByRole("spinbutton", { name: "Số lượng chuyển dòng 2" }).fill("1");
  await expect(modal.getByTestId("transfer-total")).toHaveText(/70/);
  // BR16: no default TK 157 for an internal transfer.
  await expect(modal.getByRole("combobox", { name: "TK Nợ dòng 1" })).toHaveValue("");

  // AF10 + AF11.
  await modal.getByRole("button", { name: "Thêm ghi chú" }).click();
  await modal.getByRole("textbox", { name: "Ghi chú chuyển kho" }).fill("Giao trong ngày");
  await modal.getByLabel("Chọn tệp đính kèm").setInputFiles({ name: "lenh-dieu-dong.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });

  // AF13 → AF12: Cất và In with the template without prices.
  await modal.getByRole("button", { name: "Chọn mẫu in chuyển kho" }).click();
  await page.getByRole("menuitem", { name: /không đơn giá/ }).click();
  await expect.poll(() => calls.actions).toEqual(["submit-and-post"]);
  expect(calls.uploads).toEqual(["lenh-dieu-dong.pdf"]);
  expect(calls.created).toMatchObject({
    transaction_type: "TRANSFER", source_module: "INV_TRANSFER", source_reference: "CK00007",
    reason: "Điều chuyển vật tư từ kho tổng sang kho nguyên vật liệu", delivery_person: "Nguyễn Văn B",
    source_warehouse: k1, destination_warehouse: k2,
    document_metadata: { transfer_kind: "INTERNAL", in_transit: false, transporter_code: "NV01", notes: "Giao trong ngày" },
  });
  expect(calls.created?.lines).toEqual([
    expect.objectContaining({ source_warehouse: k1, destination_warehouse: k2, quantity: "2", debit_account: null, credit_account: null }),
    expect.objectContaining({ source_warehouse: k2, destination_warehouse: k1, quantity: "1" }),
  ]);
  await expect(page.getByText(/Đã lưu Phiếu chuyển kho CK\d+ thành công!/)).toBeVisible();
  await expect(modal).toBeHidden();
  const printed = page.frameLocator("#inventory-issue-print");
  await expect(printed.locator("h1")).toHaveText("PHIẾU CHUYỂN KHO");
  await expect(printed.locator("body")).toContainText("Xuất tại kho: Kho 1, Kho 2");
  await expect(printed.getByText("Đơn giá")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as any).__printed || 0)).toBe(1);
});

test("UC-INV-05 sends goods to an agent's consignment store on TK 157", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], actions: [], received: null };
  await mockApi(page, calls);
  const modal = await openNewTransfer(page);
  await modal.getByRole("radio", { name: "Xuất kho gửi bán đại lý" }).check();
  // AF02 / BR21: agent lookup, consignment destination only, TK 157 by default, no transit option.
  await modal.getByRole("combobox", { name: "Mã đại lý" }).fill("DL01");
  await expect(modal.locator("input[value='Đại lý Minh Phát']")).toHaveCount(1);
  await expect(modal.locator("input[value='0101234567']")).toHaveCount(1);
  await expect(modal.getByText(/Có thời gian vận chuyển/)).toHaveCount(0);
  await modal.getByRole("combobox", { name: "Mã hàng dòng 1" }).fill("VT01");
  await modal.getByRole("combobox", { name: "Xuất tại kho dòng 1" }).selectOption({ label: "Kho 1" });
  await expect(modal.getByRole("combobox", { name: "Nhập tại kho dòng 1" }).locator("option")).toHaveText(["-- Kho nhập --", "Kho hàng gửi bán"]);
  await modal.getByRole("combobox", { name: "Nhập tại kho dòng 1" }).selectOption({ label: "Kho hàng gửi bán" });
  await expect(modal.getByRole("combobox", { name: "TK Nợ dòng 1" })).toHaveValue("157");
  await modal.getByRole("combobox", { name: "TK Có dòng 1" }).fill("1561");
  await modal.getByRole("button", { name: "Cất", exact: true }).click();
  await expect.poll(() => calls.actions).toEqual(["submit-and-post"]);
  expect(calls.created).toMatchObject({ supplier: agent, destination_warehouse: agentStore,
    document_metadata: { transfer_kind: "CONSIGNMENT", in_transit: false, agent_code: "DL01", agent_name: "Đại lý Minh Phát", agent_tax: "0101234567" } });
  expect(calls.created?.lines[0]).toMatchObject({ debit_account: consigned, credit_account: goods });
});

test("UC-INV-05 confirms receipt of goods in transit and records the difference", async ({ page }) => {
  const calls: Calls = { created: null, uploads: [], actions: [], received: null };
  await mockApi(page, calls);
  await page.goto("/inventory/transfers");
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).first().click();
  const listRow = page.getByRole("row").filter({ hasText: "CK00007" });
  await expect(listRow).toContainText("Đang vận chuyển");
  await listRow.getByText("CK00007").click();
  const modal = page.locator(".misa-purchase-modal-window").filter({ hasText: "Hàng tiền" });
  await expect(modal.getByTestId("transfer-status")).toHaveText("Đã ghi sổ · Đang vận chuyển");
  await expect(modal.getByRole("button", { name: "Cất", exact: true })).toBeDisabled();

  await modal.getByRole("button", { name: "Xác nhận nhận hàng" }).click();
  const dialog = page.getByRole("dialog", { name: "Xác nhận nhận hàng" });
  await dialog.getByRole("spinbutton", { name: "Thực nhận dòng 1" }).fill("1.5");
  // EF20: a difference is not confirmed silently.
  await dialog.getByRole("button", { name: "Xác nhận đã nhận" }).click();
  await expect(page.getByText(/VT01 đã xuất 2, thực nhận 1.5, chênh lệch 0.5/)).toBeVisible();
  expect(calls.received).toBeNull();
  await dialog.getByText("Ghi nhận chênh lệch điều chuyển").click();
  await dialog.getByRole("textbox", { name: "Lý do chênh lệch" }).fill("Hao hụt khi vận chuyển");
  await dialog.getByRole("button", { name: "Xác nhận đã nhận" }).click();
  await expect.poll(() => calls.received).toEqual({
    lines: [{ line: onRoadLine, received_quantity: "1.5" }], accept_discrepancy: true, reason: "Hao hụt khi vận chuyển",
  });
  await expect(page.getByText("Đã xác nhận nhận hàng CK00007 với 1 dòng chênh lệch.")).toBeVisible();
  await expect(modal.getByTestId("transfer-status")).toHaveText("Đã ghi sổ · Đã nhận");

  // AF18: reprint without a new movement.
  await modal.getByRole("button", { name: "In lại" }).click();
  await expect(page.frameLocator("#inventory-issue-print").locator("h1")).toHaveText("PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ");
  await expect(page.frameLocator("#inventory-issue-print").locator("body")).toContainText("1.5");
});
