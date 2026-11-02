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

// Audit 2026-10-27 (P2): giới hạn số entry (LRU) và TTL để tab mở lâu không tích RAM vô hạn.
const API_LIST_CACHE_MAX_ENTRIES = 60;
const API_LIST_CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet(cacheKey: string): CacheEntry | undefined {
  const entry = apiListCache.get(cacheKey);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > API_LIST_CACHE_TTL_MS) {
    apiListCache.delete(cacheKey);
    return undefined;
  }
  // Refresh LRU order.
  apiListCache.delete(cacheKey);
  apiListCache.set(cacheKey, entry);
  return entry;
}

function cacheSet(cacheKey: string, data: ApiRow[]) {
  apiListCache.delete(cacheKey);
  apiListCache.set(cacheKey, { data, timestamp: Date.now() });
  while (apiListCache.size > API_LIST_CACHE_MAX_ENTRIES) {
    const oldestKey = apiListCache.keys().next().value;
    if (oldestKey === undefined) break;
    apiListCache.delete(oldestKey);
  }
}

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
    const cached = cacheGet(cacheKey);
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
      let changed = false;
      const next: Record<string, ApiRow[]> = { ...prev };
      for (const [name] of entries) {
        const nextVal = prev[name]?.length ? prev[name] : (cached[name] || []);
        if (next[name] !== nextVal) {
          next[name] = nextVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    const FRESH_SW_WINDOW_MS = 60_000;
    const entriesToFetch = entries.filter(([, path]) => {
      if (revision > 0) return true;
      const entry = apiListCache.get(`${companyId}::${path}`);
      if (!entry) return true;
      return Date.now() - entry.timestamp > FRESH_SW_WINDOW_MS;
    });

    if (entriesToFetch.length === 0) {
      return () => {
        active = false;
      };
    }

    // Fetch needed resources in parallel and commit in ONE batched setRows call to avoid 8-12 cascading re-renders
    void Promise.allSettled(
      entriesToFetch.map(async ([name, path]) => {
        const separator = path.includes("?") ? "&" : "?";
        let nextPath: string | null = `${path}${separator}company_id=${encodeURIComponent(companyId)}`;
        if (!nextPath.includes("page_size=")) {
          nextPath += "&page_size=100";
        }

        const collected: ApiRow[] = [];
        let pages = 0;
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
        return { name, path, collected };
      }),
    ).then((results) => {
      if (!active) return;
      const batchUpdates: Record<string, ApiRow[]> = {};
      let hasUpdates = false;

      for (let i = 0; i < results.length; i += 1) {
        const res = results[i];
        const [name, path] = entriesToFetch[i];
        if (res.status === "fulfilled") {
          cacheSet(`${companyId}::${path}`, res.value.collected);
          batchUpdates[name] = res.value.collected;
          hasUpdates = true;
        } else {
          const error = res.reason;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            apiListCache.delete(`${companyId}::${path}`);
            batchUpdates[name] = [];
            hasUpdates = true;
          } else {
            const hasData = (apiListCache.get(`${companyId}::${path}`)?.data.length ?? 0) > 0;
            if (!hasData) {
              notify(`${name}: ${error instanceof Error ? error.message : "lỗi tải dữ liệu"}`);
            }
          }
        }
      }

      if (hasUpdates) {
        setRows((prev) => ({
          ...prev,
          ...batchUpdates,
        }));
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
