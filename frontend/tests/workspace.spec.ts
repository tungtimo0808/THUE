import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.goto(
    "/inventory/production-orders?company=minh-an&period=2026-09",
  );
});

test("app shell follows the accounting workspace specification and brand palette", async ({
  page,
}) => {
  await expect(page.getByRole("link", { name: /KẾ TOÁN/ })).toBeVisible();
  await expect(page.getByLabel("Doanh nghiệp", { exact: true })).toHaveValue(
    "minh-an",
  );
  await expect(page.getByLabel("Dữ liệu kế toán")).toBeVisible();
  await expect(page.getByLabel("Kỳ kế toán", { exact: true })).toHaveValue(
    "2026-09",
  );

  const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(
    sidebar.getByRole("link", { name: "Quản lý hóa đơn" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Kho", exact: true }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Thuế", exact: true }),
  ).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Danh mục" })).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Số dư ban đầu" }),
  ).toBeVisible();

  const moduleNav = page.getByRole("navigation", {
    name: "Chức năng phân hệ",
  });
  for (const tab of [
    "Quy trình",
    "Biểu đồ",
    "Nhập kho",
    "Xuất kho",
    "Chuyển kho",
    "Lệnh sản xuất",
    "Lắp ráp, tháo dỡ",
    "Kiểm kê",
    "Báo cáo",
    "Hàng hóa, dịch vụ",
  ]) {
    await expect(
      moduleNav.getByRole("link", { name: tab, exact: true }),
    ).toBeVisible();
  }

  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const app = getComputedStyle(document.querySelector(".reference-app")!);
    return {
      primary: root.getPropertyValue("--primary").trim().toLowerCase(),
      canvas: app.getPropertyValue("--ref-canvas").trim().toLowerCase(),
    };
  });
  expect(palette).toEqual({ primary: "#606c38", canvas: "#ffe8d6" });
});

test("production order list supports search, bulk actions and quick detail", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Lệnh sản xuất", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);

  await page.getByLabel("Tìm lệnh sản xuất").fill("LSX-0002");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("LSX-0002");

  await page.getByLabel("Chọn LSX-0002").check();
  await expect(page.getByText("Đã chọn 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ghi sổ" })).toBeVisible();

  await page.getByRole("button", { name: "Xem nhanh LSX-0002" }).click();
  const detail = page.getByRole("region", { name: "Chi tiết nhanh" });
  await expect(detail).toContainText("Bộ bàn ăn gỗ sồi");
  await expect(detail.getByRole("tab", { name: "Hàng hóa" })).toBeVisible();
});

test("filter state is shareable and empty state can be reset", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Bộ lọc" }).click();
  await page.getByLabel("Trạng thái lệnh").selectOption("in-progress");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(page).toHaveURL(/status=in-progress/);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);

  await page.getByLabel("Tìm lệnh sản xuất").fill("không có dữ liệu");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy lệnh sản xuất" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
});

test("quick create is grouped and the workspace is accessible on desktop and mobile", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm nhanh chứng từ" });
  await expect(dialog.getByRole("heading", { name: "TIỀN MẶT" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "KHO" })).toBeVisible();
  await page.keyboard.press("Escape");

  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(desktop.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng chính" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("a multi-line draft persists and remains separated by company", async ({
  page,
}) => {
  await page.goto("/cash/transactions?company=minh-an&period=2026-09");
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await page.getByRole("button", { name: "Thu tiền mặt", exact: true }).click();
  await page
    .getByLabel("Đối tượng", { exact: false })
    .fill("Khách hàng kiểm thử");
  await page
    .getByLabel("Diễn giải", { exact: false })
    .fill("Phiếu thu kiểm thử giao diện");
  await page.getByLabel("Số tiền dòng 1", { exact: true }).fill("2500000");
  await page.getByRole("button", { name: "Sao chép dòng 1" }).click();
  await expect(page.locator(".form-total")).toContainText("5.000.000");
  await page.getByRole("button", { name: "Lưu bản nháp" }).click();

  await page.reload();
  await page
    .getByLabel("Tìm trong danh sách")
    .fill("Phiếu thu kiểm thử giao diện");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("5.000.000");

  await page
    .getByLabel("Doanh nghiệp", { exact: true })
    .selectOption("an-phat");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});

test("storage failure keeps unsaved document input", async ({ page }) => {
  await page.goto("/cash/transactions?company=minh-an&period=2026-09");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await page.getByRole("button", { name: "Thu tiền mặt", exact: true }).click();
  await page.getByLabel("Đối tượng", { exact: false }).fill("Dữ liệu cần giữ");
  await page.getByLabel("Diễn giải", { exact: false }).fill("Kiểm thử lưu trữ");
  await page.getByLabel("Số tiền dòng 1", { exact: true }).fill("100000");
  await page
    .getByRole("button", { name: "Lưu & thêm mới", exact: true })
    .click();

  await expect(page.getByRole("alert")).toContainText("Không thể lưu phiếu");
  await expect(page.getByLabel("Đối tượng", { exact: false })).toHaveValue(
    "Dữ liệu cần giữ",
  );
  await expect(page.getByLabel("Số tiền dòng 1", { exact: true })).toHaveValue(
    "100000",
  );
});
