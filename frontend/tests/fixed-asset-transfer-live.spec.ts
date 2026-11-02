import { expect, test } from "@playwright/test";

const company = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const disposedId = "33333333-3333-4333-8333-333333333333";
const deptFrom = { id: "d1111111-1111-4111-8111-111111111111", code: "KT", name: "Phòng Kỹ thuật", status: "ACTIVE" };
const deptTo = { id: "d2222222-2222-4222-8222-222222222222", code: "BQL", name: "Ban Quản lý Công trình", status: "ACTIVE" };
const contract = { id: "c1111111-1111-4111-8111-111111111111", number: "HĐB-2026-01", title: "Hợp đồng A", status: "SIGNED" };

function asset(id: string, code: string, status: string) {
  return {
    id, company, code, name: `Tài sản ${code}`, asset_type: "FIXED_ASSET", status, version: 1, department_name: deptFrom.name,
    acquisition_date: "2026-01-01", in_service_date: "2026-01-01", original_cost: "60000000", accumulated_depreciation: "0",
    remaining_value: "60000000", category_name: "Máy móc", origins: [], components: [], accessories: [],
  };
}

test("UC-FA-05 điều chuyển từ màn hình dùng danh mục đơn vị và theo dõi chi phí thật", async ({ page }) => {
  await page.addInitScript(({ company }) => localStorage.setItem("erp_api_session", JSON.stringify({
    token: "fa-transfer-test", companyId: company, companies: [{ id: company, name: "Công ty A" }], user: { id: "tester" },
  })), { company });
  let saved: Record<string, any> | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const list = (results: unknown[]) => route.fulfill({ json: { results } });
    if (path.endsWith("/companies/mine/")) return route.fulfill({ json: [{ id: company, name: "Công ty A" }] });
    if (path === "/api/v1/fixed-assets/transactions/next-transfer-number/") return route.fulfill({ json: { voucher_no: "ĐCTS00007" } });
    if (path === "/api/v1/fixed-assets/transactions/transfer/") {
      saved = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: {
        voucher_no: "ĐCTS00007", transaction_date: "2026-10-28", deliverer: "A", receiver: "B", reason: "R", status: "POSTED",
        lines: [], message: "Điều chuyển tài sản cố định thành công.",
      } });
    }
    if (path === "/api/v1/fixed-assets/assets/") return list([asset(assetId, "TS001", "ACTIVE"), asset(disposedId, "TS999", "DISPOSED")]);
    if (path === "/api/v1/organization/departments/") return list([deptFrom, deptTo]);
    if (path === "/api/v1/sales/contracts/") return list([contract, { id: "c2", number: "HĐB-OLD", status: "EXPIRED" }]);
    if (path === "/api/v1/sales/orders/") return list([
      { id: "o1", number: "ĐĐH-01", status: "APPROVED", contract: contract.id },
      { id: "o2", number: "ĐĐH-KHAC", status: "APPROVED", contract: "c-other" },
    ]);
    if (path === "/api/v1/master-data/projects/") return list([{ id: "p1", code: "CT-A", name: "Công trình A", status: "ACTIVE" }]);
    if (path === "/api/v1/master-data/expense-items/") return list([{ id: "e1", code: "KH-TSCD", name: "Chi phí khấu hao TSCĐ", status: "ACTIVE" }]);
    if (path === "/api/v1/master-data/cost-centers/") return list([{ id: "k1", code: "CT-A", name: "Công trình A", status: "ACTIVE" }]);
    return list([]);
  });

  await page.goto("/assets/transfer");
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.locator('input[value="ĐCTS00007"]')).toBeVisible();

  const assetSelect = page.getByTestId("transfer-asset-0");
  await expect(assetSelect.locator("option", { hasText: "TS001" })).toHaveCount(1);
  await expect(assetSelect.locator("option", { hasText: "TS999" })).toHaveCount(0);
  await assetSelect.selectOption("TS001");

  const toDept = page.getByTestId("transfer-toDept-0");
  await expect(toDept.locator("option", { hasText: "Phòng Kỹ thuật" })).toHaveCount(0);
  await toDept.selectOption(deptTo.name);

  const contractSelect = page.getByTestId("transfer-contract-0");
  await expect(contractSelect.locator("option", { hasText: "HĐB-OLD" })).toHaveCount(0);
  await contractSelect.selectOption("HĐB-2026-01");
  const orderSelect = page.getByTestId("transfer-order-0");
  await expect(orderSelect.locator("option", { hasText: "ĐĐH-KHAC" })).toHaveCount(0);
  await orderSelect.selectOption("ĐĐH-01");
  await page.getByTestId("transfer-project-0").selectOption("CT-A");
  await page.getByTestId("transfer-costItem-0").selectOption("KH-TSCD");
  await page.getByTestId("transfer-costObj-0").selectOption("CT-A");

  await page.getByPlaceholder("Nhập họ tên người bàn giao...").fill("Nguyễn Văn A");
  await page.getByPlaceholder("Nhập họ tên người tiếp nhận...").fill("Trần Văn B");
  await page.getByPlaceholder("Nhập lý do điều chuyển tài sản cố định...").fill("Phục vụ công trình A");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();

  await expect.poll(() => saved).not.toBeNull();
  expect(saved).toMatchObject({
    voucher_no: "ĐCTS00007", expected_voucher_no: "ĐCTS00007", deliverer: "Nguyễn Văn A", receiver: "Trần Văn B",
    lines: [{ asset_id: assetId, to_department: deptTo.id, sales_contract: "HĐB-2026-01", sales_order: "ĐĐH-01",
      project: "CT-A", expense_item: "KH-TSCD", cost_object: "CT-A" }],
  });
  expect(String(saved!.idempotency_key)).toMatch(/^FA-TRF-/);
  await expect(page.getByText("Điều chuyển tài sản cố định thành công.")).toBeVisible();
});
