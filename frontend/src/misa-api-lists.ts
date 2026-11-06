import { useEffect, useMemo, useState } from "react";
import { useApiSession } from "./ApiSession";
import { ApiError, request } from "./live-api";
import { createApiWriter, errorText, FormDataError, type ApiWriter } from "./misa-api-writes";
import { resolveActiveDatasetBookType, resolveActiveDatasetYear } from "./transaction-period";

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

function getActiveBranchScope(): string {
  try {
    const val = (localStorage.getItem("ref_branch") || "all").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) ? val : "all";
  } catch {
    return "all";
  }
}

function getActiveDatasetScope(): string {
  try {
    const ds = (localStorage.getItem("ref_dataset") || "accounting-2026").trim();
    const urlPeriod = new URLSearchParams(window.location.search).get("period") || "";
    return `${ds}::${urlPeriod}`;
  } catch {
    return "accounting-2026::";
  }
}

const CATALOG_PATH_PATTERNS = [
  ...STATIC_CATALOG_PATTERNS,
  "/master-data/",
  "/organization/",
  "/inventory/warehouses/",
  "/inventory/item-categories/",
  "/payroll/salary-components/",
];

const ROW_DATE_FIELDS = [
  "posting_date",
  "document_date",
  "transaction_date",
  "invoice_date",
  "issue_date",
  "disbursement_date",
  "period_start",
  "start_date",
  "voucher_date",
  "order_date",
  "quotation_date",
  "contract_date",
];

function filterRowsForDataset(path: string, rawRows: ApiRow[], branchScope: string): ApiRow[] {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return rawRows;
  if (CATALOG_PATH_PATTERNS.some((p) => path.includes(p))) {
    return rawRows;
  }
  const activeYear = resolveActiveDatasetYear();
  const bookType = resolveActiveDatasetBookType();

  return rawRows.filter((row) => {
    if (!row || typeof row !== "object") return true;

    // 0. Check branch scope if row explicitly embeds branch UUID
    if (branchScope && branchScope !== "all") {
      const rowBranch = row.branch || row.branch_id;
      if (typeof rowBranch === "string" && rowBranch.length >= 30 && rowBranch !== branchScope) {
        return false;
      }
    }

    // 1. Check bookType: exclude QT- internal management vouchers when on financial/tax book
    const docNum = String(row.number || row.voucher_no || row.invoice_number || row.code || "").trim().toUpperCase();
    if (bookType === "accounting" && docNum.startsWith("QT-")) {
      return false;
    }

    // 2. Check explicit fiscal_year field if present
    if (typeof row.fiscal_year === "number" && row.fiscal_year >= 2000 && row.fiscal_year <= 2100) {
      return row.fiscal_year === activeYear;
    }

    // 3. Check date fields
    for (const field of ROW_DATE_FIELDS) {
      const val = row[field];
      if (typeof val === "string" && val.length >= 4) {
        const yrMatch = val.match(/^(20\d{2})/) || val.match(/\/(20\d{2})$/);
        if (yrMatch) {
          return Number(yrMatch[1]) === activeYear;
        }
      }
    }

    // 4. Fallback: check if document number embeds a year like BH-2025-001 or GL-2024-001
    const numYrMatch = docNum.match(/\b(202[0-9])\b/) || docNum.match(/-(202[0-9])-/);
    if (numYrMatch) {
      return Number(numYrMatch[1]) === activeYear;
    }

    return true;
  });
}

