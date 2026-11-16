import { chromium } from "playwright";
import path from "path";

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: path.resolve("frontend/tests/storageState.json"),
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:2601/invoices/process", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const footer = await page.$(".iw-process > footer");
  if (footer) {
    const html = await page.evaluate(el => el.outerHTML, footer);
    console.log("Footer HTML:\n", html);
    await footer.screenshot({ path: "actual_footer.png" });
  } else {
    console.log("No .iw-process > footer found!");
    const pageHtml = await page.evaluate(() => document.body.innerText);
    console.log("Page inner text:\n", pageHtml.slice(0, 500));
  }

  await page.screenshot({ path: "actual_invoices_page.png" });
  await browser.close();
}

inspect().catch(console.error);
