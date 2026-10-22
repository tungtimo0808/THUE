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

export const apiClient = {
  get: <T = any>(path: string): Promise<T> => request<T>(path),
  post: <T = any>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, undefined, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, undefined, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(path: string): Promise<T> =>
    request<T>(path, undefined, {
      method: "DELETE",
    }),
};

