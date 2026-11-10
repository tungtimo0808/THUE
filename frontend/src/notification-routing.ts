export function notificationRoute(link: string | undefined, companyId: string, period: string) {
  const base = "http://erp.local";
  const url = new URL(link || "/common?tab=notifications", base);
  if (url.origin !== base || !url.pathname.startsWith("/")) throw new Error("Liên kết thông báo không hợp lệ.");
  url.pathname = url.pathname.replace(/^(\/(?:cash|bank))\/advance-settlement-request\/?$/, "$1/advance-settlement");
  if (/^\/(?:cash|bank)\/(?:payment-requests|advance-settlement)\/?$/.test(url.pathname)
    && !url.searchParams.has("openDoc") && url.searchParams.get("document")) {
    url.searchParams.set("openDoc", url.searchParams.get("document")!);
  }
  url.searchParams.set("company", companyId);
  url.searchParams.set("period", period);
  return `${url.pathname}${url.search}${url.hash}`;
}
