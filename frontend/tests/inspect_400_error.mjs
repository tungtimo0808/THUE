import { chromium } from "playwright";

const TARGET_URL = "http://13.140.177.110:2601";

async function inspect400Error() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  page.on("response", async (res) => {
    if (res.status() === 400) {
      const text = await res.text().catch(() => "");
      console.log(`\n>>> [API 400 BAD REQUEST]`);
      console.log(`URL: ${res.request().method()} ${res.url()}`);
      console.log(`Request Headers:`, res.request().headers());
      console.log(`Request PostData:`, res.request().postData());
      console.log(`Response Body: ${text}\n`);
    }
  });

  await page.goto(`${TARGET_URL}/login`, { waitUntil: "networkidle" });
  await page.fill("#auth-identifier", "superadmin@soviet.vn");
  await page.fill("#auth-password", "SuperAdmin@2026");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Navigate to company admin
  await page.goto(`${TARGET_URL}/company-admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Navigate to cash module
  await page.goto(`${TARGET_URL}/?module=cash`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  await browser.close();
}

inspect400Error().catch(console.error);
