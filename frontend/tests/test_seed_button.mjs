import { chromium } from "playwright";

const TARGET_URL = "http://13.140.177.110:2601";

async function testSeedRolesButton() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  page.on("console", msg => console.log("[CONSOLE]", msg.type(), msg.text()));
  page.on("response", async res => {
    if (res.url().includes("seed-standard") || res.url().includes("roles")) {
      const text = await res.text().catch(() => "");
      console.log(`[API ${res.status()}]`, res.url(), text.substring(0, 300));
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

  // Switch to Tab 3
  const tab3 = await page.$('button:has-text("Vai trò & Ma trận phân quyền")') || await page.$('text=3. Vai trò & Ma trận phân quyền');
  if (tab3) await tab3.click();
  await page.waitForTimeout(1000);

  // Click "Khởi tạo 6 vai trò mẫu"
  const seedBtn = await page.$('button:has-text("Khởi tạo 6 vai trò mẫu")');
  if (seedBtn) {
    console.log("Found 'Khởi tạo 6 vai trò mẫu' button, clicking...");
    await seedBtn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log("Could not find button 'Khởi tạo 6 vai trò mẫu'");
  }

  // Switch back to Tab 2 to see permissions
  const tab2 = await page.$('button:has-text("Nhân sự & Phân quyền")') || await page.$('text=2. Nhân sự & Phân quyền');
  if (tab2) await tab2.click();
  await page.waitForTimeout(2000);

  const permButtons = await page.$$eval('button:has-text("Quyền")', (btns) => btns.map((b) => b.innerText.trim()));
  console.log("Perm buttons after seeding attempt:", permButtons);

  await browser.close();
}

testSeedRolesButton().catch(console.error);
