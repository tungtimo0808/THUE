import { expect, test } from "@playwright/test";

test("UC-INV-11 links the source, saves and prints a draft, then posts from the list", async ({ page }) => {
  const company = "11111111-1111-4111-8111-111111111111";
  const source = "22222222-2222-4222-8222-222222222222";
  const supplier = "33333333-3333-4333-8333-333333333333";
  const item = "44444444-4444-4444-8444-444444444444";
  const line = "55555555-5555-4555-8555-555555555555";
  const account = "66666666-6666-4666-8666-666666666666";
  const purchase = { id: source, number: "MH0001", status: "POSTED", purchase_type: "WAREHOUSE",
    supplier, document_date: "2026-10-01", lines: [{ id: line, item, quantity: "2", tax_rate: null,
      credit_account: account, debit_account: "77777777-7777-4777-8777-777777777777" }] };
  let payload: Record<string, unknown> | undefined;
  let draft: Record<string, unknown> | undefined;
  const actions: string[] = [];
  await page.addInitScript((id) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "discount-test", companyId: id,
    companies: [{ id, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }],
  })), company);
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/v1/common/companies/mine/") {
      await route.fulfill({ json: [{ id: company, name: "Công ty ABC", code: "ABC", status: "ACTIVE" }] }); return;
    }
    if (path === "/api/v1/purchases/goods-purchases/") {
      await route.fulfill({ json: [purchase] }); return;
    }
    if (path === "/api/v1/master-data/parties/") {
      await route.fulfill({ json: [{ id: supplier, code: "NCC01", name: "Nhà cung cấp" }] }); return;
    }
    if (path === "/api/v1/master-data/items/") {
      await route.fulfill({ json: [{ id: item, code: "HH01", name: "Hàng hóa" }] }); return;
    }
    if (path === "/api/v1/general-ledger/accounts/") {
      await route.fulfill({ json: [{ id: account, code: "331", status: "ACTIVE", is_postable: true }] }); return;
    }
    if (path === "/api/v1/purchases/purchase-discounts/" && route.request().method() === "POST") {
      payload = route.request().postDataJSON();
      draft = { id: "draft-1", number: payload?.number, document_date: payload?.document_date,
        supplier, total_amount: "50", reason: payload?.reason, status: "DRAFT", version: 1 };
      await route.fulfill({ status: 201, json: draft }); return;
    }
    if (path.startsWith("/api/v1/purchases/purchase-discounts/draft-1/") && route.request().method() === "POST") {
      const action = path.split("/").filter(Boolean).at(-1) || "";
      actions.push(action);
      draft = { ...draft, status: action === "submit" ? "APPROVED" : "POSTED",
        version: action === "submit" ? 2 : 3 };
      await route.fulfill({ json: draft }); return;
    }
    if (path === "/api/v1/purchases/purchase-discounts/") {
      await route.fulfill({ json: draft ? [draft] : [] }); return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto("/purchases/discounts");
  await page.getByRole("button", { name: /Thêm chứng từ giảm giá hàng mua/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Chứng từ mua hàng nguồn").selectOption(source);
  await dialog.locator("label:has-text('Mã nhà cung cấp') + div input").first().fill("NCC01");
  const row = dialog.locator(".misa-purchase-table tbody tr").first();
  await row.locator("td").nth(1).locator("input").fill("HH01");
  await row.locator("td").nth(7).locator("input").fill("2");
  await row.locator("td").nth(8).locator("input").fill("25");
  const popupReady = page.waitForEvent("popup");
  await dialog.getByRole("button", { name: "Lưu và In" }).click();
  const printPage = await popupReady;
  await expect(dialog).not.toBeVisible();
  await expect(printPage.getByText("CHỨNG TỪ GIẢM GIÁ HÀNG MUA")).toBeVisible();
  await expect(printPage.getByText("Chứng từ đã cất, chưa ghi sổ.")).toBeVisible();
  expect(payload).toMatchObject({ original_purchase: source, reduce_stock_value: true,
    handling: "REDUCE_PAYABLE", lines: [{ original_line: line, pre_tax_amount: "50" }] });
  await expect(page.getByText("Nháp").first()).toBeVisible();
  await page.getByRole("button", { name: "Gửi duyệt" }).click();
  await page.getByRole("button", { name: "Ghi sổ" }).click();
  await expect(page.getByText("Đã ghi sổ").first()).toBeVisible();
  expect(actions).toEqual(["submit", "post"]);
});
