import { request } from "./live-api";

export function getSelectedCompanyId(): string {
  try {
    const raw = localStorage.getItem("erp_api_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.companyId) return String(parsed.companyId);
    }
    return localStorage.getItem("erp_company_id") || "";
  } catch {
    return "";
  }
}

export function withCompanyId(path: string): string {
  const cid = getSelectedCompanyId();
  if (!cid || /[?&](company_id|company)=/.test(path)) return path;
  if (path.includes("/iam/platform/") || path.startsWith("/api/token/")) return path;
  return `${path}${path.includes("?") ? "&" : "?"}company_id=${encodeURIComponent(cid)}`;
}

function withCompanyBody(path: string, body: unknown): unknown {
  const cid = getSelectedCompanyId();
  if (
    !cid ||
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    body instanceof FormData ||
    path.includes("/iam/platform/") ||
    path.includes("/org/companies/")
  ) {
    return body;
  }
  const record = body as Record<string, unknown>;
  if ("company" in record || "company_id" in record) return body;
  return { company: cid, ...record };
}

export const apiClient = {
  get: <T = any>(path: string): Promise<T> => request<T>(withCompanyId(path)),
  post: <T = any>(path: string, body?: unknown): Promise<T> =>
    request<T>(withCompanyId(path), undefined, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(withCompanyBody(path, body)) : undefined,
    }),
  patch: <T = any>(path: string, body?: unknown): Promise<T> =>
    request<T>(withCompanyId(path), undefined, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(withCompanyBody(path, body)) : undefined,
    }),
  delete: <T = any>(path: string): Promise<T> =>
    request<T>(withCompanyId(path), undefined, {
      method: "DELETE",
    }),
};
