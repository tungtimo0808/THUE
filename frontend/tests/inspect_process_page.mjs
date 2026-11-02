import { chromium } from "playwright";
import path from "path";

async function inspectProcess() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.resolve("FRONTEND/tests/storageState.json"),
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const urls = [
    "/cash/process",
    "/bank/process",
    "/purchase/process",
    "/sales/process",
    "/inventory/process",
    "/ledger/process"
  ];

  for (const u of urls) {
    await page.goto("http://127.0.0.1:2601" + u, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const scrollInfo = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const main = document.querySelector("#reference-main, .ref-main");
      const wrapper = document.querySelector(".ref-process-wrapper, [class*='process']");

      return {
        url: window.location.pathname,
        windowInnerHeight: window.innerHeight,
        bodyScrollHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        mainScrollHeight: main?.scrollHeight,
        mainClientHeight: main?.clientHeight,
        wrapperScrollHeight: wrapper?.scrollHeight,
        wrapperClientHeight: wrapper?.clientHeight,
        canScrollWindow: body.scrollHeight > window.innerHeight,
      };
    });

    console.log(u, scrollInfo);
    await page.screenshot({ path: `FRONTEND/tests/screenshots/flow/inspect_${u.replace(/\//g, '_')}.png` });
  }

  await browser.close();
}

inspectProcess();
