import { chromium } from "@playwright/test";

async function testDisassembly() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  page.on("console", msg => console.log("[CONSOLE]", msg.type(), msg.text()));
  page.on("pageerror", err => console.log("[PAGE ERROR]", err));

  await page.goto("http://127.0.0.1:2601/login", { waitUntil: "networkidle" });
  
  const allInputs = await page.$$("input");
  let usernameInput = null;
  let passwordInput = null;

  for (const input of allInputs) {
    const type = await input.getAttribute("type");
    if (type === "password") {
      passwordInput = input;
    } else if (type === "text" || type === "email" || !type) {
      if (!usernameInput) usernameInput = input;
    }
  }

  await usernameInput.fill("admin");
  await passwordInput.fill("Admin@123456");
  const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Đăng nhập")');
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // Navigate to inventory assembly tab
  await page.goto("http://127.0.0.1:2601/inventory/assembly", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Click "Thêm lệnh tháo dỡ"
  const addBtn = await page.$('button:has-text("Thêm lệnh tháo dỡ")');
  await addBtn.click();
  await page.waitForTimeout(1000);

  // Find inputs for item codes
  const allCodeInputs = await page.$$('input[placeholder="Chọn mã hàng"]');
  console.log("Total 'Chọn mã hàng' inputs found:", allCodeInputs.length);
  
  // Left: BLV-001
  await allCodeInputs[0].fill("BLV-001");
  await allCodeInputs[0].dispatchEvent("change");
  await page.waitForTimeout(300);

  // Right 1: LT_MBAIR
  await allCodeInputs[1].fill("LT_MBAIR");
  await allCodeInputs[1].dispatchEvent("change");
  await page.waitForTimeout(300);

  // Right 2: LT_HP15S
  await allCodeInputs[2].fill("LT_HP15S");
  await allCodeInputs[2].dispatchEvent("change");
  await page.waitForTimeout(300);

  // Click "Lưu"
  const saveBtn = await page.$('button:has-text("Lưu")');
  console.log("Clicking 'Lưu'...");
  await saveBtn.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "../disassembly_valid_save.png" });
  console.log("Screenshot saved to disassembly_valid_save.png");

  // Check if modal closed
  const modalVisible = await page.$('h2:has-text("Lệnh tháo dỡ")');
  console.log("Modal still visible?", !!modalVisible);

  await browser.close();
}

testDisassembly().catch(console.error);
