export type Company = { id: string; code: string; name: string };
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

export async function request<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError("Không kết nối được backend. Hãy kiểm tra server ở cổng 8080.", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiError("Backend chưa sẵn sàng. Hãy đợi migrations hoàn tất rồi thử lại.", response.status);
    }
    const detail = body && typeof body === "object"
      ? Object.entries(body).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join("; ")
      : `Yêu cầu thất bại (HTTP ${response.status}).`;
    throw new ApiError(detail, response.status);
  }
  return body as T;
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
