import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("..", "docs", "assets", "one-year-simulation");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

async function capture(name, url, prepare) {
  await page.goto(`http://127.0.0.1:5173${url}`, { waitUntil: "networkidle" });
  if (prepare) await prepare(page);
  await page.screenshot({ path: path.join(output, name), fullPage: true });
}

await capture(
  "ui-dashboard.png",
  "/overview/overview?company=minh-an&period=2026-09",
);

await capture(
  "ui-cash-entry-form.png",
  "/cash/transactions?company=minh-an&period=2026-09",
  async (p) => {
    await p.getByRole("button", { name: /Thêm nhanh/i }).click();
    await p.getByRole("button", { name: /Thu tiền mặt/i, exact: true }).click();
    await p.getByLabel(/Đối tượng/i).fill("Khách hàng Minh Long");
    await p.getByLabel(/Diễn giải/i).fill("Thu tiền bán hàng tháng 09/2026");
    await p.getByLabel(/Nội dung dòng 1/i).fill("Thu công nợ hóa đơn GTGT");
    await p.getByLabel(/Số tiền dòng 1/i).fill("500000000");
  },
);

await capture(
  "ui-purchase-order.png",
  "/purchases/orders?company=minh-an&period=2026-09",
  async (p) => {
    await p.getByRole("button", { name: /Xem nhanh PO-2609-001/i }).click();
    await p.getByRole("button", { name: /Mở đầy đủ PO-2609-001/i }).click();
  },
);

await capture(
  "ui-ledger-process.png",
  "/ledger/process?company=minh-an&period=2026-09",
);

await capture(
  "ui-report-center.png",
  "/reports?company=minh-an&period=2026-09",
);

await browser.close();