function getInitialRows(companyId: string, branchScope: string, resources: Record<string, string>): Record<string, ApiRow[]> {
  const result: Record<string, ApiRow[]> = {};
  for (const [name, path] of Object.entries(resources)) {
    const isGlobalCatalog = STATIC_CATALOG_PATTERNS.some((p) => path.includes(p) && !path.includes("/employees/"));
    const scopeKey = isGlobalCatalog ? "all" : branchScope;
    const cacheKey = `${companyId}::${scopeKey}::${path}`;
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
  const [branchScope, setBranchScope] = useState<string>(() => getActiveBranchScope());
  const [datasetScope, setDatasetScope] = useState<string>(() => getActiveDatasetScope());
  const [rows, setRows] = useState<Record<string, ApiRow[]>>(() => {
    return validCompany ? getInitialRows(companyId, getActiveBranchScope(), JSON.parse(key)) : {};
  });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const handleContextChange = () => {
      const nextBranch = getActiveBranchScope();
      const nextDataset = getActiveDatasetScope();
      setDatasetScope(nextDataset);
      setBranchScope((prev) => {
        if (prev !== nextBranch) {
          setRevision((r) => r + 1);
        }
        return nextBranch;
      });
    };
    window.addEventListener("erp_context_changed", handleContextChange);
    window.addEventListener("popstate", handleContextChange);
    return () => {
      window.removeEventListener("erp_context_changed", handleContextChange);
      window.removeEventListener("popstate", handleContextChange);
    };
  }, []);

  useEffect(() => {
    if (!validCompany) {
      setRows({});
      return;
    }
    let active = true;
    const resourceMap = JSON.parse(key) as Record<string, string>;
    const entries = Object.entries(resourceMap);

    // Hydrate immediately from cache if available so switching tabs has 0ms delay!
    const cached = getInitialRows(companyId, branchScope, resourceMap);
    setRows(cached);

    const FRESH_SW_WINDOW_MS = 60_000;
    const entriesToFetch = entries.filter(([, path]) => {
      if (revision > 0) return true;
      const isGlobalCatalog = STATIC_CATALOG_PATTERNS.some((p) => path.includes(p) && !path.includes("/employees/"));
      const scopeKey = isGlobalCatalog ? "all" : branchScope;
      const entry = apiListCache.get(`${companyId}::${scopeKey}::${path}`);
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
        const isGlobalCatalog = STATIC_CATALOG_PATTERNS.some((p) => path.includes(p) && !path.includes("/employees/"));
        const scopeKey = isGlobalCatalog ? "all" : branchScope;
        const separator = path.includes("?") ? "&" : "?";
        let nextPath: string | null = `${path}${separator}company_id=${encodeURIComponent(companyId)}`;
        if (scopeKey !== "all" && !nextPath.includes("branch_id=")) {
          nextPath += `&branch_id=${encodeURIComponent(scopeKey)}`;
        }
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
        return { name, path, scopeKey, collected };
      }),
    ).then((results) => {
      if (!active) return;
      const batchUpdates: Record<string, ApiRow[]> = {};
      let hasUpdates = false;

      for (let i = 0; i < results.length; i += 1) {
        const res = results[i];
        const [name, path] = entriesToFetch[i];
        const isGlobalCatalog = STATIC_CATALOG_PATTERNS.some((p) => path.includes(p) && !path.includes("/employees/"));
        const scopeKey = isGlobalCatalog ? "all" : branchScope;
        if (res.status === "fulfilled") {
          cacheSet(`${companyId}::${scopeKey}::${path}`, res.value.collected);
          batchUpdates[name] = res.value.collected;
          hasUpdates = true;
        } else {
          const error = res.reason;
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            apiListCache.delete(`${companyId}::${scopeKey}::${path}`);
            batchUpdates[name] = [];
            hasUpdates = true;
          } else {
            const hasData = (apiListCache.get(`${companyId}::${scopeKey}::${path}`)?.data.length ?? 0) > 0;
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
  }, [token, companyId, branchScope, key, revision]);

  const datasetFilteredRows = useMemo(() => {
    const resourceMap = JSON.parse(key) as Record<string, string>;
    const out: Record<string, ApiRow[]> = {};
    for (const [name, rawList] of Object.entries(rows)) {
      const path = resourceMap[name] || "";
      out[name] = filterRowsForDataset(path, rawList, branchScope);
    }
    return out;
  }, [rows, key, datasetScope, branchScope]);

  return {
    rows: datasetFilteredRows,
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
