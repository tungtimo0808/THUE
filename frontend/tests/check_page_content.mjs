import { chromium } from "playwright";

const TARGET_URL = "http://13.140.177.110:2601";

async function inspectContent() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#auth-identifier", "superadmin@soviet.vn");
  await page.fill("#auth-password", "SuperAdmin@2026");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Click ABC
  const abcBtn = await page.$("text=CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC");
  if (abcBtn) await abcBtn.click();
  await page.waitForTimeout(3000);

  console.log("URL after company:", page.url());

  // Go to cash
  await page.goto(`${TARGET_URL}/?module=cash`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("URL on cash:", page.url());
  const bodyTextCash = await page.evaluate(() => document.body.innerText.substring(0, 600));
  console.log("Cash page text:\n", bodyTextCash);

  // Go to sales
  await page.goto(`${TARGET_URL}/?module=sales`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  console.log("URL on sales:", page.url());
  const bodyTextSales = await page.evaluate(() => document.body.innerText.substring(0, 600));
  console.log("Sales page text:\n", bodyTextSales);

  await browser.close();
}

inspectContent().catch(console.error);

