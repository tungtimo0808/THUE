/**
 * Read-Only Instant Hydration & Predictive Company Pre-Warming Engine.
 *
 * Guarantees:
 * 1. 100% READ-ONLY (GET requests only) — NEVER writes to or modifies PostgreSQL / backend state.
 * 2. Strict tenant & user isolation: every snapshot key embeds tokenScope + companyId.
 * 3. Instant 0ms Frame-1 hydration via synchronous memory + storage snapshots, paired with
 *    background Stale-While-Revalidate (SWR) and immediate invalidation on any API mutation.
 */

import { request } from "./live-api";
import {
  createApiWriter,
  fetchDashboardConfigUcRpt01,
  fetchDashboardOverviewUcRpt01,
} from "./misa-api-writes";
import { preloadWorkspace } from "./workspace-preloader";

const WARM_PREFIX = "sv_warm_v2:";
const MAX_LOCAL_SNAPSHOT_CHARS = 180_000;
const DEFAULT_WARM_TTL_MS = 15 * 60 * 1000; // 15 minutes (always SWR-revalidated in background)

interface WarmEntry<T = any> {
  data: T;
  ts: number;
}

const warmMemoryMap = new Map<string, WarmEntry>();
const inFlightWarmPromises = new Map<string, Promise<void>>();

/** Derive a short non-sensitive scope fingerprint from JWT access token so users never share cache. */
export function getTokenScope(token?: string | null): string {
  const raw = (token || "").trim();
  if (!raw) {
    try {
      const stored = localStorage.getItem("erp_token") || "";
      if (stored) return stored.slice(-12);
      const sess = JSON.parse(localStorage.getItem("erp_api_session") || "{}");
      const t = String(sess?.token || sess?.access || "");
      return t ? t.slice(-12) : "anon";
    } catch {
      return "anon";
    }
  }
  return raw.slice(-12);
}

export function buildDashboardConfigWarmKey(token: string, companyId: string): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}dash_cfg:${getTokenScope(token)}:${companyId}`;
}

export function buildDashboardOverviewWarmKey(
  token: string,
  companyId: string,
  period: string,
  branchId: string,
  comparisonMode: string,
  revenueBasis: string,
): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}dash_ovr:${getTokenScope(token)}:${companyId}:${period || "2026-12"}:${branchId || "all"}:${comparisonMode || "PREVIOUS_PERIOD"}:${revenueBasis || "GL"}`;
}

export function buildBranchesWarmKey(token: string, companyId: string): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}branches:${getTokenScope(token)}:${companyId}`;
}

export function buildAdminWarmKey(token: string, companyId: string): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}admin:${getTokenScope(token)}:${companyId}`;
}

