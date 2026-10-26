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

/**
 * Automatically prefetch high-priority core modules in background during idle time.
 * Staggered by 300ms intervals to leave the network free for critical user actions.
 */
export function setupIdlePreloading(): void {
  if (typeof window === "undefined") return;

  const runIdle =
    (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ||
    ((cb: () => void) => window.setTimeout(cb, 1200));

  runIdle(() => {
    // Top 5 most frequently used accounting modules
    const priorityModules = ["cash", "bank", "purchases", "sales", "invoices", "ledger"];
    let idx = 0;

    function prefetchNext() {
      if (idx < priorityModules.length) {
        preloadWorkspace(priorityModules[idx++]);
        window.setTimeout(prefetchNext, 350);
      }
    }

    prefetchNext();
  });
}
