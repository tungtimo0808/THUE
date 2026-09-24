import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("dashboard, context, deep links and filters", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".financial-chart svg").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  const before = await page.locator(".metric-value").first().textContent();
  await page.getByLabel("Kỳ kế toán", { exact: true }).selectOption("2026");
  await expect(page.locator(".metric-value").first()).not.toHaveText(before!);
  await page.getByRole("link", { name: "Tiền mặt", exact: true }).click();
  await expect(page).toHaveURL(/period=2026/);
  await page.getByRole("button", { name: "Bộ lọc" }).click();
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("pending");
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Tìm trong danh sách").fill("không tồn tại 123");
  await expect(
    page.getByRole("heading", { name: "Chưa có chứng từ phù hợp" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("so-viet-chung-tu-mau.csv");
  expect(errors).toEqual([]);
});

test("create multiple lines, persist, submit draft and separate company data", async ({
  page,
}) => {
  await page.goto("/cash?company=minh-an&period=2026-09");
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
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
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page
    .getByLabel("Tìm trong danh sách")
    .fill("Phiếu thu kiểm thử giao diện");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("5.000.000");
  await page.locator(".document-link").click();
  await page.getByRole("button", { name: "Gửi duyệt thử" }).click();
  await expect(page.getByRole("dialog").locator(".status")).toHaveText(
    "◷Chờ duyệt",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await page
    .getByLabel("Doanh nghiệp", { exact: true })
    .selectOption("an-phat");
  await expect(
    page.getByRole("heading", { name: "Chưa có chứng từ phù hợp" }),
  ).toBeVisible();
});

test("mobile layout, keyboard dialogs and accessibility", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".financial-chart svg").first()).toBeVisible();
  const desktop = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    desktop.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await page.getByRole("link", { name: "Mua hàng", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mua hàng", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("tax navigation and document modal accessibility", async ({ page }) => {
  await page.goto("/tax?period=2026-08&company=an-phat");
  await page
    .getByRole("button", { name: "Hồ sơ & tờ khai", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Danh mục hồ sơ thuế" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xem hồ sơ", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText("Chưa có hồ sơ");
  const tax = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    tax.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Thêm nhanh" }).click();
  await page.getByRole("button", { name: "Phiếu thu", exact: true }).click();
  const form = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    form.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: "test-results/document-form.png" });
});

test("storage failure retains entered form, including Save and add", async ({
  page,
}) => {
  await page.goto("/cash");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Tạo chứng từ", exact: true }).click();
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
