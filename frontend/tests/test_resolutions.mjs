import { chromium } from "playwright";
import path from "path";

async function testResolutions() {
  const browser = await chromium.launch({ headless: true });
  const resolutions = [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  const urls = [
    "/cash/process",
    "/purchases/process",
    "/ledger/process",
  ];

  let allPass = true;

  for (const res of resolutions) {
    console.log(`\n--- Testing Resolution: ${res.width}x${res.height} ---`);
    const context = await browser.newContext({
      storageState: path.resolve("FRONTEND/tests/storageState.json"),
      viewport: res,
    });
    const page = await context.newPage();

    for (const u of urls) {
      await page.goto("http://127.0.0.1:2601" + u, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);

      const metrics = await page.evaluate(() => {
        const main = document.querySelector("#reference-main, .ref-main");
        return {
          windowHeight: window.innerHeight,
          docScrollHeight: document.documentElement.scrollHeight,
          mainScrollHeight: main?.scrollHeight,
          mainClientHeight: main?.clientHeight,
          isScrollable: document.documentElement.scrollHeight > window.innerHeight || (main && main.scrollHeight > main.clientHeight),
        };
      });

      console.log(`[${res.width}x${res.height}] ${u}: isScrollable = ${metrics.isScrollable} (doc: ${metrics.docScrollHeight}/${metrics.windowHeight}, main: ${metrics.mainScrollHeight}/${metrics.mainClientHeight})`);
      if (metrics.isScrollable) allPass = false;
    }
    await context.close();
  }

  await browser.close();
  console.log("\nALL RESOLUTIONS PASS:", allPass);
}

testResolutions();
