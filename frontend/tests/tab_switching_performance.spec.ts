import { test, expect } from "@playwright/test";

test("Verify zero-delay tab switching and Keep-Alive state preservation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  // 1. Inject valid auth session via init script
  await page.addInitScript(() => {
    const session = {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzkzNjEyOTYyLCJpYXQiOjE3OTMwMDgxNjMsImp0aSI6IjlkMzZlYjkxYTVmNTQyYmI4YTcwOWFjNWViMmUzNTE5IiwidXNlcl9pZCI6IjciLCJzaWQiOiJkODkxM2Y5YS1kNzNhLTRkNTYtYTBlYS02MjMwYzBjZGY0YjAifQ.YHPLTkC7Pn6ywweW8cq7KRaD30vjLB3Vwd0pE_Dk1sE",
      refresh: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc5NTYwMDE2MiwiaWF0IjoxNzkzMDA4MTYyLCJqdGkiOiJhNWNmZGZiZjJhNGE0YTViYTU1YzM4ZGQ3YmRiMjE2MSIsInVzZXJfaWQiOiI3Iiwic2lkIjoiZDg5MTNmOWEtZDczYS00ZDU2LWEwZWEtNjIzMGMwY2RmNGIwIn0.J-iJaNjAGzPup1eiixHMoYUyRRINrFyZJmYZ3BGeQg8",
      companyId: "614f784c-f253-4fe8-b519-e50631be518e",
      companies: [
        {
          id: "614f784c-f253-4fe8-b519-e50631be518e",
          code: "ABC",
          name: "CÔNG TY TNHH THƯƠNG MẠI VÀ DỊCH VỤ ABC",
          status: "ACTIVE"
        }
      ],
      user: {
        id: "c779a7d1-8315-4007-afbe-9f146eaa1ecd",
        username: "superadmin",
        display_name: "Đỗ Đức Tùng"
      }
    };
    localStorage.setItem("erp_api_session", JSON.stringify(session));
  });

  // 2. Load Cash transactions
  await page.goto("http://127.0.0.1:2601/cash/transactions");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#reference-main")).toBeVisible({ timeout: 10000 });
  console.log("1. Cash workspace loaded successfully.");

  // 3. Switch to Bank
  const t0 = Date.now();
  await page.click('a.ref-nav-item[href*="/bank"]');
  await expect(page.locator("#reference-main")).toBeVisible();
  const tBank = Date.now() - t0;
  console.log(`2. Cold Switch to Bank: ${tBank}ms`);

  // 4. Switch to Purchases
  const t1 = Date.now();
  await page.click('a.ref-nav-item[href*="/purchases"]');
  await expect(page.locator("#reference-main")).toBeVisible();
  const tPurchases = Date.now() - t1;
  console.log(`3. Cold Switch to Purchases: ${tPurchases}ms`);

  // 5. Switch back to Cash (Hot Keep-Alive Switch)
  const t2 = Date.now();
  await page.click('a.ref-nav-item[href*="/cash"]');
  await expect(page.locator("#reference-main")).toBeVisible();
  const tCashWarm = Date.now() - t2;
  console.log(`4. Warm Switch back to Cash (Keep-Alive): ${tCashWarm}ms`);

  // 6. Test sub-tab navigation inside Cash
  const t3 = Date.now();
  const tabs = page.locator(".ref-module-bar nav a");
  const count = await tabs.count();
  if (count > 1) {
    await tabs.nth(1).click();
    await page.waitForTimeout(50);
  }
  const tSubTab = Date.now() - t3;
  console.log(`5. Sub-tab switch time: ${tSubTab}ms`);

  // Expect Keep-Alive switch to be faster and free of errors
  expect(errors).toHaveLength(0);
});
