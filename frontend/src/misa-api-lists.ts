import { useEffect, useMemo, useState } from "react";
import { useApiSession } from "./ApiSession";
import { ApiError, request } from "./live-api";
import { createApiWriter, errorText, FormDataError, type ApiWriter } from "./misa-api-writes";

type ApiRow = Record<string, any>;
type ApiList = ApiRow[] | { results: ApiRow[]; next?: string | null };

interface CacheEntry {
  data: ApiRow[];
  timestamp: number;
}

const apiListCache = new Map<string, CacheEntry>();

const STATIC_CATALOG_PATTERNS = [
  "/general-ledger/accounts/",
  "/master-data/currencies/",
  "/organization/branches/",
  "/master-data/banks/",
  "/organization/employees/",
  "/master-data/company-bank-accounts/",
];

export function clearMisaApiCache(companyId?: string, onlyDynamic = false) {
  if (!companyId) {
    apiListCache.clear();
  } else {
    const prefix = `${companyId}::`;
    for (const key of apiListCache.keys()) {
      if (key.startsWith(prefix)) {
        if (onlyDynamic && STATIC_CATALOG_PATTERNS.some((p) => key.includes(p))) {
          continue; // Preserve static master data to avoid redundant 120KB re-fetch flood
        }
        apiListCache.delete(key);
      }
    }
  }
}

function getInitialRows(companyId: string, resources: Record<string, string>): Record<string, ApiRow[]> {
  const result: Record<string, ApiRow[]> = {};
  for (const [name, path] of Object.entries(resources)) {
    const cacheKey = `${companyId}::${path}`;
    const cached = apiListCache.get(cacheKey);
    result[name] = cached ? cached.data : [];
  }
  return result;
}

const isUuidCompany = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Read the existing module tables from the company-scoped backend with SWR in-memory caching. */
export function useMisaApiLists(
  companyId: string,
  resources: Record<string, string>,
  notify: (message: string) => void,
) {
  const { token } = useApiSession();
  const validCompany = Boolean(token && companyId && isUuidCompany(companyId));
  const key = useMemo(() => JSON.stringify(resources), [resources]);
  const [rows, setRows] = useState<Record<string, ApiRow[]>>(() => {
    return validCompany ? getInitialRows(companyId, JSON.parse(key)) : {};
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!validCompany) {
      setRows({});
      return;
    }
    let active = true;
    const resourceMap = JSON.parse(key) as Record<string, string>;
    const entries = Object.entries(resourceMap);

    // Hydrate immediately from cache if available so switching tabs has 0ms delay!
    const cached = getInitialRows(companyId, resourceMap);
    setRows((prev) => {
      const next: Record<string, ApiRow[]> = {};
      for (const [name] of entries) {
        next[name] = prev[name]?.length ? prev[name] : (cached[name] || []);
      }
      return next;
    });

    // Revalidate each resource in background progressively
    entries.forEach(async ([name, path]) => {
      const separator = path.includes("?") ? "&" : "?";
      let nextPath: string | null = `${path}${separator}company_id=${encodeURIComponent(companyId)}`;
      if (!nextPath.includes("page_size=")) {
        nextPath += "&page_size=100";
      }

      const collected: ApiRow[] = [];
      let pages = 0;
      try {
        while (nextPath && pages < 50) {
          if (!nextPath.includes("page_size=")) {
            nextPath += (nextPath.includes("?") ? "&" : "?") + "page_size=100";
          }
          const response: ApiList = await request<ApiList>(nextPath, token);
          collected.push(...(Array.isArray(response) ? response : response.results));
          if (Array.isArray(response) || !response.next) break;
          const nextUrl: URL = new URL(response.next, window.location.origin);
          nextPath = `${nextUrl.pathname}${nextUrl.search}`;
          pages += 1;
        }

        if (!active) return;
        apiListCache.set(`${companyId}::${path}`, { data: collected, timestamp: Date.now() });
        setRows((prev) => ({
          ...prev,
          [name]: collected,
        }));
      } catch (error) {
        if (!active) return;
        if (!(error instanceof ApiError && error.status === 401)) {
          const hasData = (apiListCache.get(`${companyId}::${path}`)?.data.length ?? 0) > 0;
          if (!hasData) {
            notify(`${name}: ${error instanceof Error ? error.message : "lỗi tải dữ liệu"}`);
          }
        }
      }
    });

    return () => {
      active = false;
    };
  }, [token, companyId, key, revision]);

  return {
    rows,
    connected: validCompany,
    reload: () => {
      clearMisaApiCache(companyId);
      setRevision((value) => value + 1);
    },
  };
}

/**
 * Saves a form through the backend: each call gets a fresh writer (fresh catalog lookups),
 * reports the outcome, clears stale cache and reloads the tables. Resolves false when nothing was saved.
 */
export function useMisaApiSave(companyId: string, notify: (message: string) => void, reload: () => void) {
  const { token } = useApiSession();
  return async (save: (writer: ApiWriter) => Promise<{ message: string; record?: any } | any>): Promise<any> => {
    if (!token || !companyId) return false;
    try {
      const result = await save(createApiWriter(companyId, (path, init) => request(path, token, init)));
      clearMisaApiCache(companyId, true);
      notify(result?.message || "Đã lưu thành công.");
      reload();
      return result || true;
    } catch (error) {
      notify(error instanceof FormDataError ? error.message : `Không lưu được: ${errorText(error)}`);
      return false;
    }
  };
}

export function apiDate(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const date = value.slice(0, 10).split("-");
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
}

export function apiNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Items only carry the unit id; resolve its display name from the loaded unit list. */
export function apiUnitName(units: Record<string, any>[] | undefined, id: unknown) {
  const unit = units?.find((row) => row.id === id);
  return unit ? unit.symbol || unit.name || unit.code || "" : "";
}
