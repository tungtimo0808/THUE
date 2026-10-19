import { expect, test } from "@playwright/test";

test("refreshes one expired session for concurrent API requests", async ({ page }) => {
  let refreshCalls = 0;
  await page.route("**/api/token/refresh/", async (route) => {
    refreshCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access: "new-token" }) });
  });
  await page.route("**/api/v1/test-session/**", async (route) => {
    const authorized = route.request().headers().authorization === "Bearer new-token";
    await route.fulfill({ status: authorized ? 200 : 401, contentType: "application/json",
      body: JSON.stringify(authorized ? { ok: true } : { code: "token_not_valid" }) });
  });
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    localStorage.setItem("erp_api_session", JSON.stringify({ token: "old-token", refresh: "refresh-token", companyId: "company-1" }));
    const { request } = await import("/src/live-api.ts");
    const rows = await Promise.all(Array.from({ length: 5 }, () => request<{ ok: boolean }>("/api/v1/test-session/", "old-token")));
    return { rows, session: JSON.parse(localStorage.getItem("erp_api_session") || "null") };
  });
  expect(result.rows).toEqual(Array.from({ length: 5 }, () => ({ ok: true })));
  expect(result.session.token).toBe("new-token");
  expect(result.session.refresh).toBe("refresh-token");
  expect(refreshCalls).toBe(1);
});

test("clears an expired session when the refresh token is invalid", async ({ page }) => {
  await page.route("**/api/token/refresh/", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "token_not_valid" }) });
  });
  await page.route("**/api/v1/test-session/**", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "token_not_valid" }) });
  });
  await page.goto("/login");
  const result = await page.evaluate(async () => {
    localStorage.setItem("erp_api_session", JSON.stringify({ token: "old-token", refresh: "expired-refresh" }));
    const { request } = await import("/src/live-api.ts");
    try {
      await request("/api/v1/test-session/", "old-token");
      return { status: 200, session: localStorage.getItem("erp_api_session") };
    } catch (error) {
      return { status: (error as { status?: number }).status, session: localStorage.getItem("erp_api_session") };
    }
  });
  expect(result).toEqual({ status: 401, session: null });
});
