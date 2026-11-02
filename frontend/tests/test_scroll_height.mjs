import { chromium } from "playwright";
import path from "path";

async function testScroll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.resolve("FRONTEND/tests/storageState.json"),
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  const urls = [
    "/cash/process",
    "/bank/process",
    "/purchases/process",
    "/sales/process",
    "/inventory/process",
    "/payroll/process",
    "/tools/process",
    "/assets/process",
    "/cost/process",
    "/ledger/process",
  ];

  for (const u of urls) {
    await page.goto("http://127.0.0.1:2601" + u, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    const metrics = await page.evaluate(() => {
      const main = document.querySelector("#reference-main, .ref-main");
      return {
        path: window.location.pathname,
        windowHeight: window.innerHeight,
        bodyScrollHeight: document.body.scrollHeight,
        docScrollHeight: document.documentElement.scrollHeight,
        mainScrollHeight: main?.scrollHeight,
        mainClientHeight: main?.clientHeight,
        isScrollable: document.documentElement.scrollHeight > window.innerHeight || (main && main.scrollHeight > main.clientHeight),
      };
    });

    console.log(u, metrics);
    await page.screenshot({ path: `FRONTEND/tests/screenshots/flow/scroll_768_${u.replace(/\//g, '_')}.png` });
  }

  await browser.close();
}

testScroll();