export function buildCashWarmKey(token: string, companyId: string, branchScope: string): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}cash:${getTokenScope(token)}:${companyId}:${branchScope || "all"}`;
}

export function buildBankWarmKey(token: string, companyId: string, branchScope: string): string {
  if (!companyId) return "";
  return `${WARM_PREFIX}bank:${getTokenScope(token)}:${companyId}:${branchScope || "all"}`;
}

export function buildListWarmKey(token: string, companyId: string, scopeKey: string, path: string): string {
  if (!companyId || !path) return "";
  return `${WARM_PREFIX}list:${getTokenScope(token)}:${companyId}:${scopeKey || "all"}:${path}`;
}

export function readWarmSnapshot<T = any>(key: string, maxAgeMs = DEFAULT_WARM_TTL_MS): T | null {
  if (!key) return null;
  const now = Date.now();
  const mem = warmMemoryMap.get(key);
  if (mem && now - mem.ts <= maxAgeMs) {
    return mem.data as T;
  }

  for (const storage of [
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
    typeof localStorage !== "undefined" ? localStorage : null,
  ]) {
    if (!storage) continue;
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as WarmEntry<T>;
      if (parsed && typeof parsed.ts === "number" && now - parsed.ts <= maxAgeMs) {
        warmMemoryMap.set(key, parsed);
        return parsed.data;
      }
      storage.removeItem(key);
    } catch {
      // Ignore storage read errors
    }
  }
  return null;
}

export function writeWarmSnapshot<T = any>(key: string, data: T): void {
  if (!key || data === undefined) return;
  const entry: WarmEntry<T> = { data, ts: Date.now() };
  warmMemoryMap.set(key, entry);
  // Cap memory entries
  if (warmMemoryMap.size > 160) {
    const firstKey = warmMemoryMap.keys().next().value;
    if (firstKey) warmMemoryMap.delete(firstKey);
  }

  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > MAX_LOCAL_SNAPSHOT_CHARS) return;
    try {
      sessionStorage.setItem(key, serialized);
    } catch {
      pruneStorageByPrefix(sessionStorage, WARM_PREFIX);
    }
    try {
      localStorage.setItem(key, serialized);
    } catch {
      pruneStorageByPrefix(localStorage, WARM_PREFIX);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        // Ignore if quota remains full
      }
    }
  } catch {
    // Ignore serialization errors
  }
}

function pruneStorageByPrefix(storage: Storage, prefix: string, companyFilter?: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      if (!companyFilter || k.includes(`:${companyFilter}`)) {
        keys.push(k);
      }
    }
    for (const k of keys) storage.removeItem(k);
  } catch {
    // Ignore storage errors
  }
}

/** Clear warm snapshots on logout or after writes when strict freshness is required. */
export function clearWarmSnapshots(companyId?: string, preserveStaticBranches = false): void {
  for (const k of Array.from(warmMemoryMap.keys())) {
    if (preserveStaticBranches && k.startsWith(`${WARM_PREFIX}branches:`)) continue;
    if (!companyId || k.includes(`:${companyId}`)) {
      warmMemoryMap.delete(k);
    }
  }
  for (const storage of [
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
    typeof localStorage !== "undefined" ? localStorage : null,
  ]) {
    if (!storage) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (!k || !k.startsWith(WARM_PREFIX)) continue;
        if (preserveStaticBranches && k.startsWith(`${WARM_PREFIX}branches:`)) continue;
        if (!companyId || k.includes(`:${companyId}`)) {
          keys.push(k);
        }
      }
      for (const k of keys) storage.removeItem(k);
    } catch {
      // Ignore storage errors
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("sv_warm_cache_invalidated", () => {
    clearWarmSnapshots(undefined, true);
  });
  window.addEventListener("erp_api_session_expired", () => {
    clearWarmSnapshots();
  });
}

function resolveDefaultDatasetAndPeriod(): { dataset: string; period: string; basis: string } {
  let dataset = "accounting-2026";
  try {
    dataset = localStorage.getItem("ref_dataset") || "accounting-2026";
  } catch {}
  const year = dataset.match(/(20\d{2})/)?.[1] || "2026";
  const period = `${year}-12`;
  const basis = dataset.startsWith("management") ? "SAL" : "GL";
  return { dataset, period, basis };
}

const isUuid = (v?: string | null) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()));

/**
 * Pre-warm a company's critical landing data (Dashboard Overview, Dashboard Config, Branches, Settings)
 * via strictly read-only GET calls so Frame 1 renders real numbers immediately with 0ms flash.
 * Also kicks off a non-blocking secondary wave for Cash/Bank/Sales/Purchase lists.
 */
export function warmCompanyWorkspaceData(
  token: string,
  companyId: string,
  opts?: { redirectPath?: string | null; period?: string; branchId?: string },
): Promise<void> {
  if (!token || !isUuid(companyId)) return Promise.resolve();

  preloadWorkspace("overview");
  const targetSeg = (opts?.redirectPath || "").replace(/^\//, "").split(/[/?]/)[0];
  if (targetSeg) preloadWorkspace(targetSeg);

  const { period: defaultPeriod, basis } = resolveDefaultDatasetAndPeriod();
  const period = opts?.period || defaultPeriod;
  const branchScope = opts?.branchId && opts.branchId !== "all" ? opts.branchId : "";
  const dedupeId = `ws:${getTokenScope(token)}:${companyId}:${period}:${branchScope || "all"}:${basis}`;

  const existing = inFlightWarmPromises.get(dedupeId);
  if (existing) return existing;

  // Check if critical dashboard + branches are already warm (< 45s old)
  const ovrKey = buildDashboardOverviewWarmKey(token, companyId, period, branchScope, "PREVIOUS_PERIOD", basis);
  const cfgKey = buildDashboardConfigWarmKey(token, companyId);
  const brKey = buildBranchesWarmKey(token, companyId);
  if (
    readWarmSnapshot(ovrKey, 45_000) &&
    readWarmSnapshot(cfgKey, 120_000) &&
    readWarmSnapshot(brKey, 120_000)
  ) {
    return Promise.resolve();
  }

  const writer = createApiWriter(companyId, (path, init) => request(path, token, init));

  const criticalPromise = Promise.allSettled([
    fetchDashboardOverviewUcRpt01(writer, {
      period,
      branchId: branchScope || undefined,
      comparisonMode: "PREVIOUS_PERIOD",
      basis,
    }).then((res) => {
      if (res) writeWarmSnapshot(ovrKey, res);
    }),
    fetchDashboardConfigUcRpt01(writer).then((res) => {
      if (res) writeWarmSnapshot(cfgKey, res);
    }),
    request<any>(`/api/v1/organization/branches/?company_id=${encodeURIComponent(companyId)}`, token).then((res) => {
      const list = Array.isArray(res) ? res : res?.results || [];
      writeWarmSnapshot(brKey, list);
    }),
    request<any>(`/api/v1/common/settings/?company_id=${encodeURIComponent(companyId)}`, token),
    request<any>(`/api/v1/iam/memberships/me/?company_id=${encodeURIComponent(companyId)}`, token),
  ])
    .then(() => {
      // Non-blocking secondary wave: warm common operational catalogs in idle background
      const schedule =
        typeof window !== "undefined" && "requestIdleCallback" in window
          ? (cb: () => void) => (window as any).requestIdleCallback(cb, { timeout: 1500 })
          : (cb: () => void) => setTimeout(cb, 150);
      schedule(() => {
        const bgPaths = [
          "/api/v1/master-data/customers/",
          "/api/v1/master-data/parties/",
          "/api/v1/master-data/items/",
          "/api/v1/master-data/units-of-measure/",
          "/api/v1/master-data/tax-rates/",
          "/api/v1/sales/goods-sales/",
          "/api/v1/sales/service-sales/",
          "/api/v1/purchases/goods-purchases/",
          "/api/v1/purchases/service-purchases/",
          "/api/v1/inventory/transactions/",
          "/api/v1/cash/funds/",
          "/api/v1/cash/transactions/",
          "/api/v1/bank/accounts/",
          "/api/v1/bank/transactions/",
        ];
        for (const path of bgPaths) {
          const sep = path.includes("?") ? "&" : "?";
          const full = `${path}${sep}company_id=${encodeURIComponent(companyId)}&page_size=100`;
          void request<any>(full, token)
            .then((res) => {
              const list = Array.isArray(res) ? res : res?.results;
              if (Array.isArray(list)) {
                writeWarmSnapshot(buildListWarmKey(token, companyId, "all", path), list);
              }
            })
            .catch(() => {});
        }
      });
    })
    .finally(() => {
      inFlightWarmPromises.delete(dedupeId);
    });

  inFlightWarmPromises.set(dedupeId, criticalPromise);
  return criticalPromise;
}

export interface WarmAdminBundle {
  companyInfo?: any;
  members?: any[];
  employees?: any[];
  branches?: any[];
  departments?: any[];
  positions?: any[];
  roles?: any[];
  joinRequests?: any[];
  periods?: any[];
}

/**
 * Pre-warm Company Admin (`/admin`) read-only endpoints so Tab 1..4 render on Frame 1 without empty-table jump.
 */
export function warmCompanyAdminData(token: string, companyId: string): Promise<void> {
  if (!token || !isUuid(companyId)) return Promise.resolve();

  preloadWorkspace("company-admin");
  const adminKey = buildAdminWarmKey(token, companyId);
  if (readWarmSnapshot<WarmAdminBundle>(adminKey, 45_000)) {
    return Promise.resolve();
  }

  const dedupeId = `adm:${getTokenScope(token)}:${companyId}`;
  const existing = inFlightWarmPromises.get(dedupeId);
  if (existing) return existing;

  const p = Promise.allSettled([
    request<any>(`/api/v1/organization/companies/${companyId}/`, token),
    request<any>(`/api/v1/iam/memberships/?company_id=${companyId}`, token),
    request<any>(`/api/v1/organization/employees/?company_id=${companyId}`, token),
    request<any>(`/api/v1/organization/branches/?company_id=${companyId}`, token),
    request<any>(`/api/v1/organization/departments/?company_id=${companyId}`, token),
    request<any>(`/api/v1/organization/positions/?company_id=${companyId}`, token),
    request<any>(`/api/v1/iam/roles/?company_id=${companyId}`, token),
    request<any>(`/api/v1/common/company-join-requests/?company_id=${companyId}`, token),
    request<any>(`/api/v1/general-ledger/periods/?company_id=${companyId}`, token),
  ])
    .then(([compRes, memRes, empRes, brRes, deptRes, posRes, roleRes, joinRes, perRes]) => {
      const toList = (r: PromiseSettledResult<any>) =>
        r.status === "fulfilled" ? (Array.isArray(r.value) ? r.value : r.value?.results || []) : undefined;
      const bundle: WarmAdminBundle = {
        companyInfo: compRes.status === "fulfilled" ? compRes.value : undefined,
        members: toList(memRes),
        employees: toList(empRes),
        branches: toList(brRes),
        departments: toList(deptRes),
        positions: toList(posRes),
        roles: toList(roleRes),
        joinRequests: toList(joinRes),
        periods: toList(perRes),
      };
      if (bundle.members || bundle.roles) {
        writeWarmSnapshot(adminKey, bundle);
      }
      if (bundle.branches) {
        writeWarmSnapshot(buildBranchesWarmKey(token, companyId), bundle.branches);
      }
    })
    .finally(() => {
      inFlightWarmPromises.delete(dedupeId);
    });

  inFlightWarmPromises.set(dedupeId, p);
  return p;
}
