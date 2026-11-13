/**
 * High-performance module preloader for Sổ Việt ERP.
 * Enables zero-delay navigation by predictive prefetching on hover and focus,
 * plus background prefetching during browser idle time (requestIdleCallback).
 */

export const WORKSPACE_LOADERS: Record<string, () => Promise<unknown>> = {
  overview: () => import("./MisaDashboardOverview"),
  cash: () => import("./MisaCashWorkspace"),
  bank: () => import("./MisaBankWorkspace"),
  purchases: () => import("./MisaPurchaseWorkspace"),
  sales: () => import("./MisaSalesWorkspace"),
  inventory: () => import("./MisaInventoryWorkspace"),
  tools: () => import("./MisaToolsWorkspace"),
  assets: () => import("./MisaAssetsWorkspace"),
  payroll: () => import("./MisaPayrollWorkspace"),
  tax: () => import("./MisaTaxWorkspace"),
  cost: () => import("./MisaCostWorkspace"),
  ledger: () => import("./MisaLedgerWorkspace"),
  budget: () => import("./MisaBudgetWorkspace"),
  reports: () => import("./MisaReportCenterWorkspace"),
  analysis: () => import("./MisaFinancialAnalysisWorkspace"),
  opening: () => import("./MisaOpeningBalanceWorkspace"),
  invoices: () => import("./MisaInvoiceWorkspace"),
  "supplier-risk": () => import("./MisaSupplierRiskWorkspace"),
  "invoice-lookup": () => import("./InvoiceLookupWorkspace"),
  "company-admin": () => import("./CompanyAdminWorkspace"),
  "super-admin": () => import("./SuperAdminWorkspace"),
};

const preloadedModules = new Set<string>();

/**
 * Preload a module's JS chunk on user intent (hover or keyboard focus).
 * Dynamic imports return cached promises, so multiple calls are safe and no-op.
 */
export function preloadWorkspace(moduleId: string): void {
  if (!moduleId || preloadedModules.has(moduleId)) return;
  const loader = WORKSPACE_LOADERS[moduleId];
  if (loader) {
    preloadedModules.add(moduleId);
    loader().catch(() => {
      preloadedModules.delete(moduleId);
    });
  }
}

let idlePreloadScheduled = false;

/**
 * Automatically prefetch high-priority core modules in background ONLY AFTER
 * initial first-load API data and React rendering have completely settled.
 * Spaced by 1200ms inside requestIdleCallback to avoid main-thread V8 parse jank.
 */
export function setupIdlePreloading(): void {
  if (typeof window === "undefined" || idlePreloadScheduled) return;
  idlePreloadScheduled = true;

  const scheduleIdle = (cb: () => void) => {
    const ric = (window as unknown as {
      requestIdleCallback?: (fn: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (ric) {
      ric(cb, { timeout: 5000 });
    } else {
      window.setTimeout(cb, 1200);
    }
  };

  // Wait 4s so initial screen API calls & paint have 100% network + CPU priority
  window.setTimeout(() => {
    const currentSeg = (window.location.pathname.split("/")[1] || "overview").toLowerCase();
    preloadedModules.add(currentSeg);
    const priorityModules = ["overview", "cash", "bank", "purchases", "sales", "reports", "invoices", "ledger"].filter(
      (m) => !preloadedModules.has(m)
    );
    let idx = 0;

    function prefetchNext() {
      if (idx >= priorityModules.length) return;
      scheduleIdle(() => {
        if (idx < priorityModules.length) {
          preloadWorkspace(priorityModules[idx++]);
          window.setTimeout(prefetchNext, 1200);
        }
      });
    }

    prefetchNext();
  }, 4000);
}
