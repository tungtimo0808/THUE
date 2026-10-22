export type Company = {
  id: string;
  code: string;
  name: string;
  status?: string;
  tax_code?: string;
  legal_representative?: string;
  accounting_regime?: string;
  address?: string;
};
export type Customer = {
  id: string;
  code: string;
  name: string;
  tax_code: string | null;
  party_type: string;
  status: string;
  legal_name: string;
  version: number;
};

export type CustomerInput = {
  code: string;
  name: string;
  party_type: string;
  legal_name: string;
  tax_code: string;
};

type ListResponse<T> = T[] | { results: T[] };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
let refreshInFlight: Promise<string | null> | null = null;

function storedSession(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("erp_api_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function expireSession(staleToken?: string) {
  const current = storedSession();
  if (staleToken && current && (current.token || current.access) !== staleToken) return;
  localStorage.removeItem("erp_api_session");
  localStorage.removeItem("erp_token");
  localStorage.removeItem("erp_refresh");
  localStorage.removeItem("erp_company_id");
  window.dispatchEvent(new Event("erp_api_session_expired"));
  window.dispatchEvent(new Event("erp_session_expired"));
}

export async function renewAccessToken(staleToken?: string): Promise<string | null> {
  const current = storedSession();
  const latestToken = current?.token || current?.access || localStorage.getItem("erp_token");
  if (staleToken && latestToken && latestToken !== staleToken) return latestToken;
  const refresh = current?.refresh || localStorage.getItem("erp_refresh");
  if (!refresh) {
    if (staleToken) expireSession(staleToken);
    return null;
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/token/refresh/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) throw new Error("Token refresh failed");
        const body = (await response.json()) as { access?: string; refresh?: string };
        if (!body.access) throw new Error("Missing access token");
        const session = storedSession();
        const next = {
          ...(session || {}),
          token: body.access,
          access: body.access,
          access_token: body.access,
          refresh: body.refresh || refresh,
        };
        localStorage.setItem("erp_api_session", JSON.stringify(next));
        localStorage.setItem("erp_token", body.access);
        if (body.refresh) localStorage.setItem("erp_refresh", body.refresh);
        window.dispatchEvent(new CustomEvent("erp_api_token_changed", { detail: next }));
        window.dispatchEvent(new CustomEvent("erp_token_updated", { detail: { token: body.access } }));
        return body.access;
      } catch {
        if (staleToken) expireSession(staleToken);
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function refreshAccessToken(): Promise<string> {
  const token = await renewAccessToken();
  if (!token) throw new Error("Refresh failed");
  return token;
}

const inFlightRequests = new Map<string, Promise<any>>();

export async function request<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const isGet = method === "GET";
  const effectiveToken = token || localStorage.getItem("erp_token") || "";
  const dedupeKey = isGet ? `${path}::${effectiveToken}` : null;

  if (dedupeKey && inFlightRequests.has(dedupeKey)) {
    return inFlightRequests.get(dedupeKey)! as Promise<T>;
  }

  const exec = (async (): Promise<T> => {
    let response: Response;
    const initialToken = token || localStorage.getItem("erp_token") || undefined;
    try {
      const fetchWithToken = (access?: string) =>
        fetch(path, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
        });
      response = await fetchWithToken(initialToken);
      if (response.status === 401 && !path.startsWith("/api/token/")) {
        const renewed = await renewAccessToken(initialToken);
        if (!renewed) throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
        response = await fetchWithToken(renewed);
        if (response.status === 401) {
          expireSession(renewed);
          throw new ApiError(SESSION_EXPIRED_MESSAGE, 401);
        }
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("Không kết nối được backend. Hãy kiểm tra server ở cổng 8080.", 0);
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if ([502, 503, 504].includes(response.status)) {
        throw new ApiError("Backend chưa sẵn sàng. Hãy đợi migrations hoàn tất rồi thử lại.", response.status);
      }
      if (response.status === 401) {
        throw new ApiError("Tài khoản hoặc mật khẩu không chính xác, hoặc phiên làm việc đã hết hạn.", 401);
      }
      const detail = body && typeof body === "object"
        ? Object.entries(body).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : (typeof value === "object" ? JSON.stringify(value) : String(value))}`).join("; ")
        : `Yêu cầu thất bại (HTTP ${response.status}).`;
      throw new ApiError(detail, response.status);
    }
    return body as T;
  })();

  if (dedupeKey) {
    inFlightRequests.set(dedupeKey, exec);
    exec.finally(() => {
      inFlightRequests.delete(dedupeKey);
    });
  }

  return exec;
}

function rows<T>(response: ListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.results;
}

export async function login(email: string, password: string): Promise<{ access: string; refresh: string }> {
  const result = await request<{ access: string; refresh: string }>("/api/token/", undefined, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!result.access) throw new ApiError("BE không trả về access token.", 200);
  return result;
}

export async function logout(refresh: string): Promise<void> {
  await request<null>("/api/v1/common/auth/logout/", undefined, {
    method: "POST", body: JSON.stringify({ refresh }),
  });
}

export async function getCompanies(token: string): Promise<Company[]> {
  return rows(await request<ListResponse<Company>>("/api/v1/common/companies/mine/", token));
}

export async function getCustomers(token: string, companyId: string, signal?: AbortSignal): Promise<Customer[]> {
  const query = new URLSearchParams({ company_id: companyId });
  return rows(await request<ListResponse<Customer>>(
    `/api/v1/master-data/customers/?${query}`,
    token,
    { signal },
  ));
}

export async function createCustomer(token: string, companyId: string, input: CustomerInput): Promise<Customer> {
  return request<Customer>(`/api/v1/master-data/customers/?company_id=${encodeURIComponent(companyId)}`, token, {
    method: "POST",
    body: JSON.stringify({ ...input, company: companyId, tax_code: input.tax_code || null }),
  });
}

export async function updateCustomer(token: string, companyId: string, customer: Customer, input: CustomerInput): Promise<Customer> {
  return request<Customer>(`/api/v1/master-data/customers/${customer.id}/?company_id=${encodeURIComponent(companyId)}`, token, {
    method: "PATCH",
    body: JSON.stringify({ ...input, tax_code: input.tax_code || null, version: customer.version }),
  });
}

export async function setCustomerStatus(token: string, companyId: string, customer: Customer, status: string, reason: string): Promise<Customer> {
  return request<Customer>(`/api/v1/master-data/customers/${customer.id}/set-status/?company_id=${encodeURIComponent(companyId)}`, token, {
    method: "POST",
    body: JSON.stringify({ status, reason, version: customer.version }),
  });
}

export async function deleteCustomer(token: string, companyId: string, customerId: string): Promise<void> {
  await request<null>(`/api/v1/master-data/customers/${customerId}/?company_id=${encodeURIComponent(companyId)}`, token, { method: "DELETE" });
}

export async function mergeCustomers(token: string, companyId: string, targetId: string, sourceId: string, reason: string): Promise<Customer> {
  return request<Customer>(`/api/v1/master-data/customers/${targetId}/merge/?company_id=${encodeURIComponent(companyId)}`, token, {
    method: "POST", body: JSON.stringify({ source_id: sourceId, reason, conflict_resolutions: {} }),
  });
}

export async function getCustomerDebtSummary(token: string, companyId: string, customerId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/master-data/customers/${customerId}/debt-summary/?company_id=${encodeURIComponent(companyId)}`, token);
}

export type DuplicateCustomer = { id: string; code: string; name: string; match_reasons: string[]; is_hard_duplicate: boolean };

export async function checkCustomerDuplicates(token: string, companyId: string, input: CustomerInput, excludeId?: string): Promise<DuplicateCustomer[]> {
  const query = new URLSearchParams({ company_id: companyId });
  if (input.code) query.set("code", input.code);
  if (input.name) query.set("name", input.name);
  if (input.tax_code) query.set("tax_code", input.tax_code);
  if (excludeId) query.set("exclude_id", excludeId);
  return request<DuplicateCustomer[]>(`/api/v1/master-data/customers/duplicates/?${query}`, token);
}

export async function exportCustomers(token: string, companyId: string): Promise<Blob> {
  const response = await fetch(`/api/v1/master-data/customers/export/?company_id=${encodeURIComponent(companyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new ApiError(`Không xuất được CSV (HTTP ${response.status}).`, response.status);
  return response.blob();
}

export type ImportResult = { preview: boolean; results: Array<{ row: number; code: string; status?: string; error?: unknown }> };

export async function importCustomers(token: string, companyId: string, file: File, preview: boolean): Promise<ImportResult> {
  const data = new FormData();
  data.append("file", file);
  data.append("preview", String(preview));
  const response = await fetch(`/api/v1/master-data/customers/import/?company_id=${encodeURIComponent(companyId)}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: data,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(JSON.stringify(body) || `Không nhập được CSV (HTTP ${response.status}).`, response.status);
  return body as ImportResult;
}
