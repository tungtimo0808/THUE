import { expect, test } from "@playwright/test";

test("UC-INV-07 connects confirmed count to approval and posted adjustment", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const warehouse = "22222222-2222-4222-8222-222222222222";
  const item = "33333333-3333-4333-8333-333333333333";
  const countId = "55555555-5555-4555-8555-555555555555";
  const lineId = "66666666-6666-4666-8666-666666666666";
  const resolutionId = "77777777-7777-4777-8777-777777777777";
  const voucherId = "88888888-8888-4888-8888-888888888888";
  const calls: string[] = [];
  let countStatus = "DRAFT";
  let resolution: Record<string, any> | null = null;
  let voucher: Record<string, any> | null = null;
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({ token: "test-token", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] })), company);
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "POST" && path === `/api/v1/inventory/counts/${countId}/confirm/`) {
      calls.push("confirm"); countStatus = "COUNTED";
      await route.fulfill({ json: { id: countId, status: countStatus } }); return;
    }
    if (method === "POST" && path === "/api/v1/inventory/count-resolutions/") {
      const body = route.request().postDataJSON();
      calls.push("create");
      resolution = { ...body, id: resolutionId, count: countId, item_code: "VT01", status: "DRAFT", adjustment_transaction: null };
      await route.fulfill({ status: 201, json: resolution }); return;
    }
    if (method === "POST" && path.startsWith(`/api/v1/inventory/count-resolutions/${resolutionId}/`)) {
      const action = path.split("/").at(-2)!;
      calls.push(action);
      if (action === "submit") resolution!.status = "PENDING";
      if (action === "approve") resolution!.status = "APPROVED";
      if (action === "create-voucher") {
        const body = route.request().postDataJSON();
        voucher = { ...body, id: voucherId, status: "DRAFT", source_module: "INV_COUNT_RESOLUTION",
          transaction_type: "ADJUSTMENT_IN", lines: [] };
        resolution!.adjustment_transaction = voucherId;
        await route.fulfill({ status: 201, json: voucher }); return;
      }
      if (action === "post-voucher") { voucher!.status = "POSTED"; resolution!.status = "COMPLETED"; }
      await route.fulfill({ json: action === "post-voucher" ? voucher : resolution }); return;
    }
    const data: Record<string, any[]> = {
      "/api/v1/common/companies/mine/": [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
      "/api/v1/master-data/warehouses/": [{ id: warehouse, name: "Kho 1", code: "K1", status: "ACTIVE" }],
      "/api/v1/master-data/items/": [{ id: item, code: "VT01", name: "Vật tư 01", base_uom: "uom", status: "ACTIVE", track_inventory: true }],
      "/api/v1/master-data/units-of-measure/": [{ id: "uom", code: "CAI", name: "Cái" }],
      "/api/v1/inventory/counts/": [{ id: countId, number: "KK00001", count_date: "2026-10-22", warehouse, notes: "Định kỳ", status: countStatus,
        lines: [{ id: lineId, item, system_quantity: "10", actual_quantity: "12", variance_quantity: "2" }] }],
      "/api/v1/inventory/count-resolutions/": resolution ? [resolution] : [],
      "/api/v1/inventory/transactions/": voucher ? [voucher] : [],
      "/api/v1/general-ledger/accounts/": [
        { id: "d", code: "156", name: "Hàng hóa", status: "ACTIVE", is_postable: true },
        { id: "c", code: "338", name: "Phải trả khác", status: "ACTIVE", is_postable: true },
      ],
    };
    await route.fulfill({ json: { results: data[path] || [] } });
  });
  await page.goto("/inventory/stocktake");
  await page.getByRole("button", { name: "Xem danh sách chứng từ" }).click();
  await page.getByText("KK00001").click();
  await page.getByRole("button", { name: "Xác nhận biên bản" }).click();
  await page.getByRole("button", { name: "Xử lý chênh lệch" }).click();
  await page.getByRole("button", { name: "Lập phương án" }).click();
  await page.getByLabel("Diễn giải nguyên nhân").fill("Đã kiểm tra chứng từ nhập");
  await page.getByLabel("Đơn giá đề xuất").fill("25");
  await page.getByLabel("Căn cứ xác định giá trị").fill("Biên bản xác minh");
  await page.getByRole("button", { name: "Lưu phương án" }).click();
  await expect(page.getByText("Chờ phê duyệt")).toBeHidden();
  await page.getByRole("button", { name: "Gửi phê duyệt" }).click();
  await page.getByRole("button", { name: "Phê duyệt", exact: true }).click();
  await page.getByRole("button", { name: "Lập chứng từ điều chỉnh" }).click();
  await page.getByLabel("TK Nợ").fill("156");
  await page.getByLabel("TK Có").fill("338");
  await page.getByRole("button", { name: "Cất chứng từ" }).click();
  await page.getByRole("button", { name: /Ghi sổ DC/ }).click();
  await expect(page.getByText("Đã xử lý", { exact: true })).toBeVisible();
  expect(calls).toEqual(["confirm", "create", "submit", "approve", "create-voucher", "post-voucher"]);
});
